import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useEffect } from 'react'

function EditableCell({ getValue, row, column, table }) {
  const initialValue = getValue()
  const [value, setValue] = useState(initialValue ?? '')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setValue(initialValue ?? '')
  }, [initialValue])

  async function onBlur() {
    setEditing(false)
    if (value === (initialValue ?? '')) return
    await table.options.meta?.updateProject(row.original.id, {
      [column.id]: value === '' ? null : value,
    })
  }

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="min-w-[80px] min-h-[24px] cursor-pointer hover:bg-blue-50 rounded px-1"
      >
        {value || <span className="text-gray-300">—</span>}
      </div>
    )
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      className="w-full border border-blue-400 rounded px-1 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  )
}

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

const columns = [
  {
    accessorKey: 'year',
    header: 'Year',
    cell: EditableCell,
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
    accessorKey: 'property_number',
    header: 'Property No.',
    cell: EditableCell,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue, row, column, table }) => (
      <EditableCell
        getValue={() => getValue() ? String(getValue()) : ''}
        row={row}
        column={column}
        table={table}
      />
    ),
  },
  {
    accessorKey: 'overall_status',
    header: 'Overall Status',
    cell: StatusCell,
  },
  {
    accessorKey: 'operational_status',
    header: 'Operational',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorKey: 'intervention',
    header: 'Intervention',
    cell: EditableCell,
  },
]

function Projects() {
  const { projects, loading, error, updateProject } = useProjects()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])

  const table = useReactTable({
    data: projects,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: { updateProject },
  })

  if (loading) return <div className="p-6 text-gray-500">Loading projects...</div>
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Projects</h1>
        <input
          type="text"
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

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
                <tr key={row.id} className="hover:bg-gray-50">
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

      <p className="text-xs text-gray-400 mt-2">
        {table.getFilteredRowModel().rows.length} of {projects.length} projects
      </p>
    </div>
  )
}

export default Projects