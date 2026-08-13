import { useState, useEffect } from 'react'
import { useFormData } from '../../hooks/useFormData'
import { STATIC_OPTIONS } from './columns'

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputClass  = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const selectClass = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function EditPanel({ project, onClose, onUpdate, onDelete }) {
  const { projectTypes, loading } = useFormData()
  const [form, setForm]             = useState({})
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]           = useState(null)

  // Sync form whenever selected project changes
  useEffect(() => {
    if (!project) return
    setForm({
      year:                project.year                ?? '',
      project_type_id:     project.project_type_id     ?? '',
      project_category:    project.project_category    ?? '',
      property_number:     project.property_number     ?? '',
      amount:              project.amount              ?? '',
      date_deployed:       project.date_deployed       ?? '',
      entry_point:         project.entry_point         ?? '',
      intervention:        project.intervention        ?? '',
      overall_status:      project.overall_status      ?? '',
      operational_status:  project.operational_status  ?? '',
      interventions_count: project.interventions_count ?? '',
      people_trained:      project.people_trained      ?? '',
      impact_notes:        project.impact_notes        ?? '',
      gdrive_folder_link:  project.gdrive_folder_link  ?? '',
    })
    setError(null)
    setConfirmDelete(false)
  }, [project])

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const payload = {
      year:                Number(form.year),
      project_type_id:     form.project_type_id !== ''     ? Number(form.project_type_id)     : null,
      project_category:    form.project_category           || null,
      property_number:     form.property_number            || null,
      amount:              form.amount !== ''              ? Number(form.amount)              : null,
      date_deployed:       form.date_deployed              || null,
      entry_point:         form.entry_point                || null,
      intervention:        form.intervention               || null,
      overall_status:      form.overall_status             || null,
      operational_status:  form.operational_status         || null,
      interventions_count: form.interventions_count !== '' ? Number(form.interventions_count) : null,
      people_trained:      form.people_trained !== ''      ? Number(form.people_trained)      : null,
      impact_notes:        form.impact_notes               || null,
      gdrive_folder_link:  form.gdrive_folder_link         || null,
    }

    const { error } = await onUpdate(project.id, payload)
    setSaving(false)
    if (error) setError(error)
    else onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await onDelete(project.id)
    setDeleting(false)
    if (error) setError(error)
    else onClose()
  }

  if (!project) return null

  return (
    <>
      {/* Dim overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Edit Project</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {project.beneficiaries?.name ?? '—'} · {project.year}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
          ) : (
            <>
              <Section title="Project Info">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Year">
                    <input
                      type="number"
                      value={form.year}
                      onChange={e => handleChange('year', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Project Type">
                    <select
                      value={form.project_type_id}
                      onChange={e => handleChange('project_type_id', e.target.value)}
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {projectTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Project Category">
                  <select
                    value={form.project_category}
                    onChange={e => handleChange('project_category', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {STATIC_OPTIONS.project_category.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Property Number">
                  <input
                    type="text"
                    value={form.property_number}
                    onChange={e => handleChange('property_number', e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount (₱)">
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => handleChange('amount', e.target.value)}
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
                </div>

                <Field label="Entry Point">
                  <input
                    type="text"
                    value={form.entry_point}
                    onChange={e => handleChange('entry_point', e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Intervention">
                  <textarea
                    rows={2}
                    value={form.intervention}
                    onChange={e => handleChange('intervention', e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </Section>

              {/* Beneficiary is read-only — change via Beneficiaries page */}
              <Section title="Beneficiary">
                <div className="bg-gray-50 rounded px-3 py-2.5 text-sm">
                  <div className="font-medium text-gray-700">
                    {project.beneficiaries?.name ?? '—'}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {[project.beneficiaries?.barangay, project.beneficiaries?.municipality]
                      .filter(Boolean).join(', ')}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  To change the beneficiary, use the Beneficiaries page.
                </p>
              </Section>

              <Section title="Status">
                <Field label="Overall Status">
                  <select
                    value={form.overall_status}
                    onChange={e => handleChange('overall_status', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {STATIC_OPTIONS.overall_status.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Operational Status">
                  <select
                    value={form.operational_status}
                    onChange={e => handleChange('operational_status', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {STATIC_OPTIONS.operational_status.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </Section>

              <Section title="Impact">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="No. of Interventions">
                    <input
                      type="number"
                      value={form.interventions_count}
                      onChange={e => handleChange('interventions_count', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="People Trained">
                    <input
                      type="number"
                      value={form.people_trained}
                      onChange={e => handleChange('people_trained', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Impact Notes / Accomplishments">
                  <textarea
                    rows={3}
                    value={form.impact_notes}
                    onChange={e => handleChange('impact_notes', e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </Section>

              <Section title="Links">
                <Field label="Google Drive Folder Link">
                  <input
                    type="url"
                    value={form.gdrive_folder_link}
                    onChange={e => handleChange('gdrive_folder_link', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={inputClass}
                  />
                </Field>
              </Section>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
                  {error}
                </div>
              )}

              <Section title="Danger Zone">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-sm text-red-500 hover:text-red-700 underline"
                  >
                    Delete this project
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm text-red-700 mb-3 font-medium">
                      Are you sure? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="bg-red-600 text-white rounded px-3 py-1.5 text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

      </div>
    </>
  )
}