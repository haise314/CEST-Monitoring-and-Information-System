import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useProjectContacts(projectId) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!projectId) return
    fetchContacts()
  }, [projectId])

  async function fetchContacts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('project_contacts')
        .select(`
          id,
          beneficiary_contacts (id, name, role, contact_number, messenger_link)
        `)
        .eq('project_id', projectId)

      if (error) setError(error.message)
      else {
        // Flatten: linkId is the project_contacts row (needed to remove the
        // link); the rest comes from the linked beneficiary_contacts row.
        setContacts((data ?? []).map(row => ({ linkId: row.id, ...row.beneficiary_contacts })))
      }
    } finally {
      setLoading(false)
    }
  }

  async function addContact(contactId) {
    const { error } = await supabase
      .from('project_contacts')
      .insert({ project_id: projectId, contact_id: contactId })
    if (error) return { error: error.message }
    await fetchContacts()
    return { error: null }
  }

  async function removeContact(linkId) {
    const { error } = await supabase
      .from('project_contacts')
      .delete()
      .eq('id', linkId)
    if (error) return { error: error.message }
    setContacts(prev => prev.filter(c => c.linkId !== linkId))
    return { error: null }
  }

  return { contacts, loading, error, addContact, removeContact }
}