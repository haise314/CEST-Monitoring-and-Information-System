import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useProjects() {
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
          beneficiaries (id, name, category, district, municipality, barangay)
        `)
        .order('year', { ascending: false })

      if (error) setError(error.message)
      else setProjects(data)
    } finally {
      setLoading(false)
    }
  }

  async function addProject(data) {
    const { error } = await supabase
      .from('project_instances')
      .insert(data)
    if (error) return { error: error.message }
    await fetchProjects()
    return { error: null }
  }

  async function updateProject(id, updates) {
    const { error } = await supabase
      .from('project_instances')
      .update(updates)
      .eq('id', id)
    if (error) return { error: error.message }
    await fetchProjects()
    return { error: null }
  }

  async function deleteProject(id) {
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
    deleteProject,
  }
}