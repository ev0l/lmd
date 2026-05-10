# lmd — project guide for Claude

## What this is

`lmd` is a lightweight CLI-launched markdown editor for Mac. Usage: `lmd [filename]`. It opens fast, has no Dock icon, auto-saves, and does Obsidian-style blended editing (syntax marks hide when the cursor is elsewhere). No vault concept — just a single file.

## Architecture

```
Swift (AppKit) + WKWebView + CodeMirror 6 in TypeScript
```

- **Swift** handles the window, file I/O, and JS↔Swift bridge
- **WKWebView** renders the editor (no Electron, no HTTP server)
- **CodeMirror 6** runs inside the WebView (`editor.bundle.js`)
- **esbuild** bundles `editor-src/editor.ts` → `Sources/lmd/Resources/editor.bundle.js`

Activation policy is `.accessory` so there's no Dock icon — it's a pure CLI tool.

## File map

```
Sources/lmd/
  main.swift                  — CLI entry: parse args, resolve path, launch NSApp
  AppDelegate.swift           — NSApplicationDelegate; sets up Edit menu (required for Cmd+C/V routing)
  EditorWindowController.swift— NSWindow 900×700, WKWebView, wires bridge + file handler
  Bridge.swift                — WKScriptMessageHandler; handles ready/save/openLink from JS
  FileHandler.swift           — read(), atomic write via temp file, startWatching() via DispatchSource
  Resources/
    editor.html               — CSS variables for light/dark theming, loads editor.bundle.js
    editor.bundle.js          — built from editor-src/ (do not edit directly)

editor-src/
  editor.ts                   — all CodeMirror logic
  build.js                    — esbuild config; outfile → Sources/lmd/Resources/editor.bundle.js
  package.json                — deps: @codemirror/*, @lezer/*
```

## Build

```bash
make build          # builds JS then Swift (release)
make dev            # JS watch mode + swift build (debug)
```

JS only: `cd editor-src && node build.js`
Swift only: `swift build -c release`

Run the built binary: `.build/release/lmd test.md`

## JS↔Swift bridge

**JS → Swift** via `window.webkit.messageHandlers.bridge.postMessage(msg)`:
- `{ type: 'ready' }` — editor loaded, Swift responds by calling `window.lmd.load(content)`
- `{ type: 'save', content }` — debounced 300ms after every doc change
- `{ type: 'openLink', url }` — Cmd+click on a link; Swift opens in default browser

**Swift → JS** via `webView.evaluateJavaScript(...)`:
- `window.lmd.load(content)` — replaces doc contents without adding to undo history
- `window.lmd.paste(text)` — inserts text at current selection (called from AppKit menu)

Content is JSON-encoded by `JSONEncoder` before being injected into JS to handle special characters safely.

## CodeMirror extensions (in order)

```typescript
history()
markdown({ codeLanguages: languages, extensions: [Strikethrough] })
syntaxHighlighting(classHighlighter)
syntaxHighlighting(tagHighlighter([{ tag: tags.strikethrough, class: 'tok-strikethrough' }]))
syntaxHighlighting(markdownStyle)
blendedMode      // hides marks + renders block widgets
inlineStyles     // explicit em/strong decorations (classHighlighter unreliable in WKWebView)
theme
linkHandler      // Cmd+click opens links
autoSave         // debounced save + word count update
search()
keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap])
EditorView.lineWrapping
```

## Key implementation details

### Two-pass decoration building (`buildDecorations`)
`RangeSetBuilder` throws if you add a range at `from <= lastTo`. Line decorations (from === to) collide with mark ranges starting at the same position. Solution: two separate builders joined with `RangeSet.join()`:
- Pass 1 (`lineBuilder`): line-level classes — `Blockquote` → `cm-md-blockquote`, `FencedCode` → `cm-md-codeblock`
- Pass 2 (`markBuilder`): inline mark hiding + block widgets

### Block widgets (cursor outside → replaced with widget)
- `HorizontalRule` → `HRWidget` (`<div>` with border-top)
- `Table` → `TableWidget` (HTML `<table>`, `block: true`)
- `Image` → `ImageWidget` (`<img>`)
- `URL` whose parent is `Link` → hidden (so `[text](url)` shows only `text`)

### Mark hiding
Nodes in `MARKS` set (`HeaderMark`, `EmphasisMark`, `CodeMark`, `CodeInfo`, `LinkMark`, `StrikethroughMark`, `QuoteMark`) are hidden when cursor is not on that line. `HeaderMark` and `QuoteMark` eat the trailing space too (prevents indentation artifact).

### Inline styles plugin (`inlineStyles`)
`classHighlighter` is unreliable for italic/bold in WKWebView. A separate `ViewPlugin` explicitly marks `Emphasis` nodes with `cm-md-em` and `StrongEmphasis` nodes with `cm-md-strong`. CSS in theme: `font-style:italic` and `font-weight:700`.

### Strikethrough and Tables
`@codemirror/lang-markdown`'s `markdown()` does NOT include GFM extensions by default. Must explicitly import `Strikethrough` and `Table` from `@lezer/markdown` and add both to `extensions`. `classHighlighter` doesn't cover `tags.strikethrough` either — requires the custom `tagHighlighter` line.

### Copy/paste and window shortcuts
`.accessory` policy apps have no menu bar, so Cmd+C/V/X/W don't route through the responder chain. Fix: `NSApp.mainMenu` with app menu (Close Window Cmd+W, Quit Cmd+Q) and Edit menu in `AppDelegate.setupMenu()`. WKWebView then handles clipboard natively; `NSWindow.performClose` handles Cmd+W.

### Local image support
`webView.loadFileURL(htmlURL, allowingReadAccessTo: homeDir)` — `homeDir` (not just the file's directory) lets the WebView access images referenced by absolute paths anywhere under `~`.

### Link clicks
Cmd+click only (plain click stays in editor). Handler walks the syntax tree from click position up to `Link`/`AutoLink`, finds the `URL` child, posts `openLink` to Swift.

## What's not done yet

- **Table editing** — `EPIC-TABLES.md` is the spec. Cursor inside table should show an editable grid (cell-level decorations, Tab/Shift+Tab nav, Enter for new row, auto-format on exit). Currently raw markdown pipes show when cursor is inside a table.
- **Distribution** — no GitHub Actions release workflow, no ad-hoc signing, no README install instructions.

## CSS variables (editor.html)

Light/dark via `prefers-color-scheme`. Variables: `--bg`, `--fg`, `--sel`, `--border`, `--input-bg`, `--code-bg`, `--link`, `--quote`, `--quote-border`, `--body`, `--mono`.

## Test file

`test.md` covers the full markdown spec: headings, emphasis (both `*` and `_`), strikethrough, blockquotes, lists, task lists, code blocks, links, images, tables, horizontal rules, mixed inline formatting.
