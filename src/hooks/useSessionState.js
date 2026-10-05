import { useState, useEffect } from 'react'

// Like useState, but remembered in sessionStorage — so filters survive
// "open a project, then come back" and page refreshes, and are cleared when the
// browser tab is closed. Falls back to plain state if storage is unavailable.
export function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw == null ? initial : JSON.parse(raw)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
  }, [key, value])

  return [value, setValue]
}