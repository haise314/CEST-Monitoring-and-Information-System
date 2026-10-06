import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Supabase/PostgREST caps a single response (default 1000 rows), and the
// documents table (projects x checklist size) outgrows that first. Fetch in
// ranged pages until every row is in. The first request also asks for the
// exact total, so we know when to stop without an extra empty request, and
// it still works if the project's max-rows setting is lower than PAGE_SIZE.
const PAGE_SIZE = 1000

const SELECT = `
  *,
  document_types (id, name, phase, applies_to, is_required),
  project_instances (
    id, year, project_category, overall_status, gdrive_folder_link,
    project_types (name),
    beneficiaries (name, category, municipality, barangay, district)
  )
`

export function useAllDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    setLoading(true)
    try {
      const rows = []
      let total = null

      while (total === null || rows.length < total) {
        const from = rows.length
        const { data, error, count } = await supabase
          .from('documents')
          .select(SELECT, total === null ? { count: 'exact' } : undefined)
          .order('id') // stable order is required for ranged paging
          .range(from, from + PAGE_SIZE - 1)

        if (error) { setError(error.message); return }
        if (total === null) total = count ?? data.length
        if (!data || data.length === 0) break // safety: never loop forever
        rows.push(...data)
      }

      setDocuments(rows)
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  async function updateDocument(id, updates) {
    const { error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)

    if (error) return { error: error.message }

    // Optimistic update — preserve nested joins
    setDocuments(prev =>
      prev.map(d => d.id === id ? { ...d, ...updates } : d)
    )
    return { error: null }
  }

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    updateDocument,
  }
}