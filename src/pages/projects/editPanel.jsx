import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router'
import { useFormData } from '../../hooks/useFormData'
import { STATIC_OPTIONS, parseAmount } from './columns'
import DocumentChecklist from './DocumentChecklist'
import ProjectContacts from './ProjectContacts'

const MIN_WIDTH = 420
const MAX_WIDTH = 1100
const DEFAULT_WIDTH = 512 // matches the old max-w-lg
const STORAGE_KEY = 'editPanelWidth'

function useResizablePanel() {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH
  })
  const dragging = useRef(false)

  const startDrag = useCallback(e => {
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }, [])

  useEffect(() => {
    function handleMove(e) {
      if (!dragging.current) return
      // Panel is anchored to the right edge, so width = distance from
      // the cursor to the right side of the viewport.
      const next = window.innerWidth - e.clientX
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)))
    }
    function handleUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  function resetWidth() {
    setWidth(DEFAULT_WIDTH)
  }

  return { width, startDrag, resetWidth }
}

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

export default function EditPanel({ project, onClose, onUpdate, onDelete, onDocumentsChanged }) {
  const { projectTypes, entryPoints, loading } = useFormData()
  const [form, setForm]                   = useState({})
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCategoryWarning, setShowCategoryWarning] = useState(false)
  const [error, setError]                 = useState(null)
  const { width, startDrag, resetWidth }  = useResizablePanel()

  // Inline "add new entry point" — same pattern as addModal.jsx.
  const [addingEntryPoint, setAddingEntryPoint]     = useState(false)
  const [newEntryPointValue, setNewEntryPointValue] = useState('')

  // Track the original category to detect changes
  const originalCategory = useRef(null)

  useEffect(() => {
    if (!project) return
    const initial = {
      year:                project.year                ?? '',
      title:               project.title               ?? '',
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
    }
    setForm(initial)
    originalCategory.current = project.project_category ?? ''
    setError(null)
    setConfirmDelete(false)
    setShowCategoryWarning(false)
  }, [project])

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleAddEntryPoint() {
    const trimmed = newEntryPointValue.trim()
    if (!trimmed) return
    handleChange('entry_point', trimmed)
    setAddingEntryPoint(false)
    setNewEntryPointValue('')
  }

  // Same reasoning as addModal.jsx: guarantee the current value is always
  // a selectable option, even if it's a value just typed via "+ Add new"
  // that isn't (yet) in the fetched distinct list.
  const entryPointOptions = form.entry_point && !entryPoints.includes(form.entry_point)
    ? [...entryPoints, form.entry_point].sort()
    : entryPoints

  async function handleSave() {
    // Category changed and project already has documents — warn first
    if (
      form.project_category !== originalCategory.current &&
      originalCategory.current !== '' &&
      !showCategoryWarning
    ) {
      setShowCategoryWarning(true)
      return
    }

    setSaving(true)
    setError(null)
    setShowCategoryWarning(false)

    const payload = {
      year:                Number(form.year),
      title:               form.title                     || null,
      project_type_id:     form.project_type_id !== ''     ? Number(form.project_type_id)     : null,
      project_category:    form.project_category           || null,
      property_number:     form.property_number            || null,
      amount:              parseAmount(form.amount),
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
    else {
      // Update the ref so re-opening the panel doesn't re-trigger the warning
      originalCategory.current = form.project_category ?? ''
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await onDelete(project.id)
    setDeleting(false)
    if (error) setError(error)
    else onClose()
  }

  if (!project) return null

  // Merge saved project with current form category for the checklist
  // so it reflects the saved state, not the unsaved form state
  const savedProject = {
    ...project,
    project_category: project.project_category,
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div
        className="fixed right-0 top-0 z-50 h-full w-full bg-white shadow-xl flex flex-col"
        style={{ maxWidth: width }}
      >
        {/* Drag handle — full-height strip on the left edge */}
        <div
          onMouseDown={startDrag}
          onDoubleClick={resetWidth}
          title="Drag to resize · double-click to reset"
          className="absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize group z-10"
        >
          <div className="h-full w-full group-hover:bg-blue-400 transition-colors" />
        </div>

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

                <Field label="Title">
                  <textarea
                    rows={2}
                    value={form.title}
                    onChange={e => handleChange('title', e.target.value)}
                    placeholder="e.g. Portasol Unit for Barangay X Farmers Association"
                    className={inputClass}
                  />
                </Field>

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
                      type="text"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={e => handleChange('amount', e.target.value)}
                      placeholder="e.g. 285,000"
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
                  {addingEntryPoint ? (
                    <div>
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
                    </div>
                  ) : (
                    <select
                      value={form.entry_point}
                      onChange={e => {
                        if (e.target.value === '__new_entry__') setAddingEntryPoint(true)
                        else handleChange('entry_point', e.target.value)
                      }}
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {entryPointOptions.map(ep => (
                        <option key={ep} value={ep}>{ep}</option>
                      ))}
                      <option value="__new_entry__">+ Add new entry point...</option>
                    </select>
                  )}
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
                {project.beneficiary_id && (
                  <Link
                    to={`/beneficiaries?edit=${project.beneficiary_id}`}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    View / edit this beneficiary's info →
                  </Link>
                )}
                <p className="text-xs text-gray-400">
                  A project's beneficiary is fixed at creation and isn't reassigned here.
                </p>
              </Section>

              {/* Contacts — linked from this beneficiary's existing contacts.
                  Editing a contact's info elsewhere reflects here automatically,
                  since this only stores a link (contact_id), never a copy. */}
              <Section title="Contacts">
                <ProjectContacts project={project} />
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

              {/* Document Checklist — uses saved project data, not form state */}
              <Section title="Document Checklist">
                {!project.project_category ? (
                  <p className="text-xs text-gray-400">
                    Save a Project Category first to generate the document checklist.
                  </p>
                ) : (
                  <DocumentChecklist project={savedProject} onChanged={onDocumentsChanged} />
                )}
              </Section>

              {/* Error */}
              {error && (
                <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
                  {error}
                </div>
              )}

              {/* Category change warning */}
              {showCategoryWarning && (
                <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-4">
                  <p className="text-sm text-yellow-800 font-medium mb-1">
                    Project category changed
                  </p>
                  <p className="text-xs text-yellow-700 mb-3">
                    Changing from <strong>{originalCategory.current}</strong> to{' '}
                    <strong>{form.project_category}</strong>. New required documents will be
                    added to the checklist. Existing documents will not be removed — please
                    review and mark any that no longer apply as N/A.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="bg-yellow-600 text-white rounded px-3 py-1.5 text-xs hover:bg-yellow-700"
                    >
                      Confirm & Save
                    </button>
                    <button
                      onClick={() => setShowCategoryWarning(false)}
                      className="border border-gray-300 rounded px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
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