import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT = "You don't have permission to make changes."

// Entry points live as free text on project_instances.entry_point (no lookup
// table), so "managing" them = bulk-updating that column. Each entry carries
// `count` = how many projects use it. Mutations never throw — they return { error }.
export function useEntryPoints() {
  const { canEdit } = useAuth()
  const [entries, setEntries] = useState([]) // [{ value, count }]
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_instances')
      .select('entry_point')
      .not('entry_point', 'is', null)
    if (error) setError(error.message)
    else {
      const counts = {}
      ;(data ?? []).forEach(r => { if (r.entry_point) counts[r.entry_point] = (counts[r.entry_point] ?? 0) + 1 })
      setEntries(
        Object.entries(counts)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }))
      )
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Renames the value on EVERY project that uses it. If the new name already
  // exists, those projects simply merge into it.
  async function renameEntryPoint(oldValue, newValue) {
    if (!canEdit) return { error: NO_EDIT }
    const trimmed = (newValue ?? '').trim()
    if (!trimmed) return { error: 'Name is required.' }
    if (trimmed === oldValue) return { error: null }
    // .select('id') so a silent RLS rejection (0 rows) is detectable
    const { data, error } = await supabase
      .from('project_instances')
      .update({ entry_point: trimmed })
      .eq('entry_point', oldValue)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchEntries()
    return { error: null }
  }

  // Clears the value from every project that uses it (projects are kept).
  async function removeEntryPoint(value) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase
      .from('project_instances')
      .update({ entry_point: null })
      .eq('entry_point', value)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchEntries()
    return { error: null }
  }

  return { entries, loading, error, refetch: fetchEntries, renameEntryPoint, removeEntryPoint }
}