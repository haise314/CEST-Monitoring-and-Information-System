import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useContactMutations } from './useContactMutations'

// Manages the full beneficiary_contacts table — every contact in the system.
// A contact can belong to several beneficiaries, so each row carries:
//   beneficiaries:   [{ id, name, municipality, barangay }, ...] (by name)
//   beneficiary_ids: [id, ...]
// Distinct from useProjectContacts (the link table for one project) and
// useBeneficiaryContacts (the contacts of one beneficiary).
//
// addContact / updateContact take the form payload including
// `beneficiary_ids`; contact + links are saved atomically (see
// useContactMutations / save_contact in migrations/02_contact_beneficiaries.sql).
export function useContacts() {
  const { saveContact, deleteContact: removeContact } = useContactMutations()
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
          contact_beneficiaries (
            beneficiary_id,
            beneficiaries (id, name, municipality, barangay)
          )
        `)
        .order('name')

      if (error) { setError(error.message); return }

      setContacts((data ?? []).map(({ contact_beneficiaries, ...c }) => {
        const beneficiaries = (contact_beneficiaries ?? [])
          .map(l => l.beneficiaries)
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name))
        return { ...c, beneficiaries, beneficiary_ids: beneficiaries.map(b => b.id) }
      }))
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  async function addContact(data) {
    const { error } = await saveContact(null, data)
    if (error) return { error }
    await fetchContacts()
    return { error: null }
  }

  async function updateContact(id, updates) {
    const { error } = await saveContact(id, updates)
    if (error) return { error }
    await fetchContacts()
    return { error: null }
  }

  async function deleteContact(id) {
    const { error } = await removeContact(id)
    if (error) return { error }
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