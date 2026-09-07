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
export default function BeneficiaryModal({ beneficiary, onClose, onSave }) {
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

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