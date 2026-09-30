import { useState, useEffect } from 'react'
import { formatRelativeTime } from '../../lib/formatRelativeTime'

const EMPTY_FORM = {
  beneficiary_id: '',
  name: '',
  role: '',
  contact_number: '',
  messenger_link: '',
}

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// Used for both Add (contact = null) and Edit (contact = existing row)
export default function ContactModal({ contact, beneficiaries, onClose, onSave, onDelete }) {
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (contact) {
      setForm({
        beneficiary_id: contact.beneficiary_id ?? '',
        name: contact.name ?? '',
        role: contact.role ?? '',
        contact_number: contact.contact_number ?? '',
        messenger_link: contact.messenger_link ?? '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [contact])

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.beneficiary_id || !form.name) {
      setError('Beneficiary and Name are required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      beneficiary_id: Number(form.beneficiary_id),
      name: form.name,
      role: form.role || null,
      contact_number: form.contact_number || null,
      messenger_link: form.messenger_link || null,
    }

    const { error } = await onSave(payload)
    setSaving(false)
    if (error) setError(error)
    else onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await onDelete(contact.id)
    setDeleting(false)
    if (error) setError(error)
    // On success, Contacts.jsx's handleDelete already closes the modal
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-sm p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 max-h-[92dvh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-2 -m-2">✕</button>
        </div>
        {contact?.updated_at && (
          <p className="text-xs text-gray-400 -mt-3 mb-4">Last updated {formatRelativeTime(contact.updated_at)}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Beneficiary</label>
            <select
              value={form.beneficiary_id}
              onChange={e => handleChange('beneficiary_id', e.target.value)}
              className={inputClass}
            >
              <option value="">Select beneficiary...</option>
              {beneficiaries.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.municipality ? ` (${b.municipality})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Role</label>
            <input
              type="text"
              value={form.role}
              onChange={e => handleChange('role', e.target.value)}
              placeholder="e.g. Chairperson, Principal"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Contact Number</label>
            <input
              type="text"
              value={form.contact_number}
              onChange={e => handleChange('contact_number', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Messenger Link</label>
            <input
              type="url"
              value={form.messenger_link}
              onChange={e => handleChange('messenger_link', e.target.value)}
              placeholder="https://m.me/..."
              className={inputClass}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Danger Zone — only when editing, same pattern as editPanel.jsx */}
          {contact && onDelete && (
            <div className="pt-2 border-t border-gray-100">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                >
                  Delete this contact
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded p-2.5 mt-1">
                  <p className="text-xs text-red-700 mb-2 font-medium">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-red-600 text-white rounded px-2.5 py-1 text-xs hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="border border-gray-300 rounded px-2.5 py-1 text-xs hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}