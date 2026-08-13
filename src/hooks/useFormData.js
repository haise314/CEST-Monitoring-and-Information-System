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

  return { projectTypes, beneficiaries, loading }
}