// Helpers for per-project-type map icons.
// Icons are stored as SVG text and drawn as CSS masks, so the glyph takes the
// pin's "color by" color. Only the SHAPE (opacity) of the SVG matters; its
// original colors are ignored. Use single-shape silhouettes, no background <rect>.

const MAX_CHARS = 60000

// Validates + cleans an uploaded SVG. Returns { svg } or { error }.
export function sanitizeSvg(text) {
  if (!text || text.length > MAX_CHARS) return { error: 'SVG is too large (max ~60 KB).' }

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (doc.querySelector('parsererror') || root.nodeName.toLowerCase() !== 'svg') {
    return { error: 'Not a valid SVG file.' }
  }

  doc.querySelectorAll('script, foreignObject, iframe, object, embed, image').forEach(n => n.remove())
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

  return { svg: new XMLSerializer().serializeToString(root) }
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