// ---------------------------------------------------------------------------
// The start gantry on the loading screen: a photo of the gantry with every
// light on (public/loading/gantry.jpg), and over each of its five units a
// darkened copy of that unit, which is how its lights look off. Lighting a
// unit hides its dark copy and adds a little bloom on top.
//
// Plain markup (no React) so index.html can show it from the very first paint
// (vite.config.ts puts it there) and the loading screen draws exactly the same.
// Each unit appears twice with data-pod="i" (its dark copy and its bloom);
// adding `is-on` to both lights it (see .gantry-unit in index.css).
// ---------------------------------------------------------------------------

export const GANTRY_PODS = 5

export const GANTRY_IMAGE = '/loading/gantry.jpg'
const IMAGE_W = 1942
const IMAGE_H = 600

// Where the units are in the photo (pixels): their centres, and the area
// each one lights, housing plus the glow round it.
const UNIT_CENTRES = [559, 768, 972, 1177, 1382]
const UNIT_HALF_WIDTH = 101
const UNIT_TOP = 98
const UNIT_BOTTOM = 588

const pct = (n: number) => `${Number(n.toFixed(4))}%`

/** A window onto one unit: a box over it with the whole photo inside, lined up. */
function unitWindow(i: number, className: string) {
  const x = UNIT_CENTRES[i] - UNIT_HALF_WIDTH
  const w = UNIT_HALF_WIDTH * 2
  const h = UNIT_BOTTOM - UNIT_TOP
  const box = `left:${pct((x / IMAGE_W) * 100)};top:${pct((UNIT_TOP / IMAGE_H) * 100)};width:${pct((w / IMAGE_W) * 100)};height:${pct((h / IMAGE_H) * 100)}`
  const photo = `width:${pct((IMAGE_W / w) * 100)};left:${pct((-x / w) * 100)};top:${pct((-UNIT_TOP / h) * 100)}`
  return `<div class="${className}" data-pod="${i}" style="${box}"><img src="${GANTRY_IMAGE}" alt="" style="${photo}"></div>`
}

/** The whole gantry as HTML. */
export function gantryMarkup() {
  const units = UNIT_CENTRES.map((_, i) => unitWindow(i, 'gantry-unit')).join('')
  const blooms = UNIT_CENTRES.map((_, i) => unitWindow(i, 'gantry-bloom')).join('')
  return `<div class="gantry-photo" style="aspect-ratio:${IMAGE_W}/${IMAGE_H}"><img class="gantry-base" src="${GANTRY_IMAGE}" alt="" width="${IMAGE_W}" height="${IMAGE_H}" fetchpriority="high">${units}${blooms}</div>`
}
