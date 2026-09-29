import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useProjects } from '../../hooks/useProjects'
import { useColumnSizing } from '../../hooks/useColumnSizing'
import { ALL_COLUMNS, DEFAULT_VISIBLE, FILTERABLE_COLUMN_IDS } from './columns'
import FilterBar from './filterBar'
import VisibilityPanel from '../../components/common/VisibilityPanel'
import PaginationBar from '../../components/common/PaginationBar'
import ResizableTh from '../../components/common/ResizableTh'
import AddModal from './addModal'
import EditPanel from './editPanel'

function Projects() {
  const { projects, loading, error, addProject, updateProject, deleteProject } = useProjects()

  // Table state
  const [globalFilter, setGlobalFilter]           = useState('')
  const [sorting, setSorting]                     = useState([])
  const [columnVisibility, setColumnVisibility]   = useState(DEFAULT_VISIBLE)
  const [columnSizing, setColumnSizing]           = useColumnSizing('projectsColumnSizing')
  const [filters, setFilters]                     = useState(
    Object.fromEntries(FILTERABLE_COLUMN_IDS.map(id => [id, '']))
  )

  // UI state
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false)
  const [showAddModal, setShowAddModal]               = useState(false)

  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null

  // Deep-link support: /projects?edit={id} (e.g. from Dashboard) auto-opens
  // that project's edit panel on load, then clears the param — same pattern
  // as Beneficiaries.jsx. Runs once projects have loaded so the id can
  // actually be found.
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading) return
    const found = projects.find(p => p.id === Number(editId))
    if (found) setSelectedProjectId(found.id)
    setSearchParams({}, { replace: true })
  }, [searchParams, projects, loading, setSearchParams])

  // Apply dropdown filters before passing to TanStack
  const filtered = useMemo(() =>
    projects.filter(p => {
      if (filters.year               && String(p.year) !== String(filters.year))                   return false
      if (filters.project_category   && p.project_category !== filters.project_category)           return false
      if (filters.municipality       && p.beneficiaries?.municipality !== filters.municipality)    return false
      if (filters.barangay           && p.beneficiaries?.barangay     !== filters.barangay)        return false
      if (filters.district           && p.beneficiaries?.district     !== filters.district)        return false
      if (filters.category           && p.beneficiaries?.category     !== filters.category)        return false
      if (filters.overall_status     && p.overall_status              !== filters.overall_status)  return false
      if (filters.operational_status && p.operational_status          !== filters.operational_status) return false
      if (filters.project_type       && p.project_types?.name         !== filters.project_type)   return false
      if (filters.entry_point        && p.entry_point                 !== filters.entry_point)     return false
      return true
    })
  , [projects, filters])

  const table = useReactTable({
    data: filtered,
    columns: ALL_COLUMNS,
    state: { globalFilter, sorting, columnVisibility, columnSizing },
    onGlobalFilterChange:     setGlobalFilter,
    onSortingChange:          setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange:     setColumnSizing,
    columnResizeMode:         'onChange',
    getCoreRowModel:          getCoreRowModel(),
    getFilteredRowModel:      getFilteredRowModel(),
    getSortedRowModel:        getSortedRowModel(),
    getPaginationRowModel:    getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

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
          <input
            type="text"
            placeholder="Search..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setColumnSizing({})}
            title="Reset column widths to default"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ↺ Widths
          </button>
          <div className="relative">
            <button
              onClick={() => setShowVisibilityPanel(v => !v)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
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
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            + Add Project
          </button>
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
      <div className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm max-h-[calc(100vh-14rem)]">
        <table
          className="text-sm"
          style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}
        >
          <thead className="text-xs text-gray-500">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <ResizableTh key={header.id} header={header} />
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
                <tr
                  key={row.id}
                  onClick={() => setSelectedProjectId(row.original.id)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-4 py-2.5 truncate"
                    >
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

      {/* ── Add Modal ── */}
      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onAdd={addProject}
        />
      )}

      {/* ── Edit Panel ── */}
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

export default Projects