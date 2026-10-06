import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT  = "You don't have permission to make changes."
const NO_ADMIN = 'Only an admin can do this.'

// project_types management (admin screen). Separate from useFormData, which
// only feeds dropdowns. Each row carries `usage` = how many projects use it,
// so the UI can block deletes. RLS: insert = editors, update/delete = admin.
// Mutations never throw — they return { error }.
function friendly(error) {
  if (error.code === '23505') return 'A project type with that name already exists.'
  if (error.code === '23503') return 'This project type is still used by projects.'
  return error.message
}

export function useProjectTypes() {
  const { canEdit, isAdmin } = useAuth()
  const [types, setTypes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_types')
      .select('id, name, project_instances (count)')
      .order('name')
    if (error) setError(error.message)
    else {
      setTypes((data ?? []).map(t => ({ id: t.id, name: t.name, usage: t.project_instances?.[0]?.count ?? 0 })))
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTypes() }, [fetchTypes])

  async function addType(name) {
    if (!canEdit) return { error: NO_EDIT }
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { error: 'Name is required.' }
    const { error } = await supabase.from('project_types').insert({ name: trimmed })
    if (error) return { error: friendly(error) }
    await fetchTypes()
    return { error: null }
  }

  async function renameType(id, name) {
    if (!isAdmin) return { error: NO_ADMIN }
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { error: 'Name is required.' }
    // .select() so a silent RLS rejection (0 rows) is detectable
    const { data, error } = await supabase
      .from('project_types').update({ name: trimmed }).eq('id', id).select('id')
    if (error) return { error: friendly(error) }
    if (!data || data.length === 0) return { error: NO_ADMIN }
    await fetchTypes()
    return { error: null }
  }

  async function deleteType(id) {
    if (!isAdmin) return { error: NO_ADMIN }
    const t = types.find(x => x.id === id)
    if (t && t.usage > 0) {
      return { error: `Used by ${t.usage} project${t.usage === 1 ? '' : 's'} — reassign them first.` }
    }
    const { data, error } = await supabase
      .from('project_types').delete().eq('id', id).select('id')
    if (error) return { error: friendly(error) }
    if (!data || data.length === 0) return { error: NO_ADMIN }
    await fetchTypes()
    return { error: null }
  }

  return { types, loading, error, refetch: fetchTypes, addType, renameType, deleteType }
}