import { TILE, beyondWall, nearestOnTrack, offsetLeft, track } from '../track/layout'
import { nearPitLane } from '../track/pitLane'
import { board } from './boardSize'
import type { Placement } from './scenery'

// ---------------------------------------------------------------------------
// The street circuit's city, from Kenney's City Kit (Commercial), seeded so
// it's the same every time:
//   - shops and offices right behind the walls, with café parasols out front
//   - towers downtown, in the block inside the main straight
//   - a low-detail skyline further out, fading into the night
//   - grandstands from the Racing Kit along the straights
// Buildings stand square to the streets (the track only turns at right
// angles), face the nearest bit of track, and leave side streets between
// the blocks. The paddock (pits, lot, service road) stays as it is.
// ---------------------------------------------------------------------------

/** Width, depth and height in kit units. */
const SIZES: Record<string, [number, number, number]> = {
  'building-a': [0.88, 0.94, 1.29],
  'building-b': [0.97, 0.94, 1.29],
  'building-c': [0.88, 1.09, 0.89],
  'building-d': [0.84, 0.9, 1.29],
  'building-e': [1.64, 1.01, 0.89],
  'building-f': [0.84, 1.03, 1.69],
  'building-g': [0.97, 0.92, 1.69],
  'building-h': [0.88, 1.01, 1.29],
  'building-i': [1.24, 1.3, 1.68],
  'building-k': [2.08, 0.94, 1.47],
  'building-l': [1.37, 1.4, 2.27],
  'building-m': [1.24, 1.24, 3.15],
  'building-skyscraper-a': [1.36, 1.36, 2.88],
  'building-skyscraper-b': [1.36, 1.36, 4.48],
  'building-skyscraper-c': [1.28, 1.39, 4.08],
  'building-skyscraper-d': [1.28, 1.39, 5.47],
  'building-skyscraper-e': [1.29, 1.24, 4.08],
  'detail-parasol-a': [0.35, 0.4, 0.45],
  'detail-parasol-b': [0.35, 0.4, 0.45],
  'low-detail-building-a': [0.5, 0.5, 2],
  'low-detail-building-b': [0.5, 0.5, 2.23],
  'low-detail-building-c': [0.5, 0.5, 2.25],
  'low-detail-building-d': [0.5, 0.5, 1.75],
  'low-detail-building-e': [0.5, 0.5, 1.8],
  'low-detail-building-f': [0.5, 0.5, 2],
  'low-detail-building-g': [0.5, 0.5, 2],
  'low-detail-building-h': [0.5, 0.5, 2.1],
  'low-detail-building-i': [0.5, 0.5, 1.77],
  'low-detail-building-j': [0.5, 0.5, 1.75],
  'low-detail-building-k': [0.5, 0.5, 1.55],
  'low-detail-building-l': [0.5, 0.5, 1.85],
  'low-detail-building-m': [0.5, 0.5, 1.98],
  'low-detail-building-n': [0.5, 0.5, 0.7],
  'low-detail-building-wide-a': [1, 0.5, 1.1],
  'low-detail-building-wide-b': [1, 0.5, 1.15],
}

/** Every City Kit model the city uses (Props loads them). */
export const CITY_MODELS = Object.keys(SIZES)

const SHOPS = ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h', 'building-i', 'building-k']
const OFFICES = ['building-l', 'building-m']
const TOWERS = ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e']
const SKYLINE = CITY_MODELS.filter((m) => m.startsWith('low-detail'))

/** Metres per kit unit: shops and offices, towers, and the far skyline (built small, so drawn big). */
const SHOP_SCALE = 9
const TOWER_SCALE = 10.5
const SKYLINE_SCALE = 22

/** Room left between the walls and a building's front: the pavement. */
const PAVEMENT = 3.5
/** Side streets: a gap this wide every STREET_EVERY metres, both ways. */
const STREET_EVERY = 56
const STREET_WIDTH = 9
/** How far the city goes past the site; the night haze covers the rest. */
const CITY_OUT = 70

type Rect = { x0: number; x1: number; z0: number; z1: number }

type Helpers = {
  rand: () => number
  taken: (x: number, z: number, r: number) => boolean
  inParkingLot: (x: number, z: number, margin: number) => boolean
  inPaddock: (x: number, z: number, margin: number) => boolean
}

export function buildCity({ rand, taken, inParkingLot, inPaddock }: Helpers): Placement[] {
  const out: Placement[] = []
  const rects: Rect[] = []
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]
  const between = (a: number, b: number) => a + rand() * (b - a)

  /** The block inside the main straight: downtown. */
  const finish = track.finish
  const downtown = { x: finish.x - 3.2 * TILE, z: finish.z - 1.5 * TILE }

  const overlaps = (r: Rect, gap: number) =>
    rects.some((o) => r.x0 < o.x1 + gap && r.x1 > o.x0 - gap && r.z0 < o.z1 + gap && r.z1 > o.z0 - gap)
  const onStreet = (r: Rect) => {
    const crosses = (a: number, b: number) => {
      const k = Math.floor((a + STREET_WIDTH / 2) / STREET_EVERY)
      return Math.floor((b + STREET_WIDTH / 2) / STREET_EVERY) !== k || Math.floor((a - STREET_WIDTH / 2) / STREET_EVERY) !== k
    }
    return crosses(r.x0, r.x1) || crosses(r.z0, r.z1)
  }
  /** Is a w × d footprint at (x, z) free: off the track and pavement, out of the paddock, clear of the rest? */
  const free = (x: number, z: number, w: number, d: number, gap: number, street = true, pavement = PAVEMENT) => {
    const r = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }
    if (overlaps(r, gap) || (street && onStreet(r))) return null
    const reach = Math.max(w, d) / 2
    if (inPaddock(x, z, reach + 2) || inParkingLot(x, z, reach + 2) || nearPitLane(x, z, reach + 3) || taken(x, z, reach)) return null
    for (const [fx, fz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, -0.5], [0, 0.5], [-0.5, 0], [0.5, 0], [0, 0]])
      if (beyondWall(x + fx * w, z + fz * d) < pavement) return null
    return r
  }
  /** Facing the closest bit of track, square to the streets. */
  const facing = (x: number, z: number) => {
    const n = nearestOnTrack(x, z)
    return Math.round(Math.atan2(n.x - x, n.z - z) / (Math.PI / 2)) * (Math.PI / 2)
  }
  const add = (model: string, x: number, z: number, yaw: number, scale: number, r: Rect) => {
    const [w, d] = SIZES[model]
    out.push({ model, kit: 'city', x, z, yaw, scale, width: w * scale, depth: d * scale })
    rects.push(r)
  }

  // --- Grandstands along the straights (not the main one: that has the pits),
  // on the side away from the infield where there's room.
  let stands = 0
  for (const piece of track.pieces) {
    if (piece.id !== 'S' || piece.index < 13 || piece.index > track.pieces.length - 8 || stands >= 16) continue
    // Only in the middle of straights at least four long.
    const run = (k: number) => track.pieces[(piece.index + k + track.pieces.length) % track.pieces.length].id === 'S'
    if (!(run(-1) && run(1) && (run(-2) || run(2)))) continue
    const mid = track.path.find((p) => p.piece === piece.index && p.s > 0)!
    for (const side of [1, -1]) {
      const barrier = (side === 1 ? track.barrierOffset.left : track.barrierOffset.right)[track.path.indexOf(mid)]
      // Right behind the wall.
      const at = offsetLeft(mid, side * (barrier + TILE / 2 + 0.9))
      const yaw = facing(at.x, at.z)
      const r = free(at.x, at.z, TILE, TILE, 0.2, false, 0.4)
      if (!r) continue
      out.push({ model: 'grandStandCovered', x: at.x, z: at.z, yaw, scale: TILE, width: TILE, depth: TILE })
      rects.push(r)
      stands++
      break
    }
  }

  // --- Buildings. Nearest the track first, so the front row fills in.
  const extent = { minX: board.minX - CITY_OUT, maxX: board.maxX + CITY_OUT, minZ: board.minZ - CITY_OUT, maxZ: board.maxZ + CITY_OUT }
  const candidates: { x: number; z: number; wall: number }[] = []
  for (let tries = 0; tries < 9000; tries++) {
    // On a 2 m grid, so the blocks line up.
    const x = Math.round(between(extent.minX, extent.maxX) / 2) * 2
    const z = Math.round(between(extent.minZ, extent.maxZ) / 2) * 2
    const wall = beyondWall(x, z)
    if (wall >= PAVEMENT) candidates.push({ x, z, wall })
  }
  candidates.sort((a, b) => a.wall - b.wall)
  for (const { x, z, wall } of candidates) {
    const inDowntown = Math.hypot(x - downtown.x, z - downtown.z) < 34
    const [kind, scale] =
      inDowntown ? (rand() < 0.75 ? [TOWERS, TOWER_SCALE] : [OFFICES, SHOP_SCALE])
      : wall < 40 ? (rand() < 0.85 ? [SHOPS, SHOP_SCALE] : [OFFICES, SHOP_SCALE])
      : wall < 75 ? (rand() < 0.5 ? [OFFICES, SHOP_SCALE] : [SKYLINE, SKYLINE_SCALE])
      : [SKYLINE, SKYLINE_SCALE]
    const model = pick(kind)
    const yaw = facing(x, z)
    const [w, d] = SIZES[model]
    // Turned a quarter, its width runs the other way.
    const across = Math.abs(Math.sin(yaw)) > 0.5
    const r = free(x, z, (across ? d : w) * scale, (across ? w : d) * scale, between(0.6, 2.5))
    if (!r) continue
    add(model, x, z, yaw, scale, r)
    // A café's parasols out front, now and then, on the pavement by the track.
    if (kind === SHOPS && wall < 14 && rand() < 0.35) {
      const front = { x: Math.sin(yaw), z: Math.cos(yaw) }
      const reach = ((across ? w : d) * scale) / 2 + 1.6
      for (const along of [-2.2, 2.2]) {
        const px = x + front.x * reach + front.z * along
        const pz = z + front.z * reach - front.x * along
        if (beyondWall(px, pz) < 1.2) continue
        out.push({ model: pick(['detail-parasol-a', 'detail-parasol-b']), kit: 'city', x: px, z: pz, yaw, scale: 7, width: 2.5, depth: 2.8 })
      }
    }
  }
  return out
}
