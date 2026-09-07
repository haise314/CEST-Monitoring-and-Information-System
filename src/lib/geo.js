// Pure geo helpers — no I/O, no React. Same spirit as documentStatus.js /
// documentProgress.js: framework-free logic that's easy to reason about and
// test in isolation.

const EARTH_RADIUS_KM = 6371

function toRad(deg) {
  return (deg * Math.PI) / 180
}

// Great-circle ("as the crow flies") distance between two
// {latitude, longitude} points, in km. NOT a driving distance — good enough
// for comparing/ordering stops at this scale (dozens of stops within one
// province), not meant to be shown to the user as an authoritative travel
// distance. Returns null if either point is missing coordinates.
export function haversineDistanceKm(a, b) {
  if (a == null || b == null) return null
  const { latitude: lat1, longitude: lon1 } = a
  const { latitude: lat2, longitude: lon2 } = b
  if ([lat1, lon1, lat2, lon2].some(v => v == null)) return null

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

// Deliberately crude drive-time guess from a straight-line distance, using
// an assumed average provincial road speed. Always label this "approx" in
// the UI — it is not a routing-API estimate.
const ASSUMED_AVG_SPEED_KMH = 30

export function estimateMinutes(distanceKm) {
  if (distanceKm == null) return null
  return Math.round((distanceKm / ASSUMED_AVG_SPEED_KMH) * 60)
}

// Greedy nearest-neighbor ordering. NOT true TSP optimization — explicitly
// agreed to be unnecessary at this scale (dozens of stops, not thousands;
// see docs/map-itinerary.md). `points` is an array of objects with
// .latitude/.longitude (e.g. beneficiaries). `start` is a plain
// {latitude, longitude} to begin the search from (e.g. an office location)
// — every item in `points` is included in the returned order. Pass
// start = null to just begin from the first point in the array.
export function nearestNeighborOrder(points, start = null) {
  const remaining = [...points]
  const order = []
  let current = start

  if (current == null && remaining.length > 0) {
    current = remaining.shift()
    order.push(current)
  }

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistanceKm(current, remaining[i])
      if (d != null && d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const [next] = remaining.splice(bestIdx, 1)
    order.push(next)
    current = next
  }

  return order
}

// Total straight-line distance walking through `orderedPoints` in sequence,
// optionally starting from `start`. Used for the per-day summary stat.
export function totalRouteDistanceKm(orderedPoints, start = null) {
  let total = 0
  let prev = start
  for (const p of orderedPoints) {
    if (prev != null) {
      const d = haversineDistanceKm(prev, p)
      if (d != null) total += d
    }
    prev = p
  }
  return total
}

// Per-consecutive-pair distances, for showing "X km from previous stop"
// next to each stop in the list. Index 0's distance is from `start` (or
// null if no start was given).
export function legDistances(orderedPoints, start = null) {
  const legs = []
  let prev = start
  for (const p of orderedPoints) {
    legs.push(prev == null ? null : haversineDistanceKm(prev, p))
    prev = p
  }
  return legs
}