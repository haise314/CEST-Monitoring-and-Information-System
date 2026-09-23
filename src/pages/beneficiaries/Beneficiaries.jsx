import { useState, useMemo, useEffect } from 'react'
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table'
import { useSearchParams } from 'react-router'
import { useBeneficiaries, projectCount } from '../../hooks/useBeneficiaries'
import { useColumnSizing } from '../../hooks/useColumnSizing'
import ResizableTh from '../../components/common/ResizableTh'
import { ALL_COLUMNS } from './columns'
import BeneficiaryModal from './BeneficiaryModal'

export default function Beneficiaries() {
  const {
    beneficiaries, loading, error,
    addBeneficiary, updateBeneficiary, deleteBeneficiary,
  } = useBeneficiaries()

  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch]                   = useState('')
  const [sorting, setSorting]                 = useState([])
  const [columnSizing, setColumnSizing]       = useColumnSizing('beneficiariesColumnSizing')
  const [showModal, setShowModal]             = useState(false)
  const [editingBeneficiary, setEditingBeneficiary] = useState(null) // null = add mode

  // Deep-link support: /beneficiaries?edit=123 opens that beneficiary's
  // edit modal directly. Used by the "View / edit beneficiary" link in
  // the project EditPanel, so jumping between the two feels connected
  // instead of dropping you on a flat list to search again.
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading) return
    const match = beneficiaries.find(b => String(b.id) === editId)
    if (match) {
      setEditingBeneficiary(match)
      setShowModal(true)
    }
    // Clear the param either way so it doesn't reopen after closing
    // or keep trying to match once the data has loaded.
    setSearchParams({}, { replace: true })
  }, [searchParams, beneficiaries, loading])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return beneficiaries
    return beneficiaries.filter(b =>
      [b.name, b.category, b.municipality, b.barangay, b.district]
        .filter(Boolean)
        .some(field => field.toLowerCase().includes(q))
    )
  }, [beneficiaries, search])

  const table = useReactTable({
    data: filtered,
    columns: ALL_COLUMNS,
    state: { sorting, columnSizing },
    onSortingChange:      setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode:     'onChange',
    getCoreRowModel:      getCoreRowModel(),
    getSortedRowModel:    getSortedRowModel(),
  })

  function openAdd() {
    setEditingBeneficiary(null)
    setShowModal(true)
  }

  function openEdit(beneficiary) {
    setEditingBeneficiary(beneficiary)
    setShowModal(true)
  }

  async function handleSave(payload) {
    if (editingBeneficiary) return updateBeneficiary(editingBeneficiary.id, payload)
    return addBeneficiary(payload)
  }

  // Passed into the modal's Danger Zone. The modal itself disables the
  // delete action when linkedProjectCount > 0 (see BeneficiaryModal), but
  // this defensive re-check stays here too in case that count changes
  // underneath us (e.g. another tab adds a project mid-session).
  async function handleDelete(id) {
    const result = await deleteBeneficiary(id)
    if (!result.error) setShowModal(false)
    return result
  }

  if (loading) return <div className="p-6 text-gray-500">Loading beneficiaries...</div>
  if (error)   return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">
          Beneficiaries
          <span className="ml-2 text-sm font-normal text-gray-400">
            {filtered.length} of {beneficiaries.length}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search name, category, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setColumnSizing({})}
            title="Reset column widths to default"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ↺ Widths
          </button>
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            + Add Beneficiary
          </button>
        </div>
      </div>

      {/* Table — click any row to open its edit modal (delete lives inside) */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="text-sm" style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
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
                  No beneficiaries found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => openEdit(row.original)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-4 py-3 truncate"
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

      {/* Add/Edit Modal */}
      {showModal && (
        <BeneficiaryModal
          beneficiary={editingBeneficiary}
          linkedProjectCount={editingBeneficiary ? projectCount(editingBeneficiary) : 0}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          onDelete={editingBeneficiary ? handleDelete : undefined}
        />
      )}
    </div>
  )
}