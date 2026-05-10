# Epic: Table Editing

## Goal

Tables in lmd should feel like Obsidian's live preview — a clean rendered table when you're reading, a structured editable grid when you're writing.

---

## Current State

- Cursor outside table → HTML table widget renders correctly (fixed: `Table` extension was missing from markdown parser)
- Cursor inside table → raw markdown pipes show, no structure, no navigation

## Target State

- Cursor outside table → clean HTML table (no change)
- Cursor inside table → table renders as an editable grid where each cell is individually editable, Tab/Shift+Tab navigates between cells, Enter creates a new row

---

## Behaviour Spec

### View mode (cursor outside table)
- Renders as a styled HTML `<table>` — already working
- Cmd+click a cell → moves cursor into that cell, switching to edit mode

### Edit mode (cursor inside table)
- Table renders as a visual grid (not raw markdown)
- Each cell is a real editable region
- The underlying document still stores plain GFM markdown
- Cursor is always inside exactly one cell
- Active cell shows a subtle focus ring or background
- Column widths are fixed per-column (widest content wins)

### Keyboard navigation
| Key | Action |
|-----|--------|
| Tab | Move to next cell; wraps to first cell of next row |
| Shift+Tab | Move to previous cell; wraps to last cell of previous row |
| Enter | Create new row below current row, place cursor in first cell |
| Backspace on empty last row | Delete that row, move cursor up |
| Escape | Exit table, place cursor below it |

### Column alignment
- `:---` left (default), `:---:` center, `---:` right
- Alignment is preserved when editing; applies to both the HTML render and the edit-mode grid
- Alignment row is not editable directly (too noisy); instead it's controlled by a right-click or toolbar in a future version

### Auto-format on exit
- When cursor leaves the table, the underlying markdown is re-formatted to align columns by padding with spaces
- This keeps the raw markdown readable in git diffs

---

## Implementation Approach

The key insight: instead of using a `Decoration.replace` widget for the whole table when in edit mode, switch to a **cell-level decoration** approach:

1. Parse the table from the syntax tree — get row/column positions
2. Replace each `|` delimiter with a styled widget that renders as a column separator
3. Apply line decorations to give each row a table-row appearance
4. Add custom keymap handlers for Tab, Shift+Tab, Enter, Backspace, Escape within table context
5. On cursor exit (detected via update listener), auto-format the raw markdown

This approach keeps the document as plain GFM markdown and only decorates the visual presentation — no separate data model.

---

## Stories

### Story 1: Cell-level decoration in edit mode
When the cursor is inside a table, replace the current full-table widget with per-cell decorations that visually separate the cells and apply row/column styling. The `|` characters become invisible column separators and each line gets a `cm-md-table-row` class.

**Done when:** A table with the cursor inside it looks structured (not raw pipes) and the column separators are visually clear.

### Story 2: Tab/Shift+Tab cell navigation
Add a keymap extension that, when the cursor is inside a table, intercepts Tab and Shift+Tab to jump between cell regions rather than inserting a tab character.

**Done when:** Tab moves through every cell left-to-right, top-to-bottom. Shift+Tab goes in reverse. Wrapping between rows works.

### Story 3: Enter creates new row
When the cursor is in the last column of any row, Enter inserts a new empty row below with the correct number of pipe-delimited columns and places the cursor in the first cell of the new row.

**Done when:** Pressing Enter in any table cell adds a new row; pressing Enter in the last row adds the row at the bottom.

### Story 4: Auto-format on exit
Add an update listener that detects when the cursor moves out of a table range. On exit, re-parse the table and rewrite it with padded columns so all `|` characters align vertically in the raw markdown.

**Done when:** After editing a table and pressing Escape or clicking outside, the raw markdown shows neatly aligned columns in a text editor.

### Story 5: Backspace to delete empty row
When the cursor is in the first cell of a row and that row is completely empty, Backspace deletes the row and moves the cursor up to the last cell of the previous row.

**Done when:** An empty trailing row disappears on Backspace.

---

## Out of Scope (this epic)

- Add/remove columns via UI
- Column alignment UI (right-click, toolbar)
- Sorting rows
- Merged cells
