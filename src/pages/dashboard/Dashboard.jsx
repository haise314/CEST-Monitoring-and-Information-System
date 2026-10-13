import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useProjects } from '../../hooks/useProjects'
import { useBeneficiaries } from '../../hooks/useBeneficiaries'
import { useAllRemarks } from '../../hooks/useAllRemarks'
import { useBudgets } from '../../hooks/useBudgets'
import { useLocalState } from '../../hooks/useLocalState'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { summarizeYear, formatPeso, budgetBarColor } from '../../lib/budget'
import { isOverdue, isUpcoming, getDocStatus, UPCOMING_WINDOW_DAYS } from '../../lib/documentStatus'
import { computeProgress, progressBarColor, PHASE_ORDER } from '../../lib/documentProgress'
import { DashboardSkeleton } from '../../components/common/Skeleton'
import AttentionStrip from './AttentionStrip'
import { implementingAgency, projectOwnerName } from '../../lib/projectAgencies'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(dateStr) {
  const today = new Date(new Date().toDateString())
  return Math.round((new Date(dateStr) - today) / (1000 * 60 * 60 * 24))
}

const docLabel = doc => doc.document_types?.name ?? doc.custom_label ?? 'Untitled document'
const projectLabel = p => p?.title || p?.project_types?.name || 'Untitled project'
const peso = n => `₱${Math.round(n).toLocaleString()}`

function formatTimeAgo(dateStr) {
  if (!dateStr) return '—'
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function SectionHeader({ title, hint }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

function Card({ children, flush = false, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${flush ? '' : 'p-5'} ${className}`}>
      {children}
    </div>
  )
}

function CardBar({ title, count, tone = 'neutral' }) {
  const tones = {
    overdue:  { bar: 'bg-red-50 border-red-100',     title: 'text-red-700',   pill: 'bg-red-100 text-red-700' },
    upcoming: { bar: 'bg-amber-50 border-amber-100', title: 'text-amber-700', pill: 'bg-amber-100 text-amber-700' },
    info:     { bar: 'bg-blue-50 border-blue-100',   title: 'text-blue-700',  pill: 'bg-blue-100 text-blue-700' },
    neutral:  { bar: 'bg-gray-50 border-gray-100',   title: 'text-gray-700',  pill: 'bg-gray-200 text-gray-600' },
  }
  const t = tones[tone]
  return (
    <div className={`px-4 py-2.5 border-b flex items-center justify-between flex-shrink-0 ${t.bar}`}>
      <span className={`text-sm font-semibold ${t.title}`}>{title}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.pill}`}>{count}</span>
    </div>
  )
}

// Fixed-height list card: header + optional toolbar stay put, the list fills
// the remaining space and scrolls inside it. Every list on the dashboard uses
// this, so paired cards are always the same height and never leave dead space.
function ListPanel({ title, count, tone, toolbar, children }) {
  return (
    <Card flush className="flex flex-col h-[22rem]">
      <CardBar title={title} count={count} tone={tone} />
      {toolbar}
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </Card>
  )
}

function EmptyNote({ children }) {
  return <p className="text-sm text-gray-500 text-center py-8 px-4">{children}</p>
}

function Collapsible({ title, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 py-2 border-b border-gray-200"
      >
        <span className="text-xs text-gray-400 w-3">{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open && <div className="space-y-5 pt-5">{children}</div>}
    </div>
  )
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-800 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function KpiRow({ projects, beneficiaryCount, progress, totalAmount }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total projects" value={projects.length} />
      <KpiCard label="Organizations" value={beneficiaryCount} />
      <KpiCard
        label="Overall compliance"
        value={`${progress.overallPct}%`}
        sub={`${progress.totalComplete}/${progress.totalApplicable} docs`}
      />
      <KpiCard label="Total deployed" value={peso(totalAmount)} />
    </div>
  )
}

// ─── Pinned remarks (to-do list) + Recent activity ───────────────────────────

const LEVEL_COLORS = {
  provincial: 'bg-blue-100 text-blue-700',
  regional:   'bg-purple-100 text-purple-700',
}

function RemarkItem({ remark, canPin, onTogglePin }) {
  const project = remark.project_instances
  const pinned = Boolean(remark.pinned_at)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    await onTogglePin(remark.id, !pinned)
    setBusy(false)
  }

  return (
    <div className="flex items-start gap-2 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <Link to={project ? `/projects/${project.id}` : '#'} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${LEVEL_COLORS[remark.level] ?? 'bg-gray-100 text-gray-600'}`}>
            {remark.level}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {project ? projectLabel(project) : 'Unknown project'}
            {projectOwnerName(project) ? ` · ${projectOwnerName(project)}` : ''}
          </span>
        </div>
        <p className="text-sm text-gray-700 line-clamp-2 whitespace-pre-wrap">{remark.content}</p>
        <div className="text-xs text-gray-500 mt-0.5">
          {remark.author_name} · {formatTimeAgo(remark.created_at)}
        </div>
      </Link>
      {canPin && (
        <button
          onClick={toggle}
          disabled={busy}
          title={pinned ? 'Unpin (mark as done)' : 'Pin to the to-do list'}
          className={`text-xs flex-shrink-0 px-2 py-1 rounded border disabled:opacity-50 ${
            pinned
              ? 'border-gray-300 text-gray-600 hover:bg-gray-100'
              : 'border-transparent text-gray-400 hover:text-blue-600 hover:bg-blue-50'
          }`}
        >
          {pinned ? 'Unpin' : '📌 Pin'}
        </button>
      )}
    </div>
  )
}

function PinnedRemarksPanel({ pinned, error, canPin, onTogglePin }) {
  return (
    <ListPanel title="📌 Pinned remarks (to-do)" count={pinned.length} tone="info">
      {error ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded m-3 px-3 py-2">
          Pinning isn't set up yet. Run <code>migrations/07_remark_pinning.sql</code> in Supabase.
        </p>
      ) : pinned.length === 0 ? (
        <EmptyNote>Nothing pinned. Pin a remark (here, or on a project's Remarks section) to keep it on this list until it's done.</EmptyNote>
      ) : (
        pinned.map(r => <RemarkItem key={r.id} remark={r} canPin={canPin} onTogglePin={onTogglePin} />)
      )}
    </ListPanel>
  )
}

function RecentActivityPanel({ remarks, canPin, onTogglePin }) {
  return (
    <ListPanel title="Recent activity" count={remarks.length}>
      {remarks.length === 0 ? (
        <EmptyNote>No remarks yet. Post one from a project page.</EmptyNote>
      ) : (
        remarks.map(r => <RemarkItem key={r.id} remark={r} canPin={canPin} onTogglePin={onTogglePin} />)
      )}
    </ListPanel>
  )
}

// ─── Documents in progress (links with a draft / checking / signing stage) ───

const STAGES = [
  { id: 'signing',  label: 'For signing',  pill: 'bg-purple-100 text-purple-800' },
  { id: 'checking', label: 'For checking', pill: 'bg-orange-100 text-orange-800' },
  { id: 'draft',    label: 'Draft',        pill: 'bg-gray-200 text-gray-700' },
]
const STAGE_BY_ID = Object.fromEntries(STAGES.map(s => [s.id, s]))

function InProgressDocsPanel({ documents }) {
  const [tab, setTab] = useState('all')

  const byStage = useMemo(() => {
    const m = { signing: [], checking: [], draft: [] }
    documents.forEach(d => {
      const s = getDocStatus(d) // already excludes N/A, submitted, hard copy, final soft copy, claimable
      if (m[s]) m[s].push(d)
    })
    // longest-untouched first
    Object.values(m).forEach(list => list.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at)))
    return m
  }, [documents])

  const total = byStage.signing.length + byStage.checking.length + byStage.draft.length
  const shown = tab === 'all' ? [...byStage.signing, ...byStage.checking, ...byStage.draft] : byStage[tab]

  const tabBtn = (id, label, n) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        tab === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label} <span className="opacity-75">{n}</span>
    </button>
  )

  const toolbar = (
    <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 overflow-x-auto flex-shrink-0">
      {tabBtn('all', 'All', total)}
      {STAGES.map(s => tabBtn(s.id, s.label, byStage[s.id].length))}
    </div>
  )

  return (
    <ListPanel title="Documents in progress" count={total} toolbar={toolbar}>
      {shown.length === 0 ? (
        <EmptyNote>{total === 0 ? 'No documents are being drafted, checked or signed.' : 'Nothing at this stage.'}</EmptyNote>
      ) : (
        shown.map(doc => {
          const project = doc.project_instances
          const stage = STAGE_BY_ID[getDocStatus(doc)]
          return (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <Link to={project ? `/projects/${project.id}` : '#'} className="flex-1 min-w-0">
                <div className="text-sm text-gray-700 truncate">{docLabel(doc)}</div>
                <div className="text-xs text-gray-500 truncate">
                  {projectOwnerName(project) ?? '—'}
                  {project?.beneficiaries?.municipality ? ` · ${project.beneficiaries.municipality}` : ''}
                  {project ? ` · ${project.year}` : ''}
                </div>
              </Link>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${stage.pill}`}>{stage.label}</span>
                <span className="text-[11px] text-gray-500 whitespace-nowrap" title="Last edited">
                  {isOverdue(doc) && <span className="text-red-500 font-medium">Overdue · </span>}
                  {formatTimeAgo(doc.updated_at)}
                </span>
              </div>
              {doc.gdrive_link && (
                <a href={doc.gdrive_link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline flex-shrink-0">
                  Open
                </a>
              )}
            </div>
          )
        })
      )}
    </ListPanel>
  )
}

// ─── Overdue & Upcoming ──────────────────────────────────────────────────────

function DocRow({ doc, tone }) {
  const project = doc.project_instances
  const days = daysBetween(doc.expected_date)
  const daysLabel = tone === 'overdue'
    ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
    : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`

  return (
    <Link
      to={project ? `/projects/${project.id}` : '#'}
      className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
    >
      <div className="min-w-0">
        <div className="text-sm text-gray-700 truncate">{docLabel(doc)}</div>
        <div className="text-xs text-gray-500 truncate">
          {projectOwnerName(project) ?? '—'}
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

function DocListPanel({ title, docs, tone, emptyText }) {
  return (
    <ListPanel title={title} count={docs.length} tone={tone}>
      {docs.length === 0 ? <EmptyNote>{emptyText}</EmptyNote> : docs.map(doc => <DocRow key={doc.id} doc={doc} tone={tone} />)}
    </ListPanel>
  )
}

// ─── Recently updated projects ───────────────────────────────────────────────

function RecentlyUpdatedPanel({ projects }) {
  const recent = useMemo(() =>
    [...projects]
      .filter(p => p.updated_at)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 20)
  , [projects])

  return (
    <ListPanel title="Recently updated projects" count={recent.length}>
      {recent.length === 0 ? (
        <EmptyNote>No recent updates</EmptyNote>
      ) : (
        recent.map(p => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50"
          >
            <div className="min-w-0">
              <div className="text-sm text-gray-700 truncate">{projectLabel(p)}</div>
              <div className="text-xs text-gray-500 truncate">{projectOwnerName(p) ?? '—'} · {p.year}</div>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap ml-3">{formatTimeAgo(p.updated_at)}</span>
          </Link>
        ))
      )}
    </ListPanel>
  )
}

// ─── Compliance by phase ─────────────────────────────────────────────────────

function ComplianceBar({ label, pct, completeCount, applicableCount }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-32 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${progressBarColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0 tabular-nums">
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
        <ComplianceBar label="Overall" pct={progress.overallPct} completeCount={progress.totalComplete} applicableCount={progress.totalApplicable} />
      </div>
      <div className="space-y-2">
        {PHASE_ORDER.map(phase => {
          const p = progress.byPhase[phase]
          if (p.applicableCount === 0) return null
          return <ComplianceBar key={phase} label={phase} pct={p.pct} completeCount={p.completeCount} applicableCount={p.applicableCount} />
        })}
      </div>
    </Card>
  )
}

// ─── Data checks ─────────────────────────────────────────────────────────────

function FlagRow({ label, count, linkTo, linkLabel }) {
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-red-500">{count}</span>
        {linkTo && <Link to={linkTo} className="text-xs text-blue-500 underline whitespace-nowrap">{linkLabel ?? 'View →'}</Link>}
      </div>
    </div>
  )
}

function DataChecksSection({ projects, documents }) {
  const flags = useMemo(() => {
    const noCategory = projects.filter(p => !p.project_category)
    const withDocs = new Set(documents.map(d => d.project_instances?.id).filter(Boolean))
    const categoryButNoDocs = projects.filter(p => p.project_category && !withDocs.has(p.id))
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const staleDeployment = projects.filter(p =>
      p.overall_status === 'For Deployment' && p.date_deployed && new Date(p.date_deployed) < cutoff
    )
    return { noCategory, categoryButNoDocs, staleDeployment }
  }, [projects, documents])

  const total = flags.noCategory.length + flags.categoryButNoDocs.length + flags.staleDeployment.length

  return (
    <Card>
      <SectionHeader title="Data checks" hint="Records that need tidying up" />
      {total === 0 ? (
        <EmptyNote>All clear. Every project has a category and a checklist.</EmptyNote>
      ) : (
        <div>
          <FlagRow label="Projects missing a category (checklist can't be generated)" count={flags.noCategory.length} linkTo="/projects" linkLabel="Go to Projects →" />
          <FlagRow label="Projects with a category but no checklist yet" count={flags.categoryButNoDocs.length} linkTo="/projects" linkLabel="Go to Projects →" />
          <FlagRow label="Still 'For Deployment' 30+ days after deploy date" count={flags.staleDeployment.length} linkTo="/projects" linkLabel="Go to Projects →" />
        </div>
      )}
    </Card>
  )
}

// ─── Charts ──────────────────────────────────────────────────────────────────

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
            <div className={`h-full rounded transition-all ${colorFor ? colorFor(d.label) : 'bg-blue-400'}`} style={{ width: `${(d.value / max) * 100}%` }} />
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
    projects.forEach(p => { const s = p.overall_status ?? 'Unknown'; counts[s] = (counts[s] ?? 0) + 1 })
    return OVERALL_STATUS_ORDER.filter(s => counts[s]).map(s => ({ label: s, value: counts[s] }))
  }, [projects])

  const yearData = useMemo(() => {
    const counts = {}
    projects.forEach(p => { counts[p.year] = (counts[p.year] ?? 0) + 1 })
    return Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b)).map(([year, value]) => ({ label: year, value }))
  }, [projects])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <SectionHeader title="Projects by status" />
        {statusData.length === 0 ? <EmptyNote>No projects yet</EmptyNote> : <BarChart data={statusData} colorFor={s => STATUS_COLORS[s] ?? 'bg-gray-400'} />}
      </Card>
      <Card>
        <SectionHeader title="Projects per year" />
        {yearData.length === 0 ? <EmptyNote>No projects yet</EmptyNote> : <BarChart data={yearData} />}
      </Card>
    </div>
  )
}

// ─── Budget rollup / current-year budget ─────────────────────────────────────

function BudgetRollupSection({ projects, totalAmount }) {
  const byYear = useMemo(() => {
    const sums = {}
    projects.forEach(p => { if (p.amount != null) sums[p.year] = (sums[p.year] ?? 0) + Number(p.amount) })
    return Object.entries(sums).sort(([a], [b]) => Number(a) - Number(b)).map(([year, value]) => ({ label: year, value }))
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

  const categoryColor = c => (c === 'In-house' ? 'bg-indigo-400' : c === 'Fund Transfer' ? 'bg-teal-400' : 'bg-gray-400')

  return (
    <Card>
      <SectionHeader title="Budget rollup (all scopes)" />
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

function BudgetCard({ projects }) {
  const { isAdmin } = useAuth()
  const { budgets, loading, error } = useBudgets()
  const year = new Date().getFullYear()

  const budget = budgets.find(b => Number(b.year) === year) ?? null
  const summary = useMemo(
    () => summarizeYear(projects, year, budget ? Number(budget.allocated_amount) : null),
    [projects, year, budget]
  )
  const { allocated, used, remaining, pct, over, missingAmount } = summary

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <SectionHeader title={`${year} budget`} hint="Provincial projects only" />
        <Link to="/budget" className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap">View details →</Link>
      </div>

      {loading ? (
        <EmptyNote>Loading budget...</EmptyNote>
      ) : error ? (
        <p className="text-sm text-red-500">Could not load the budget: {error}</p>
      ) : allocated == null ? (
        <p className="text-sm text-gray-500">
          No budget set for {year} yet.{' '}
          {isAdmin ? <Link to="/budget" className="text-blue-500 underline">Set it on the Budget page</Link> : 'An admin can set it.'}
        </p>
      ) : (
        <>
          {over && (
            <div role="alert" className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <strong>Over budget by {formatPeso(Math.abs(remaining))}.</strong>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Budget</div>
              <div className="text-lg sm:text-xl font-bold text-gray-800 tabular-nums">{formatPeso(allocated)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Used</div>
              <div className="text-lg sm:text-xl font-bold text-gray-800 tabular-nums">{formatPeso(used)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Remaining</div>
              <div className={`text-lg sm:text-xl font-bold tabular-nums ${remaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>{formatPeso(remaining)}</div>
            </div>
          </div>
          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${budgetBarColor(pct)}`} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
          </div>
          {missingAmount.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              {missingAmount.length} Provincial project{missingAmount.length === 1 ? ' has' : 's have'} no amount entered and
              {missingAmount.length === 1 ? ' is' : ' are'} not counted.
            </p>
          )}
        </>
      )}
    </Card>
  )
}

// ─── Hotspots / agency breakdown ─────────────────────────────────────────────

function GeographicHotspotsSection({ documents }) {
  const hotspots = useMemo(() => {
    const counts = {}
    documents.filter(isOverdue).forEach(doc => {
      const muni = doc.project_instances?.beneficiaries?.municipality
      if (muni) counts[muni] = (counts[muni] ?? 0) + 1
    })
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 8)
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
                <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${Math.round((count / max) * 100)}%` }} />
              </div>
              <span className="text-xs font-semibold text-red-500 w-12 text-right flex-shrink-0 tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

const NO_AGENCY = '(No implementing agency)'

function AgencyBreakdownSection({ projects, documents }) {
  const rows = useMemo(() => {
    const docsByProject = {}
    documents.forEach(d => { (docsByProject[d.project_id] ??= []).push(d) })
    const map = new Map()
    projects.forEach(p => {
      const name = implementingAgency(p) ?? NO_AGENCY
      if (!map.has(name)) map.set(name, { name, count: 0, amount: 0, docs: [] })
      const r = map.get(name)
      r.count += 1
      r.amount += Number(p.amount) || 0
      r.docs.push(...(docsByProject[p.id] ?? []))
    })
    return [...map.values()]
      .map(r => ({ ...r, pct: computeProgress(r.docs).overallPct, hasDocs: r.docs.length > 0, overdue: r.docs.filter(isOverdue).length }))
      .sort((a, b) => (a.name === NO_AGENCY) - (b.name === NO_AGENCY) || b.count - a.count || a.name.localeCompare(b.name))
  }, [projects, documents])

  return (
    <Card flush>
      <CardBar title="Projects by implementing agency" count={rows.length} />
      {rows.length === 0 ? (
        <EmptyNote>No projects yet</EmptyNote>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-2">Agency</th>
                <th className="text-right font-medium px-4 py-2">Projects</th>
                <th className="text-right font-medium px-4 py-2">Amount</th>
                <th className="text-right font-medium px-4 py-2">Compliance</th>
                <th className="text-right font-medium px-4 py-2">Overdue docs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.name}>
                  <td className={`px-4 py-2 ${r.name === NO_AGENCY ? 'text-gray-500 italic' : 'text-gray-800'}`}>{r.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{peso(r.amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.hasDocs ? `${r.pct}%` : '—'}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${r.overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const toast = useToast()
  const { profile, canEdit } = useAuth()
  const { documents, loading: docsLoading, error: docsError, refetch: refetchDocs } = useAllDocuments()
  const { projects, loading: projLoading, error: projError, refetch: refetchProjects } = useProjects()
  const { beneficiaries, loading: benLoading, error: benError, refetch: refetchBens } = useBeneficiaries()
  const { remarks, pinned, pinnedError, loading: remarksLoading, refetch: refetchRemarks, setPinned } = useAllRemarks(10)
  const [analyticsOpen, setAnalyticsOpen] = useLocalState('dashboardAnalyticsOpen', false)

  const loading = docsLoading || projLoading || benLoading

  // Skeleton only for the very first load, so Refresh never blanks the page.
  const [ready, setReady] = useState(false)
  useEffect(() => { if (!loading) setReady(true) }, [loading])

  const { overdue, upcoming } = useMemo(() => {
    const byDate = (a, b) => new Date(a.expected_date) - new Date(b.expected_date)
    return {
      overdue: documents.filter(isOverdue).sort(byDate),
      upcoming: documents.filter(d => isUpcoming(d)).sort(byDate),
    }
  }, [documents])

  const progress = useMemo(() => computeProgress(documents), [documents])
  const totalAmount = useMemo(() => projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [projects])

  const attention = useMemo(() => ({
    overdueDocs: overdue.length,
    overdueProjects: new Set(overdue.map(d => d.project_instances?.id).filter(Boolean)).size,
    upcomingDocs: upcoming.length,
    unpinned: projects.filter(p => p.latitude == null || p.longitude == null).length,
    noAgency: projects.filter(p => !implementingAgency(p)).length,
  }), [overdue, upcoming, projects])

  function refreshAll() {
    refetchDocs(); refetchProjects(); refetchBens(); refetchRemarks()
  }

  async function togglePin(id, value) {
    const { error } = await setPinned(id, value)
    if (error) toast.error(error)
    else toast.success(value ? 'Remark pinned' : 'Remark unpinned')
    return { error }
  }

  const error = docsError || projError || benError
  if (!ready) return <DashboardSkeleton />
  if (error)  return <div className="max-w-6xl mx-auto p-6 text-red-500 text-sm">Error: {error}</div>

  const firstName = (profile?.full_name ?? '').split(' ')[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-6xl mx-auto w-full space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <span className="text-sm text-gray-500">{today}</span>
        </div>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <AttentionStrip {...attention} />

      <KpiRow projects={projects} beneficiaryCount={beneficiaries.length} progress={progress} totalAmount={totalAmount} />

      {/* Work queue: what I'm tracking + what's stuck in the pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PinnedRemarksPanel pinned={pinned} error={pinnedError} canPin={canEdit} onTogglePin={togglePin} />
        <InProgressDocsPanel documents={documents} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DocListPanel title="Overdue" docs={overdue} tone="overdue" emptyText="No overdue documents 🎉" />
        <DocListPanel title={`Upcoming (next ${UPCOMING_WINDOW_DAYS} days)`} docs={upcoming} tone="upcoming" emptyText="Nothing due soon" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {remarksLoading && remarks.length === 0
          ? <ListPanel title="Recent activity" count={0}><EmptyNote>Loading activity...</EmptyNote></ListPanel>
          : <RecentActivityPanel remarks={remarks} canPin={canEdit} onTogglePin={togglePin} />}
        <RecentlyUpdatedPanel projects={projects} />
      </div>

      <BudgetCard projects={projects} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusComplianceSection documents={documents} />
        <DataChecksSection projects={projects} documents={documents} />
      </div>

      <Collapsible title="More analytics" open={analyticsOpen} onToggle={() => setAnalyticsOpen(v => !v)}>
        <ChartsSection projects={projects} />
        <BudgetRollupSection projects={projects} totalAmount={totalAmount} />
        <AgencyBreakdownSection projects={projects} documents={documents} />
        <GeographicHotspotsSection documents={documents} />
      </Collapsible>
    </div>
  )
}