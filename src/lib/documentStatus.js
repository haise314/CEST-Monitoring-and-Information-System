// ─── Status rank ────────────────────────────────────────────────────────────
// The office's own completeness ranking, highest first:
// submitted > hard copy > soft copy (FINAL gdrive link) > hard copy claimable
// > link still in signing / checking / draft > nothing. N/A sits outside the scale.

export const RANK_ORDER = ['na', 'none', 'draft', 'checking', 'signing', 'claimable', 'soft', 'hard', 'submitted']

export const STATUS_META = {
  na:        { label: 'N/A',                        dotClass: 'bg-gray-300' },
  none:      { label: 'Nothing on file',             dotClass: 'bg-red-400' },
  draft:     { label: 'Draft (link only)',           dotClass: 'bg-gray-400' },
  checking:  { label: 'For checking',                dotClass: 'bg-orange-400' },
  signing:   { label: 'For signing',                 dotClass: 'bg-purple-400' },
  claimable: { label: 'Claimable (at beneficiary)',  dotClass: 'bg-amber-400' },
  soft:      { label: 'Soft copy on file',           dotClass: 'bg-blue-400' },
  hard:      { label: 'Hard copy on file',           dotClass: 'bg-indigo-500' },
  submitted: { label: 'Submitted',                   dotClass: 'bg-green-500' },
}

// Stages of the soft-copy link. A link only counts as a soft copy when 'final'.
export const LINK_STAGES = [
  { id: 'draft',    label: 'Draft' },
  { id: 'checking', label: 'For checking' },
  { id: 'signing',  label: 'For signing' },
  { id: 'final',    label: 'Final' },
]

// A missing stage means 'final' (rows from before the column existed).
export const linkStage = doc => (doc?.gdrive_link ? (doc.link_stage ?? 'final') : null)
export const hasFinalSoftCopy = doc => Boolean(doc?.gdrive_link) && linkStage(doc) === 'final'

// doc: a document row, or undefined/null if this project's category never
// generated this document type at all (treated the same as N/A).
export function getDocStatus(doc) {
  if (!doc || doc.is_not_applicable) return 'na'
  if (doc.submitted) return 'submitted'
  if (doc.has_hard_copy) return 'hard'
  if (hasFinalSoftCopy(doc)) return 'soft'
  if (doc.hard_copy_claimable) return 'claimable'
  if (doc.gdrive_link) return linkStage(doc) // draft | checking | signing
  return 'none'
}

export function statusRank(doc) {
  return RANK_ORDER.indexOf(getDocStatus(doc))
}

// A document is no longer actionable (not overdue, not upcoming) if it is
// submitted, has a hard copy, has a FINAL soft copy, or is claimable.
// A link that is still a draft / for checking / for signing does NOT count.
export function isAccomplished(doc) {
  return Boolean(
    doc.submitted ||
    doc.has_hard_copy ||
    hasFinalSoftCopy(doc) ||
    doc.hard_copy_claimable
  )
}

export function isOverdue(doc) {
  if (!doc || doc.is_not_applicable || !doc.expected_date) return false
  if (isAccomplished(doc)) return false
  const today = new Date(new Date().toDateString())
  return new Date(doc.expected_date) < today
}

export const UPCOMING_WINDOW_DAYS = 14

// Due within `days` from today, not yet overdue, and not already complete.
export function isUpcoming(doc, days = UPCOMING_WINDOW_DAYS) {
  if (!doc || doc.is_not_applicable || !doc.expected_date) return false
  if (isAccomplished(doc)) return false
  if (isOverdue(doc)) return false
  const today = new Date(new Date().toDateString())
  const expected = new Date(doc.expected_date)
  const diffDays = (expected - today) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= days
}

// ─── Filter conditions ────────────────────────────────────────────────────────
// Independent of the rank above. "Missing soft copy" = no FINAL soft copy.
// All conditions except 'na' require the document to exist for this project.

const applicable = doc => Boolean(doc) && !doc.is_not_applicable

export const DOC_CONDITIONS = [
  { id: 'missing_soft',  label: 'Missing Soft Copy (final)', test: doc => applicable(doc) && !hasFinalSoftCopy(doc) },
  { id: 'draft',         label: 'Draft link',                test: doc => applicable(doc) && linkStage(doc) === 'draft' },
  { id: 'for_checking',  label: 'For checking',              test: doc => applicable(doc) && linkStage(doc) === 'checking' },
  { id: 'for_signing',   label: 'For signing',               test: doc => applicable(doc) && linkStage(doc) === 'signing' },
  { id: 'missing_hard',  label: 'Missing Hard Copy',         test: doc => applicable(doc) && !doc.has_hard_copy },
  { id: 'not_submitted', label: 'Not Submitted',             test: doc => applicable(doc) && !doc.submitted },
  { id: 'submitted',     label: 'Submitted',                 test: doc => Boolean(doc) && doc.submitted },
  { id: 'overdue',       label: 'Overdue',                   test: doc => isOverdue(doc) },
  { id: 'upcoming',      label: `Upcoming (next ${UPCOMING_WINDOW_DAYS} days)`, test: doc => isUpcoming(doc) },
  { id: 'na',            label: 'N/A',                       test: doc => !doc || doc.is_not_applicable },
]