import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'

function StatusCell({ getValue }) {
  const status = getValue()
  const colors = {
    'For Deployment': 'bg-yellow-100 text-yellow-800',
    'For Implementation': 'bg-blue-100 text-blue-800',
    'For Monitoring': 'bg-purple-100 text-purple-800',
    'For Transfer': 'bg-orange-100 text-orange-800',
    'Transfer Ongoing': 'bg-orange-200 text-orange-900',
    'Fully Transferred': 'bg-green-100 text-green-800',
    'For Pull Out': 'bg-red-100 text-red-800',
    'Done': 'bg-green-200 text-green-900',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status ?? '—'}
    </span>
  )
}

function OperationalCell({ getValue }) {
  const status = getValue()
  const colors = {
    'Operational': 'bg-green-100 text-green-800',
    'Non-operational': 'bg-red-100 text-red-800',
    'For Repair & Maintenance': 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status ?? '—'}
    </span>
  )
}

const columns = [
  {
    accessorKey: 'year',
    header: 'Year',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorFn: (row) => row.project_types?.name,
    id: 'project_type',
    header: 'Project Type',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorFn: (row) => row.beneficiaries?.name,
    id: 'beneficiary',
    header: 'Beneficiary',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorFn: (row) => row.beneficiaries?.municipality,
    id: 'municipality',
    header: 'Municipality',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorFn: (row) => row.beneficiaries?.barangay,
    id: 'barangay',
    header: 'Barangay',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorKey: 'property_number',
    header: 'Property No.',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => getValue() ? `₱${Number(getValue()).toLocaleString()}` : '—',
  },
  {
    accessorKey: 'overall_status',
    header: 'Overall Status',
    cell: StatusCell,
  },
  {
    accessorKey: 'operational_status',
    header: 'Operational',
    cell: OperationalCell,
  },
  {
    accessorKey: 'entry_point',
    header: 'Entry Point',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorKey: 'people_trained',
    header: 'Trained',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorKey: 'interventions_count',
    header: 'Interventions',
    cell: ({ getValue }) => getValue() ?? '—',
  },
]

function FilterBar({ projects, filters, setFilters }) {
  // Dynamically build unique options from actual data
  const municipalities = useMemo(() =>
    [...new Set(projects.map(p => p.beneficiaries?.municipality).filter(Boolean))].sort()
  , [projects])

  const barangays = useMemo(() =>
    [...new Set(
      projects
        .filter(p => !filters.municipality || p.beneficiaries?.municipality === filters.municipality)
        .map(p => p.beneficiaries?.barangay)
        .filter(Boolean)
    )].sort()
  , [projects, filters.municipality])

  const years = useMemo(() =>
    [...new Set(projects.map(p => p.year).filter(Boolean))].sort((a, b) => b - a)
  , [projects])

  function handleChange(key, value) {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      // Reset barangay when municipality changes
      if (key === 'municipality') next.barangay = ''
      return next
    })
  }

  function clearAll() {
    setFilters({ municipality: '', barangay: '', overall_status: '', operational_status: '', year: '' })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="flex flex-wrap gap-2 items-center mb-4">
      {/* Municipality */}
      <select
        value={filters.municipality}
        onChange={(e) => handleChange('municipality', e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Municipalities</option>
        {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      {/* Barangay — only shows options relevant to selected municipality */}
      <select
        value={filters.barangay}
        onChange={(e) => handleChange('barangay', e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={barangays.length === 0}
      >
        <option value="">All Barangays</option>
        {barangays.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {/* Overall Status */}
      <select
        value={filters.overall_status}
        onChange={(e) => handleChange('overall_status', e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        <option>For Deployment</option>
        <option>For Implementation</option>
        <option>For Monitoring</option>
        <option>For Transfer</option>
        <option>Transfer Ongoing</option>
        <option>Fully Transferred</option>
        <option>For Pull Out</option>
        <option>Done</option>
      </select>

      {/* Operational Status */}
      <select
        value={filters.operational_status}
        onChange={(e) => handleChange('operational_status', e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Operational</option>
        <option>Operational</option>
        <option>Non-operational</option>
        <option>For Repair & Maintenance</option>
      </select>

      {/* Year */}
      <select
        value={filters.year}
        onChange={(e) => handleChange('year', e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Years</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-red-500 hover:text-red-700 underline px-1"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function Projects() {
  const { projects, loading, error } = useProjects()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [filters, setFilters] = useState({
    municipality: '',
    barangay: '',
    overall_status: '',
    operational_status: '',
    year: '',
  })

  // Apply dropdown filters before passing to TanStack
  const filtered = useMemo(() =>
    projects.filter(p => {
      if (filters.municipality && p.beneficiaries?.municipality !== filters.municipality) return false
      if (filters.barangay && p.beneficiaries?.barangay !== filters.barangay) return false
      if (filters.overall_status && p.overall_status !== filters.overall_status) return false
      if (filters.operational_status && p.operational_status !== filters.operational_status) return false
      if (filters.year && String(p.year) !== String(filters.year)) return false
      return true
    })
  , [projects, filters])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (loading) return <div className="p-6 text-gray-500">Loading projects...</div>
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">
          Projects
          <span className="ml-2 text-sm font-normal text-gray-400">
            {filtered.length} of {projects.length}
          </span>
        </h1>
        <input
          type="text"
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filter bar */}
      <FilterBar
        projects={projects}
        filters={filters}
        setFilters={setFilters}
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left font-medium cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑'
                      : header.column.getIsSorted() === 'desc' ? ' ↓'
                      : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  No projects found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 cursor-pointer">
                  {row.getVisibleCells().map((cell) => (
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
    </div>
  )
}

export default Projects