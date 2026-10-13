import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { nextOccurrence, todayYmd } from '../lib/dates'

const NO_EDIT = "You don't have permission to make changes."

// Same shape as the other hooks: mutations never throw, they return { error }.
// Completing a repeating task creates the next occurrence (the first date in
// the cycle that is today or later, so a late completion doesn't spawn a task
// that is already overdue).
export function useTasks() {
  const { canEdit } = useAuth()
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase.from('tasks').select('*').order('due_date')
      if (error) setError(error.message)
      else { setTasks(data ?? []); setError(null) }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // .select('id') so a silent RLS rejection (0 rows) is detectable
  async function addTask(payload) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase.from('tasks').insert(payload).select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchTasks(true)
    return { error: null }
  }

  async function updateTask(id, patch) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchTasks(true)
    return { error: null }
  }

  async function deleteTask(id) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase.from('tasks').delete().eq('id', id).select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }
    await fetchTasks(true)
    return { error: null }
  }

  // Returns { error, nextDue } — nextDue is set when a repeat was scheduled.
  async function setDone(task, done) {
    if (!canEdit) return { error: NO_EDIT }
    const { data, error } = await supabase
      .from('tasks')
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq('id', task.id)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: NO_EDIT }

    let nextDue = null
    if (done && task.recurrence && !task.done_at) {
      const today = todayYmd()
      let next = nextOccurrence(task.due_date, task.recurrence)
      for (let i = 0; i < 500 && next < today; i++) next = nextOccurrence(next, task.recurrence)
      const { error: e2 } = await supabase.from('tasks').insert({
        title: task.title, due_date: next, notes: task.notes,
        project_id: task.project_id, recurrence: task.recurrence,
      }).select('id')
      if (e2) {
        await fetchTasks(true)
        return { error: `Marked done, but couldn't schedule the next one: ${e2.message}` }
      }
      nextDue = next
    }

    await fetchTasks(true)
    return { error: null, nextDue }
  }

  return { tasks, loading, error, refetch: () => fetchTasks(true), addTask, updateTask, deleteTask, setDone }
}