// Track piece catalogue: the building blocks the layout is written with.
//
// Every piece is described in "units" (scaled to meters by TRACK_SCALE):
//   - you enter at (0, 0) heading +Z
//   - `exit` is where you leave and how much you turned
//   - `center(t)` gives the centerline point for t in 0..1
//
// A straight is 4 long (H, half a straight, is 2), corners have radius 2 or 4.

export type PieceId = 'S' | 'H' | 'RS' | 'LS' | 'RL' | 'LL'

export type PieceDef = {
  exit: { x: number; z: number; turn: number }
  center: (t: number) => { x: number; z: number }
  length: number // centerline length in units
  corner: 'none' | 'small' | 'large'
  samples: number // coarse segments, used for "nearest point on track" lookups
}

const corner = (radius: number, dir: 1 | -1): Pick<PieceDef, 'exit' | 'center' | 'length'> => ({
  // dir = -1 turns right (towards -X), +1 turns left (towards +X)
  exit: { x: dir * radius, z: radius, turn: dir * (Math.PI / 2) },
  center: (t) => {
    const a = t * (Math.PI / 2)
    return { x: dir * (radius - radius * Math.cos(a)), z: radius * Math.sin(a) }
  },
  length: (radius * Math.PI) / 2,
})

export const PIECES: Record<PieceId, PieceDef> = {
  S: {
    exit: { x: 0, z: 4, turn: 0 },
    center: (t) => ({ x: 0, z: 4 * t }),
    length: 4,
    corner: 'none',
    samples: 1,
  },
  H: {
    exit: { x: 0, z: 2, turn: 0 },
    center: (t) => ({ x: 0, z: 2 * t }),
    length: 2,
    corner: 'none',
    samples: 1,
  },
  RS: { corner: 'small', samples: 10, ...corner(2, -1) },
  LS: { corner: 'small', samples: 10, ...corner(2, 1) },
  RL: { corner: 'large', samples: 16, ...corner(4, -1) },
  LL: { corner: 'large', samples: 16, ...corner(4, 1) },
}
