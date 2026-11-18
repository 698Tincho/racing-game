import { track } from '../track/layout'
import { ROAD_SURFACE_Y } from '../track/pieces'
import { TRACK_SCALE } from '../track/layout'

// The diorama board: a slab of grass and soil the whole track sits on.
export const BOARD_MARGIN = 26 // grass around the track's bounding box, meters
export const BOARD_THICKNESS = 7

// Top of the board = bottom of the track tiles.
export const FLOOR_Y = -ROAD_SURFACE_Y * TRACK_SCALE

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
