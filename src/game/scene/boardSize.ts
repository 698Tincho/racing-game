import { track } from '../track/layout'

// The kart hall: a floor slab with walls around the circuit.
// (Still called `board`: it's the diorama base everything sits on.)
export const BOARD_MARGIN = 9 // floor between the outermost walls and the hall walls, meters
export const BOARD_THICKNESS = 3
export const HALL_HEIGHT = 9

// Top of the floor. The road is drawn a couple of centimeters above it.
export const FLOOR_Y = 0

const { minX, maxX, minZ, maxZ } = track.bounds
export const board = {
  minX: minX - BOARD_MARGIN,
  maxX: maxX + BOARD_MARGIN,
  minZ: minZ - BOARD_MARGIN,
  maxZ: maxZ + BOARD_MARGIN,
  centerX: (minX + maxX) / 2,
  centerZ: (minZ + maxZ) / 2,
  width: maxX - minX + BOARD_MARGIN * 2,
  depth: maxZ - minZ + BOARD_MARGIN * 2,
}
