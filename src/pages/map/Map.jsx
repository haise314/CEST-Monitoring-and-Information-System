import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../../lib/Leafleticon'
import { useBeneficiaryLocations } from '../../hooks/useBeneficiaryLocations'
import { useProjects } from '../../hooks/useProjects'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { PHASE_ORDER } from '../../lib/documentProgress'
import { DOC_CONDITIONS } from '../../lib/documentStatus'
import MapFilterBar, { emptyMapFilters, emptyDocFilter } from './filterBar'

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
          {b.projectCount > 0 && ` · ${b.projectCount} project${b.projectCount === 1 ? '' : 's'}`}
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
  const { beneficiaries: locations, loading: locLoading, error: locError, setLocation, clearLocation } = useBeneficiaryLocations()
  const { projects, loading: projLoading }   = useProjects()
  const { documents, loading: docLoading }   = useAllDocuments()

  const [pinningId, setPinningId]         = useState(null)
  const [search, setSearch]               = useState('')
  const [saveError, setSaveError]         = useState(null)
  const [filters, setFilters]             = useState(emptyMapFilters())
  const [docFilter, setDocFilter]         = useState(emptyDocFilter())

  const loading = locLoading || projLoading || docLoading

  // Merge beneficiaries with their projects and documents, in-memory, by
  // beneficiary_id — deliberately not a new hook (see useBeneficiaryLocations'
  // header comment: this keeps that hook independent of what useProjects/
  // useAllDocuments select, at the cost of this one extra pass here).
  const merged = useMemo(() => {
    const projectsByBeneficiary = {}
    const beneficiaryIdByProjectId = {}
    for (const p of projects) {
      const bId = p.beneficiary_id
      if (!projectsByBeneficiary[bId]) projectsByBeneficiary[bId] = []
      projectsByBeneficiary[bId].push(p)
      beneficiaryIdByProjectId[p.id] = bId
    }

    const documentsByBeneficiary = {}
    for (const d of documents) {
      const projectId = d.project_instances?.id
      const bId = beneficiaryIdByProjectId[projectId]
      if (bId == null) continue
      if (!documentsByBeneficiary[bId]) documentsByBeneficiary[bId] = []
      documentsByBeneficiary[bId].push(d)
    }

    return locations.map(b => ({
      ...b,
      projects: projectsByBeneficiary[b.id] ?? [],
      documents: documentsByBeneficiary[b.id] ?? [],
    }))
  }, [locations, projects, documents])

  // Document types for the filter dropdown, grouped by phase — pulled from
  // the documents already fetched rather than a separate document_types
  // fetch, same "merge what we have" approach as above.
  const documentTypesByPhase = useMemo(() => {
    const map = {}
    const seen = new Set()
    for (const d of documents) {
      const t = d.document_types
      if (!t || !t.phase || seen.has(t.id)) continue
      seen.add(t.id)
      if (!map[t.phase]) map[t.phase] = []
      map[t.phase].push(t)
    }
    Object.values(map).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)))
    const ordered = {}
    for (const phase of PHASE_ORDER) {
      if (map[phase]) ordered[phase] = map[phase]
    }
    return ordered
  }, [documents])

  const filteredBeneficiaries = useMemo(() => {
    const condition = docFilter.conditionId
      ? DOC_CONDITIONS.find(c => c.id === docFilter.conditionId)
      : null

    return merged.filter(b => {
      if (filters.municipality && b.municipality !== filters.municipality) return false
      if (filters.barangay && b.barangay !== filters.barangay) return false
      if (filters.project_category && !b.projects.some(p => p.project_category === filters.project_category)) return false
      if (filters.overall_status && !b.projects.some(p => p.overall_status === filters.overall_status)) return false

      if (docFilter.documentTypeId && condition) {
        const matchingDocs = b.documents.filter(d => String(d.document_type_id) === String(docFilter.documentTypeId))
        const matches = matchingDocs.length === 0
          ? condition.test(undefined)
          : matchingDocs.some(d => condition.test(d))
        if (!matches) return false
      }

      return true
    })
  }, [merged, filters, docFilter])

  const pinned   = useMemo(() => filteredBeneficiaries.filter(b => b.latitude != null && b.longitude != null), [filteredBeneficiaries])
  const unpinned = useMemo(() => filteredBeneficiaries.filter(b => b.latitude == null || b.longitude == null), [filteredBeneficiaries])

  const filteredUnpinned = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return unpinned
    return unpinned.filter(b =>
      [b.name, b.municipality, b.barangay].filter(Boolean).some(f => f.toLowerCase().includes(q))
    )
  }, [unpinned, search])

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

  if (loading)  return <div className="p-6 text-gray-500">Loading map...</div>
  if (locError) return <div className="p-6 text-red-500">Error: {locError}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">
          Map
          <span className="ml-2 text-sm font-normal text-gray-400">
            {filteredBeneficiaries.length} of {merged.length} beneficiaries · {pinned.length} pinned · {unpinned.length} unpinned
          </span>
        </h1>
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

            {pinned.map(b => (
              <Marker key={b.id} position={[b.latitude, b.longitude]}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold text-gray-800">{b.name}</div>
                    <div className="text-xs text-gray-500 mb-1">
                      {[b.barangay, b.municipality].filter(Boolean).join(', ') || '—'}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {b.category} · {b.projectCount} project{b.projectCount === 1 ? '' : 's'}
                    </div>
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
            ))}
          </MapContainer>
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
                {unpinned.length === 0 ? 'All beneficiaries are pinned.' : 'No matches.'}
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
    </div>
  )
}