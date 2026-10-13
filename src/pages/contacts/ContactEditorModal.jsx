import { createPortal } from 'react-dom'
import ContactModal from './ContactModal'

// ContactModal rendered through a portal so it sits above slide-overs/modals.
// Props: contact (null = new), onSave, onDelete, onClose.
export default function ContactEditorModal(props) {
  return createPortal(<ContactModal {...props} />, document.body)
}