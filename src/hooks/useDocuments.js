import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { expectedDateFor } from '../lib/documentDeadlines'

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
  async function generateDocuments(project) {
    const projectCategory = project.project_category
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
        expected_date:       expectedDateFor(project, t),
      }))

    if (newDocs.length === 0) return { error: null, added: 0 }

    const { error: insertError } = await supabase
      .from('documents')
      .insert(newDocs)

    if (insertError) return { error: insertError.message, added: 0 }

    await fetchDocuments()
    return { error: null, added: newDocs.length }
  }

  // Fills expected_date ONLY where it is blank (never overwrites a manual
  // date), using the project's deployment / end dates. Returns { error, updated }.
  async function fillDueDates(project) {
    const targets = documents
      .filter(d => !d.expected_date && !d.is_not_applicable && d.document_types)
      .map(d => ({ id: d.id, date: expectedDateFor(project, d.document_types) }))
      .filter(t => t.date)

    if (targets.length === 0) return { error: null, updated: 0 }

    const results = await Promise.all(
      targets.map(t => supabase.from('documents').update({ expected_date: t.date }).eq('id', t.id))
    )
    await fetchDocuments()
    const failed = results.find(r => r.error)
    if (failed) return { error: failed.error.message, updated: 0 }
    return { error: null, updated: targets.length }
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
    fillDueDates,
    updateDocument,
    refetch: fetchDocuments,
  }
}