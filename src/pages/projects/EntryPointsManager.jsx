import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEntryPoints } from '../../hooks/useEntryPoints'
import { useToast } from '../../lib/ToastContext'
import ModalShell from '../../components/common/ModalShell'
import ConfirmDialog from '../../components/common/ConfirmDialog'

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

// Rename / delete the entry-point values used across all projects.
// Rendered through a portal so it can be opened from inside the Edit modal
// without being clipped, and it swallows its own Esc so the modal underneath
// doesn't also close. `onChanged` fires after any successful change so the
// caller can refresh its project data and dropdown options.
export default function EntryPointsManager({ onClose, onChanged }) {
  const toast = useToast()
  const { entries, loading, error, renameEntryPoint, removeEntryPoint } = useEntryPoints()

  const [editing, setEditing]   = useState(null) // the value being renamed | null
  const [draft, setDraft]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState(null)
  const [toDelete, setToDelete] = useState(null) // { value, count } | null
  const [deleting, setDeleting] = useState(false)

  // Esc: cancel the rename first, otherwise close. Capture phase + stopPropagation
  // keeps it from reaching a modal underneath. A ConfirmDialog handles its own Esc.
  const latest = useRef({})
  latest.current = { editing, toDelete, onClose }
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape' || latest.current.toDelete) return
      e.stopPropagation()
      if (latest.current.editing != null) { setEditing(null); setErr(null) }
      else latest.current.onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  function startEdit(value) { setEditing(value); setDraft(value); setErr(null) }

  async function saveRename() {
    setBusy(true); setErr(null)
    const { error } = await renameEntryPoint(editing, draft)
    setBusy(false)
    if (error) { setErr(error); return }
    setEditing(null)
    onChanged?.()
    toast.success('Entry point renamed')
  }

  async function confirmDelete() {
    setDeleting(true); setErr(null)
    const { error } = await removeEntryPoint(toDelete.value)
    setDeleting(false)
    setToDelete(null)
    if (error) { setErr(error); return }
    onChanged?.()
    toast.success('Entry point deleted')
  }

  const clash = editing != null && entries.some(
    x => x.value !== editing && x.value.toLowerCase() === draft.trim().toLowerCase()
  )

  const footer = (
    <div className="flex justify-end">
      <button onClick={onClose} className="border border-gray-300 bg-white rounded px-4 py-2 text-sm hover:bg-gray-50">Close</button>
    </div>
  )

  return createPortal(
    <>
      <ModalShell title="Entry points" subtitle="Changes apply to every project that uses the entry point." onClose={onClose} footer={footer} size="md">
        {err && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3">{err}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-600 py-4 text-center">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-600 py-4 text-center">No entry points in use yet.</p>
        ) : (
          entries.map(e => (
            <div key={e.value} className="py-2.5 border-b border-gray-100 last:border-0">
              {editing === e.value ? (
                <div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={draft}
                      onChange={ev => setDraft(ev.target.value)}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveRename() }}
                      className={inputClass}
                    />
                    <button onClick={saveRename} disabled={busy || !draft.trim()} className="px-3 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                      {busy ? '...' : 'Save'}
                    </button>
                    <button onClick={() => { setEditing(null); setErr(null) }} className="px-3 rounded border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
                  </div>
                  {clash && <p className="text-xs text-amber-600 mt-1">That name already exists, so these projects will be merged into it.</p>}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 break-words">{e.value}</div>
                    <div className="text-xs text-gray-600">{e.count} project{e.count === 1 ? '' : 's'}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => startEdit(e.value)} className="text-xs text-blue-600 hover:text-blue-800 underline">Rename</button>
                    <button onClick={() => setToDelete(e)} className="text-xs text-red-600 hover:text-red-800 underline">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </ModalShell>

      {toDelete && (
        <ConfirmDialog
          title="Delete this entry point?"
          message={`"${toDelete.value}" will be cleared from ${toDelete.count} project${toDelete.count === 1 ? '' : 's'}. The projects themselves are not deleted.`}
          confirmLabel="Yes, delete"
          busy={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>,
    document.body
  )
}