import { TILE, beyondWall, offsetLeft, track } from '../track/layout'
import { nearPitLane } from '../track/pitLane'
import { board } from './boardSize'
import type { Placement } from './scenery'

// ---------------------------------------------------------------------------
// The mountain forest's dressing, all from Kenney's Nature Kit (repainted in
// the venue's colours, see palette.ts). Seeded, so it's the same every time.
// From the outside in:
//   - granite ridges to the north and west, with a waterfall and its pool
//   - pines everywhere the circuit leaves room, thinner near the track and
//     thick further out, with a few broadleaf trees among them
//   - boulders and rock pillars between the trees
//   - fans' campsites in clearings beside the track: tents round a campfire
//   - bushes along the outside of the barriers
// The paddock (pits, lot, service road) stays as it is.
// ---------------------------------------------------------------------------

/** Footprints in kit units (width along local x, depth along local z), for spacing things out. */
const SIZES: Record<string, [number, number]> = {
  tree_pineTallA: [0.4, 0.4],
  tree_pineTallB: [0.4, 0.4],
  tree_pineTallC: [0.4, 0.4],
  tree_pineTallD: [0.4, 0.4],
  tree_pineRoundA: [0.5, 0.55],
  tree_pineRoundC: [0.5, 0.55],
  tree_pineRoundE: [0.5, 0.55],
  tree_pineDefaultA: [0.53, 0.53],
  tree_pineDefaultB: [0.53, 0.53],
  tree_pineSmallA: [0.5, 0.5],
  tree_pineSmallC: [0.5, 0.5],
  tree_default: [0.76, 0.65],
  tree_oak: [0.64, 0.74],
  stone_largeA: [0.78, 1.02],
  stone_largeB: [0.77, 1.02],
  stone_largeC: [0.78, 1.02],
  stone_largeD: [0.78, 1.02],
  stone_tallA: [0.98, 0.68],
  stone_tallC: [0.6, 0.6],
  stone_tallF: [0.44, 0.51],
  stone_smallA: [0.36, 0.36],
  stone_smallC: [0.36, 0.36],
  cliff_block_stone: [1, 1],
  cliff_blockSlope_stone: [1.2, 1],
  cliff_waterfall_stone: [1, 0.17],
  cliff_waterfallTop_stone: [1, 0.27],
  tent_detailedOpen: [0.87, 0.67],
  tent_detailedClosed: [0.87, 0.67],
  tent_smallClosed: [0.55, 0.64],
  campfire_stones: [0.54, 0.52],
  log_large: [1, 0.55],
  log_stack: [0.42, 0.71],
  stump_round: [0.32, 0.37],
  plant_bush: [0.4, 0.4],
  plant_bushLarge: [0.37, 0.34],
  plant_bushDetailed: [0.6, 0.6],
  lily_large: [0.27, 0.31],
}

/** Every Nature Kit model the forest uses (Props loads them). */
export const FOREST_MODELS = Object.keys(SIZES)

function place(model: string, x: number, z: number, yaw: number, scale = TILE, lift?: number): Placement {
  const [w, d] = SIZES[model] ?? [1, 1]
  return { model, kit: 'nature', x, z, yaw, scale, width: w * scale, depth: d * scale, lift }
}

/** The pool at the foot of the waterfall: drawn as water by Props. */
export type Pool = { x: number; z: number; radius: number }

/** One block of the ridges, in metres. */
const BLOCK = 1.25 * TILE
/** How far out the ridges stand, past the edge of the site. */
const RIDGE_OUT = 22
/** The least room between two trees' trunks, in metres. */
const TREE_GAP = 4.2

type Helpers = {
  rand: () => number
  /** Is (x, z) within `r` of something already placed? */
  taken: (x: number, z: number, r: number) => boolean
  /** On the lot, its road or the emergency bay, give or take `margin`. */
  inParkingLot: (x: number, z: number, margin: number) => boolean
  /** The paddock: the pits and everything east of the main straight. */
  inPaddock: (x: number, z: number, margin: number) => boolean
}

export function buildForest({ rand, taken, inParkingLot, inPaddock }: Helpers): { placements: Placement[]; pool: Pool } {
  const out: Placement[] = []
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]
  const between = (a: number, b: number) => a + rand() * (b - a)
  const near = (x: number, z: number, r: number) =>
    taken(x, z, r) || out.some((p) => Math.hypot(p.x - x, p.z - z) < r + Math.max(p.width, p.depth) / 2)

  // --- Ridges: granite crags along the north and down the west. Blocks of
  // uneven size, pushed in and out and stepping back as they climb, a second
  // row behind, and rock pillars in front, so it reads as rock, not a wall.
  const north = board.minZ - RIDGE_OUT
  const west = board.minX - RIDGE_OUT
  /** Each spot along the ridges, and which way the track is from it. */
  const ridge: { x: number; z: number; into: { x: number; z: number } }[] = []
  const step = BLOCK * 0.85
  for (let x = board.maxX + RIDGE_OUT; x > west; x -= step) ridge.push({ x, z: north, into: { x: 0, z: 1 } })
  for (let z = north + step; z < board.maxZ + RIDGE_OUT; z += step) ridge.push({ x: west, z, into: { x: 1, z: 0 } })
  // The waterfall: in the north ridge, behind the middle of the back straight.
  const fallX = (board.minX + board.maxX) / 2 - BLOCK * 2
  const fall = ridge.reduce((best, r, i) => (r.into.z === 1 && Math.abs(r.x - fallX) < Math.abs(ridge[best].x - fallX) ? i : best), 0)
  /** A column of blocks at (x, z), `levels` high; returns how tall it came out. */
  const crag = (x: number, z: number, into: { x: number; z: number }, levels: number, even: boolean) => {
    let lift = 0
    for (let level = 0; level < levels; level++) {
      const size = even ? BLOCK : BLOCK * between(1, 1.35) * (1 - level * 0.12)
      // Upper blocks sit further back, like a slope; the rest wander a little.
      const back = even ? 0 : -level * 0.22 * BLOCK + between(-0.3, 0.3) * BLOCK
      const along = even ? 0 : between(-0.12, 0.12) * BLOCK
      out.push(place('cliff_block_stone', x + into.x * back + into.z * along, z + into.z * back + into.x * along, 0, size, lift))
      lift += size
    }
    return lift
  }
  ridge.forEach((r, i) => {
    const atFall = Math.abs(i - fall) <= 1
    // Higher towards the waterfall, ragged everywhere.
    const peak = Math.max(0, 3 - Math.abs(i - fall) * 0.2)
    const levels = atFall ? 3 : Math.max(1, Math.min(3, Math.round(peak * 0.6 + between(0.4, 2.2))))
    const top = crag(r.x, r.z, r.into, levels, atFall)
    // The row behind, a level higher, so the skyline has depth.
    const behind = crag(r.x - r.into.x * BLOCK * 0.9, r.z - r.into.z * BLOCK * 0.9, r.into, Math.min(4, levels + (rand() < 0.6 ? 1 : 0)), false)
    // A pine on top now and then.
    if (rand() < 0.6) {
      const onBack = behind > top
      const tx = r.x - (onBack ? r.into.x * BLOCK * 0.9 : 0) + between(-2, 2)
      const tz = r.z - (onBack ? r.into.z * BLOCK * 0.9 : 0) + between(-2, 2)
      out.push(place(pick(['tree_pineTallA', 'tree_pineTallC', 'tree_pineRoundA']), tx, tz, rand() * 6.3, TILE * between(0.8, 1.1), Math.max(top, behind)))
    }
    // Pillars and boulders at the foot, breaking up the line.
    if (!atFall && rand() < 0.45) {
      const d = BLOCK * between(0.7, 1.1)
      out.push(place(pick(['stone_tallA', 'stone_tallC', 'stone_largeB']), r.x + r.into.x * d + between(-3, 3), r.z + r.into.z * d + between(-3, 3), rand() * 6.3, TILE * between(1.4, 2.4)))
    }
  })
  // The water comes down the ridge's face, into a pool with lilies.
  const f = ridge[fall]
  const faceZ = f.z + BLOCK / 2 + (0.17 * BLOCK) / 2 // just in front of the blocks
  // (The kit's waterfall faces -z; yaw π turns it to face south, to the track.)
  out.push(place('cliff_waterfall_stone', f.x, faceZ, Math.PI, BLOCK, 0))
  out.push(place('cliff_waterfall_stone', f.x, faceZ, Math.PI, BLOCK, BLOCK))
  out.push(place('cliff_waterfallTop_stone', f.x, f.z + BLOCK / 2 + (0.27 * BLOCK) / 2, Math.PI, BLOCK, 2 * BLOCK))
  const pool: Pool = { x: f.x, z: f.z + BLOCK / 2 + 8, radius: 9 }
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2
    const r = pool.radius * between(0.3, 0.8)
    out.push(place('lily_large', pool.x + Math.cos(a) * r, pool.z + Math.sin(a) * r, rand() * 6.3, TILE * between(0.8, 1.2), 0.05))
  }
  // Boulders round its edge.
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * between(-0.1, 1.1)
    const r = pool.radius + between(1, 3)
    out.push(place(pick(['stone_largeA', 'stone_largeC', 'stone_smallA', 'stone_smallC']), pool.x + Math.cos(a) * r, pool.z + Math.sin(a) * r, rand() * 6.3, TILE * between(0.5, 0.9)))
  }

  // --- Campsites: in clearings just outside the barriers, every so often round
  // the lap, on whichever side has room.
  const camps: { x: number; z: number }[] = []
  for (let s = 40; s < track.length - 40 && camps.length < 7; s += 95) {
    const p = track.path.find((q) => q.s >= s)!
    // The first spot that's clear: either side, a little further out each time.
    const spots = [22, 30, 38].flatMap((d) => [offsetLeft(p, d), offsetLeft(p, -d)])
    const c = spots.find(
      (q) =>
        beyondWall(q.x, q.z) >= 11 &&
        !inPaddock(q.x, q.z, 12) &&
        !inParkingLot(q.x, q.z, 10) &&
        !near(q.x, q.z, 6) &&
        !camps.some((k) => Math.hypot(k.x - q.x, k.z - q.z) < 45),
    )
    if (c) {
      camps.push(c)
      out.push(place('campfire_stones', c.x, c.z, rand() * 6.3, TILE * 0.6))
      const tents = 2 + Math.floor(rand() * 2)
      const turn = rand() * Math.PI * 2
      for (let t = 0; t < tents; t++) {
        const a = turn + (t / tents) * Math.PI * 1.6
        const x = c.x + Math.cos(a) * 5.5
        const z = c.z + Math.sin(a) * 5.5
        // Facing the fire.
        out.push(place(pick(['tent_detailedOpen', 'tent_detailedClosed', 'tent_smallClosed']), x, z, Math.atan2(c.x - x, c.z - z), TILE * 0.55))
      }
      // A log to sit on, on the side without tents, and some firewood.
      const a = turn + Math.PI * 1.8
      out.push(place('log_large', c.x + Math.cos(a) * 2.6, c.z + Math.sin(a) * 2.6, -a, TILE * 0.38))
      out.push(place('log_stack', c.x + Math.cos(a + 0.9) * 4, c.z + Math.sin(a + 0.9) * 4, rand() * 6.3, TILE * 0.5))
      out.push(place('stump_round', c.x + Math.cos(a - 0.8) * 3.2, c.z + Math.sin(a - 0.8) * 3.2, 0, TILE * 0.6))
    }
  }
  const inClearing = (x: number, z: number, r = 10) =>
    camps.some((c) => Math.hypot(c.x - x, c.z - z) < r) || Math.hypot(pool.x - x, pool.z - z) < pool.radius + 3

  // Anywhere the forest can grow: off the track and its run-off, out of the
  // paddock and the lot, short of the ridges, and not in a clearing.
  const extent = { minX: west + BLOCK, maxX: board.maxX + RIDGE_OUT - BLOCK, minZ: north + BLOCK, maxZ: board.maxZ + RIDGE_OUT - BLOCK }
  const open = (x: number, z: number, wall: number, r: number) =>
    beyondWall(x, z) >= wall && !inPaddock(x, z, r + 2) && !inParkingLot(x, z, r + 2) && !nearPitLane(x, z, r + 2) && !inClearing(x, z) && !near(x, z, r)
  const somewhere = () => ({ x: between(extent.minX, extent.maxX), z: between(extent.minZ, extent.maxZ) })

  // --- Rocks: boulders and the odd pillar between the trees, pebbles by the barriers.
  for (let n = 0, tries = 0; n < 80 && tries < 3000; tries++) {
    const { x, z } = somewhere()
    if (!open(x, z, 3, 3)) continue
    out.push(place(pick(['stone_largeA', 'stone_largeB', 'stone_largeC', 'stone_largeD']), x, z, rand() * 6.3, TILE * between(0.6, 1.3)))
    n++
  }
  for (let n = 0, tries = 0; n < 18 && tries < 2000; tries++) {
    const { x, z } = somewhere()
    if (!open(x, z, 10, 4)) continue
    out.push(place(pick(['stone_tallA', 'stone_tallC', 'stone_tallF']), x, z, rand() * 6.3, TILE * between(0.7, 1.2)))
    n++
  }

  // --- Bushes and pebbles along the outside of the barriers, softening the edge.
  for (let n = 0, tries = 0; n < 260 && tries < 6000; tries++) {
    const i = Math.floor(rand() * track.path.length)
    const side = rand() < 0.5 ? 1 : -1
    const barrier = (side === 1 ? track.barrierOffset.left : track.barrierOffset.right)[i]
    const q = offsetLeft(track.path[i], side * (barrier + between(1.8, 7)))
    if (!open(q.x, q.z, 1.2, 1)) continue
    const pebble = rand() < 0.25
    out.push(
      place(pebble ? pick(['stone_smallA', 'stone_smallC']) : pick(['plant_bush', 'plant_bushLarge', 'plant_bushDetailed']), q.x, q.z, rand() * 6.3, TILE * between(0.8, 1.4)),
    )
    n++
  }

  // --- The pines: thinner right behind the barriers, so you can see into the
  // woods, and thick further out. A broadleaf tree here and there.
  const TALL = ['tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD']
  const ROUND = ['tree_pineRoundA', 'tree_pineRoundC', 'tree_pineRoundE', 'tree_pineDefaultA', 'tree_pineDefaultB']
  const trees: Placement[] = []
  // Trees by 8 m cell, to keep them apart quickly.
  const cells = new Map<string, Placement[]>()
  const cellOf = (x: number, z: number) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`
  const crowded = (x: number, z: number) => {
    const cx = Math.floor(x / 8)
    const cz = Math.floor(z / 8)
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        if (cells.get(`${cx + dx},${cz + dz}`)?.some((t) => Math.hypot(t.x - x, t.z - z) < TREE_GAP)) return true
    return false
  }
  for (let tries = 0; tries < 16000 && trees.length < 1300; tries++) {
    const { x, z } = somewhere()
    if (crowded(x, z)) continue
    const wall = beyondWall(x, z)
    // How likely a tree is here: a third of the time right behind the barriers, always 25 m out.
    if (wall < 4 || rand() > 0.3 + 0.7 * Math.min(1, (wall - 4) / 21)) continue
    if (!open(x, z, 4, 1.5)) continue
    const roll = rand()
    const model =
      roll < 0.46 ? pick(TALL) : roll < 0.8 ? pick(ROUND) : roll < 0.92 ? pick(['tree_pineSmallA', 'tree_pineSmallC']) : pick(['tree_default', 'tree_oak'])
    // (The broadleaf trees are bulkier: smaller, so they don't crowd the pines.)
    const broad = model === 'tree_default' || model === 'tree_oak'
    const tree = place(model, x, z, rand() * 6.3, TILE * (broad ? between(0.6, 0.85) : between(0.85, 1.3)))
    trees.push(tree)
    const key = cellOf(x, z)
    cells.set(key, [...(cells.get(key) ?? []), tree])
  }

  return { placements: [...out, ...trees], pool }
}
