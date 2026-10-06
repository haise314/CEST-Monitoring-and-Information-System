import { useState } from 'react'
import { useProjectContacts } from '../../hooks/useProjectContacts'
import { useBeneficiaryContacts } from '../../hooks/useBeneficiaryContacts'
import { useContactMutations } from '../../hooks/useContactMutations'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import SearchableSelect from '../../components/common/SearchableSelect'
import ContactEditorModal from '../contacts/ContactEditorModal'

const pickerClass = 'w-full border border-gray-300 rounded px-2 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// Contacts of one project. They are picked from the project's beneficiary's
// contacts; "+ New contact" creates one (pre-linked to that beneficiary) and
// attaches it to this project in one step; "Edit" changes the contact itself.
export default function ProjectContacts({ project }) {
  const { canEdit } = useAuth()
  const toast = useToast()
  const { contacts, loading, error, addContact, removeContact, refetch } = useProjectContacts(project?.id)
  const { contacts: availableContacts, loading: loadingAvailable, refetch: refetchAvailable } = useBeneficiaryContacts(project?.beneficiary_id)
  const { saveContact } = useContactMutations()

  const [selectedId, setSelectedId] = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState(null)
  const [editing, setEditing]       = useState(null) // a contact | 'new' | null

  const linkedIds = new Set(contacts.map(c => c.id))
  const options   = availableContacts.filter(c => !linkedIds.has(c.id))

  async function handleAdd() {
    if (!selectedId) return
    setAdding(true)
    setAddError(null)
    const { error } = await addContact(Number(selectedId))
    setAdding(false)
    if (error) setAddError(error)
    else setSelectedId('')
  }

  async function handleSaveContact(payload) {
    const isNew = editing === 'new'
    const result = await saveContact(isNew ? null : editing.id, payload)
    if (result.error) return { error: result.error }
    if (isNew) {
      const { error } = await addContact(result.id) // attach to this project
      if (error) return { error }
    } else {
      await refetch()
    }
    await refetchAvailable()
    toast.success(isNew ? 'Contact added to project' : 'Contact updated')
    return { error: null }
  }

  // Guard comes after all hooks (never before) so hook call order stays
  // identical across renders, even in the brief window where a parent
  // passes project as undefined (e.g. mid-delete, before selectedProjectId
  // clears) or during a Vite hot-reload edge case.
  if (!project) return null

  if (loading) return <div className="text-xs text-gray-400 py-2">Loading contacts...</div>
  if (error)   return <div className="text-xs text-red-500 py-2">{error}</div>

  return (
    <div>
      {contacts.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">No contacts linked yet.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {contacts.map(c => (
            <div key={c.linkId} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm text-gray-700 truncate">{c.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {[c.role, c.contact_number].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <button onClick={() => setEditing(c)} className="text-xs text-blue-500 hover:text-blue-700 underline">Edit</button>
                  <button onClick={() => removeContact(c.linkId)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        !project.beneficiary_id ? (
          <p className="text-xs text-gray-400">No beneficiary set for this project.</p>
        ) : (
          <div className="space-y-2">
            {loadingAvailable ? (
              <p className="text-xs text-gray-400">Loading available contacts...</p>
            ) : options.length === 0 ? (
              <p className="text-xs text-gray-400">No more contacts for this beneficiary.</p>
            ) : (
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={selectedId}
                    onChange={setSelectedId}
                    options={options.map(c => ({ value: c.id, label: `${c.name}${c.role ? ` — ${c.role}` : ''}` }))}
                    placeholder="Select a contact to add..."
                    searchPlaceholder="Search contacts..."
                    className={pickerClass}
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!selectedId || adding}
                  className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
                >
                  {adding ? 'Adding...' : '+ Add'}
                </button>
              </div>
            )}
            <button onClick={() => setEditing('new')} className="text-xs text-blue-500 hover:text-blue-700 underline">
              + New contact
            </button>
          </div>
        )
      )}

      {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}

      {editing && (
        <ContactEditorModal
          contact={editing === 'new' ? null : editing}
          defaultBeneficiaryId={project.beneficiary_id}
          onSave={handleSaveContact}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}