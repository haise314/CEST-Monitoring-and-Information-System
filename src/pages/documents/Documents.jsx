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
import { statusRank, DOC_CONDITIONS } from '../../lib/documentStatus'
import DocBadge from './DocBadge'
import PaginationBar from '../../components/common/PaginationBar'
import EditPanel from '../projects/editPanel'
import DocumentsFilterBar, { emptyProjectFilters, emptyDocFilter } from './filterBar'

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

export default function Documents() {
  const { projects, loading: projectsLoading, updateProject, deleteProject } = useProjects()
  const { documents, loading: docsLoading }                                  = useAllDocuments()
  const { documentTypes, loading: typesLoading }                             = useDocumentTypes()

  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting]           = useState([])
  const [activePhase, setActivePhase]   = useState(PHASE_ORDER[0])
  const [filters, setFilters]           = useState(emptyProjectFilters())
  const [docFilter, setDocFilter]       = useState(emptyDocFilter())

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
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-sm text-gray-800">{getValue() ?? '—'}</span>,
      },
      {
        id: 'location',
        accessorFn: r => [r.beneficiaries?.barangay, r.beneficiaries?.municipality].filter(Boolean).join(', '),
        header: 'Location',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() || '—'}</span>,
      },
      {
        id: 'year',
        accessorKey: 'year',
        header: 'Year',
        enableGlobalFilter: false,
        cell: ({ getValue }) => getValue() ?? '—',
      },
      {
        id: 'project_type',
        accessorFn: r => r.project_types?.name,
        header: 'Type',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
      },
      {
        id: 'project_category',
        accessorKey: 'project_category',
        header: 'Category',
        enableGlobalFilter: false,
        cell: ({ getValue }) => <Badge value={getValue()} colorMap={CATEGORY_COLORS} />,
      },
      {
        id: 'overall_status',
        accessorKey: 'overall_status',
        header: 'Status',
        enableGlobalFilter: false,
        cell: ({ getValue }) => <Badge value={getValue()} colorMap={STATUS_COLORS} />,
      },
      {
        id: 'overall_pct',
        accessorFn: r => computeProgress(docsByProject[r.id] ?? []).overallPct,
        header: 'Overall',
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
      enableGlobalFilter: false,
      sortingFn: (rowA, rowB, colId) => statusRank(rowA.getValue(colId)) - statusRank(rowB.getValue(colId)),
      cell: ({ getValue }) => <DocBadge doc={getValue()} />,
    }))

    return [...core, ...docCols]
  }, [activePhase, documentTypesByPhase, docsByProject, docByProjectAndType])

  const table = useReactTable({
    data: filteredProjects,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange:      setSorting,
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const loading = projectsLoading || docsLoading || typesLoading

  if (loading) return <div className="p-6 text-gray-500">Loading documents...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">
          Documents
          <span className="ml-2 text-sm font-normal text-gray-400">
            {table.getFilteredRowModel().rows.length} of {projects.length} projects
          </span>
        </h1>
        <input
          type="text"
          placeholder="Search beneficiary, location, type..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      <DocumentsFilterBar
        projects={projects}
        filters={filters} setFilters={setFilters}
        docFilter={docFilter} setDocFilter={setDocFilter}
        documentTypesByPhase={documentTypesByPhase}
      />

      {/* Phase tabs */}
      <div className="flex gap-1 mb-3 border-b border-gray-200">
        {PHASE_ORDER.map(phase => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-2.5 text-left font-medium cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                    title={header.column.columnDef.header}
                  >
                    <span className="inline-block max-w-[90px] truncate align-middle">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                    {header.column.getIsSorted() === 'asc'  ? ' ↑'
                     : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  No projects match these filters
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => {
                const isSelected = selectedProjectId === row.original.id
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedProjectId(row.original.id)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar table={table} />

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