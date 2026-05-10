# lmd — Epics

---

## Epic 1: Project Foundation

Establish the project structure so both the Swift binary and the JS editor bundle can be built from a single `make build` command.

**Stories:**
- Initialize Swift Package Manager project with a command-line tool target
- Initialize `editor-src/` with package.json and esbuild config
- Write `Makefile` with `build`, `dev`, and `clean` targets
- Confirm a blank NSWindow opens when running the binary with a filename argument
- Set up `.gitignore` for Swift build artifacts and node_modules

**Done when:** `make build && .build/release/lmd test.md` opens a blank native window on a fresh checkout.

---

## Epic 2: Native Window

Configure the macOS window to behave like a focused utility — not a full application — and feel native.

**Stories:**
- Window opens sized to a sensible default (900×700), resizable
- No Dock icon — process runs as an accessory app
- Window title shows the filename (not the full path)
- Window close terminates the process cleanly
- System dark/light mode change is detected and can be forwarded to the editor

**Done when:** the window looks and behaves correctly: no Dock icon, correct title, clean exit on close, responds to appearance changes.

---

## Epic 3: Editor Experience

Deliver the core editing experience: markdown that looks like a document, not a code file.

**Stories:**
- CodeMirror 6 initializes inside the WKWebView and fills the window
- Markdown language support loaded (`@codemirror/lang-markdown`)
- Blended mode: markdown syntax characters hide when the cursor is not on that line
- Line wrapping enabled
- Editor theme matches system dark and light mode
- Undo and redo work via standard keyboard shortcuts
- Find and replace works via Cmd+F

**Done when:** typing markdown in the editor looks and feels like Obsidian's live preview mode.

---

## Epic 4: File Operations

Connect the editor to the file on disk — opening, saving, and staying in sync.

**Stories:**
- CLI argument resolves to an absolute file path
- File is created empty if it does not exist
- File content is loaded into the editor on open
- Editor auto-saves to disk on every change (debounced 300ms)
- Writes are atomic (temp file + rename) so a crash never corrupts the file
- If the file changes on disk externally (e.g. `git pull`), the editor reloads it

**Done when:** `lmd README.md` opens the file, edits appear on disk within a second, and an external change to the file refreshes the editor.

---

## Epic 5: Links

Make URLs and markdown links first-class — clickable, opening in the system browser.

**Stories:**
- Plain URLs in the document are clickable
- Markdown links `[text](url)` open in the default browser on click
- WebView does not navigate away from the editor when a link is clicked

**Done when:** clicking any link opens it in the browser without affecting the editor window.

---

## Epic 6: Distribution

Package and publish the binary so a teammate can download and run it in under two minutes.

**Stories:**
- GitHub Actions workflow builds JS bundle and Swift binary on tag push
- Binary is ad-hoc signed (`codesign --sign -`) in CI
- Binary is packaged as a `.tar.gz` and attached to the GitHub release
- README documents the three-step install (download, move to PATH, clear quarantine)
- Release is tested on a clean Mac (no Xcode, no dev tools) before publishing

**Done when:** a teammate with no development tools installed can follow the README and have `lmd` working in the terminal.
