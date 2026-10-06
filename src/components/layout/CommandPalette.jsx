import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useProjects } from '../../hooks/useProjects'
import { useBeneficiaries } from '../../hooks/useBeneficiaries'
import { useContacts } from '../../hooks/useContacts'
import { NAV_GROUPS } from './navConfig'
import { SearchIcon } from './icons'

const GROUP_LABEL = { page: 'Go to', project: 'Projects', beneficiary: 'Beneficiaries', contact: 'Contacts' }
const PER_GROUP = 6

// Global search. Mounted only while open, so its three hooks fetch fresh data
// each time it opens — results never go stale after you add/edit a record.
// Rendered through a portal: the top bar is a stacking context, so without it
// the sidebar would paint over the backdrop.
export default function CommandPalette({ onClose }) {
  const navigate = useNavigate()
  const { projects, loading: pl }      = useProjects()
  const { beneficiaries, loading: bl } = useBeneficiaries()
  const { contacts, loading: cl }      = useContacts()

  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef(null)

  const items = useMemo(() => {
    const list = []
    for (const p of projects) {
      const b = p.beneficiaries
      list.push({
        type: 'project', id: p.id, to: `/projects/${p.id}`,
        title: p.title || p.project_types?.name || 'Untitled project',
        subtitle: [b?.name, b?.municipality, p.year].filter(Boolean).join(' · '),
        haystack: [p.title, p.project_types?.name, b?.name, b?.municipality, b?.barangay, p.year, p.property_number, p.entry_point, p.intervention, p.overall_status]
          .filter(Boolean).join(' ').toLowerCase(),
      })
    }
    for (const b of beneficiaries) {
      list.push({
        type: 'beneficiary', id: b.id, to: `/beneficiaries?edit=${b.id}`,
        title: b.name,
        subtitle: [b.category, b.barangay, b.municipality].filter(Boolean).join(' · '),
        haystack: [b.name, b.category, b.district, b.municipality, b.barangay].filter(Boolean).join(' ').toLowerCase(),
      })
    }
    for (const c of contacts) {
      list.push({
        type: 'contact', id: c.id, to: `/contacts?edit=${c.id}`,
        title: c.name,
        subtitle: [c.role, (c.beneficiaries ?? []).map(b => b.name).join('; ')].filter(Boolean).join(' · '),
        haystack: [c.name, c.role, c.contact_number, ...(c.beneficiaries ?? []).flatMap(b => [b.name, b.municipality])].filter(Boolean).join(' ').toLowerCase(),
      })
    }
    return list
  }, [projects, beneficiaries, contacts])

  const flat = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return NAV_GROUPS.flatMap(g => g.items).map(i => ({ type: 'page', id: i.to, to: i.to, title: i.label, subtitle: '' }))
    }
    const tokens = q.split(/\s+/)
    const matches = items.filter(it => tokens.every(t => it.haystack.includes(t)))
    return ['project', 'beneficiary', 'contact'].flatMap(type =>
      matches.filter(m => m.type === type).slice(0, PER_GROUP)
    )
  }, [query, items])

  useEffect(() => { setActive(0) }, [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function go(item) {
    if (!item) return
    navigate(item.to)
    onClose()
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (flat.length ? (i + 1) % flat.length : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (flat.length ? (i - 1 + flat.length) % flat.length : 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[active]) }
  }

  const loading = pl || bl || cl
  const hasQuery = query.trim() !== ''

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-gray-200">
          <SearchIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, beneficiaries, contacts..."
            className="flex-1 py-3.5 text-sm bg-transparent text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {loading ? 'Searching...' : `No results for "${query.trim()}"`}
            </p>
          ) : (
            flat.map((r, i) => (
              <div key={`${r.type}-${r.id}`}>
                {(i === 0 || flat[i - 1].type !== r.type) && (
                  <div className="px-4 pt-2 pb-1 text-xs font-medium text-gray-400">{GROUP_LABEL[r.type]}</div>
                )}
                <button
                  data-idx={i}
                  onClick={() => go(r)}
                  onMouseMove={() => setActive(i)}
                  className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 ${i === active ? 'bg-blue-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-800 truncate">{r.title}</span>
                    {r.subtitle && <span className="block text-xs text-gray-400 truncate">{r.subtitle}</span>}
                  </span>
                  {i === active && <span className="text-xs text-gray-400 flex-shrink-0">↵</span>}
                </button>
              </div>
            ))
          )}
          {hasQuery && loading && flat.length > 0 && (
            <p className="text-xs text-gray-400 text-center pt-2">Still loading more results...</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}