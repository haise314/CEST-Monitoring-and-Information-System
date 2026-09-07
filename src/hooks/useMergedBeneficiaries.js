import { useMemo } from 'react'
import { useBeneficiaryLocations } from './useBeneficiaryLocations'
import { useProjects } from './useProjects'
import { useAllDocuments } from './useAllDocuments'
import { PHASE_ORDER } from '../lib/documentProgress'

// Same merge logic as Map.jsx's `merged` useMemo, factored out so the
// Itinerary page doesn't need to duplicate it. Map.jsx has NOT been changed
// to use this — it works today and this is a non-urgent, zero-behavior-
// change swap you can make later if you want one source of truth (replace
// Map.jsx's own locations/projects/documents/merged/documentTypesByPhase
// block with a single `useMergedBeneficiaries()` call).
export function useMergedBeneficiaries() {
  const { beneficiaries: locations, loading: locLoading, error: locError, setLocation, clearLocation } = useBeneficiaryLocations()
  const { projects, loading: projLoading } = useProjects()
  const { documents, loading: docLoading } = useAllDocuments()

  const loading = locLoading || projLoading || docLoading

  const merged = useMemo(() => {
    const projectsByBeneficiary = {}
    const beneficiaryIdByProjectId = {}
    for (const p of projects) {
      const bId = p.beneficiary_id
      if (!projectsByBeneficiary[bId]) projectsByBeneficiary[bId] = []
      projectsByBeneficiary[bId].push(p)
      beneficiaryIdByProjectId[p.id] = bId
    }

    const documentsByBeneficiary = {}
    for (const d of documents) {
      const projectId = d.project_instances?.id
      const bId = beneficiaryIdByProjectId[projectId]
      if (bId == null) continue
      if (!documentsByBeneficiary[bId]) documentsByBeneficiary[bId] = []
      documentsByBeneficiary[bId].push(d)
    }

    return locations.map(b => ({
      ...b,
      projects: projectsByBeneficiary[b.id] ?? [],
      documents: documentsByBeneficiary[b.id] ?? [],
    }))
  }, [locations, projects, documents])

  const documentTypesByPhase = useMemo(() => {
    const map = {}
    const seen = new Set()
    for (const d of documents) {
      const t = d.document_types
      if (!t || !t.phase || seen.has(t.id)) continue
      seen.add(t.id)
      if (!map[t.phase]) map[t.phase] = []
      map[t.phase].push(t)
    }
    Object.values(map).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)))
    const ordered = {}
    for (const phase of PHASE_ORDER) {
      if (map[phase]) ordered[phase] = map[phase]
    }
    return ordered
  }, [documents])

  return { merged, documentTypesByPhase, loading, setLocation, clearLocation }
}