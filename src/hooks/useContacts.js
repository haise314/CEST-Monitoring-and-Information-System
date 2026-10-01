import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT  = "You don't have permission to make changes."
const NO_ADMIN = 'Only an admin can delete this.'

// Manages the full beneficiary_contacts table — every contact in the
// system, regardless of which project(s) they're linked to. This is
// distinct from useProjectContacts (which only manages the link table
// for one project) and useBeneficiaryContacts (which only reads contacts
// for one beneficiary, for the picker inside ProjectContacts).
export function useContacts() {
  const { canEdit, isAdmin } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('beneficiary_contacts')
        .select(`
          *,
          beneficiaries (id, name, municipality, barangay)
        `)
        .order('name')

      if (error) setError(error.message)
      else setContacts(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function addContact(data) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase
      .from('beneficiary_contacts')
      .insert(data)
    if (error) return { error: error.message }
    await fetchContacts()
    return { error: null }
  }

  async function updateContact(id, updates) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase
      .from('beneficiary_contacts')
      .update(updates)
      .eq('id', id)
    if (error) return { error: error.message }
    await fetchContacts()
    return { error: null }
  }

  async function deleteContact(id) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase
      .from('beneficiary_contacts')
      .delete()
      .eq('id', id)
    if (error) return { error: error.message }
    await fetchContacts()
    return { error: null }
  }

  return {
    contacts,
    loading,
    error,
    refetch: fetchContacts,
    addContact,
    updateContact,
    deleteContact,
  }
}