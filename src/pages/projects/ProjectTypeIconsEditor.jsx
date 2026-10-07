import { useState } from 'react'
import { sanitizeSvg, svgMaskUrl } from '../../lib/svgIcon'

export function IconPreview({ svg, size = 24 }) {
  if (!svg) return <span className="text-xs text-gray-300">No icon</span>
  const m = svgMaskUrl(svg)
  return (
    <span
      style={{
        display: 'inline-block', width: size, height: size, background: '#2563eb',
        WebkitMask: `${m} center/contain no-repeat`, mask: `${m} center/contain no-repeat`,
      }}
    />
  )
}

// One row's icon controls. type: { id, name, icon_svg }
// onSave(id, svg | null) -> { error }  (pass `saveIcon` from useProjectTypeIcons;
// the parent owns the single hook instance). Render for admins only.
export default function ProjectTypeIconEditor({ type, onSave }) {
  const [draft, setDraft]   = useState(null) // sanitized SVG awaiting save
  const [error, setError]   = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const { svg, error } = sanitizeSvg(await file.text())
    setError(error ?? null)
    setDraft(error ? null : svg)
  }

  async function commit(svg) {
    setSaving(true)
    const { error } = await onSave(type.id, svg)
    setSaving(false)
    if (error) setError(error)
    else { setDraft(null); setError(null) }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <IconPreview svg={draft ?? type.icon_svg} />
      <label className="border border-gray-300 rounded px-2.5 py-1 text-xs cursor-pointer hover:bg-gray-50">
        {type.icon_svg ? 'Replace SVG…' : 'Upload SVG…'}
        <input type="file" accept=".svg,image/svg+xml" onChange={handleFile} className="hidden" />
      </label>
      {draft && (
        <>
          <button
            onClick={() => commit(draft)}
            disabled={saving}
            className="bg-blue-600 text-white rounded px-2.5 py-1 text-xs hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save icon'}
          </button>
          <button onClick={() => setDraft(null)} className="text-xs text-gray-500 underline">Cancel</button>
        </>
      )}
      {!draft && type.icon_svg && (
        <button onClick={() => commit(null)} disabled={saving} className="text-xs text-red-500 underline">
          Remove
        </button>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}