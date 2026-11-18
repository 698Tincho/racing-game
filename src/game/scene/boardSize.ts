import { track } from '../track/layout'

// The diorama board: a slab of grass and soil the whole circuit sits on.
export const BOARD_MARGIN = 30 // grass around the tyre walls, meters
export const BOARD_THICKNESS = 9

// Top of the board. The road is drawn a couple of centimeters above it.
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
