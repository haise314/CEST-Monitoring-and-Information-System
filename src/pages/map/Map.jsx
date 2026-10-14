import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MapContainer, TileLayer, LayersControl, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css' // spiderfy/zoom animations only
import '../../lib/Leafleticon'
import { useMapSites, siteLabel } from '../../hooks/useMapSites'
import { useProjectTypeIcons } from '../../hooks/useProjectTypeIcons'
import { useAuth } from '../../lib/AuthContext'
import FilterChips from '../../components/common/FilterChips'
import { applyFilters, isEmptyValue } from '../../lib/filterEngine'
import { useSessionState } from '../../hooks/useSessionState'
import { computeProgress, progressBarColor } from '../../lib/documentProgress'
import { isOverdue } from '../../lib/documentStatus'
import { formatPeso } from '../../lib/budget'
import { buildMapFilterFields } from './mapFilterFields'
import { makeIconFactory, typeIdsFor, clusterIcon } from './pinIcons'
import IconLegend from './IconLegend'

// Rough center of Zambales province — used when there is no remembered view.
const ZAMBALES_CENTER = [15.5, 119.95]
const DEFAULT_ZOOM = 10
const VIEW_KEY = 'cest_map_view'

// Pins only merge into a cluster when practically touching (pin is ~30px tall).
const CLUSTER_RADIUS_PX = 25

const CATEGORY_COLORS = {
  LGU:         '#3b82f6',
  BLGU:        '#6366f1',
  Academe:     '#8b5cf6',
  SDO:         '#a855f7',
  NGO:         '#ec4899',
  Cooperative: '#10b981',
  Others:      '#6b7280',
}

// Matches mapFilterFields.jsx's OVERALL_STATUS_OPTIONS exactly.
const STATUS_COLORS = {
  'For Deployment':     '#f59e0b',
  'For Implementation': '#3b82f6',
  'For Monitoring':     '#06b6d4',
  'For Transfer':       '#8b5cf6',
  'Transfer Ongoing':   '#a855f7',
  'Fully Transferred':  '#14b8a6',
  'For Pull Out':       '#ef4444',
  Done:                 '#22c55e',
}
const STATUS_COLOR_NONE = '#9ca3af'
const DIMMED_COLOR      = '#9ca3af'

// Same scale as the progress bars elsewhere (green 100, blue 50+, yellow below).
const COMPLIANCE_COLORS = {
  'Complete (100%)': '#22c55e',
  '50–99%':          '#60a5fa',
  'Under 50%':       '#facc15',
  'No documents':    '#9ca3af',
}
function complianceColor(stat) {
  if (!stat?.hasDocs) return COMPLIANCE_COLORS['No documents']
  if (stat.pct === 100) return COMPLIANCE_COLORS['Complete (100%)']
  if (stat.pct >= 50)   return COMPLIANCE_COLORS['50–99%']
  return COMPLIANCE_COLORS['Under 50%']
}

function getSiteColor(b, colorBy, stat) {
  if (colorBy === 'status') {
    const status = b.projects[0]?.overall_status
    return status ? (STATUS_COLORS[status] ?? STATUS_COLOR_NONE) : STATUS_COLOR_NONE
  }
  if (colorBy === 'compliance') return complianceColor(stat)
  return CATEGORY_COLORS[b.category] ?? CATEGORY_COLORS.Others
}

const LEGEND_ENTRIES = {
  category: Object.entries(CATEGORY_COLORS),
  status: [...Object.entries(STATUS_COLORS), ['No status yet', STATUS_COLOR_NONE]],
  compliance: Object.entries(COMPLIANCE_COLORS),
}

function readView() {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY))
    if (v && Array.isArray(v.center) && Number.isFinite(v.zoom)) return v
  } catch { /* ignore */ }
  return null
}

// Pulls a lat/lng pair out of pasted text: "15.52, 119.98", a Google Maps URL
// (".../@15.52,119.98,17z" or "...!3d15.52!4d119.98"). Returns { lat, lng } | { error }.
function parseCoords(text) {
  let t = text.trim()
  try { t = decodeURIComponent(t) } catch { /* keep raw */ }
  const m =
    t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
    t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    t.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return { error: "Couldn't find coordinates. Paste \"lat, lng\" or a full Google Maps link (short links aren't supported)." }
  let lat = Number(m[1]), lng = Number(m[2])
  const latOk = v => v >= 4 && v <= 22
  const lngOk = v => v >= 116 && v <= 127
  if (!(latOk(lat) && lngOk(lng)) && latOk(lng) && lngOk(lat)) [lat, lng] = [lng, lat] // pasted as lng, lat
  if (!(latOk(lat) && lngOk(lng))) return { error: 'Those coordinates are outside the Philippines. Check the order (latitude first).' }
  return { lat, lng }
}

// Lives inside MapContainer: hands the map instance up, handles the "click to
// place the pin" flow, and remembers the viewport for this browser tab.
function MapBridge({ onReady, pinningId, onPlace }) {
  const map = useMap()
  useEffect(() => { onReady(map) }, [map, onReady])
  useMapEvents({
    click(e) {
      if (!pinningId) return
      onPlace(pinningId, e.latlng.lat, e.latlng.lng)
    },
    moveend() {
      try {
        const c = map.getCenter()
        sessionStorage.setItem(VIEW_KEY, JSON.stringify({ center: [c.lat, c.lng], zoom: map.getZoom() }))
      } catch { /* ignore */ }
    },
  })
  return null
}

// One project pin + its popup. Editors can drag it to adjust.
function SiteMarker({ b, icon, stat, draggable, markerRef, onDragEnd, onReposition, onRemove }) {
  const p = b.projects[0]
  return (
    <Marker
      ref={markerRef}
      position={[b.latitude, b.longitude]}
      icon={icon}
      draggable={draggable}
      eventHandlers={draggable ? {
        dragend: e => {
          const ll = e.target.getLatLng()
          onDragEnd(b, ll.lat, ll.lng, e.target)
        },
      } : undefined}
    >
      <Popup>
        <div className="text-sm" style={{ maxWidth: 240 }}>
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

          {p.amount != null && <div className="text-xs text-gray-500 mb-1.5">{formatPeso(p.amount)}</div>}

          {stat?.hasDocs ? (
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${progressBarColor(stat.pct)}`} style={{ width: `${stat.pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 tabular-nums">{stat.pct}%</span>
              </div>
              {stat.overdue > 0 && (
                <div className="text-xs text-red-500 font-medium mt-1">
                  {stat.overdue} overdue document{stat.overdue === 1 ? '' : 's'}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 mb-2">No document checklist yet</div>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {p.gdrive_folder_link && (
              <a href={p.gdrive_folder_link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:text-blue-700 underline">
                Drive folder ↗
              </a>
            )}
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
        <button onClick={onCancelPinning} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-2">
          Cancel
        </button>
      ) : (
        <button onClick={() => onStartPinning(b.id)} className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 ml-2 whitespace-nowrap">
          Place pin
        </button>
      )}
    </div>
  )
}

export default function MapPage() {
  const { isAdmin, canEdit } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // `merged` = one entry per project ("site"); id is the project id.
  const { sites: merged, documentTypesByPhase, loading: dataLoading, error, setLocation, clearLocation } = useMapSites()

  const { iconsById, types: iconTypes, error: iconError } = useProjectTypeIcons()
  const iconFor = useMemo(() => makeIconFactory(iconsById), [iconsById])

  const mapFields = useMemo(() => buildMapFilterFields(documentTypesByPhase), [documentTypesByPhase])

  const [map, setMap]             = useState(null)
  const [pinningId, setPinningId] = useState(null)
  const [search, setSearch]       = useState('')
  const [saveError, setSaveError] = useState(null)
  const [filters, setFilters]     = useSessionState('mapOverviewFilters', [])
  const [colorBy, setColorBy]     = useState('category')
  const [findQ, setFindQ]         = useState('')
  const [findOpen, setFindOpen]   = useState(false)
  const [coordText, setCoordText] = useState('')
  const [coordError, setCoordError] = useState(null)

  const markerRefs = useRef({})
  const clusterRef = useRef(null)
  const initialView = useMemo(readView, [])

  // Per-project document stats (compliance + overdue count) for colors, rings and popups.
  const stats = useMemo(() => {
    const m = {}
    for (const s of merged) {
      const prog = computeProgress(s.documents)
      m[s.id] = {
        pct: prog.overallPct,
        hasDocs: prog.totalApplicable > 0,
        overdue: s.documents.filter(isOverdue).length,
      }
    }
    return m
  }, [merged])

  // ── Filtering ("dim", not "hide") ──
  const filteredForQueue = useMemo(
    () => applyFilters(merged, filters, mapFields),
    [merged, filters, mapFields]
  )
  const matchedIds = useMemo(() => new Set(filteredForQueue.map(b => b.id)), [filteredForQueue])
  const hasActiveFilter = useMemo(() => {
    const byId = Object.fromEntries(mapFields.map(f => [f.id, f]))
    return filters.some(f => byId[f.field] && !isEmptyValue(byId[f.field], f.value))
  }, [filters, mapFields])

  const allPinned   = useMemo(() => merged.filter(b => b.latitude != null && b.longitude != null), [merged])
  const allUnpinned = useMemo(() => merged.filter(b => b.latitude == null || b.longitude == null), [merged])

  const usedTypeIds = useMemo(() => new Set(allPinned.flatMap(typeIdsFor)), [allPinned])

  const matchingPinned = useMemo(
    () => allPinned.filter(b => !hasActiveFilter || matchedIds.has(b.id)),
    [allPinned, hasActiveFilter, matchedIds]
  )
  const dimmedPinned = useMemo(
    () => (hasActiveFilter ? allPinned.filter(b => !matchedIds.has(b.id)) : []),
    [allPinned, hasActiveFilter, matchedIds]
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

  // ── Find a project (pinned or not) ──
  const findResults = useMemo(() => {
    const tokens = findQ.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    return merged.filter(b => {
      const p = b.projects[0]
      const hay = [b.name, siteLabel(b), b.municipality, b.barangay, p.address, p.property_number]
        .filter(Boolean).join(' ').toLowerCase()
      return tokens.every(t => hay.includes(t))
    }).slice(0, 8)
  }, [findQ, merged])

  const fitTo = useCallback(list => {
    if (!map) return
    const pts = list.filter(b => b.latitude != null && b.longitude != null).map(b => [b.latitude, b.longitude])
    if (pts.length === 0) return
    map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 })
  }, [map])

  // Fly to a project and open its popup; unpinned projects start pin placement.
  function focusSite(id) {
    const b = merged.find(s => s.id === id)
    if (!b || !map) return
    if (b.latitude == null || b.longitude == null) { setPinningId(id); return }
    const marker  = markerRefs.current[id]
    const cluster = clusterRef.current
    if (marker && cluster?.zoomToShowLayer && cluster.hasLayer?.(marker)) {
      cluster.zoomToShowLayer(marker, () => marker.openPopup())
    } else {
      map.flyTo([b.latitude, b.longitude], Math.max(map.getZoom(), 18), { duration: 0.8 })
      setTimeout(() => markerRefs.current[id]?.openPopup(), 900)
    }
  }

  function pickResult(b) {
    setFindQ('')
    setFindOpen(false)
    focusSite(b.id)
  }

  // Deep link: /map?project=123
  useEffect(() => {
    const id = searchParams.get('project')
    if (!id || !map || dataLoading) return
    setSearchParams({}, { replace: true })
    setTimeout(() => focusSite(Number(id)), 300)
  }, [searchParams, map, dataLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom to the matches whenever the filters change (not on first load, so the
  // remembered viewport wins).
  const firstFilterRun = useRef(true)
  useEffect(() => {
    if (firstFilterRun.current) { firstFilterRun.current = false; return }
    if (hasActiveFilter) fitTo(matchingPinned)
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePlace(projectId, lat, lng, fly = false) {
    setSaveError(null)
    const { error } = await setLocation(projectId, lat, lng)
    if (error) { setSaveError(error); return }
    setPinningId(null)
    setCoordText('')
    setCoordError(null)
    if (fly && map) map.flyTo([lat, lng], Math.max(map.getZoom(), 16))
  }

  async function handleClear(projectId) {
    setSaveError(null)
    const { error } = await clearLocation(projectId)
    if (error) setSaveError(error)
  }

  async function handleDragEnd(b, lat, lng, leafletMarker) {
    setSaveError(null)
    const { error } = await setLocation(b.id, lat, lng)
    if (error) {
      setSaveError(error)
      leafletMarker.setLatLng([b.latitude, b.longitude]) // snap back
    }
  }

  function applyCoords() {
    const r = parseCoords(coordText)
    if (r.error) { setCoordError(r.error); return }
    setCoordError(null)
    handlePlace(pinningId, r.lat, r.lng, true)
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setCoordError('This device cannot share its location.'); return }
    setCoordError(null)
    navigator.geolocation.getCurrentPosition(
      pos => handlePlace(pinningId, pos.coords.latitude, pos.coords.longitude, true),
      () => setCoordError("Couldn't get your location. Check the browser's location permission."),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const pinningSite = merged.find(b => b.id === pinningId)

  if (dataLoading) return <div className="p-6 text-gray-500">Loading map...</div>
  if (error)        return <div className="p-6 text-red-500">Error: {error}</div>

  const siteIcon = (b, dimmed) =>
    iconFor(dimmed ? [] : typeIdsFor(b), dimmed ? DIMMED_COLOR : getSiteColor(b, colorBy, stats[b.id]), dimmed, (stats[b.id]?.overdue ?? 0) > 0)

  const markerProps = b => ({
    b,
    stat: stats[b.id],
    draggable: canEdit,
    markerRef: m => { if (m) markerRefs.current[b.id] = m; else delete markerRefs.current[b.id] },
    onDragEnd: handleDragEnd,
    onReposition: () => setPinningId(b.id),
    onRemove: () => handleClear(b.id),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">Map</h1>
      </div>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-sm text-gray-400">
          {merged.length} projects · {allPinned.length} pinned · {allUnpinned.length} unpinned
          {hasActiveFilter && ` · ${matchedIds.size} match filters`}
        </span>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {/* Find a project */}
          <div className="relative">
            <input
              type="text"
              value={findQ}
              onChange={e => { setFindQ(e.target.value); setFindOpen(true) }}
              onFocus={() => setFindOpen(true)}
              onBlur={() => setFindOpen(false)}
              placeholder="Find a project on the map..."
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 sm:w-64 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {findOpen && findQ.trim() && (
              <div
                onMouseDown={e => e.preventDefault()}
                className="absolute right-0 top-full mt-1 z-[1000] w-80 max-w-[85vw] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
              >
                {findResults.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400">No matching projects</p>
                ) : findResults.map(b => {
                  const pinned = b.latitude != null && b.longitude != null
                  return (
                    <button
                      key={b.id}
                      onClick={() => pickResult(b)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-800 truncate">{b.name}</span>
                        <span className="block text-xs text-gray-400 truncate">
                          {[siteLabel(b), b.municipality].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={`text-xs flex-shrink-0 ${pinned ? 'text-green-600' : 'text-amber-600'}`}>
                        {pinned ? 'Show' : 'Place pin'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => fitTo(hasActiveFilter ? matchingPinned : allPinned)}
            title="Zoom to the pins currently shown"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ⤢ Fit to {hasActiveFilter ? 'results' : 'all'}
          </button>

          <span className="text-gray-500">Color by</span>
          <select
            value={colorBy}
            onChange={e => setColorBy(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="category">Category</option>
            <option value="status">Status</option>
            <option value="compliance">Compliance</option>
          </select>
        </div>
      </div>

      <FilterChips fields={mapFields} rows={merged} filters={filters} onChange={setFilters} />

      {pinningSite && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-800">
          <div className="flex items-center justify-between gap-3">
            <span>
              📍 Click the map to place a pin for <strong>{pinningSite.name}</strong> — {siteLabel(pinningSite)}
            </span>
            <button onClick={() => { setPinningId(null); setCoordError(null) }} className="text-xs text-blue-600 hover:text-blue-800 underline flex-shrink-0">
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <input
              type="text"
              value={coordText}
              onChange={e => { setCoordText(e.target.value); setCoordError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') applyCoords() }}
              placeholder="…or paste coordinates / a Google Maps link"
              className="flex-1 min-w-[12rem] border border-blue-200 rounded px-2.5 py-1.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={applyCoords}
              disabled={!coordText.trim()}
              className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Place here
            </button>
            <button onClick={useMyLocation} className="border border-blue-300 bg-white text-blue-700 rounded px-3 py-1.5 text-xs hover:bg-blue-50">
              Use my location
            </button>
          </div>
          {coordError && <p className="text-xs text-red-600 mt-1.5">{coordError}</p>}
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
              center={initialView?.center ?? ZAMBALES_CENTER}
              zoom={initialView?.zoom ?? DEFAULT_ZOOM}
              maxZoom={19}
              style={{ height: '100%', width: '100%', cursor: pinningId ? 'crosshair' : '' }}
            >
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Map">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite">
                  <TileLayer
                    className="cest-satellite"
                    attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxNativeZoom={18}
                    maxZoom={19}
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              <MapBridge onReady={setMap} pinningId={pinningId} onPlace={handlePlace} />

              <MarkerClusterGroup
                ref={clusterRef}
                chunkedLoading
                maxClusterRadius={CLUSTER_RADIUS_PX}
                spiderfyOnMaxZoom
                showCoverageOnHover={false}
                iconCreateFunction={clusterIcon}
              >
                {matchingPinned.map(b => (
                  <SiteMarker key={b.id} {...markerProps(b)} icon={siteIcon(b, false)} />
                ))}
              </MarkerClusterGroup>

              {/* Filtered-out pins: small gray dots, outside the cluster group */}
              {dimmedPinned.map(b => (
                <SiteMarker key={b.id} {...markerProps(b)} icon={siteIcon(b, true)} />
              ))}
            </MapContainer>
          </div>

          {/* Legend for the active color-by dimension */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
            {LEGEND_ENTRIES[colorBy].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="inline-block rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: color }} />
                {label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span
                className="inline-block rounded-full flex-shrink-0 bg-white"
                style={{ width: 10, height: 10, boxShadow: '0 0 0 2px #ef4444' }}
              />
              Has overdue documents
            </div>
          </div>

          <IconLegend types={iconTypes} usedTypeIds={usedTypeIds} />
          {canEdit && <p className="text-xs text-gray-400 mt-2 px-1">Tip: drag a pin to move it.</p>}
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
    </div>
  )
}