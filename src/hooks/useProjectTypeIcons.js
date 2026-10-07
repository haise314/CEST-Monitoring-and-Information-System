import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// project_types + their icon SVG. Kept separate from useProjects/useFormData so
// SVG text isn't shipped on every project row. Projects already carry
// project_type_id, so the Map joins by id. Writes are admin-only (RLS enforces).
export function useProjectTypeIcons() {
  const { isAdmin } = useAuth()
  const [types, setTypes]     = useState([]) // [{ id, name, icon_svg }]
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_types')
      .select('id, name, icon_svg')
      .order('name')
    if (error) setError(error.message)
    else { setTypes(data ?? []); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // svg = null removes the icon.
  async function saveIcon(id, svg) {
    if (!isAdmin) return { error: 'Only an admin can change icons.' }
    const { error } = await supabase.from('project_types').update({ icon_svg: svg }).eq('id', id)
    if (error) return { error: error.message }
    await refetch()
    return { error: null }
  }

  const iconsById = Object.fromEntries(types.filter(t => t.icon_svg).map(t => [t.id, t.icon_svg]))

  return { types, iconsById, loading, error, refetch, saveIcon }
}