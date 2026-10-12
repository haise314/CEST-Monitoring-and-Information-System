import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT = "You don't have permission to make changes."

// "Agencies" are no longer a separate table: an agency is just a row of
// `beneficiaries` that plays the implementing/cooperating role on a project
// (project_agencies.agency_id -> beneficiaries.id). `type` here = beneficiaries.category.
export function useAgencies() {
  const { canEdit } = useAuth()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const fetchAgencies = useCallback(async () => {
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('id, name, category')
      .order('name')
    if (error) setError(error.message)
    else {
      setAgencies((data ?? []).map(b => ({ id: b.id, name: b.name, type: b.category })))
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAgencies() }, [fetchAgencies])

  async function addAgency({ name, type }) {
    if (!canEdit) return { error: NO_EDIT, data: null }
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { error: 'Name is required.', data: null }
    if (agencies.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      return { error: 'An organization with that name already exists. Pick it from the list instead.', data: null }
    }
    const { data, error } = await supabase
      .from('beneficiaries')
      .insert({ name: trimmed, category: (type ?? '').trim() || 'Others' })
      .select('id, name, category')
      .single()
    if (error) return { error: error.message, data: null }
    await fetchAgencies()
    return { error: null, data: { id: data.id, name: data.name, type: data.category } }
  }

  async function updateAgency(id, { name, type }) {
    if (!canEdit) return { error: NO_EDIT }
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { error: 'Name is required.' }
    const { data, error } = await supabase
      .from('beneficiaries')
      .update({ name: trimmed, category: (type ?? '').trim() || 'Others' })
      .eq('id', id)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchAgencies()
    return { error: null }
  }

  return { agencies, loading, error, refetch: fetchAgencies, addAgency, updateAgency }
}