// The Racing Kit's road pieces, described so the layout can chain them.
//
// Everything here is in kit units (1 = one tile; layout.ts scales it to
// metres). In the kit's own files a single tile spans x -0.35..0.65 and
// z -1.65..-0.65, and the road down its middle is 0.7 wide, centred on
// x = 0.15. Each piece says where you drive in (`entry`), where you come out
// (`exit`) and the centreline in between, in the model's own frame.
//
// Corners are one model each but can be driven either way, so they appear
// twice (left and right). Only 90° corners: the track stays on the kit's grid.

export type PieceId =
  | 'S' // straight, 1 tile
  | 'GRID' // straight with the starting-grid boxes, 2 tiles
  | 'START' // straight with the start/finish line and gantry, 2 tiles
  | 'LS' | 'RS' // small corner (radius 0.5), left / right
  | 'LL' | 'RL' // large corner (radius 1.5), left / right

export type Pose = { x: number; z: number; yaw: number }

export type PieceDef = {
  /** Road model, plus kerbs drawn with the same placement. */
  model: string
  kerbs: string[]
  /** Corners: the sand run-off drawn on the outside, where there's room for it. */
  sand?: string
  entry: Pose
  exit: Pose
  /** Centreline point for t in 0..1, local. */
  center: (t: number) => { x: number; z: number }
  /** Centreline length, in tiles. */
  length: number
  /** Corners: size, and which side the inside of the turn is on (+1 left, -1 right). */
  corner?: { size: 'small' | 'large'; inside: 1 | -1 }
  /** Tiles the piece covers, local [minX, maxX, minZ, maxZ]. */
  footprint: [number, number, number, number]
}

const ROAD_X = 0.15
const START_ROAD_X = 0.28 // its asphalt runs x -0.065..0.625; everyone else's -0.195..0.495
const N = Math.PI // facing -z
const HALF_PI = Math.PI / 2

/** A quarter circle around (cx, cz) from straight "below" the centre to straight left of it. */
const arc = (cx: number, cz: number, r: number) => (t: number) => ({
  x: cx - r * Math.sin((t * Math.PI) / 2),
  z: cz - r * Math.cos((t * Math.PI) / 2),
})
const reversed = (f: (t: number) => { x: number; z: number }) => (t: number) => f(1 - t)
const line = (a: { x: number; z: number }, b: { x: number; z: number }) => (t: number) => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
})

/**
 * A straight piece, driven towards +z in its file (or towards -z if
 * `reversed`). `roadX`: where its road runs (the start piece's is 0.13 off
 * the others').
 */
const straight = (model: string, tiles: number, roadX = ROAD_X, reversed = false): PieceDef => {
  const near = { x: roadX, z: -0.65 - tiles }
  const far = { x: roadX, z: -0.65 }
  return {
    model,
    kerbs: [],
    entry: reversed ? { ...far, yaw: Math.PI } : { ...near, yaw: 0 },
    exit: reversed ? { ...near, yaw: Math.PI } : { ...far, yaw: 0 },
    center: reversed ? line(far, near) : line(near, far),
    length: tiles,
    footprint: [-0.35, 0.65, -0.65 - tiles, -0.65],
  }
}

/** Small and large corners: the turn's centre is the tile corner at (r + 0.15, -0.65). */
function corner(size: 'small' | 'large', dir: 'L' | 'R'): PieceDef {
  const r = size === 'small' ? 0.5 : 1.5
  const cx = ROAD_X + r
  const cz = -0.65
  const left = { x: cx, z: cz - r, yaw: -HALF_PI } // the side entrance
  const top = { x: ROAD_X, z: cz, yaw: 0 } // the top entrance
  const center = arc(cx, cz, r)
  const big = size === 'large'
  const def = {
    model: big ? 'roadCornerLarge' : 'roadCornerSmall',
    kerbs: big ? ['roadCornerLargeBorder', 'roadCornerLargeBorderInner'] : ['roadCornerSmallBorder'],
    sand: big ? 'roadCornerLargeSand' : 'roadCornerSmallSand',
    length: (r * Math.PI) / 2,
    footprint: [-0.35, cx, cz - r - 0.5, cz] as [number, number, number, number],
  }
  // Driving in from the side and out of the top turns left; the other way, right.
  return dir === 'L'
    ? { ...def, entry: left, exit: top, center, corner: { size, inside: 1 } }
    : {
        ...def,
        entry: { ...top, yaw: N },
        exit: { ...left, yaw: HALF_PI },
        center: reversed(center),
        corner: { size, inside: -1 },
      }
}

export const PIECES: Record<PieceId, PieceDef> = {
  S: straight('roadStraight', 1),
  GRID: straight('roadStartPositions', 2),
  // In the kit's file the start piece's road (and its gantry) sit 0.13 tile to
  // the side of every other road piece's, so it's lined up on its own road.
  // It's driven towards -z, so the start lights on the gantry face the grid.
  START: straight('roadStart', 2, START_ROAD_X, true),
  LS: corner('small', 'L'),
  RS: corner('small', 'R'),
  LL: corner('large', 'L'),
  RL: corner('large', 'R'),
}

/** Where the starting-grid boxes are on the GRID piece (local, front box first). */
export const GRID_BOXES = [
  { x: -0.025, z: -0.9 },
  { x: 0.325, z: -1.4 },
  { x: -0.025, z: -1.9 },
  { x: 0.325, z: -2.4 },
]
/** Where the painted start/finish line crosses the START piece (local z). */
export const START_LINE_Z = -1.65
