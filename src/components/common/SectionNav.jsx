import { useEffect, useState } from 'react'

// Sticky in-page navigation. items: [{ id, label }] where each id is the DOM
// id of a section. Keep `items` a stable reference (module-level constant).
// Sits under the sticky Topbar (h-14), so top-14.
export default function SectionNav({ items }) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter(Boolean)
    if (els.length === 0 || !('IntersectionObserver' in window)) return
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-120px 0px -60% 0px' }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [items])

  function go(id) {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav aria-label="Sections" className="sticky top-14 z-20 bg-white border-b border-gray-200 mb-5 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
      <ul className="flex gap-1">
        {items.map(i => (
          <li key={i.id}>
            <button
              onClick={() => go(i.id)}
              aria-current={active === i.id ? 'true' : undefined}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                active === i.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
