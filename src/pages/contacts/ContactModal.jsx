import { useState, useEffect } from 'react'
import ModalShell from '../../components/common/ModalShell'

const EMPTY_FORM = { name: '', role: '', contact_number: '', email: '', messenger_link: '' }

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Add (contact = null) or Edit. Contacts are standalone: no beneficiary needed.
// onSave(payload) -> { error }
export default function ContactModal({ contact, readOnly = false, onClose, onSave, onDelete }) {
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setForm(contact ? {
      name: contact.name ?? '',
      role: contact.role ?? '',
      contact_number: contact.contact_number ?? '',
      email: contact.email ?? '',
      messenger_link: contact.messenger_link ?? '',
    } : EMPTY_FORM)
  }, [contact])

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    const email = form.email.trim()
    if (email && !EMAIL_RE.test(email)) { setError("That email address doesn't look right."); return }
    setSaving(true)
    setError(null)
    const { error } = await onSave({
      name: form.name.trim(),
      role: form.role || null,
      contact_number: form.contact_number || null,
      email: email || null,
      messenger_link: form.messenger_link || null,
    })
    setSaving(false)
    if (error) setError(error)
    else onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await onDelete(contact.id)
    setDeleting(false)
    if (error) setError(error)
    // On success the caller closes the modal
  }

  const footer = (
    <div>
      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</div>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="border border-gray-300 bg-white rounded px-4 py-2 text-sm hover:bg-gray-50">
          {readOnly ? 'Close' : 'Cancel'}
        </button>
        {!readOnly && (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <ModalShell
      title={readOnly ? 'Contact' : contact ? 'Edit Contact' : 'Add Contact'}
      subtitle={contact?.name}
      size="md"
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-4">
        <fieldset disabled={readOnly} className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <input type="text" value={form.role} onChange={e => handleChange('role', e.target.value)}
                placeholder="e.g. Chairperson, Principal" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contact Number</label>
              <input type="text" inputMode="tel" value={form.contact_number}
                onChange={e => handleChange('contact_number', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" inputMode="email" autoComplete="off" value={form.email}
                onChange={e => handleChange('email', e.target.value)} placeholder="name@example.com" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Messenger Link</label>
            <input type="url" value={form.messenger_link}
              onChange={e => handleChange('messenger_link', e.target.value)} placeholder="https://m.me/..." className={inputClass} />
          </div>
        </fieldset>

        {contact && onDelete && (
          <div className="pt-3 border-t border-gray-100">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-600 hover:text-red-800 underline">
                Delete this contact
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-2.5">
                <p className="text-xs text-red-700 mb-2 font-medium">
                  Delete this contact everywhere, including all projects it's attached to? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} disabled={deleting}
                    className="bg-red-600 text-white rounded px-2.5 py-1 text-xs hover:bg-red-700 disabled:opacity-50">
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="border border-gray-300 bg-white rounded px-2.5 py-1 text-xs hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}