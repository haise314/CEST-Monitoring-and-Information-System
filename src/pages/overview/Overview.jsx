import { useState, useMemo } from 'react'
import { useProjects } from '../../hooks/useProjects'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import EditPanel from '../projects/editPanel'
import { PHASE_ORDER, computeProgress, progressBarColor } from '../../lib/documentProgress'

const PHASE_SHORT = {
  'Pre-Implementation': 'Pre-Impl.',
  'Semi-Annual':        'Semi-Ann.',
  'Annual':              'Annual',
  'Transfer':            'Transfer',
}

const CATEGORY_COLORS = {
  'In-house':      'bg-indigo-100 text-indigo-800',
  'Fund Transfer': 'bg-teal-100 text-teal-800',
}

// ─── Phase Pill ───────────────────────────────────────────────────────────────
// One small bar per phase — same color scale as DocumentChecklist so a project
// card and its detail panel never disagree about what "green" means.

function PhasePill({ phase, phaseProgress }) {
  const { applicableCount, pct } = phaseProgress
  const barColor = applicableCount === 0 ? 'bg-gray-200' : progressBarColor(pct)

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400 truncate">{PHASE_SHORT[phase]}</span>
        <span className="text-[10px] text-gray-400">{applicableCount === 0 ? '—' : `${pct}%`}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: applicableCount === 0 ? '100%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, documents, onClick }) {
  const { byPhase, overallPct, totalApplicable, totalComplete } = computeProgress(documents)
  const categoryClass = CATEGORY_COLORS[project.project_category] ?? 'bg-gray-100 text-gray-800'

  return (
    <button
      onClick={onClick}
      className="text-left border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">
            {project.beneficiaries?.name ?? '—'}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {[project.beneficiaries?.barangay, project.beneficiaries?.municipality].filter(Boolean).join(', ') || '—'}
          </div>
        </div>
        {project.project_category && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${categoryClass}`}>
            {project.project_category}
          </span>
        )}
      </div>

      <div className="text-xs text-gray-500 mb-3">
        {project.project_types?.name ?? 'No type set'}
      </div>

      {/* Overall bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressBarColor(overallPct)}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 w-16 text-right">
          {totalComplete}/{totalApplicable} · {overallPct}%
        </span>
      </div>

      {/* Per-phase pills */}
      <div className="flex gap-3">
        {PHASE_ORDER.map(phase => (
          <PhasePill key={phase} phase={phase} phaseProgress={byPhase[phase]} />
        ))}
      </div>
    </button>
  )
}

// ─── Year Section ──────────────────────────────────────────────────────────────

function YearSection({ year, projects, docsByProject, onSelect }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{year}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            documents={docsByProject[project.id] ?? []}
            onClick={() => onSelect(project.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Overview() {
  const { projects, loading: projectsLoading, updateProject, deleteProject } = useProjects()
  const { documents, loading: docsLoading } = useAllDocuments()
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  // selectedProjectId pattern — always derive from the live list so the
  // detail panel never shows a stale snapshot after a refetch.
  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null

  const docsByProject = useMemo(() => {
    const map = {}
    documents.forEach(doc => {
      const pid = doc.project_id
      if (!map[pid]) map[pid] = []
      map[pid].push(doc)
    })
    return map
  }, [documents])

  const projectsByYear = useMemo(() => {
    const map = {}
    projects.forEach(project => {
      const year = project.year ?? 'No Year Set'
      if (!map[year]) map[year] = []
      map[year].push(project)
    })
    return map
  }, [projects])

  const years = useMemo(
    () => Object.keys(projectsByYear).sort((a, b) => Number(b) - Number(a)),
    [projectsByYear]
  )

  if (projectsLoading || docsLoading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading overview...</div>
  }

  if (projects.length === 0) {
    return <div className="text-sm text-gray-400 py-8 text-center">No projects yet.</div>
  }

  return (
    <div>
      {years.map(year => (
        <YearSection
          key={year}
          year={year}
          projects={projectsByYear[year]}
          docsByProject={docsByProject}
          onSelect={setSelectedProjectId}
        />
      ))}

      {selectedProject && (
        <EditPanel
          project={selectedProject}
          onClose={() => setSelectedProjectId(null)}
          onUpdate={updateProject}
          onDelete={deleteProject}
        />
      )}
    </div>
  )
}