import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_types (id, name, phase, applies_to, is_required),
          project_instances (
            id, year, project_category, overall_status, gdrive_folder_link,
            project_types (name),
            beneficiaries (name, category, municipality, barangay, district)
          )
        `)
        .order('id')

      if (error) setError(error.message)
      else setDocuments(data ?? [])
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