import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT  = "You don't have permission to make changes."
const NO_ADMIN = 'Only an admin can delete this.'

export function useProjects() {
  const { canEdit, isAdmin } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('project_instances')
        .select(`
          *,
          project_types (id, name),
          beneficiaries (id, name, category, district, municipality, barangay),
          project_agencies (role, agencies (id, name))
        `)
        .order('year', { ascending: false })

      if (error) setError(error.message)
      else setProjects(data)
    } finally {
      setLoading(false)
    }
  }

  // Resolves { error, id } — id is the new project's id, so the Add Project
  // modal can offer "Add & open full page".
  async function addProject(data) {
    if (!canEdit) return { error: NO_EDIT, id: null }
    const { data: row, error } = await supabase
      .from('project_instances')
      .insert(data)
      .select('id')
      .single()
    if (error) return { error: error.message, id: null }
    await fetchProjects()
    return { error: null, id: row.id }
  }

  async function updateProject(id, updates) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase
      .from('project_instances')
      .update(updates)
      .eq('id', id)
    if (error) return { error: error.message }
    await fetchProjects()
    return { error: null }
  }

  // Moves one project to another beneficiary (atomic, via
  // reassign_project_beneficiary in migrations/04). Also re-points the
  // project's itinerary stops; optionally unlinks contacts that don't belong
  // to the new beneficiary (links only, contacts are kept).
  async function reassignBeneficiary(id, beneficiaryId, unlinkContacts = true) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase.rpc('reassign_project_beneficiary', {
      p_project_id:      id,
      p_beneficiary_id:  beneficiaryId,
      p_unlink_contacts: unlinkContacts,
    })
    if (error) return { error: error.message }
    await fetchProjects()
    return { error: null }
  }

  async function deleteProject(id) {
    if (!isAdmin) return { error: NO_ADMIN }
    const { error } = await supabase
      .from('project_instances')
      .delete()
      .eq('id', id)
    if (error) return { error: error.message }
    await fetchProjects()
    return { error: null }
  }

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
    addProject,
    updateProject,
    reassignBeneficiary,
    deleteProject,
  }
}