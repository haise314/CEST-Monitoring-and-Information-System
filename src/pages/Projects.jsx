import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useProjects } from '../hooks/useProjects'

// ─── Status Cells ────────────────────────────────────────────────────────────

function StatusCell({ getValue }) {
  const status = getValue()
  const colors = {
    'For Deployment':     'bg-yellow-100 text-yellow-800',
    'For Implementation': 'bg-blue-100 text-blue-800',
    'For Monitoring':     'bg-purple-100 text-purple-800',
    'For Transfer':       'bg-orange-100 text-orange-800',
    'Transfer Ongoing':   'bg-orange-200 text-orange-900',
    'Fully Transferred':  'bg-green-100 text-green-800',
    'For Pull Out':       'bg-red-100 text-red-800',
    'Done':               'bg-green-200 text-green-900',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status ?? '—'}
    </span>
  )
}

function OperationalCell({ getValue }) {
  const status = getValue()
  const colors = {
    'Operational':              'bg-green-100 text-green-800',
    'Non-operational':          'bg-red-100 text-red-800',
    'For Repair & Maintenance': 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status ?? '—'}
    </span>
  )
}

// ─── Column Definitions ───────────────────────────────────────────────────────

// Each column has a `group` for the visibility panel
const ALL_COLUMNS = [
  // CORE
  { accessorKey: 'year',            header: 'Year',          group: 'Core',        cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.project_types?.name, id: 'project_type', header: 'Project Type', group: 'Core', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'intervention',    header: 'Intervention',  group: 'Core',        cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'property_number', header: 'Property No.',  group: 'Core',        cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'amount',          header: 'Amount',        group: 'Core',        cell: ({ getValue }) => getValue() != null ? `₱${Number(getValue()).toLocaleString()}` : '—' },
  { accessorKey: 'date_deployed',   header: 'Date Deployed', group: 'Core',        cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'entry_point',     header: 'Entry Point',   group: 'Core',        cell: ({ getValue }) => getValue() ?? '—' },

  // BENEFICIARY
  { accessorFn: r => r.beneficiaries?.name,         id: 'beneficiary',  header: 'Beneficiary',  group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.category,     id: 'category',     header: 'Category',     group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.district,     id: 'district',     header: 'District',     group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.municipality, id: 'municipality', header: 'Municipality', group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.barangay,     id: 'barangay',     header: 'Barangay',     group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'members_male',    header: 'Male Members',   group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'members_female',  header: 'Female Members', group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'senior_citizen',  header: 'Senior Citizen', group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'pwds',            header: 'PWDs',           group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'fourps',          header: '4Ps',            group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'ips',             header: 'IPs',            group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },

  // STATUS & IMPACT
  { accessorKey: 'overall_status',      header: 'Overall Status',  group: 'Status & Impact', cell: StatusCell },
  { accessorKey: 'operational_status',  header: 'Operational',     group: 'Status & Impact', cell: OperationalCell },
  { accessorKey: 'interventions_count', header: 'Interventions',   group: 'Status & Impact', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'people_trained',      header: 'People Trained',  group: 'Status & Impact', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'impact_notes',        header: 'Impact Notes',    group: 'Status & Impact', cell: ({ getValue }) => getValue() ?? '—' },

  // DOCUMENTS
  { accessorKey: 'gdrive_folder_link', header: 'GDrive Link', group: 'Documents',
    cell: ({ getValue }) => getValue()
      ? <a href={getValue()} target="_blank" rel="noreferrer" className="text-blue-500 underline text-xs">Open</a>
      : '—'
  },
]

// Default visible column ids
const DEFAULT_VISIBLE = {
  year: true,
  project_type: true,
  beneficiary: true,
  municipality: true,
  barangay: true,
  property_number: true,
  amount: true,
  overall_status: true,
  operational_status: true,
  // everything else hidden by default
  intervention: false,
  date_deployed: false,
  entry_point: false,
  category: false,
  district: false,
  members_male: false,
  members_female: false,
  senior_citizen: false,
  pwds: false,
  fourps: false,
  ips: false,
  interventions_count: false,
  people_trained: false,
  impact_notes: false,
  gdrive_folder_link: false,
}

// ─── Column Visibility Panel ──────────────────────────────────────────────────

function VisibilityPanel({ table, onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Group columns by their group property
  const groups = useMemo(() => {
    const map = {}
    table.getAllColumns().forEach(col => {
      const group = col.columnDef.group ?? 'Other'
      if (!map[group]) map[group] = []
      map[group].push(col)
    })
    return map
  }, [table])

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-72"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Toggle Columns</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(groups).map(([group, cols]) => (
          <div key={group}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{group}</div>
            <div className="space-y-1">
              {cols.map(col => (
                <label key={col.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{col.columnDef.header}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => table.resetColumnVisibility()}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Reset to default
      </button>
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

// Only show filter dropdowns for columns that are visible AND filterable
const FILTERABLE_COLUMN_IDS = [
  'year', 'municipality', 'barangay', 'district', 'category',
  'overall_status', 'operational_status', 'project_type', 'entry_point',
]

const STATIC_OPTIONS = {
  overall_status: ['For Deployment','For Implementation','For Monitoring','For Transfer','Transfer Ongoing','Fully Transferred','For Pull Out','Done'],
  operational_status: ['Operational','Non-operational','For Repair & Maintenance'],
}

function FilterBar({ projects, filters, setFilters, visibleColumnIds }) {
  const activeFilterableIds = FILTERABLE_COLUMN_IDS.filter(id => visibleColumnIds.includes(id))

  // Dynamic options built from data
  const options = useMemo(() => {
    const municipality = [...new Set(projects.map(p => p.beneficiaries?.municipality).filter(Boolean))].sort()
    const barangay = [...new Set(
      projects
        .filter(p => !filters.municipality || p.beneficiaries?.municipality === filters.municipality)
        .map(p => p.beneficiaries?.barangay).filter(Boolean)
    )].sort()
    const district = [...new Set(projects.map(p => p.beneficiaries?.district).filter(Boolean))].sort()
    const category = [...new Set(projects.map(p => p.beneficiaries?.category).filter(Boolean))].sort()
    const year = [...new Set(projects.map(p => p.year).filter(Boolean))].sort((a, b) => b - a)
    const project_type = [...new Set(projects.map(p => p.project_types?.name).filter(Boolean))].sort()
    const entry_point = [...new Set(projects.map(p => p.entry_point).filter(Boolean))].sort()
    return { municipality, barangay, district, category, year, project_type, entry_point, ...STATIC_OPTIONS }
  }, [projects, filters.municipality])

  const labels = {
    year: 'Year', municipality: 'Municipality', barangay: 'Barangay',
    district: 'District', category: 'Category', overall_status: 'Overall Status',
    operational_status: 'Operational', project_type: 'Project Type', entry_point: 'Entry Point',
  }

  function handleChange(key, value) {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'municipality') next.barangay = ''
      return next
    })
  }

  const hasActive = Object.values(filters).some(v => v !== '')

  if (activeFilterableIds.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 items-center mb-3">
      {activeFilterableIds.map(id => (
        <select
          key={id}
          value={filters[id] ?? ''}
          onChange={e => handleChange(id, e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All {labels[id]}</option>
          {(options[id] ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {hasActive && (
        <button
          onClick={() => setFilters(Object.fromEntries(FILTERABLE_COLUMN_IDS.map(id => [id, ''])))}
          className="text-xs text-red-500 hover:text-red-700 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

// ─── Pagination Bar ───────────────────────────────────────────────────────────

function PaginationBar({ table }) {
  return (
    <div className="flex items-center justify-between mt-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <span className="text-sm text-gray-600">
          Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of <strong>{table.getPageCount()}</strong>
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Rows per page:</span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Projects() {
  const { projects, loading, error } = useProjects()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_VISIBLE)
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false)
  const [filters, setFilters] = useState(
    Object.fromEntries(FILTERABLE_COLUMN_IDS.map(id => [id, '']))
  )

  // Apply dropdown filters before TanStack
  const filtered = useMemo(() =>
    projects.filter(p => {
      if (filters.year          && String(p.year) !== String(filters.year)) return false
      if (filters.municipality  && p.beneficiaries?.municipality !== filters.municipality) return false
      if (filters.barangay      && p.beneficiaries?.barangay !== filters.barangay) return false
      if (filters.district      && p.beneficiaries?.district !== filters.district) return false
      if (filters.category      && p.beneficiaries?.category !== filters.category) return false
      if (filters.overall_status     && p.overall_status !== filters.overall_status) return false
      if (filters.operational_status && p.operational_status !== filters.operational_status) return false
      if (filters.project_type  && p.project_types?.name !== filters.project_type) return false
      if (filters.entry_point   && p.entry_point !== filters.entry_point) return false
      return true
    })
  , [projects, filters])

  const table = useReactTable({
    data: filtered,
    columns: ALL_COLUMNS,
    state: { globalFilter, sorting, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  // Visible column ids for FilterBar
  const visibleColumnIds = table.getVisibleLeafColumns().map(c => c.id)

  if (loading) return <div className="p-6 text-gray-500">Loading projects...</div>
  if (error)   return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">
          Projects
          <span className="ml-2 text-sm font-normal text-gray-400">
            {table.getFilteredRowModel().rows.length} of {projects.length}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Column visibility toggle */}
          <div className="relative">
            <button
              onClick={() => setShowVisibilityPanel(v => !v)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-1"
            >
              ⊞ Columns
            </button>
            {showVisibilityPanel && (
              <VisibilityPanel
                table={table}
                onClose={() => setShowVisibilityPanel(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <FilterBar
        projects={projects}
        filters={filters}
        setFilters={setFilters}
        visibleColumnIds={visibleColumnIds}
      />

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left font-medium cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑'
                      : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={ALL_COLUMNS.length} className="px-4 py-8 text-center text-gray-400">
                  No projects found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 cursor-pointer">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <PaginationBar table={table} />
    </div>
  )
}

export default Projects