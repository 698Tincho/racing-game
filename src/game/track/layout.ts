import { PIECES, type PieceId } from './pieces'

// ---------------------------------------------------------------------------
// Circuit dimensions, all in meters. Change these to reshape every track.
// ---------------------------------------------------------------------------

/** 1 layout unit = TRACK_SCALE meters. A straight is 4 units, corners radius 2 / 4. */
export const TRACK_SCALE = 6
/** Half the asphalt width (12 m road). */
export const ROAD_HALF_WIDTH = 6
/** White track-limit line painted along both road edges. */
export const EDGE_LINE_WIDTH = 0.35
/** Red/white kerbs just outside the road, on corners. */
export const KERB_WIDTH = 1.6
/** Gravel trap on the outside of the large corners. */
export const GRAVEL_WIDTH = 10
/** Grass between the road edge and the tyre wall, where there's no gravel. */
export const RUNOFF_WIDTH = 8
/** Tyre walls: how thick (one tyre) and how tall the invisible collider is. */
export const BARRIER_THICKNESS = 1.5
export const BARRIER_HEIGHT = 2.5

/**
 * Track 1. Read it like turtle directions, starting on the main straight:
 *   S = straight, RS/LS = small right/left corner, RL/LL = large right/left corner.
 * The loop must end exactly where it starts (the builder warns if it doesn't).
 */
export const TRACK_1: PieceId[] = [
  'S', 'S', 'S', 'S', // main straight (start/finish)
  'RL', 'S', // turn 1, short run
  'RS', 'LS', // chicane
  'S', 'RL', // turn 4
  'S', 'S', 'S', 'S', // back straight
  'RL', 'S', 'S', 'S', // turn 5
  'RL', 'S', // last corner onto the main straight
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
  /** Tyre centers, about one tyre apart, in driving order. */
  tyres: { x: number; z: number; yaw: number }[]
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
  start: Pose
  /** Start/finish line (under the gate). */
  finish: Pose
  /** Lines you must cross in order before the finish counts: one per piece entry. */
  checkpoints: Pose[]
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

/** Is this side (+1 left / -1 right) of this piece the outside of a large corner? */
const isGravelSide = (id: PieceId, side: number) =>
  PIECES[id].corner === 'large' && side === -Math.sign(PIECES[id].exit.turn)

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

  // Tyre walls. Each side wants to sit a fixed distance out, but it must not
  // end up closer to another part of the circuit than to its own road (inside
  // of tight corners, or where two sections run close together), so it's
  // pulled in until it's clear, then smoothed.
  const barrierOffset = { left: [] as number[], right: [] as number[] }
  const barriers: Barrier[] = []
  for (const [side, key] of [[1, 'left'], [-1, 'right']] as const) {
    const raw = path.map((p) => {
      const id = pieces[p.piece].id
      let off = isGravelSide(id, side)
        ? ROAD_HALF_WIDTH + KERB_WIDTH + GRAVEL_WIDTH + BARRIER_THICKNESS / 2
        : ROAD_HALF_WIDTH + RUNOFF_WIDTH
      const min = ROAD_HALF_WIDTH + 2.5
      while (off > min) {
        const q = offsetLeft(p, off * side)
        if (nearestOnTrack(q.x, q.z, partial).dist >= off - 0.5) break
        off -= 0.5
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
    const tyres = resampleLoop(line, BARRIER_THICKNESS * 0.97)
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
    barriers.push({ tyres, segments })
  }

  const all = barriers.flatMap((b) => b.tyres)
  const pad = 4
  return {
    pieces,
    centerline,
    path,
    length: s,
    barrierOffset,
    barriers,
    start: { x: 0, z: 0.5 * scale, yaw: 0 },
    finish: { x: 0, z: 2 * scale, yaw: 0 },
    checkpoints: pieces.slice(1).map((p) => p.pose),
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
  if (n.dist <= ROAD_HALF_WIDTH) return 'road'
  const id = t.pieces[n.piece].id
  if (PIECES[id].corner !== 'none' && n.dist <= ROAD_HALF_WIDTH + KERB_WIDTH) return 'kerb'
  if (isGravelSide(id, n.side) && n.dist <= ROAD_HALF_WIDTH + KERB_WIDTH + GRAVEL_WIDTH) return 'gravel'
  return 'grass'
}

export { isGravelSide }

export const track = buildTrack(TRACK_1)

// Handy while developing: inspect `track` from the browser console.
if (import.meta.env.DEV) (window as unknown as { track: BuiltTrack }).track = track
