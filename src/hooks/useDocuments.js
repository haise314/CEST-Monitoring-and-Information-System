import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { expectedDateFor } from '../lib/documentDeadlines'

export function useDocuments(projectId) {
  const { canEdit } = useAuth()
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
      .map(t => {
        const date = expectedDateFor(project, t)
        return {
          project_id:          projectId,
          document_type_id:    t.id,
          submitted:           false,
          has_hard_copy:       false,
          hard_copy_claimable: false,
          // Optional docs (Monitoring Form, equipment/refund items) default to
          // N/A — user enables them when they apply
          is_not_applicable:   !t.is_required,
          expected_date:       date,
          expected_date_auto:  date ? true : null,
        }
      })

    if (newDocs.length === 0) return { error: null, added: 0 }

    const { error: insertError } = await supabase
      .from('documents')
      .insert(newDocs)

    if (insertError) return { error: insertError.message, added: 0 }

    await fetchDocuments()
    return { error: null, added: newDocs.length }
  }

  // Keeps rule-based due dates in step with the project's dates. Touches only:
  //   - dates the app set earlier (expected_date_auto = true), and
  //   - blank dates (legacy rows; with { force } also ones cleared by hand).
  // Dates someone typed in (expected_date_auto = false) are never changed.
  // Updates local state directly, so the checklist doesn't flash a loading screen.
  // Returns { error, updated }.
  async function fillDueDates(project, { force = false } = {}) {
    if (!canEdit) return { error: null, updated: 0 }

    const targets = documents
      .filter(d =>
        !d.is_not_applicable && d.document_types &&
        (d.expected_date_auto === true ||
          (!d.expected_date && (force || d.expected_date_auto == null)))
      )
      .map(d => ({ id: d.id, date: expectedDateFor(project, d.document_types), current: d.expected_date }))
      .filter(t => t.date && t.date !== t.current)

    if (targets.length === 0) return { error: null, updated: 0 }

    // .select('id') so a silent RLS rejection (0 rows) is detectable
    const results = await Promise.all(
      targets.map(t =>
        supabase.from('documents')
          .update({ expected_date: t.date, expected_date_auto: true })
          .eq('id', t.id)
          .select('id')
      )
    )

    const done = new Map()
    results.forEach((r, i) => { if (!r.error && r.data?.length) done.set(targets[i].id, targets[i].date) })
    if (done.size > 0) {
      setDocuments(prev => prev.map(d =>
        done.has(d.id) ? { ...d, expected_date: done.get(d.id), expected_date_auto: true } : d
      ))
    }

    const failed = results.find(r => r.error)
    if (failed) return { error: failed.error.message, updated: done.size }
    return { error: null, updated: done.size }
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