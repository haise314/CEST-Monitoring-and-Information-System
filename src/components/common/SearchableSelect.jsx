import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// Searchable replacement for a native <select> (long lists: beneficiaries,
// and later contacts). Themed through the same gray/white utilities as the
// rest of the app, so dark mode works with no dark: classes.
//
//   <SearchableSelect
//     value={form.beneficiary_id}                  // string or number
//     onChange={v => handleChange('beneficiary_id', v)}   // v is a string
//     options={[{ value: 1, label: 'Name (Town)' }, ...]}
//     placeholder="Select beneficiary..."
//     footerAction={{ label: '+ Add new...', onClick }}   // optional
//     className={inputClass}                       // sizing/border, like <Select>
//   />
//
// The list is rendered in a portal with fixed positioning so it is never
// clipped by a modal's overflow-y-auto, and it flips upward near the bottom
// of the screen. Inside a disabled <fieldset> the trigger is disabled natively.

const isTouch = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No matches',
  disabled = false,
  className = '',
  footerAction = null,
}) {
  const [open, setOpen]     = useState(false)
  const [q, setQ]           = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos]       = useState(null)
  const triggerRef = useRef(null)
  const popRef     = useRef(null)
  const listRef    = useRef(null)

  const selected = options.find(o => String(o.value) === String(value ?? ''))

  const shown = useMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return options
    return options.filter(o => {
      const label = o.label.toLowerCase()
      return tokens.every(t => label.includes(t))
    })
  }, [options, q])

  const close = useCallback(() => { setOpen(false); setQ('') }, [])

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const above = r.top
    const up = below < 280 && above > below
    const maxH = Math.max(160, Math.min(320, (up ? above : below) - 12))
    setPos({
      left: r.left,
      width: r.width,
      maxH,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [])

  useLayoutEffect(() => { if (open) { place(); setActive(0) } }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = e => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      close()
    }
    const onScroll = e => { if (!popRef.current?.contains(e.target)) place() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close, place])

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function pick(o) {
    onChange(String(o.value))
    close()
    triggerRef.current?.focus()
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); triggerRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (shown.length ? (i + 1) % shown.length : 0)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => (shown.length ? (i - 1 + shown.length) % shown.length : 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); if (shown[active]) pick(shown[active]) }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${className} bg-white text-left text-gray-800 flex items-center justify-between gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>{selected ? selected.label : placeholder}</span>
        <span className="text-gray-400 text-xs flex-shrink-0" aria-hidden="true">▾</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          role="listbox"
          onKeyDown={onKeyDown}
          className="fixed z-[75] flex flex-col bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
        >
          <div className="p-2 border-b border-gray-100 flex-shrink-0">
            <input
              autoFocus={!isTouch()}
              value={q}
              onChange={e => { setQ(e.target.value); setActive(0) }}
              placeholder={searchPlaceholder}
              className="w-full border border-gray-300 rounded px-3 py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div ref={listRef} className="overflow-y-auto py-1 min-h-0">
            {shown.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">{emptyText}</p>}
            {shown.map((o, i) => {
              const isSel = selected && String(selected.value) === String(o.value)
              return (
                <button
                  type="button"
                  key={o.value}
                  data-idx={i}
                  role="option"
                  aria-selected={isSel}
                  onClick={() => pick(o)}
                  onMouseMove={() => setActive(i)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 sm:py-1.5 text-sm text-left text-gray-800 ${i === active ? 'bg-blue-50' : ''}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <span className="text-blue-600 text-xs flex-shrink-0">✓</span>}
                </button>
              )
            })}
          </div>

          {footerAction && (
            <button
              type="button"
              onClick={() => { close(); footerAction.onClick() }}
              className="flex-shrink-0 w-full text-left px-3 py-2.5 sm:py-2 text-sm text-blue-600 hover:bg-gray-50 border-t border-gray-100"
            >
              {footerAction.label}
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}