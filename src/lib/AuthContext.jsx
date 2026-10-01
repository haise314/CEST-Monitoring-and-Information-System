import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useToast } from './ToastContext'

// ─── Session policy ──────────────────────────────────────────────────────────
// One rule: a login lasts at most 12 hours. Otherwise sessions behave as
// before (they survive closing the tab and refreshing). The sign-in time is
// stored in the browser; it is checked on load, whenever the tab regains
// focus, and about once a minute. A warning toast appears 10 minutes before
// sign-out so unsaved edits aren't lost.
//
// NOTE: this runs in the browser only. It protects an unattended computer,
// not a technical attacker (server-side enforcement needs a paid Supabase plan).
const SESSION_MAX_MS = 12 * 60 * 60 * 1000
const WARN_BEFORE_MS = 10 * 60 * 1000
const CHECK_EVERY_MS = 60 * 1000
const SIGNED_IN_KEY  = 'cest_signed_in_at'

function readSignedInAt() {
  try { return Number(localStorage.getItem(SIGNED_IN_KEY)) || null } catch { return null }
}
function writeSignedInAt(ms) {
  try { localStorage.setItem(SIGNED_IN_KEY, String(ms)) } catch { /* ignore */ }
}
function clearSignedInAt() {
  try { localStorage.removeItem(SIGNED_IN_KEY) } catch { /* ignore */ }
}

// Stored time wins. A session that predates this feature has no stored time,
// so fall back to Supabase's own last_sign_in_at (or "now" as a last resort).
function signInTime(session) {
  const stored = readSignedInAt()
  if (stored) return stored
  const t = session?.user?.last_sign_in_at ? new Date(session.user.last_sign_in_at).getTime() : NaN
  return Number.isFinite(t) ? t : Date.now()
}

// The toast API's exact method names aren't known here, so use the first
// "attention" style that exists and fall back to success.
function notify(toast, message) {
  const fn = toast?.warning || toast?.info || toast?.error || toast?.success
  fn?.(message)
}

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const [session, setSession]         = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  // Profile (role + full name) from the `profiles` table, tagged with the
  // user it belongs to so we can tell "not loaded yet" from "no profile".
  const [profileState, setProfileState] = useState({ userId: null, profile: null })

  const sessionRef = useRef(null)
  sessionRef.current = session
  const warned = useRef(false)

  const userId = session?.user?.id ?? null

  useEffect(() => {
    // Restore whatever session Supabase already has in local storage
    // (it persists sessions by default), then keep it in sync.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Profile / role ──
  // Keyed on the user id (not the session object) so hourly token refreshes
  // don't refetch or flip the app back into a loading state.
  async function loadProfile(id) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', id)
      .maybeSingle()
    if (error) console.error('Could not load profile:', error.message)
    setProfileState({ userId: id, profile: data ?? null })
  }

  useEffect(() => {
    if (!userId) {
      setProfileState({ userId: null, profile: null })
      return
    }
    loadProfile(userId)
  }, [userId])

  // Pick up a role change made in the Supabase dashboard without a re-login:
  // quietly re-read the profile whenever the tab regains focus.
  useEffect(() => {
    if (!userId) return
    const onFocus = () => loadProfile(userId)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [userId])

  // ── 12-hour session limit ──
  useEffect(() => {
    if (!userId) {
      warned.current = false
      return
    }

    function check() {
      const sess = sessionRef.current
      if (!sess) return
      const age = Date.now() - signInTime(sess)

      if (age >= SESSION_MAX_MS) {
        notify(toastRef.current, 'Your 12-hour session has ended. Please sign in again.')
        clearSignedInAt()
        supabase.auth.signOut()
        return
      }

      if (!warned.current && SESSION_MAX_MS - age <= WARN_BEFORE_MS) {
        warned.current = true
        const mins = Math.max(1, Math.round((SESSION_MAX_MS - age) / 60000))
        notify(toastRef.current, `You'll be signed out in about ${mins} minute${mins === 1 ? '' : 's'}. Save your work.`)
      }
    }

    check()
    const interval = setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])

  // The sign-in time is recorded here (not in onAuthStateChange, which can
  // fire SIGNED_IN again on tab focus and would silently extend the session).
  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (!result.error) writeSignedInAt(Date.now())
    return result
  }

  const signOut = () => {
    clearSignedInAt()
    return supabase.auth.signOut()
  }

  // Hold the app on its loading screen until the profile has been read, so
  // role-dependent buttons don't flash in/out.
  const profileReady = !userId || profileState.userId === userId
  const loading = authLoading || !profileReady

  const profile = profileState.userId === userId ? profileState.profile : null
  const role    = profile?.role ?? null
  const isAdmin = role === 'admin'
  const canEdit = role === 'admin' || role === 'editor'

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profile,
        role,
        isAdmin,
        canEdit,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}