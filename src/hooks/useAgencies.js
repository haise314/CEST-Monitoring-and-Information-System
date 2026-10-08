import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT  = "You don't have permission to make changes."
const NO_ADMIN = 'Only an admin can delete this.'

function friendly(error) {
  if (error.code === '23505') return 'An agency with that name already exists.'
  if (error.code === '23503') return 'This agency is still used by projects.'
  return error.message
}

// Agency registry. Each row: { id, name, type, implementing, cooperating, usage }.
// Mutations never throw — they return { error } (and { data } for add).
export function useAgencies() {
  const { canEdit, isAdmin } = useAuth()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const fetchAgencies = useCallback(async () => {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name, type, project_agencies (role)')
      .order('name')
    if (error) setError(error.message)
    else {
      setAgencies((data ?? []).map(a => {
        const links = a.project_agencies ?? []
        return {
          id: a.id, name: a.name, type: a.type,
          implementing: links.filter(l => l.role === 'implementing').length,
          cooperating:  links.filter(l => l.role === 'cooperating').length,
          usage: links.length,
        }
      }))
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAgencies() }, [fetchAgencies])

  async function addAgency({ name, type }) {
    if (!canEdit) return { error: NO_EDIT, data: null }
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { error: 'Name is required.', data: null }
    const { data, error } = await supabase
      .from('agencies')
      .insert({ name: trimmed, type: (type ?? '').trim() || null })
      .select('id, name, type')
      .single()
    if (error) return { error: friendly(error), data: null }
    await fetchAgencies()
    return { error: null, data }
  }

  async function updateAgency(id, { name, type }) {
    if (!canEdit) return { error: NO_EDIT }
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { error: 'Name is required.' }
    const { data, error } = await supabase
      .from('agencies')
      .update({ name: trimmed, type: (type ?? '').trim() || null })
      .eq('id', id)
      .select('id')
    if (error) return { error: friendly(error) }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchAgencies()
    return { error: null }
  }

  async function deleteAgency(id) {
    if (!isAdmin) return { error: NO_ADMIN }
    const a = agencies.find(x => x.id === id)
    if (a && a.usage > 0) {
      return { error: `Used by ${a.usage} project${a.usage === 1 ? '' : 's'} — remove it from them first.` }
    }
    const { data, error } = await supabase.from('agencies').delete().eq('id', id).select('id')
    if (error) return { error: friendly(error) }
    if (!data || data.length === 0) return { error: NO_ADMIN }
    await fetchAgencies()
    return { error: null }
  }

  return { agencies, loading, error, refetch: fetchAgencies, addAgency, updateAgency, deleteAgency }
}