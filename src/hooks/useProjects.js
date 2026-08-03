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
          beneficiaries (id, name, category, municipality, barangay)
        `)
        .order('year', { ascending: false })
        console.log("fetch passed")

      if (error) setError(error.message)
      else setProjects(data)
    } finally {
      setLoading(false)
    }
  }

  async function updateProject(id, updates) {
    const { error } = await supabase
      .from('project_instances')
      .update(updates)
      .eq('id', id)
      console.log("update passed")

    if (error) return { error: error.message }
    await fetchProjects()
    return { error: null }
  }

  return { projects, loading, error, refetch: fetchProjects, updateProject }
}