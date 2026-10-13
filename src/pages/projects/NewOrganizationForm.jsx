import { useState } from 'react'
import Select from '../../components/common/Select'

const CATEGORIES = ['LGU', 'BLGU', 'SUC', 'NGA', 'SDO', 'Academe', 'NGO', 'Cooperative', 'Private', 'Others']
const EMPTY = { name: '', category: '', district: '', municipality: '', barangay: '' }
const inputClass = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

// Inline "create a new organization" mini-form.
// onCreate(form) -> { error }   (the parent decides what happens next)
export default function NewOrganizationForm({ onCreate, onCancel, submitLabel = 'Create organization' }) {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState(null)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function submit() {
    if (!form.name.trim() || !form.category) { setErr('Name and Category are required.'); return }
    setBusy(true); setErr(null)
    const { error } = await onCreate(form)
    setBusy(false)
    if (error) setErr(error)
  }

  const onKey = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit() } }

  return (
    <div onKeyDown={onKey} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <p className="text-xs text-gray-500">New organization — it becomes available everywhere in the app.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input autoFocus value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="Name *" className={`${inputClass} sm:col-span-2`} />
        <Select value={form.category} onChange={e => set('category', e.target.value)} className={inputClass}>
          <option value="">Category *</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <input value={form.district} onChange={e => set('district', e.target.value)} placeholder="District (optional)" className={inputClass} />
        <input value={form.municipality} onChange={e => set('municipality', e.target.value)} placeholder="Municipality (optional)" className={inputClass} />
        <input value={form.barangay} onChange={e => set('barangay', e.target.value)} placeholder="Barangay (optional)" className={inputClass} />
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy}
          className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Creating...' : submitLabel}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 bg-white rounded px-3 py-1.5 text-xs hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
