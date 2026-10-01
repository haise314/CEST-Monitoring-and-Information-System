import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Remarks are otherwise append-only — no edit. A short post-only delete
// window (see DELETE_WINDOW_MINUTES in RemarksSection.jsx) covers typos
// and mis-clicks; anything beyond that is handled by posting a new
// correction remark, not by rewriting history.
export function useRemarks(projectId) {
  const [remarks, setRemarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!projectId) return
    fetchRemarks()
  }, [projectId])

  async function fetchRemarks() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('remarks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
        return
      }

      const rows = data ?? []

      // Resolve each remark's poster name from profiles.full_name via
      // created_by (set automatically by the column default, auth.uid()),
      // falling back to the old free-text added_by for remarks posted
      // before real accounts existed. This is a separate query rather than
      // a PostgREST embed (`select('*, profiles(full_name)')`) since
      // remarks.created_by -> profiles isn't a declared foreign key.
      const ids = [...new Set(rows.map(r => r.created_by).filter(Boolean))]
      let namesById = {}
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids)
        namesById = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]))
      }

      setRemarks(rows.map(r => ({
        ...r,
        author_name: (r.created_by && namesById[r.created_by]) || r.added_by || 'Unknown',
      })))
    } finally {
      setLoading(false)
    }
  }

  // level/content only — no added_by. created_by fills itself in via the
  // remarks.created_by column default (auth.uid()), so the poster is
  // whoever is actually signed in, not a typed name.
  async function addRemark({ level, content }) {
    const { error } = await supabase
      .from('remarks')
      .insert({ project_id: projectId, level, content })

    if (error) return { error: error.message }
    await fetchRemarks()
    return { error: null }
  }

  async function deleteRemark(id) {
    const { error } = await supabase
      .from('remarks')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }
    setRemarks(prev => prev.filter(r => r.id !== id))
    return { error: null }
  }

  return {
    remarks,
    loading,
    error,
    addRemark,
    deleteRemark,
    refetch: fetchRemarks,
  }
}