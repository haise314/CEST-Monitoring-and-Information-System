// Helpers for per-project-type map icons.
// Icons are stored as SVG text and drawn as CSS masks, so the glyph takes the
// pin's "color by" color. Only the SHAPE (opacity) of the SVG matters; its
// original colors are ignored. Use single-shape silhouettes.
//
// sanitizeSvg also tidies the file: removes scripts, metadata and full-size
// background rectangles, crops the viewBox to the real shape (so every icon
// renders at a consistent size), and rounds path numbers to shrink the text.

const MAX_INPUT_CHARS = 400000 // what we will parse
const MAX_CHARS       = 60000  // what the database accepts (after cleanup)
const WARN_CHARS      = 20000

const DRAWABLE = 'path,circle,ellipse,polygon,polyline,line,rect,text,use'

function stripComments(node) {
  ;[...node.childNodes].forEach(c => {
    if (c.nodeType === 8) c.remove()
    else stripComments(c)
  })
}

// Bounding box of the drawn content, in the SVG's own coordinates.
function measure(root) {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:100px;height:100px;overflow:hidden;visibility:hidden'
  document.body.appendChild(host)
  try {
    const clone = document.importNode(root, true)
    clone.setAttribute('width', '100')
    clone.setAttribute('height', '100')
    host.appendChild(clone)
    const b = clone.getBBox()
    return b && b.width > 0 && b.height > 0 ? b : null
  } catch {
    return null
  } finally {
    host.remove()
  }
}

function maxStroke(root) {
  let m = 0
  const vals = [root, ...root.querySelectorAll('*')].map(el => parseFloat(el.getAttribute('stroke-width')))
  vals.forEach(v => { if (Number.isFinite(v) && v > m) m = v })
  return m
}

function roundPaths(root, size) {
  const p = size >= 500 ? 0 : size >= 100 ? 1 : 2
  root.querySelectorAll('path').forEach(el => {
    const d = el.getAttribute('d')
    // Compact arc flags ("a1 1 0 011 1") break if rewritten, so leave arcs alone.
    if (!d || /[aA]/.test(d)) return
    const out = d
      .replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, n => `${+(+n).toFixed(p)} `)
      .replace(/\s+/g, ' ')
      .replace(/ ([A-Za-z])/g, '$1')
      .trim()
    el.setAttribute('d', out)
  })
}

// Validates + cleans an uploaded SVG. Returns { svg, warning? } or { error }.
export function sanitizeSvg(text) {
  if (!text || text.length > MAX_INPUT_CHARS) return { error: 'SVG file is too large (max ~400 KB).' }

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (doc.querySelector('parsererror') || root.nodeName.toLowerCase() !== 'svg') {
    return { error: 'Not a valid SVG file.' }
  }
  const notes = []

  doc.querySelectorAll('script, foreignObject, iframe, object, embed, image, metadata, title, desc').forEach(n => n.remove())
  stripComments(doc)
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const isHref = name === 'href' || name === 'xlink:href'
      if (name.startsWith('on') || (isHref && !attr.value.startsWith('#'))) {
        el.removeAttribute(attr.name)
      }
    }
  })

  // Masks scale by viewBox, so make sure there is one.
  if (!root.getAttribute('viewBox')) {
    const w = parseFloat(root.getAttribute('width'))
    const h = parseFloat(root.getAttribute('height'))
    if (!w || !h) return { error: 'SVG needs a viewBox (or numeric width and height).' }
    root.setAttribute('viewBox', `0 0 ${w} ${h}`)
  }
  root.removeAttribute('width')
  root.removeAttribute('height')
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Drop a full-size background rectangle (it would turn the icon into a solid square).
  const vb = root.getAttribute('viewBox').split(/[\s,]+/).map(Number)
  if (vb.length === 4 && root.querySelectorAll(DRAWABLE).length > 1) {
    let removed = false
    root.querySelectorAll('rect').forEach(r => {
      const w = parseFloat(r.getAttribute('width')), h = parseFloat(r.getAttribute('height'))
      if (w >= vb[2] * 0.98 && h >= vb[3] * 0.98) { r.remove(); removed = true }
    })
    if (removed) notes.push('Removed a full-size background rectangle.')
  }

  // Crop the viewBox to the actual shape.
  const box = measure(root)
  let size = Math.max(vb[2] || 0, vb[3] || 0)
  if (box) {
    const pad = maxStroke(root) / 2
    const x = box.x - pad, y = box.y - pad
    const w = box.width + pad * 2, h = box.height + pad * 2
    root.setAttribute('viewBox', `${+x.toFixed(2)} ${+y.toFixed(2)} ${+w.toFixed(2)} ${+h.toFixed(2)}`)
    size = Math.max(w, h)
  }

  roundPaths(root, size)

  const svg = new XMLSerializer().serializeToString(root)
  if (svg.length > MAX_CHARS) {
    return { error: `Icon is too detailed (${Math.round(svg.length / 1000)} KB after cleanup, max 60 KB). Use a simpler single-shape silhouette.` }
  }
  if (svg.length > WARN_CHARS) {
    notes.push(`Large icon (${Math.round(svg.length / 1000)} KB). A simpler shape keeps the map fast.`)
  }
  return { svg, warning: notes.length ? notes.join(' ') : null }
}

// CSS url() value for mask-image. encodeURIComponent leaves ' ( ) alone, which
// would break the inline style, so escape them too.
export function svgMaskUrl(svg) {
  const enc = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
  return `url('data:image/svg+xml;utf8,${enc}')`
}