import { useMemo, useState } from 'react'
import { haversineDistanceKm } from '../../lib/geo'

// `all` is the full filtered beneficiary list (from filterBeneficiaries).
// `excludeIds` are beneficiaries already added to the itinerary being built.
// `anchor` (optional) is the last stop added — when set, the pool sorts by
// distance from it, making "what's nearby" the default view while building
// a day.
export default function CandidatePool({ all, excludeIds, anchor, onAdd }) {
  const [search, setSearch] = useState('')

  const available = useMemo(() => {
    const pool = all.filter(b => !excludeIds.has(b.id) && b.latitude != null && b.longitude != null)
    const q = search.trim().toLowerCase()
    const filtered = q
      ? pool.filter(b => [b.name, b.municipality, b.barangay].filter(Boolean).some(f => f.toLowerCase().includes(q)))
      : pool

    if (!anchor) return filtered
    return [...filtered].sort((a, b) => {
      const da = haversineDistanceKm(anchor, a) ?? Infinity
      const db = haversineDistanceKm(anchor, b) ?? Infinity
      return da - db
    })
  }, [all, excludeIds, search, anchor])

  return (
    <div className="border border-gray-200 rounded-lg p-3 flex flex-col" style={{ height: '100%' }}>
      <input
        type="text"
        placeholder="Search candidates..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Candidates ({available.length}){anchor && ' · sorted by distance from last stop'}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {available.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            No pinned beneficiaries match the current filters.
          </p>
        ) : (
          available.map(b => {
            const d = anchor ? haversineDistanceKm(anchor, b) : null
            return (
              <div key={b.id} className="flex items-center justify-between border border-gray-200 rounded px-2 py-1.5 text-sm bg-white">
                <div className="min-w-0">
                  <div className="font-medium text-gray-700 truncate">{b.name}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {[b.barangay, b.municipality].filter(Boolean).join(', ') || '—'}
                    {d != null && ` · ${d.toFixed(1)} km away`}
                  </div>
                </div>
                <button
                  onClick={() => onAdd(b)}
                  className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 ml-2 whitespace-nowrap"
                >
                  + Add
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}