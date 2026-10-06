import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT = "You don't have permission to make changes."

// Write-only contact operations, with no fetching of their own, so a page can
// save a contact without loading the whole contacts table. Same contract as
// the other hooks: nothing throws, every call returns { error } (string|null).
//
// A contact belongs to many beneficiaries through contact_beneficiaries.
// saveContact() goes through the save_contact() database function so the
// contact row and its links are written in ONE transaction.
export function useContactMutations() {
  const { canEdit } = useAuth()

  // data: { name, role, contact_number, messenger_link, beneficiary_ids }
  // id null = create. Resolves { error, id }.
  async function saveContact(id, data) {
    if (!canEdit) return { error: NO_EDIT, id: null }
    const { data: newId, error } = await supabase.rpc('save_contact', {
      p_id:              id ?? null,
      p_name:            data.name,
      p_role:            data.role ?? null,
      p_contact_number:  data.contact_number ?? null,
      p_messenger_link:  data.messenger_link ?? null,
      p_beneficiary_ids: (data.beneficiary_ids ?? []).map(Number),
    })
    if (error) return { error: error.message, id: null }
    return { error: null, id: newId }
  }

  async function linkContact(contactId, beneficiaryId) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase
      .from('contact_beneficiaries')
      .upsert(
        { contact_id: contactId, beneficiary_id: beneficiaryId },
        { onConflict: 'contact_id,beneficiary_id', ignoreDuplicates: true }
      )
    return { error: error ? error.message : null }
  }

  // Removes the link only — the contact itself is kept.
  async function unlinkContact(contactId, beneficiaryId) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase
      .from('contact_beneficiaries')
      .delete()
      .eq('contact_id', contactId)
      .eq('beneficiary_id', beneficiaryId)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    return { error: null }
  }

  // Deletes the contact everywhere (links and project links cascade).
  async function deleteContact(id) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase
      .from('beneficiary_contacts')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    return { error: null }
  }

  return { saveContact, linkContact, unlinkContact, deleteContact }
}