import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../../lib/Leafleticon'
import { useBeneficiaryLocations } from '../../hooks/useBeneficiaryLocations'

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
  const { beneficiaries, loading, error, setLocation, clearLocation } = useBeneficiaryLocations()
  const [pinningId, setPinningId]         = useState(null)
  const [search, setSearch]               = useState('')
  const [saveError, setSaveError]         = useState(null)

  const pinned   = useMemo(() => beneficiaries.filter(b => b.latitude != null && b.longitude != null), [beneficiaries])
  const unpinned = useMemo(() => beneficiaries.filter(b => b.latitude == null || b.longitude == null), [beneficiaries])

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

  const pinningBeneficiary = beneficiaries.find(b => b.id === pinningId)

  if (loading) return <div className="p-6 text-gray-500">Loading map...</div>
  if (error)   return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">
          Map
          <span className="ml-2 text-sm font-normal text-gray-400">
            {pinned.length} pinned · {unpinned.length} unpinned
          </span>
        </h1>
      </div>

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