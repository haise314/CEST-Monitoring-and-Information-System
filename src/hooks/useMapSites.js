import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useProjects } from './useProjects'
import { useAllDocuments } from './useAllDocuments'
import { PHASE_ORDER } from '../lib/documentProgress'

const NO_EDIT = "You don't have permission to make changes."

// A "site" is one PROJECT with its beneficiary's details flattened on top.
// Pins live on projects (project_instances.latitude/longitude) because one
// beneficiary's projects are not necessarily at the same place.
//
// The shape deliberately mirrors the old merged-beneficiary object
// (name, category, municipality, barangay, projects[], documents[]), with
// `projects` always holding exactly this one project, so mapFilterFields.jsx
// and pinIcons.js work unchanged. site.id is the PROJECT id.

export function siteLabel(site) {
  const p = site.projects[0]
  return p.title || [p.project_types?.name, p.year].filter(Boolean).join(' · ') || 'Untitled project'
}

export function useMapSites() {
  const { canEdit } = useAuth()
  const { projects, loading: projLoading, error } = useProjects()
  const { documents, loading: docLoading } = useAllDocuments()

  // Optimistic pin changes, layered over the fetched projects. Avoids
  // refetching useProjects (which would flash the whole map to "Loading").
  const [overrides, setOverrides] = useState({}) // { [projectId]: { latitude, longitude } }

  const sites = useMemo(() => {
    const docsByProject = {}
    for (const d of documents) {
      if (!docsByProject[d.project_id]) docsByProject[d.project_id] = []
      docsByProject[d.project_id].push(d)
    }

    return projects.map(p => {
      const o = overrides[p.id]
      const b = p.beneficiaries ?? {}
      return {
        id: p.id,
        beneficiary_id: p.beneficiary_id,
        name: b.name ?? '—',
        category: b.category,
        district: b.district,
        municipality: b.municipality,
        barangay: b.barangay,
        latitude:  o ? o.latitude  : p.latitude  ?? null,
        longitude: o ? o.longitude : p.longitude ?? null,
        projects: [p],
        documents: docsByProject[p.id] ?? [],
      }
    })
  }, [projects, documents, overrides])

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
    for (const phase of PHASE_ORDER) if (map[phase]) ordered[phase] = map[phase]
    return ordered
  }, [documents])

  async function setLocation(projectId, latitude, longitude) {
    if (!canEdit) return { error: NO_EDIT }
    const lat = latitude == null ? null : Number(latitude.toFixed(6))
    const lng = longitude == null ? null : Number(longitude.toFixed(6))
    // .select('id') so a silent RLS rejection (0 rows) is detectable
    const { data, error } = await supabase
      .from('project_instances')
      .update({ latitude: lat, longitude: lng })
      .eq('id', projectId)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    setOverrides(prev => ({ ...prev, [projectId]: { latitude: lat, longitude: lng } }))
    return { error: null }
  }

  const clearLocation = projectId => setLocation(projectId, null, null)

  return {
    sites,
    documentTypesByPhase,
    loading: projLoading || docLoading,
    error,
    setLocation,
    clearLocation,
  }
}