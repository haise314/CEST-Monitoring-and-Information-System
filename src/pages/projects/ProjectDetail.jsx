import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router'
import { useProjects } from '../../hooks/useProjects'
import { useBeneficiaries } from '../../hooks/useBeneficiaries'
import { useFormData } from '../../hooks/useFormData'
import Select from '../../components/common/Select'
import { STATIC_OPTIONS, SCOPE_OPTIONS, parseAmount } from './columns'
import DocumentChecklist from './DocumentChecklist'
import ProjectContacts from './ProjectContacts'
import RemarksSection from './RemarksSection'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'

// Not in columns.jsx's STATIC_OPTIONS (that file only covers project-level
// enums) — sourced from the beneficiary_category enum in the live DB dump.
const BENEFICIARY_CATEGORIES = ['LGU', 'Academe', 'SDO', 'NGO', 'Cooperative', 'Others', 'BLGU']

// `locked` disables every input/select/button inside (native <fieldset
// disabled>) — used to make the form read-only for viewers.
function Section({ title, locked = false, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
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

const inputClass  = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const selectClass = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// Field-by-field snapshots of what the server has, used both to fill the
// forms and to tell whether they've been edited (unsaved-changes guard).
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

function benFormFromProject(project) {
  return {
    name:         project.beneficiaries.name         ?? '',
    category:     project.beneficiaries.category     ?? '',
    district:     project.beneficiaries.district     ?? '',
    municipality: project.beneficiaries.municipality ?? '',
    barangay:     project.beneficiaries.barangay     ?? '',
  }
}

// Compared as strings: inputs hand back strings, the DB hands back numbers.
function isChanged(current, baseline) {
  return Object.keys(baseline).some(k => String(current[k] ?? '') !== String(baseline[k] ?? ''))
}

export default function ProjectDetail() {
  const { canEdit, isAdmin } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const { projects, loading, updateProject, deleteProject } = useProjects()
  const { updateBeneficiary } = useBeneficiaries()
  const { projectTypes, entryPoints, loading: formDataLoading } = useFormData()

  // Same "derive from the live list" pattern as Projects.jsx/Overview.jsx —
  // never a stale snapshot after a refetch.
  const project = projects.find(p => p.id === Number(id)) ?? null

  // ── Project Info / Status / Impact / Links form state ──
  const [form, setForm]                   = useState({})
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [showCategoryWarning, setShowCategoryWarning] = useState(false)
  const originalCategory = useRef(null)

  const [addingEntryPoint, setAddingEntryPoint]     = useState(false)
  const [newEntryPointValue, setNewEntryPointValue] = useState('')

  // ── Beneficiary form state (separate save, separate table) ──
  const [benForm, setBenForm]     = useState({})
  const [benSaving, setBenSaving] = useState(false)
  const [benError, setBenError]   = useState(null)
  // After a successful beneficiary save the page's project data is stale (it
  // isn't refetched, so unsaved project edits aren't clobbered). This holds
  // the just-saved values so the form isn't wrongly flagged as unsaved.
  const [benBaseline, setBenBaseline] = useState(null)

  // ── Danger zone ──
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!project) return
    setForm(formFromProject(project))
    originalCategory.current = project.project_category ?? ''
    setError(null)
    setShowCategoryWarning(false)
    setConfirmDelete(false)
  }, [project])

  useEffect(() => {
    if (!project?.beneficiaries) return
    setBenForm(benFormFromProject(project))
    setBenBaseline(null)
    setBenError(null)
    // beneficiary_id is stable per project, so this only re-runs if the
    // underlying beneficiary row's data actually changes (e.g. after save).
  }, [project?.beneficiaries])

  // ── Unsaved-changes guard ──
  const initialForm = useMemo(() => (project ? formFromProject(project) : null), [project])
  const initialBen  = useMemo(
    () => benBaseline ?? (project?.beneficiaries ? benFormFromProject(project) : null),
    [project, benBaseline]
  )
  const formDirty = Boolean(initialForm) && Object.keys(form).length > 0 && isChanged(form, initialForm)
  const benDirty  = Boolean(initialBen) && Object.keys(benForm).length > 0 && isChanged(benForm, initialBen)
  const dirty = formDirty || benDirty

  const leaveOk = useRef(false) // set right before an intentional navigation (delete)
  const blocker = useBlocker(() => dirty && !leaveOk.current)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  function handleChange(key, value)    { setForm(prev => ({ ...prev, [key]: value })) }
  function handleBenChange(key, value) { setBenForm(prev => ({ ...prev, [key]: value })) }

  function handleAddEntryPoint() {
    const trimmed = newEntryPointValue.trim()
    if (!trimmed) return
    handleChange('entry_point', trimmed)
    setAddingEntryPoint(false)
    setNewEntryPointValue('')
  }

  const entryPointOptions = form.entry_point && !entryPoints.includes(form.entry_point)
    ? [...entryPoints, form.entry_point].sort()
    : entryPoints

  async function handleSave() {
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

    const { error } = await updateProject(project.id, payload)
    setSaving(false)
    if (error) setError(error)
    else {
      originalCategory.current = form.project_category ?? ''
      toast.success('Project saved')
    }
  }

  // Beneficiary rows are shared across every project under that
  // beneficiary (§8 — coordinates/location live on beneficiaries, not
  // project_instances) — saving here updates that beneficiary everywhere
  // it's referenced, not just on this project. Surfaced as a note in the UI.
  async function handleBenSave() {
    if (!project.beneficiary_id) return
    setBenSaving(true)
    setBenError(null)
    const { error } = await updateBeneficiary(project.beneficiary_id, {
      name:         benForm.name         || null,
      category:     benForm.category     || null,
      district:     benForm.district     || null,
      municipality: benForm.municipality || null,
      barangay:     benForm.barangay     || null,
    })
    setBenSaving(false)
    if (error) setBenError(error)
    else {
      setBenBaseline({ ...benForm })
      toast.success('Beneficiary updated')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await deleteProject(project.id)
    setDeleting(false)
    if (error) setError(error)
    else {
      leaveOk.current = true
      toast.success('Project deleted')
      navigate('/projects')
    }
  }

  // Only block the page on the very first load — a refetch after saving must
  // not unmount the whole page (and its checklist/remarks) behind a spinner.
  if ((loading && !project) || formDataLoading) {
    return <div className="p-6 text-gray-500 text-sm">Loading project...</div>
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-gray-500 text-sm mb-3">Project not found.</p>
        <button onClick={() => navigate('/projects')} className="text-blue-500 hover:text-blue-700 underline text-sm">
          ← Back to Projects
        </button>
      </div>
    )
  }

  // Same as editPanel — pass the saved (not unsaved-form) category to the checklist
  const savedProject = { ...project, project_category: project.project_category }

  return (
    <div className="max-w-6xl mx-auto pb-12">

      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-600 mb-2">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-800">
          {project.beneficiaries?.name ?? '—'}
          <span className="ml-2 text-sm font-normal text-gray-400">· {project.year}</span>
        </h1>
      </div>

      {/* Main two-column layout: primary editable details on the left
          (wider — this is meant to be the "close look" at the project),
          lighter-weight status/impact/links/contacts info as a right rail.
          Stacks to a single column below the lg breakpoint. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-6">
      <div className="lg:col-span-2 space-y-6">
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
          <p className="text-xs text-gray-400 mt-1">Only Provincial projects count against the yearly budget.</p>
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

        <Field label="Intervention">
          <textarea
            rows={2}
            value={form.intervention}
            onChange={e => handleChange('intervention', e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      {/* Beneficiary — now genuinely editable in place. Note this edits the
          beneficiary row itself, which is shared by every project under it —
          not a per-project copy. Reassigning a project to a *different*
          beneficiary is still not supported here (that's a separate,
          bigger change from "edit this beneficiary's info"). */}
      <Section title="Beneficiary" locked={!canEdit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input
              type="text"
              value={benForm.name ?? ''}
              onChange={e => handleBenChange('name', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Category">
            <Select
              value={benForm.category ?? ''}
              onChange={e => handleBenChange('category', e.target.value)}
              className={selectClass}
            >
              <option value="">—</option>
              {BENEFICIARY_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="District">
            <input
              type="text"
              value={benForm.district ?? ''}
              onChange={e => handleBenChange('district', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Municipality">
            <input
              type="text"
              value={benForm.municipality ?? ''}
              onChange={e => handleBenChange('municipality', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Barangay">
            <input
              type="text"
              value={benForm.barangay ?? ''}
              onChange={e => handleBenChange('barangay', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {benError && (
          <div className="text-red-500 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">
            {benError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleBenSave}
            disabled={benSaving || !project.beneficiary_id}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {benSaving ? 'Saving...' : 'Save Beneficiary Info'}
          </button>
          <p className="text-xs text-gray-400">
            Updates this beneficiary everywhere it's referenced, including other projects.
          </p>
        </div>
      </Section>
      </div>

      {/* Right rail — lighter-weight status/impact/links/contacts info,
          stacks below the left column under lg. */}
      <div className="lg:col-span-1 space-y-6">
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
        <Field label="Impact Notes / Accomplishments">
          <textarea
            rows={3}
            value={form.impact_notes}
            onChange={e => handleChange('impact_notes', e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Links" locked={!canEdit}>
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

      <Section title="Contacts">
        <ProjectContacts project={project} />
      </Section>
      </div>
      </div>

      <Section title="Document Checklist">
        {!project.project_category ? (
          <p className="text-xs text-gray-400">
            Save a Project Category first to generate the document checklist.
          </p>
        ) : (
          <DocumentChecklist project={savedProject} />
        )}
      </Section>

      <Section title="Remarks">
        <RemarksSection projectId={project.id} />
      </Section>

      {error && (
        <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          {error}
        </div>
      )}

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

      {isAdmin && (
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
      )}

      {/* Save bar — sticks to the bottom of the viewport so Save is always in
          reach on this long page, and says whether anything is unsaved. */}
      {canEdit && (
<div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 py-3 flex items-center gap-2">
        <span className={`text-xs mr-auto ${dirty ? 'text-amber-600' : 'text-gray-400'}`}>
          {formDirty
            ? 'You have unsaved project changes.'
            : benDirty
              ? 'Unsaved beneficiary changes. Use "Save Beneficiary Info".'
              : 'All changes saved.'}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white rounded px-6 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
      )}

      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-1">Discard unsaved changes?</h2>
            <p className="text-sm text-gray-500 mb-4">
              You've edited this project but haven't saved. Leaving now will lose those edits.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => blocker.reset()}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Keep editing
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="bg-red-600 text-white rounded px-3 py-1.5 text-sm hover:bg-red-700"
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}