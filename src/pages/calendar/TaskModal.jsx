import { useState, useMemo } from 'react'
import ModalShell from '../../components/common/ModalShell'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import SearchableSelect from '../../components/common/SearchableSelect'
import Select from '../../components/common/Select'
import { RECURRENCE_OPTIONS } from '../../lib/dates'

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

// Add (task = null) or edit a task.
// projectOptions: [{ value, label }]; onSave(payload) -> { error }; onDelete(id) -> { error }
export default function TaskModal({ task, defaultDate, projectOptions, onSave, onDelete, onClose }) {
  const initial = useMemo(() => ({
    title:      task?.title ?? '',
    due_date:   task?.due_date ?? defaultDate ?? '',
    project_id: task?.project_id != null ? String(task.project_id) : '',
    recurrence: task?.recurrence ?? '',
    notes:      task?.notes ?? '',
  }), [task, defaultDate])

  const [form, setForm]       = useState(initial)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const dirty = Object.keys(initial).some(k => form[k] !== initial[k])

  async function submit() {
    if (saving) return
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.due_date)     { setError('Pick a due date.'); return }
    setSaving(true); setError(null)
    const { error } = await onSave({
      title:      form.title.trim(),
      due_date:   form.due_date,
      notes:      form.notes.trim() || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      recurrence: form.recurrence || null,
    })
    setSaving(false)
    if (error) setError(error)
    else onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await onDelete(task.id)
    setDeleting(false)
    setConfirmDelete(false)
    if (error) setError(error)
    else onClose()
  }

  const footer = (
    <div>
      {error && (
        <div role="alert" className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</div>
      )}
      <div className="flex items-center gap-2">
        {task && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-red-600 hover:text-red-800 underline mr-auto">
            Delete
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={onClose} className="border border-gray-300 bg-white rounded px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button" onClick={submit} disabled={saving}
            className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : task ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <ModalShell title={task ? 'Edit task' : 'Add task'} size="md" dirty={dirty} onClose={onClose} footer={footer}>
        <div
          className="space-y-3"
          onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit() } }}
        >
          <div>
            <label className={labelClass}>Title <span className="text-red-500">*</span></label>
            <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Submit semi-annual report" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Due date <span className="text-red-500">*</span></label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Repeat</label>
              <Select value={form.recurrence} onChange={e => set('recurrence', e.target.value)} className={inputClass}>
                <option value="">Does not repeat</option>
                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Project (optional)</label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={form.project_id}
                  onChange={v => set('project_id', v)}
                  options={projectOptions}
                  placeholder="Link to a project..."
                  searchPlaceholder="Search projects..."
                  className={inputClass}
                />
              </div>
              {form.project_id && (
                <button type="button" onClick={() => set('project_id', '')}
                  className="px-3 rounded border border-gray-300 text-sm hover:bg-gray-50">
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} className={inputClass} />
          </div>
        </div>
      </ModalShell>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this task?"
          message={task.recurrence ? 'Only this occurrence is deleted. This cannot be undone.' : 'This cannot be undone.'}
          confirmLabel="Yes, delete"
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}