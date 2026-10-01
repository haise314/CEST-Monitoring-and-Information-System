import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

// Admin-only banner: shown when no backup exists or the last one is more than
// a week old. Dismissing hides it for this browser session only.
const DISMISS_KEY = 'cest_backup_reminder_dismissed'
const STALE_DAYS  = 7

export default function BackupReminder() {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [status, setStatus] = useState(undefined) // undefined = not loaded
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('backup_status').select('last_backup_at').maybeSingle()
      .then(({ data, error }) => setStatus(error ? null : (data ?? null)))
  }, [isAdmin, pathname])

  if (!isAdmin || dismissed || pathname === '/backup' || status === undefined || status === null) return null

  const last = status.last_backup_at ? new Date(status.last_backup_at).getTime() : null
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null
  if (last && days <= STALE_DAYS) return null

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span className="flex-1 min-w-0">
        {last ? `Last backup: ${days} days ago.` : 'No backup has been taken yet.'}{' '}
        <Link to="/backup" className="font-medium underline">Back up now</Link>
      </span>
      <button onClick={dismiss} aria-label="Dismiss" className="text-amber-700 hover:text-amber-900 text-lg leading-none px-1">✕</button>
    </div>
  )
}