# lmd

A lightweight Markdown editor for Mac, launched from the terminal.

```
lmd notes.md
```

Opens a focused 900×700 window with no Dock icon. Auto-saves as you type. Close it with `Cmd+W`.

---

## Features

- **Blended editing** — syntax marks (`, *, #, >) hide when the cursor moves away, like Obsidian's live preview
- **Tables** — renders as a clean HTML table when reading; switches to an editable grid when your cursor is inside. Tab/Shift+Tab to navigate cells, Enter to add a row, `+` button to append at the bottom. Hover a column header to toggle alignment or remove the column.
- **No vault, no config** — just a file. Works with any `.md` file anywhere on your machine.
- **Auto-save** — debounced 300ms after every keystroke, writes atomically
- **Local images** — absolute paths under `~` render inline
- **Dark/light mode** — follows macOS system appearance

---

## Install

### 1. Download

Go to [Releases](../../releases) and download the latest `lmd.zip`.

### 2. Unzip and move to your PATH

**If you have write access to `/usr/local/bin` (most personal Macs):**

```bash
unzip lmd.zip
mv lmd /usr/local/bin/lmd
```

**On managed/corporate Macs without sudo access, install to your home directory instead:**

```bash
unzip lmd.zip
mkdir -p ~/.local/bin
mv lmd ~/.local/bin/lmd
```

Then add `~/.local/bin` to your PATH if it isn't already. Add this to your `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Reload your shell:

```bash
source ~/.zshrc
```

### 3. Allow it to run

macOS will block the binary the first time because it isn't notarized. Fix it with:

```bash
xattr -d com.apple.quarantine ~/.local/bin/lmd
# or if you installed to /usr/local/bin:
xattr -d com.apple.quarantine /usr/local/bin/lmd
```

Or: right-click the binary in Finder → Open → Open anyway.

### 4. Use it

```bash
lmd ~/notes.md
lmd todo.md
```

---

## Requirements

- macOS 13 (Ventura) or later
- Apple Silicon or Intel

---

## Building from source

```bash
git clone https://github.com/ev0l/lmd
cd lmd
make build
.build/release/lmd yourfile.md
```

Requires Xcode command line tools and Node.js (for bundling the editor).

---

## Keyboard shortcuts

| Key                     | Action                                    |
| ----------------------- | ----------------------------------------- |
| `Cmd+S`                 | Save (also auto-saves)                    |
| `Cmd+W`                 | Close window                              |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / Redo                               |
| `Cmd+F`                 | Find                                      |
| `Tab` / `Shift+Tab`     | Inside a table: next / previous cell      |
| `Enter`                 | Inside a table: new row below current row |
| `Escape`                | Inside a table: exit table                |
