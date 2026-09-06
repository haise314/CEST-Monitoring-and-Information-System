import { getDocStatus, isOverdue, STATUS_META } from '../../lib/documentStatus'

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
      <span
        className={`inline-block w-3 h-3 rounded-full ${meta.dotClass} ${
          overdue ? 'ring-2 ring-red-500 ring-offset-1' : ''
        }`}
      />
    </span>
  )
}