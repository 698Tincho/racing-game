import { PIECES, ROAD_HALF_WIDTH, type PieceId } from './pieces'

// World scale of the track: 1 kit unit = TRACK_SCALE meters.
// At 4, the road is 7.2 m wide and a straight is 16 m long.
export const TRACK_SCALE = 4

// Invisible walls sit just behind the inner face of the rails.
export const WALL_THICKNESS = 0.6
export const WALL_HEIGHT = 2.5

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

export type BuiltTrack = {
  pieces: PlacedPiece[]
  /** Centerline points every few meters, in driving order. */
  centerline: CenterSample[]
  /** Wall segments along both rails. */
  walls: { x: number; z: number; yaw: number; length: number }[]
  start: Pose
  /** Start/finish line (under the gate). */
  finish: Pose
  /** Lines you must cross in order before the finish counts: one per piece entry. */
  checkpoints: Pose[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

// Rotate a local (x, z) by yaw. Same convention as three.js rotation.y:
// yaw 0 faces +Z, positive yaw turns towards +X.
const rotate = (x: number, z: number, yaw: number) => {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: x * c + z * s, z: -x * s + z * c }
}

export function buildTrack(sequence: PieceId[], scale = TRACK_SCALE): BuiltTrack {
  const pieces: PlacedPiece[] = []
  const centerline: CenterSample[] = []
  const walls: BuiltTrack['walls'] = []
  const half = ROAD_HALF_WIDTH * scale
  let pose: Pose = { x: 0, z: 0, yaw: 0 }

  sequence.forEach((id, index) => {
    const def = PIECES[id]
    pieces.push({ id, index, pose: { ...pose } })

    // Sample the centerline (point + heading) along the piece.
    const pts = Array.from({ length: def.samples + 1 }, (_, i) => {
      const t = i / def.samples
      const local = def.center(t)
      const ahead = def.center(Math.min(1, t + 1e-3))
      const behind = def.center(Math.max(0, t - 1e-3))
      const w = rotate(local.x * scale, local.z * scale, pose.yaw)
      const localYaw = Math.atan2(ahead.x - behind.x, ahead.z - behind.z)
      return { x: pose.x + w.x, z: pose.z + w.z, yaw: pose.yaw + localYaw }
    })

    for (let i = 0; i < def.samples; i++) centerline.push({ ...pts[i], piece: index })

    // Walls: offset every sample sideways to each rail, then connect
    // neighbours with a box. Offsetting per sample (instead of offsetting the
    // centerline chord) keeps the outside of corners free of gaps.
    for (const side of [1, -1]) {
      const rail = pts.map((p) => ({
        // Normal pointing to the left of the driving direction is (cos, -sin).
        x: p.x + Math.cos(p.yaw) * (half + WALL_THICKNESS / 2) * side,
        z: p.z - Math.sin(p.yaw) * (half + WALL_THICKNESS / 2) * side,
      }))
      for (let i = 0; i < def.samples; i++) {
        const a = rail[i]
        const b = rail[i + 1]
        walls.push({
          x: (a.x + b.x) / 2,
          z: (a.z + b.z) / 2,
          yaw: Math.atan2(b.x - a.x, b.z - a.z),
          length: Math.hypot(b.x - a.x, b.z - a.z) + WALL_THICKNESS, // overlap the joints
        })
      }
    }

    const exit = rotate(def.exit.x * scale, def.exit.z * scale, pose.yaw)
    pose = { x: pose.x + exit.x, z: pose.z + exit.z, yaw: pose.yaw + def.exit.turn }
  })

  const closes = Math.hypot(pose.x, pose.z) < 0.01 && Math.abs(Math.cos(pose.yaw) - 1) < 1e-6
  if (!closes) console.warn('[track] layout does not close the loop, it ends at', pose)

  const xs = centerline.map((p) => p.x)
  const zs = centerline.map((p) => p.z)
  const pad = half + 2
  return {
    pieces,
    centerline,
    walls,
    start: { x: 0, z: 0.5 * scale, yaw: 0 },
    finish: { x: 0, z: 2 * scale, yaw: 0 },
    checkpoints: pieces.slice(1).map((p) => p.pose),
    bounds: {
      minX: Math.min(...xs) - pad,
      maxX: Math.max(...xs) + pad,
      minZ: Math.min(...zs) - pad,
      maxZ: Math.max(...zs) + pad,
    },
  }
}

export const track = buildTrack(TRACK_1)

/**
 * World position/heading at `t` (0..1) along a placed piece's centerline, and
 * which side the inside of the turn is on (+1 = left, -1 = right, 0 = straight).
 */
export function pointOnPiece(placed: PlacedPiece, t: number, scale = TRACK_SCALE) {
  const def = PIECES[placed.id]
  const at = def.center(t)
  const ahead = def.center(Math.min(1, t + 1e-3))
  const behind = def.center(Math.max(0, t - 1e-3))
  const w = rotate(at.x * scale, at.z * scale, placed.pose.yaw)
  return {
    x: placed.pose.x + w.x,
    z: placed.pose.z + w.z,
    yaw: placed.pose.yaw + Math.atan2(ahead.x - behind.x, ahead.z - behind.z),
    inside: Math.sign(def.exit.turn),
  }
}

/** Offset a point sideways: positive = to the left of the driving direction. */
export const offsetLeft = (p: { x: number; z: number; yaw: number }, d: number) => ({
  x: p.x + Math.cos(p.yaw) * d,
  z: p.z - Math.sin(p.yaw) * d,
})

/**
 * Closest point on the track centerline to (x, z), with the driving heading
 * there and how far away it is. Used to put the kart back on the road.
 */
export function nearestOnTrack(x: number, z: number, t: BuiltTrack = track) {
  const c = t.centerline
  let best = { x: c[0].x, z: c[0].z, yaw: c[0].yaw, dist: Infinity }
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
    if (dist < best.dist) best = { x: px, z: pz, yaw: Math.atan2(dx, dz), dist }
  }
  return best
}

// Handy while developing: inspect `track` from the browser console.
if (import.meta.env.DEV) (window as unknown as { track: BuiltTrack }).track = track
