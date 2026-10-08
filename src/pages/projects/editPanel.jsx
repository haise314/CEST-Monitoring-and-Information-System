import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFormData } from '../../hooks/useFormData'
import Select from '../../components/common/Select'
import ModalShell from '../../components/common/ModalShell'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { STATIC_OPTIONS, SCOPE_OPTIONS, parseAmount } from './columns'
import DocumentChecklist from './DocumentChecklist'
import ProjectContacts from './ProjectContacts'
import ProjectParties from './ProjectParties'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'

// `locked` disables every input/select/button inside (native <fieldset
// disabled>) — used to make the form read-only for viewers.
function Section({ title, locked = false, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
        {title}
      </div>
      <fieldset disabled={locked} className="space-y-3 min-w-0">{children}</fieldset>
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

const inputClass  = 'w-full border border-gray-300 rounded px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const selectClass = inputClass

function formFromProject(project) {
  return {
    year:                project.year                ?? '',
    title:               project.title               ?? '',
    project_type_id:     project.project_type_id     ?? '',
    project_category:    project.project_category    ?? '',
    project_scope:       project.project_scope       ?? 'Provincial',
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
}

// Compared as strings: inputs hand back strings, the DB hands back numbers.
function isChanged(current, baseline) {
  return Object.keys(baseline).some(k => String(current[k] ?? '') !== String(baseline[k] ?? ''))
}

// Quick-edit modal for one project (used by Projects and Documents).
// Centered on desktop, bottom sheet on phones (ModalShell).
// Ctrl/Cmd+S saves. Closing or leaving with unsaved edits asks first.
export default function EditPanel({ project, onClose, onUpdate, onDelete, onDocumentsChanged }) {
  const { canEdit, isAdmin } = useAuth()
  const { projectTypes, beneficiaries, entryPoints, loading } = useFormData()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm]                   = useState({})
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [error, setError]                 = useState(null)

  // Dialogs
  const [confirmDelete, setConfirmDelete]             = useState(false)
  const [showCategoryWarning, setShowCategoryWarning] = useState(false)
  const [confirmLeave, setConfirmLeave]               = useState(null) // null | 'close' | 'open'

  // Inline "add new entry point" — same pattern as addModal.jsx.
  const [addingEntryPoint, setAddingEntryPoint]     = useState(false)
  const [newEntryPointValue, setNewEntryPointValue] = useState('')

  // Track the original category to detect changes
  const originalCategory = useRef(null)

  useEffect(() => {
    if (!project) return
    setForm(formFromProject(project))
    originalCategory.current = project.project_category ?? ''
    setError(null)
    setConfirmDelete(false)
    setShowCategoryWarning(false)
  }, [project])

  const initial = useMemo(() => (project ? formFromProject(project) : null), [project])
  const dirty = canEdit && Boolean(initial) && Object.keys(form).length > 0 && isChanged(form, initial)

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

  // Guarantee the current value is always a selectable option, even a value
  // just typed via "+ Add new" that isn't (yet) in the fetched distinct list.
  const entryPointOptions = form.entry_point && !entryPoints.includes(form.entry_point)
    ? [...entryPoints, form.entry_point].sort()
    : entryPoints

  async function handleSave(confirmedCategoryChange = false) {
    if (!canEdit || saving) return

    // Category changed and project already had one — confirm first
    if (
      form.project_category !== originalCategory.current &&
      originalCategory.current !== '' &&
      !confirmedCategoryChange
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
      project_scope:       form.project_scope              || 'Provincial',
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
      originalCategory.current = form.project_category ?? ''
      toast.success('Project saved')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await onDelete(project.id)
    setDeleting(false)
    setConfirmDelete(false)
    if (error) setError(error)
    else {
      toast.success('Project deleted')
      onClose()
    }
  }

  // Ctrl/Cmd+S saves (always calls the latest handleSave).
  const saveRef = useRef(null)
  saveRef.current = () => { if (dirty && !saving) handleSave() }
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function requestClose() {
    if (dirty) setConfirmLeave('close')
    else onClose()
  }

  function handleOpenFullPage(e) {
    if (dirty) {
      e.preventDefault()
      setConfirmLeave('open')
    }
  }

  function confirmLeaveNow() {
    const action = confirmLeave
    setConfirmLeave(null)
    onClose()
    if (action === 'open') navigate(`/projects/${project.id}`)
  }

  if (!project) return null

  // Checklist uses saved project data, not unsaved form state
  const savedProject = { ...project, project_category: project.project_category }

  const footer = (
    <div>
      {error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          to={`/projects/${project.id}`}
          onClick={handleOpenFullPage}
          title="Open this project's full page"
          className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap py-1"
        >
          Open full page ↗
        </Link>

        <span className={`text-xs hidden sm:inline ${dirty ? 'text-amber-600' : 'text-gray-500'}`}>
          {canEdit ? (dirty ? 'Unsaved changes · Ctrl+S to save' : 'All changes saved') : ''}
        </span>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={requestClose}
            className="border border-gray-300 bg-white rounded px-4 py-2 text-sm hover:bg-gray-50"
          >
            {canEdit ? 'Cancel' : 'Close'}
          </button>
          {canEdit && (
            <button
              onClick={() => handleSave()}
              disabled={saving || !dirty}
              className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <ModalShell
        title="Edit Project"
        subtitle={`${project.beneficiaries?.name ?? '—'} · ${project.year}`}
        size="lg"
        dirty={dirty}
        onClose={onClose}
        footer={footer}
      >
        {loading ? (
          <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
        ) : (
          <>
            <Section title="Project Info" locked={!canEdit}>
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
                  <Select
                    value={form.project_type_id}
                    onChange={e => handleChange('project_type_id', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {projectTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Project Category">
                  <Select
                    value={form.project_category}
                    onChange={e => handleChange('project_category', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {STATIC_OPTIONS.project_category.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Project Scope">
                  <Select
                    value={form.project_scope}
                    onChange={e => handleChange('project_scope', e.target.value)}
                    className={selectClass}
                  >
                    {SCOPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-gray-500 -mt-1">Only Provincial projects count against the yearly budget.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Property Number">
                  <input
                    type="text"
                    value={form.property_number}
                    onChange={e => handleChange('property_number', e.target.value)}
                    className={inputClass}
                  />
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date Deployed">
                  <input
                    type="date"
                    value={form.date_deployed}
                    onChange={e => handleChange('date_deployed', e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Entry Point">
                  {addingEntryPoint ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={newEntryPointValue}
                        onChange={e => setNewEntryPointValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddEntryPoint()
                          if (e.key === 'Escape') { e.stopPropagation(); setAddingEntryPoint(false); setNewEntryPointValue('') }
                        }}
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
                    </Select>
                  )}
                </Field>
              </div>

              <Field label="Intervention">
                <textarea
                  rows={2}
                  value={form.intervention}
                  onChange={e => handleChange('intervention', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </Section>

            <Section title="Beneficiary" locked={!canEdit}>
              <div className="bg-gray-50 rounded px-3 py-2.5 text-sm">
                <div className="font-medium text-gray-700">
                  {project.beneficiaries?.name ?? '—'}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
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
              <p className="text-xs text-gray-500">
                To change a project's beneficiary, use the full page.
              </p>
            </Section>

            <ProjectParties project={project} beneficiaries={beneficiaries} />

            {/* Contacts — linked from this beneficiary's existing contacts. */}
            <Section title="Contacts">
              <ProjectContacts project={project} />
            </Section>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Section title="Status" locked={!canEdit}>
                <Field label="Overall Status">
                  <Select
                    value={form.overall_status}
                    onChange={e => handleChange('overall_status', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {STATIC_OPTIONS.overall_status.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Operational Status">
                  <Select
                    value={form.operational_status}
                    onChange={e => handleChange('operational_status', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {STATIC_OPTIONS.operational_status.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </Section>

              <Section title="Impact" locked={!canEdit}>
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
              </Section>
            </div>

            <Section title="Impact Notes & Links" locked={!canEdit}>
              <Field label="Impact Notes / Accomplishments">
                <textarea
                  rows={3}
                  value={form.impact_notes}
                  onChange={e => handleChange('impact_notes', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Google Drive Folder Link">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.gdrive_folder_link}
                    onChange={e => handleChange('gdrive_folder_link', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={inputClass}
                  />
                  {form.gdrive_folder_link && (
                    <a
                      href={form.gdrive_folder_link}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 rounded border border-gray-300 text-sm hover:bg-gray-50 whitespace-nowrap flex items-center"
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </Field>
            </Section>

            {/* Document Checklist — uses saved project data, not form state */}
            <Section title="Document Checklist">
              {!project.project_category ? (
                <p className="text-xs text-gray-500">
                  Save a Project Category first to generate the document checklist.
                </p>
              ) : (
                <DocumentChecklist project={savedProject} onChanged={onDocumentsChanged} />
              )}
            </Section>

            {isAdmin && (
              <Section title="Danger Zone">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-600 hover:text-red-800 underline"
                >
                  Delete this project
                </button>
              </Section>
            )}
          </>
        )}
      </ModalShell>

      {showCategoryWarning && (
        <ConfirmDialog
          tone="primary"
          title="Project category changed"
          message={`Changing from ${originalCategory.current} to ${form.project_category || '(none)'}. New required documents will be added to the checklist. Existing documents are not removed, so review and mark any that no longer apply as N/A.`}
          confirmLabel="Confirm & save"
          busy={saving}
          onCancel={() => setShowCategoryWarning(false)}
          onConfirm={() => handleSave(true)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this project?"
          message="Its documents, remarks and contact links will be deleted too. This cannot be undone."
          confirmLabel="Yes, delete"
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="You've edited this project but haven't saved. Leaving now will lose those edits."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmLeave(null)}
          onConfirm={confirmLeaveNow}
        />
      )}
    </>
  )
}