import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT = "You don't have permission to make changes."

// Contacts are standalone now (no beneficiary links).
// Every call returns { error } (string|null); nothing throws.
export function useContactMutations() {
  const { canEdit } = useAuth()

  // data: { name, role, contact_number, email, messenger_link }; id null = create
  async function saveContact(id, data) {
    if (!canEdit) return { error: NO_EDIT, id: null }
    const row = {
      name:           data.name,
      role:           data.role ?? null,
      contact_number: data.contact_number ?? null,
      email:          data.email ?? null,
      messenger_link: data.messenger_link ?? null,
    }
    const q = id == null
      ? supabase.from('beneficiary_contacts').insert(row)
      : supabase.from('beneficiary_contacts').update(row).eq('id', id)
    const { data: out, error } = await q.select('id')
    if (error) return { error: error.message, id: null }
    if (!out || out.length === 0) return { error: NO_EDIT, id: null }
    return { error: null, id: out[0].id }
  }

  // Deletes the contact everywhere (project links cascade).
  async function deleteContact(id) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase
      .from('beneficiary_contacts').delete().eq('id', id).select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    return { error: null }
  }

  return { saveContact, deleteContact }
}