import { useEffect, useMemo, useRef, useState } from 'react'
import { BLANK, emptyValue, isEmptyValue, selectOptions } from '../../lib/filterEngine'

// Modern "filter chips" UI, reusable on any list page.
//
//   <FilterChips fields={...} rows={allRows} filters={filters} onChange={setFilters} />
//
// "+ Filter" opens a searchable list of every filterable field; picking one
// adds a chip and opens its value editor. Click a chip to edit it, ✕ to remove
// it. Values inside one chip are OR'd, different chips are AND'd. On phones the
// pop-ups become bottom sheets. See lib/filterEngine.js for the data shapes.

const isTouch = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches

function fmtNum(field, n) {
  const s = Number(n).toLocaleString()
  return field.format === 'currency' ? `₱${s}` : s
}

// Text shown inside a chip after the field name.
export function summarize(field, value) {
  if (isEmptyValue(field, value)) return '…'
  switch (field.type) {
    case 'select': {
      const labels = value.map(v => (v === BLANK ? (field.blankLabel ?? '(blank)') : v))
      return labels.length <= 2 ? labels.join(', ') : `${labels[0]}, ${labels[1]} +${labels.length - 2}`
    }
    case 'text':
      return `contains “${value.trim()}”`
    case 'number': {
      const { min, max } = value
      if (min != null && max != null) return `${fmtNum(field, min)} – ${fmtNum(field, max)}`
      return min != null ? `≥ ${fmtNum(field, min)}` : `≤ ${fmtNum(field, max)}`
    }
    case 'date': {
      const { from, to } = value
      if (from && to) return `${from} – ${to}`
      return from ? `from ${from}` : `until ${to}`
    }
    case 'link':
      return value === 'yes' ? 'has a link' : 'no link'
    case 'custom':
      return field.summarize ? field.summarize(value) : ''
    default:
      return ''
  }
}

function parseNumber(raw) {
  const cleaned = String(raw).replace(/[₱$,\s]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isNaN(n) ? null : n
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

// ─── Pop-up shell: dropdown on desktop, bottom sheet on phones ───────────────

function Popover({ label, onClose, wide = false, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={onClose} />
      <div
        role="dialog"
        aria-label={label}
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[75dvh] bg-white border border-gray-200 shadow-xl rounded-t-2xl pb-[env(safe-area-inset-bottom)]
                   sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:left-0 sm:mt-1.5 ${wide ? 'sm:w-[26rem]' : 'sm:w-72'} sm:max-h-[24rem] sm:rounded-xl sm:pb-0`}
      >
        {children}
      </div>
    </>
  )
}

function EditorFooter({ onClear, onDone, canClear }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 flex-shrink-0">
      <button
        onClick={onClear}
        disabled={!canClear}
        className="text-sm sm:text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40 py-1"
      >
        Clear
      </button>
      <button
        onClick={onDone}
        className="bg-blue-600 text-white rounded-lg px-4 py-1.5 sm:px-3 sm:py-1 text-sm sm:text-xs font-medium hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  )
}

// ─── Field picker (the "+ Filter" menu) ──────────────────────────────────────

function FieldPicker({ fields, activeIds, onPick }) {
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const map = new Map()
    for (const f of fields) {
      if (needle && !f.label.toLowerCase().includes(needle)) continue
      const g = f.group ?? 'Fields'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(f)
    }
    return [...map.entries()]
  }, [fields, q])

  return (
    <>
      <div className="p-2 border-b border-gray-100 flex-shrink-0">
        <input
          autoFocus={!isTouch()}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Filter by…"
          className={inputCls}
        />
      </div>
      <div className="overflow-y-auto py-1 min-h-0">
        {groups.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">No matching field</p>}
        {groups.map(([group, list]) => (
          <div key={group}>
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group}</div>
            {list.map(f => (
              <button
                key={f.id}
                onClick={() => onPick(f.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 sm:py-1.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
              >
                <span>{f.label}</span>
                {activeIds.has(f.id) && <span className="text-xs text-blue-600">✓ active</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Value editors ───────────────────────────────────────────────────────────

function SelectEditor({ field, value, options, onChange, onDone }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = needle ? options.filter(o => o.label.toLowerCase().includes(needle)) : options
  const toggle = key => onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key])

  return (
    <>
      {options.length > 7 && (
        <div className="p-2 border-b border-gray-100 flex-shrink-0">
          <input
            autoFocus={!isTouch()}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={`Search ${field.label.toLowerCase()}…`}
            className={inputCls}
          />
        </div>
      )}
      <div className="overflow-y-auto py-1 min-h-0">
        {shown.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">No values</p>}
        {shown.map(o => {
          const checked = value.includes(o.value)
          return (
            <label
              key={o.value}
              className="flex items-center gap-2.5 px-3 py-2.5 sm:py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(o.value)}
                className="h-4 w-4 rounded flex-shrink-0"
              />
              <span className={`flex-1 truncate ${o.count === 0 && !checked ? 'text-gray-400' : 'text-gray-800'}`}>{o.label}</span>
              <span className="text-xs text-gray-400 tabular-nums">{o.count}</span>
            </label>
          )
        })}
      </div>
      <EditorFooter onClear={() => onChange([])} onDone={onDone} canClear={value.length > 0} />
    </>
  )
}

function TextEditor({ field, value, onChange, onDone }) {
  return (
    <>
      <div className="p-3">
        <input
          autoFocus={!isTouch()}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onDone() }}
          placeholder={`${field.label} contains…`}
          className={inputCls}
        />
      </div>
      <EditorFooter onClear={() => onChange('')} onDone={onDone} canClear={value !== ''} />
    </>
  )
}

function NumberEditor({ field, value, onChange, onDone }) {
  // Keep what the user typed as text (so "1," mid-typing isn't mangled) and
  // push the parsed numbers up on every keystroke.
  const [min, setMin] = useState(value.min == null ? '' : String(value.min))
  const [max, setMax] = useState(value.max == null ? '' : String(value.max))
  const push = (a, b) => onChange({ min: parseNumber(a), max: parseNumber(b) })

  return (
    <>
      <div className="p-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">
          Min
          <input
            inputMode="decimal"
            value={min}
            onChange={e => { setMin(e.target.value); push(e.target.value, max) }}
            onKeyDown={e => { if (e.key === 'Enter') onDone() }}
            className={`${inputCls} mt-1`}
            placeholder={field.format === 'currency' ? '₱' : ''}
          />
        </label>
        <label className="text-xs text-gray-500">
          Max
          <input
            inputMode="decimal"
            value={max}
            onChange={e => { setMax(e.target.value); push(min, e.target.value) }}
            onKeyDown={e => { if (e.key === 'Enter') onDone() }}
            className={`${inputCls} mt-1`}
            placeholder={field.format === 'currency' ? '₱' : ''}
          />
        </label>
      </div>
      <EditorFooter
        onClear={() => { setMin(''); setMax(''); onChange({ min: null, max: null }) }}
        onDone={onDone}
        canClear={value.min != null || value.max != null}
      />
    </>
  )
}

function DateEditor({ value, onChange, onDone }) {
  return (
    <>
      <div className="p-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">
          From
          <input type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          To
          <input type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })} className={`${inputCls} mt-1`} />
        </label>
      </div>
      <EditorFooter onClear={() => onChange({ from: '', to: '' })} onDone={onDone} canClear={!!(value.from || value.to)} />
    </>
  )
}

function LinkEditor({ value, onChange, onDone }) {
  const opt = (key, label) => (
    <button
      key={key}
      onClick={() => onChange(value === key ? '' : key)}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
        value === key ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
  return (
    <>
      <div className="p-3 flex gap-2">
        {opt('yes', 'Has a link')}
        {opt('no', 'No link')}
      </div>
      <EditorFooter onClear={() => onChange('')} onDone={onDone} canClear={value !== ''} />
    </>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function FilterChips({ fields, rows, filters, onChange }) {
  const rootRef = useRef(null)
  const [openKey, setOpenKey] = useState(null) // 'add' | a field id | null

  const byId = useMemo(() => Object.fromEntries(fields.map(f => [f.id, f])), [fields])
  const chips = filters.filter(f => byId[f.field])
  const activeIds = useMemo(() => new Set(chips.map(f => f.field)), [chips])

  // Closing also drops chips that were opened but never given a value.
  function close() {
    setOpenKey(null)
    const kept = filters.filter(f => byId[f.field] && !isEmptyValue(byId[f.field], f.value))
    if (kept.length !== filters.length) onChange(kept)
  }

  useEffect(() => {
    if (openKey == null) return
    const onDown = e => { if (rootRef.current && !rootRef.current.contains(e.target)) close() }
    const onKey  = e => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }) // re-bound each render so close() always sees the latest filters

  function pick(fieldId) {
    if (!filters.some(f => f.field === fieldId)) {
      onChange([...filters, { field: fieldId, value: emptyValue(byId[fieldId]) }])
    }
    setOpenKey(fieldId)
  }
  const setValue = (fieldId, value) =>
    onChange(filters.map(f => (f.field === fieldId ? { ...f, value } : f)))
  const remove = fieldId => {
    setOpenKey(null)
    onChange(filters.filter(f => f.field !== fieldId))
  }

  const activeCount = chips.filter(f => !isEmptyValue(byId[f.field], f.value)).length

  return (
    <div ref={rootRef} className="flex flex-wrap items-center gap-2 mb-3">
      {chips.map(f => {
        const field = byId[f.field]
        const open = openKey === f.field
        const options = open && field.type === 'select' ? selectOptions(rows, filters, fields, f.field) : null
        return (
          <div key={f.field} className="relative inline-flex">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 text-blue-800 text-xs">
              <button
                onClick={() => (open ? close() : setOpenKey(f.field))}
                aria-expanded={open}
                className="pl-3 pr-1.5 py-2 sm:py-1.5 max-w-[15rem] truncate text-left"
              >
                <span className="font-semibold">{field.label}</span>{' '}
                <span className="opacity-80">{summarize(field, f.value)}</span>
              </button>
              <button
                onClick={() => remove(f.field)}
                aria-label={`Remove ${field.label} filter`}
                className="pl-1 pr-2.5 py-2 sm:py-1.5 text-blue-500 hover:text-blue-900"
              >
                ✕
              </button>
            </div>

            {open && (
              <Popover label={`${field.label} filter`} onClose={close} wide={field.type === 'custom'}>
                {field.type === 'select' && (
                  <SelectEditor field={field} value={f.value} options={options} onChange={v => setValue(f.field, v)} onDone={close} />
                )}
                {field.type === 'text'   && <TextEditor   field={field} value={f.value} onChange={v => setValue(f.field, v)} onDone={close} />}
                {field.type === 'number' && <NumberEditor field={field} value={f.value} onChange={v => setValue(f.field, v)} onDone={close} />}
                {field.type === 'date'   && <DateEditor   value={f.value} onChange={v => setValue(f.field, v)} onDone={close} />}
                {field.type === 'link'   && <LinkEditor   value={f.value} onChange={v => setValue(f.field, v)} onDone={close} />}
                {field.type === 'custom' && (
                  <>
                    <field.Editor field={field} value={f.value} onChange={v => setValue(f.field, v)} onDone={close} />
                    <EditorFooter
                      onClear={() => setValue(f.field, emptyValue(field))}
                      onDone={close}
                      canClear={!isEmptyValue(field, f.value)}
                    />
                  </>
                )}
              </Popover>
            )}
          </div>
        )
      })}

      <div className="relative inline-flex">
        <button
          onClick={() => (openKey === 'add' ? close() : setOpenKey('add'))}
          aria-expanded={openKey === 'add'}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-2 sm:py-1.5 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50"
        >
          <span className="text-sm leading-none">+</span> Filter
        </button>
        {openKey === 'add' && (
          <Popover label="Add a filter" onClose={close}>
            <FieldPicker fields={fields} activeIds={activeIds} onPick={pick} />
          </Popover>
        )}
      </div>

      {activeCount > 0 && (
        <button
          onClick={() => { setOpenKey(null); onChange([]) }}
          className="text-xs text-gray-500 hover:text-gray-800 underline py-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}