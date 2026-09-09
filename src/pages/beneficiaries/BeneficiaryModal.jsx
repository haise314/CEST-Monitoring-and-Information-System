import { useState, useEffect } from 'react'

const CATEGORIES = ['LGU', 'Academe', 'SDO', 'NGO', 'Cooperative', 'Others', 'BLGU']

const EMPTY_FORM = {
  name: '',
  category: '',
  district: '',
  municipality: '',
  barangay: '',
}

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// Used for both Add (beneficiary = null) and Edit (beneficiary = existing row)
export default function BeneficiaryModal({ beneficiary, linkedProjectCount = 0, onClose, onSave, onDelete }) {
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (beneficiary) {
      setForm({
        name: beneficiary.name ?? '',
        category: beneficiary.category ?? '',
        district: beneficiary.district ?? '',
        municipality: beneficiary.municipality ?? '',
        barangay: beneficiary.barangay ?? '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setError(null)
  }, [beneficiary])

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.name || !form.category) {
      setError('Name and Category are required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name,
      category: form.category,
      district: form.district || null,
      municipality: form.municipality || null,
      barangay: form.barangay || null,
    }

    const { error } = await onSave(payload)
    setSaving(false)
    if (error) setError(error)
    else onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await onDelete(beneficiary.id)
    setDeleting(false)
    if (error) setError(error)
    // On success, Beneficiaries.jsx's handleDelete already closes the modal
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">
            {beneficiary ? 'Edit Beneficiary' : 'Add Beneficiary'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="space-y-3">
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
            <label className="block text-sm text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => handleChange('category', e.target.value)}
              className={inputClass}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">District</label>
            <input
              type="text"
              value={form.district}
              onChange={e => handleChange('district', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Municipality</label>
            <input
              type="text"
              value={form.municipality}
              onChange={e => handleChange('municipality', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Barangay</label>
            <input
              type="text"
              value={form.barangay}
              onChange={e => handleChange('barangay', e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Danger Zone — only when editing. Delete-guard preserved from
              the old row-level version: disabled with an explanation if
              this beneficiary still has linked projects, since deleting
              would otherwise hit the DB's NO ACTION foreign key and
              surface a raw Postgres error. */}
          {beneficiary && onDelete && (
            <div className="pt-2 border-t border-gray-100">
              {linkedProjectCount > 0 ? (
                <p className="text-xs text-gray-400">
                  Cannot delete — used by {linkedProjectCount} project{linkedProjectCount === 1 ? '' : 's'}.
                </p>
              ) : !confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                >
                  Delete this beneficiary
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
              {saving ? 'Saving...' : beneficiary ? 'Save Changes' : 'Add Beneficiary'}
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