import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useContactMutations } from './useContactMutations'

// Every contact in the system (standalone, not tied to beneficiaries).
export function useContacts() {
  const { saveContact, deleteContact: removeContact } = useContactMutations()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => { fetchContacts() }, [])

  async function fetchContacts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('beneficiary_contacts').select('*').order('name')
      if (error) { setError(error.message); return }
      setContacts(data ?? [])
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

  return { contacts, loading, error, refetch: fetchContacts, addContact, updateContact, deleteContact }
}