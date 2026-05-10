import { EditorView, ViewPlugin, Decoration, DecorationSet, ViewUpdate, keymap, WidgetType } from '@codemirror/view'
import { EditorState, StateField, RangeSetBuilder, RangeSet, Transaction } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { tags, classHighlighter, tagHighlighter } from '@lezer/highlight'
import { Strikethrough, Table } from '@lezer/markdown'

// ── Bridge ────────────────────────────────────────────────────────────────────

type Msg =
  | { type: 'ready' }
  | { type: 'save'; content: string }
  | { type: 'openLink'; url: string }

function post(msg: Msg) {
  ;(window as any).webkit?.messageHandlers?.bridge?.postMessage(msg)
}

// ── Widgets ───────────────────────────────────────────────────────────────────

class HRWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('div')
    el.style.cssText = 'border-top:1px solid var(--border);margin:8px 0;'
    return el
  }
  eq() { return true }
}

class ImageWidget extends WidgetType {
  constructor(private src: string, private alt: string) { super() }
  toDOM() {
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.style.cssText = 'max-width:100%;height:auto;display:block;margin:8px 0;border-radius:4px;'
    img.onerror = () => { img.style.opacity = '0.3' }
    return img
  }
  eq(o: ImageWidget) { return this.src === o.src }
}

function parseTable(raw: string) {
  const isSep = (l: string) => l.includes('-') && /^[\s|:\-]+$/.test(l)
  const cells = (line: string) => line.replace(/^\||\|$/g, '').split('|').map(s => s.trim())
  const parseAlign = (cell: string): 'left' | 'center' | 'right' => {
    const t = cell.trim()
    if (t.startsWith(':') && t.endsWith(':')) return 'center'
    if (t.endsWith(':')) return 'right'
    return 'left'
  }
  const lines = raw.split('\n').filter(l => l.trim())
  const sepLine = lines.find(isSep)
  const aligns: Array<'left' | 'center' | 'right'> = sepLine ? cells(sepLine).map(parseAlign) : []
  const dataLines = lines.filter(l => !isSep(l))
  const [header, ...rest] = dataLines
  return { headers: cells(header ?? ''), rows: rest.map(cells), aligns }
}

function removeTableColumn(view: EditorView, tableFrom: number, colIdx: number) {
  const state = view.state
  let node = syntaxTree(state).resolve(tableFrom + 1, 1)
  while (node && node.name !== 'Table') {
    if (!node.parent) return
    node = node.parent
  }
  if (!node || node.name !== 'Table') return
  const raw = state.doc.sliceString(node.from, node.to)
  const newRaw = raw.split('\n').map(line => {
    if (!line.trim()) return line
    const parts = line.replace(/^\||\|$/g, '').split('|')
    parts.splice(colIdx, 1)
    return '|' + parts.join('|') + '|'
  }).join('\n')
  view.dispatch({ changes: { from: node.from, to: node.to, insert: newRaw } })
}

function cycleColumnAlignment(view: EditorView, tableFrom: number, colIdx: number) {
  const state = view.state
  let node = syntaxTree(state).resolve(tableFrom + 1, 1)
  while (node && node.name !== 'Table') { if (!node.parent) return; node = node.parent }
  if (!node || node.name !== 'Table') return
  let sep = node.firstChild
  while (sep && sep.name !== 'TableDelimiter') sep = sep.nextSibling
  if (!sep) return
  const parts = state.doc.sliceString(sep.from, sep.to)
    .replace(/^\||\|$/g, '').split('|').map(s => s.trim())
  const cur = parts[colIdx] ?? '---'
  const curAlign = cur.startsWith(':') && cur.endsWith(':') ? 'center' : cur.endsWith(':') ? 'right' : 'left'
  const next = curAlign === 'left' ? 'center' : curAlign === 'center' ? 'right' : 'left'
  parts[colIdx] = next === 'center' ? ':---:' : next === 'right' ? '---:' : '---'
  view.dispatch({ changes: { from: sep.from, to: sep.to, insert: '|' + parts.join('|') + '|' } })
}

class TableWidget extends WidgetType {
  constructor(private text: string, private docFrom: number) { super() }
  toDOM(view: EditorView) {
    const { headers, rows, aligns } = parseTable(this.text)
    const wrap = document.createElement('div')
    wrap.style.cssText = 'overflow-x:auto;margin:12px 0;'
    const table = document.createElement('table')
    // word-break:normal resets the break-all inherited from EditorView.lineWrapping on .cm-content
    table.style.cssText = 'border-collapse:collapse;font-size:0.95em;cursor:text;width:100%;word-break:normal;'
    const thead = table.createTHead()
    const hrow = thead.insertRow()
    headers.forEach((h, i) => {
      const align = aligns[i] ?? 'left'
      const th = document.createElement('th')
      th.style.cssText =
        `border:1px solid var(--border);padding:6px 12px;text-align:${align};font-weight:600;` +
        'background:var(--input-bg);position:relative;min-width:2ch;'

      const label = document.createElement('span')
      label.textContent = h
      th.appendChild(label)

      const alignBtn = document.createElement('button')
      alignBtn.textContent = align === 'center' ? '↔' : align === 'right' ? '→' : '←'
      alignBtn.title = `Align: ${align} (click to cycle)`
      alignBtn.style.cssText =
        'position:absolute;top:2px;left:4px;display:none;border:none;background:none;' +
        'cursor:pointer;font-size:11px;line-height:1;padding:0 2px;color:var(--fg);opacity:0.5;'
      alignBtn.addEventListener('mousedown', e => {
        e.preventDefault()
        e.stopPropagation()
        cycleColumnAlignment(view, this.docFrom, i)
      })
      th.appendChild(alignBtn)

      const removeBtn = document.createElement('button')
      removeBtn.textContent = '×'
      removeBtn.style.cssText =
        'position:absolute;top:2px;right:4px;display:none;border:none;background:none;' +
        'cursor:pointer;font-size:14px;line-height:1;padding:0 2px;color:var(--fg);opacity:0.5;'
      removeBtn.addEventListener('mousedown', e => {
        e.preventDefault()
        e.stopPropagation()
        removeTableColumn(view, this.docFrom, i)
      })
      th.appendChild(removeBtn)

      th.addEventListener('mouseenter', () => { alignBtn.style.display = 'block'; removeBtn.style.display = 'block' })
      th.addEventListener('mouseleave', () => { alignBtn.style.display = 'none'; removeBtn.style.display = 'none' })

      hrow.appendChild(th)
    })
    const tbody = table.createTBody()
    rows.forEach(row => {
      const tr = tbody.insertRow()
      row.forEach((cell, i) => {
        const td = tr.insertCell()
        td.textContent = cell
        const align = aligns[i] ?? 'left'
        td.style.cssText =
          `border:1px solid var(--border);padding:6px 12px;overflow-wrap:break-word;text-align:${align};`
      })
    })
    wrap.appendChild(table)
    wrap.addEventListener('mousedown', e => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.docFrom + 1 } })
      view.focus()
    })
    return wrap
  }
  eq(o: TableWidget) { return this.text === o.text }
}

// ── Inline style decorations ──────────────────────────────────────────────────
// classHighlighter emits tok-emphasis / tok-strong but WKWebView sometimes
// fails to apply font-style/weight via those classes. This plugin adds explicit
// mark decorations with dedicated class names as a reliable fallback.

function buildInlineStyles(view: EditorView): DecorationSet {
  const emBuilder     = new RangeSetBuilder<Decoration>()
  const strongBuilder = new RangeSetBuilder<Decoration>()
  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name === 'Emphasis')
        emBuilder.add(node.from, node.to, Decoration.mark({ class: 'cm-md-em' }))
      if (node.name === 'StrongEmphasis')
        strongBuilder.add(node.from, node.to, Decoration.mark({ class: 'cm-md-strong' }))
    },
  })
  return RangeSet.join([emBuilder.finish(), strongBuilder.finish()])
}

const inlineStyles = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = buildInlineStyles(view) }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged)
        this.decorations = buildInlineStyles(u.view)
    }
  },
  { decorations: v => v.decorations }
)

// ── Blended mode ──────────────────────────────────────────────────────────────
// Two-pass decoration build:
//   Pass 1 (lineBuilder) — line-level classes for blockquotes and code blocks.
//   Pass 2 (markBuilder) — inline mark hiding and block widgets.
// Kept separate because RangeSetBuilder forbids adding at from <= lastTo,
// and line decorations (from === to) would collide with mark ranges starting
// at the same position.

const MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'CodeInfo',        // language tag after opening code fence
  'LinkMark',
  'StrikethroughMark',
  'QuoteMark',       // the > in blockquotes
])

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view
  const cursorLine = state.doc.lineAt(state.selection.main.head).number

  // ── Pass 1: line classes ──
  const lineBuilder = new RangeSetBuilder<Decoration>()

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'Blockquote') {
        const s = state.doc.lineAt(node.from).number
        const e = state.doc.lineAt(node.to).number
        for (let i = s; i <= e; i++)
          lineBuilder.add(state.doc.line(i).from, state.doc.line(i).from,
            Decoration.line({ class: 'cm-md-blockquote' }))
        return false // don't recurse so nested blockquotes don't double-add
      }
      if (node.name === 'FencedCode') {
        const s = state.doc.lineAt(node.from).number
        const e = state.doc.lineAt(node.to).number
        for (let i = s; i <= e; i++)
          lineBuilder.add(state.doc.line(i).from, state.doc.line(i).from,
            Decoration.line({ class: 'cm-md-codeblock' }))
        return false
      }
    },
  })

  // ── Pass 2: inline marks and block widgets ──
  const markBuilder = new RangeSetBuilder<Decoration>()

  syntaxTree(state).iterate({
    enter(node) {
      const sl  = state.doc.lineAt(node.from).number
      const el  = state.doc.lineAt(Math.min(node.to, state.doc.length)).number
      const hit = cursorLine >= sl && cursorLine <= el

      // ── Block widgets ──

      if (node.name === 'HorizontalRule') {
        if (!hit) markBuilder.add(node.from, node.to, Decoration.replace({ widget: new HRWidget() }))
        return
      }

      if (node.name === 'Table') return false // handled by tableField StateField

      if (node.name === 'Image') {
        if (!hit) {
          let url = '', alt = ''
          let child = node.node.firstChild
          while (child) {
            if (child.name === 'URL')       url = state.doc.sliceString(child.from, child.to)
            if (child.name === 'LinkLabel') alt = state.doc.sliceString(child.from + 1, child.to - 1)
            child = child.nextSibling
          }
          if (url)
            markBuilder.add(node.from, node.to, Decoration.replace({ widget: new ImageWidget(url, alt) }))
          return false
        }
        return
      }

      // ── Inline mark hiding ──

      // Hide URL inside Link in view mode (so [text](url) shows only "text")
      if (node.name === 'URL') {
        const parent = node.node.parent
        if (parent?.name === 'Link' && !hit)
          markBuilder.add(node.from, node.to, Decoration.replace({}))
        return
      }

      // Hide only the backslash in escape sequences (keep the escaped character visible)
      if (node.name === 'Escape') {
        if (!hit) markBuilder.add(node.from, node.from + 1, Decoration.replace({}))
        return
      }

      if (!MARKS.has(node.name)) return
      if (hit) return

      let to = node.to
      // Eat the space after # and > so headings/quotes don't look indented
      if ((node.name === 'HeaderMark' || node.name === 'QuoteMark') &&
          state.doc.sliceString(node.to, node.to + 1) === ' ') {
        to = node.to + 1
      }

      markBuilder.add(node.from, to, Decoration.replace({}))
    },
  })

  return RangeSet.join([lineBuilder.finish(), markBuilder.finish()])
}

const blendedMode = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = buildDecorations(view) }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged)
        this.decorations = buildDecorations(u.view)
    }
  },
  { decorations: v => v.decorations }
)

// ── Table block decorations (StateField — ViewPlugin cannot host block:true) ──

function buildTableDecos(state: EditorState): DecorationSet {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number
  const builder = new RangeSetBuilder<Decoration>()
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table') return
      const sl = state.doc.lineAt(node.from).number
      const el = state.doc.lineAt(Math.min(node.to, state.doc.length - 1)).number
      const hit = cursorLine >= sl && cursorLine <= el
      if (!hit) {
        const to = Math.min(node.to + 1, state.doc.length)
        builder.add(node.from, to, Decoration.replace({
          widget: new TableWidget(state.doc.sliceString(node.from, node.to), node.from),
          block: true,
        }))
      } else {
        // Cursor inside table: add "+" button as a block widget after the last row
        const lastLine = state.doc.lineAt(Math.min(node.to - 1, state.doc.length - 1))
        let colCount = 0
        const header = node.firstChild
        if (header && (header.name === 'TableHeader' || header.name === 'TableRow')) {
          let cell = header.firstChild
          while (cell) { if (cell.name === 'TableCell') colCount++; cell = cell.nextSibling }
        }
        builder.add(lastLine.to, lastLine.to, Decoration.widget({
          widget: new AddRowWidget(lastLine.to, colCount),
          block: true,
          side: 1,
        }))
      }
      return false
    },
  })
  return builder.finish()
}

const tableField = StateField.define<DecorationSet>({
  create: state => buildTableDecos(state),
  update(deco, tr) {
    if (tr.docChanged || tr.selection) return buildTableDecos(tr.state)
    return deco.map(tr.changes)
  },
  provide: f => EditorView.decorations.from(f),
})

// ── Table edit mode ───────────────────────────────────────────────────────────

interface CellPos { from: number; to: number; row: number; col: number }

function findTableNode(state: EditorState, pos: number) {
  let n = syntaxTree(state).resolve(pos, -1)
  while (n && n.name !== 'Table') { if (!n.parent) return null; n = n.parent }
  return n?.name === 'Table' ? n : null
}

function tableCells(state: EditorState, pos: number): { cells: CellPos[], idx: number } | null {
  const tbl = findTableNode(state, pos)
  if (!tbl) return null
  const cells: CellPos[] = []
  let idx = -1, rowN = 0
  let child = tbl.firstChild
  while (child) {
    if (child.name === 'TableHeader' || child.name === 'TableRow') {
      let colN = 0, cell = child.firstChild
      while (cell) {
        if (cell.name === 'TableCell') {
          if (pos >= cell.from && pos <= cell.to) idx = cells.length
          cells.push({ from: cell.from, to: cell.to, row: rowN, col: colN++ })
        }
        cell = cell.nextSibling
      }
      rowN++
    }
    child = child.nextSibling
  }
  return idx === -1 ? null : { cells, idx }
}

function buildTableEditDecos(view: EditorView): DecorationSet {
  const { state } = view
  const pos = state.selection.main.head
  const tbl = findTableNode(state, pos)
  if (!tbl) return Decoration.none

  // Parse column alignments from the separator row
  const colAligns: Array<'left' | 'center' | 'right'> = []
  let sepChild = tbl.firstChild
  while (sepChild) {
    if (sepChild.name === 'TableDelimiter') {
      const parts = state.doc.sliceString(sepChild.from, sepChild.to)
        .replace(/^\||\|$/g, '').split('|').map(s => s.trim())
      for (const p of parts) {
        if (p.startsWith(':') && p.endsWith(':')) colAligns.push('center')
        else if (p.endsWith(':')) colAligns.push('right')
        else colAligns.push('left')
      }
      break
    }
    sepChild = sepChild.nextSibling
  }

  const lineB = new RangeSetBuilder<Decoration>()
  const markB = new RangeSetBuilder<Decoration>()

  let child = tbl.firstChild
  while (child) {
    if (child.name === 'TableHeader' || child.name === 'TableRow') {
      const isHeader = child.name === 'TableHeader'
      const line = state.doc.lineAt(child.from)
      lineB.add(line.from, line.from, Decoration.line({ class: 'cm-md-table-row' }))
      let cell = child.firstChild
      let colN = 0
      let prevWasDelim = false
      while (cell) {
        if (cell.name === 'TableDelimiter') {
          if (isHeader && prevWasDelim) {
            // Two consecutive delimiters — empty cell with no TableCell node in the tree.
            // Attach controls just before this closing delimiter.
            const align = colAligns[colN] ?? 'left'
            markB.add(cell.from, cell.from, Decoration.widget({
              widget: new AlignToggleWidget(tbl.from, colN, align), side: -1,
            }))
            markB.add(cell.from, cell.from, Decoration.widget({
              widget: new RemoveColWidget(tbl.from, colN), side: -1,
            }))
            colN++
          }
          markB.add(cell.from, cell.to, Decoration.mark({ class: 'cm-md-table-pipe' }))
          prevWasDelim = true
        } else if (cell.name === 'TableCell') {
          prevWasDelim = false
          if (pos >= cell.from && pos <= cell.to)
            markB.add(cell.from, cell.to, Decoration.mark({ class: 'cm-md-table-cell-active' }))
          if (isHeader) {
            const align = colAligns[colN] ?? 'left'
            markB.add(cell.to, cell.to, Decoration.widget({
              widget: new AlignToggleWidget(tbl.from, colN, align), side: 1,
            }))
            markB.add(cell.to, cell.to, Decoration.widget({
              widget: new RemoveColWidget(tbl.from, colN), side: 1,
            }))
          }
          colN++
        } else {
          prevWasDelim = false
        }
        cell = cell.nextSibling
      }
    }
    if (child.name === 'TableDelimiter') {
      // The separator row (|---|---|) — collapse it; border-bottom on header provides visual separation
      const line = state.doc.lineAt(child.from)
      lineB.add(line.from, line.from, Decoration.line({ class: 'cm-md-table-sep-row' }))
      markB.add(child.from, child.to, Decoration.replace({}))
    }
    child = child.nextSibling
  }

  return RangeSet.join([lineB.finish(), markB.finish()])
}

const tableEditMode = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = buildTableEditDecos(view) }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged)
        this.decorations = buildTableEditDecos(u.view)
    }
  },
  { decorations: v => v.decorations }
)

// ── Table auto-format ─────────────────────────────────────────────────────────

function formatTable(raw: string): string {
  const lines = raw.split('\n').filter(l => l.trim())
  if (lines.length < 2) return raw

  const isSep = (l: string) => l.includes('-') && /^[\s|:\-]+$/.test(l)
  const parseCells = (l: string) => l.replace(/^\||\|$/g, '').split('|').map(s => s.trim())
  const parseAlign = (cell: string): 'left' | 'center' | 'right' => {
    const t = cell.trim()
    if (t.startsWith(':') && t.endsWith(':')) return 'center'
    if (t.endsWith(':')) return 'right'
    return 'left'
  }

  const sepLine = lines.find(isSep)
  if (!sepLine) return raw
  const aligns = parseCells(sepLine).map(parseAlign)

  const dataLines = lines.filter(l => !isSep(l))
  const parsed = dataLines.map(parseCells)
  const colCount = Math.max(...parsed.map(r => r.length), aligns.length)

  parsed.forEach(r => { while (r.length < colCount) r.push('') })
  while (aligns.length < colCount) aligns.push('left')

  const widths = Array.from({ length: colCount }, (_, i) =>
    Math.max(3, ...parsed.map(r => (r[i] ?? '').length))
  )

  const pad = (s: string, w: number, a: 'left' | 'center' | 'right') => {
    if (a === 'right')  return s.padStart(w)
    if (a === 'center') { const p = w - s.length; return ' '.repeat(Math.floor(p / 2)) + s + ' '.repeat(Math.ceil(p / 2)) }
    return s.padEnd(w)
  }
  const sepCell = (w: number, a: 'left' | 'center' | 'right') => {
    if (a === 'center') return ':' + '-'.repeat(Math.max(1, w - 2)) + ':'
    if (a === 'right')  return '-'.repeat(Math.max(1, w - 1)) + ':'
    return '-'.repeat(w)
  }

  const result: string[] = []
  let dataIdx = 0, sepDone = false
  lines.forEach(l => {
    if (isSep(l) && !sepDone) {
      result.push('| ' + widths.map((w, i) => sepCell(w, aligns[i])).join(' | ') + ' |')
      sepDone = true
    } else if (!isSep(l)) {
      const row = parsed[dataIdx++] ?? []
      result.push('| ' + widths.map((w, i) => pad(row[i] ?? '', w, aligns[i])).join(' | ') + ' |')
    }
  })
  return result.join('\n')
}

function applyTableFormat(view: EditorView, tblFrom: number) {
  const tbl = findTableNode(view.state, tblFrom + 1)
  if (!tbl) return
  const raw = view.state.doc.sliceString(tbl.from, tbl.to)
  const formatted = formatTable(raw)
  if (formatted !== raw) {
    view.dispatch({
      changes: { from: tbl.from, to: tbl.to, insert: formatted },
      annotations: [Transaction.addToHistory.of(false)],
    })
  }
}

// Detect cursor leaving a table and auto-format
const tableAutoFormat = EditorView.updateListener.of(u => {
  if (!u.selectionSet) return
  const oldPos = u.startState.selection.main.head
  const oldTbl  = findTableNode(u.startState, oldPos)
  if (!oldTbl) return
  const newTbl = findTableNode(u.state, u.state.selection.main.head)
  const mappedFrom = u.docChanged ? u.changes.mapPos(oldTbl.from) : oldTbl.from
  if (newTbl && newTbl.from === mappedFrom) return // still in same table
  setTimeout(() => applyTableFormat(u.view, mappedFrom), 0)
})

// ── Table keymap ──────────────────────────────────────────────────────────────

function tableTab(view: EditorView, reverse = false): boolean {
  const r = tableCells(view.state, view.state.selection.main.head)
  if (!r) return false
  const next = r.idx + (reverse ? -1 : 1)
  if (next < 0 || next >= r.cells.length) return false
  const c = r.cells[next]
  view.dispatch({ selection: { anchor: c.from, head: c.to }, scrollIntoView: true })
  return true
}

class AddRowWidget extends WidgetType {
  constructor(private lastLineEnd: number, private colCount: number) { super() }

  toDOM(view: EditorView) {
    const btn = document.createElement('button')
    btn.className = 'cm-md-table-add-row'
    btn.textContent = '+'
    btn.title = 'Add row'
    btn.addEventListener('mousedown', e => {
      e.preventDefault()
      const newRow = '\n' + Array(this.colCount + 1).fill('|').join('  ')
      view.dispatch({
        changes: { from: this.lastLineEnd, insert: newRow },
        selection: { anchor: this.lastLineEnd + 2 },
        scrollIntoView: true,
      })
      view.focus()
    })
    return btn
  }

  eq(o: AddRowWidget) { return this.lastLineEnd === o.lastLineEnd && this.colCount === o.colCount }
}

class RemoveColWidget extends WidgetType {
  constructor(private tableFrom: number, private colIdx: number) { super() }

  toDOM(view: EditorView) {
    const btn = document.createElement('button')
    btn.textContent = '×'
    btn.style.cssText =
      'border:none;background:none;cursor:pointer;font-size:12px;line-height:1;' +
      'padding:0 3px;color:var(--fg);opacity:0.4;vertical-align:middle;'
    btn.addEventListener('mousedown', e => {
      e.preventDefault()
      e.stopPropagation()
      removeTableColumn(view, this.tableFrom, this.colIdx)
    })
    return btn
  }

  eq(o: RemoveColWidget) { return this.tableFrom === o.tableFrom && this.colIdx === o.colIdx }
}

class AlignToggleWidget extends WidgetType {
  constructor(
    private tableFrom: number,
    private colIdx: number,
    private align: 'left' | 'center' | 'right'
  ) { super() }

  toDOM(view: EditorView) {
    const btn = document.createElement('button')
    btn.textContent = this.align === 'center' ? '↔' : this.align === 'right' ? '→' : '←'
    btn.title = `Align: ${this.align} (click to cycle)`
    btn.style.cssText =
      'border:none;background:none;cursor:pointer;font-size:11px;line-height:1;' +
      'padding:0 3px;color:var(--fg);opacity:0.4;vertical-align:middle;'
    btn.addEventListener('mousedown', e => {
      e.preventDefault()
      e.stopPropagation()
      cycleColumnAlignment(view, this.tableFrom, this.colIdx)
    })
    return btn
  }

  eq(o: AlignToggleWidget) {
    return this.tableFrom === o.tableFrom && this.colIdx === o.colIdx && this.align === o.align
  }
}

function tableEnter(view: EditorView): boolean {
  const r = tableCells(view.state, view.state.selection.main.head)
  if (!r) return false
  const colCount = r.cells.filter(c => c.row === r.cells[r.idx].row).length
  const line = view.state.doc.lineAt(r.cells[r.idx].from)
  const newRow = '\n' + Array(colCount + 1).fill('|').join('  ')
  view.dispatch({
    changes: { from: line.to, insert: newRow },
    selection: { anchor: line.to + 2 },
    scrollIntoView: true,
  })
  return true
}

function tableEscape(view: EditorView): boolean {
  const tbl = findTableNode(view.state, view.state.selection.main.head)
  if (!tbl) return false
  const lastLine = view.state.doc.lineAt(Math.max(0, tbl.to - 1))
  const after = lastLine.to + 1
  if (after > view.state.doc.length) {
    view.dispatch({
      changes: { from: view.state.doc.length, insert: '\n' },
      selection: { anchor: view.state.doc.length + 1 },
    })
  } else {
    view.dispatch({ selection: { anchor: after }, scrollIntoView: true })
  }
  return true
}

function tableBackspace(view: EditorView): boolean {
  const r = tableCells(view.state, view.state.selection.main.head)
  if (!r) return false
  const { cells, idx } = r
  const curRow = cells[idx].row
  if (curRow === 0) return false // never delete the header
  const rowCells = cells.filter(c => c.row === curRow)
  const allEmpty = rowCells.every(c => view.state.doc.sliceString(c.from, c.to).trim() === '')
  if (!allEmpty) return false
  const rowLine = view.state.doc.lineAt(rowCells[0].from)
  const prevLast = cells.filter(c => c.row === curRow - 1).at(-1)!
  view.dispatch({
    changes: { from: rowLine.from - 1, to: rowLine.to, insert: '' },
    selection: { anchor: prevLast.to },
    scrollIntoView: true,
  })
  return true
}

const tableKeymap = keymap.of([
  { key: 'Tab',       run: v => tableTab(v, false) },
  { key: 'Shift-Tab', run: v => tableTab(v, true)  },
  { key: 'Enter',     run: tableEnter               },
  { key: 'Escape',    run: tableEscape              },
  { key: 'Backspace', run: tableBackspace           },
])

// ── Highlight style ───────────────────────────────────────────────────────────

const markdownStyle = HighlightStyle.define([
  { tag: tags.heading1,      fontSize: '1.75em', fontWeight: '700', lineHeight: '1.3' },
  { tag: tags.heading2,      fontSize: '1.4em',  fontWeight: '700', lineHeight: '1.3' },
  { tag: tags.heading3,      fontSize: '1.15em', fontWeight: '700', lineHeight: '1.3' },
  { tag: tags.heading4,      fontWeight: '700' },
  { tag: tags.heading5,      fontWeight: '700' },
  { tag: tags.heading6,      fontWeight: '700' },
  { tag: tags.strong,        fontWeight: '700' },
  { tag: tags.emphasis,      fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace,     fontFamily: 'var(--mono)', fontSize: '0.88em',
                              background: 'var(--code-bg)', padding: '1px 4px', borderRadius: '4px' },
  { tag: tags.link,          color: 'var(--link)', textDecoration: 'underline', cursor: 'pointer' },
  { tag: tags.url,           color: 'var(--link)', fontSize: '0.85em', opacity: '0.7' },
  { tag: tags.quote,         color: 'var(--quote)' },
])

// ── Theme ─────────────────────────────────────────────────────────────────────

const theme = EditorView.baseTheme({
  '&': {
    height: '100%',
    fontSize: '15px',
    fontFamily: 'var(--body)',
    background: 'var(--bg)',
    color: 'var(--fg)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    paddingTop: '48px',
    paddingBottom: '80px',
    lineHeight: '1.75',
  },
  '.cm-content': {
    maxWidth: '740px',
    margin: '0 auto',
    padding: '0 48px',
    caretColor: 'var(--fg)',
  },
  '.cm-line': { padding: '0' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftWidth: '2px', borderLeftColor: 'var(--fg)' },
  '.cm-selectionBackground, ::selection': { background: 'var(--sel) !important' },
  // tok-* classes from classHighlighter — reliable fallback for inline styles
  '.tok-strong':        { fontWeight: '700' },
  '.tok-emphasis':      { fontStyle: 'italic' },
  '.cm-md-em':          { fontStyle: 'italic' },
  '.cm-md-strong':      { fontWeight: '700' },
  '.tok-strikethrough': { textDecoration: 'line-through' },
  '.tok-link':          { color: 'var(--link)', textDecoration: 'underline', cursor: 'pointer' },
  '.tok-monospace':     { fontFamily: 'var(--mono)', fontSize: '0.88em',
                          background: 'var(--code-bg)', padding: '1px 4px', borderRadius: '4px' },
  // Blockquote lines
  '.cm-md-blockquote': {
    borderLeft: '3px solid var(--quote-border)',
    paddingLeft: '16px',
    color: 'var(--quote)',
  },
  // Fenced code block lines
  '.cm-md-codeblock': {
    fontFamily: 'var(--mono)',
    fontSize: '0.88em',
    background: 'var(--code-bg)',
    padding: '0 8px',
  },
  // Table edit mode
  '.cm-md-table-row': {
    background: 'var(--input-bg)',
    borderBottom: '1px solid var(--border)',
  },
  '.cm-md-table-sep-row': {
    fontSize: '0 !important',
    lineHeight: '0 !important',
    padding: '0 !important',
    margin: '0 !important',
    border: 'none !important',
    overflow: 'hidden',
  },
  '.cm-md-table-pipe': {
    color: 'var(--border)',
    fontWeight: '400',
  },
  '.cm-md-table-cell-active': {
    background: 'var(--sel)',
    borderRadius: '2px',
  },
  '.cm-md-table-add-row': {
    display: 'block',
    width: '100%',
    padding: '3px 0',
    marginTop: '4px',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: '3px',
    color: 'var(--fg)',
    opacity: '0.4',
    fontSize: '13px',
    fontFamily: 'var(--body)',
    userSelect: 'none',
  },
  '.cm-md-table-add-row:hover': {
    opacity: '0.8',
  },
  // Search panel
  '.cm-panels': { background: 'var(--bg)', borderTop: '1px solid var(--border)' },
  '.cm-textfield': {
    background: 'var(--input-bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
  },
  '.cm-button': {
    background: 'var(--input-bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
  },
})

// ── Link click handler ────────────────────────────────────────────────────────

const linkHandler = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!event.metaKey) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false
    let node = syntaxTree(view.state).resolve(pos, -1)
    while (node) {
      if (node.name === 'Link' || node.name === 'AutoLink') {
        let child = node.firstChild
        while (child) {
          if (child.name === 'URL') {
            post({ type: 'openLink', url: view.state.doc.sliceString(child.from, child.to) })
            event.preventDefault()
            return true
          }
          child = child.nextSibling
        }
        break
      }
      if (!node.parent) break
      node = node.parent
    }
    return false
  },
})

// ── Word count ────────────────────────────────────────────────────────────────

const wordCountEl = document.createElement('div')
wordCountEl.style.cssText =
  'position:fixed;bottom:12px;right:16px;font-size:11px;opacity:0.35;' +
  'font-family:var(--mono);pointer-events:none;z-index:100;'
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(wordCountEl))

function updateWordCount(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  wordCountEl.textContent = `${words} words`
}

// ── Auto-save (debounced) ─────────────────────────────────────────────────────

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>
  return ((...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }) as T
}

const save = debounce((content: string) => post({ type: 'save', content }), 300)

const autoSave = EditorView.updateListener.of(u => {
  if (u.docChanged) {
    const text = u.state.doc.toString()
    save(text)
    updateWordCount(text)
  }
})

// ── Editor init ───────────────────────────────────────────────────────────────

let view: EditorView

function init() {
  view = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [
        history(),
        markdown({ codeLanguages: languages, extensions: [Strikethrough, Table] }),
        syntaxHighlighting(classHighlighter),
        syntaxHighlighting(tagHighlighter([{ tag: tags.strikethrough, class: 'tok-strikethrough' }])),
        syntaxHighlighting(markdownStyle),
        blendedMode,
        tableField,
        tableEditMode,
        inlineStyles,
        theme,
        linkHandler,
        autoSave,
        tableAutoFormat,
        search(),
        tableKeymap,
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.lineWrapping,
      ],
    }),
    parent: document.getElementById('editor')!,
  })

  post({ type: 'ready' })
}

;(window as any).lmd = {
  load(content: string) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      annotations: [Transaction.addToHistory.of(false)],
    })
    updateWordCount(content)
  },

  paste(text: string) {
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: text }, scrollIntoView: true })
    view.focus()
  },

  copy(): string {
    const { from, to } = view.state.selection.main
    return view.state.doc.sliceString(from, to)
  },

  cut(): string {
    const { from, to } = view.state.selection.main
    const text = view.state.doc.sliceString(from, to)
    if (text) view.dispatch({ changes: { from, to, insert: '' } })
    return text
  },

  selectAll() {
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
    view.focus()
  },
}

document.addEventListener('DOMContentLoaded', init)
