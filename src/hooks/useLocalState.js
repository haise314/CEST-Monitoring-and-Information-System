import { useState, useEffect } from 'react'

// Like useState, but remembered in localStorage — so it survives closing the
// browser and is per device. `normalize` (optional) cleans whatever was stored
// before it is used (e.g. to merge in defaults for columns added later).
// Falls back to plain state if storage is unavailable.
export function useLocalState(key, initial, normalize) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return initial
      const parsed = JSON.parse(raw)
      return normalize ? normalize(parsed) : parsed
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
  }, [key, value])

  return [value, setValue]
}