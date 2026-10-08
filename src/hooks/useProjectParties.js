import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT = "You don't have permission to make changes."

function friendly(error) {
  if (error.code === '23505') return 'That is already linked to this project.'
  return error.message
}

// The agencies (implementing + cooperating) and ADDITIONAL beneficiaries of
// one project. The primary beneficiary lives on project_instances.
// agencyLinks: [{ linkId, role, agency: { id, name, type } }]
// extraBeneficiaries: [{ linkId, ...beneficiary }]
export function useProjectParties(projectId) {
  const { canEdit } = useAuth()
  const [agencyLinks, setAgencyLinks]               = useState([])
  const [extraBeneficiaries, setExtraBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchAll = useCallback(async (silent = false) => {
    if (!projectId) return
    if (!silent) setLoading(true)
    const [aRes, bRes] = await Promise.all([
      supabase.from('project_agencies')
        .select('id, role, agencies (id, name, type)')
        .eq('project_id', projectId).order('id'),
      supabase.from('project_beneficiaries')
        .select('id, beneficiaries (id, name, municipality, barangay)')
        .eq('project_id', projectId).order('id'),
    ])
    const err = aRes.error || bRes.error
    if (err) setError(err.message)
    else {
      setAgencyLinks((aRes.data ?? []).filter(r => r.agencies)
        .map(r => ({ linkId: r.id, role: r.role, agency: r.agencies })))
      setExtraBeneficiaries((bRes.data ?? []).filter(r => r.beneficiaries)
        .map(r => ({ linkId: r.id, ...r.beneficiaries })))
      setError(null)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // .select('id') so a silent RLS rejection (0 rows) is detectable
  async function run(query) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await query
    if (error) return { error: friendly(error) }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchAll(true)
    return { error: null }
  }

  // agencyId = null clears the Implementing Agency. At most one per project (DB-enforced).
  async function setImplementing(agencyId) {
    const existing = agencyLinks.find(l => l.role === 'implementing')
    if (agencyId == null) {
      if (!existing) return { error: null }
      return run(supabase.from('project_agencies').delete().eq('id', existing.linkId).select('id'))
    }
    if (existing) {
      return run(supabase.from('project_agencies').update({ agency_id: agencyId }).eq('id', existing.linkId).select('id'))
    }
    return run(supabase.from('project_agencies')
      .insert({ project_id: projectId, agency_id: agencyId, role: 'implementing' }).select('id'))
  }

  const addCooperating = agencyId =>
    run(supabase.from('project_agencies')
      .insert({ project_id: projectId, agency_id: agencyId, role: 'cooperating' }).select('id'))

  const removeAgencyLink = linkId =>
    run(supabase.from('project_agencies').delete().eq('id', linkId).select('id'))

  const addBeneficiary = beneficiaryId =>
    run(supabase.from('project_beneficiaries')
      .insert({ project_id: projectId, beneficiary_id: beneficiaryId }).select('id'))

  const removeBeneficiary = linkId =>
    run(supabase.from('project_beneficiaries').delete().eq('id', linkId).select('id'))

  return {
    agencyLinks, extraBeneficiaries, loading, error,
    refetch: () => fetchAll(true),
    setImplementing, addCooperating, removeAgencyLink, addBeneficiary, removeBeneficiary,
  }
}