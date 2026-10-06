// ─── Select ────────────────────────────────────────────────────────────────
// Thin wrapper around a native <select>, existing only to guarantee every
// dropdown in the app gets an explicit background + text color.
//
// Why this exists: a bare <select className="border border-gray-300 ...">
// with no bg-*/text-* class relies on the browser's own dark-mode rendering
// of native form controls (via `color-scheme: dark` in theme.css), which is
// inconsistent across browsers/OSes — in practice the open dropdown list
// stayed white while the select's own text inherited the page's (correctly
// themed) color, making options unreadable. Explicit `bg-white text-gray-700`
// sidesteps native rendering entirely and themes correctly via the same
// CSS-variable remapping every other surface already uses.
//
// Deliberately minimal: BASE only sets background/text/border/focus — never
// padding, width, or text size. Every call site still supplies its own
// sizing via className (same as the inputClass/selectClass constant each
// file already defines for its inputs), so there's no risk of a BASE class
// and a caller's class fighting over the same property — Tailwind doesn't
// resolve that by source order, so overlap is worth avoiding, not papering
// over. Pass your file's existing inputClass/selectClass straight in.
import { forwardRef } from 'react'

const BASE = 'border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

const Select = forwardRef(function Select({ className = '', ...props }, ref) {
  return <select ref={ref} className={`${BASE} ${className}`.trim()} {...props} />
})

export default Select