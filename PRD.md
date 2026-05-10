# lmd — Product Requirements Document

## Problem

Teams default to Google Docs and Confluence for documentation because markdown files in git repos feel like a second-class experience. The tools that make markdown feel great (Obsidian, Notion) impose their own structure — vaults, workspaces, accounts — that creates friction and lock-in. There is no tool that makes opening and editing a markdown file feel as fast and natural as opening a text file.

## Goal

`lmd` is a single-purpose markdown editor that makes editing a file in a git repo feel as good as Obsidian, with none of the overhead. It exists to lower the barrier between a developer and a markdown file.

---

## Target Users

- Developers and technical teammates working in git repositories
- Teams trying to move documentation out of Google Docs or Confluence and into the repo
- Anyone who wants to open a markdown file quickly without a heavy editor

---

## What Success Looks Like

- A teammate who has never used `lmd` can open a file, make an edit, and save — without reading any instructions
- The tool opens fast enough that it does not feel slower than opening a file in a text editor
- Markdown feels like a document, not a code file — headers look like headers, bold looks bold
- Teams stop reaching for Google Docs for simple documentation because `lmd` is easier

---

## User Stories

**As a developer**, I want to type `lmd FILENAME.md` and have the file open immediately, so I can read or edit without switching contexts.

**As a developer**, I want to see formatted markdown as I type — not raw syntax — so the document feels like a real document, not code.

**As a team lead**, I want my teammates to be able to install and use `lmd` in under two minutes, so adoption is not blocked by setup.

**As a writer**, I want my changes saved automatically, so I never lose work and never have to think about saving.

**As a developer**, I want to open `lmd` on any `.md` file in any directory, so there is no project setup, vault, or workspace required.

---

## Features

### Must Have

- **Open any file** — `lmd [filename]` opens that file and only that file. No workspace, vault, or project setup required.
- **Blended view and edit** — The document renders as formatted markdown. Markdown syntax (headers, bold, links) is hidden unless the cursor is on that line. Editing feels like writing in a document, not editing code.
- **Auto-save** — Changes are written to disk continuously. No save shortcut needed, no unsaved state.
- **Fast open** — The editor is ready to use in under one second from running the command.
- **Keyboard-first** — All common actions are reachable without a mouse.

### Should Have

- **New file** — `lmd [filename]` creates the file if it does not exist.
- **Minimal chrome** — No toolbar clutter. The document takes up the full window. Controls appear only when needed.
- **Filename in title bar** — Shows the file path so the user always knows what they are editing.
- **Clickable links** — URLs and markdown links open in the default browser when clicked.
- **Dark and light mode** — Follows the system setting automatically.

### Nice to Have

- **Image rendering** — Images referenced in the markdown render inline.
- **Table support** — Tables render as visual tables and are editable.
- **Find and replace** — Standard text search within the document.
- **Word count** — Shown unobtrusively, useful for longer documents.

---

## Non-Goals

- No vault, workspace, or project concept
- No cloud sync or account required
- No plugin system
- No folder/file browser or sidebar
- No collaboration or multiplayer features
- No mobile support
- No version history (git handles that)

---

## Distribution

- Downloaded as a single binary from a GitHub release
- Works from the terminal via `lmd [filename]`
- No dependency installation required by the end user

---

## Constraints

- Mac only (initial release)
- Must work offline, entirely
