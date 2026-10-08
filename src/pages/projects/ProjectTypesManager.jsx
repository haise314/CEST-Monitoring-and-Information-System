import { useState } from 'react'
import { useProjectTypes } from '../../hooks/useProjectTypes'
import { useProjectTypeIcons } from '../../hooks/useProjectTypeIcons'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import ModalShell from '../../components/common/ModalShell'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ProjectTypeIconEditor from './ProjectTypeIconsEditor'

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

function TypeRow({ t, icon, onSaveIcon, isAdmin, onRename, onAskDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(t.name)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState(null)

  async function save() {
    if (name.trim() === t.name) { setEditing(false); return }
    setBusy(true); setErr(null)
    const { error } = await onRename(t.id, name)
    setBusy(false)
    if (error) setErr(error)
    else setEditing(false)
  }

  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      {editing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') { e.stopPropagation(); setName(t.name); setEditing(false) }
            }}
            className={inputClass}
          />
          <button onClick={save} disabled={busy} className="px-3 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
            {busy ? '...' : 'Save'}
          </button>
          <button onClick={() => { setName(t.name); setEditing(false); setErr(null) }} className="px-3 rounded border border-gray-300 text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-gray-800 break-words">{t.name}</div>
            <div className="text-xs text-gray-600">{t.usage} project{t.usage === 1 ? '' : 's'}</div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 underline">Rename</button>
              <button
                onClick={() => onAskDelete(t)}
                disabled={t.usage > 0}
                title={t.usage > 0 ? 'In use — reassign its projects before deleting' : 'Delete'}
                className="text-xs text-red-600 hover:text-red-800 underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Map pin icon (admin only). */}
      {isAdmin && !editing && (
        <div className="mt-2 pl-0.5">
          <ProjectTypeIconEditor
            type={icon ?? { id: t.id, name: t.name, icon_svg: null }}
            onSave={onSaveIcon}
          />
        </div>
      )}

      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  )
}

// Modal list of project types. `onChanged` fires after any successful change
// so the page's own dropdown (a separate hook instance) can refresh.
export default function ProjectTypesManager({ onClose, onChanged }) {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const { types, loading, error, addType, renameType, deleteType } = useProjectTypes()
  const { types: iconTypes, saveIcon, error: iconError } = useProjectTypeIcons()
  const [newName, setNewName]   = useState('')
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState(null)

  const [toDelete, setToDelete]       = useState(null) // a type | null
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const iconById = Object.fromEntries(iconTypes.map(i => [i.id, i]))

  const wrap = (fn, msg) => async (...args) => {
    const result = await fn(...args)
    if (!result.error) { onChanged?.(); toast.success(msg) }
    return result
  }

  async function handleSaveIcon(id, svg) {
    const result = await saveIcon(id, svg)
    if (!result.error) toast.success(svg ? 'Icon saved' : 'Icon removed')
    return result
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true); setAddError(null)
    const { error } = await wrap(addType, 'Project type added')(newName)
    setAdding(false)
    if (error) setAddError(error)
    else setNewName('')
  }

  async function confirmDelete() {
    setDeleting(true); setDeleteError(null)
    const { error } = await wrap(deleteType, 'Project type deleted')(toDelete.id)
    setDeleting(false)
    setToDelete(null)
    if (error) setDeleteError(error)
  }

  const footer = (
    <div className="flex justify-end">
      <button onClick={onClose} className="border border-gray-300 bg-white rounded px-4 py-2 text-sm hover:bg-gray-50">Close</button>
    </div>
  )

  return (
    <>
      <ModalShell title="Project types" onClose={onClose} footer={footer} size="md" dirty={newName.trim() !== ''}>
        {isAdmin && (
          <p className="text-xs text-gray-600 mb-3">
            Map icons: upload a single-shape silhouette SVG (no background shape). It is drawn in the pin's color.
          </p>
        )}

        {isAdmin && iconError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3">
            Icons unavailable: {iconError}. If this mentions <code>icon_svg</code>, run the icon migration in Supabase.
          </p>
        )}

        {deleteError && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3">
            {deleteError}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-600 py-4 text-center">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="mb-4">
            {types.length === 0 && <p className="text-sm text-gray-600 py-4 text-center">No project types yet.</p>}
            {types.map(t => (
              <TypeRow
                key={t.id}
                t={t}
                icon={iconById[t.id]}
                onSaveIcon={handleSaveIcon}
                isAdmin={isAdmin}
                onRename={wrap(renameType, 'Project type renamed')}
                onAskDelete={setToDelete}
              />
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="New project type name..."
              className={inputClass}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="px-3 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {adding ? '...' : '+ Add'}
            </button>
          </div>
          {addError && <p className="text-red-600 text-xs mt-1">{addError}</p>}
        </div>
      </ModalShell>

      {toDelete && (
        <ConfirmDialog
          title="Delete this project type?"
          message={`"${toDelete.name}" will be deleted. This can't be undone.`}
          confirmLabel="Yes, delete"
          busy={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}