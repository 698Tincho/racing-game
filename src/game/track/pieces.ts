// Track piece catalogue for the Kenney Toy Car Kit.
//
// Every piece is described in "kit units" (1 unit = 1 in the .glb file):
//   - you enter at (0, 0) heading +Z
//   - `exit` is where you leave and how much you turned
//   - `center(t)` gives the centerline point for t in 0..1 (for walls,
//     checkpoints, tree placement...)
//
// Measured from the models: a straight is 4 long, the road is 1.8 wide with
// a 0.1 thick rail on each side, small/large corners have radius 2/4.
// Corners in the kit turn right; left corners are the same model mirrored.

export const MODELS_URL = '/models/toy-car-kit'

/** Visual style: 'track-wide' (orange), 'track-road-wide' (asphalt) or 'track-striped-wide'. */
export const TRACK_STYLE = 'track-road-wide'

export const ROAD_HALF_WIDTH = 0.9 // kit units, inner face of the rails
export const ROAD_SURFACE_Y = 0.1 // road height above the bottom of a tile
export const TILE_ORIGIN_Y = -1 // the .glb files place the tile at y = -1

export type PieceId = 'S' | 'RS' | 'LS' | 'RL' | 'LL'

export type PieceDef = {
  model: string
  mirror: boolean
  exit: { x: number; z: number; turn: number }
  center: (t: number) => { x: number; z: number }
  samples: number // how many wall segments to generate per side
}

const corner = (radius: number, dir: 1 | -1): Pick<PieceDef, 'exit' | 'center'> => ({
  // dir = -1 turns right (towards -X), +1 turns left (towards +X)
  exit: { x: dir * radius, z: radius, turn: dir * (Math.PI / 2) },
  center: (t) => {
    const a = t * (Math.PI / 2)
    return { x: dir * (radius - radius * Math.cos(a)), z: radius * Math.sin(a) }
  },
})

export const PIECES: Record<PieceId, PieceDef> = {
  S: {
    model: `${TRACK_STYLE}-straight`,
    mirror: false,
    exit: { x: 0, z: 4, turn: 0 },
    center: (t) => ({ x: 0, z: 4 * t }),
    samples: 1,
  },
  RS: { model: `${TRACK_STYLE}-corner-small`, mirror: false, samples: 8, ...corner(2, -1) },
  LS: { model: `${TRACK_STYLE}-corner-small`, mirror: true, samples: 8, ...corner(2, 1) },
  RL: { model: `${TRACK_STYLE}-corner-large`, mirror: false, samples: 14, ...corner(4, -1) },
  LL: { model: `${TRACK_STYLE}-corner-large`, mirror: true, samples: 14, ...corner(4, 1) },
}

export const modelUrl = (name: string) => `${MODELS_URL}/${name}.glb`
