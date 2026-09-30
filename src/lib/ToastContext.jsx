import { createContext, useContext, useState, useCallback, useMemo } from 'react'

// Lightweight toasts. Usage:  const toast = useToast();  toast.success('Saved')
// Inline error messages inside forms/modals stay as they are — toasts are for
// confirming that something worked (or a failure with no form to hang it on).
const ToastContext = createContext(undefined)

const ACCENT = {
  success: 'border-l-green-500',
  error:   'border-l-red-500',
  info:    'border-l-blue-500',
}

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), [])

  const push = useCallback((type, message) => {
    const id = nextId++
    setToasts(t => [...t.slice(-3), { id, type, message }]) // cap at 4 on screen
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500)
  }, [dismiss])

  const api = useMemo(() => ({
    success: m => push('success', m),
    error:   m => push('error', m),
    info:    m => push('info', m),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 border-l-4 ${ACCENT[t.type]} rounded-lg shadow-lg px-4 py-3 text-sm text-gray-800`}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-gray-400 hover:text-gray-700 leading-none">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (ctx === undefined) throw new Error('useToast must be used inside a ToastProvider')
  return ctx
}