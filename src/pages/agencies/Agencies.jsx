import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAgencies } from '../../hooks/useAgencies'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { AGENCY_TYPES } from '../../lib/projectAgencies'

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

function TypeInput({ value, onChange }) {
  return (
    <>
      <input list="agency-type-options" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Type (SUC, LGU, NGA...)" className={inputClass} />
      <datalist id="agency-type-options">{AGENCY_TYPES.map(t => <option key={t} value={t} />)}</datalist>
    </>
  )
}

function Row({ a, canEdit, isAdmin, onSave, onAskDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(a.name)
  const [type, setType] = useState(a.type ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState(null)

  async function save() {
    setBusy(true); setErr(null)
    const { error } = await onSave(a.id, { name, type })
    setBusy(false)
    if (error) setErr(error)
    else setEditing(false)
  }

  function cancel() { setName(a.name); setType(a.type ?? ''); setEditing(false); setErr(null) }

  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-0">
      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              className={inputClass} />
            <TypeInput value={type} onChange={setType} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
              {busy ? '...' : 'Save'}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-gray-800 break-words">{a.name}</div>
            <div className="text-xs text-gray-500">
              {[a.type, `Implementing on ${a.implementing}`, `Cooperating on ${a.cooperating}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {canEdit && <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 underline">Edit</button>}
            {isAdmin && (
              <button
                onClick={() => onAskDelete(a)}
                disabled={a.usage > 0}
                title={a.usage > 0 ? 'In use — remove it from its projects first' : 'Delete'}
                className="text-xs text-red-600 hover:text-red-800 underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  )
}

export default function Agencies() {
  const { canEdit, isAdmin } = useAuth()
  const toast = useToast()
  const { agencies, loading, error, addAgency, updateAgency, deleteAgency } = useAgencies()

  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [adding, setAdding]   = useState(false)
  const [addError, setAddError] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return agencies
    return agencies.filter(a => [a.name, a.type].filter(Boolean).some(f => f.toLowerCase().includes(q)))
  }, [agencies, search])

  async function handleAdd() {
    setAdding(true); setAddError(null)
    const { error } = await addAgency({ name: newName, type: newType })
    setAdding(false)
    if (error) setAddError(error)
    else { setNewName(''); setNewType(''); toast.success('Agency added') }
  }

  async function handleSave(id, patch) {
    const r = await updateAgency(id, patch)
    if (!r.error) toast.success('Agency updated')
    return r
  }

  async function confirmDelete() {
    setDeleting(true); setDeleteError(null)
    const { error } = await deleteAgency(toDelete.id)
    setDeleting(false)
    setToDelete(null)
    if (error) setDeleteError(error)
    else toast.success('Agency deleted')
  }

  if (loading) return <div className="p-6 text-gray-500">Loading agencies...</div>
  if (error) {
    return (
      <div className="p-6 text-red-500 text-sm">
        Error: {error}
        <div className="text-gray-500 mt-1">If this is the first time, run migrations/06_agencies.sql in Supabase.</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">
          Agencies
          <span className="ml-2 text-sm font-normal text-gray-400">{shown.length} of {agencies.length}</span>
        </h1>
        <input
          type="text" placeholder="Search name or type..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Institutions that implement or cooperate on projects. Assign them on each project's page.
      </p>

      {deleteError && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3">{deleteError}</p>
      )}

      {canEdit && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="New agency name..." className={inputClass} />
            <TypeInput value={newType} onChange={setNewType} />
            <button onClick={handleAdd} disabled={adding || !newName.trim()}
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
              {adding ? '...' : '+ Add'}
            </button>
          </div>
          {addError && <p className="text-red-600 text-xs mt-2">{addError}</p>}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {shown.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            {agencies.length === 0 ? 'No agencies yet.' : 'No matches.'}
          </p>
        ) : (
          shown.map(a => (
            <Row key={a.id} a={a} canEdit={canEdit} isAdmin={isAdmin} onSave={handleSave} onAskDelete={setToDelete} />
          ))
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete this agency?"
          message={`"${toDelete.name}" will be deleted. This can't be undone.`}
          confirmLabel="Yes, delete"
          busy={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}