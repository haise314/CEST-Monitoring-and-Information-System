    import { createPortal } from 'react-dom'
import { useFormData } from '../../hooks/useFormData'
import ContactModal from './ContactModal'

// ContactModal for pages that don't already hold the beneficiary list
// (the beneficiary and project pages). Loads it itself and renders through a
// portal so it sits above slide-overs and other modals.
// Props: contact (null = new), defaultBeneficiaryId, onSave, onDelete, onClose.
export default function ContactEditorModal({ contact, defaultBeneficiaryId, onSave, onDelete, onClose }) {
  const { beneficiaries, loading } = useFormData()
  if (loading) return null
  return createPortal(
    <ContactModal
      contact={contact}
      beneficiaries={beneficiaries}
      defaultBeneficiaryId={defaultBeneficiaryId}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
    />,
    document.body
  )
}