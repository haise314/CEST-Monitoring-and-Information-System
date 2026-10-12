import { useRef, useEffect } from 'react'

// ─── Column Visibility + Order Panel ──────────────────────────────────────────
// Generic — accepts any TanStack table instance.
// Lists every column in its current order, with a show/hide checkbox and ▲/▼
// buttons to reorder. Buttons (not drag-and-drop) so it works on touch screens.
//
// Locked columns — enableHiding === false, or no header text (e.g. the ↗ link
// column) — can't be hidden or moved and always stay first. Documents.jsx
// relies on this: its pinned (sticky) columns must remain at the front.

const isLocked = col => col.columnDef.enableHiding === false || !col.columnDef.header

export default function VisibilityPanel({ table, onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // getAllLeafColumns() already follows the table's columnOrder state.
  const columns = table.getAllLeafColumns()
  const listed  = columns.filter(c => c.columnDef.header)          // skip header-less columns
  const movable = columns.filter(c => !isLocked(c))

  function move(id, delta) {
    const lockedIds = columns.filter(isLocked).map(c => c.id)
    const order = movable.map(c => c.id)
    const i = order.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    const next = [...lockedIds, ...order]
    // Keep ids that aren't on screen right now (e.g. another phase tab's
    // document columns on the Documents page) so their order isn't lost.
    table.setColumnOrder(prev => [...next, ...(prev ?? []).filter(x => !next.includes(x))])
  }

  function resetAll() {
    table.resetColumnVisibility()
    table.resetColumnOrder()
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 max-w-[calc(100vw-2rem)]"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-700">Columns</span>
        <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <p className="text-xs text-gray-500 mb-3">Tick to show. Use ▲ ▼ to reorder. Saved on this device.</p>

      <div className="space-y-0.5 max-h-96 overflow-y-auto">
        {listed.map(col => {
          const locked = isLocked(col)
          const idx = movable.indexOf(col)
          return (
            <div key={col.id} className="flex items-center gap-2 hover:bg-gray-50 px-1 py-0.5 rounded">
              <label className={`flex items-center gap-2 flex-1 min-w-0 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  disabled={locked}
                  onChange={col.getToggleVisibilityHandler()}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 truncate">{col.columnDef.header}</span>
              </label>
              {col.columnDef.group && (
                <span className="text-[10px] text-gray-400 truncate max-w-[5rem] hidden sm:inline">{col.columnDef.group}</span>
              )}
              {locked ? (
                <span className="w-[3.25rem] flex-shrink-0 text-[10px] text-gray-400 text-center">pinned</span>
              ) : (
                <div className="flex flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => move(col.id, -1)}
                    disabled={idx <= 0}
                    aria-label={`Move ${col.columnDef.header} up`}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-25"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(col.id, 1)}
                    disabled={idx === movable.length - 1}
                    aria-label={`Move ${col.columnDef.header} down`}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-25"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={resetAll}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Reset to default (visibility and order)
      </button>
    </div>
  )
}