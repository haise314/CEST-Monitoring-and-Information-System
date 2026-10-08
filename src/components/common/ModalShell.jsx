import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

// Shared frame for centered modals (bottom sheet on phones): fixed header,
// scrolling body, and a footer that stays visible so Save is never scrolled
// away.
//
//   <ModalShell title="Add Project" subtitle="..." size="lg" dirty={isEdited}
//               onClose={...} footer={<>buttons</>}>
//     ...body...
//   </ModalShell>
//
// size: 'sm' | 'md' | 'lg'.
// dirty: when true, Esc / ✕ ask "Discard unsaved changes?" first. The
//   backdrop still does NOT close the modal (a stray click shouldn't lose a
//   half-filled form).
// Also: locks page scroll while open, moves focus into the dialog, traps Tab
// inside it, and gives focus back to whatever opened it on close.
const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

let idCounter = 0

export default function ModalShell({ title, subtitle, onClose, footer, size = 'md', dirty = false, children }) {
  const dialogRef = useRef(null)
  const [titleId] = useState(() => `modal-title-${++idCounter}`)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Always call the latest props from the (once-bound) key listener.
  const latest = useRef({ onClose, dirty })
  latest.current = { onClose, dirty }

  function requestClose() {
    if (latest.current.dirty) setConfirmDiscard(true)
    else latest.current.onClose()
  }
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  // Scroll lock + focus handling
  useEffect(() => {
    const opener = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus({ preventScroll: true }) // the container, so phones don't pop the keyboard
    return () => {
      document.body.style.overflow = prevOverflow
      if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
    }
  }, [])

  // Esc + Tab trap
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { requestCloseRef.current(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white w-full ${SIZES[size] ?? SIZES.md} flex flex-col max-h-[92dvh] rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 focus:outline-none`}
      >
        {/* Drag-handle look on phones (purely visual) */}
        <div className="sm:hidden flex justify-center pt-2" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-gray-800 break-words">{title}</h2>
            {subtitle && <p className="text-xs text-gray-600 mt-0.5 break-words">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-800 text-xl leading-none p-2 -m-2"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-b-xl">
            {footer}
          </div>
        )}
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="You've edited this form but haven't saved. Closing now will lose those edits."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => { setConfirmDiscard(false); latest.current.onClose() }}
        />
      )}
    </div>
  )
}