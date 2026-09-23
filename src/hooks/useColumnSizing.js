import { useState, useEffect } from 'react'

// Persists a TanStack Table's columnSizing state to localStorage under
// `storageKey`, so drag-resized widths survive a page reload — same
// reasoning as EditPanel's localStorage['editPanelWidth']. Extracted here
// once a third table (after Projects, Beneficiaries, Contacts) needed the
// identical behavior; before that it lived inline in Projects.jsx.
export function useColumnSizing(storageKey) {
  const [columnSizing, setColumnSizing] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnSizing))
    } catch {
      // Storage can fail (private browsing, quota) — sizing just won't
      // persist this session, not worth surfacing as an error.
    }
  }, [storageKey, columnSizing])

  return [columnSizing, setColumnSizing]
}