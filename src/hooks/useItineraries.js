import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NO_EDIT  = "You don't have permission to make changes."

// Same hook shape as the rest of the app: { data, loading, error, refetch,
// mutations... }; mutations never throw — they return { error }.
//
// Stops are PROJECTS now (itinerary_stops.project_id), because pins live on
// projects. beneficiary_id is still stored (NOT NULL) for reference.
//
// NOTE: `saveStops` does a delete-then-insert as two calls, so it is NOT
// atomic — a failure in between leaves the itinerary with zero stops. Fine for
// a small internal tool; the fix, if it ever matters, is a Postgres RPC.
export function useItineraries() {
  const { canEdit } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItineraries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('itineraries')
      .select('*, itinerary_stops(*, beneficiaries(id, name, municipality, barangay))')
      .order('visit_date', { ascending: false, nullsFirst: false })

    if (error) {
      setError(error.message)
    } else {
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
    if (!canEdit) return { error: NO_EDIT }
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
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase.from('itineraries').update(patch).eq('id', id)
    if (error) return { error: error.message }
    await fetchItineraries()
    return { error: null }
  }

  async function deleteItinerary(id) {
    if (!canEdit) return { error: NO_EDIT }
    const { error } = await supabase.from('itineraries').delete().eq('id', id)
    if (error) return { error: error.message }
    await fetchItineraries()
    return { error: null }
  }

  // Replaces ALL stops for an itinerary.
  // `stops` is the full ordered list: [{ project_id, beneficiary_id }, ...]
  async function saveStops(itineraryId, stops) {
    if (!canEdit) return { error: NO_EDIT }
    const { error: deleteError } = await supabase
      .from('itinerary_stops')
      .delete()
      .eq('itinerary_id', itineraryId)
    if (deleteError) return { error: deleteError.message }

    if (stops.length > 0) {
      const rows = stops.map((s, i) => ({
        itinerary_id: itineraryId,
        project_id: s.project_id,
        beneficiary_id: s.beneficiary_id,
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