import { GRID_BOXES, PIECES, START_LINE_Z, type PieceId, type Pose } from './pieces'

export type { Pose } from './pieces'

// ---------------------------------------------------------------------------
// The circuit is built from Kenney Racing Kit road tiles, snapped together.
// Its shape follows an outdoor kart track ("Karting Club Lider" on Sketchfab,
// used only as a layout reference), fitted to the kit's grid.
// ---------------------------------------------------------------------------

/** One kit tile, in metres. The kit's road is 0.7 tiles wide: 5.6 m. */
export const TILE = 8
/** How high the paved run-off between the road and the barriers is: the road is at 0, so it's flat to the eye. */
export const RUNOFF_Y = -0.012
/** Half the asphalt width. */
export const ROAD_HALF_WIDTH = 0.35 * TILE
/** The kit's red/white kerbs reach this far from the centreline, in corners. */
export const KERB_OUTER = 0.71 * TILE
/** Barrier blocks (the kit's barrierRed / barrierWhite): length and depth. */
export const BARRIER_LENGTH = 0.25 * TILE
export const BARRIER_THICKNESS = 0.12 * TILE
/** Height of the invisible collider behind the blocks. */
export const BARRIER_HEIGHT = 1.4
/** How far out the barrier line sits: just past the kerbs (0.71 tiles), clear of them. */
const BARRIER_OFFSET = 0.8 * TILE
/** Outer face of the barriers on the straights. */
export const WALL_OUTER = BARRIER_OFFSET + BARRIER_THICKNESS / 2
/** Around a sandy corner the barrier moves out to here, just past the sand. */
const RUNOFF_OFFSET = 1.06 * TILE
/** How far along the road the barrier keeps its run-off width past a corner, in samples. */
const RUNOFF_LEAD = 7
/** The block of tiles kept free for the parking lot, so corners there get no run-off. */
const PARKING_TILES = { minCol: 2, maxCol: 8, minRow: 8, maxRow: 10 }

/** A checkpoint every this many meters: you can't skip a section. */
const CHECKPOINT_SPACING = 25

/**
 * Track 1. Read it like turtle directions, starting on the main straight
 * heading north (-z), two tiles before the line:
 *   S straight · GRID starting grid (2 tiles) · START line and gantry (2 tiles)
 *   LS/RS small corner (1 tile) · LL/RL large corner (2×2 tiles)
 * Only 90° corners, so every piece sits on the kit's grid. Every corner has a
 * free tile on its outside and parallel sections have a free tile between
 * them, so kerbs and barriers never run into another part of the track.
 * Its outline fills a 14 × 16 tile rectangle, with the bottom-right block left
 * free for the parking lot.
 * The loop must end exactly where it starts (the builder warns if it doesn't).
 */
export const TRACK_1: PieceId[] = [
  'GRID', 'START', 'S', 'S', 'S', 'S', 'S', // main straight, pit garages on the right
  'LL', // top-right corner
  'S', 'S', 'S', 'S', 'S', // top straight
  'LS', 'S', 'S', 'S', 'S', // down into the S
  'RL', 'RL', // the hairpin: two large corners, one semicircle
  'S', 'S', 'S', 'S', 'LS', 'S', // back up to the top edge and left
  'LL', // top-left corner
  'S', 'S', 'S', 'S', 'S', 'S', // left straight
  'LS', 'S', 'S', 'S', 'S', 'S', 'S', 'S', // into the hook
  'LS', 'S', 'S', 'S', 'S', // up the middle
  'RL', 'RL', // over the top of the hook: another semicircle
  'S', 'S', 'S', 'S', 'S', // down beside the main straight
  'RL', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', // back straight, right to left
  'LS', 'S', 'S', 'S', // down the left side
  'LL', // bottom-left corner
  'S', 'S', 'S', 'S', 'LS', 'S', 'S', 'RS', // bottom straight, then up around the parking lot
  'S', 'S', 'S', 'S', 'S',
  'LL', // onto the main straight
]

/** Where the first piece starts: the bottom of tile (8, 5), heading north (-z). */
const ORIGIN: Pose = { x: 8 * TILE, z: 5.5 * TILE, yaw: Math.PI }

export type PlacedPiece = {
  id: PieceId
  index: number
  /** Where the piece's entry sits in the world (metres). */
  pose: Pose
  /** A corner with a sand run-off on its outside. */
  sand: boolean
}

/** A point on the centerline about every meter. */
export type PathSample = Pose & {
  /** Distance along the lap from the start/finish line. */
  s: number
  piece: number
}

/** Coarse centerline point, for fast nearest-point lookups. `i` is its path index. */
export type CenterSample = Pose & { i: number }

export type Barrier = {
  /** Points along the barrier, in driving order, about a meter apart. */
  line: Pose[]
  /** Collider boxes along it. */
  segments: { x: number; z: number; yaw: number; length: number }[]
}

export type BuiltTrack = {
  pieces: PlacedPiece[]
  /** Dense centerline. path[0] is on the start/finish line. */
  path: PathSample[]
  /** Coarse centerline (every couple of metres), for nearestOnTrack. */
  centerline: CenterSample[]
  length: number
  /** How far the barrier sits from the centerline, per path sample and side. */
  barrierOffset: { left: number[]; right: number[] }
  barriers: Barrier[]
  /** Where the player starts: pole position (grid[0]). */
  start: Pose
  /** The grid boxes painted on the GRID piece, front first. */
  grid: (Pose & { position: number })[]
  /** Start/finish line. */
  finish: Pose
  /** Lines you must cross in order before the finish counts. */
  checkpoints: Pose[]
  /** Checkpoint indices that end sector 1 and sector 2 (sector 3 ends at the line). */
  sectorEnds: number[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** Tiles covered by road pieces, as "col,row". */
  tiles: Set<string>
}

export type Surface = 'road' | 'runoff' | 'kerb' | 'grass' | 'gravel' | 'pit'

// Rotate a local (x, z) by yaw. Same convention as three.js rotation.y:
// yaw 0 faces +Z, positive yaw turns towards +X.
const rotate = (x: number, z: number, yaw: number) => {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: x * c + z * s, z: -x * s + z * c }
}
const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz)

/** Offset a point sideways: positive = to the left of the driving direction. */
export const offsetLeft = (p: { x: number; z: number; yaw: number }, d: number) => ({
  x: p.x + Math.cos(p.yaw) * d,
  z: p.z - Math.sin(p.yaw) * d,
})

/** A point in a piece's own frame (kit units) → world metres, for a piece placed at `pose`. */
export function pieceToWorld(id: PieceId, pose: Pose, local: { x: number; z: number }) {
  const e = PIECES[id].entry
  const w = rotate((local.x - e.x) * TILE, (local.z - e.z) * TILE, pose.yaw - e.yaw)
  return { x: pose.x + w.x, z: pose.z + w.z }
}

/** Walk a closed polyline and drop points every `spacing` meters along it. */
export function resampleLoop(points: { x: number; z: number }[], spacing: number): Pose[] {
  const out: Pose[] = []
  let carry = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < 1e-6) continue
    const yaw = yawOf(b.x - a.x, b.z - a.z)
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

/** Where segments ab and cd cross, if they do. */
function crossing(a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }, d: { x: number; z: number }) {
  const r = { x: b.x - a.x, z: b.z - a.z }
  const q = { x: d.x - c.x, z: d.z - c.z }
  const den = r.x * q.z - r.z * q.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * q.z - (c.z - a.z) * q.x) / den
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den
  return t > 0 && t < 1 && u > 0 && u < 1 ? { x: a.x + r.x * t, z: a.z + r.z * t } : null
}

/** Cut the small loops out of a closed line that crosses itself (an offset line around a tight corner). */
function removeLoops(points: { x: number; z: number }[], window = 40) {
  const out = [...points]
  for (let i = 0; i < out.length; i++) {
    for (let k = 2; k < window && k < out.length - 1; k++) {
      const j = (i + k) % out.length
      const hit = crossing(out[i], out[(i + 1) % out.length], out[j], out[(j + 1) % out.length])
      if (!hit) continue
      // Replace everything between the two crossing segments with the crossing point.
      if (j > i) out.splice(i + 1, j - i, hit)
      else {
        out.splice(i + 1)
        out.splice(0, j + 1)
        out.push(hit)
      }
      break
    }
  }
  return out
}

/** Average each value with its neighbours, wrapping round a closed loop. */
function smoothLoop(values: number[], radius: number) {
  const n = values.length
  return values.map((_, i) => {
    let sum = 0
    for (let d = -radius; d <= radius; d++) sum += values[(i + d + n) % n]
    return sum / (radius * 2 + 1)
  })
}

export function buildTrack(sequence: PieceId[] = TRACK_1): BuiltTrack {
  const pieces: PlacedPiece[] = []
  const raw: PathSample[] = []
  const tiles = new Set<string>()
  let pose: Pose = { ...ORIGIN }
  let s = 0

  sequence.forEach((id, index) => {
    const def = PIECES[id]
    const placed = { id, index, pose: { ...pose }, sand: false }
    pieces.push(placed)

    // Centreline, about a metre apart.
    const meters = def.length * TILE
    const n = Math.max(1, Math.round(meters))
    for (let i = 0; i < n; i++) {
      const t = i / n
      const p = pieceToWorld(id, pose, def.center(t))
      const q = pieceToWorld(id, pose, def.center(Math.min(1, t + 0.5 / n)))
      raw.push({ ...p, yaw: yawOf(q.x - p.x, q.z - p.z), s: s + (meters * i) / n, piece: index })
    }
    s += meters

    // Tiles it covers.
    const [x0, x1, z0, z1] = def.footprint
    for (let x = x0 + 0.5; x < x1; x++)
      for (let z = z0 + 0.5; z < z1; z++) {
        const w = pieceToWorld(id, pose, { x, z })
        tiles.add(`${Math.round(w.x / TILE)},${Math.round(w.z / TILE)}`)
      }

    const exit = pieceToWorld(id, pose, def.exit)
    pose = { x: exit.x, z: exit.z, yaw: pose.yaw + def.exit.yaw - def.entry.yaw }
  })

  const closes = Math.hypot(pose.x - ORIGIN.x, pose.z - ORIGIN.z) < 0.01 && Math.abs(Math.cos(pose.yaw - ORIGIN.yaw) - 1) < 1e-6
  if (!closes) console.warn('[track] layout does not close the loop, it ends at', pose, 'instead of', ORIGIN)

  // Start/finish: the line painted across the START piece. Re-number the path
  // so it begins there.
  const startPiece = pieces.find((p) => p.id === 'START')!
  const line = pieceToWorld('START', startPiece.pose, { x: PIECES.START.entry.x, z: START_LINE_Z })
  const finish: Pose = { ...line, yaw: startPiece.pose.yaw }
  let first = 0
  raw.forEach((p, i) => {
    if (Math.hypot(p.x - line.x, p.z - line.z) < Math.hypot(raw[first].x - line.x, raw[first].z - line.z)) first = i
  })
  const path = [...raw.slice(first), ...raw.slice(0, first)].map((p) => ({ ...p, s: 0 }))
  for (let i = 1; i < path.length; i++) path[i].s = path[i - 1].s + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z)
  const length = path[path.length - 1].s + Math.hypot(path[0].x - path[path.length - 1].x, path[0].z - path[path.length - 1].z)

  const centerline: CenterSample[] = path
    .filter((_, i) => i % 2 === 0)
    .map((p, k) => ({ x: p.x, z: p.z, yaw: p.yaw, i: k * 2 }))
  const partial = { path, centerline, pieces } as BuiltTrack

  // Sand run-offs: on the outside of any corner with room for one, clear of
  // other sections of road and of the parking lot.
  const inParkingTiles = (q: { x: number; z: number }) =>
    q.x / TILE > PARKING_TILES.minCol - 0.5 && q.z / TILE > PARKING_TILES.minRow - 0.5
  const isNeighbour = (a: number, b: number) => {
    const gap = Math.abs(a - b)
    return Math.min(gap, pieces.length - gap) <= 1
  }
  for (const piece of pieces) {
    const corner = PIECES[piece.id].corner
    if (!corner) continue
    piece.sand = path
      .filter((p) => p.piece === piece.index)
      .every((p) => {
        const q = offsetLeft(p, -corner.inside * RUNOFF_OFFSET)
        if (inParkingTiles(q)) return false
        return centerline.every(
          (c) =>
            isNeighbour(path[c.i].piece, piece.index) ||
            Math.hypot(c.x - q.x, c.z - q.z) >= WALL_OUTER + BARRIER_THICKNESS / 2 + 0.3,
        )
      })
  }
  const runoffOffsets = (side: 1 | -1) => {
    const wide = path.map(() => false)
    path.forEach((p, i) => {
      const piece = pieces[p.piece]
      const corner = PIECES[piece.id].corner
      if (!piece.sand || corner?.inside !== -side) return
      for (let d = -RUNOFF_LEAD; d <= RUNOFF_LEAD; d++) wide[(i + d + path.length) % path.length] = true
    })
    return smoothLoop(smoothLoop(wide.map((w) => (w ? RUNOFF_OFFSET : BARRIER_OFFSET)), 5), 5)
  }

  // Barriers: a line out on each side. On the inside of a small corner that
  // offset is past the corner's centre, so the line folds over itself; cutting
  // that loop out leaves a clean square corner where the two straights'
  // barriers meet.
  const barrierOffset = { left: [] as number[], right: [] as number[] }
  const barriers: Barrier[] = []
  for (const [side, key] of [[1, 'left'], [-1, 'right']] as const) {
    barrierOffset[key] = runoffOffsets(side)
    const offset = removeLoops(path.map((p, i) => offsetLeft(p, barrierOffset[key][i] * side)))
    const line = resampleLoop(offset, 1)
    const anchors = resampleLoop(line, 2)
    const segments = anchors.map((a, i) => {
      const b = anchors[(i + 1) % anchors.length]
      return {
        x: (a.x + b.x) / 2,
        z: (a.z + b.z) / 2,
        yaw: yawOf(b.x - a.x, b.z - a.z),
        length: Math.hypot(b.x - a.x, b.z - a.z) + BARRIER_THICKNESS * 0.5,
      }
    })
    barriers.push({ line, segments })
  }
  // The layout keeps sections apart, so no barrier should be near another road.
  for (const b of barriers)
    for (const p of b.line)
      if (nearestOnTrack(p.x, p.z, partial).dist < ROAD_HALF_WIDTH + BARRIER_THICKNESS / 2 + 0.2) {
        console.warn('[track] a barrier is on or right next to the road at', p)
        break
      }

  // Starting grid: the boxes painted on the GRID piece, nose towards the line.
  const gridPiece = pieces.find((p) => p.id === 'GRID')!
  const grid = GRID_BOXES.map((b, i) => ({ ...pieceToWorld('GRID', gridPiece.pose, b), yaw: gridPiece.pose.yaw, position: i + 1 }))

  // Checkpoints every CHECKPOINT_SPACING meters after the line.
  const checkpoints: Pose[] = []
  let next = CHECKPOINT_SPACING
  for (const p of path) {
    if (p.s >= next && p.s < length - CHECKPOINT_SPACING / 2) {
      checkpoints.push({ x: p.x, z: p.z, yaw: p.yaw })
      next += CHECKPOINT_SPACING
    }
  }
  // Sectors: split the lap in three at the checkpoints closest to 1/3 and 2/3.
  const closestTo = (target: number) => Math.round(target / CHECKPOINT_SPACING) - 1
  const sectorEnds = [closestTo(length / 3), closestTo((2 * length) / 3)]

  const all = barriers.flatMap((b) => b.line)
  const pad = 1
  return {
    pieces,
    path,
    centerline,
    length,
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
    tiles,
  }
}

/**
 * Closest point on the track centerline to (x, z): the point, the driving
 * heading there, how far away it is, which side of the centerline you're on
 * (+1 left, -1 right) and the index of the path sample it's at.
 */
export function nearestOnTrack(x: number, z: number, t: Pick<BuiltTrack, 'centerline'> = track) {
  const c = t.centerline
  let best = { x: c[0].x, z: c[0].z, yaw: c[0].yaw, dist: Infinity, side: 1, index: 0 }
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
      const yaw = yawOf(dx, dz)
      // Left normal is (cos, -sin): positive dot product means we're on the left.
      const side = (x - px) * Math.cos(yaw) - (z - pz) * Math.sin(yaw) >= 0 ? 1 : -1
      best = { x: px, z: pz, yaw, dist, side, index: a.i }
    }
  }
  return best
}

/** What the kart is driving on at (x, z). Matches the kit's road and kerb pieces. */
export function surfaceAt(x: number, z: number, t: BuiltTrack = track): Surface {
  return surfaceFromNearest(nearestOnTrack(x, z, t), t)
}

/** Same as surfaceAt, when you already have the nearestOnTrack result. */
export function surfaceFromNearest(n: ReturnType<typeof nearestOnTrack>, t: BuiltTrack = track): Surface {
  if (n.dist <= ROAD_HALF_WIDTH + 0.15) return 'road'
  const piece = t.pieces[t.path[n.index].piece]
  const corner = PIECES[piece.id].corner
  // Kerbs: outside of every corner, inside of the large ones too.
  if (corner && n.dist <= KERB_OUTER && (n.side !== corner.inside || corner.size === 'large')) return 'kerb'
  // Past the kerb on the outside of a sandy corner.
  if (corner && piece.sand && n.side !== corner.inside) return 'gravel'
  // Everything else up to the barriers is paved run-off: the barriers are the limit.
  const barrier = (n.side === 1 ? t.barrierOffset.left : t.barrierOffset.right)[n.index]
  if (n.dist <= barrier) return 'runoff'
  return 'grass'
}

export const track = buildTrack()

/** How far (x, z) is beyond the barrier beside it. Negative means inside the barriers. */
export function beyondWall(x: number, z: number) {
  const n = nearestOnTrack(x, z)
  const offset = (n.side === 1 ? track.barrierOffset.left : track.barrierOffset.right)[n.index]
  return n.dist - offset - BARRIER_THICKNESS / 2
}

/** Is (x, z) on the barrier line in front of the pits? A concrete pit wall stands there. */
export function inPitWall(x: number, z: number) {
  const { finish } = track
  return Math.abs(x - (finish.x + BARRIER_OFFSET)) < 1 && z < finish.z + 3.5 * TILE && z > finish.z - 4.5 * TILE
}

// Handy while developing: inspect `track` from the browser console.
if (import.meta.env.DEV) (window as unknown as { track: BuiltTrack }).track = track
