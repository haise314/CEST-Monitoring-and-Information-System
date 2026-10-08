import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// One confirmation dialog for the whole app (replaces window.confirm, the
// useBlocker dialog and the hand-rolled red "Are you sure?" boxes).
//
//   <ConfirmDialog
//     title="Delete this contact?"
//     message="It will be removed everywhere. This cannot be undone."
//     confirmLabel="Yes, delete"
//     tone="danger"            // 'danger' | 'primary'
//     busy={deleting}
//     onConfirm={...} onCancel={...}
//   />
//
// Rendered in a portal above every modal (z-[70]). Esc cancels, and that Esc
// is swallowed here so the modal underneath doesn't also close.
export default function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', busy = false, onConfirm, onCancel,
}) {
  const cancelRef = useRef(null)
  const cancelFn = useRef(onCancel)
  cancelFn.current = onCancel

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cancelFn.current?.()
      }
    }
    window.addEventListener('keydown', onKey, true) // capture: runs before the modal's listener
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const confirmCls = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-blue-600 hover:bg-blue-700'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-sm p-5"
      >
        <h2 id="confirm-title" className="text-base font-semibold text-gray-800 mb-1">{title}</h2>
        {message && <p id="confirm-message" className="text-sm text-gray-600 mb-4">{message}</p>}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="border border-gray-300 bg-white rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`${confirmCls} text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}