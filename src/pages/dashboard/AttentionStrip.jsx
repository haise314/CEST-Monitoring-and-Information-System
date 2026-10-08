import { useNavigate } from 'react-router'

// "What needs me today" strip for the top of the Dashboard. Counts are
// computed by the Dashboard and passed in; this only renders them.
// The overdue tile pre-applies the Documents page's "Has overdue documents"
// chip by writing its sessionStorage key (same shape useSessionState reads).

const TONES = {
  red:   { box: 'bg-red-50 border-red-200 hover:border-red-300',       num: 'text-red-700',   label: 'text-red-700' },
  amber: { box: 'bg-amber-50 border-amber-200 hover:border-amber-300', num: 'text-amber-700', label: 'text-amber-700' },
  blue:  { box: 'bg-blue-50 border-blue-200 hover:border-blue-300',    num: 'text-blue-700',  label: 'text-blue-700' },
}

function Tile({ tone, value, label, sub, onClick }) {
  const t = TONES[tone]
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${t.box}`}
    >
      <div className={`text-2xl font-bold tabular-nums leading-none ${t.num}`}>{value}</div>
      <div className={`text-sm font-semibold mt-1.5 ${t.label}`}>{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </button>
  )
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function AttentionStrip({ overdueDocs, overdueProjects, upcomingDocs, unpinned }) {
  const navigate = useNavigate()

  function openOverdue() {
    try {
      sessionStorage.setItem('documentsFilters', JSON.stringify([{ field: 'overdue', value: ['Yes'] }]))
    } catch { /* storage unavailable: just navigate */ }
    navigate('/documents')
  }

  const tiles = []
  if (overdueDocs > 0) {
    tiles.push(
      <Tile key="overdue" tone="red" value={overdueDocs} label="Overdue documents"
        sub={`across ${plural(overdueProjects, 'project')}`} onClick={openOverdue} />
    )
  }
  if (upcomingDocs > 0) {
    tiles.push(
      <Tile key="upcoming" tone="amber" value={upcomingDocs} label="Due in the next 14 days"
        sub="see the Upcoming list below" onClick={() => navigate('/documents')} />
    )
  }
  if (unpinned > 0) {
    tiles.push(
      <Tile key="unpinned" tone="blue" value={unpinned} label="Projects without a map pin"
        sub="needed for visit planning" onClick={() => navigate('/map')} />
    )
  }

  if (tiles.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <strong>All clear.</strong> Nothing overdue or due soon, and every project is pinned.
      </div>
    )
  }

  return (
    <section aria-label="Needs attention">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Needs attention</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{tiles}</div>
    </section>
  )
}
