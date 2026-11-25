import type * as THREE from 'three'
import { WALL_OUTER, nearestOnTrack, track, type Pose } from '../track/layout'

// How far sideways from a checkpoint's center you can be and still count as
// crossing its line. Reaches out to the tyre walls on the straights.
export const LINE_HALF_WIDTH = WALL_OUTER + 1

/**
 * Did the kart go from behind the line to in front of it this step?
 * Returns how far through the step it crossed (0..1), or null if it didn't.
 */
export function crossing(line: Pose, from: THREE.Vector3, to: THREE.Vector3, halfWidth = LINE_HALF_WIDTH) {
  const fx = Math.sin(line.yaw)
  const fz = Math.cos(line.yaw)
  const before = (from.x - line.x) * fx + (from.z - line.z) * fz
  const after = (to.x - line.x) * fx + (to.z - line.z) * fz
  const side = Math.abs((to.x - line.x) * fz - (to.z - line.z) * fx)
  if (!(before < 0 && after >= 0 && side < halfWidth)) return null
  return before / (before - after)
}

/** How far round the lap (metres from the line) the closest point of the track to (x, z) is. */
export const lapDistance = (x: number, z: number) => track.path[nearestOnTrack(x, z).index].s

/** Each checkpoint's distance round the lap. */
const CHECKPOINT_S = track.checkpoints.map((c) => lapDistance(c.x, c.z))

/**
 * A checkpoint also counts once your place along the track has gone past it,
 * by up to this much, without its line being crossed: running wide into a
 * corner's run-off (wider than the line reaches), or being put back on the
 * track (R, or after going far off), would otherwise miss it, and then the
 * finish wouldn't count until a whole extra lap. Kept short, so cutting
 * across the infield to a later part of the track still doesn't count.
 */
const CATCH_UP = 15 // metres

/**
 * The checkpoints passed this step, starting from `next`, in order. `at` is how
 * far through the step its line was crossed, or null when it counted because
 * your place along the track (`lapS`, from lapDistance) went past it.
 */
export function passCheckpoints(next: number, from: THREE.Vector3, to: THREE.Vector3, lapS: number) {
  const passed: { index: number; at: number | null }[] = []
  const cps = track.checkpoints
  while (next < cps.length) {
    const at = crossing(cps[next], from, to)
    const past = lapS - CHECKPOINT_S[next]
    if (at === null && !(past >= 0 && past <= CATCH_UP)) break
    passed.push({ index: next, at })
    next++
  }
  return passed
}
