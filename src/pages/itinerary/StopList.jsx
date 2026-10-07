import { legDistances, totalRouteDistanceKm, nearestNeighborOrder, estimateMinutes } from '../../lib/geo'
import { OFFICE_LOCATION } from '../../lib/officeLocation'
import { siteLabel } from '../../hooks/useMapSites'

// `stops` is the ordered array of sites (one per project, with lat/lng) making
// up the itinerary currently being edited (not yet necessarily saved).
export default function StopList({ stops, onReorder, onRemove }) {
  const start = OFFICE_LOCATION
  const legs = legDistances(stops, start)
  const totalKm = totalRouteDistanceKm(stops, start)

  function move(index, delta) {
    const target = index + delta
    if (target < 0 || target >= stops.length) return
    const next = [...stops]
    ;[next[index], next[target]] = [next[target], next[index]]
    onReorder(next)
  }

  function autoOrder() {
    onReorder(nearestNeighborOrder(stops, start))
  }

  // Flag a leg as an outlier if it's meaningfully longer than the day's
  // average leg — just a visual nudge, not a rule.
  const validLegs = legs.filter(d => d != null)
  const avgLeg = validLegs.length ? validLegs.reduce((a, b) => a + b, 0) / validLegs.length : 0

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">
          Stops ({stops.length})
        </span>
        <button
          onClick={autoOrder}
          disabled={stops.length < 2}
          className="text-xs bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white px-2 py-1 rounded"
        >
          Auto-order
        </button>
      </div>

      {!start && (
        <p className="text-xs text-amber-600 mb-2">
          No office starting point set (OFFICE_LOCATION is empty) — auto-order
          starts from the first stop in the list instead.
        </p>
      )}

      {stops.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">
          No stops yet — add projects from the pool on the left.
        </p>
      ) : (
        <div className="space-y-1.5">
          {stops.map((b, i) => {
            const leg = legs[i]
            const isOutlier = leg != null && avgLeg > 0 && leg > avgLeg * 1.75
            return (
              <div
                key={b.id}
                className="flex items-center justify-between border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700 truncate">{b.name}</div>
                    <div className="text-xs text-gray-500 truncate">{siteLabel(b)}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {[b.barangay, b.municipality].filter(Boolean).join(', ') || '—'}
                      {leg != null && (
                        <span className={isOutlier ? 'text-red-500 font-medium' : ''}>
                          {' · '}{leg.toFixed(1)} km / ~{estimateMinutes(leg)} min from previous
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === stops.length - 1} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">▼</button>
                  <button onClick={() => onRemove(b.id)} className="text-xs text-red-500 hover:text-red-700 px-1">✕</button>
                </div>
              </div>
            )
          })}
          <div className="text-xs text-gray-400 pt-1 text-right">
            Total (approx, straight-line): {totalKm.toFixed(1)} km · ~{estimateMinutes(totalKm)} min driving
          </div>
        </div>
      )}
    </div>
  )
}