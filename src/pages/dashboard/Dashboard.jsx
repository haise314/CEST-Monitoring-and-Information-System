import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useProjects } from '../../hooks/useProjects'
import { useBeneficiaries } from '../../hooks/useBeneficiaries'
import { useAllRemarks } from '../../hooks/useAllRemarks'
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

function projectLabel(p) {
  return p?.title || p?.project_types?.name || 'Untitled project'
}

function peso(n) {
  return `₱${Math.round(n).toLocaleString()}`
}

// Relative time ("5m ago", "3d ago") — used by Recent Activity and
// Recently Updated, both of which show a timestamp people should be able
// to scan at a glance rather than parse a full date string.
function formatTimeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, hint }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// One card surface for the whole page so borders, radius, and shadow never
// drift between sections. `flush` drops the padding for list-style cards
// that draw their own header bar and scroll area.
function Card({ children, flush = false, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${flush ? '' : 'p-5'} ${className}`}>
      {children}
    </div>
  )
}

// Header bar for list-style cards (Overdue, Upcoming, Recent Activity).
function CardBar({ title, count, tone = 'neutral' }) {
  const tones = {
    overdue:  { bar: 'bg-red-50 border-red-100',     title: 'text-red-700',   pill: 'bg-red-100 text-red-700' },
    upcoming: { bar: 'bg-amber-50 border-amber-100', title: 'text-amber-700', pill: 'bg-amber-100 text-amber-700' },
    neutral:  { bar: 'bg-gray-50 border-gray-100',   title: 'text-gray-700',  pill: 'bg-gray-200 text-gray-600' },
  }
  const t = tones[tone]
  return (
    <div className={`px-4 py-2.5 border-b flex items-center justify-between ${t.bar}`}>
      <span className={`text-sm font-semibold ${t.title}`}>{title}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.pill}`}>{count}</span>
    </div>
  )
}

function EmptyNote({ children }) {
  return <p className="text-sm text-gray-400 text-center py-8">{children}</p>
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
// Simple nav shortcuts rather than deep-linking straight into an open Add
// modal — that version would need ?add=1 support added to Projects.jsx and
// Beneficiaries.jsx, deliberately out of scope for this pass.

function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Link
        to="/projects"
        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50/40 transition-colors flex items-center gap-3"
      >
        <span className="text-2xl" aria-hidden="true">📁</span>
        <div>
          <div className="text-sm font-semibold text-gray-800">Add Project</div>
          <div className="text-xs text-gray-400">Opens Projects, then + Add Project</div>
        </div>
      </Link>
      <Link
        to="/beneficiaries"
        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50/40 transition-colors flex items-center gap-3"
      >
        <span className="text-2xl" aria-hidden="true">🏘️</span>
        <div>
          <div className="text-sm font-semibold text-gray-800">Add Beneficiary</div>
          <div className="text-xs text-gray-400">Opens Beneficiaries, then + Add Beneficiary</div>
        </div>
      </Link>
    </div>
  )
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-800 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function KpiRow({ projects, beneficiaryCount, progress, totalAmount }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total projects" value={projects.length} />
      <KpiCard label="Beneficiaries" value={beneficiaryCount} />
      <KpiCard
        label="Overall compliance"
        value={`${progress.overallPct}%`}
        sub={`${progress.totalComplete}/${progress.totalApplicable} docs`}
      />
      <KpiCard label="Total deployed" value={peso(totalAmount)} />
    </div>
  )
}

// ─── SECTION: Overdue & Upcoming ─────────────────────────────────────────────

function DocRow({ doc, tone }) {
  const project = doc.project_instances
  const days = daysBetween(doc.expected_date)
  const daysLabel = tone === 'overdue'
    ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
    : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`

  return (
    <Link
      to={project ? `/projects?edit=${project.id}` : '#'}
      className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
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
    <Card flush>
      <CardBar title={title} count={docs.length} tone={tone} />
      <div className="max-h-72 overflow-y-auto">
        {docs.length === 0 ? (
          <EmptyNote>{emptyText}</EmptyNote>
        ) : (
          docs.map(doc => <DocRow key={doc.id} doc={doc} tone={tone} />)
        )}
      </div>
    </Card>
  )
}

// ─── SECTION: Recent Activity (Remarks) ──────────────────────────────────────

const LEVEL_COLORS = {
  provincial: 'bg-blue-100 text-blue-700',
  regional:   'bg-purple-100 text-purple-700',
  pcest:      'bg-teal-100 text-teal-700',
  rcest:      'bg-indigo-100 text-indigo-700',
}

function RemarkRow({ remark }) {
  const project = remark.project_instances
  return (
    <Link
      to={project ? `/projects/${project.id}` : '#'}
      className="block px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${LEVEL_COLORS[remark.level] ?? 'bg-gray-100 text-gray-600'}`}>
          {remark.level}
        </span>
        <span className="text-xs text-gray-400 truncate">
          {project ? projectLabel(project) : 'Unknown project'}
          {project?.beneficiaries?.name ? ` · ${project.beneficiaries.name}` : ''}
        </span>
      </div>
      <p className="text-sm text-gray-700 line-clamp-2">{remark.content}</p>
      <div className="text-xs text-gray-400 mt-0.5">
        {remark.added_by ?? 'Unknown'} · {formatTimeAgo(remark.created_at)}
      </div>
    </Link>
  )
}

function RecentActivitySection({ remarks }) {
  return (
    <Card flush>
      <CardBar title="Recent activity" count={remarks.length} />
      <div className="max-h-72 overflow-y-auto">
        {remarks.length === 0 ? (
          <EmptyNote>No remarks yet. Post one from a project page.</EmptyNote>
        ) : (
          remarks.map(r => <RemarkRow key={r.id} remark={r} />)
        )}
      </div>
    </Card>
  )
}

// ─── SECTION: Recently Updated Projects ──────────────────────────────────────
// Relies on project_instances.updated_at self-stamping via a trigger — if
// that trigger isn't live yet, this will just reflect insertion time until
// it is. See the migration note handed off separately.

function RecentlyUpdatedSection({ projects }) {
  const recent = useMemo(() =>
    [...projects]
      .filter(p => p.updated_at)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 8)
  , [projects])

  return (
    <Card>
      <SectionHeader title="Recently updated projects" />
      {recent.length === 0 ? (
        <EmptyNote>No recent updates</EmptyNote>
      ) : (
        <div>
          {recent.map(p => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
            >
              <div className="min-w-0">
                <div className="text-sm text-gray-700 truncate">{projectLabel(p)}</div>
                <div className="text-xs text-gray-400 truncate">
                  {p.beneficiaries?.name ?? '—'} · {p.year}
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap ml-3">
                {formatTimeAgo(p.updated_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── SECTION: Status & Compliance Snapshot ───────────────────────────────────

function ComplianceBar({ label, pct, completeCount, applicableCount }) {
  const color = progressBarColor(pct)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-32 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-24 text-right flex-shrink-0 tabular-nums">
        {completeCount}/{applicableCount} ({pct}%)
      </span>
    </div>
  )
}

function StatusComplianceSection({ documents }) {
  const progress = useMemo(() => computeProgress(documents), [documents])

  return (
    <Card>
      <SectionHeader title="Compliance by phase" />

      <div className="mb-4">
        <ComplianceBar
          label="Overall"
          pct={progress.overallPct}
          completeCount={progress.totalComplete}
          applicableCount={progress.totalApplicable}
        />
      </div>

      <div className="space-y-2">
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
    </Card>
  )
}

// ─── SECTION: Attention Flags ─────────────────────────────────────────────────

function FlagRow({ label, count, linkTo, linkLabel }) {
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
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
    const noCategory = projects.filter(p => !p.project_category)

    const projectIdsWithDocs = new Set(
      documents.map(d => d.project_instances?.id).filter(Boolean)
    )
    const categoryButNoDocs = projects.filter(
      p => p.project_category && !projectIdsWithDocs.has(p.id)
    )

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
    <Card>
      <SectionHeader title="Needs attention" />
      {totalFlags === 0 ? (
        <EmptyNote>Nothing flagged. Every project has a category and a checklist.</EmptyNote>
      ) : (
        <div>
          <FlagRow
            label="Projects missing a category (checklist can't be generated)"
            count={flags.noCategory.length}
            linkTo="/projects"
            linkLabel="Go to Projects →"
          />
          <FlagRow
            label="Projects with a category but no checklist yet"
            count={flags.categoryButNoDocs.length}
            linkTo="/projects"
            linkLabel="Go to Projects →"
          />
          <FlagRow
            label="Still 'For Deployment' 30+ days after deploy date"
            count={flags.staleDeployment.length}
            linkTo="/projects"
            linkLabel="Go to Projects →"
          />
        </div>
      )}
    </Card>
  )
}

// ─── SECTION: Charts (status distribution + year trend) ─────────────────────
// Plain CSS bars, no charting library — consistent with the progress bars
// already used everywhere else in the app.

const OVERALL_STATUS_ORDER = [
  'For Deployment', 'For Implementation', 'For Monitoring', 'For Transfer',
  'Transfer Ongoing', 'Fully Transferred', 'For Pull Out', 'Done',
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

function BarChart({ data, colorFor, formatValue }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-32 flex-shrink-0 truncate">{d.label}</span>
          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${colorFor ? colorFor(d.label) : 'bg-blue-400'}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-20 text-right flex-shrink-0 tabular-nums">
            {formatValue ? formatValue(d.value) : d.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartsSection({ projects }) {
  const statusData = useMemo(() => {
    const counts = {}
    projects.forEach(p => {
      const s = p.overall_status ?? 'Unknown'
      counts[s] = (counts[s] ?? 0) + 1
    })
    return OVERALL_STATUS_ORDER.filter(s => counts[s]).map(s => ({ label: s, value: counts[s] }))
  }, [projects])

  const yearData = useMemo(() => {
    const counts = {}
    projects.forEach(p => {
      counts[p.year] = (counts[p.year] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, value]) => ({ label: year, value }))
  }, [projects])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <SectionHeader title="Projects by status" />
        {statusData.length === 0
          ? <EmptyNote>No projects yet</EmptyNote>
          : <BarChart data={statusData} colorFor={s => STATUS_COLORS[s] ?? 'bg-gray-400'} />}
      </Card>
      <Card>
        <SectionHeader title="Projects per year" />
        {yearData.length === 0
          ? <EmptyNote>No projects yet</EmptyNote>
          : <BarChart data={yearData} />}
      </Card>
    </div>
  )
}

// ─── SECTION: Budget Rollup ───────────────────────────────────────────────────

function BudgetRollupSection({ projects }) {
  const totalAmount = useMemo(
    () => projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [projects]
  )

  const byYear = useMemo(() => {
    const sums = {}
    projects.forEach(p => {
      if (p.amount == null) return
      sums[p.year] = (sums[p.year] ?? 0) + Number(p.amount)
    })
    return Object.entries(sums)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, value]) => ({ label: year, value }))
  }, [projects])

  const byCategory = useMemo(() => {
    const sums = {}
    projects.forEach(p => {
      if (p.amount == null) return
      const cat = p.project_category ?? 'Uncategorized'
      sums[cat] = (sums[cat] ?? 0) + Number(p.amount)
    })
    return Object.entries(sums).map(([label, value]) => ({ label, value }))
  }, [projects])

  const categoryColor = c =>
    c === 'In-house' ? 'bg-indigo-400' : c === 'Fund Transfer' ? 'bg-teal-400' : 'bg-gray-400'

  return (
    <Card>
      <SectionHeader title="Budget rollup" />
      <div className="text-2xl font-bold text-gray-800 tabular-nums mb-4">{peso(totalAmount)}</div>
      {totalAmount === 0 ? (
        <EmptyNote>No amounts recorded yet</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">By year</div>
            <BarChart data={byYear} formatValue={peso} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">By category</div>
            <BarChart data={byCategory} formatValue={peso} colorFor={categoryColor} />
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── SECTION: Geographic Hotspots ────────────────────────────────────────────

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
      .slice(0, 8)
  }, [documents])

  const max = hotspots[0]?.[1] ?? 1

  return (
    <Card>
      <SectionHeader title="Overdue documents by municipality" hint="Top 8 municipalities by number of overdue documents." />
      {hotspots.length === 0 ? (
        <EmptyNote>No overdue documents.</EmptyNote>
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
              <span className="text-xs font-semibold text-red-500 w-12 text-right flex-shrink-0 tabular-nums">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { documents, loading: docsLoading, error: docsError } = useAllDocuments()
  const { projects, loading: projLoading, error: projError } = useProjects()
  const { beneficiaries, loading: benLoading, error: benError } = useBeneficiaries()
  const { remarks, loading: remarksLoading } = useAllRemarks(10)

  const { overdue, upcoming } = useMemo(() => {
    const overdue = documents
      .filter(isOverdue)
      .sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))
    const upcoming = documents
      .filter(doc => isUpcoming(doc))
      .sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))
    return { overdue, upcoming }
  }, [documents])

  const progress = useMemo(() => computeProgress(documents), [documents])
  const totalAmount = useMemo(
    () => projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [projects]
  )

  const loading = docsLoading || projLoading || benLoading
  const error = docsError || projError || benError

  if (loading) return <div className="max-w-6xl mx-auto p-6 text-gray-500 text-sm">Loading dashboard...</div>
  if (error)   return <div className="max-w-6xl mx-auto p-6 text-red-500 text-sm">Error: {error}</div>

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-6xl mx-auto w-full space-y-5 pb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-sm text-gray-400">{today}</span>
      </div>

      <QuickActions />

      <KpiRow
        projects={projects}
        beneficiaryCount={beneficiaries.length}
        progress={progress}
        totalAmount={totalAmount}
      />

      {/* Overdue + Upcoming */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Recent Activity + Recently Updated */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {remarksLoading
          ? <Card><EmptyNote>Loading activity...</EmptyNote></Card>
          : <RecentActivitySection remarks={remarks} />}
        <RecentlyUpdatedSection projects={projects} />
      </div>

      {/* Status & Compliance + Attention Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusComplianceSection documents={documents} />
        <AttentionFlagsSection projects={projects} documents={documents} />
      </div>

      {/* Charts */}
      <ChartsSection projects={projects} />

      {/* Budget Rollup */}
      <BudgetRollupSection projects={projects} />

      {/* Overdue hotspots — full width, bottom */}
      <GeographicHotspotsSection documents={documents} />
    </div>
  )
}