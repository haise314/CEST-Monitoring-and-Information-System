import { useState } from 'react'
import { useAgencies } from '../../hooks/useAgencies'
import { useProjectParties } from '../../hooks/useProjectParties'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import SearchableSelect from '../../components/common/SearchableSelect'
import Select from '../../components/common/Select'
import { AGENCY_TYPES } from '../../lib/projectAgencies'

const BENEFICIARY_CATEGORIES = ['LGU', 'Academe', 'SDO', 'NGO', 'Cooperative', 'Others', 'BLGU']

const pickerClass = 'w-full border border-gray-300 rounded px-2 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const inputClass  = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

const benLabel = b => `${b.name}${b.municipality ? ` (${b.municipality})` : ''}`
const agencyLabel = a => (a.type ? `${a.name} (${a.type})` : a.name)

function SubHeading({ children }) {
  return (
    <div className="text-xs font-semibold text-gray-600 mt-5 first:mt-0 mb-2">{children}</div>
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

function Card({ title, children }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-3">
      {title && <div className="text-xs font-medium text-gray-500">{title}</div>}
      {children}
    </div>
  )
}

// One agency, same layout as the beneficiary form. Saves the shared agency row.
function AgencyCard({ title, agency, canEdit, onSave, onRemove, removeLabel }) {
  const [name, setName] = useState(agency.name)
  const [type, setType] = useState(agency.type ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState(null)
  const changed = name.trim() !== agency.name || type.trim() !== (agency.type ?? '')

  async function save() {
    setBusy(true); setErr(null)
    const { error } = await onSave(agency.id, { name, type })
    setBusy(false)
    if (error) setErr(error)
  }

  return (
    <Card title={title}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name">
          <input type="text" value={name} readOnly={!canEdit} onChange={e => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Type">
          <input type="text" list="pp-agency-types" value={type} readOnly={!canEdit} onChange={e => setType(e.target.value)} className={inputClass} />
        </Field>
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" onClick={save} disabled={!changed || busy || !name.trim()}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save agency'}
          </button>
          <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 underline">
            {removeLabel}
          </button>
          <span className="text-xs text-gray-400">Saving updates this agency everywhere it's used.</span>
        </div>
      )}
    </Card>
  )
}

// One ADDITIONAL beneficiary, same fields as the primary beneficiary form.
function BeneficiaryCard({ b, canEdit, onSave, onRemove }) {
  const initial = {
    name: b.name ?? '', category: b.category ?? '', district: b.district ?? '',
    municipality: b.municipality ?? '', barangay: b.barangay ?? '',
  }
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState(null)
  const changed = Object.keys(initial).some(k => form[k] !== initial[k])
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function save() {
    if (!form.name.trim() || !form.category) { setErr('Name and Category are required.'); return }
    setBusy(true); setErr(null)
    const { error } = await onSave(b.id, {
      name: form.name.trim(), category: form.category,
      district: form.district || null, municipality: form.municipality || null, barangay: form.barangay || null,
    })
    setBusy(false)
    if (error) setErr(error)
  }

  return (
    <Card title="Additional beneficiary">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input type="text" value={form.name} readOnly={!canEdit} onChange={e => set('name', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Category">
          <Select value={form.category} disabled={!canEdit} onChange={e => set('category', e.target.value)} className={inputClass}>
            <option value="">—</option>
            {BENEFICIARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="District">
          <input type="text" value={form.district} readOnly={!canEdit} onChange={e => set('district', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Municipality">
          <input type="text" value={form.municipality} readOnly={!canEdit} onChange={e => set('municipality', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Barangay">
          <input type="text" value={form.barangay} readOnly={!canEdit} onChange={e => set('barangay', e.target.value)} className={inputClass} />
        </Field>
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" onClick={save} disabled={!changed || busy}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save Beneficiary Info'}
          </button>
          <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 underline">
            Remove from this project
          </button>
          <span className="text-xs text-gray-400">Saving updates this beneficiary everywhere it's referenced.</span>
        </div>
      )}
    </Card>
  )
}

// Full-page "Agencies & Beneficiaries" body: implementing agency, cooperating
// agencies and beneficiaries, each in the same card/form layout.
// `children` = the primary beneficiary form (owned by ProjectDetail, which
// also handles its unsaved-changes guard and "change beneficiary").
// updateBeneficiary(id, payload) -> { error } comes from useBeneficiaries.
export default function ProjectParties({ project, beneficiaries, updateBeneficiary, children }) {
  const { canEdit } = useAuth()
  const toast = useToast()
  const { agencies, addAgency, updateAgency } = useAgencies()
  const {
    agencyLinks, extraBeneficiaries, loading, error, refetch,
    setImplementing, addCooperating, removeAgencyLink, addBeneficiary, removeBeneficiary,
  } = useProjectParties(project.id)

  const [msg, setMsg]           = useState(null)
  const [creating, setCreating] = useState(null) // 'implementing' | 'cooperating' | null
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('')
  const [busy, setBusy]         = useState(false)

  const ia  = agencyLinks.find(l => l.role === 'implementing') ?? null
  const cas = agencyLinks.filter(l => l.role === 'cooperating')
  const caIds = new Set(cas.map(l => l.agency.id))

  const iaOptions = agencies.filter(a => a.id !== ia?.agency.id).map(a => ({ value: a.id, label: agencyLabel(a) }))
  const caOptions = agencies
    .filter(a => !caIds.has(a.id) && a.id !== ia?.agency.id)
    .map(a => ({ value: a.id, label: agencyLabel(a) }))

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

  async function saveAgency(id, patch) {
    const r = await updateAgency(id, patch)
    if (!r.error) { await refetch(); toast.success('Agency updated') }
    return r
  }

  async function saveBeneficiary(id, payload) {
    const r = await updateBeneficiary(id, payload)
    if (!r.error) { await refetch(); toast.success('Beneficiary updated') }
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

  const agencyErr = error && (
    <p className="text-xs text-red-500">
      {error} <span className="text-gray-500">(Has migration 06_agencies.sql been run?)</span>
    </p>
  )

  return (
    <div>
      <datalist id="pp-agency-types">{AGENCY_TYPES.map(t => <option key={t} value={t} />)}</datalist>

      {/* ── Implementing agency ── */}
      <SubHeading>Implementing agency</SubHeading>
      {loading ? (
        <p className="text-xs text-gray-500">Loading...</p>
      ) : error ? agencyErr : (
        <div className="space-y-2">
          {ia ? (
            <AgencyCard
              key={ia.linkId}
              title="Implementing agency"
              agency={ia.agency}
              canEdit={canEdit}
              onSave={saveAgency}
              removeLabel="Clear"
              onRemove={() => act(() => setImplementing(null), 'Implementing agency cleared')}
            />
          ) : (
            <p className="text-xs text-amber-600">No implementing agency set yet.</p>
          )}
          {canEdit && (
            <SearchableSelect
              value=""
              onChange={v => act(() => setImplementing(Number(v)), 'Implementing agency saved')}
              options={iaOptions}
              placeholder={ia ? 'Replace with another agency...' : 'Select implementing agency...'}
              searchPlaceholder="Search agencies..."
              footerAction={footer('implementing')}
              className={pickerClass}
            />
          )}
        </div>
      )}

      {/* ── Cooperating agencies ── */}
      <SubHeading>Cooperating agencies</SubHeading>
      {loading ? null : error ? agencyErr : (
        <div className="space-y-2">
          {cas.length === 0 && <p className="text-xs text-gray-500">None yet.</p>}
          {cas.map(l => (
            <AgencyCard
              key={l.linkId}
              title="Cooperating agency"
              agency={l.agency}
              canEdit={canEdit}
              onSave={saveAgency}
              removeLabel="Remove from this project"
              onRemove={() => act(() => removeAgencyLink(l.linkId))}
            />
          ))}
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
      )}

      {/* Inline "add new agency" */}
      {creating && (
        <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs text-gray-500">
            New agency — will be set as the {creating === 'implementing' ? 'Implementing' : 'Cooperating'} agency.
          </p>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Agency name *" className={inputClass} />
          <input list="pp-agency-types" value={newType} onChange={e => setNewType(e.target.value)} placeholder="Type (SUC, LGU, NGA...)" className={inputClass} />
          <div className="flex gap-2">
            <button
              type="button" onClick={handleCreate} disabled={busy || !newName.trim()}
              className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Adding...' : 'Add agency'}
            </button>
            <button
              type="button" onClick={() => { setCreating(null); setNewName(''); setNewType('') }}
              className="border border-gray-300 bg-white rounded px-3 py-1.5 text-xs hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Beneficiaries ── */}
      <SubHeading>Beneficiaries</SubHeading>
      <div className="space-y-3">
        <Card title="Primary beneficiary">{children}</Card>

        {!loading && !error && extraBeneficiaries.map(b => (
          <BeneficiaryCard
            key={b.linkId}
            b={b}
            canEdit={canEdit}
            onSave={saveBeneficiary}
            onRemove={() => act(() => removeBeneficiary(b.linkId))}
          />
        ))}

        {canEdit && !loading && !error && (
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

      {msg && <p className="text-red-500 text-xs mt-3">{msg}</p>}
    </div>
  )
}