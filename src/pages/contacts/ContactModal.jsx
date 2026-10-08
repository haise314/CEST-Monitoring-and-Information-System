import { useState, useEffect } from 'react'
import SearchableSelect from '../../components/common/SearchableSelect'
import ModalShell from '../../components/common/ModalShell'

const EMPTY_FORM = { name: '', role: '', contact_number: '', email: '', messenger_link: '' }

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const benLabel = b => `${b.name}${b.municipality ? ` (${b.municipality})` : ''}`

// Add (contact = null) or Edit (contact = row with beneficiary_ids).
// A contact can belong to several beneficiaries: chips show the current ones,
// the picker adds more. `defaultBeneficiaryId` pre-selects one when a contact
// is created from a beneficiary or project page.
// onSave(payload) -> { error }; payload.beneficiary_ids is a number[].
export default function ContactModal({
  contact, beneficiaries, defaultBeneficiaryId = null,
  readOnly = false, onClose, onSave, onDelete,
}) {
  const [form, setForm]       = useState(EMPTY_FORM)
  const [benIds, setBenIds]   = useState([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (contact) {
      setForm({
        name: contact.name ?? '',
        role: contact.role ?? '',
        contact_number: contact.contact_number ?? '',
        email: contact.email ?? '',
        messenger_link: contact.messenger_link ?? '',
      })
      setBenIds((contact.beneficiary_ids ?? []).map(Number))
    } else {
      setForm(EMPTY_FORM)
      setBenIds(defaultBeneficiaryId != null ? [Number(defaultBeneficiaryId)] : [])
    }
  }, [contact, defaultBeneficiaryId])

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const addBeneficiary    = v => setBenIds(prev => (prev.includes(Number(v)) ? prev : [...prev, Number(v)]))
  const removeBeneficiary = id => setBenIds(prev => prev.filter(x => x !== id))

  const available = beneficiaries.filter(b => !benIds.includes(b.id))

  async function handleSubmit() {
    if (!form.name.trim() || benIds.length === 0) {
      setError('Name and at least one Beneficiary are required.')
      return
    }
    const email = form.email.trim()
    if (email && !EMAIL_RE.test(email)) {
      setError('That email address doesn\'t look right.')
      return
    }
    setSaving(true)
    setError(null)

    const { error } = await onSave({
      name: form.name.trim(),
      role: form.role || null,
      contact_number: form.contact_number || null,
      email: email || null,
      messenger_link: form.messenger_link || null,
      beneficiary_ids: benIds,
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
          <div>
            <label className={labelClass}>Beneficiaries</label>
            {benIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {benIds.map(id => {
                  const b = beneficiaries.find(x => x.id === id)
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 text-blue-800 text-xs pl-2.5 pr-1.5 py-1 max-w-full">
                      <span className="truncate">{b ? benLabel(b) : `#${id}`}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeBeneficiary(id)}
                          aria-label="Remove beneficiary"
                          className="text-blue-600 hover:text-blue-900 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
            <SearchableSelect
              value=""
              onChange={addBeneficiary}
              options={available.map(b => ({ value: b.id, label: benLabel(b) }))}
              placeholder={benIds.length ? '+ Add another beneficiary...' : 'Select beneficiary...'}
              searchPlaceholder="Search beneficiaries..."
              emptyText="No more beneficiaries"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <input
                type="text"
                value={form.role}
                onChange={e => handleChange('role', e.target.value)}
                placeholder="e.g. Chairperson, Principal"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Contact Number</label>
              <input type="text" inputMode="tel" value={form.contact_number} onChange={e => handleChange('contact_number', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Messenger Link</label>
            <input
              type="url"
              value={form.messenger_link}
              onChange={e => handleChange('messenger_link', e.target.value)}
              placeholder="https://m.me/..."
              className={inputClass}
            />
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
                  Delete this contact everywhere — all its beneficiaries and projects? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white rounded px-2.5 py-1 text-xs hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="border border-gray-300 bg-white rounded px-2.5 py-1 text-xs hover:bg-gray-50">
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