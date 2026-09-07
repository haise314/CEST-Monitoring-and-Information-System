import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useProjects } from '../../hooks/useProjects'
import { isOverdue, isUpcoming, UPCOMING_WINDOW_DAYS } from '../../lib/documentStatus'
import { computeProgress, progressBarColor, PHASE_ORDER } from '../../lib/documentProgress'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(dateStr) {
  const today = new Date(new Date().toDateString())
  const target = new Date(dateStr)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

function docLabel(doc) {
  return doc.document_types?.name ?? doc.custom_label ?? 'Untitled document'
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
      {title}
    </h2>
  )
}

// ─── SECTION 1: Overdue & Upcoming ───────────────────────────────────────────

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

function DocListCard({ title, docs, tone, emptyText }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className={`px-3 py-2 border-b border-gray-200 flex items-center ${tone === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}>
        <span className={`text-sm font-semibold ${tone === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
          {title}
        </span>
        <span className="ml-2 text-xs text-gray-400">{docs.length}</span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {docs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{emptyText}</p>
        ) : (
          docs.map(doc => <DocRow key={doc.id} doc={doc} tone={tone} />)
        )}
      </div>
    </div>
  )
}

// ─── SECTION 2: Status & Compliance Snapshot ─────────────────────────────────

const OVERALL_STATUS_ORDER = [
  'For Deployment',
  'For Implementation',
  'For Monitoring',
  'For Transfer',
  'Transfer Ongoing',
  'Fully Transferred',
  'For Pull Out',
  'Done',
]

const STATUS_COLORS = {
  'For Deployment':     'bg-yellow-400',
  'For Implementation': 'bg-blue-400',
  'For Monitoring':     'bg-purple-400',
  'For Transfer':       'bg-orange-400',
  'Transfer Ongoing':   'bg-orange-500',
  'Fully Transferred':  'bg-green-400',
  'For Pull Out':       'bg-red-400',
  'Done':               'bg-green-600',
}

function ComplianceBar({ label, pct, completeCount, applicableCount }) {
  const color = progressBarColor(pct)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">
        {completeCount}/{applicableCount} ({pct}%)
      </span>
    </div>
  )
}

function StatusComplianceSection({ documents, projects }) {
  const progress = useMemo(() => computeProgress(documents), [documents])

  const statusCounts = useMemo(() => {
    const counts = {}
    projects.forEach(p => {
      const s = p.overall_status ?? 'Unknown'
      counts[s] = (counts[s] ?? 0) + 1
    })
    return counts
  }, [projects])

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <SectionHeader title="Status & Compliance" />

      {/* Overall compliance */}
      <div className="mb-4">
        <ComplianceBar
          label="Overall"
          pct={progress.overallPct}
          completeCount={progress.totalComplete}
          applicableCount={progress.totalApplicable}
        />
      </div>

      {/* Per-phase compliance */}
      <div className="space-y-2 mb-5">
        {PHASE_ORDER.map(phase => {
          const p = progress.byPhase[phase]
          if (p.applicableCount === 0) return null
          return (
            <ComplianceBar
              key={phase}
              label={phase}
              pct={p.pct}
              completeCount={p.completeCount}
              applicableCount={p.applicableCount}
            />
          )
        })}
      </div>

      {/* Project counts by status */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Projects by Status
        </div>
        <div className="flex flex-wrap gap-2">
          {OVERALL_STATUS_ORDER.filter(s => statusCounts[s]).map(status => (
            <div
              key={status}
              className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[status] ?? 'bg-gray-400'}`} />
              <span className="text-xs text-gray-600">{status}</span>
              <span className="text-xs font-semibold text-gray-800">{statusCounts[status]}</span>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-xs text-gray-400">No projects yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SECTION 3: Attention Flags ───────────────────────────────────────────────

function FlagRow({ label, count, linkTo, linkLabel }) {
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-red-500">{count}</span>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-blue-500 underline whitespace-nowrap">
            {linkLabel ?? 'View →'}
          </Link>
        )}
      </div>
    </div>
  )
}

function AttentionFlagsSection({ projects, documents }) {
  const flags = useMemo(() => {
    // Projects with no category — can't generate docs
    const noCategory = projects.filter(p => !p.project_category)

    // Projects that have a category but zero documents generated
    const projectIdsWithDocs = new Set(
      documents.map(d => d.project_instances?.id).filter(Boolean)
    )
    const categoryButNoDocs = projects.filter(
      p => p.project_category && !projectIdsWithDocs.has(p.id)
    )

    // Projects with overall_status still at default (For Deployment) but
    // deployed more than 30 days ago — likely forgot to update status
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const staleDeployment = projects.filter(p =>
      p.overall_status === 'For Deployment' &&
      p.date_deployed &&
      new Date(p.date_deployed) < thirtyDaysAgo
    )

    return { noCategory, categoryButNoDocs, staleDeployment }
  }, [projects, documents])

  const totalFlags = flags.noCategory.length + flags.categoryButNoDocs.length + flags.staleDeployment.length

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <SectionHeader title="Attention Flags" />
      {totalFlags === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No flags — everything looks good 🎉</p>
      ) : (
        <div>
          <FlagRow
            label="Projects missing a category (can't generate docs)"
            count={flags.noCategory.length}
            linkTo="/projects"
            linkLabel="Go to Projects →"
          />
          <FlagRow
            label="Projects with category but no documents generated"
            count={flags.categoryButNoDocs.length}
            linkTo="/projects"
            linkLabel="Go to Projects →"
          />
          <FlagRow
            label="Still 'For Deployment' but deployed 30+ days ago"
            count={flags.staleDeployment.length}
            linkTo="/projects"
            linkLabel="Go to Projects →"
          />
        </div>
      )}
    </div>
  )
}

// ─── SECTION 4: Geographic Hotspots ──────────────────────────────────────────

function GeographicHotspotsSection({ documents }) {
  const hotspots = useMemo(() => {
    const counts = {}
    documents
      .filter(isOverdue)
      .forEach(doc => {
        const muni = doc.project_instances?.beneficiaries?.municipality
        if (!muni) return
        counts[muni] = (counts[muni] ?? 0) + 1
      })

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8) // top 8
  }, [documents])

  const max = hotspots[0]?.[1] ?? 1

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <SectionHeader title="Geographic Hotspots — Overdue Documents" />
      {hotspots.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No overdue documents 🎉</p>
      ) : (
        <div className="space-y-2">
          {hotspots.map(([muni, count]) => (
            <div key={muni} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-32 flex-shrink-0 truncate">{muni}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full transition-all"
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </div>
              <Link
                to={`/documents?municipality=${encodeURIComponent(muni)}&submitted=No`}
                className="text-xs font-semibold text-red-500 w-12 text-right flex-shrink-0 hover:underline"
              >
                {count}
              </Link>
            </div>
          ))}
          <p className="text-xs text-gray-400 mt-1">
            Click a count to filter the Documents page to that municipality.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { documents, loading: docsLoading, error: docsError } = useAllDocuments()
  const { projects, loading: projLoading, error: projError  } = useProjects()

  const { overdue, upcoming } = useMemo(() => {
    const overdue = documents
      .filter(isOverdue)
      .sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))
    const upcoming = documents
      .filter(doc => isUpcoming(doc))
      .sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))
    return { overdue, upcoming }
  }, [documents])

  if (docsLoading || projLoading) return <div className="p-6 text-gray-500">Loading dashboard...</div>
  if (docsError)   return <div className="p-6 text-red-500">Error: {docsError}</div>
  if (projError)   return <div className="p-6 text-red-500">Error: {projError}</div>

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-800 mb-5">Dashboard</h1>

      {/* Row 1: Overdue + Upcoming */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
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

      {/* Row 2: Status & Compliance + Attention Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <StatusComplianceSection documents={documents} projects={projects} />
        <AttentionFlagsSection projects={projects} documents={documents} />
      </div>

      {/* Row 3: Geographic Hotspots — full width */}
      <GeographicHotspotsSection documents={documents} />
    </div>
  )
}