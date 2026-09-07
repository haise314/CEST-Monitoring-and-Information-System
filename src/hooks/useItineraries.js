import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Same hook shape as the rest of the app: { data, loading, error, refetch,
// mutations... }, mutations never throw — they return { error } and the
// caller displays it inline (see docs/architecture.md's State Management
// section).
//
// ASSUMPTION, flagging per this project's "verify before assuming" habit:
// `saveStops` does a delete-then-insert of all of an itinerary's stops as
// two separate calls, since the Supabase JS client doesn't expose
// multi-statement transactions without a Postgres function/RPC. This is NOT
// atomic — a failure between the delete and the insert would leave an
// itinerary with zero stops rather than its old ones. Fine for a single-
// user internal tool with low write contention, but worth knowing. If this
// ever matters, the fix is a Postgres RPC function wrapping both in a
// transaction, called via supabase.rpc(...).
export function useItineraries() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItineraries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('itineraries')
      .select('*, itinerary_stops(*, beneficiaries(id, name, municipality, barangay, latitude, longitude))')
      .order('visit_date', { ascending: false, nullsFirst: false })

    if (error) {
      setError(error.message)
    } else {
      // Sort each itinerary's stops by stop_order client-side — PostgREST
      // doesn't guarantee nested-embed ordering without an explicit order()
      // on the embedded resource.
      const sorted = data.map(it => ({
        ...it,
        itinerary_stops: [...it.itinerary_stops].sort((a, b) => a.stop_order - b.stop_order),
      }))
      setData(sorted)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchItineraries() }, [fetchItineraries])

  async function addItinerary({ name, visit_date = null, notes = null }) {
    const { data: inserted, error } = await supabase
      .from('itineraries')
      .insert({ name, visit_date, notes })
      .select()
      .single()
    if (error) return { error: error.message }
    await fetchItineraries()
    return { error: null, data: inserted }
  }

  async function updateItinerary(id, patch) {
    const { error } = await supabase.from('itineraries').update(patch).eq('id', id)
    if (error) return { error: error.message }
    await fetchItineraries()
    return { error: null }
  }

  async function deleteItinerary(id) {
    const { error } = await supabase.from('itineraries').delete().eq('id', id)
    if (error) return { error: error.message }
    await fetchItineraries()
    return { error: null }
  }

  // Replaces ALL stops for an itinerary in one call — simplest correct way
  // to persist a list after auto-order + manual reorder + add/remove,
  // rather than diffing into separate add/remove/reorder calls.
  // `beneficiaryIds` is the full ordered list for this itinerary.
  async function saveStops(itineraryId, beneficiaryIds) {
    const { error: deleteError } = await supabase
      .from('itinerary_stops')
      .delete()
      .eq('itinerary_id', itineraryId)
    if (deleteError) return { error: deleteError.message }

    if (beneficiaryIds.length > 0) {
      const rows = beneficiaryIds.map((beneficiary_id, i) => ({
        itinerary_id: itineraryId,
        beneficiary_id,
        stop_order: i,
      }))
      const { error: insertError } = await supabase.from('itinerary_stops').insert(rows)
      if (insertError) return { error: insertError.message }
    }

    await fetchItineraries()
    return { error: null }
  }

  return {
    data,
    loading,
    error,
    refetch: fetchItineraries,
    addItinerary,
    updateItinerary,
    deleteItinerary,
    saveStops,
  }
}