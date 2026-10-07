import { useState } from 'react'
import { useProjectTypes } from '../../hooks/useProjectTypes'
import { useProjectTypeIcons } from '../../hooks/useProjectTypeIcons'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import ProjectTypeIconEditor from './ProjectTypeIconsEditor'

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function TypeRow({ t, icon, onSaveIcon, isAdmin, onRename, onDelete }) {
  const [editing, setEditing]       = useState(false)
  const [name, setName]             = useState(t.name)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy]             = useState(false)
  const [err, setErr]               = useState(null)

  async function save() {
    if (name.trim() === t.name) { setEditing(false); return }
    setBusy(true); setErr(null)
    const { error } = await onRename(t.id, name)
    setBusy(false)
    if (error) setErr(error)
    else setEditing(false)
  }

  async function remove() {
    setBusy(true); setErr(null)
    const { error } = await onDelete(t.id)
    setBusy(false)
    if (error) { setErr(error); setConfirming(false) }
  }

  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      {editing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(t.name); setEditing(false) } }}
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
            <div className="text-xs text-gray-400">{t.usage} project{t.usage === 1 ? '' : 's'}</div>
          </div>
          {isAdmin && !confirming && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-700 underline">Rename</button>
              <button
                onClick={() => setConfirming(true)}
                disabled={t.usage > 0}
                title={t.usage > 0 ? 'In use — reassign its projects before deleting' : 'Delete'}
                className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Map pin icon (admin only). Falls back to an empty icon while the
          icon hook is still loading or if its query failed. */}
      {isAdmin && !editing && (
        <div className="mt-2 pl-0.5">
          <ProjectTypeIconEditor
            type={icon ?? { id: t.id, name: t.name, icon_svg: null }}
            onSave={onSaveIcon}
          />
        </div>
      )}

      {confirming && (
        <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <span className="text-xs text-red-700">Delete "{t.name}"? This can't be undone.</span>
          <button onClick={remove} disabled={busy} className="text-xs bg-red-600 text-white rounded px-2 py-1 hover:bg-red-700 disabled:opacity-50 ml-auto">
            {busy ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">Cancel</button>
        </div>
      )}
      {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
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
  const [newName, setNewName] = useState('')
  const [adding, setAdding]   = useState(false)
  const [addError, setAddError] = useState(null)

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
    setAdding(true); setAddError(null)
    const { error } = await wrap(addType, 'Project type added')(newName)
    setAdding(false)
    if (error) setAddError(error)
    else setNewName('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Project types</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-2 -m-2">✕</button>
        </div>

        {isAdmin && (
          <p className="text-xs text-gray-400 mb-3">
            Map icons: upload a single-shape silhouette SVG (no background shape). It is drawn in the pin's color.
          </p>
        )}

        {isAdmin && iconError && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3">
            Icons unavailable: {iconError}. If this mentions <code>icon_svg</code>, run the icon migration in Supabase.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <div className="mb-4">
            {types.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No project types yet.</p>}
            {types.map(t => (
              <TypeRow
                key={t.id}
                t={t}
                icon={iconById[t.id]}
                onSaveIcon={handleSaveIcon}
                isAdmin={isAdmin}
                onRename={wrap(renameType, 'Project type renamed')}
                onDelete={wrap(deleteType, 'Project type deleted')}
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
          {addError && <p className="text-red-500 text-xs mt-1">{addError}</p>}
        </div>

        <div className="flex justify-end pt-4">
          <button onClick={onClose} className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  )
}