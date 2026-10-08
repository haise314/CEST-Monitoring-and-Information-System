import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Contacts linked to ONE beneficiary (via contact_beneficiaries). Used by the
// project contact picker and the beneficiary page's contacts section.
// Each contact includes `beneficiary_ids` (all beneficiaries it belongs to) so
// it can be passed straight to ContactModal for editing.
// `refetch()` is silent (no loading flash), so open modals aren't unmounted.
export function useBeneficiaryContacts(beneficiaryId) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)

  const fetchContacts = useCallback(async (silent = false) => {
    if (!beneficiaryId) {
      setContacts([])
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('contact_beneficiaries')
      .select(`
        beneficiary_contacts (
          id, name, role, contact_number, email, messenger_link,
          contact_beneficiaries (beneficiary_id)
        )
      `)
      .eq('beneficiary_id', beneficiaryId)

    const list = (data ?? [])
      .map(row => row.beneficiary_contacts)
      .filter(Boolean)
      .map(({ contact_beneficiaries, ...c }) => ({
        ...c,
        beneficiary_ids: (contact_beneficiaries ?? []).map(l => l.beneficiary_id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    setContacts(list)
    setLoading(false)
  }, [beneficiaryId])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  return { contacts, loading, refetch: () => fetchContacts(true) }
}