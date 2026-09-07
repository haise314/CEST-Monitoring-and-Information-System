import { useState, useEffect, useMemo } from 'react'
import { useMergedBeneficiaries } from '../../hooks/useMergedBeneficiaries'
import { useItineraries } from '../../hooks/useItineraries'
import { filterBeneficiaries, emptyBeneficiaryFilters, emptyDocFilter } from '../../lib/beneficiaryFilters'
import MapFilterBar from '../map/filterBar'
import CandidatePool from './CandidatePool'
import StopList from './StopList'

// One itinerary row = one day's trip (see chat note: the current schema has
// a single visit_date and one flat stop_order per itinerary, no
// day-grouping column — this is the shape that fits without a migration).
// A multi-day plan is just several itinerary records; this page lists them
// and lets you switch between them.
export default function ItineraryPage() {
  const { merged, documentTypesByPhase, loading: dataLoading } = useMergedBeneficiaries()
  const { data: itineraries, loading: itinLoading, addItinerary, updateItinerary, deleteItinerary, saveStops } = useItineraries()

  const [selectedId, setSelectedId] = useState('new')
  const [name, setName] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [stopIds, setStopIds] = useState([]) // ordered beneficiary ids, being edited
  const [filters, setFilters] = useState(emptyBeneficiaryFilters())
  const [docFilter, setDocFilter] = useState(emptyDocFilter())
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const selected = selectedId === 'new' ? null : itineraries.find(it => it.id === selectedId)

  // Load an existing itinerary's saved stops into the editable state when
  // switching to it.
  useEffect(() => {
    if (selected) {
      setName(selected.name)
      setVisitDate(selected.visit_date ?? '')
      setStopIds(selected.itinerary_stops.map(s => s.beneficiary_id))
    } else {
      setName('')
      setVisitDate('')
      setStopIds([])
    }
    setSaveMsg(null)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredBeneficiaries = useMemo(
    () => filterBeneficiaries(merged, filters, docFilter),
    [merged, filters, docFilter]
  )

  const stops = useMemo(
    () => stopIds.map(id => merged.find(b => b.id === id)).filter(Boolean),
    [stopIds, merged]
  )
  const anchor = stops.length > 0 ? stops[stops.length - 1] : null

  function addStop(b) {
    setStopIds(prev => (prev.includes(b.id) ? prev : [...prev, b.id]))
  }
  function removeStop(id) {
    setStopIds(prev => prev.filter(x => x !== id))
  }
  function reorderStops(nextStopObjs) {
    setStopIds(nextStopObjs.map(b => b.id))
  }

  async function handleSave() {
    if (!name.trim()) {
      setSaveMsg({ error: 'Name is required.' })
      return
    }
    setSaving(true)
    setSaveMsg(null)

    let itineraryId = selected?.id
    if (!itineraryId) {
      const { data, error } = await addItinerary({ name: name.trim(), visit_date: visitDate || null })
      if (error) {
        setSaving(false)
        setSaveMsg({ error })
        return
      }
      itineraryId = data.id
    } else if (name !== selected.name || visitDate !== (selected.visit_date ?? '')) {
      await updateItinerary(itineraryId, { name: name.trim(), visit_date: visitDate || null })
    }

    const { error } = await saveStops(itineraryId, stopIds)
    setSaving(false)
    if (error) {
      setSaveMsg({ error })
    } else {
      setSaveMsg({ ok: true })
      setSelectedId(itineraryId)
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm(`Delete itinerary "${selected.name}"? This cannot be undone.`)) return
    await deleteItinerary(selected.id)
    setSelectedId('new')
  }

  if (dataLoading || itinLoading) return <div className="p-6 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">Itinerary Planner</h1>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value === 'new' ? 'new' : Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="new">+ New itinerary</option>
          {itineraries.map(it => (
            <option key={it.id} value={it.id}>
              {it.name}{it.visit_date ? ` — ${it.visit_date}` : ''} ({it.itinerary_stops.length} stops)
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 items-end mb-3 bg-gray-50 border border-gray-200 rounded px-3 py-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Iba + Botolan compliance sweep"
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-64"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Visit date</label>
          <input
            type="date"
            value={visitDate}
            onChange={e => setVisitDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded"
        >
          {saving ? 'Saving...' : selected ? 'Save changes' : 'Create & save'}
        </button>
        {selected && (
          <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-700 underline">
            Delete this itinerary
          </button>
        )}
        {saveMsg?.error && <span className="text-xs text-red-500">{saveMsg.error}</span>}
        {saveMsg?.ok && <span className="text-xs text-green-600">Saved.</span>}
      </div>

      <MapFilterBar
        beneficiaries={merged}
        filters={filters}
        setFilters={setFilters}
        docFilter={docFilter}
        setDocFilter={setDocFilter}
        documentTypesByPhase={documentTypesByPhase}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: '65vh' }}>
        <CandidatePool
          all={filteredBeneficiaries}
          excludeIds={new Set(stopIds)}
          anchor={anchor}
          onAdd={addStop}
        />
        <div className="overflow-y-auto">
          <StopList stops={stops} onReorder={reorderStops} onRemove={removeStop} />
        </div>
      </div>
    </div>
  )
}