import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Full CRUD on the beneficiaries table. Pulls a count of linked
// project_instances per beneficiary so the UI can block deletion of
// any beneficiary that still has projects — beneficiary_id on
// project_instances is a NO ACTION foreign key (not CASCADE like
// beneficiary_contacts), so an unguarded delete would just throw a
// raw Postgres FK-violation error.
export function useBeneficiaries() {
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
          project_instances (count)
        `)
        .order('name')

      if (error) setError(error.message)
      else setBeneficiaries(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function addBeneficiary(data) {
    const { error } = await supabase
      .from('beneficiaries')
      .insert(data)
    if (error) return { error: error.message }
    await fetchBeneficiaries()
    return { error: null }
  }

  async function updateBeneficiary(id, updates) {
    const { error } = await supabase
      .from('beneficiaries')
      .update(updates)
      .eq('id', id)
    if (error) return { error: error.message }
    await fetchBeneficiaries()
    return { error: null }
  }

  async function deleteBeneficiary(id) {
    const { error } = await supabase
      .from('beneficiaries')
      .delete()
      .eq('id', id)
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
export function projectCount(beneficiary) {
  return beneficiary.project_instances?.[0]?.count ?? 0
}