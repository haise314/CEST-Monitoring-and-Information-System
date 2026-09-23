import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../../lib/Leafleticon'
import { useMergedBeneficiaries } from '../../hooks/useMergedBeneficiaries'
import { useItineraries } from '../../hooks/useItineraries'
import { filterBeneficiaries } from '../../lib/beneficiaryFilters'
import MapFilterBar, { emptyMapFilters, emptyDocFilter } from './filterBar'
import CandidatePool from '../itinerary/CandidatePool'
import StopList from '../itinerary/StopList'

// Rough center of Zambales province — used as the map's starting view.
// Individual pins (once placed) are what actually matter; this is just
// where the map opens before anything's clicked.
const ZAMBALES_CENTER = [15.5, 119.95]
const DEFAULT_ZOOM = 10

const CATEGORY_COLORS = {
  LGU:         '#3b82f6', // blue
  BLGU:        '#6366f1', // indigo
  Academe:     '#8b5cf6', // violet
  SDO:         '#a855f7', // purple
  NGO:         '#ec4899', // pink
  Cooperative: '#10b981', // green
  Others:      '#6b7280', // gray
}

// Matches filterBar.jsx's STATIC_OPTIONS.overall_status exactly. First pass
// at a categorical palette — easy to retune later, nothing depends on the
// specific hues.
const STATUS_COLORS = {
  'For Deployment':     '#f59e0b', // amber
  'For Implementation': '#3b82f6', // blue
  'For Monitoring':     '#06b6d4', // cyan
  'For Transfer':       '#8b5cf6', // violet
  'Transfer Ongoing':   '#a855f7', // purple
  'Fully Transferred':  '#14b8a6', // teal
  'For Pull Out':       '#ef4444', // red
  Done:                 '#22c55e', // green
}
// A beneficiary has one .category, but can have several .projects each with
// their own .overall_status — so "color by status" has two cases a plain
// per-category lookup doesn't: no projects yet, or projects that disagree.
const STATUS_COLOR_NONE  = '#9ca3af' // gray — no projects / no status set
const STATUS_COLOR_MIXED = '#111827' // near-black — projects with different statuses

function getBeneficiaryColor(b, colorBy) {
  if (colorBy === 'status') {
    const statuses = [...new Set(b.projects.map(p => p.overall_status).filter(Boolean))]
    if (statuses.length === 0) return STATUS_COLOR_NONE
    if (statuses.length === 1) return STATUS_COLORS[statuses[0]] ?? STATUS_COLOR_NONE
    return STATUS_COLOR_MIXED
  }
  return CATEGORY_COLORS[b.category] ?? CATEGORY_COLORS.Others
}

// Small colored-dot marker via a Leaflet divIcon — no image assets needed,
// and it can represent "dimmed" (filtered out, but still shown) as a
// distinct gray/faded state rather than just hiding the pin.
function createDotIcon(color, dimmed) {
  const size = dimmed ? 14 : 20
  const fill = dimmed ? '#d1d5db' : color
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${fill};opacity:${dimmed ? 0.6 : 1};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

const LEGEND_ENTRIES = {
  category: Object.entries(CATEGORY_COLORS),
  status: [
    ...Object.entries(STATUS_COLORS),
    ['No status yet', STATUS_COLOR_NONE],
    ['Mixed statuses', STATUS_COLOR_MIXED],
  ],
}

// Handles the "click the map to place the selected beneficiary's pin" flow.
// Must be a child of MapContainer — useMapEvents only works inside one.
function PlacementListener({ pinningId, onPlace }) {
  useMapEvents({
    click(e) {
      if (!pinningId) return
      onPlace(pinningId, e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function BeneficiaryQueueItem({ b, isPinning, onStartPinning, onCancelPinning }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded border text-sm ${
        isPinning ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="min-w-0">
        <div className="font-medium text-gray-700 truncate">{b.name}</div>
        <div className="text-xs text-gray-400 truncate">
          {[b.barangay, b.municipality].filter(Boolean).join(', ') || '—'}
          {b.projects.length > 0 && ` · ${b.projects.length} project${b.projects.length === 1 ? '' : 's'}`}
        </div>
      </div>
      {isPinning ? (
        <button
          onClick={onCancelPinning}
          className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
        >
          Cancel
        </button>
      ) : (
        <button
          onClick={() => onStartPinning(b.id)}
          className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 ml-2 whitespace-nowrap"
        >
          Place pin
        </button>
      )}
    </div>
  )
}

export default function MapPage() {
  const [searchParams] = useSearchParams()

  // `/itinerary` redirects here with ?mode=plan — see App.jsx. Only read
  // once on mount; switching tabs afterward is plain in-page state, not
  // reflected back into the URL.
  const [mode, setMode] = useState(searchParams.get('mode') === 'plan' ? 'plan' : 'overview')

  // Single shared data source for both tabs — was two separate fetches
  // (Map.jsx's own inline merge + Itinerary.jsx's useMergedBeneficiaries)
  // before this merge.
  const { merged, documentTypesByPhase, loading: dataLoading, error, setLocation, clearLocation } = useMergedBeneficiaries()
  const { data: itineraries, loading: itinLoading, addItinerary, updateItinerary, deleteItinerary, saveStops } = useItineraries()

  // ── Overview mode state ──
  const [pinningId, setPinningId] = useState(null)
  const [search, setSearch]       = useState('')
  const [saveError, setSaveError] = useState(null)
  const [filters, setFilters]     = useState(emptyMapFilters())
  const [docFilter, setDocFilter] = useState(emptyDocFilter())
  const [colorBy, setColorBy]     = useState('category')

  // ── Plan Visit mode state (unchanged from the old Itinerary.jsx) ──
  const [selectedId, setSelectedId]       = useState('new')
  const [itinName, setItinName]           = useState('')
  const [visitDate, setVisitDate]         = useState('')
  const [stopIds, setStopIds]             = useState([])
  const [itinFilters, setItinFilters]     = useState(emptyMapFilters())
  const [itinDocFilter, setItinDocFilter] = useState(emptyDocFilter())
  const [itinSaving, setItinSaving]       = useState(false)
  const [itinSaveMsg, setItinSaveMsg]     = useState(null)

  // ── Overview: filtering (now "dim", not "hide") ──
  // The unpinned "needs pinning" queue is a task list, not a spatial
  // overview — it still hides non-matches like before. The map itself
  // shows every pinned beneficiary always; matches vs. non-matches are a
  // visual (color/opacity) distinction instead.
  const filteredForQueue = useMemo(
    () => filterBeneficiaries(merged, filters, docFilter),
    [merged, filters, docFilter]
  )
  const matchedIds = useMemo(() => new Set(filteredForQueue.map(b => b.id)), [filteredForQueue])
  const hasActiveOverviewFilter =
    Object.values(filters).some(v => v !== '') || (docFilter.documentTypeId !== '' && docFilter.conditionId !== '')

  const allPinned   = useMemo(() => merged.filter(b => b.latitude != null && b.longitude != null), [merged])
  const allUnpinned = useMemo(() => merged.filter(b => b.latitude == null || b.longitude == null), [merged])
  const unpinnedQueue = useMemo(
    () => filteredForQueue.filter(b => b.latitude == null || b.longitude == null),
    [filteredForQueue]
  )
  const filteredUnpinned = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return unpinnedQueue
    return unpinnedQueue.filter(b =>
      [b.name, b.municipality, b.barangay].filter(Boolean).some(f => f.toLowerCase().includes(q))
    )
  }, [unpinnedQueue, search])

  async function handlePlace(beneficiaryId, lat, lng) {
    setSaveError(null)
    const { error } = await setLocation(beneficiaryId, lat, lng)
    if (error) setSaveError(error)
    else setPinningId(null)
  }

  async function handleClear(beneficiaryId) {
    setSaveError(null)
    const { error } = await clearLocation(beneficiaryId)
    if (error) setSaveError(error)
  }

  const pinningBeneficiary = merged.find(b => b.id === pinningId)

  // ── Plan Visit: same logic as the old Itinerary.jsx, verbatim ──
  const selectedItinerary = selectedId === 'new' ? null : itineraries.find(it => it.id === selectedId)

  useState // (no-op placeholder removed below; kept hooks order stable)

  const filteredForPlan = useMemo(
    () => filterBeneficiaries(merged, itinFilters, itinDocFilter),
    [merged, itinFilters, itinDocFilter]
  )
  const stops = useMemo(
    () => stopIds.map(id => merged.find(b => b.id === id)).filter(Boolean),
    [stopIds, merged]
  )
  const anchor = stops.length > 0 ? stops[stops.length - 1] : null

  function loadItinerary(id) {
    setSelectedId(id)
    if (id === 'new') {
      setItinName('')
      setVisitDate('')
      setStopIds([])
    } else {
      const it = itineraries.find(i => i.id === id)
      if (!it) return
      setItinName(it.name)
      setVisitDate(it.visit_date ?? '')
      setStopIds(it.itinerary_stops.map(s => s.beneficiary_id))
    }
    setItinSaveMsg(null)
  }

  function addStop(b) {
    setStopIds(prev => (prev.includes(b.id) ? prev : [...prev, b.id]))
  }
  function removeStop(id) {
    setStopIds(prev => prev.filter(x => x !== id))
  }
  function reorderStops(nextStopObjs) {
    setStopIds(nextStopObjs.map(b => b.id))
  }

  async function handleItinSave() {
    if (!itinName.trim()) {
      setItinSaveMsg({ error: 'Name is required.' })
      return
    }
    setItinSaving(true)
    setItinSaveMsg(null)

    let itineraryId = selectedItinerary?.id
    if (!itineraryId) {
      const { data, error } = await addItinerary({ name: itinName.trim(), visit_date: visitDate || null })
      if (error) {
        setItinSaving(false)
        setItinSaveMsg({ error })
        return
      }
      itineraryId = data.id
    } else if (itinName !== selectedItinerary.name || visitDate !== (selectedItinerary.visit_date ?? '')) {
      await updateItinerary(itineraryId, { name: itinName.trim(), visit_date: visitDate || null })
    }

    const { error } = await saveStops(itineraryId, stopIds)
    setItinSaving(false)
    if (error) {
      setItinSaveMsg({ error })
    } else {
      setItinSaveMsg({ ok: true })
      setSelectedId(itineraryId)
    }
  }

  async function handleItinDelete() {
    if (!selectedItinerary) return
    if (!confirm(`Delete itinerary "${selectedItinerary.name}"? This cannot be undone.`)) return
    await deleteItinerary(selectedItinerary.id)
    loadItinerary('new')
  }

  if (dataLoading) return <div className="p-6 text-gray-500">Loading map...</div>
  if (error)        return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">Map</h1>
        <div className="flex border border-gray-300 rounded overflow-hidden text-sm">
          <button
            onClick={() => setMode('overview')}
            className={`px-3 py-1.5 ${mode === 'overview' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setMode('plan')}
            className={`px-3 py-1.5 border-l border-gray-300 ${mode === 'plan' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Plan Visit
          </button>
        </div>
      </div>

      {mode === 'overview' ? (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-sm text-gray-400">
              {merged.length} beneficiaries · {allPinned.length} pinned · {allUnpinned.length} unpinned
              {hasActiveOverviewFilter && ` · ${matchedIds.size} match filters`}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Color by</span>
              <select
                value={colorBy}
                onChange={e => setColorBy(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="category">Category</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <MapFilterBar
            beneficiaries={merged}
            filters={filters}
            setFilters={setFilters}
            docFilter={docFilter}
            setDocFilter={setDocFilter}
            documentTypesByPhase={documentTypesByPhase}
          />

          {pinningBeneficiary && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-800 flex items-center justify-between">
              <span>
                📍 Click the map to place a pin for <strong>{pinningBeneficiary.name}</strong>
              </span>
              <button
                onClick={() => setPinningId(null)}
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-3"
              >
                Cancel
              </button>
            </div>
          )}

          {saveError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-600">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* Map */}
            <div>
              <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '70vh' }}>
                <MapContainer
                  center={ZAMBALES_CENTER}
                  zoom={DEFAULT_ZOOM}
                  style={{ height: '100%', width: '100%', cursor: pinningId ? 'crosshair' : '' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <PlacementListener pinningId={pinningId} onPlace={handlePlace} />

                  {allPinned.map(b => {
                    const isMatch = !hasActiveOverviewFilter || matchedIds.has(b.id)
                    const icon = createDotIcon(getBeneficiaryColor(b, colorBy), !isMatch)
                    return (
                      <Marker key={b.id} position={[b.latitude, b.longitude]} icon={icon}>
                        <Popup>
                          <div className="text-sm" style={{ maxWidth: 220 }}>
                            <div className="font-semibold text-gray-800">{b.name}</div>
                            <div className="text-xs text-gray-500 mb-1">
                              {[b.barangay, b.municipality].filter(Boolean).join(', ') || '—'}
                            </div>
                            <div className="text-xs text-gray-400 mb-2">{b.category}</div>

                            {b.projects.length === 0 ? (
                              <p className="text-xs text-gray-400 italic mb-2">No projects yet.</p>
                            ) : (
                              <ul className="text-xs space-y-1 mb-2" style={{ maxHeight: 128, overflowY: 'auto' }}>
                                {b.projects.map(p => (
                                  <li key={p.id}>
                                    <Link to={`/projects/${p.id}`} className="text-blue-500 hover:text-blue-700 underline">
                                      {p.title || `${p.year} project`}
                                    </Link>
                                    <span className="text-gray-400">
                                      {' '}· {p.year}{p.overall_status ? ` · ${p.overall_status}` : ''}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => setPinningId(b.id)}
                                className="text-xs text-blue-500 hover:text-blue-700 underline"
                              >
                                Reposition
                              </button>
                              <button
                                onClick={() => handleClear(b.id)}
                                className="text-xs text-red-500 hover:text-red-700 underline"
                              >
                                Remove pin
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  })}
                </MapContainer>
              </div>

              {/* Legend for the active color-by dimension */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
                {LEGEND_ENTRIES[colorBy].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span
                      className="inline-block rounded-full flex-shrink-0"
                      style={{ width: 10, height: 10, background: color }}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar: unpinned queue */}
            <div className="flex flex-col" style={{ height: '70vh' }}>
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Search unpinned beneficiaries..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Needs Pinning ({filteredUnpinned.length})
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredUnpinned.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">
                    {unpinnedQueue.length === 0 ? 'All matching beneficiaries are pinned.' : 'No matches.'}
                  </p>
                ) : (
                  filteredUnpinned.map(b => (
                    <BeneficiaryQueueItem
                      key={b.id}
                      b={b}
                      isPinning={pinningId === b.id}
                      onStartPinning={setPinningId}
                      onCancelPinning={() => setPinningId(null)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              {itinLoading ? 'Loading itineraries...' : `${itineraries.length} saved`}
            </span>
            <select
              value={selectedId}
              onChange={e => loadItinerary(e.target.value === 'new' ? 'new' : Number(e.target.value))}
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
                value={itinName}
                onChange={e => setItinName(e.target.value)}
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
              onClick={handleItinSave}
              disabled={itinSaving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded"
            >
              {itinSaving ? 'Saving...' : selectedItinerary ? 'Save changes' : 'Create & save'}
            </button>
            {selectedItinerary && (
              <button onClick={handleItinDelete} className="text-xs text-red-500 hover:text-red-700 underline">
                Delete this itinerary
              </button>
            )}
            {itinSaveMsg?.error && <span className="text-xs text-red-500">{itinSaveMsg.error}</span>}
            {itinSaveMsg?.ok && <span className="text-xs text-green-600">Saved.</span>}
          </div>

          <MapFilterBar
            beneficiaries={merged}
            filters={itinFilters}
            setFilters={setItinFilters}
            docFilter={itinDocFilter}
            setDocFilter={setItinDocFilter}
            documentTypesByPhase={documentTypesByPhase}
          />

          <div className="grid grid-cols-1 lg:grid-ls-2 gap-4" style={{ height: '65vh' }}>
            <CandidatePool
              all={filteredForPlan}
              excludeIds={new Set(stopIds)}
              anchor={anchor}
              onAdd={addStop}
            />
            <div className="overflow-y-auto">
              <StopList stops={stops} onReorder={reorderStops} onRemove={removeStop} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
