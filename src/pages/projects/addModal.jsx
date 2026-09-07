import { useState } from 'react'
import { useFormData } from '../../hooks/useFormData'
import { STATIC_OPTIONS } from './columns'

const EMPTY_FORM = {
  year:             new Date().getFullYear(),
  project_type_id:  '',
  beneficiary_id:   '',
  project_category: '',
  overall_status:   'For Deployment',
  amount:           '',
  property_number:  '',
  entry_point:      '',
  date_deployed:    '',
}

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const NEW_TYPE_VALUE = '__new__'

export default function AddModal({ onClose, onAdd }) {
  const { projectTypes, beneficiaries, loading, addProjectType } = useFormData()
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  // Inline "add new project type" state — lives here rather than in
  // useFormData since it's purely this form's UI, not shared data.
  const [addingType, setAddingType]             = useState(false)
  const [newTypeName, setNewTypeName]           = useState('')
  const [addingTypeSaving, setAddingTypeSaving] = useState(false)
  const [typeError, setTypeError]               = useState(null)

  async function handleAddType() {
    setAddingTypeSaving(true)
    setTypeError(null)
    const { data, error } = await addProjectType(newTypeName)
    setAddingTypeSaving(false)
    if (error) {
      setTypeError(error)
      return
    }
    handleChange('project_type_id', data.id)
    setAddingType(false)
    setNewTypeName('')
  }

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.year || !form.project_type_id || !form.beneficiary_id || !form.project_category) {
      setError('Year, Project Type, Beneficiary, and Project Category are required.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      year:             Number(form.year),
      project_type_id:  Number(form.project_type_id),
      beneficiary_id:   Number(form.beneficiary_id),
      project_category: form.project_category,
      overall_status:   form.overall_status || 'For Deployment',
      amount:           form.amount !== ''   ? Number(form.amount) : null,
      property_number:  form.property_number || null,
      entry_point:      form.entry_point     || null,
      date_deployed:    form.date_deployed   || null,
    }

    const { error } = await onAdd(payload)
    setSaving(false)
    if (error) setError(error)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">Add New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">

            {/* Required */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Required</div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Year</label>
              <input
                type="number"
                value={form.year}
                onChange={e => handleChange('year', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Project Type</label>
              {addingType ? (
                <div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newTypeName}
                      onChange={e => setNewTypeName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddType()}
                      placeholder="New project type name..."
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleAddType}
                      disabled={addingTypeSaving}
                      className="px-3 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {addingTypeSaving ? '...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingType(false); setNewTypeName(''); setTypeError(null) }}
                      className="px-3 rounded border border-gray-300 text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {typeError && <p className="text-red-500 text-xs mt-1">{typeError}</p>}
                </div>
              ) : (
                <select
                  value={form.project_type_id}
                  onChange={e => {
                    if (e.target.value === NEW_TYPE_VALUE) setAddingType(true)
                    else handleChange('project_type_id', e.target.value)
                  }}
                  className={inputClass}
                >
                  <option value="">Select project type...</option>
                  {projectTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  <option value={NEW_TYPE_VALUE}>+ Add new project type...</option>
                </select>
              )}
            </div>

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
              <label className="block text-sm text-gray-600 mb-1">Project Category</label>
              <select
                value={form.project_category}
                onChange={e => handleChange('project_category', e.target.value)}
                className={inputClass}
              >
                <option value="">Select category...</option>
                {STATIC_OPTIONS.project_category.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Optional */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Optional</div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Overall Status</label>
              <select
                value={form.overall_status}
                onChange={e => handleChange('overall_status', e.target.value)}
                className={inputClass}
              >
                {STATIC_OPTIONS.overall_status.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Amount (₱)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => handleChange('amount', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Property Number</label>
              <input
                type="text"
                value={form.property_number}
                onChange={e => handleChange('property_number', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Entry Point</label>
              <input
                type="text"
                value={form.entry_point}
                onChange={e => handleChange('entry_point', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Date Deployed</label>
              <input
                type="date"
                value={form.date_deployed}
                onChange={e => handleChange('date_deployed', e.target.value)}
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
                className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Add Project'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}