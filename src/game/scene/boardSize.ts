import { onTrackChange, track } from '../track/layout'

// The site around the circuit: the area the scenery (sheds, paddock, trees)
// is laid out in. The grass itself runs on to the horizon.
// (Still called `board`, from when the game was a floating diorama.)
export const BOARD_MARGIN = 30 // meters around the outermost tyre walls

// Top of the open grass, where everything beside the track stands. The road
// surface is y = 0, the grass strips on the road tiles are at -0.08, and this
// sits just under them so the two never flicker.
export const FLOOR_Y = -0.12

function measure() {
  const { minX, maxX, minZ, maxZ } = track.bounds
  return {
    minX: minX - BOARD_MARGIN,
    maxX: maxX + BOARD_MARGIN,
    minZ: minZ - BOARD_MARGIN,
    maxZ: maxZ + BOARD_MARGIN,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX + BOARD_MARGIN * 2,
    depth: maxZ - minZ + BOARD_MARGIN * 2,
  }
}

/** The selected circuit's site. */
export let board = measure()
onTrackChange(() => (board = measure()))
