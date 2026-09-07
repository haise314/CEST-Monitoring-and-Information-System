import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Fetches the lookup data needed to populate Add/Edit form dropdowns.
// Kept separate from useProjects so it only loads when a form is opened.
export function useFormData() {
  const [projectTypes, setProjectTypes] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [typesRes, bensRes] = await Promise.all([
        supabase.from('project_types').select('id, name').order('name'),
        supabase.from('beneficiaries').select('id, name, municipality, barangay').order('name'),
      ])
      if (typesRes.data) setProjectTypes(typesRes.data)
      if (bensRes.data) setBeneficiaries(bensRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  // Lets a form create a new project type on the fly (e.g. from the Add
  // Project modal) instead of forcing the user to leave and come back.
  // Returns the new row so the caller can immediately select it.
  async function addProjectType(name) {
    const trimmed = name.trim()
    if (!trimmed) return { error: 'Name is required.', data: null }

    const { data, error } = await supabase
      .from('project_types')
      .insert({ name: trimmed })
      .select('id, name')
      .single()

    if (error) return { error: error.message, data: null }

    setProjectTypes(prev =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    return { error: null, data }
  }

  return { projectTypes, beneficiaries, loading, addProjectType }
}