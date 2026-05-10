# lmd — Architecture Requirements Document

## Overview

`lmd` is a Mac-only, single-binary markdown editor launched from the terminal. It opens a native macOS window containing a web-based editor. The host language is Swift. The editor UI runs inside a system WebView (WKWebView). There is no HTTP server, no Electron, and no external runtime dependency.

---

## Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Language | Swift | Native Mac binary, fastest startup, first-class WKWebView access |
| Window / UI host | AppKit (NSWindow + WKWebView) | Native macOS, system WebView already in memory |
| Editor engine | CodeMirror 6 | Powers Obsidian; best-in-class markdown blended mode |
| JS bundler | esbuild | Sub-second build, zero config, single output file |
| Build system | Swift Package Manager | No Xcode project required, CLI-friendly |
| CI / Release | GitHub Actions | Builds and publishes binary on tag push |

---

## Project Structure

```
lmd/
├── Package.swift
├── Sources/lmd/
│   ├── main.swift                  # Entry point: parse args, launch app
│   ├── AppDelegate.swift           # NSApplication lifecycle
│   ├── EditorWindowController.swift # NSWindow + WKWebView setup
│   ├── Bridge.swift                # JS ↔ Swift message handling
│   ├── FileHandler.swift           # Read, write, watch file on disk
│   └── Resources/
│       ├── editor.html             # Minimal HTML shell
│       └── editor.bundle.js        # CodeMirror 6 bundle (built by esbuild)
├── editor-src/
│   ├── package.json
│   ├── editor.ts                   # CodeMirror 6 setup and extensions
│   └── build.js                    # esbuild config
└── .github/workflows/
    └── release.yml                 # Build and publish binary on tag
```

---

## Components

### 1. Entry Point (`main.swift`)

- Reads `CommandLine.arguments[1]` for the file path
- Resolves to an absolute path
- Creates the file if it does not exist (empty)
- Exits with a usage message if no argument is provided
- Hands off to `AppDelegate` and starts `NSApplication`

### 2. App Delegate (`AppDelegate.swift`)

- Configures `NSApplication` as an accessory app (no Dock icon)
- Instantiates `EditorWindowController` with the resolved file path
- Terminates the process when the window closes

### 3. Editor Window Controller (`EditorWindowController.swift`)

- Creates an `NSWindow` sized to a sensible default (e.g. 900×700), resizable
- Sets the window title to the filename (not full path)
- Embeds a full-size `WKWebView`
- Loads `editor.html` from the app bundle
- Passes the initial file content to the editor once the WebView reports ready
- Responds to system appearance changes (dark/light) by notifying the editor

### 4. JS ↔ Swift Bridge (`Bridge.swift`)

Swift registers as a `WKScriptMessageHandler`. All communication is message-passing.

**JS → Swift messages:**

| Message | Payload | Action |
|---|---|---|
| `ready` | — | Swift sends initial file content to editor |
| `save` | `{ content: string }` | Swift writes content to disk |
| `openLink` | `{ url: string }` | Swift opens URL in default browser via `NSWorkspace` |

**Swift → JS calls** (via `evaluateJavaScript`):

| Call | Purpose |
|---|---|
| `editor.load(content, filename)` | Populate editor on startup |
| `editor.setTheme('dark' \| 'light')` | Sync to system appearance |

### 5. File Handler (`FileHandler.swift`)

- **Read** — synchronous read at startup; content passed to bridge
- **Write** — called on every `save` message; writes atomically (write to temp file, rename)
- **Watch** — uses `DispatchSource.makeFileSystemObjectSource` to detect external changes (e.g. a `git pull`); reloads content in editor if file changes on disk while window is open

### 6. Editor Frontend (`editor-src/editor.ts`)

Built with CodeMirror 6. Key extensions:

- `@codemirror/lang-markdown` — markdown language support
- `@codemirror/view` hide-marks decorations — hides syntax characters (`**`, `#`, etc.) when the cursor is not on that line (Obsidian-style blended mode)
- `@codemirror/commands` — undo, redo, standard keybindings
- `@codemirror/search` — find and replace
- Line wrapping enabled
- Theme matched to system dark/light mode

**Auto-save:** the editor emits a `save` message on every document change, debounced at 300ms. No explicit save action required.

**Link handling:** clicks on URLs and markdown links are intercepted; the editor sends an `openLink` message to Swift rather than navigating the WebView.

---

## Data Flow

```
User types lmd file.md
        │
        ▼
main.swift resolves path, creates file if needed
        │
        ▼
NSWindow opens with WKWebView
        │
        ▼
editor.html + editor.bundle.js load from bundle (no network)
        │
        ▼
JS sends "ready" → Swift reads file → JS receives content → editor populates
        │
        ▼
User edits → CodeMirror emits change → debounce 300ms → JS sends "save" → Swift writes to disk
```

---

## Build Process

Two steps, run in sequence:

1. **Build JS bundle**
   ```
   cd editor-src && node build.js
   ```
   esbuild bundles `editor.ts` → `Sources/lmd/Resources/editor.bundle.js`

2. **Build Swift binary**
   ```
   swift build -c release
   ```
   Output: `.build/release/lmd`

A `Makefile` wraps both steps:
```
make build   # JS + Swift
make dev     # watch mode for JS, debug Swift build
```

---

## Distribution

### GitHub Release (manual tag trigger)

`.github/workflows/release.yml`:
1. Triggered on push of a version tag (`v*`)
2. Runs on `macos-latest` runner
3. Builds JS bundle, then Swift binary
4. Creates a `.tar.gz` containing the binary
5. Publishes as a GitHub release artifact

### Install instructions for users

```bash
# Download the latest release binary
curl -L https://github.com/<org>/lmd/releases/latest/download/lmd-macos.tar.gz | tar xz

# Move to PATH
mv lmd /usr/local/bin/lmd

# Remove quarantine flag (required because binary is not notarized)
xattr -d com.apple.quarantine /usr/local/bin/lmd
```

### Code Signing

**Only the publisher needs an Apple account — end users do not.**

Gatekeeper quarantines binaries downloaded from the internet. How it behaves depends on how the binary is signed:

| Approach | Cost | User experience |
|---|---|---|
| No signing | Free | Hard Gatekeeper block. Users must dig into System Settings. Not acceptable. |
| Ad-hoc signed | Free | One-time `xattr` command after download. Fine for developers. |
| Developer ID + Notarized | $99/yr (publisher only) | Binary runs with no warnings, no extra steps. |

**Initial release: ad-hoc signed.** The CI pipeline runs `codesign --sign -` on the binary before packaging. Users run the `xattr` command once after download. This is acceptable for a developer audience.

**Upgrade path:** if the `xattr` step becomes a friction point (non-developer users, wider distribution), the publisher enrolls in the Apple Developer Program ($99/yr) and the CI pipeline adds notarization. No change required for users beyond the next download.

---

## Key Constraints

- macOS 13+ (Ventura) minimum — WKWebView JS bridge API is stable there
- No network access required at any point (editor assets are bundled)
- Window must have no Dock icon — it behaves like a utility, not a persistent app
- Process exits when window is closed — no background process left running
