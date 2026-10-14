import L from 'leaflet'
import { svgMaskUrl } from '../../lib/svgIcon'

// Pin = white pill with a colored border (color-by) holding up to MAX_GLYPHS
// project-type glyphs, then "+N". Each icon is defined ONCE as a CSS class
// (.cest-g-<typeId>) in a shared <style>, so pins only carry a class name
// instead of the whole SVG. A red outer ring marks pins with overdue documents.
// Filtered-out pins are small gray dots.

const MAX_GLYPHS = 3
const H = 30
const GLYPH = 18
const STYLE_ID = 'cest-glyph-styles'
const RING = '0 0 0 3px #ef4444,'

const BASE_CSS =
  `.cest-glyph{display:block;width:${GLYPH}px;height:${GLYPH}px;background:currentColor;` +
  `-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;` +
  `-webkit-mask-size:contain;mask-size:contain}`

function installGlyphStyles(iconsById) {
  if (typeof document === 'undefined') return
  let el = document.getElementById(STYLE_ID)
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  const rules = Object.entries(iconsById).map(([id, svg]) => {
    const u = svgMaskUrl(svg)
    return `.cest-g-${id}{-webkit-mask-image:${u};mask-image:${u}}`
  })
  el.textContent = BASE_CSS + rules.join('')
}

function dot(color, dimmed, overdue) {
  const size = dimmed ? 14 : 20
  const fill = dimmed ? '#d1d5db' : color
  const ring = overdue && !dimmed ? RING : ''
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${fill};opacity:${dimmed ? 0.6 : 1};border:2px solid white;box-shadow:${ring}0 1px 3px rgba(0,0,0,0.35);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function build(iconsById, typeIds, color, dimmed, overdue) {
  if (dimmed || typeIds.length === 0) return dot(color, dimmed, overdue)

  const shown = typeIds.slice(0, MAX_GLYPHS)
  const extra = typeIds.length - shown.length
  const inner = shown.map(id =>
    iconsById[id]
      // type has an icon: styled by the shared class, colored by the pill's `color`
      ? `<span class="cest-glyph cest-g-${id}"></span>`
      // type has no icon uploaded yet: generic dot
      : `<span style="display:block;width:10px;height:10px;margin:4px;border-radius:50%;background:${color}"></span>`
  ).join('')
  const more = extra > 0
    ? `<span style="font:700 11px/1 system-ui;color:${color};padding-left:2px">+${extra}</span>`
    : ''

  const width = 12 + shown.length * GLYPH + (shown.length - 1) * 3 + (extra > 0 ? 22 : 0)
  return L.divIcon({
    className: '',
    html: `<div style="box-sizing:border-box;width:${width}px;height:${H}px;display:flex;align-items:center;justify-content:center;gap:3px;color:${color};` +
      `background:#fff;border:2.5px solid ${color};border-radius:${H / 2}px;box-shadow:${overdue ? RING : ''}0 1px 4px rgba(0,0,0,0.4)">${inner}${more}</div>`,
    iconSize: [width, H],
    iconAnchor: [width / 2, H / 2],
    popupAnchor: [0, -H / 2],
  })
}

// One factory per icon set, each with its own cache. Create it in a useMemo
// keyed on iconsById so uploading a new icon invalidates everything.
export function makeIconFactory(iconsById) {
  installGlyphStyles(iconsById)
  const cache = new Map()
  return (typeIds, color, dimmed, overdue = false) => {
    const key = `${typeIds.slice(0, MAX_GLYPHS).join(',')}|${typeIds.length}|${color}|${dimmed}|${overdue}`
    if (!cache.has(key)) cache.set(key, build(iconsById, typeIds, color, dimmed, overdue))
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