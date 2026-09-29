import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Read-only, global version of useRemarks — powers the Dashboard's Recent
// Activity feed across every project at once. Mutations (add/delete) stay
// scoped to useRemarks.js/RemarksSection.jsx; this hook only reads, and
// only the most recent `limit` rows (a feed, not a full listing).
export function useAllRemarks(limit = 10) {
  const [remarks, setRemarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetchRemarks()
  }, [])

  async function fetchRemarks() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('remarks')
        .select(`
          *,
          project_instances (
            id, year, title,
            project_types (name),
            beneficiaries (name, municipality)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) setError(error.message)
      else setRemarks(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  return { remarks, loading, error, refetch: fetchRemarks }
}