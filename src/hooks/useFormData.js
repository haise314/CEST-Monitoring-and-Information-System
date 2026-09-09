import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Fetches the lookup data needed to populate Add/Edit form dropdowns.
// Kept separate from useProjects so it only loads when a form is opened.
export function useFormData() {
  const [projectTypes, setProjectTypes]   = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [entryPoints, setEntryPoints]     = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [typesRes, bensRes, entryRes] = await Promise.all([
        supabase.from('project_types').select('id, name').order('name'),
        supabase.from('beneficiaries').select('id, name, category, district, municipality, barangay').order('name'),
        // entry_point has no lookup table of its own — it's free text on
        // project_instances — so "existing options" means distinct values
        // already used, fetched and deduped client-side (same approach the
        // filter bars already use for their own dropdown options).
        supabase.from('project_instances').select('entry_point').not('entry_point', 'is', null),
      ])
      if (typesRes.data) setProjectTypes(typesRes.data)
      if (bensRes.data) setBeneficiaries(bensRes.data)
      if (entryRes.data) {
        const distinct = [...new Set(entryRes.data.map(r => r.entry_point).filter(Boolean))].sort()
        setEntryPoints(distinct)
      }
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

  // Same idea, for beneficiaries — lets Add Project create a brand-new
  // beneficiary inline rather than requiring one to already exist.
  // Mirrors BeneficiaryModal's required fields (name, category).
  async function addBeneficiary({ name, category, district, municipality, barangay }) {
    const trimmedName = (name ?? '').trim()
    if (!trimmedName || !category) {
      return { error: 'Name and Category are required.', data: null }
    }

    const { data, error } = await supabase
      .from('beneficiaries')
      .insert({
        name: trimmedName,
        category,
        district: district || null,
        municipality: municipality || null,
        barangay: barangay || null,
      })
      .select('id, name, category, district, municipality, barangay')
      .single()

    if (error) return { error: error.message, data: null }

    setBeneficiaries(prev =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    return { error: null, data }
  }

  return { projectTypes, beneficiaries, entryPoints, loading, addProjectType, addBeneficiary }
}