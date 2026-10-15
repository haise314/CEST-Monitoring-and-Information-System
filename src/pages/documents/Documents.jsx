import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState, useMemo, useEffect } from 'react'
import { useProjects } from '../../hooks/useProjects'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useDocumentTypes } from '../../hooks/useDocumentTypes'
import { PHASE_ORDER, computeProgress, progressBarColor } from '../../lib/documentProgress'
import { statusRank, getDocStatus, isOverdue, isAccomplished, STATUS_META } from '../../lib/documentStatus'
import DocBadge, { StatusTile } from './DocBadge'
import { useToast } from '../../lib/ToastContext'
import { exportTableCsv, todayStamp } from '../../lib/exportCsv'
import PaginationBar from '../../components/common/PaginationBar'
import VisibilityPanel from '../../components/common/VisibilityPanel'
import { MobileCardList, MobileCard, Pill } from '../../components/common/MobileCards'
import EditPanel from '../projects/editPanel'
import FilterChips from '../../components/common/FilterChips'
import { buildDocumentFilterFields } from './filterFields'
import { applyFilters } from '../../lib/filterEngine'
import { useSessionState } from '../../hooks/useSessionState'
import { useLocalState } from '../../hooks/useLocalState'
import { implementingAgency, cooperatingAgencies, projectOwnerName, allBeneficiaryNames } from '../../lib/projectAgencies'

// Manually pinned (frozen) columns — fixed widths so their sticky `left`
// offsets are predictable. Not using TanStack's built-in column pinning
// here since that derives offsets from configured column sizes, and the
// rest of this table's columns are auto-sized by content.
const PINNED_COLUMNS = {
  beneficiary: { width: 176, left: 0 },
  location:    { width: 160, left: 176 },
}

// Narrow screens that still show the table (it is hidden below md, where the
// card list takes over) keep a single narrower pinned column.
const PINNED_COLUMNS_NARROW = {
  beneficiary: { width: 128, left: 0 },
}

function useIsNarrow() {
  const query = '(max-width: 767px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = e => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
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

const LEGEND_ORDER = ['none', 'draft', 'checking', 'signing', 'claimable', 'soft', 'hard', 'submitted', 'na']
const MOBILE_PENDING_LIMIT = 5

function Badge({ value, colorMap }) {
  if (!value) return <span className="text-gray-300">—</span>
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorMap[value] ?? 'bg-gray-100 text-gray-700'}`}>
      {value}
    </span>
  )
}

// ─── Missing-count cell ──────────────────────────────────────────────────────

function MissingCell({ value }) {
  if (value == null) return <span className="text-gray-300">—</span>
  if (value === 0) return <span className="text-green-600 text-sm font-semibold" title="Nothing missing in this phase">✓</span>
  return (
    <span
      className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-2 rounded-full bg-red-100 border border-red-300 text-red-700 text-xs font-bold tabular-nums"
      title={`${value} document${value === 1 ? '' : 's'} with nothing on file in this phase`}
    >
      {value}
    </span>
  )
}

// ─── Mobile card (one project, active phase) ─────────────────────────────────
// Shows only what is still pending, most urgent first, so what's missing is
// visible without scrolling a wide grid.

function MobileDocCard({ project, types, docByProjectAndType, phaseStat, onClick }) {
  const [expanded, setExpanded] = useState(false)

  const items = types
    .map(t => {
      const doc = docByProjectAndType[`${project.id}-${t.id}`]
      return { type: t, doc, status: getDocStatus(doc), overdue: isOverdue(doc) }
    })
    .filter(i => i.status !== 'na')

  const pending = items
    .filter(i => !isAccomplished(i.doc))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || statusRank(a.doc) - statusRank(b.doc))

  const missing = items.filter(i => i.status === 'none').length
  const shown = expanded ? pending : pending.slice(0, MOBILE_PENDING_LIMIT)
  const where = [project.beneficiaries?.barangay, project.beneficiaries?.municipality].filter(Boolean).join(', ')

  return (
    <MobileCard onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800 break-words">{projectOwnerName(project) ?? '—'}</div>
          {where && <div className="text-xs text-gray-500 break-words">{where}</div>}
          <div className="text-xs text-gray-400 break-words">
            {[project.project_types?.name, project.year].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {missing > 0 ? (
            <Pill className="bg-red-100 text-red-700 border border-red-300 font-semibold">{missing} missing</Pill>
          ) : items.length > 0 && pending.length === 0 ? (
            <Pill className="bg-green-100 text-green-700">✓ Complete</Pill>
          ) : null}
          {project.overall_status && (
            <Pill className={STATUS_COLORS[project.overall_status] ?? 'bg-gray-100 text-gray-700'}>{project.overall_status}</Pill>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 mt-3">No documents in this phase.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${progressBarColor(phaseStat.pct)}`} style={{ width: `${phaseStat.pct}%` }} />
            </div>
            <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
              {phaseStat.completeCount}/{phaseStat.applicableCount} · {phaseStat.pct}%
            </span>
          </div>

          {pending.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {shown.map(i => (
                <li key={i.type.id} className="flex items-center gap-2">
                  <StatusTile status={i.status} overdue={i.overdue} size="sm" title={STATUS_META[i.status].label} />
                  <span className="text-xs text-gray-700 break-words flex-1 min-w-0">{i.type.name}</span>
                  {i.overdue && <span className="text-[10px] font-semibold text-red-600 flex-shrink-0">Overdue</span>}
                </li>
              ))}
            </ul>
          )}

          {pending.length > MOBILE_PENDING_LIMIT && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="mt-2 text-xs font-medium text-blue-600 py-1"
            >
              {expanded ? 'Show less' : `Show all ${pending.length} pending`}
            </button>
          )}
        </>
      )}
    </MobileCard>
  )
}

export default function Documents() {
  const isNarrow = useIsNarrow()
  const pinned = isNarrow ? PINNED_COLUMNS_NARROW : PINNED_COLUMNS
  const lastPinnedId = isNarrow ? 'beneficiary' : 'location'
  const { projects, loading: projectsLoading, updateProject, deleteProject, refetchQuiet } = useProjects()
  const { documents, loading: docsLoading, refetch: refetchDocuments }     = useAllDocuments()
  const { documentTypes, loading: typesLoading }                             = useDocumentTypes()

  const toast = useToast()

  const [globalFilter, setGlobalFilter]         = useState('')
  const [sorting, setSorting]                   = useState([])
  const [activePhase, setActivePhase]           = useState(PHASE_ORDER[0])
  const [legendOpen, setLegendOpen]             = useState(!isNarrow)
  // Active filter chips — remembered for the browser tab (see useSessionState)
  const [filters, setFilters] = useSessionState('documentsFilters', [])
  // Column visibility + order are remembered per device (localStorage).
  const [columnVisibility, setColumnVisibility] = useLocalState('documentsColumnVisibility', {}, v => (v && typeof v === 'object' ? v : {}))
  const [columnOrder, setColumnOrder]           = useLocalState('documentsColumnOrder', [], v => (Array.isArray(v) ? v : []))
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

  // ── Filter chips: project fields + progress + per-document status rules ──
  const filterFields = useMemo(
    () => buildDocumentFilterFields({ documentTypesByPhase, docsByProject, docByProjectAndType }),
    [documentTypesByPhase, docsByProject, docByProjectAndType]
  )

  const filteredProjects = useMemo(
    () => applyFilters(projects, filters, filterFields),
    [projects, filters, filterFields]
  )

  // ── Columns: pinned project/core columns + one per doc type in the active phase ──
  const columns = useMemo(() => {
    const phaseTypes = documentTypesByPhase[activePhase] ?? []

    const core = [
      {
        id: 'beneficiary',
        accessorFn: r => projectOwnerName(r),
        header: 'Agency / Beneficiary',
        group: 'Project Info',
        enableHiding: false, // always-visible identifying column
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-sm font-medium text-gray-800">{getValue() ?? '—'}</span>,
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
      {
        // How many documents in the ACTIVE phase have nothing on file at all.
        id: 'missing',
        accessorFn: r => phaseTypes.filter(t => getDocStatus(docByProjectAndType[`${r.id}-${t.id}`]) === 'none').length,
        header: 'Missing',
        group: 'Progress',
        enableGlobalFilter: false,
        cell: ({ getValue }) => <MissingCell value={getValue()} />,
      },
    ]

    const agencyCols = [
      {
        id: 'all_beneficiaries',
        accessorFn: r => allBeneficiaryNames(r).join('; '),
        header: 'Beneficiaries',
        group: 'Project Info',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs">{getValue() || '—'}</span>,
      },
      {
        id: 'implementing_agency',
        accessorFn: r => implementingAgency(r) ?? '',
        header: 'Implementing Agency',
        group: 'Project Info',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs">{getValue() || '—'}</span>,
      },
      {
        id: 'cooperating_agencies',
        accessorFn: r => cooperatingAgencies(r).join('; '),
        header: 'Cooperating Agencies',
        group: 'Project Info',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs">{getValue() || '—'}</span>,
      },
    ]

    const docCols = phaseTypes.map(type => ({
      id: `doc_${type.id}`,
      accessorFn: r => docByProjectAndType[`${r.id}-${type.id}`],
      header: type.name,
      group: type.is_required ? `${activePhase} — Required` : `${activePhase} — Optional`,
      enableGlobalFilter: false,
      sortingFn: (rowA, rowB, colId) => statusRank(rowA.getValue(colId)) - statusRank(rowB.getValue(colId)),
      cell: ({ getValue }) => <DocBadge doc={getValue()} />,
    }))

    return [...core, ...agencyCols, ...docCols]
  }, [activePhase, documentTypesByPhase, docsByProject, docByProjectAndType])

  const table = useReactTable({
    data: filteredProjects,
    columns,
    state: { globalFilter, sorting, columnVisibility, columnOrder },
    onGlobalFilterChange:     setGlobalFilter,
    onSortingChange:          setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange:      setColumnOrder,
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

  const sortedByMissing = sorting[0]?.id === 'missing' && sorting[0]?.desc
  const toggleMissingSort = () => setSorting(sortedByMissing ? [] : [{ id: 'missing', desc: true }])

  const loading = projectsLoading || docsLoading || typesLoading

  if (loading) return <div className="p-6 text-gray-500">Loading documents...</div>

  const rows = table.getRowModel().rows
  const phaseTypes = documentTypesByPhase[activePhase] ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">
          Documents
          <span className="ml-2 text-sm font-normal text-gray-500">
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
            onClick={toggleMissingSort}
            className={`md:hidden border rounded px-3 py-1.5 text-sm ${
              sortedByMissing ? 'border-red-300 bg-red-50 text-red-700 font-medium' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {sortedByMissing ? '✕ Most missing first' : 'Most missing first'}
          </button>
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
      <FilterChips
        fields={filterFields}
        rows={projects}
        filters={filters}
        onChange={setFilters}
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
            <span className="ml-1 text-xs text-gray-500">({(documentTypesByPhase[phase] ?? []).length})</span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mb-3">
        <button
          onClick={() => setLegendOpen(v => !v)}
          aria-expanded={legendOpen}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 py-1"
        >
          {legendOpen ? '▾' : '▸'} Legend
        </button>
        {legendOpen && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
            {LEGEND_ORDER.map(s => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                <StatusTile status={s} size="sm" />
                {STATUS_META[s].label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <StatusTile status="none" overdue size="sm" /> Overdue
            </span>
          </div>
        )}
      </div>

      {/* Table (md and up) */}
      <div className="hidden md:block overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm max-h-[calc(100vh-14rem)]">
        <table className="min-w-full text-sm border-separate border-spacing-0">
          <thead className="text-xs text-gray-500">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const id  = header.column.id
                  const pin = pinned[id]
                  const isDoc = id.startsWith('doc_')
                  const centered = isDoc || id === 'missing'
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`font-semibold cursor-pointer select-none hover:bg-gray-100 bg-gray-50 sticky top-0 border-b border-gray-200 ${
                        centered ? 'px-1.5 py-2 text-center align-bottom' : 'px-3 py-2.5 text-left whitespace-nowrap'
                      } ${pin ? 'z-30' : 'z-20'} ${id === lastPinnedId ? 'border-r-2 border-r-gray-200' : ''}`}
                      style={
                        pin ? { left: pin.left, width: pin.width, minWidth: pin.width }
                        : isDoc ? { width: 92, minWidth: 92, maxWidth: 92 }
                        : undefined
                      }
                      title={header.column.columnDef.header}
                    >
                      <span
                        className={
                          isDoc
                            ? 'block whitespace-normal break-words leading-tight text-[11px] line-clamp-3'
                            : 'inline-block max-w-[90px] truncate align-middle'
                        }
                      >
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
          <tbody className="bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-8 text-center text-gray-500">
                  No projects match these filters
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const isSelected = selectedProjectId === row.original.id
                const rowBg = isSelected ? 'bg-blue-50' : 'bg-white'
                const hasOverdue = (docsByProject[row.original.id] ?? []).some(isOverdue)
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedProjectId(row.original.id)}
                    className={`cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {row.getVisibleCells().map(cell => {
                      const id  = cell.column.id
                      const pin = pinned[id]
                      const centered = id.startsWith('doc_') || id === 'missing'
                      return (
                        <td
                          key={cell.id}
                          className={`border-b border-gray-100 whitespace-nowrap ${
                            centered ? 'px-1.5 py-1.5 text-center' : 'px-3 py-2'
                          } ${pin ? `sticky z-10 overflow-hidden text-ellipsis ${rowBg} group-hover:bg-gray-50` : ''} ${
                            id === 'beneficiary'
                              ? `border-l-4 ${hasOverdue ? 'border-l-red-500' : 'border-l-transparent'}`
                              : ''
                          } ${id === lastPinnedId ? 'border-r-2 border-r-gray-200' : ''}`}
                          style={pin ? { left: pin.left, width: pin.width, minWidth: pin.width } : undefined}
                          title={id === 'beneficiary' && hasOverdue ? 'Has overdue documents' : undefined}
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

      {/* Cards (phones) */}
      <MobileCardList isEmpty={rows.length === 0} emptyText="No projects match these filters">
        {rows.map(row => {
          const p = row.original
          const phaseStat = computeProgress(docsByProject[p.id] ?? []).byPhase[activePhase]
          return (
            <MobileDocCard
              key={row.id}
              project={p}
              types={phaseTypes}
              docByProjectAndType={docByProjectAndType}
              phaseStat={phaseStat}
              onClick={() => setSelectedProjectId(p.id)}
            />
          )
        })}
      </MobileCardList>

      <PaginationBar table={table} />

      {selectedProject && (
        <EditPanel
          project={selectedProject}
          onClose={() => setSelectedProjectId(null)}
          onUpdate={updateProject}
          onDelete={deleteProject}
          onDocumentsChanged={refetchDocuments}
          onProjectsChanged={refetchQuiet}
        />
      )}
    </div>
  )
}