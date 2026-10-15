import { addMonths } from './dates'

// DOST reporting deadlines: "not later than 2 months after each semester,
// counted from the date of project deployment/delivery."
//
//   anchor 'deployed' -> project.date_deployed
//   anchor 'end'      -> project.end_date
//   months            -> months added to the anchor date
//
// Rules match a document type by PHASE + exact NAME (case-insensitive), because
// some names (e.g. Form 10) exist in more than one phase. Keep the names in
// sync with the document_types table. Documents with no rule get no auto date.
export const DEADLINE_RULES = [
  // Semester 1: deployment + 6 months, due 2 months later
  { phase: 'Semi-Annual', name: '1st Progress Report',                                      anchor: 'deployed', months: 6 + 2 },
  { phase: 'Semi-Annual', name: 'Form 10 - Executive Summary of Technical Progress Report', anchor: 'deployed', months: 6 + 2 },

  // Semester 2: deployment + 12 months, due 2 months later
  { phase: 'Annual',      name: '2nd Progress Report',                                      anchor: 'deployed', months: 12 + 2 },
  { phase: 'Annual',      name: 'Form 10 - Executive Summary of Technical Progress Report', anchor: 'deployed', months: 12 + 2 },

  // End of project: due 2 months after the project end date
  { phase: 'Transfer',    name: 'Completion Report',                                                 anchor: 'end', months: 2 },
  { phase: 'Transfer',    name: 'Form 15 - Project Monitoring and Field Evaluation Report',          anchor: 'end', months: 2 },
  { phase: 'Transfer',    name: 'Form 17 - Executive Summary for the Terminal Accomplishment Report', anchor: 'end', months: 2 },
]

const ANCHOR_FIELD = { deployed: 'date_deployed', end: 'end_date' }
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
  const anchor = project[ANCHOR_FIELD[rule.anchor]]
  return anchor ? addMonths(anchor, rule.months) : null
}