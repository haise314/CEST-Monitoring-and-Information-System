import { useState, useMemo } from 'react'
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table'
import { useContacts } from '../../hooks/useContacts'
import { useFormData } from '../../hooks/useFormData'
import { useColumnSizing } from '../../hooks/useColumnSizing'
import ResizableTh from '../../components/common/ResizableTh'
import { ALL_COLUMNS } from './columns'
import ContactModal from './ContactModal'

export default function Contacts() {
  const { contacts, loading, error, addContact, updateContact, deleteContact } = useContacts()
  const { beneficiaries } = useFormData() // already fetches beneficiaries for dropdowns elsewhere

  const [search, setSearch]         = useState('')
  const [sorting, setSorting]       = useState([])
  const [columnSizing, setColumnSizing] = useColumnSizing('contactsColumnSizing')
  const [showModal, setShowModal]   = useState(false)
  const [editingContact, setEditingContact] = useState(null) // null = add mode

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(c =>
      [c.name, c.role, c.contact_number, c.beneficiaries?.name, c.beneficiaries?.municipality]
        .filter(Boolean)
        .some(field => field.toLowerCase().includes(q))
    )
  }, [contacts, search])

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
    setEditingContact(null)
    setShowModal(true)
  }

  function openEdit(contact) {
    setEditingContact(contact)
    setShowModal(true)
  }

  async function handleSave(payload) {
    if (editingContact) return updateContact(editingContact.id, payload)
    return addContact(payload)
  }

  // Passed into the modal's Danger Zone — closes the modal on success,
  // same pattern as editPanel.jsx's project delete.
  async function handleDelete(id) {
    const result = await deleteContact(id)
    if (!result.error) setShowModal(false)
    return result
  }

  if (loading) return <div className="p-6 text-gray-500">Loading contacts...</div>
  if (error)   return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">
          Contacts
          <span className="ml-2 text-sm font-normal text-gray-400">
            {filtered.length} of {contacts.length}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search name, beneficiary, municipality..."
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
            + Add Contact
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
                  No contacts found
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
        <ContactModal
          contact={editingContact}
          beneficiaries={beneficiaries}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          onDelete={editingContact ? handleDelete : undefined}
        />
      )}
    </div>
  )
}