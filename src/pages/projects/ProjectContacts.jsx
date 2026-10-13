import { useState } from 'react'
import { useProjectContacts } from '../../hooks/useProjectContacts'
import { useContacts } from '../../hooks/useContacts'
import { useContactMutations } from '../../hooks/useContactMutations'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import SearchableSelect from '../../components/common/SearchableSelect'
import ContactEditorModal from '../contacts/ContactEditorModal'

const pickerClass = 'w-full border border-gray-300 rounded px-2 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// Search matches name, role, number and email (all words must match).
const optionLabel = c =>
  [c.name, c.role && `— ${c.role}`, c.contact_number && `· ${c.contact_number}`, c.email && `· ${c.email}`]
    .filter(Boolean).join(' ')

// Contacts of one project. Pick from ALL existing contacts (searchable), or
// create a new one (it is attached to this project right away).
export default function ProjectContacts({ project }) {
  const { canEdit } = useAuth()
  const toast = useToast()
  const { contacts, loading, error, addContact, removeContact, refetch } = useProjectContacts(project?.id)
  const { contacts: allContacts, loading: loadingAll, refetch: refetchAll } = useContacts()
  const { saveContact } = useContactMutations()

  const [selectedId, setSelectedId] = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState(null)
  const [editing, setEditing]       = useState(null) // a contact | 'new' | null

  const linkedIds = new Set(contacts.map(c => c.id))
  const options = allContacts.filter(c => !linkedIds.has(c.id)).map(c => ({ value: c.id, label: optionLabel(c) }))

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
      const { error } = await addContact(result.id)
      if (error) return { error }
    } else {
      await refetch()
    }
    await refetchAll()
    toast.success(isNew ? 'Contact added to project' : 'Contact updated')
    return { error: null }
  }

  if (!project) return null
  if (loading) return <div className="text-xs text-gray-500 py-2">Loading contacts...</div>
  if (error)   return <div className="text-xs text-red-500 py-2">{error}</div>

  return (
    <div>
      {contacts.length === 0 ? (
        <p className="text-xs text-gray-500 mb-3">No contacts linked yet.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {contacts.map(c => (
            <div key={c.linkId} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm text-gray-700 truncate">{c.name}</div>
                <div className="text-xs text-gray-500 truncate">
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
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={selectedId}
              onChange={setSelectedId}
              options={options}
              disabled={loadingAll}
              placeholder={loadingAll ? 'Loading contacts...' : 'Search all contacts to add...'}
              searchPlaceholder="Search name, role, number, email..."
              emptyText="No matching contacts"
              footerAction={{ label: '+ New contact...', onClick: () => setEditing('new') }}
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

      {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}

      {editing && (
        <ContactEditorModal
          contact={editing === 'new' ? null : editing}
          onSave={handleSaveContact}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}