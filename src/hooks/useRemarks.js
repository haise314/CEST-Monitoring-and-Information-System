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

      if (error) setError(error.message)
      else setRemarks(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function addRemark({ level, content, added_by }) {
    const { error } = await supabase
      .from('remarks')
      .insert({ project_id: projectId, level, content, added_by })

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