// CSV export for any TanStack table. Exports exactly what the user is looking
// at: visible columns only, and every row that passes the current filters and
// search, in the current sort order, across ALL pages (not just the page shown).
//
// Opens cleanly in Excel: UTF-8 BOM so Filipino place names/accents survive,
// CRLF line endings, and values that would be read as formulas are neutralised.

function escapeCell(value) {
  if (value == null) return ''
  let s = String(value)
  if (typeof value === 'string' && /^[=+\-@]/.test(s)) s = "'" + s // formula injection guard
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function todayStamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// formatValue(column, value) is optional — lets a page turn a non-scalar cell
// value (e.g. a document row) into readable text. Returns the number of rows exported.
export function exportTableCsv(table, { filename, formatValue } = {}) {
  const columns = table.getVisibleLeafColumns().filter(
    c => typeof c.columnDef.header === 'string' && c.columnDef.header.trim() !== ''
  )
  const rows = table.getPrePaginationRowModel().rows

  const lines = [columns.map(c => escapeCell(c.columnDef.header)).join(',')]
  for (const row of rows) {
    lines.push(
      columns.map(c => {
        const raw = row.getValue(c.id)
        return escapeCell(formatValue ? formatValue(c, raw) : raw)
      }).join(',')
    )
  }

  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `export-${todayStamp()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return rows.length
}