import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useProjects } from '../../hooks/useProjects'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useProjectTypeIcons } from '../../hooks/useProjectTypeIcons'
import { PHASE_ORDER, computeProgress, progressBarColor } from '../../lib/documentProgress'
import { implementingAgency, allBeneficiaryNames } from '../../lib/projectAgencies'
import { IconPreview } from '../projects/ProjectTypeIconsEditor'

const PHASE_SHORT = {
  'Pre-Implementation': 'Pre-Impl.',
  'Semi-Annual':        'Semi-Ann.',
  'Annual':             'Annual',
  'Transfer':           'Transfer',
  'Liquidation':        'Liquid.',
}

const CATEGORY_COLORS = {
  'In-house':      'bg-indigo-100 text-indigo-800',
  'Fund Transfer': 'bg-teal-100 text-teal-800',
}

// ─── Project-type icon slot ───────────────────────────────────────────────────
// Uses the type's uploaded map icon (Project types manager). Types without an
// icon yet get a neutral tile with the type's first letter, so the slot is
// always the same size and tiles line up.

function TypeIcon({ svg, name }) {
  return (
    <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
      {svg
        ? <IconPreview svg={svg} size={22} />
        : <span className="text-xs font-semibold text-gray-400">{(name?.[0] ?? '?').toUpperCase()}</span>}
    </div>
  )
}

// ─── Phase segments ───────────────────────────────────────────────────────────
// One thin segment per phase, same color scale as DocumentChecklist.

function PhaseSegments({ byPhase }) {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {PHASE_ORDER.map(phase => {
        const { applicableCount, pct } = byPhase[phase]
        const none = applicableCount === 0
        return (
          <div
            key={phase}
            title={`${phase}: ${none ? 'n/a' : `${pct}%`}`}
            className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden"
          >
            <div
              className={`h-full ${none ? '' : progressBarColor(pct)}`}
              style={{ width: none ? '0%' : `${pct}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Project Tile ─────────────────────────────────────────────────────────────

function ProjectTile({ project, documents, iconSvg, onClick }) {
  const { byPhase, overallPct, totalApplicable, totalComplete } = computeProgress(documents)

  const typeName = project.project_types?.name ?? 'No type set'
  const agency = implementingAgency(project)
  const beneficiaries = allBeneficiaryNames(project).join('; ')
  const secondName = agency ?? (beneficiaries || '—')
  const meta = [project.beneficiaries?.municipality, project.year].filter(Boolean).join(' · ')
  const categoryClass = CATEGORY_COLORS[project.project_category] ?? 'bg-gray-100 text-gray-800'

  return (
    <button
      onClick={onClick}
      title={[typeName, agency && `Implementing: ${agency}`, beneficiaries && `Beneficiaries: ${beneficiaries}`].filter(Boolean).join('\n')}
      className="text-left border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start gap-2.5">
        <TypeIcon svg={iconSvg} name={project.project_types?.name} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-800 truncate">{typeName}</div>
          <div className={`text-sm truncate ${agency ? 'text-gray-700' : 'text-gray-500'}`}>{secondName}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-gray-500">
        <span className="truncate">{meta || '—'}</span>
        {project.project_category && (
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${categoryClass}`}>
            {project.project_category}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressBarColor(overallPct)}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="text-[11px] font-medium text-gray-600 tabular-nums whitespace-nowrap">
          {totalComplete}/{totalApplicable} · {overallPct}%
        </span>
      </div>

      <div className="mt-1.5">
        <PhaseSegments byPhase={byPhase} />
      </div>
    </button>
  )
}

// ─── Year Section ──────────────────────────────────────────────────────────────

function YearSection({ year, projects, docsByProject, iconsById, onSelect }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        {year}
        <span className="ml-2 text-xs font-normal text-gray-400">{projects.length}</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {projects.map(project => (
          <ProjectTile
            key={project.id}
            project={project}
            documents={docsByProject[project.id] ?? []}
            iconSvg={iconsById[project.project_type_id]}
            onClick={() => onSelect(project.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Overview() {
  const navigate = useNavigate()
  const { projects, loading: projectsLoading } = useProjects()
  const { documents, loading: docsLoading } = useAllDocuments()
  // Icons are optional: if they fail to load, tiles just show the letter slot.
  const { iconsById } = useProjectTypeIcons()

  // Overview is a browsing/status view — tiles open the full /projects/:id page.
  function handleSelect(projectId) {
    navigate(`/projects/${projectId}`)
  }

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
    return <div className="text-sm text-gray-500 py-8 text-center">Loading overview...</div>
  }

  if (projects.length === 0) {
    return <div className="text-sm text-gray-500 py-8 text-center">No projects yet.</div>
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        Bottom segments, left to right: {PHASE_ORDER.map(p => PHASE_SHORT[p]).join(' · ')}
      </p>
      {years.map(year => (
        <YearSection
          key={year}
          year={year}
          projects={projectsByYear[year]}
          docsByProject={docsByProject}
          iconsById={iconsById}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}