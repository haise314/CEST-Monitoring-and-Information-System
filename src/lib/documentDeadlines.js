import { addMonths } from './dates'

// DOST reporting deadlines.
//
// Project timeline: a semester report is due when the semester ends, plus a
// 2-month grace period. Counted from the project START date (falls back to the
// deployment date when no start date is set).
//   Jan 1 start -> semester 1 ends Jul 1 -> due Sep 1.
//
// Liquidation: due 1 month after the PLANNED end date, whether or not the
// project actually finished. Documents such as Form 15 / Form 17 are then
// submitted as progress-to-date.
//
// Rules match a document type by PHASE + exact NAME (case-insensitive), because
// some names (e.g. Form 10) exist in more than one phase. Keep the names in
// sync with the document_types table. Documents with no rule get no auto date.
const GRACE = 2
const LIQUIDATION_MONTHS = 1

const SEMESTER_RULES = [
  // Semester 1
  { phase: 'Semi-Annual', name: '1st Progress Report',                                      anchor: 'start', months: 6 + GRACE },
  { phase: 'Semi-Annual', name: 'Form 10 - Executive Summary of Technical Progress Report', anchor: 'start', months: 6 + GRACE },
  { phase: 'Semi-Annual', name: 'Form 11 - Financial Report',                               anchor: 'start', months: 6 + GRACE },
  // Semester 2
  { phase: 'Annual',      name: '2nd Progress Report',                                      anchor: 'start', months: 12 + GRACE },
  { phase: 'Annual',      name: 'Form 10 - Executive Summary of Technical Progress Report', anchor: 'start', months: 12 + GRACE },
  { phase: 'Annual',      name: 'Form 11 - Financial Report',                               anchor: 'start', months: 12 + GRACE },
]

// Not part of the liquidation packet: due 2 months after the end date.
const END_RULES = [
  { phase: 'Transfer', name: 'Completion Report', anchor: 'end', months: 2 },
]

// The liquidation packet: [phase, document name].
const LIQUIDATION_DOCS = [
  ['Liquidation', 'Form 8 - List of Personnel Involved'],
  ['Liquidation', 'Form 9 - List of Equipment Purchased'],
  ['Liquidation', 'Form 12 - Fund Utilization Report'],
  ['Liquidation', 'Form 13 - Schedule of Accounts Payable'],
  ['Liquidation', 'Form 6 - Line-Item Budget'],
  ['Liquidation', 'Form 15 - Project Monitoring and Field Evaluation Report'],
  ['Liquidation', 'Form 17 - Executive Summary for the Terminal Accomplishment Report'],
  ['Liquidation', 'Form 18 - Terminal Financial Report'],
  ['Liquidation', 'Reports of Checks Issued (RCI)'],
  ['Liquidation', 'Report of Cash Disbursements (RCD)'],
  ['Liquidation', 'JEV (Journal Entry Voucher)'],
  ['Liquidation', 'PAR (Property Acknowledgement Receipt)'],
  ['Liquidation', 'List of Equipment Purchased (LEP)'],
  // Conditional (equipment purchased / unexpended balance): optional, start as N/A
  ['Liquidation', 'ICS (Inventory Custodian Slip)'],
  ['Liquidation', 'Insurance of Equipment'],
  ['Liquidation', 'Warranty of Equipment'],
  ['Liquidation', 'Refund Check (Unexpended Balance)'],
]

export const DEADLINE_RULES = [
  ...SEMESTER_RULES,
  ...END_RULES,
  ...LIQUIDATION_DOCS.map(([phase, name]) => ({ phase, name, anchor: 'end', months: LIQUIDATION_MONTHS })),
]

const ANCHORS = {
  start:    p => p.start_date || p.date_deployed,
  deployed: p => p.date_deployed,
  end:      p => p.end_date,
}

const keyOf = (phase, name) => `${phase ?? ''}|${(name ?? '').trim().toLowerCase()}`
const RULES_BY_KEY = new Map(DEADLINE_RULES.map(r => [keyOf(r.phase, r.name), r]))

export function deadlineRuleFor(docType) {
  return RULES_BY_KEY.get(keyOf(docType?.phase, docType?.name)) ?? null
}

// project: a project_instances row. docType: a document_types row ({ name, phase }).
// Returns 'YYYY-MM-DD', or null when the doc has no rule or the anchor date is missing.
export function expectedDateFor(project, docType) {
  const rule = deadlineRuleFor(docType)
  if (!rule || !project) return null
  const anchor = ANCHORS[rule.anchor]?.(project)
  return anchor ? addMonths(anchor, rule.months) : null
}