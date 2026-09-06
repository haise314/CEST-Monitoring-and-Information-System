// ─── Status rank ────────────────────────────────────────────────────────────
// The office's own completeness ranking, highest first:
// submitted > hard copy > soft copy (gdrive link) > hard copy claimable > nothing
// N/A sits outside the scale entirely.

export const RANK_ORDER = ['na', 'none', 'claimable', 'soft', 'hard', 'submitted']

export const STATUS_META = {
  na:        { label: 'N/A',                        dotClass: 'bg-gray-300' },
  none:      { label: 'Nothing on file',             dotClass: 'bg-red-400' },
  claimable: { label: 'Claimable (at beneficiary)',  dotClass: 'bg-amber-400' },
  soft:      { label: 'Soft copy on file',           dotClass: 'bg-blue-400' },
  hard:      { label: 'Hard copy on file',           dotClass: 'bg-indigo-500' },
  submitted: { label: 'Submitted',                   dotClass: 'bg-green-500' },
}

// doc: a document row, or undefined/null if this project's category never
// generated this document type at all (treated the same as N/A).
export function getDocStatus(doc) {
  if (!doc || doc.is_not_applicable) return 'na'
  if (doc.submitted) return 'submitted'
  if (doc.has_hard_copy) return 'hard'
  if (doc.gdrive_link) return 'soft'
  if (doc.hard_copy_claimable) return 'claimable'
  return 'none'
}

export function statusRank(doc) {
  return RANK_ORDER.indexOf(getDocStatus(doc))
}

export function isOverdue(doc) {
  if (!doc || doc.is_not_applicable || !doc.expected_date || doc.submitted) return false
  const today = new Date(new Date().toDateString())
  return new Date(doc.expected_date) < today
}

// ─── Filter conditions ────────────────────────────────────────────────────────
// Deliberately independent of the rank above: "missing soft copy" means
// exactly "no gdrive_link", regardless of what the badge is showing.
// All conditions except 'na' require the document to actually exist for
// this project (i.e. its type applies to the project's category).

export const DOC_CONDITIONS = [
  { id: 'missing_soft',  label: 'Missing Soft Copy', test: doc => Boolean(doc) && !doc.is_not_applicable && !doc.gdrive_link },
  { id: 'missing_hard',  label: 'Missing Hard Copy', test: doc => Boolean(doc) && !doc.is_not_applicable && !doc.has_hard_copy },
  { id: 'not_submitted', label: 'Not Submitted',     test: doc => Boolean(doc) && !doc.is_not_applicable && !doc.submitted },
  { id: 'submitted',     label: 'Submitted',         test: doc => Boolean(doc) && doc.submitted },
  { id: 'overdue',       label: 'Overdue',           test: doc => isOverdue(doc) },
  { id: 'na',            label: 'N/A',               test: doc => !doc || doc.is_not_applicable },
]