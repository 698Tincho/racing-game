import { PIECES, type PieceId } from './pieces'

// ---------------------------------------------------------------------------
// Circuit dimensions, all in meters. Change these to reshape every track.
// ---------------------------------------------------------------------------

/** 1 layout unit = TRACK_SCALE meters. A straight is 4 units, corners radius 2 / 4. */
export const TRACK_SCALE = 3.5
// A kart track: a narrow road lined by red/white block walls, like an indoor
// karting hall. From the centre out:
//   asphalt (kerbs painted on its edge in corners) | a strip of floor | block wall
/** Half the asphalt width (7 m road, about 4 karts across). */
export const ROAD_HALF_WIDTH = 3.5
/** White line painted along the road edge on the straights. */
export const EDGE_LINE_WIDTH = 0.2
/** Red/white kerbs painted on the road edge, both sides of every corner. */
export const KERB_WIDTH = 0.9
/** Bare floor between the road edge and the block wall. */
export const WALL_GAP = 0.4
/** Block walls: thickness, height of the blocks you see, height of the invisible collider. */
export const BARRIER_THICKNESS = 0.7
export const BARRIER_VISUAL_HEIGHT = 0.6
export const BARRIER_HEIGHT = 1.4
/** Length of each red or white wall block. */
export const BLOCK_LENGTH = 1.4
/** Outer face of the walls: nothing you can drive on is further out than this. */
export const WALL_OUTER = ROAD_HALF_WIDTH + WALL_GAP + BARRIER_THICKNESS

/** Starting grid: two staggered columns behind the start line, like F1. */
export const GRID_SLOTS = 8
export const GRID_COLUMN_OFFSET = 1.5 // each column's distance from the centerline
export const GRID_FIRST_GAP = 3 // pole position's distance behind the start line
export const GRID_SPACING = 2.8 // distance between consecutive positions (P1 → P2 → P3...)

/** The start/finish line, in meters along the main straight. */
const FINISH_AT = 8 * TRACK_SCALE

/**
 * Track 1, the hall. Read it like turtle directions, starting on the main straight:
 *   S = straight, H = half straight,
 *   RS/LS = small right/left corner, RL/LL = large right/left corner.
 * The loop must end exactly where it starts (the builder warns if it doesn't).
 */
export const TRACK_1: PieceId[] = [
  'S', 'S', 'S', // main straight (start/finish)
  'RL', 'RS', // turn 1 and 2
  'LS', 'LS', 'RS', // the S-bends
  'S', 'RL', 'S', // long right-hander
  'RS', 'RS', // hairpin
  'H', 'LS', 'LS', // left-left
  'S', 'RS', 'S', // into the back section
  'LS', 'S', // kink
  'RS', 'RS', 'H', // final hairpin onto the main straight
]

export type Pose = { x: number; z: number; yaw: number }

export type PlacedPiece = {
  id: PieceId
  index: number
  pose: Pose // where the piece's entry sits in the world (meters)
}

export type CenterSample = { x: number; z: number; yaw: number; piece: number }

/** A point on the centerline roughly every meter, with distance along the lap. */
export type PathSample = CenterSample & { s: number }

export type Barrier = {
  /** Wall block centres, BLOCK_LENGTH apart, in driving order. */
  blocks: { x: number; z: number; yaw: number }[]
  /** Collider boxes along the wall. */
  segments: { x: number; z: number; yaw: number; length: number }[]
}

export type BuiltTrack = {
  pieces: PlacedPiece[]
  /** Coarse centerline (a few points per piece), for fast nearest-point lookups. */
  centerline: CenterSample[]
  /** Dense centerline, for building the road mesh. */
  path: PathSample[]
  length: number
  /** How far the tyre wall sits from the centerline, per path sample and side. */
  barrierOffset: { left: number[]; right: number[] }
  barriers: Barrier[]
  /** Where the player starts: pole position (grid[0]). */
  start: Pose
  /** Grid slots P1..P8, staggered left/right behind the start line. */
  grid: (Pose & { position: number })[]
  /** Start/finish line (under the gate). */
  finish: Pose
  /** Lines you must cross in order before the finish counts: one per piece entry. */
  checkpoints: Pose[]
  /** Checkpoint indices that end sector 1 and sector 2 (sector 3 ends at the line). */
  sectorEnds: [number, number] | number[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

export type Surface = 'road' | 'kerb' | 'grass' | 'gravel'

// Rotate a local (x, z) by yaw. Same convention as three.js rotation.y:
// yaw 0 faces +Z, positive yaw turns towards +X.
const rotate = (x: number, z: number, yaw: number) => {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: x * c + z * s, z: -x * s + z * c }
}

/** Offset a point sideways: positive = to the left of the driving direction. */
export const offsetLeft = (p: { x: number; z: number; yaw: number }, d: number) => ({
  x: p.x + Math.cos(p.yaw) * d,
  z: p.z - Math.sin(p.yaw) * d,
})

function sampleLocal(id: PieceId, t: number) {
  const def = PIECES[id]
  const at = def.center(t)
  const ahead = def.center(Math.min(1, t + 1e-3))
  const behind = def.center(Math.max(0, t - 1e-3))
  return { x: at.x, z: at.z, yaw: Math.atan2(ahead.x - behind.x, ahead.z - behind.z) }
}

/**
 * World position/heading at `t` (0..1) along a placed piece's centerline, and
 * which side the inside of the turn is on (+1 = left, -1 = right, 0 = straight).
 */
export function pointOnPiece(placed: PlacedPiece, t: number, scale = TRACK_SCALE) {
  const local = sampleLocal(placed.id, t)
  const w = rotate(local.x * scale, local.z * scale, placed.pose.yaw)
  return {
    x: placed.pose.x + w.x,
    z: placed.pose.z + w.z,
    yaw: placed.pose.yaw + local.yaw,
    inside: Math.sign(PIECES[placed.id].exit.turn),
  }
}

/** Does this side of this piece get a kerb? Both sides of every corner. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const hasKerb = (id: PieceId, _side: number) => PIECES[id].corner !== 'none'

/** Walk a closed polyline and drop points every `spacing` meters along it. */
function resampleLoop(points: { x: number; z: number }[], spacing: number) {
  const out: { x: number; z: number; yaw: number }[] = []
  let carry = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < 1e-6) continue
    const yaw = Math.atan2(b.x - a.x, b.z - a.z)
    let d = carry
    while (d < len) {
      const u = d / len
      out.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, yaw })
      d += spacing
    }
    carry = d - len
  }
  return out
}

export function buildTrack(sequence: PieceId[], scale = TRACK_SCALE): BuiltTrack {
  const pieces: PlacedPiece[] = []
  const centerline: CenterSample[] = []
  const path: PathSample[] = []
  let pose: Pose = { x: 0, z: 0, yaw: 0 }
  let s = 0

  sequence.forEach((id, index) => {
    const def = PIECES[id]
    const placed = { id, index, pose: { ...pose } }
    pieces.push(placed)

    for (let i = 0; i < def.samples; i++) centerline.push({ ...pointOnPiece(placed, i / def.samples, scale), piece: index })

    const meters = def.length * scale
    const n = Math.ceil(meters) // ~1 m apart
    for (let i = 0; i < n; i++) {
      const p = pointOnPiece(placed, i / n, scale)
      path.push({ x: p.x, z: p.z, yaw: p.yaw, piece: index, s: s + (meters * i) / n })
    }
    s += meters

    const exit = rotate(def.exit.x * scale, def.exit.z * scale, pose.yaw)
    pose = { x: pose.x + exit.x, z: pose.z + exit.z, yaw: pose.yaw + def.exit.turn }
  })

  const closes = Math.hypot(pose.x, pose.z) < 0.01 && Math.abs(Math.cos(pose.yaw) - 1) < 1e-6
  if (!closes) console.warn('[track] layout does not close the loop, it ends at', pose)

  const partial = { pieces, centerline } as BuiltTrack

  // Block walls. Each side wants to sit a fixed distance out, but it must not
  // end up closer to another part of the circuit than to its own road (inside
  // of tight corners, or where two sections run close together), so it's
  // pulled in until it's clear, then smoothed.
  const barrierOffset = { left: [] as number[], right: [] as number[] }
  const barriers: Barrier[] = []
  for (const [side, key] of [[1, 'left'], [-1, 'right']] as const) {
    const raw = path.map((p) => {
      let off = ROAD_HALF_WIDTH + WALL_GAP + BARRIER_THICKNESS / 2
      const min = ROAD_HALF_WIDTH + BARRIER_THICKNESS / 2 + 0.1
      while (off > min) {
        const q = offsetLeft(p, off * side)
        if (nearestOnTrack(q.x, q.z, partial).dist >= off - 0.1) break
        off -= 0.1
      }
      return off
    })
    // Smooth: take the tightest value nearby, then average, so the wall flows.
    const N = raw.length
    const at = (arr: number[], i: number) => arr[((i % N) + N) % N]
    const tight = raw.map((_, i) => Math.min(...Array.from({ length: 9 }, (_, k) => at(raw, i + k - 4))))
    const smooth = tight.map((_, i) => Array.from({ length: 9 }, (_, k) => at(tight, i + k - 4)).reduce((a, b) => a + b) / 9)
    barrierOffset[key] = smooth

    const line = path.map((p, i) => offsetLeft(p, smooth[i] * side))
    const blocks = resampleLoop(line, BLOCK_LENGTH)
    const anchors = resampleLoop(line, 3)
    const segments = anchors.map((a, i) => {
      const b = anchors[(i + 1) % anchors.length]
      return {
        x: (a.x + b.x) / 2,
        z: (a.z + b.z) / 2,
        yaw: Math.atan2(b.x - a.x, b.z - a.z),
        length: Math.hypot(b.x - a.x, b.z - a.z) + BARRIER_THICKNESS * 0.5,
      }
    })
    barriers.push({ blocks, segments })
  }

  const all = barriers.flatMap((b) => b.blocks)
  const pad = 1

  // P1 on the left, P2 on the right half a row back, and so on.
  const finish: Pose = { x: 0, z: FINISH_AT, yaw: 0 }
  const grid = Array.from({ length: GRID_SLOTS }, (_, i) => {
    const back = GRID_FIRST_GAP + i * GRID_SPACING
    const behind = { x: finish.x - Math.sin(finish.yaw) * back, z: finish.z - Math.cos(finish.yaw) * back, yaw: finish.yaw }
    return { ...behind, ...offsetLeft(behind, (i % 2 === 0 ? 1 : -1) * GRID_COLUMN_OFFSET), position: i + 1 }
  })

  // Checkpoints: every piece entry, in the order you meet them after leaving
  // the start/finish line (the line sits part-way down the main straight).
  const finishS = FINISH_AT // the main straight starts the layout, heading +z from the origin
  const entryS = pieces.map((pc) => path.find((p) => p.piece === pc.index)!.s)
  const ahead = (x: number) => (((x - finishS) % s) + s) % s
  const order = pieces
    .map((pc, i) => ({ pose: pc.pose, d: ahead(entryS[i]) }))
    .filter((c) => c.d > 1 && c.d < s - 1)
    .sort((a, b) => a.d - b.d)
  const checkpoints = order.map((c) => c.pose)
  // Sectors: split the lap in three at the checkpoints closest to 1/3 and 2/3.
  const closestTo = (target: number) =>
    order.reduce((best, c, i) => (Math.abs(c.d - target) < Math.abs(order[best].d - target) ? i : best), 0)
  const sectorEnds = [closestTo(s / 3), closestTo((2 * s) / 3)]

  return {
    pieces,
    centerline,
    path,
    length: s,
    barrierOffset,
    barriers,
    start: grid[0],
    grid,
    finish,
    checkpoints,
    sectorEnds,
    bounds: {
      minX: Math.min(...all.map((p) => p.x)) - pad,
      maxX: Math.max(...all.map((p) => p.x)) + pad,
      minZ: Math.min(...all.map((p) => p.z)) - pad,
      maxZ: Math.max(...all.map((p) => p.z)) + pad,
    },
  }
}

/**
 * Closest point on the track centerline to (x, z): the point, the driving
 * heading there, how far away it is, which side of the centerline you're on
 * (+1 left, -1 right) and which piece it belongs to.
 */
export function nearestOnTrack(x: number, z: number, t: Pick<BuiltTrack, 'centerline'> = track) {
  const c = t.centerline
  let best = { x: c[0].x, z: c[0].z, yaw: c[0].yaw, dist: Infinity, side: 1, piece: 0 }
  for (let i = 0; i < c.length; i++) {
    const a = c[i]
    const b = c[(i + 1) % c.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    const u = len2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0
    const px = a.x + dx * u
    const pz = a.z + dz * u
    const dist = Math.hypot(x - px, z - pz)
    if (dist < best.dist) {
      const yaw = Math.atan2(dx, dz)
      // Left normal is (cos, -sin): positive dot product means we're on the left.
      const side = (x - px) * Math.cos(yaw) - (z - pz) * Math.sin(yaw) >= 0 ? 1 : -1
      best = { x: px, z: pz, yaw, dist, side, piece: a.piece }
    }
  }
  return best
}

/** What the kart is driving on at (x, z). Matches what the road mesh draws. */
export function surfaceAt(x: number, z: number, t: BuiltTrack = track): Surface {
  return surfaceFromNearest(nearestOnTrack(x, z, t), t)
}

/** Same as surfaceAt, when you already have the nearestOnTrack result. */
export function surfaceFromNearest(n: ReturnType<typeof nearestOnTrack>, t: BuiltTrack = track): Surface {
  const id = t.pieces[n.piece].id
  if (n.dist > ROAD_HALF_WIDTH - KERB_WIDTH && n.dist <= ROAD_HALF_WIDTH + 0.2 && hasKerb(id, n.side)) return 'kerb'
  // Everything else inside the walls is asphalt or smooth hall floor.
  return 'road'
}


export const track = buildTrack(TRACK_1)

// Handy while developing: inspect `track` from the browser console.
if (import.meta.env.DEV) (window as unknown as { track: BuiltTrack }).track = track
