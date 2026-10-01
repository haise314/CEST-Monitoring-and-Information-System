import { useState } from 'react'
import { useProjectContacts } from '../../hooks/useProjectContacts'
import { useBeneficiaryContacts } from '../../hooks/useBeneficiaryContacts'
import { useAuth } from '../../lib/AuthContext'

export default function ProjectContacts({ project }) {
  const { canEdit } = useAuth()
  const { contacts, loading, error, addContact, removeContact } = useProjectContacts(project?.id)
  const { contacts: availableContacts, loading: loadingAvailable } = useBeneficiaryContacts(project?.beneficiary_id)

  const [selectedId, setSelectedId] = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState(null)

  const linkedIds = new Set(contacts.map(c => c.id))
  const options    = availableContacts.filter(c => !linkedIds.has(c.id))

  async function handleAdd() {
    if (!selectedId) return
    setAdding(true)
    setAddError(null)
    const { error } = await addContact(Number(selectedId))
    setAdding(false)
    if (error) setAddError(error)
    else setSelectedId('')
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
<button
                onClick={() => removeContact(c.linkId)}
                className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 ml-2"
              >
                Remove
              </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!canEdit ? null : loadingAvailable ? (
        <p className="text-xs text-gray-400">Loading available contacts...</p>
      ) : !project.beneficiary_id ? (
        <p className="text-xs text-gray-400">No beneficiary set for this project.</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-gray-400">
          No more contacts for this beneficiary. Add new ones on the Contacts page.
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
          >
            <option value="">Select a contact to add...</option>
            {options.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.role ? ` — ${c.role}` : ''}
              </option>
            ))}
          </select>
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
    </div>
  )
}