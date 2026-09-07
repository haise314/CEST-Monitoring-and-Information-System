import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Fetches every beneficiary with its coordinates (if pinned) and a count of
// its linked projects — enough for the Map page's pin list and popups
// without pulling full project/document detail (that comes from useProjects/
// useAllDocuments, fetched separately and merged in Map.jsx by beneficiary_id
// so this hook stays independent of whatever those select).
export function useBeneficiaryLocations() {
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
          id, name, category, district, municipality, barangay,
          latitude, longitude,
          project_instances (count)
        `)
        .order('name')

      if (error) setError(error.message)
      else setBeneficiaries(
        (data ?? []).map(b => ({
          ...b,
          projectCount: b.project_instances?.[0]?.count ?? 0,
        }))
      )
    } finally {
      setLoading(false)
    }
  }

  // Sets or updates a beneficiary's pin. Optimistic — reflects immediately,
  // since map interactions (click to place) feel wrong with a fetch delay.
  async function setLocation(beneficiaryId, latitude, longitude) {
    const { error } = await supabase
      .from('beneficiaries')
      .update({ latitude, longitude })
      .eq('id', beneficiaryId)

    if (error) return { error: error.message }

    setBeneficiaries(prev =>
      prev.map(b => b.id === beneficiaryId ? { ...b, latitude, longitude } : b)
    )
    return { error: null }
  }

  async function clearLocation(beneficiaryId) {
    return setLocation(beneficiaryId, null, null)
  }

  return {
    beneficiaries,
    loading,
    error,
    refetch: fetchBeneficiaries,
    setLocation,
    clearLocation,
  }
}