import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Read-only global remarks for the Dashboard: the latest `limit` remarks
// (Recent Activity) plus every pinned remark (to-do list). Author names come
// from profiles via created_by, falling back to the legacy free-text added_by.
// Pinning goes through the set_remark_pinned() database function.
const SELECT = `
  *,
  project_instances (
    id, year, title,
    project_types (name),
    beneficiaries (name, municipality),
    project_agencies (role, agencies:beneficiaries!agency_id (id, name))
  )
`

export function useAllRemarks(limit = 10) {
  const [remarks, setRemarks]         = useState([])
  const [pinned, setPinnedList]       = useState([])
  const [pinnedError, setPinnedError] = useState(null) // e.g. migration not run yet
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  const fetchRemarks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [recentRes, pinnedRes] = await Promise.all([
        supabase.from('remarks').select(SELECT).order('created_at', { ascending: false }).limit(limit),
        supabase.from('remarks').select(SELECT).not('pinned_at', 'is', null).order('pinned_at', { ascending: false }),
      ])
      if (recentRes.error) { setError(recentRes.error.message); return }

      const recent = recentRes.data ?? []
      const pins   = pinnedRes.error ? [] : (pinnedRes.data ?? [])
      setPinnedError(pinnedRes.error ? pinnedRes.error.message : null)

      const ids = [...new Set([...recent, ...pins].map(r => r.created_by).filter(Boolean))]
      let names = {}
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
        names = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]))
      }
      const withAuthor = r => ({ ...r, author_name: (r.created_by && names[r.created_by]) || r.added_by || 'Unknown' })

      setRemarks(recent.map(withAuthor))
      setPinnedList(pins.map(withAuthor))
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => { fetchRemarks() }, [fetchRemarks])

  async function setPinned(id, value) {
    const { error } = await supabase.rpc('set_remark_pinned', { p_id: id, p_pinned: value })
    if (error) return { error: error.message }
    await fetchRemarks(true)
    return { error: null }
  }

  return { remarks, pinned, pinnedError, loading, error, refetch: () => fetchRemarks(true), setPinned }
}
