import { BARRIER_THICKNESS, TILE, WALL_OUTER, beyondWall, nearestOnTrack, offsetLeft, onTrackChange, selectedCircuit, track } from '../track/layout'
import { FLOOR_Y, board } from './boardSize'
import { nearPitLane, pitLane } from '../track/pitLane'
import { circuitById } from '../track/circuits'
import { buildForest, type Pool } from './forestScenery'
import { buildCity } from './cityScenery'

/**
 * What stands around the circuit, all from Kenney's Racing Kit, laid out
 * like the reference track:
 *   - the two-story pit building and its pit lane, behind a wall and fence
 *   - a parking lot filling the block the track leaves free, so the two form
 *     a rectangle, joined to the pits by a service road
 *   - a fence around that whole rectangle
 *   - a tent of spare car parts on the square island
 *   - light posts all round the lap, and billboards outside the barriers
 *   - flags at the start/finish line
 *   - trees outside the fence (the infield is left as open grass)
 * Anything that would land on (or too close to) the track is left out.
 * In the mountain forest the trees are the Nature Kit's instead, with rocks,
 * ridges and campsites (forestScenery.ts); on the street circuit there are
 * buildings and grandstands instead of trees (cityScenery.ts).
 *
 * Each model's front is its local +Z, so `yaw` is the direction it faces.
 */

export type Placement = {
  model: string
  /** Which Kenney kit it's from, when it's not the Racing Kit. */
  kit?: 'nature' | 'city'
  x: number
  z: number
  /** Direction the model's front faces (yaw, three.js convention). */
  yaw: number
  scale: number
  /** Footprint in metres. */
  width: number
  depth: number
  /** Height above the grass, for things standing on a roof. */
  lift?: number
}

/** Model footprint in kit units (width along its local x, depth along local z). */
const SIZES: Record<string, [number, number]> = {
  pitsGarage: [1, 1.09],
  pitsGarageClosed: [1, 1.09],
  pitsGarageCorner: [1, 1.09],
  radarEquipment: [0.59, 0.41],
  barrierWall: [1, 0.12],
  fenceStraight: [1, 0.04],
  tent: [1, 1],
  billboard: [1, 0.48],
  lightPostModern: [0.05, 0.18],
  barrierRed: [0.25, 0.12],
  barrierWhite: [0.25, 0.12],
  treeLarge: [0.36, 0.42],
  treeSmall: [0.26, 0.3],
  flagCheckers: [0.2, 0.04],
}

/**
 * The parking lot, in metres: two rows of bays either side of an aisle. It
 * fills the block the track leaves free, with its walls lined up with the
 * track's outer barriers on the east and south.
 */
export const PARKING_LOT = { x: 43.14, z: 75.15, width: 52.82, depth: 20.8 }
export const LOT_BAYS_PER_ROW = 16
export const LOT_BAY_WIDTH = 3.2
export const LOT_BAY_LENGTH = 5.6
/** How high the asphalt stands above the grass: up to just under the road, so it's all level. */
export const LOT_SURFACE = 0.102

const ROAD_WIDTH = 0.7 * TILE
const LOT_EAST = PARKING_LOT.x + PARKING_LOT.width / 2
const ROAD_X = track.finish.x + 1.5 * TILE
const PIT_SOUTH = track.finish.z + 3.5 * TILE
const PIT_NORTH = track.finish.z - 4.5 * TILE
const ROAD_SOUTH = PARKING_LOT.z + ROAD_WIDTH / 2

/** The pit lane along the front of the garages, carrying on south to the parking lot. */
export const SERVICE_ROAD = { x: ROAD_X, z: (PIT_NORTH + ROAD_SOUTH) / 2, width: ROAD_WIDTH, depth: ROAD_SOUTH - PIT_NORTH }

// The kit's two-story pit building, south to north: garages below, offices
// above, a corner block at the end facing the lot and the red roof at the other.
export const PIT_GROUND_FLOOR = [
  'pitsGarageCorner',
  'pitsGarage',
  'pitsGarage',
  'pitsGarageClosed',
  'pitsGarage',
  'pitsGarage',
  'pitsGarage',
  'pitsGarageClosed',
]
export const PIT_UPPER_FLOOR = [
  'pitsOfficeCorner',
  'pitsOffice',
  'pitsOffice',
  'pitsOffice',
  'pitsOffice',
  'pitsOffice',
  'pitsOffice',
  'pitsOfficeRoof',
]
const PIT_DEPTH = 1.09 * TILE
const PIT_ROOF_HEIGHT = 1.2 * TILE
export const PIT_BUILDING = {
  x: ROAD_X + ROAD_WIDTH / 2 + 0.5 + PIT_DEPTH / 2,
  z: (PIT_NORTH + PIT_SOUTH) / 2,
  yaw: track.finish.yaw + Math.PI / 2, // garages facing the pit lane and the track
  south: PIT_SOUTH,
}

/** Where that road turns west, through the lot's gate and into its aisle. */
export const LOT_DRIVE = {
  x: (LOT_EAST - 0.5 + ROAD_X + ROAD_WIDTH / 2) / 2,
  z: PARKING_LOT.z,
  width: ROAD_X + ROAD_WIDTH / 2 - LOT_EAST + 0.5,
  depth: ROAD_WIDTH,
}

/** A paved bay off the service road, where the ambulance and fire truck wait. */
export const EMERGENCY_BAY = { x: ROAD_X + ROAD_WIDTH / 2 + 3.9, z: 62, width: 8.2, depth: 10 }

/** The tent on the square island (inside the bottom-left corner and the one after it). */
export const PARTS_TENT = { x: -16, z: 60, yaw: 0 }

/** The fence around the track, pits and parking: one big rectangle. */
const FENCE_MARGIN = 7
const perimeter = () => ({
  minX: track.bounds.minX - FENCE_MARGIN,
  maxX: Math.max(EMERGENCY_BAY.x + EMERGENCY_BAY.width / 2, PIT_BUILDING.x + PIT_DEPTH / 2) + 2.6,
  minZ: Math.min(track.bounds.minZ - FENCE_MARGIN, pitLane.bounds.minZ - 2.5),
  maxZ: track.bounds.maxZ + FENCE_MARGIN,
})
export let PERIMETER = perimeter()
const insidePerimeter = (x: number, z: number, margin = 0) =>
  x > PERIMETER.minX - margin && x < PERIMETER.maxX + margin && z > PERIMETER.minZ - margin && z < PERIMETER.maxZ + margin

/** Everything paved around the lot. */
export const PAVED_AREAS = [PARKING_LOT, SERVICE_ROAD, LOT_DRIVE, EMERGENCY_BAY]

/** Is (x, z) on the lot, its road or the emergency bay, or within `margin` metres of them? */
export function inParkingLot(x: number, z: number, margin = 0) {
  return PAVED_AREAS.some((a) => Math.abs(x - a.x) < a.width / 2 + margin && Math.abs(z - a.z) < a.depth / 2 + margin)
}

// The light post model: its pole and lamp, measured from the centre of the
// model along the way it faces.
const POST_POLE = -0.57
const POST_LAMP = 0.48
const POST_LAMP_HEIGHT = 6.08
const POST_POOL = 3.2 // where its pool of light lands
const POST_SPACING = 30 // metres along the lap
const POST_BEHIND_BARRIER = 0.37
const LOT_FENCE_GAP = 0.85 // from the lot's edge to its fence
const PIT_FENCE_BEHIND_WALL = 0.65

export type StreetLight = { lamp: { x: number; y: number; z: number }; pool: { x: number; z: number } }

function place(model: string, x: number, z: number, yaw: number, scale = TILE): Placement {
  const [w, d] = SIZES[model] ?? [1, 1]
  return { model, x, z, yaw, scale, width: w * scale, depth: d * scale }
}

/** Points over the footprint (corners, edge middles, centre) in world space. */
function corners(p: Placement) {
  const c = Math.cos(p.yaw)
  const s = Math.sin(p.yaw)
  const grid = [-1, 0, 1].flatMap((lx) => [-1, 0, 1].map((lz) => [lx, lz]))
  return grid.map(([lx, lz]) => {
    const ox = (lx * p.width) / 2
    const oz = (lz * p.depth) / 2
    return { x: p.x + ox * c + oz * s, z: p.z - ox * s + oz * c }
  })
}

/** Is the whole footprint clear of the barriers (plus a margin)? */
function clear(p: Placement, margin = 0.8) {
  return corners(p).every((q) => beyondWall(q.x, q.z) >= margin)
}

/** Is (x, z) inside the lap (the infield)? Even-odd test against the centreline. */
export function inInfield(x: number, z: number) {
  const pts = track.path
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/** Face from (x, z) towards the closest bit of track. */
const faceTrack = (x: number, z: number) => {
  const n = nearestOnTrack(x, z)
  return Math.atan2(n.x - x, n.z - z)
}

// Seeded random, so the scenery is the same every time.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildScenery(): Placement[] {
  const out: Placement[] = []
  const pitWall: Placement[] = []
  const { finish } = track

  // The pit building's footprint, one bay per tile (PitBuilding.tsx draws it),
  // with a concrete wall and a safety fence between the pit lane and the track.
  const wallX = finish.x + WALL_OUTER - BARRIER_THICKNESS / 2
  PIT_GROUND_FLOOR.forEach((model, bay) => {
    const z = PIT_SOUTH - (bay + 0.5) * TILE
    out.push(place(model, PIT_BUILDING.x, z, PIT_BUILDING.yaw))
    pitWall.push(place('barrierWall', wallX, z, Math.PI / 2))
    pitWall.push(place('fenceStraight', wallX + PIT_FENCE_BEHIND_WALL, z, Math.PI / 2))
  })

  // Flags just outside the barriers at the line, facing the cars coming up to it.
  for (const side of [1, -1]) {
    const p = offsetLeft(finish, side * (WALL_OUTER + 1))
    out.push(place('flagCheckers', p.x, p.z, finish.yaw + Math.PI))
  }

  // A tent in the middle of the square island inside the last corners, with
  // spare car parts under it (carKitScenery.ts puts those down).
  out.push(place('tent', PARTS_TENT.x, PARTS_TENT.z, PARTS_TENT.yaw))

  // Light posts right behind the barriers with their arms over them, every
  // POST_SPACING metres, alternating sides so both edges of the road get light.
  const n = track.path.length
  const barrierAt = (i: number, side: number) => (side === 1 ? track.barrierOffset.left[i] : track.barrierOffset.right[i])
  let preferred = 1
  for (let i = 0; i < n; i += POST_SPACING) {
    const p = track.path[i]
    for (const side of [preferred, -preferred]) {
      const pole = offsetLeft(p, side * (barrierAt(i, side) + BARRIER_THICKNESS / 2 + POST_BEHIND_BARRIER))
      if (beyondWall(pole.x, pole.z) < 0.2) continue
      if (out.some((q) => Math.hypot(q.x - pole.x, q.z - pole.z) < Math.max(q.width, q.depth) / 2 + 0.6)) continue
      const yaw = Math.atan2(p.x - pole.x, p.z - pole.z)
      out.push(place('lightPostModern', pole.x - Math.sin(yaw) * POST_POLE, pole.z - Math.cos(yaw) * POST_POLE, yaw))
      break
    }
    preferred = -preferred
  }

  // Billboards further out, on the outside of the lap.
  for (let i = 40; i < n; i += 80) {
    const p = track.path[i]
    for (const side of [1, -1]) {
      const b = offsetLeft(p, side * (barrierAt(i, side) + 5))
      if (inInfield(b.x, b.z) || !insidePerimeter(b.x, b.z, -3)) continue
      out.push(place('billboard', b.x, b.z, faceTrack(b.x, b.z)))
    }
  }

  // Keep what's clear of the track and the lot, and doesn't overlap something placed before it.
  const solid: Placement[] = []
  for (const p of out) {
    // (The pit lane runs right along the garages, so those stay.)
    const reach = Math.max(p.width, p.depth) / 2 + 0.5
    if (!p.model.startsWith('pits') && (inParkingLot(p.x, p.z, reach) || nearPitLane(p.x, p.z, reach))) continue
    // Posts are already checked: their arms are meant to reach over the barrier.
    const margin = p.model.startsWith('flag') ? 0 : p.model === 'billboard' ? 2.5 : 0.8
    if (p.model !== 'lightPostModern' && !clear(p, margin)) continue
    // (Rough circles; a bit under the full size so garages side by side still fit.)
    const r = Math.max(p.width, p.depth) / 2
    if (solid.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.9 * (r + Math.max(q.width, q.depth) / 2))) continue
    solid.push(p)
  }

  // Fences: round the whole lot and track, and between the lot and the track
  // (its north and west sides), in whole panels stretched to fit each side.
  const fence = (ax: number, az: number, bx: number, bz: number) => {
    const length = Math.hypot(bx - ax, bz - az)
    const panels = Math.max(1, Math.round(length / TILE))
    for (let i = 0; i < panels; i++) {
      const t = (i + 0.5) / panels
      solid.push(place('fenceStraight', ax + (bx - ax) * t, az + (bz - az) * t, ax === bx ? Math.PI / 2 : 0, length / panels))
    }
  }
  const lot = PARKING_LOT
  const west = lot.x - lot.width / 2 - LOT_FENCE_GAP
  const east = lot.x + lot.width / 2 + LOT_FENCE_GAP
  const north = lot.z - lot.depth / 2 - LOT_FENCE_GAP
  fence(west, north, east, north)
  fence(west, north, west, lot.z + lot.depth / 2 + LOT_FENCE_GAP)

  // Lamps over the bays and the road.
  for (const dx of [-16, 0, 16]) solid.push(place('lightPostModern', lot.x + dx, lot.z - lot.depth / 2 + 0.2 - POST_POLE, 0))
  solid.push(place('lightPostModern', ROAD_X + ROAD_WIDTH / 2 + 0.9 + POST_POLE, PIT_SOUTH + 5, -Math.PI / 2))

  // The pit lane's wall and fence, and a radar dish on the offices' flat roof.
  solid.push(...pitWall)
  solid.push({ ...place('radarEquipment', PIT_BUILDING.x + 1, PIT_BUILDING.z, PIT_BUILDING.yaw), lift: PIT_ROOF_HEIGHT })

  // The fence around everything.
  const { minX, maxX, minZ, maxZ } = PERIMETER
  fence(minX, minZ, maxX, minZ)
  fence(minX, maxZ, maxX, maxZ)
  fence(minX, minZ, minX, maxZ)
  fence(maxX, minZ, maxX, maxZ)

  const rand = mulberry32(11)
  const taken = (x: number, z: number, r: number) =>
    solid.some((p) => Math.hypot(p.x - x, p.z - z) < r + Math.max(p.width, p.depth) / 2)

  const venue = circuitById(selectedCircuit()).venue
  pool = null
  if (venue === 'forest') {
    const forest = buildForest({ rand, taken, inParkingLot, inPaddock })
    pool = forest.pool
    return [...solid, ...forest.placements]
  }
  if (venue === 'city') return [...solid, ...buildCity({ rand, taken, inParkingLot, inPaddock })]

  // Trees: scattered over the outside of the circuit and in a thicker belt
  // further out, never in the infield or on top of anything.
  const trees: Placement[] = []
  for (let attempt = 0; attempt < 900 && trees.length < 170; attempt++) {
    const belt = rand() < 0.65
    const a = rand() * Math.PI * 2
    const rx = board.width / 2 + (belt ? 5 + rand() * 45 : -board.width * 0.3 * rand())
    const rz = board.depth / 2 + (belt ? 5 + rand() * 45 : -board.depth * 0.3 * rand())
    const x = board.centerX + Math.cos(a) * rx
    const z = board.centerZ + Math.sin(a) * rz
    if (insidePerimeter(x, z, 3)) continue
    if (taken(x, z, 3) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4)) continue
    trees.push(place(rand() < 0.6 ? 'treeLarge' : 'treeSmall', x, z, rand() * Math.PI * 2, TILE * (0.55 + rand() * 0.35)))
  }

  return [...solid, ...trees]
}

/** The pits and everything east of the main straight, give or take `margin` metres. */
function inPaddock(x: number, z: number, margin: number) {
  return x > track.finish.x + 2 - margin && x < PERIMETER.maxX + margin && z > PERIMETER.minZ - margin && z < PERIMETER.maxZ + margin
}

/** The forest's waterfall pool, when there is one. */
export let pool: Pool | null = null

/** Where each post's lamp is, and where its light lands. */
const lightsOf = (placements: Placement[]): StreetLight[] =>
  placements
    .filter((p) => p.model === 'lightPostModern')
    .map((p) => {
      const fx = Math.sin(p.yaw)
      const fz = Math.cos(p.yaw)
      return {
        lamp: { x: p.x + fx * POST_LAMP, y: FLOOR_Y + POST_LAMP_HEIGHT, z: p.z + fz * POST_LAMP },
        pool: { x: p.x + fx * POST_POOL, z: p.z + fz * POST_POOL },
      }
    })

/** The selected circuit's scenery and its street lights. */
export let scenery = buildScenery()
export let streetLights = lightsOf(scenery)
onTrackChange(() => {
  PERIMETER = perimeter()
  scenery = buildScenery()
  streetLights = lightsOf(scenery)
})
