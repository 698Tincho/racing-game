import type { PieceId } from './pieces'

// ---------------------------------------------------------------------------
// The circuits you can pick on the menu. All are built from the same Racing
// Kit road pieces; what sets them apart is the layout between the home
// straight's two ends (and, later, the venue around it).
//
// Every layout shares the home section: the grid, the main straight and turn 1
// at the start, and the approach and last corner at the end. The pit lane, the
// garages and the parking lot are laid out around that section, so they work
// on every circuit as they are. A layout starts with HOME_START, ends with
// HOME_END, and must close the loop in between (buildTrack warns if it doesn't).
// ---------------------------------------------------------------------------

/** Grid, start line, main straight, turn 1 and the straight after it, heading west. */
export const HOME_START: PieceId[] = ['GRID', 'START', 'S', 'S', 'S', 'S', 'S', 'LL', 'S', 'S', 'S', 'S', 'S']
/** The approach, heading east along the parking lot, and the last corner onto the main straight. */
export const HOME_END: PieceId[] = ['S', 'S', 'S', 'S', 'S', 'LL']

/**
 * Circuit 01. Read it like turtle directions:
 *   S straight · GRID starting grid (2 tiles) · START line and gantry (2 tiles)
 *   LS/RS small corner (1 tile) · LL/RL large corner (2×2 tiles)
 * Only 90° corners, so every piece sits on the kit's grid. Every corner has a
 * free tile on its outside and parallel sections have a free tile between
 * them, so kerbs and barriers never run into another part of the track.
 * Its outline fills a 14 × 16 tile rectangle, with the bottom-right block left
 * free for the parking lot. Its shape follows an outdoor kart track ("Karting
 * Club Lider" on Sketchfab, used only as a layout reference).
 */
export const TRACK_1: PieceId[] = [
  ...HOME_START, // main straight with the pits on the right, turn 1, the top straight
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
  ...HOME_END, // along the lot and onto the main straight
]

/** `n` straights in a row. */
const straights = (n: number): PieceId[] => Array(n).fill('S')

/**
 * Circuit 02, the mountain forest: long and flowing, almost all large
 * corners, out into the woods west of the paddock and back. 948 m, 16
 * corners. Being built: only in development until its venue is done.
 */
const TRACK_2: PieceId[] = [
  ...HOME_START, // the same start as Circuit 01: main straight, turn 1, the top straight
  ...straights(1), 'RL', 'LL', // a quick kink out of turn 2
  ...straights(2), 'RL', ...straights(1), 'LL', // esses, climbing into the trees
  ...straights(7), // back straight along the top of the hill
  'LL', ...straights(2), 'LL', // the carousel: a long 180° left out west
  ...straights(4), 'RL', ...straights(2), 'LL', // down off the hill
  ...straights(12), // east across the middle, into the infield
  'RL', ...straights(2), 'RL', // round, under the end of the main straight
  ...straights(15), // the long run west
  'LL', ...straights(4), 'LL', // a wide 180° left at the far end
  ...straights(11), // back east along the bottom
  'LS', 'S', 'S', 'RS', // up beside the parking lot, as on Circuit 01
  ...HOME_END,
]

/**
 * Circuit 03, the street circuit: tight and technical round the city blocks
 * west of the paddock, nearly all slow right-angle corners, with walls right
 * along the edge. 637 m, 16 corners. Being built: only in development.
 */
const TRACK_3: PieceId[] = [
  ...HOME_START, // the same start: main straight, turn 1, the top straight
  ...straights(2), 'RS', ...straights(3), 'LS', // up a side street
  ...straights(6), // the north avenue
  'LS', ...straights(2), 'RS', 'LS', // down, through a chicane
  ...straights(4), 'LS', ...straights(3), 'RS', ...straights(2), 'RS', // round the block
  ...straights(5), 'LS', ...straights(3), 'LS', // out west and back
  ...straights(4), 'RS', ...straights(3), 'LS', // one more block
  ...straights(6), // along the bottom
  'LS', 'S', 'S', 'RS', // up beside the parking lot, as on Circuit 01
  ...HOME_END,
]

export type Circuit = {
  /** Keys its records, ghost and leaderboard. Change it when the layout changes, so old times don't carry over. */
  id: string
  name: string
  layout: PieceId[]
  /** What's around it: the park (dusk, Racing Kit trees) or the mountain forest (morning, Nature Kit). See palette.ts. */
  venue: 'park' | 'forest' | 'city'
  /** A street circuit: concrete walls along the edge, no sand in the corners. */
  walls?: boolean
}

export const CIRCUITS: Circuit[] = [
  { id: 'lider-7', name: 'Circuit 01', layout: TRACK_1, venue: 'park' },
  ...(import.meta.env.DEV
    ? [
        { id: 'forest-1', name: 'Circuit 02', layout: TRACK_2, venue: 'forest' as const },
        { id: 'city-1', name: 'Circuit 03', layout: TRACK_3, venue: 'city' as const, walls: true },
      ]
    : []),
]

export const DEFAULT_CIRCUIT = CIRCUITS[0].id

export const circuitById = (id: string) => CIRCUITS.find((c) => c.id === id) ?? CIRCUITS[0]

/** The circuit `step` places along the list from `id`, wrapping round. */
export function nextCircuit(id: string, step: 1 | -1) {
  const i = CIRCUITS.findIndex((c) => c.id === id)
  return CIRCUITS[(i + step + CIRCUITS.length) % CIRCUITS.length].id
}

const circuitKey = 'kart-race:circuit'

/** The circuit picked last time, if it's still there. */
export function savedCircuit(): string {
  try {
    const id = localStorage.getItem(circuitKey)
    return CIRCUITS.some((c) => c.id === id) ? id! : DEFAULT_CIRCUIT
  } catch {
    return DEFAULT_CIRCUIT
  }
}

export function saveCircuit(id: string) {
  try {
    localStorage.setItem(circuitKey, id)
  } catch {
    // private mode etc: the choice just won't survive a reload
  }
}
