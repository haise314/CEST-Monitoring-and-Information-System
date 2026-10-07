import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css' // spiderfy/zoom animations only
import '../../lib/Leafleticon'
import { useMapSites, siteLabel } from '../../hooks/useMapSites'
import { useItineraries } from '../../hooks/useItineraries'
import { useProjectTypeIcons } from '../../hooks/useProjectTypeIcons'
import { useAuth } from '../../lib/AuthContext'
import FilterChips from '../../components/common/FilterChips'
import { applyFilters, isEmptyValue } from '../../lib/filterEngine'
import { useSessionState } from '../../hooks/useSessionState'
import { buildMapFilterFields } from './mapFilterFields'
import { makeIconFactory, typeIdsFor, clusterIcon } from './pinIcons'
import IconLegend from './IconLegend'
import CandidatePool from '../itinerary/CandidatePool'
import StopList from '../itinerary/StopList'

// Rough center of Zambales province — used as the map's starting view.
const ZAMBALES_CENTER = [15.5, 119.95]
const DEFAULT_ZOOM = 10

// Pins are one per PROJECT. They only merge into a cluster when they are
// practically touching: a pin is ~30px tall, so 25px means "overlapping".
// Zoom in and they separate; pins on the exact same spot fan out on click.
const CLUSTER_RADIUS_PX = 25

const CATEGORY_COLORS = {
  LGU:         '#3b82f6', // blue
  BLGU:        '#6366f1', // indigo
  Academe:     '#8b5cf6', // violet
  SDO:         '#a855f7', // purple
  NGO:         '#ec4899', // pink
  Cooperative: '#10b981', // green
  Others:      '#6b7280', // gray
}

// Matches mapFilterFields.jsx's OVERALL_STATUS_OPTIONS exactly.
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
const STATUS_COLOR_NONE  = '#9ca3af' // gray — no status set
const STATUS_COLOR_MIXED = '#111827' // kept for legend compatibility (a pin is one project now)
const DIMMED_COLOR       = '#9ca3af'

function getSiteColor(b, colorBy) {
  if (colorBy === 'status') {
    const status = b.projects[0]?.overall_status
    return status ? (STATUS_COLORS[status] ?? STATUS_COLOR_NONE) : STATUS_COLOR_NONE
  }
  return CATEGORY_COLORS[b.category] ?? CATEGORY_COLORS.Others
}

const LEGEND_ENTRIES = {
  category: Object.entries(CATEGORY_COLORS),
  status: [
    ...Object.entries(STATUS_COLORS),
    ['No status yet', STATUS_COLOR_NONE],
  ],
}

// Handles the "click the map to place the selected project's pin" flow.
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

// One project pin + its popup. Used for both matching (clustered) and
// dimmed (unclustered) pins.
function SiteMarker({ b, icon, onReposition, onRemove }) {
  const p = b.projects[0]
  return (
    <Marker position={[b.latitude, b.longitude]} icon={icon}>
      <Popup>
        <div className="text-sm" style={{ maxWidth: 220 }}>
          <div className="font-semibold text-gray-800">{b.name}</div>
          <div className="text-xs text-gray-500 mb-1">
            {[b.barangay, b.municipality].filter(Boolean).join(', ') || '—'}
          </div>
          <div className="text-xs text-gray-400 mb-2">{b.category}</div>

          <div className="text-xs mb-2">
            <Link to={`/projects/${p.id}`} className="text-blue-500 hover:text-blue-700 underline">
              {siteLabel(b)}
            </Link>
            <span className="text-gray-400">
              {' '}· {p.project_types?.name ?? 'No type'} · {p.year}{p.overall_status ? ` · ${p.overall_status}` : ''}
            </span>
          </div>

          <div className="flex gap-2">
            <button onClick={onReposition} className="text-xs text-blue-500 hover:text-blue-700 underline">
              Reposition
            </button>
            <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 underline">
              Remove pin
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

function SiteQueueItem({ b, isPinning, onStartPinning, onCancelPinning }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded border text-sm ${
        isPinning ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="min-w-0">
        <div className="font-medium text-gray-700 truncate">{b.name}</div>
        <div className="text-xs text-gray-500 truncate">{siteLabel(b)}</div>
        <div className="text-xs text-gray-400 truncate">
          {[b.barangay, b.municipality].filter(Boolean).join(', ') || '—'}
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
  const { isAdmin } = useAuth()

  // `/itinerary` redirects here with ?mode=plan — see App.jsx.
  const [mode, setMode] = useState(searchParams.get('mode') === 'plan' ? 'plan' : 'overview')

  // `merged` = one entry per project ("site"); id is the project id.
  const { sites: merged, documentTypesByPhase, loading: dataLoading, error, setLocation, clearLocation } = useMapSites()
  const { data: itineraries, loading: itinLoading, addItinerary, updateItinerary, deleteItinerary, saveStops } = useItineraries()

  const { iconsById, types: iconTypes, error: iconError } = useProjectTypeIcons()
  const iconFor = useMemo(() => makeIconFactory(iconsById), [iconsById])

  const mapFields = useMemo(() => buildMapFilterFields(documentTypesByPhase), [documentTypesByPhase])

  // ── Overview mode state ──
  const [pinningId, setPinningId] = useState(null)
  const [search, setSearch]       = useState('')
  const [saveError, setSaveError] = useState(null)
  const [filters, setFilters]     = useSessionState('mapOverviewFilters', [])
  const [colorBy, setColorBy]     = useState('category')

  // ── Plan Visit mode state ──
  const [selectedId, setSelectedId]       = useState('new')
  const [itinName, setItinName]           = useState('')
  const [visitDate, setVisitDate]         = useState('')
  const [stopIds, setStopIds]             = useState([]) // project ids, in order
  const [itinFilters, setItinFilters]     = useSessionState('mapPlanFilters', [])
  const [itinSaving, setItinSaving]       = useState(false)
  const [itinSaveMsg, setItinSaveMsg]     = useState(null)

  // ── Overview: filtering ("dim", not "hide") ──
  const filteredForQueue = useMemo(
    () => applyFilters(merged, filters, mapFields),
    [merged, filters, mapFields]
  )
  const matchedIds = useMemo(() => new Set(filteredForQueue.map(b => b.id)), [filteredForQueue])
  const hasActiveOverviewFilter = useMemo(() => {
    const byId = Object.fromEntries(mapFields.map(f => [f.id, f]))
    return filters.some(f => byId[f.field] && !isEmptyValue(byId[f.field], f.value))
  }, [filters, mapFields])

  const allPinned   = useMemo(() => merged.filter(b => b.latitude != null && b.longitude != null), [merged])
  const allUnpinned = useMemo(() => merged.filter(b => b.latitude == null || b.longitude == null), [merged])

  const usedTypeIds = useMemo(
    () => new Set(allPinned.flatMap(typeIdsFor)),
    [allPinned]
  )

  // Matching pins go in the cluster group; filtered-out pins are drawn as
  // small gray dots outside it so clusters only reflect matches.
  const matchingPinned = useMemo(
    () => allPinned.filter(b => !hasActiveOverviewFilter || matchedIds.has(b.id)),
    [allPinned, hasActiveOverviewFilter, matchedIds]
  )
  const dimmedPinned = useMemo(
    () => (hasActiveOverviewFilter ? allPinned.filter(b => !matchedIds.has(b.id)) : []),
    [allPinned, hasActiveOverviewFilter, matchedIds]
  )

  const unpinnedQueue = useMemo(
    () => filteredForQueue.filter(b => b.latitude == null || b.longitude == null),
    [filteredForQueue]
  )
  const filteredUnpinned = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return unpinnedQueue
    return unpinnedQueue.filter(b =>
      [b.name, siteLabel(b), b.municipality, b.barangay].filter(Boolean).some(f => f.toLowerCase().includes(q))
    )
  }, [unpinnedQueue, search])

  async function handlePlace(projectId, lat, lng) {
    setSaveError(null)
    const { error } = await setLocation(projectId, lat, lng)
    if (error) setSaveError(error)
    else setPinningId(null)
  }

  async function handleClear(projectId) {
    setSaveError(null)
    const { error } = await clearLocation(projectId)
    if (error) setSaveError(error)
  }

  const pinningSite = merged.find(b => b.id === pinningId)

  // ── Plan Visit ──
  const selectedItinerary = selectedId === 'new' ? null : itineraries.find(it => it.id === selectedId)

  const filteredForPlan = useMemo(
    () => applyFilters(merged, itinFilters, mapFields),
    [merged, itinFilters, mapFields]
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
      setStopIds(it.itinerary_stops.map(s => s.project_id).filter(pid => pid != null))
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

    const { error } = await saveStops(
      itineraryId,
      stops.map(s => ({ project_id: s.id, beneficiary_id: s.beneficiary_id }))
    )
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
              {merged.length} projects · {allPinned.length} pinned · {allUnpinned.length} unpinned
              {hasActiveOverviewFilter && ` · ${matchedIds.size} match filters`}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Color by</span>
              <select
                value={colorBy}
                onChange={e => setColorBy(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="category">Category</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <FilterChips
            fields={mapFields}
            rows={merged}
            filters={filters}
            onChange={setFilters}
          />

          {pinningSite && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-800 flex items-center justify-between">
              <span>
                📍 Click the map to place a pin for <strong>{pinningSite.name}</strong> — {siteLabel(pinningSite)}
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

          {iconError && isAdmin && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-800">
              Project type icons couldn't load ({iconError}). Pins will show plain dots.
              Run <code>migrations/03_project_type_icons.sql</code> in Supabase.
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

                  {/* One pin per project. Only pins that practically overlap are
                      grouped; exact-same-spot pins fan out (spiderfy) on click. */}
                  <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={CLUSTER_RADIUS_PX}
                    spiderfyOnMaxZoom
                    showCoverageOnHover={false}
                    iconCreateFunction={clusterIcon}
                  >
                    {matchingPinned.map(b => (
                      <SiteMarker
                        key={b.id}
                        b={b}
                        icon={iconFor(typeIdsFor(b), getSiteColor(b, colorBy), false)}
                        onReposition={() => setPinningId(b.id)}
                        onRemove={() => handleClear(b.id)}
                      />
                    ))}
                  </MarkerClusterGroup>

                  {/* Filtered-out pins: small gray dots, outside the cluster group */}
                  {dimmedPinned.map(b => (
                    <SiteMarker
                      key={b.id}
                      b={b}
                      icon={iconFor([], DIMMED_COLOR, true)}
                      onReposition={() => setPinningId(b.id)}
                      onRemove={() => handleClear(b.id)}
                    />
                  ))}
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

              <IconLegend types={iconTypes} usedTypeIds={usedTypeIds} />
            </div>

            {/* Sidebar: unpinned queue */}
            <div className="flex flex-col" style={{ height: '70vh' }}>
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Search unpinned projects..."
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
                    {unpinnedQueue.length === 0 ? 'All matching projects are pinned.' : 'No matches.'}
                  </p>
                ) : (
                  filteredUnpinned.map(b => (
                    <SiteQueueItem
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
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-700"
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

          <FilterChips
            fields={mapFields}
            rows={merged}
            filters={itinFilters}
            onChange={setItinFilters}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: '65vh' }}>
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