import L from 'leaflet'
import { svgMaskUrl } from '../../lib/svgIcon'

// Pin = white pill with a colored border (color-by category/status) holding up
// to MAX_GLYPHS project-type glyphs, then "+N". Glyphs are CSS masks filled
// with the pin color. Filtered-out pins are small gray dots.

const MAX_GLYPHS = 3
const H = 30
const GLYPH = 18

function glyph(svg, color) {
  if (!svg) {
    // type has no icon uploaded yet: generic dot
    return `<span style="display:block;width:10px;height:10px;margin:4px;border-radius:50%;background:${color}"></span>`
  }
  const m = svgMaskUrl(svg)
  return `<span style="display:block;width:${GLYPH}px;height:${GLYPH}px;background:${color};` +
    `-webkit-mask:${m} center/contain no-repeat;mask:${m} center/contain no-repeat"></span>`
}

function dot(color, dimmed) {
  const size = dimmed ? 14 : 20
  const fill = dimmed ? '#d1d5db' : color
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${fill};opacity:${dimmed ? 0.6 : 1};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function build(iconsById, typeIds, color, dimmed) {
  if (dimmed || typeIds.length === 0) return dot(color, dimmed)

  const shown = typeIds.slice(0, MAX_GLYPHS)
  const extra = typeIds.length - shown.length
  const inner = shown.map(id => glyph(iconsById[id], color)).join('')
  const more = extra > 0
    ? `<span style="font:700 11px/1 system-ui;color:${color};padding-left:2px">+${extra}</span>`
    : ''

  const width = 12 + shown.length * GLYPH + (shown.length - 1) * 3 + (extra > 0 ? 22 : 0)
  return L.divIcon({
    className: '',
    html: `<div style="box-sizing:border-box;width:${width}px;height:${H}px;display:flex;align-items:center;justify-content:center;gap:3px;` +
      `background:#fff;border:2.5px solid ${color};border-radius:${H / 2}px;box-shadow:0 1px 4px rgba(0,0,0,0.4)">${inner}${more}</div>`,
    iconSize: [width, H],
    iconAnchor: [width / 2, H / 2],
    popupAnchor: [0, -H / 2],
  })
}

// One factory per icon set, each with its own cache. Create it in a useMemo
// keyed on iconsById so uploading a new icon invalidates everything.
export function makeIconFactory(iconsById) {
  const cache = new Map()
  return (typeIds, color, dimmed) => {
    const key = `${typeIds.slice(0, MAX_GLYPHS).join(',')}|${typeIds.length}|${color}|${dimmed}`
    if (!cache.has(key)) cache.set(key, build(iconsById, typeIds, color, dimmed))
    return cache.get(key)
  }
}

// Distinct project_type_ids of a beneficiary, newest project first.
export function typeIdsFor(b) {
  const seen = new Set()
  const out = []
  for (const p of [...b.projects].sort((a, c) => (c.year ?? 0) - (a.year ?? 0))) {
    if (p.project_type_id == null || seen.has(p.project_type_id)) continue
    seen.add(p.project_type_id)
    out.push(p.project_type_id)
  }
  return out
}

export function clusterIcon(cluster) {
  return L.divIcon({
    html: `<span class="cest-cluster">${cluster.getChildCount()}</span>`,
    className: '',
    iconSize: [36, 36],
  })
}