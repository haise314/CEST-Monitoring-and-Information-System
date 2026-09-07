// Pure filtering logic, factored out so it can be shared between the Map
// page and the Itinerary page without them drifting on what a filter means.
//
// NOTE: this mirrors the predicate currently inlined in Map.jsx's
// `filteredBeneficiaries` useMemo. I have NOT edited Map.jsx to import this
// — that page already works, and swapping its logic for an import is a
// zero-behavior-change, non-urgent cleanup you can do later if you want
// (replace the inline filter body in Map.jsx's useMemo with
// `filterBeneficiaries(merged, filters, docFilter)` from this file). Left
// untouched for now per the project's "don't touch working things without
// discussing it" pattern.
import { DOC_CONDITIONS } from './documentStatus'

export const FILTERABLE_IDS = ['municipality', 'barangay', 'project_category', 'overall_status']

export function emptyBeneficiaryFilters() {
  return Object.fromEntries(FILTERABLE_IDS.map(id => [id, '']))
}

export function emptyDocFilter() {
  return { documentTypeId: '', conditionId: '' }
}

// `beneficiaries` must already be merged with .projects and .documents
// (see useMergedBeneficiaries.js / Map.jsx's `merged` useMemo for the shape).
export function filterBeneficiaries(beneficiaries, filters, docFilter) {
  const condition = docFilter.conditionId
    ? DOC_CONDITIONS.find(c => c.id === docFilter.conditionId)
    : null

  return beneficiaries.filter(b => {
    if (filters.municipality && b.municipality !== filters.municipality) return false
    if (filters.barangay && b.barangay !== filters.barangay) return false
    if (filters.project_category && !b.projects.some(p => p.project_category === filters.project_category)) return false
    if (filters.overall_status && !b.projects.some(p => p.overall_status === filters.overall_status)) return false

    if (docFilter.documentTypeId && condition) {
      const matchingDocs = b.documents.filter(d => String(d.document_type_id) === String(docFilter.documentTypeId))
      const matches = matchingDocs.length === 0
        ? condition.test(undefined)
        : matchingDocs.some(d => condition.test(d))
      if (!matches) return false
    }

    return true
  })
}