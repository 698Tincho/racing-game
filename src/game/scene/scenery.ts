import { WALL_OUTER, nearestOnTrack, track } from '../track/layout'
import { board } from './boardSize'

/**
 * What stands inside the hall around the track: grandstands along the wall
 * by the main straight, pit garages along the opposite wall, flags at the
 * line. Anything that would land on (or too close to) the track is left out.
 *
 * The main straight runs along x = 0 towards +z, next to the hall's +x wall.
 */

/** Model size in kit units (width along its local x, depth along local z). */
const SIZES: Record<string, [number, number]> = {
  grandStandCovered: [1, 1.02],
  grandStand: [1, 1],
  pitsGarage: [1, 1.09],
  pitsOffice: [1, 1.04],
  flagCheckers: [0.2, 0.04],
  flagRed: [0.2, 0.04],
  flagGreen: [0.2, 0.04],
}

export const BUILDING_SCALE = 4.5 // one kit tile = 4.5 m

export type Placement = {
  model: string
  x: number
  z: number
  /** Direction the model's front faces (yaw, three.js convention). */
  yaw: number
  scale: number
  /** Footprint in metres. */
  width: number
  depth: number
}

const FACE_MINUS_X = -Math.PI / 2 // against the +x wall, looking into the hall
const FACE_PLUS_X = Math.PI / 2

function place(model: string, x: number, z: number, yaw: number, scale = BUILDING_SCALE): Placement {
  const [w, d] = SIZES[model] ?? [1, 1]
  return { model, x, z, yaw, scale, width: w * scale, depth: d * scale }
}

/** Keep only placements whose whole footprint stays clear of the track walls. */
function clear(p: Placement, margin = 0.8) {
  const c = Math.cos(p.yaw)
  const s = Math.sin(p.yaw)
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
    const ox = (lx * p.width) / 2
    const oz = (lz * p.depth) / 2
    const x = p.x + ox * c + oz * s
    const z = p.z - ox * s + oz * c
    if (nearestOnTrack(x, z).dist < WALL_OUTER + margin) return false
  }
  return true
}

const WALL_CLEARANCE = 0.6 // room for the hall's columns

function buildScenery(): Placement[] {
  const S = BUILDING_SCALE
  const out: Placement[] = []
  const finishZ = track.finish.z

  // Along the +x wall, facing the main straight: a run of covered grandstands.
  const standX = board.maxX - WALL_CLEARANCE - (1.02 * S) / 2
  for (let i = -3; i <= 3; i++) out.push(place('grandStandCovered', standX, finishZ + i * S, FACE_MINUS_X))

  // Along the -x wall: the pit garages, an office at each end.
  const pitX = board.minX + WALL_CLEARANCE + (1.09 * S) / 2
  const pitZ = board.centerZ
  out.push(place('pitsOffice', pitX, pitZ - 3.5 * S, FACE_PLUS_X))
  for (let i = -3; i <= 2; i++) out.push(place('pitsGarage', pitX, pitZ + (i + 0.5) * S, FACE_PLUS_X))
  out.push(place('pitsOffice', pitX, pitZ + 3.5 * S, FACE_PLUS_X))

  // Flags just outside the walls at the start/finish line.
  out.push(place('flagCheckers', WALL_OUTER + 0.6, finishZ, FACE_MINUS_X, 2.6))
  out.push(place('flagCheckers', -(WALL_OUTER + 0.6), finishZ, FACE_PLUS_X, 2.6))
  out.push(place('flagGreen', WALL_OUTER + 0.6, finishZ - 10, FACE_MINUS_X, 2.6))
  out.push(place('flagRed', WALL_OUTER + 0.6, finishZ + 10, FACE_MINUS_X, 2.6))

  return out.filter((p) => clear(p, p.model.startsWith('flag') ? 0 : 0.8))
}

export const scenery = buildScenery()

/** True if (x, z) is on or within `pad` metres of a building's footprint. */
export function nearScenery(x: number, z: number, pad: number) {
  return scenery.some((p) => {
    const dx = x - p.x
    const dz = z - p.z
    // Into the model's own frame.
    const c = Math.cos(p.yaw)
    const s = Math.sin(p.yaw)
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    return Math.abs(lx) < p.width / 2 + pad && Math.abs(lz) < p.depth / 2 + pad
  })
}
