import { KERB_OUTER, ROAD_HALF_WIDTH, TILE, WALL_OUTER, nearestOnTrack, offsetLeft, track, type Pose } from './layout'
import { PIECES } from './pieces'

// ---------------------------------------------------------------------------
// The pit lane: it branches off the outside of the last corner, runs along the
// front of the garages under a speed limit, and rejoins the track after
// turn 1, past the corner's sand. It's as wide as the track.
// ---------------------------------------------------------------------------

export const PIT_LANE_HALF_WIDTH = 0.35 * TILE
/** How high the lane's asphalt is: just under the road (at 0), above the run-off and the lot. */
export const PIT_LANE_Y = -0.006
/** The pit-lane speed limit, in m/s (40 km/h). */
export const PIT_SPEED = 40 / 3.6

/** The garages run along the main straight between these two lines (z). */
export const PIT_SOUTH = track.finish.z + 3.5 * TILE
export const PIT_NORTH = track.finish.z - 4.5 * TILE
const LANE_X = track.finish.x + 1.5 * TILE

// Where the lane goes, in metres, in driving order. Smoothed into a curve below.
const CONTROL: [number, number][] = [
  // In: peeling off to the right before the last corner, round its outside.
  [26, 57],
  [34, 58.4],
  [42, 59.6],
  [50, 60.3],
  [57, 60],
  [63.5, 58.4],
  [68.8, 55.4],
  [72.8, 51.2],
  [75.3, 46.4],
  [LANE_X, 41],
  // Along the garages.
  [LANE_X, 30],
  [LANE_X, 0],
  [LANE_X, -12],
  // Out: round the outside of turn 1 and onto the next straight.
  [76.3, -22],
  [75.8, -31],
  [73.6, -39.6],
  [69, -46],
  [62.6, -50.2],
  [55, -52.2],
  [47.4, -51.8],
  [40.6, -49.4],
  [34.8, -46.4],
  [29.8, -43.4],
  [24.4, -41.6],
  [19, -41.2],
]

/** Metres of lane at each end, past the limiter lines, for slowing down and speeding up. */
const LIMITER_FROM_ENDS = 14

/** Where the walls along the lane stand, from its centre. */
const WALL_CENTRE = PIT_LANE_HALF_WIDTH + 0.55

export type PitSample = Pose & { limiter: boolean }

function catmullRom(points: [number, number][], spacing: number) {
  const out: { x: number; z: number }[] = []
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(i - 1, 0)], points[i], points[i + 1], points[Math.min(i + 2, n - 1)]]
    const steps = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / spacing))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t
      const at = (k: 0 | 1) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
      out.push({ x: at(0), z: at(1) })
    }
  }
  out.push({ x: points[n - 1][0], z: points[n - 1][1] })
  return out
}

/** Closest point on the lane's centreline to (x, z): how far away it is and which sample it's at. */
export function pitNearest(x: number, z: number) {
  let best = { dist: Infinity, index: 0 }
  pitLane.path.forEach((p, index) => {
    const dist = Math.hypot(p.x - x, p.z - z)
    if (dist < best.dist) best = { dist, index }
  })
  return best
}

/** Is (x, z) on the lane, or close enough that the track's barrier must make way for it? */
export const nearPitLane = (x: number, z: number, margin = 0.6) => pitNearest(x, z).dist < PIT_LANE_HALF_WIDTH + margin

function buildPitLane() {
  const points = catmullRom(CONTROL, 1)
  const path: PitSample[] = points.map((p, i) => {
    const a = points[Math.max(i - 1, 0)]
    const b = points[Math.min(i + 1, points.length - 1)]
    // Limited from just after you leave the track to just before you rejoin it,
    // like a real pit lane, so going through the pits always costs time.
    const limiter = i >= LIMITER_FROM_ENDS && i < points.length - LIMITER_FROM_ENDS
    return { ...p, yaw: Math.atan2(b.x - a.x, b.z - a.z), limiter }
  })

  // Walls along both sides, except where the lane meets the track. On the left
  // (the track side) they also stay open along the garages, where the pit wall
  // already stands; on the right they stop only inside the track's barriers.
  type WallPoint = Pose & { wall: boolean; seen: boolean }
  const sides = [1, -1].map((side) =>
    path.map((p): WallPoint => {
      const q = { ...offsetLeft(p, side * WALL_CENTRE), yaw: p.yaw }
      const d = nearestOnTrack(q.x, q.z).dist
      const wall = side === 1 ? d >= WALL_OUTER + 2.6 : d >= WALL_OUTER - 0.8
      // Invisible where the garages or the parking lot's own wall already show the edge.
      const alongGarages = side === -1 && q.z < PIT_SOUTH + 1 && q.z > PIT_NORTH - 1
      const alongLot = q.z > 61 && q.x < 70
      return { ...q, wall, seen: wall && !alongGarages && !alongLot }
    }),
  )
  const segments: { x: number; z: number; yaw: number; length: number }[] = []
  const visible: Pose[][] = []
  for (const line of sides) {
    for (let i = 0; i + 2 < line.length; i += 2) {
      const a = line[i]
      const b = line[i + 2]
      if (!a.wall || !line[i + 1].wall || !b.wall) continue
      segments.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, yaw: Math.atan2(b.x - a.x, b.z - a.z), length: Math.hypot(b.x - a.x, b.z - a.z) + 0.4 })
    }
    let run: Pose[] = []
    for (const q of line) {
      if (q.seen) run.push(q)
      else if (run.length) {
        if (run.length > 2) visible.push(run)
        run = []
      }
    }
    if (run.length > 2) visible.push(run)
  }

  // Checkpoints the lane skips: from where it leaves the track to where it rejoins.
  const sAt = (x: number, z: number) => track.path[nearestOnTrack(x, z).index].s
  const leaves = sAt(points[0].x, points[0].z)
  const rejoins = sAt(points[points.length - 1].x, points[points.length - 1].z)
  const bypassed = new Set<number>()
  track.checkpoints.forEach((c, i) => {
    const s = sAt(c.x, c.z)
    if (s > leaves - 5 || s < rejoins + 5) bypassed.add(i)
  })

  // Corners whose outside kerb the lane drives across: those kerbs come out.
  const kerbless = new Set<number>()
  const onLane = (x: number, z: number) => path.some((p) => Math.hypot(p.x - x, p.z - z) < PIT_LANE_HALF_WIDTH + 0.5)
  for (const sample of track.path) {
    const piece = track.pieces[sample.piece]
    const corner = PIECES[piece.id].corner
    if (!corner || kerbless.has(piece.index)) continue
    for (const d of [ROAD_HALF_WIDTH + 0.4, (ROAD_HALF_WIDTH + KERB_OUTER) / 2, KERB_OUTER]) {
      const q = offsetLeft(sample, -corner.inside * d)
      if (onLane(q.x, q.z)) kerbless.add(piece.index)
    }
  }

  const xs = path.map((p) => p.x)
  const zs = path.map((p) => p.z)
  return {
    path,
    walls: { segments, visible },
    /** Track pieces (by index) whose outside kerb is left out where the lane crosses it. */
    kerbless,
    /** Per sample: is there a wall on the lane's track side? (Where there isn't, at the ends, lane and track meet.) */
    trackSideWall: sides[0].map((q) => q.wall),
    /** Checkpoint indices you don't pass when you take the pit lane. */
    bypassed,
    /** Your own pit box, where qualifying starts, facing the pit exit. */
    box: { x: LANE_X + 1.4, z: PIT_SOUTH - 4.5 * TILE, yaw: track.finish.yaw },
    bounds: {
      minX: Math.min(...xs) - WALL_CENTRE,
      maxX: Math.max(...xs) + WALL_CENTRE,
      minZ: Math.min(...zs) - WALL_CENTRE,
      maxZ: Math.max(...zs) + WALL_CENTRE,
    },
  }
}

export const pitLane = buildPitLane()
