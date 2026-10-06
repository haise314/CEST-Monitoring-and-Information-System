import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Yearly budget ceilings (annual_budgets). Everyone signed in can read;
// writes only succeed for admins (enforced by RLS — the page also hides the
// controls for everyone else).
export function useBudgets() {
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('annual_budgets')
        .select('*')
        .order('year', { ascending: false })
      if (error) setError(error.message)
      else { setBudgets(data ?? []); setError(null) }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBudgets() }, [fetchBudgets])

  async function saveBudget({ year, allocated_amount, notes }) {
    const { error } = await supabase
      .from('annual_budgets')
      .upsert({ year, allocated_amount, notes }, { onConflict: 'year' })
    if (error) return { error: error.message }
    await fetchBudgets()
    return { error: null }
  }

  return { budgets, loading, error, refetch: fetchBudgets, saveBudget }
}