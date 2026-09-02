import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDocuments(projectId) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!projectId) return
    fetchDocuments()
  }, [projectId])

  async function fetchDocuments() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_types (id, name, phase, applies_to, is_required)
        `)
        .eq('project_id', projectId)
        .order('id')

      if (error) setError(error.message)
      else setDocuments(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  // Generates document rows from document_types for the given category.
  // Add-only — never deletes existing documents.
  async function generateDocuments(projectCategory) {
    const { data: types, error: typesError } = await supabase
      .from('document_types')
      .select('*')
      .not('phase', 'is', null)
      .in('applies_to', ['Both', projectCategory])

    if (typesError) return { error: typesError.message, added: 0 }

    // Skip document types already present for this project
    const existingTypeIds = new Set(documents.map(d => d.document_type_id))

    const newDocs = types
      .filter(t => !existingTypeIds.has(t.id))
      .map(t => ({
        project_id:          projectId,
        document_type_id:    t.id,
        submitted:           false,
        has_hard_copy:       false,
        hard_copy_claimable: false,
        // Optional docs (Monitoring Form) default to N/A — user enables if needed
        is_not_applicable:   !t.is_required,
      }))

    if (newDocs.length === 0) return { error: null, added: 0 }

    const { error: insertError } = await supabase
      .from('documents')
      .insert(newDocs)

    if (insertError) return { error: insertError.message, added: 0 }

    await fetchDocuments()
    return { error: null, added: newDocs.length }
  }

  // Optimistic update — reflects immediately in UI, syncs to DB
  async function updateDocument(id, updates) {
    const { error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)

    if (error) return { error: error.message }

    setDocuments(prev =>
      prev.map(d => d.id === id ? { ...d, ...updates } : d)
    )
    return { error: null }
  }

  return {
    documents,
    loading,
    error,
    generateDocuments,
    updateDocument,
    refetch: fetchDocuments,
  }
}