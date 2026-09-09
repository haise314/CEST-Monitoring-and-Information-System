import { useState } from 'react'
import { useFormData } from '../../hooks/useFormData'
import { STATIC_OPTIONS, parseAmount } from './columns'

const EMPTY_FORM = {
  year:             new Date().getFullYear(),
  title:            '',
  project_type_id:  '',
  beneficiary_id:   '',
  project_category: '',
  overall_status:   'For Deployment',
  amount:           '',
  property_number:  '',
  entry_point:      '',
  date_deployed:    '',
}

const BENEFICIARY_CATEGORIES = ['LGU', 'Academe', 'SDO', 'NGO', 'Cooperative', 'Others', 'BLGU']
const EMPTY_NEW_BENEFICIARY = { name: '', category: '', district: '', municipality: '', barangay: '' }

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const NEW_TYPE_VALUE = '__new__'
const NEW_ENTRY_POINT_VALUE = '__new_entry__'
const NEW_BENEFICIARY_VALUE = '__new_beneficiary__'

export default function AddModal({ onClose, onAdd }) {
  const { projectTypes, beneficiaries, entryPoints, loading, addProjectType, addBeneficiary } = useFormData()
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  // Inline "add new project type" state — lives here rather than in
  // useFormData since it's purely this form's UI, not shared data.
  const [addingType, setAddingType]             = useState(false)
  const [newTypeName, setNewTypeName]           = useState('')
  const [addingTypeSaving, setAddingTypeSaving] = useState(false)
  const [typeError, setTypeError]               = useState(null)

  // Inline "add new entry point" state — no lookup table to insert into,
  // so this just types a new free-text value directly into the form;
  // no async save, no separate error state needed.
  const [addingEntryPoint, setAddingEntryPoint] = useState(false)
  const [newEntryPointValue, setNewEntryPointValue] = useState('')

  // Inline "add new beneficiary" state — nested mini-form inside the
  // beneficiary dropdown, mirrors BeneficiaryModal's required fields.
  const [addingBeneficiary, setAddingBeneficiary]             = useState(false)
  const [newBeneficiary, setNewBeneficiary]                   = useState(EMPTY_NEW_BENEFICIARY)
  const [addingBeneficiarySaving, setAddingBeneficiarySaving] = useState(false)
  const [beneficiaryError, setBeneficiaryError]               = useState(null)

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

  function handleAddEntryPoint() {
    const trimmed = newEntryPointValue.trim()
    if (!trimmed) return
    handleChange('entry_point', trimmed)
    setAddingEntryPoint(false)
    setNewEntryPointValue('')
  }

  async function handleAddBeneficiary() {
    setAddingBeneficiarySaving(true)
    setBeneficiaryError(null)
    const { data, error } = await addBeneficiary(newBeneficiary)
    setAddingBeneficiarySaving(false)
    if (error) {
      setBeneficiaryError(error)
      return
    }
    handleChange('beneficiary_id', data.id)
    setAddingBeneficiary(false)
    setNewBeneficiary(EMPTY_NEW_BENEFICIARY)
  }

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // The entry point select must always include the current value as an
  // option, even if it was just typed via "+ Add new" rather than coming
  // from the fetched distinct list — otherwise the select would silently
  // show nothing selected once you switch back out of the inline input.
  const entryPointOptions = form.entry_point && !entryPoints.includes(form.entry_point)
    ? [...entryPoints, form.entry_point].sort()
    : entryPoints

  async function handleSubmit() {
    if (!form.year || !form.project_type_id || !form.beneficiary_id || !form.project_category) {
      setError('Year, Project Type, Beneficiary, and Project Category are required.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      year:             Number(form.year),
      title:            form.title || null,
      project_type_id:  Number(form.project_type_id),
      beneficiary_id:   Number(form.beneficiary_id),
      project_category: form.project_category,
      overall_status:   form.overall_status || 'For Deployment',
      amount:           parseAmount(form.amount),
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
              {addingBeneficiary ? (
                <div className="border border-gray-200 rounded p-3 space-y-2 bg-gray-50">
                  <input
                    autoFocus
                    type="text"
                    value={newBeneficiary.name}
                    onChange={e => setNewBeneficiary(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Beneficiary name..."
                    className={inputClass}
                  />
                  <select
                    value={newBeneficiary.category}
                    onChange={e => setNewBeneficiary(prev => ({ ...prev, category: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Select category...</option>
                    {BENEFICIARY_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newBeneficiary.municipality}
                    onChange={e => setNewBeneficiary(prev => ({ ...prev, municipality: e.target.value }))}
                    placeholder="Municipality (optional)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={newBeneficiary.barangay}
                    onChange={e => setNewBeneficiary(prev => ({ ...prev, barangay: e.target.value }))}
                    placeholder="Barangay (optional)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={newBeneficiary.district}
                    onChange={e => setNewBeneficiary(prev => ({ ...prev, district: e.target.value }))}
                    placeholder="District (optional)"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddBeneficiary}
                      disabled={addingBeneficiarySaving}
                      className="flex-1 rounded bg-blue-600 text-white text-sm font-medium py-1.5 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingBeneficiarySaving ? 'Adding...' : 'Add Beneficiary'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingBeneficiary(false)
                        setNewBeneficiary(EMPTY_NEW_BENEFICIARY)
                        setBeneficiaryError(null)
                      }}
                      className="px-3 rounded border border-gray-300 text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {beneficiaryError && <p className="text-red-500 text-xs">{beneficiaryError}</p>}
                </div>
              ) : (
                <select
                  value={form.beneficiary_id}
                  onChange={e => {
                    if (e.target.value === NEW_BENEFICIARY_VALUE) setAddingBeneficiary(true)
                    else handleChange('beneficiary_id', e.target.value)
                  }}
                  className={inputClass}
                >
                  <option value="">Select beneficiary...</option>
                  {beneficiaries.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.municipality ? ` (${b.municipality})` : ''}
                    </option>
                  ))}
                  <option value={NEW_BENEFICIARY_VALUE}>+ Add new beneficiary...</option>
                </select>
              )}
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
              <label className="block text-sm text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="e.g. Portasol Unit for Barangay X Farmers Association"
                className={inputClass}
              />
            </div>

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
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={e => handleChange('amount', e.target.value)}
                placeholder="e.g. 285,000"
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
              {addingEntryPoint ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newEntryPointValue}
                    onChange={e => setNewEntryPointValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddEntryPoint()}
                    placeholder="New entry point..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddEntryPoint}
                    className="px-3 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingEntryPoint(false); setNewEntryPointValue('') }}
                    className="px-3 rounded border border-gray-300 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={form.entry_point}
                  onChange={e => {
                    if (e.target.value === NEW_ENTRY_POINT_VALUE) setAddingEntryPoint(true)
                    else handleChange('entry_point', e.target.value)
                  }}
                  className={inputClass}
                >
                  <option value="">Select entry point...</option>
                  {entryPointOptions.map(ep => (
                    <option key={ep} value={ep}>{ep}</option>
                  ))}
                  <option value={NEW_ENTRY_POINT_VALUE}>+ Add new entry point...</option>
                </select>
              )}
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