import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT  = "You don't have permission to make changes."
const NO_ADMIN = 'Only an admin can delete this.'

// Full CRUD on the unified organizations table (beneficiaries). An
// organization can be a beneficiary on some projects and the implementing /
// cooperating agency on others. We pull counts for all three roles so the UI
// can block deletion while it's still referenced (both project_instances and
// project_agencies FKs are NO ACTION).
export function useBeneficiaries() {
  const { canEdit, isAdmin } = useAuth()
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    fetchBeneficiaries()
  }, [])

  async function fetchBeneficiaries() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('beneficiaries')
        .select(`
          *,
          project_instances (count),
          project_agencies (role)
        `)
        .order('name')

      if (error) setError(error.message)
      else setBeneficiaries(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function addBeneficiary(data) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase.from('beneficiaries').insert(data)
    if (error) return { error: error.message }
    await fetchBeneficiaries()
    return { error: null }
  }

  async function updateBeneficiary(id, updates) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase.from('beneficiaries').update(updates).eq('id', id)
    if (error) return { error: error.message }
    await fetchBeneficiaries()
    return { error: null }
  }

  async function deleteBeneficiary(id) {
    if (!isAdmin) return { error: NO_ADMIN }
    const { error } = await supabase.from('beneficiaries').delete().eq('id', id)
    if (error) return { error: error.message }
    await fetchBeneficiaries()
    return { error: null }
  }

  return {
    beneficiaries,
    loading,
    error,
    refetch: fetchBeneficiaries,
    addBeneficiary,
    updateBeneficiary,
    deleteBeneficiary,
  }
}

// Supabase returns embedded counts as project_instances: [{ count: N }]
export function projectCount(b) {
  return b.project_instances?.[0]?.count ?? 0
}
export function implementingCount(b) {
  return (b.project_agencies ?? []).filter(l => l.role === 'implementing').length
}
export function cooperatingCount(b) {
  return (b.project_agencies ?? []).filter(l => l.role === 'cooperating').length
}
// Everything that blocks deleting this organization.
export function usageCount(b) {
  return projectCount(b) + (b.project_agencies?.length ?? 0)
}