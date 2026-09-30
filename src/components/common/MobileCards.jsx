// Phone-friendly replacement for the data tables. Pages render BOTH the
// table (hidden below md) and a MobileCardList (hidden from md up), so the
// switch is pure CSS — no resize listeners, and sorting/filtering/pagination
// keep working because the cards are built from the same TanStack rows.

export function MobileCardList({ isEmpty, emptyText = 'Nothing found', children }) {
  return (
    <div className="md:hidden space-y-2">
      {isEmpty ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          {emptyText}
        </div>
      ) : children}
    </div>
  )
}

// Whole card is tappable. Links/buttons inside must call e.stopPropagation()
// so they don't also trigger onClick.
export function MobileCard({ onClick, children }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className="rounded-xl border border-gray-200 bg-white shadow-sm p-3.5 cursor-pointer active:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {children}
    </div>
  )
}

export function Pill({ children, className = 'bg-gray-100 text-gray-700' }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}