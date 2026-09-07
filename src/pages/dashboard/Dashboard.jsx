import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { isOverdue, isUpcoming, UPCOMING_WINDOW_DAYS } from '../../lib/documentStatus'

function daysBetween(dateStr) {
  const today = new Date(new Date().toDateString())
  const target = new Date(dateStr)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

function docLabel(doc) {
  return doc.document_types?.name ?? doc.custom_label ?? 'Untitled document'
}

// ─── Document Row ─────────────────────────────────────────────────────────────
// Links through to that document's project. Requires Projects.jsx to read
// an `edit` query param the same way Beneficiaries.jsx already does —
// see the note below the widget if that hasn't been wired in yet.

function DocRow({ doc, tone }) {
  const project = doc.project_instances
  const days = daysBetween(doc.expected_date)
  const daysLabel = tone === 'overdue'
    ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
    : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`

  return (
    <Link
      to={project ? `/projects?edit=${project.id}` : '#'}
      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
    >
      <div className="min-w-0">
        <div className="text-sm text-gray-700 truncate">{docLabel(doc)}</div>
        <div className="text-xs text-gray-400 truncate">
          {project?.beneficiaries?.name ?? '—'}
          {project?.beneficiaries?.municipality ? ` · ${project.beneficiaries.municipality}` : ''}
          {project ? ` · ${project.year}` : ''}
        </div>
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ml-3 ${tone === 'overdue' ? 'text-red-500' : 'text-amber-600'}`}>
        {daysLabel}
      </span>
    </Link>
  )
}

// ─── Doc List Card ────────────────────────────────────────────────────────────

function DocListCard({ title, docs, tone, emptyText }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className={`px-3 py-2 border-b border-gray-200 flex items-center ${tone === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}>
        <span className={`text-sm font-semibold ${tone === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
          {title}
        </span>
        <span className="ml-2 text-xs text-gray-400">{docs.length}</span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {docs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{emptyText}</p>
        ) : (
          docs.map(doc => <DocRow key={doc.id} doc={doc} tone={tone} />)
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { documents, loading, error } = useAllDocuments()

  const { overdue, upcoming } = useMemo(() => {
    const overdue = documents
      .filter(isOverdue)
      .sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))
    const upcoming = documents
      .filter(doc => isUpcoming(doc))
      .sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))
    return { overdue, upcoming }
  }, [documents])

  if (loading) return <div className="p-6 text-gray-500">Loading dashboard...</div>
  if (error)   return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-4">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <DocListCard
          title="Overdue"
          docs={overdue}
          tone="overdue"
          emptyText="No overdue documents 🎉"
        />
        <DocListCard
          title={`Upcoming (next ${UPCOMING_WINDOW_DAYS} days)`}
          docs={upcoming}
          tone="upcoming"
          emptyText="Nothing due soon"
        />
      </div>

      {/* Placeholder — next sections, in priority order agreed on */}
      <div className="text-xs text-gray-300 italic">
        Coming next: Status &amp; Compliance Snapshot, Attention Flags, Geographic Hotspots.
      </div>
    </div>
  )
}