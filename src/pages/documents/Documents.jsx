import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import { useProjects } from '../../hooks/useProjects'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useDocumentTypes } from '../../hooks/useDocumentTypes'
import { PHASE_ORDER, computeProgress, progressBarColor } from '../../lib/documentProgress'
import { statusRank, getDocStatus, isOverdue, STATUS_META, DOC_CONDITIONS } from '../../lib/documentStatus'
import DocBadge from './DocBadge'
import { useToast } from '../../lib/ToastContext'
import { exportTableCsv, todayStamp } from '../../lib/exportCsv'
import { MobileCardList, MobileCard, Pill } from '../../components/common/MobileCards'
import PaginationBar from '../../components/common/PaginationBar'
import VisibilityPanel from '../../components/common/VisibilityPanel'
import EditPanel from '../projects/editPanel'
import DocumentsFilterBar, { emptyProjectFilters, emptyDocFilter } from './filterBar'

// Manually pinned (frozen) columns — fixed widths so their sticky `left`
// offsets are predictable. Not using TanStack's built-in column pinning
// here since that derives offsets from configured column sizes, and the
// rest of this table's columns are auto-sized by content.
const PINNED_COLUMNS = {
  beneficiary: { width: 176, left: 0 },
  location:    { width: 160, left: 176 },
}

const CATEGORY_COLORS = {
  'In-house':      'bg-indigo-100 text-indigo-800',
  'Fund Transfer': 'bg-teal-100 text-teal-800',
}

const STATUS_COLORS = {
  'For Deployment':     'bg-yellow-100 text-yellow-800',
  'For Implementation': 'bg-blue-100 text-blue-800',
  'For Monitoring':     'bg-purple-100 text-purple-800',
  'For Transfer':       'bg-orange-100 text-orange-800',
  'Transfer Ongoing':   'bg-orange-200 text-orange-900',
  'Fully Transferred':  'bg-green-100 text-green-800',
  'For Pull Out':       'bg-red-100 text-red-800',
  'Done':               'bg-green-200 text-green-900',
}

function Badge({ value, colorMap }) {
  if (!value) return <span className="text-gray-300">—</span>
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorMap[value] ?? 'bg-gray-100 text-gray-700'}`}>
      {value}
    </span>
  )
}

// Phone sort choices — the same TanStack sorting state the table headers use.
const MOBILE_SORTS = [
  { key: 'default',  label: 'Default',                 value: [] },
  { key: 'name',     label: 'Beneficiary (A–Z)',       value: [{ id: 'beneficiary', desc: false }] },
  { key: 'progress', label: 'Least complete first',    value: [{ id: 'overall_pct', desc: false }] },
  { key: 'year',     label: 'Newest year first',       value: [{ id: 'year', desc: true }] },
]

// Short labels for the per-phase summary chips on phone cards.
const CHIP_ORDER = [
  ['submitted', 'Submitted'],
  ['hard',      'Hard copy'],
  ['soft',      'Soft copy'],
  ['claimable', 'Claimable'],
  ['none',      'Nothing on file'],
]

// Phone version of one table row. The desktop pivot has one column per
// document; on a phone that becomes a per-phase SUMMARY instead: progress,
// a count per status, and the names of what still needs attention. Tapping
// the card opens the same EditPanel as clicking a table row.
function ProjectDocCard({ project, docs, phase, onOpen }) {
  const ben = project.beneficiaries
  const progress = computeProgress(docs)
  const phaseProgress = progress.byPhase[phase]
  const phaseDocs = phaseProgress.docs.filter(d => !d.is_not_applicable)

  const counts = {}
  const attention = []
  let overdue = 0
  phaseDocs.forEach(d => {
    const st = getDocStatus(d)
    counts[st] = (counts[st] ?? 0) + 1
    const late = isOverdue(d)
    if (late) overdue++
    if (late || st === 'none') attention.push(d.document_types?.name ?? d.custom_label ?? 'Untitled')
  })

  const location = [ben?.barangay, ben?.municipality].filter(Boolean).join(', ')
  const meta = [location, project.year, project.project_types?.name].filter(Boolean).join(' · ')

  return (
    <MobileCard onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800 break-words">{ben?.name ?? '—'}</div>
          {meta && <div className="text-xs text-gray-400 mt-0.5 break-words">{meta}</div>}
        </div>
        {project.overall_status && (
          <Pill className={STATUS_COLORS[project.overall_status] ?? 'bg-gray-100 text-gray-700'}>
            {project.overall_status}
          </Pill>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${progressBarColor(progress.overallPct)}`} style={{ width: `${progress.overallPct}%` }} />
        </div>
        <span className="text-xs text-gray-500 w-20 text-right">Overall {progress.overallPct}%</span>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-xs font-medium text-gray-600 mb-1.5">
          {phase}
          {phaseProgress.applicableCount > 0 && (
            <span className="font-normal text-gray-400"> · {phaseProgress.completeCount}/{phaseProgress.applicableCount} complete</span>
          )}
        </div>

        {phaseDocs.length === 0 ? (
          <p className="text-xs text-gray-400">
            {phaseProgress.docs.length === 0 ? 'No documents in this phase yet.' : 'Everything in this phase is marked N/A.'}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {CHIP_ORDER.filter(([st]) => counts[st]).map(([st, label]) => (
                <span key={st} className="flex items-center gap-1 text-xs text-gray-500">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_META[st].dotClass}`} />
                  {counts[st]} {label}
                </span>
              ))}
              {overdue > 0 && (
                <span className="text-xs font-medium text-red-500">⚠ {overdue} overdue</span>
              )}
            </div>
            {attention.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5 break-words">
                Needs attention: {attention.slice(0, 3).join(', ')}
                {attention.length > 3 && ` +${attention.length - 3} more`}
              </p>
            )}
          </>
        )}
      </div>
    </MobileCard>
  )
}

export default function Documents() {
  const pinned = PINNED_COLUMNS
  const lastPinnedId = 'location'
  const { projects, loading: projectsLoading, updateProject, deleteProject } = useProjects()
  const { documents, loading: docsLoading, refetch: refetchDocuments }     = useAllDocuments()
  const { documentTypes, loading: typesLoading }                             = useDocumentTypes()

  const toast = useToast()

  const [globalFilter, setGlobalFilter]         = useState('')
  const [sorting, setSorting]                   = useState([])
  const [activePhase, setActivePhase]           = useState(PHASE_ORDER[0])
  const [filters, setFilters]                   = useState(emptyProjectFilters())
  const [docFilter, setDocFilter]               = useState(emptyDocFilter())
  const [columnVisibility, setColumnVisibility] = useState({})
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false)

  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null

  // ── doc_type_id -> phase, and phase -> [doc types] (for tabs + query builder) ──
  const documentTypesByPhase = useMemo(() => {
    const map = {}
    PHASE_ORDER.forEach(phase => { map[phase] = [] })
    documentTypes.forEach(t => {
      if (!map[t.phase]) map[t.phase] = []
      map[t.phase].push(t)
    })
    return map
  }, [documentTypes])

  // ── project_id -> [documents], and "project_id-type_id" -> document ──
  const { docsByProject, docByProjectAndType } = useMemo(() => {
    const byProject = {}
    const byProjectAndType = {}
    documents.forEach(doc => {
      const pid = doc.project_id
      if (!byProject[pid]) byProject[pid] = []
      byProject[pid].push(doc)
      byProjectAndType[`${pid}-${doc.document_type_id}`] = doc
    })
    return { docsByProject: byProject, docByProjectAndType: byProjectAndType }
  }, [documents])

  // ── Apply project-level filters + the document-type query filter ──
  const activeCondition = DOC_CONDITIONS.find(c => c.id === docFilter.conditionId)

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const ben = p.beneficiaries
      if (filters.year             && String(p.year)          !== filters.year)             return false
      if (filters.project_type     && p.project_types?.name    !== filters.project_type)     return false
      if (filters.project_category && p.project_category       !== filters.project_category) return false
      if (filters.overall_status   && p.overall_status         !== filters.overall_status)   return false
      if (filters.municipality     && ben?.municipality        !== filters.municipality)     return false
      if (filters.barangay         && ben?.barangay            !== filters.barangay)         return false
      if (filters.district         && ben?.district            !== filters.district)         return false
      if (filters.ben_category     && ben?.category            !== filters.ben_category)     return false

      if (docFilter.documentTypeId && activeCondition) {
        const doc = docByProjectAndType[`${p.id}-${docFilter.documentTypeId}`]
        if (!activeCondition.test(doc)) return false
      }

      return true
    })
  }, [projects, filters, docFilter, activeCondition, docByProjectAndType])

  // ── Columns: pinned project/core columns + one per doc type in the active phase ──
  const columns = useMemo(() => {
    const core = [
      {
        id: 'beneficiary',
        accessorFn: r => r.beneficiaries?.name,
        header: 'Beneficiary',
        group: 'Project Info',
        enableHiding: false, // always-visible identifying column
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-sm text-gray-800">{getValue() ?? '—'}</span>,
      },
      {
        id: 'location',
        accessorFn: r => [r.beneficiaries?.barangay, r.beneficiaries?.municipality].filter(Boolean).join(', '),
        header: 'Location',
        group: 'Project Info',
        enableHiding: false,
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() || '—'}</span>,
      },
      {
        id: 'year',
        accessorKey: 'year',
        header: 'Year',
        group: 'Project Info',
        enableGlobalFilter: false,
        cell: ({ getValue }) => getValue() ?? '—',
      },
      {
        id: 'project_type',
        accessorFn: r => r.project_types?.name,
        header: 'Type',
        group: 'Project Info',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
      },
      {
        id: 'project_category',
        accessorKey: 'project_category',
        header: 'Category',
        group: 'Project Info',
        enableGlobalFilter: false,
        cell: ({ getValue }) => <Badge value={getValue()} colorMap={CATEGORY_COLORS} />,
      },
      {
        id: 'overall_status',
        accessorKey: 'overall_status',
        header: 'Status',
        group: 'Project Info',
        enableGlobalFilter: false,
        cell: ({ getValue }) => <Badge value={getValue()} colorMap={STATUS_COLORS} />,
      },
      {
        id: 'overall_pct',
        accessorFn: r => computeProgress(docsByProject[r.id] ?? []).overallPct,
        header: 'Overall',
        group: 'Progress',
        enableGlobalFilter: false,
        cell: ({ getValue }) => {
          const pct = getValue()
          return (
            <div className="flex items-center gap-1.5 w-20">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${progressBarColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 w-7 text-right">{pct}%</span>
            </div>
          )
        },
      },
    ]

    const docCols = (documentTypesByPhase[activePhase] ?? []).map(type => ({
      id: `doc_${type.id}`,
      accessorFn: r => docByProjectAndType[`${r.id}-${type.id}`],
      header: type.name,
      group: type.is_required ? `${activePhase} — Required` : `${activePhase} — Optional`,
      enableGlobalFilter: false,
      sortingFn: (rowA, rowB, colId) => statusRank(rowA.getValue(colId)) - statusRank(rowB.getValue(colId)),
      cell: ({ getValue }) => <DocBadge doc={getValue()} />,
    }))

    return [...core, ...docCols]
  }, [activePhase, documentTypesByPhase, docsByProject, docByProjectAndType])

  const table = useReactTable({
    data: filteredProjects,
    columns,
    state: { globalFilter, sorting, columnVisibility },
    onGlobalFilterChange:     setGlobalFilter,
    onSortingChange:          setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  function handleExport() {
    const n = exportTableCsv(table, {
      filename: `cest-documents-${activePhase.toLowerCase().replace(/[^a-z]+/g, '-')}-${todayStamp()}.csv`,
      formatValue: (col, value) => (col.id.startsWith('doc_') ? STATUS_META[getDocStatus(value)].label : value),
    })
    toast.success(`Exported ${n} project${n === 1 ? '' : 's'} (${activePhase} documents)`)
  }

  const loading = projectsLoading || docsLoading || typesLoading

  if (loading) return <div className="p-6 text-gray-500">Loading documents...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">
          Documents
          <span className="ml-2 text-sm font-normal text-gray-400">
            {table.getFilteredRowModel().rows.length} of {projects.length} projects
          </span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search beneficiary, location, type..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleExport}
            title="Download the rows currently shown, for the selected phase tab, as CSV"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ⇩ Export CSV
          </button>
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowVisibilityPanel(v => !v)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ⊞ Columns
            </button>
            {showVisibilityPanel && (
              <VisibilityPanel table={table} onClose={() => setShowVisibilityPanel(false)} />
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <DocumentsFilterBar
        projects={projects}
        filters={filters} setFilters={setFilters}
        docFilter={docFilter} setDocFilter={setDocFilter}
        documentTypesByPhase={documentTypesByPhase}
      />

      {/* Phase tabs */}
      <div className="flex gap-1 mb-3 border-b border-gray-200 overflow-x-auto">
        {PHASE_ORDER.map(phase => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0 ${
              activePhase === phase
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {phase}
            <span className="ml-1 text-xs text-gray-400">({(documentTypesByPhase[phase] ?? []).length})</span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {[
          ['bg-gray-300', 'N/A'],
          ['bg-red-400', 'Nothing on file'],
          ['bg-amber-400', 'Claimable'],
          ['bg-blue-400', 'Soft copy'],
          ['bg-indigo-500', 'Hard copy'],
          ['bg-green-500', 'Submitted'],
        ].map(([dot, label]) => (
          <span key={label} className="flex items-center gap-1 text-xs text-gray-400">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} /> {label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 ring-2 ring-red-500 ring-offset-1" /> + overdue
        </span>
      </div>

      {/* Table */}
      <div className="hidden md:block overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm max-h-[calc(100vh-14rem)]">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-gray-500">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const pin = pinned[header.column.id]
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-3 py-2.5 text-left font-semibold cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap bg-gray-50 sticky top-0 shadow-[inset_0_-1px_0_var(--color-gray-200)] ${
                        pin ? 'z-30' : 'z-20'
                      } ${header.column.id === lastPinnedId ? 'border-r-2 border-gray-200' : ''}`}
                      style={pin ? { left: pin.left, width: pin.width, minWidth: pin.width } : undefined}
                      title={header.column.columnDef.header}
                    >
                      <span className="inline-block max-w-[90px] truncate align-middle">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      {header.column.getIsSorted() === 'asc'  ? ' ↑'
                       : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-8 text-center text-gray-400">
                  No projects match these filters
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => {
                const isSelected = selectedProjectId === row.original.id
                const rowBg = isSelected ? 'bg-blue-50' : 'bg-white'
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedProjectId(row.original.id)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {row.getVisibleCells().map(cell => {
                      const pin = pinned[cell.column.id]
                      return (
                        <td
                          key={cell.id}
                          className={`px-3 py-2 whitespace-nowrap ${pin ? `sticky z-10 overflow-hidden text-ellipsis ${rowBg}` : ''} ${
                            cell.column.id === lastPinnedId ? 'border-r-2 border-gray-200' : ''
                          }`}
                          style={pin ? { left: pin.left, width: pin.width, minWidth: pin.width } : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Phones: sort control (table headers aren't available) + cards */}
      <div className="md:hidden flex items-center gap-2 mb-2 text-sm">
        <span className="text-gray-500">Sort</span>
        <select
          value={MOBILE_SORTS.find(o => JSON.stringify(o.value) === JSON.stringify(sorting))?.key ?? 'default'}
          onChange={e => setSorting(MOBILE_SORTS.find(o => o.key === e.target.value)?.value ?? [])}
          className="border border-gray-300 rounded px-2 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MOBILE_SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <MobileCardList
        isEmpty={table.getRowModel().rows.length === 0}
        emptyText="No projects match these filters"
      >
        {table.getRowModel().rows.map(row => (
          <ProjectDocCard
            key={row.id}
            project={row.original}
            docs={docsByProject[row.original.id] ?? []}
            phase={activePhase}
            onOpen={() => setSelectedProjectId(row.original.id)}
          />
        ))}
      </MobileCardList>

      <PaginationBar table={table} />

      {selectedProject && (
        <EditPanel
          project={selectedProject}
          onClose={() => setSelectedProjectId(null)}
          onUpdate={updateProject}
          onDelete={deleteProject}
          onDocumentsChanged={refetchDocuments}
        />
      )}
    </div>
  )
}