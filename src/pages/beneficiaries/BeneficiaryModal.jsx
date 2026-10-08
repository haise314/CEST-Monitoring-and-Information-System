import { useState, useEffect, useMemo } from 'react'
import ModalShell from '../../components/common/ModalShell'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import BeneficiaryContacts from './BeneficiaryContacts'

const CATEGORIES = ['LGU', 'Academe', 'SDO', 'NGO', 'Cooperative', 'Others', 'BLGU']

const EMPTY_FORM = {
  name: '',
  category: '',
  district: '',
  municipality: '',
  barangay: '',
}

const baseInput = 'w-full border rounded px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2'
const okInput   = `${baseInput} border-gray-300 focus:ring-blue-500`
const badInput  = `${baseInput} border-red-400 focus:ring-red-400`

function formFrom(b) {
  return b
    ? {
        name: b.name ?? '',
        category: b.category ?? '',
        district: b.district ?? '',
        municipality: b.municipality ?? '',
        barangay: b.barangay ?? '',
      }
    : EMPTY_FORM
}

function Field({ id, label, required = false, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-gray-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  )
}

// Used for both Add (beneficiary = null) and Edit (beneficiary = existing row).
// readOnly: viewers get a disabled form and no Save button.
export default function BeneficiaryModal({
  beneficiary, linkedProjectCount = 0, readOnly = false, onClose, onSave, onDelete,
}) {
  const initial = useMemo(() => formFrom(beneficiary), [beneficiary])
  const [form, setForm]       = useState(initial)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setForm(initial)
    setFieldErrors({})
    setError(null)
  }, [initial])

  const dirty = !readOnly && Object.keys(initial).some(k => form[k] !== initial[k])

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: null }))
  }

  async function handleSubmit() {
    if (readOnly || saving) return
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (!form.category)    errs.category = 'Pick a category.'
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setError(null)
      document.getElementById(errs.name ? 'ben-name' : 'ben-category')?.focus()
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
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
    setConfirmDelete(false)
    if (error) setError(error)
    // On success, Beneficiaries.jsx's handleDelete already closes the modal
  }

  // Enter in a text field saves (not in selects/buttons, which use Enter themselves).
  function onFieldsKeyDown(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const footer = (
    <div>
      {error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
          {error}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="border border-gray-300 bg-white rounded px-4 py-2 text-sm hover:bg-gray-50"
        >
          {readOnly ? 'Close' : 'Cancel'}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : beneficiary ? 'Save Changes' : 'Add Beneficiary'}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <ModalShell
        title={readOnly ? 'Beneficiary' : beneficiary ? 'Edit Beneficiary' : 'Add Beneficiary'}
        subtitle={beneficiary?.name}
        size="md"
        dirty={dirty}
        onClose={onClose}
        footer={footer}
      >
        <div className="space-y-3">
          <fieldset disabled={readOnly} onKeyDown={onFieldsKeyDown} className="space-y-3 min-w-0">
            <Field id="ben-name" label="Name" required error={fieldErrors.name}>
              <input
                id="ben-name"
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? 'ben-name-error' : undefined}
                className={fieldErrors.name ? badInput : okInput}
              />
            </Field>

            <Field id="ben-category" label="Category" required error={fieldErrors.category}>
              <select
                id="ben-category"
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
                aria-invalid={!!fieldErrors.category}
                aria-describedby={fieldErrors.category ? 'ben-category-error' : undefined}
                className={fieldErrors.category ? badInput : okInput}
              >
                <option value="">Select category...</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field id="ben-district" label="District">
              <input id="ben-district" type="text" value={form.district}
                onChange={e => handleChange('district', e.target.value)} className={okInput} />
            </Field>

            <Field id="ben-municipality" label="Municipality">
              <input id="ben-municipality" type="text" value={form.municipality}
                onChange={e => handleChange('municipality', e.target.value)} className={okInput} />
            </Field>

            <Field id="ben-barangay" label="Barangay">
              <input id="ben-barangay" type="text" value={form.barangay}
                onChange={e => handleChange('barangay', e.target.value)} className={okInput} />
            </Field>
          </fieldset>

          {beneficiary && <BeneficiaryContacts beneficiary={beneficiary} />}

          {/* Danger Zone — only when editing. Delete guard kept: blocked while
              projects still reference this beneficiary (NO ACTION foreign key). */}
          {beneficiary && onDelete && !readOnly && (
            <div className="pt-3 border-t border-gray-100">
              {linkedProjectCount > 0 ? (
                <p className="text-xs text-gray-600">
                  Cannot delete — used by {linkedProjectCount} project{linkedProjectCount === 1 ? '' : 's'}.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  Delete this beneficiary
                </button>
              )}
            </div>
          )}
        </div>
      </ModalShell>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this beneficiary?"
          message={`"${beneficiary.name}" will be deleted, along with its contact links and itinerary stops. This cannot be undone.`}
          confirmLabel="Yes, delete"
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}