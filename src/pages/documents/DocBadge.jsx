import { getDocStatus, isOverdue, STATUS_META } from '../../lib/documentStatus'

// Status "tiles": a short label + color, so state is readable at a glance and
// never depends on color alone. Missing is loud (red ✕), overdue is loudest
// (solid red !), finished states are calm.
export const TILE = {
  na:        { glyph: '–',    cls: 'border-transparent text-gray-300 font-normal' },
  none:      { glyph: '✕',    cls: 'bg-red-100 border-red-400 text-red-700 text-xs font-bold' },
  draft:     { glyph: 'DR',   cls: 'bg-gray-100 border-gray-300 text-gray-700' },
  checking:  { glyph: 'CHK',  cls: 'bg-orange-100 border-orange-300 text-orange-800' },
  signing:   { glyph: 'SGN',  cls: 'bg-purple-100 border-purple-300 text-purple-800' },
  claimable: { glyph: 'CLM',  cls: 'bg-amber-100 border-amber-300 text-amber-800' },
  soft:      { glyph: 'SOFT', cls: 'bg-blue-100 border-blue-300 text-blue-800' },
  hard:      { glyph: 'HARD', cls: 'bg-indigo-100 border-indigo-300 text-indigo-800' },
  submitted: { glyph: '✓',    cls: 'bg-green-100 border-green-300 text-green-700 text-xs font-bold' },
}

const OVERDUE_TILE = { glyph: '!', cls: 'bg-red-600 border-red-700 text-white text-xs font-bold' }

const SIZES = {
  md: 'h-7 min-w-[2.75rem]',
  sm: 'h-6 min-w-[2.5rem]',
}

export function StatusTile({ status, overdue = false, size = 'md', title }) {
  const t = overdue && status !== 'na' ? OVERDUE_TILE : TILE[status] ?? TILE.na
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center px-1 rounded-md border text-[10px] font-semibold tracking-wide leading-none flex-shrink-0 ${SIZES[size]} ${t.cls}`}
    >
      {t.glyph}
    </span>
  )
}

export default function DocBadge({ doc }) {
  const status  = getDocStatus(doc)
  const meta    = STATUS_META[status]
  const overdue = isOverdue(doc)

  const title = doc
    ? [
        meta.label,
        doc.expected_date  ? `Expected: ${doc.expected_date}`   : null,
        doc.submitted_date ? `Submitted: ${doc.submitted_date}` : null,
        overdue ? 'Overdue' : null,
        doc.notes ? `Notes: ${doc.notes}` : null,
      ].filter(Boolean).join(' · ')
    : 'Not generated for this project (category doesn\'t require it, or checklist not yet generated)'

  return (
    <span className="flex items-center justify-center" title={title}>
      <StatusTile status={status} overdue={overdue} title={title} />
    </span>
  )
}