import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useBeneficiaries, projectCount } from '../../hooks/useBeneficiaries'
import BeneficiaryModal from './BeneficiaryModal'

export default function Beneficiaries() {
  const {
    beneficiaries, loading, error,
    addBeneficiary, updateBeneficiary, deleteBeneficiary,
  } = useBeneficiaries()

  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch]                   = useState('')
  const [showModal, setShowModal]             = useState(false)
  const [editingBeneficiary, setEditingBeneficiary] = useState(null) // null = add mode
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteError, setDeleteError]         = useState(null)

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

  async function handleDelete(id) {
    const { error } = await deleteBeneficiary(id)
    setConfirmDeleteId(null)
    // Belt-and-suspenders: the button is already disabled when a beneficiary
    // has projects, but if that ever changes underneath us (e.g. another
    // tab adds a project mid-session), surface the real FK error instead
    // of failing silently.
    if (error) setDeleteError({ id, message: error })
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
            onClick={openAdd}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            + Add Beneficiary
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">District</th>
              <th className="px-4 py-3 text-left font-medium">Municipality</th>
              <th className="px-4 py-3 text-left font-medium">Barangay</th>
              <th className="px-4 py-3 text-left font-medium">Projects</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No beneficiaries found
                </td>
              </tr>
            ) : (
              filtered.map(b => {
                const count = projectCount(b)
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">{b.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{b.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{b.district ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{b.municipality ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{b.barangay ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {confirmDeleteId === b.id ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3">
                          <button
                            onClick={() => openEdit(b)}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => count === 0 && setConfirmDeleteId(b.id)}
                            disabled={count > 0}
                            title={count > 0 ? `Cannot delete — used by ${count} project${count === 1 ? '' : 's'}` : undefined}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-red-400"
                          >
                            Delete
                          </button>
                        </span>
                      )}
                      {deleteError?.id === b.id && (
                        <div className="text-xs text-red-500 mt-1 text-left">{deleteError.message}</div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <BeneficiaryModal
          beneficiary={editingBeneficiary}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}