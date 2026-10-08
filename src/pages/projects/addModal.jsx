import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useFormData } from '../../hooks/useFormData'
import Select from '../../components/common/Select'
import SearchableSelect from '../../components/common/SearchableSelect'
import ModalShell from '../../components/common/ModalShell'
import { STATIC_OPTIONS, SCOPE_OPTIONS, parseAmount } from './columns'

const EMPTY_FORM = {
  year:             new Date().getFullYear(),
  title:            '',
  project_type_id:  '',
  beneficiary_id:   '',
  project_category: '',
  project_scope:    'Provincial',
  overall_status:   'For Deployment',
  amount:           '',
  property_number:  '',
  entry_point:      '',
  date_deployed:    '',
}

const BENEFICIARY_CATEGORIES = ['LGU', 'Academe', 'SDO', 'NGO', 'Cooperative', 'Others', 'BLGU']
const EMPTY_NEW_BENEFICIARY = { name: '', category: '', district: '', municipality: '', barangay: '' }

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const NEW_TYPE_VALUE = '__new__'
const NEW_ENTRY_POINT_VALUE = '__new_entry__'

function Field({ label, required = false, hint, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function Group({ title, children }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-gray-100">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  )
}

// onAdd(payload) -> { error, id } (useProjects.addProject).
// "Add & open full page" creates the project and goes straight to /projects/:id.
export default function AddModal({ onClose, onAdd }) {
  const navigate = useNavigate()
  const { projectTypes, beneficiaries, entryPoints, loading, addProjectType, addBeneficiary } = useFormData()
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(null) // null | 'stay' | 'open'
  const [error, setError]   = useState(null)

  // Inline "add new project type" state — purely this form's UI.
  const [addingType, setAddingType]             = useState(false)
  const [newTypeName, setNewTypeName]           = useState('')
  const [addingTypeSaving, setAddingTypeSaving] = useState(false)
  const [typeError, setTypeError]               = useState(null)

  // Inline "add new entry point": free text, no lookup table to insert into.
  const [addingEntryPoint, setAddingEntryPoint]     = useState(false)
  const [newEntryPointValue, setNewEntryPointValue] = useState('')

  // Inline "add new beneficiary" mini-form (mirrors BeneficiaryModal's required fields).
  const [addingBeneficiary, setAddingBeneficiary]             = useState(false)
  const [newBeneficiary, setNewBeneficiary]                   = useState(EMPTY_NEW_BENEFICIARY)
  const [addingBeneficiarySaving, setAddingBeneficiarySaving] = useState(false)
  const [beneficiaryError, setBeneficiaryError]               = useState(null)

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleAddType() {
    setAddingTypeSaving(true)
    setTypeError(null)
    const { data, error } = await addProjectType(newTypeName)
    setAddingTypeSaving(false)
    if (error) { setTypeError(error); return }
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
    if (error) { setBeneficiaryError(error); return }
    handleChange('beneficiary_id', data.id)
    setAddingBeneficiary(false)
    setNewBeneficiary(EMPTY_NEW_BENEFICIARY)
  }

  // The select must always offer the current value, even a just-typed one.
  const entryPointOptions = form.entry_point && !entryPoints.includes(form.entry_point)
    ? [...entryPoints, form.entry_point].sort()
    : entryPoints

  async function handleSubmit(openAfter) {
    if (!form.year || !form.project_type_id || !form.beneficiary_id || !form.project_category) {
      setError('Year, Project Type, Beneficiary, and Project Category are required.')
      return
    }

    setSaving(openAfter ? 'open' : 'stay')
    setError(null)

    const payload = {
      year:             Number(form.year),
      title:            form.title || null,
      project_type_id:  Number(form.project_type_id),
      beneficiary_id:   Number(form.beneficiary_id),
      project_category: form.project_category,
      project_scope:    form.project_scope || 'Provincial',
      overall_status:   form.overall_status || 'For Deployment',
      amount:           parseAmount(form.amount),
      property_number:  form.property_number || null,
      entry_point:      form.entry_point     || null,
      date_deployed:    form.date_deployed   || null,
    }

    const { error, id } = await onAdd(payload)
    setSaving(null)
    if (error) { setError(error); return }
    onClose()
    if (openAfter && id != null) navigate(`/projects/${id}`)
  }

  const footer = (
    <div>
      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</div>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
        <button
          onClick={onClose}
          className="border border-gray-300 bg-white rounded px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={saving != null || loading}
          className="border border-blue-300 bg-white text-blue-700 rounded px-4 py-2 text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
        >
          {saving === 'stay' ? 'Saving...' : 'Add Project'}
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={saving != null || loading}
          title="Create the project, then open its full page to fill in everything else"
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving === 'open' ? 'Saving...' : 'Add & open full page →'}
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell
      title="Add New Project"
      subtitle="Fields marked * are required. You can fill in the rest later on the project's full page."
      size="lg"
      onClose={onClose}
      footer={footer}
    >
      {loading ? (
        <div className="text-center py-10 text-gray-500 text-sm">Loading...</div>
      ) : (
        <>
          <Group title="Project">
            <Field label="Year" required>
              <input
                type="number"
                value={form.year}
                onChange={e => handleChange('year', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Project Type" required className={addingType ? 'sm:col-span-2' : ''}>
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
                  {typeError && <p className="text-red-600 text-xs mt-1">{typeError}</p>}
                </div>
              ) : (
                <Select
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
                </Select>
              )}
            </Field>

            <Field label="Project Category" required>
              <Select
                value={form.project_category}
                onChange={e => handleChange('project_category', e.target.value)}
                className={inputClass}
              >
                <option value="">Select category...</option>
                {STATIC_OPTIONS.project_category.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>

            <Field label="Project Scope" hint="Only Provincial projects count against the yearly budget.">
              <Select
                value={form.project_scope}
                onChange={e => handleChange('project_scope', e.target.value)}
                className={inputClass}
              >
                {SCOPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Title" className="sm:col-span-2">
              <textarea
                rows={2}
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="e.g. Portasol Unit for Barangay X Farmers Association"
                className={inputClass}
              />
            </Field>
          </Group>

          <Group title="Beneficiary">
            <Field label="Beneficiary" required className="sm:col-span-2">
              {addingBeneficiary ? (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newBeneficiary.name}
                      onChange={e => setNewBeneficiary(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Beneficiary name *"
                      className={`${inputClass} sm:col-span-2`}
                    />
                    <Select
                      value={newBeneficiary.category}
                      onChange={e => setNewBeneficiary(prev => ({ ...prev, category: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Category *</option>
                      {BENEFICIARY_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                    <input
                      type="text"
                      value={newBeneficiary.district}
                      onChange={e => setNewBeneficiary(prev => ({ ...prev, district: e.target.value }))}
                      placeholder="District (optional)"
                      className={inputClass}
                    />
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
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleAddBeneficiary}
                      disabled={addingBeneficiarySaving}
                      className="flex-1 rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 disabled:opacity-50"
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
                      className="px-3 rounded border border-gray-300 bg-white text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {beneficiaryError && <p className="text-red-600 text-xs mt-2">{beneficiaryError}</p>}
                </div>
              ) : (
                <SearchableSelect
                  value={form.beneficiary_id}
                  onChange={v => handleChange('beneficiary_id', v)}
                  options={beneficiaries.map(b => ({
                    value: b.id,
                    label: `${b.name}${b.municipality ? ` (${b.municipality})` : ''}`,
                  }))}
                  placeholder="Select beneficiary..."
                  searchPlaceholder="Search beneficiaries..."
                  footerAction={{ label: '+ Add new beneficiary...', onClick: () => setAddingBeneficiary(true) }}
                  className={inputClass}
                />
              )}
            </Field>
          </Group>

          <Group title="Optional details">
            <Field label="Overall Status">
              <Select
                value={form.overall_status}
                onChange={e => handleChange('overall_status', e.target.value)}
                className={inputClass}
              >
                {STATIC_OPTIONS.overall_status.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Field>

            <Field label="Amount (₱)">
              <input
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={e => handleChange('amount', e.target.value)}
                placeholder="e.g. 285,000"
                className={inputClass}
              />
            </Field>

            <Field label="Property Number">
              <input
                type="text"
                value={form.property_number}
                onChange={e => handleChange('property_number', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Date Deployed">
              <input
                type="date"
                value={form.date_deployed}
                onChange={e => handleChange('date_deployed', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Entry Point" className="sm:col-span-2">
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
                <Select
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
                </Select>
              )}
            </Field>
          </Group>
        </>
      )}
    </ModalShell>
  )
}