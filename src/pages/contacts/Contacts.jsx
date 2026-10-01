import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table'
import { useContacts } from '../../hooks/useContacts'
import { useFormData } from '../../hooks/useFormData'
import { useColumnSizing } from '../../hooks/useColumnSizing'
import ResizableTh from '../../components/common/ResizableTh'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import { exportTableCsv, todayStamp } from '../../lib/exportCsv'
import { ALL_COLUMNS } from './columns'
import ContactModal from './ContactModal'
import { MobileCardList, MobileCard } from '../../components/common/MobileCards'

export default function Contacts() {
  const { contacts, loading, error, addContact, updateContact, deleteContact } = useContacts()
  const toast = useToast()
  const { canEdit } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { beneficiaries } = useFormData() // already fetches beneficiaries for dropdowns elsewhere

  const [search, setSearch]         = useState('')
  const [sorting, setSorting]       = useState([])
  const [columnSizing, setColumnSizing] = useColumnSizing('contactsColumnSizing')
  const [showModal, setShowModal]   = useState(false)
  const [editingContact, setEditingContact] = useState(null) // null = add mode

  // Deep-link support: /contacts?edit=123 opens that contact's edit modal
  // (used by global search). Same pattern as Beneficiaries.jsx.
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading) return
    const match = contacts.find(c => String(c.id) === editId)
    if (match) {
      setEditingContact(match)
      setShowModal(true)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, contacts, loading]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const result = editingContact
      ? await updateContact(editingContact.id, payload)
      : await addContact(payload)
    if (!result.error) toast.success(editingContact ? 'Contact updated' : 'Contact added')
    return result
  }

  // Passed into the modal's Danger Zone — closes the modal on success,
  // same pattern as editPanel.jsx's project delete.
  async function handleDelete(id) {
    const result = await deleteContact(id)
    if (!result.error) {
      setShowModal(false)
      toast.success('Contact deleted')
    }
    return result
  }

  function handleExport() {
    const n = exportTableCsv(table, { filename: `cest-contacts-${todayStamp()}.csv` })
    toast.success(`Exported ${n} contact${n === 1 ? '' : 's'} to CSV`)
  }

  if (loading) return <div className="p-6 text-gray-500">Loading contacts...</div>
  if (error)   return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">
          Contacts
          <span className="ml-2 text-sm font-normal text-gray-400">
            {filtered.length} of {contacts.length}
          </span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search name, beneficiary, municipality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setColumnSizing({})}
            title="Reset column widths to default"
            className="hidden md:block border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ↺ Widths
          </button>
          <button
            onClick={handleExport}
            title="Download the rows currently shown (all pages) as CSV"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ⇩ Export CSV
          </button>
          {canEdit && (
<button
            onClick={openAdd}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            + Add Contact
          </button>
          )}
        </div>
      </div>

      {/* Table — click any row to open its edit modal (delete lives inside) */}
      <div className="hidden md:block overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm max-h-[calc(100vh-14rem)]">
        <table className="text-sm" style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
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
                  No contacts found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => openEdit(row.original)}
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

      {/* Cards (phones). The number is a tel: link so a call in the field
          is one tap away. */}
      <MobileCardList
        isEmpty={table.getRowModel().rows.length === 0}
        emptyText="No contacts found"
      >
        {table.getRowModel().rows.map(row => {
          const c = row.original
          const org = [c.beneficiaries?.name, c.beneficiaries?.municipality].filter(Boolean).join(' · ')
          return (
            <MobileCard key={row.id} onClick={() => openEdit(c)}>
              <div className="text-sm font-semibold text-gray-800 break-words">{c.name}</div>
              {c.role && <div className="text-xs text-gray-500 mt-0.5">{c.role}</div>}
              {org && <div className="text-xs text-gray-400 mt-0.5 break-words">{org}</div>}
              {(c.contact_number || c.messenger_link) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                  {c.contact_number && (
                    <a
                      href={`tel:${c.contact_number.replace(/[^\d+]/g, '')}`}
                      onClick={e => e.stopPropagation()}
                      className="text-blue-600 font-medium py-1"
                    >
                      {c.contact_number}
                    </a>
                  )}
                  {c.messenger_link && (
                    <a
                      href={c.messenger_link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-blue-600 py-1"
                    >
                      Messenger
                    </a>
                  )}
                </div>
              )}
            </MobileCard>
          )
        })}
      </MobileCardList>

      {/* Add/Edit Modal */}
      {showModal && (
        <ContactModal
          contact={editingContact}
          beneficiaries={beneficiaries}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          readOnly={!canEdit}
          onDelete={editingContact && canEdit ? handleDelete : undefined}
        />
      )}
    </div>
  )
}