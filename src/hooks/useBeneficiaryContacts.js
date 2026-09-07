import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useBeneficiaryContacts(beneficiaryId) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!beneficiaryId) {
      setContacts([])
      setLoading(false)
      return
    }

    async function fetchContacts() {
      setLoading(true)
      const { data } = await supabase
        .from('beneficiary_contacts')
        .select('id, name, role, contact_number, messenger_link')
        .eq('beneficiary_id', beneficiaryId)
        .order('name')
      setContacts(data ?? [])
      setLoading(false)
    }
    fetchContacts()
  }, [beneficiaryId])

  return { contacts, loading }
}