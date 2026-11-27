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

/**
 * A plain loop for trying out the circuit switch while the real second
 * circuit is designed: long straights out west and back. Only in development.
 */
const TEST_LOOP: PieceId[] = [
  ...HOME_START,
  'S', 'S', 'S', 'S', 'S', 'S', 'S', // on west along the top
  'LL', // down the far side
  'S', 'S', 'S', 'S', 'RS', 'LS', 'S', 'S', 'S', 'S', 'S', 'S', 'S', // a kink halfway down
  'LL', // back east along the bottom, below the parts tent
  'S', 'S', 'S', 'S', 'S', 'S', 'S',
  'LS', 'S', 'S', 'RS', // up beside the parking lot, as on Circuit 01
  ...HOME_END,
]

export type Circuit = {
  /** Keys its records, ghost and leaderboard. Change it when the layout changes, so old times don't carry over. */
  id: string
  name: string
  layout: PieceId[]
}

export const CIRCUITS: Circuit[] = [
  { id: 'lider-7', name: 'Circuit 01', layout: TRACK_1 },
  ...(import.meta.env.DEV ? [{ id: 'test-loop', name: 'Test loop', layout: TEST_LOOP }] : []),
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
