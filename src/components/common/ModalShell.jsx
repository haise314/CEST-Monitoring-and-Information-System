import { useEffect } from 'react'

// Shared frame for centered modals (bottom sheet on phones): fixed header,
// scrolling body, and a footer that stays visible so Save is never scrolled
// away. Extracted because AddModal and ContactModal both need it.
//
//   <ModalShell title="Add Project" subtitle="..." size="lg" onClose={...} footer={<>buttons</>}>
//     ...body...
//   </ModalShell>
//
// size: 'sm' | 'md' | 'lg'. Escape closes. The backdrop deliberately does NOT
// close the modal (a stray click shouldn't lose a half-filled form).
const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

export default function ModalShell({ title, subtitle, onClose, footer, size = 'md', children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white w-full ${SIZES[size] ?? SIZES.md} flex flex-col max-h-[92dvh] rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 break-words">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 break-words">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
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
    </div>
  )
}