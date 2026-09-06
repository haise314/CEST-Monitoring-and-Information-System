import { useMemo, useRef, useEffect } from 'react'

// ─── Column Visibility Panel ──────────────────────────────────────────────────
// Generic — accepts any TanStack table instance.
// Columns are grouped by their columnDef.group property.

export default function VisibilityPanel({ table, onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const groups = useMemo(() => {
    const map = {}
    table.getAllColumns().forEach(col => {
      const group = col.columnDef.group ?? 'Other'
      if (!map[group]) map[group] = []
      map[group].push(col)
    })
    return map
  }, [table])

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-72"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Toggle Columns</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(groups).map(([group, cols]) => (
          <div key={group}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{group}</div>
            <div className="space-y-1">
              {cols.map(col => (
                <label key={col.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{col.columnDef.header}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => table.resetColumnVisibility()}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Reset to default
      </button>
    </div>
  )
}