import { useState } from 'react'
import { useAgencies } from '../../hooks/useAgencies'
import { useProjectParties } from '../../hooks/useProjectParties'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import SearchableSelect from '../../components/common/SearchableSelect'
import { AGENCY_TYPES } from '../../lib/projectAgencies'

const pickerClass = 'w-full border border-gray-300 rounded px-2 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const inputClass  = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

const benLabel = b => `${b.name}${b.municipality ? ` (${b.municipality})` : ''}`

function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 text-blue-800 text-xs pl-2.5 pr-1.5 py-1 max-w-full">
      <span className="truncate">{children}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-blue-600 hover:text-blue-900 px-1">✕</button>
      )}
    </span>
  )
}

function Label({ children }) {
  return <label className="block text-xs text-gray-500 mb-1">{children}</label>
}

// Implementing agency (one), cooperating agencies (many) and additional
// beneficiaries (many) of a project. Every change saves immediately.
// `beneficiaries` = full beneficiary list (ProjectDetail already has it).
export default function ProjectParties({ project, beneficiaries }) {
  const { canEdit } = useAuth()
  const toast = useToast()
  const { agencies, addAgency } = useAgencies()
  const {
    agencyLinks, extraBeneficiaries, loading, error,
    setImplementing, addCooperating, removeAgencyLink, addBeneficiary, removeBeneficiary,
  } = useProjectParties(project.id)

  const [msg, setMsg]         = useState(null)
  const [creating, setCreating] = useState(null) // 'implementing' | 'cooperating' | null
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [busy, setBusy]       = useState(false)

  const ia   = agencyLinks.find(l => l.role === 'implementing') ?? null
  const cas  = agencyLinks.filter(l => l.role === 'cooperating')
  const caIds = new Set(cas.map(l => l.agency.id))

  const iaOptions = agencies.map(a => ({ value: a.id, label: a.type ? `${a.name} (${a.type})` : a.name }))
  const caOptions = agencies
    .filter(a => !caIds.has(a.id) && a.id !== ia?.agency.id)
    .map(a => ({ value: a.id, label: a.type ? `${a.name} (${a.type})` : a.name }))

  const extraIds = new Set(extraBeneficiaries.map(b => b.id))
  const benOptions = beneficiaries
    .filter(b => b.id !== project.beneficiary_id && !extraIds.has(b.id))
    .map(b => ({ value: b.id, label: benLabel(b) }))

  async function act(fn, okMsg) {
    setMsg(null)
    const r = await fn()
    if (r.error) setMsg(r.error)
    else if (okMsg) toast.success(okMsg)
    return r
  }

  async function handleCreate() {
    setBusy(true); setMsg(null)
    const { data, error } = await addAgency({ name: newName, type: newType })
    if (error) { setBusy(false); setMsg(error); return }
    const r = creating === 'implementing' ? await setImplementing(data.id) : await addCooperating(data.id)
    setBusy(false)
    if (r.error) { setMsg(r.error); return }
    toast.success('Agency added')
    setCreating(null); setNewName(''); setNewType('')
  }

  const footer = canEdit ? (kind => ({
    label: '+ Add new agency...',
    onClick: () => { setCreating(kind); setMsg(null) },
  })) : null

  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
        Agencies &amp; beneficiaries
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-xs text-red-500">
          {error} <span className="text-gray-500">(Has migration 06_agencies.sql been run?)</span>
        </p>
      ) : (
        <div className="space-y-4">
          {/* Implementing agency */}
          <div>
            <Label>Implementing Agency</Label>
            {!ia && <p className="text-xs text-amber-600 mb-1">No implementing agency set yet.</p>}
            {canEdit ? (
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={ia ? String(ia.agency.id) : ''}
                    onChange={v => act(() => setImplementing(Number(v)), 'Implementing agency saved')}
                    options={iaOptions}
                    placeholder="Select implementing agency..."
                    searchPlaceholder="Search agencies..."
                    footerAction={footer('implementing')}
                    className={pickerClass}
                  />
                </div>
                {ia && (
                  <button
                    onClick={() => act(() => setImplementing(null), 'Implementing agency cleared')}
                    className="text-xs text-red-400 hover:text-red-600 py-2 flex-shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-700">{ia ? ia.agency.name : '—'}</p>
            )}
          </div>

          {/* Cooperating agencies */}
          <div>
            <Label>Cooperating Agencies</Label>
            {cas.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {cas.map(l => (
                  <Chip key={l.linkId} onRemove={canEdit ? () => act(() => removeAgencyLink(l.linkId)) : null}>
                    {l.agency.name}
                  </Chip>
                ))}
              </div>
            ) : !canEdit && <p className="text-sm text-gray-700">—</p>}
            {canEdit && (
              <SearchableSelect
                value=""
                onChange={v => act(() => addCooperating(Number(v)), 'Cooperating agency added')}
                options={caOptions}
                placeholder="+ Add cooperating agency..."
                searchPlaceholder="Search agencies..."
                emptyText="No more agencies"
                footerAction={footer('cooperating')}
                className={pickerClass}
              />
            )}
          </div>

          {/* Inline "add new agency" */}
          {creating && (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-xs text-gray-500">
                New agency — will be set as the {creating === 'implementing' ? 'Implementing' : 'Cooperating'} agency.
              </p>
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Agency name *" className={inputClass} />
              <input list="agency-types" value={newType} onChange={e => setNewType(e.target.value)} placeholder="Type (SUC, LGU, NGA...)" className={inputClass} />
              <datalist id="agency-types">{AGENCY_TYPES.map(t => <option key={t} value={t} />)}</datalist>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={busy || !newName.trim()}
                  className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                  {busy ? 'Adding...' : 'Add agency'}
                </button>
                <button onClick={() => { setCreating(null); setNewName(''); setNewType('') }}
                  className="border border-gray-300 bg-white rounded px-3 py-1.5 text-xs hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Additional beneficiaries */}
          <div>
            <Label>Additional beneficiaries</Label>
            <p className="text-xs text-gray-400 mb-2">
              Primary beneficiary: {project.beneficiaries?.name ?? '—'} (edit it in the Beneficiary section).
            </p>
            {extraBeneficiaries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {extraBeneficiaries.map(b => (
                  <Chip key={b.linkId} onRemove={canEdit ? () => act(() => removeBeneficiary(b.linkId)) : null}>
                    {benLabel(b)}
                  </Chip>
                ))}
              </div>
            ) : !canEdit && <p className="text-sm text-gray-700">—</p>}
            {canEdit && (
              <SearchableSelect
                value=""
                onChange={v => act(() => addBeneficiary(Number(v)), 'Beneficiary added')}
                options={benOptions}
                placeholder="+ Add another beneficiary..."
                searchPlaceholder="Search beneficiaries..."
                emptyText="No more beneficiaries"
                className={pickerClass}
              />
            )}
          </div>

          {msg && <p className="text-red-500 text-xs">{msg}</p>}
        </div>
      )}
    </div>
  )
}