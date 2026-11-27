import { useMemo } from 'react'
import * as THREE from 'three'
import { trackAsphalt, useRacingPiece } from '../kit'
import { PIT_LANE_HALF_WIDTH, PIT_LANE_Y, pitLane } from '../track/pitLane'
import { ROAD_HALF_WIDTH, nearestOnTrack, offsetLeft, perTrack } from '../track/layout'
import { PALETTE } from './palette'

const LIMIT_LINE = 0.4

/** How many metres at each end the lane's outer edge takes to peel away from the track's edge. */
const PEEL = 14
/** How far the lane's asphalt tucks under the track's, so no seam shows. */
const TUCK = 0.3
/** Never pave further than this from the lane's centreline. */
const MAX_REACH = 16
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * How far the asphalt reaches either side of the lane's centreline, per
 * sample. Mostly the lane's half-width, but at each end it meets the track
 * flush: its outer edge starts on the track's edge and peels away smoothly,
 * and on the track side it's paved right across to the track until the wall
 * between them starts, so no strip of run-off shows in between.
 */
function laneWidths() {
  const { path, trackSideWall } = pitLane
  const n = path.length
  const left = path.map(() => PIT_LANE_HALF_WIDTH)
  const right = path.map(() => PIT_LANE_HALF_WIDTH)
  for (const end of [0, n - 1]) {
    const inward = end === 0 ? 1 : -1
    // Which side of the track the lane is on, at this end.
    const lane = nearestOnTrack(path[end + inward * 30].x, path[end + inward * 30].z).side
    // How far a point is from the track's centreline, counted positive on the lane's side.
    const out = (q: { x: number; z: number }) => {
      const near = nearestOnTrack(q.x, q.z)
      return near.side === lane ? near.dist : -near.dist
    }
    for (let k = 0; k < n / 2; k++) {
      const i = end + inward * k
      const p = path[i]
      // The edge away from the track: pull it in onto the track's edge at the very end.
      if (k < PEEL) {
        const edge = out(offsetLeft(p, -PIT_LANE_HALF_WIDTH))
        const wanted = ROAD_HALF_WIDTH + (edge - ROAD_HALF_WIDTH) * smoothstep(k / PEEL)
        right[i] = PIT_LANE_HALF_WIDTH - Math.max(0, edge - Math.max(wanted, ROAD_HALF_WIDTH))
      }
      // The edge towards the track: pave across to it, up to where the wall starts.
      if (trackSideWall[i]) break
      // (Searching out until it's under the track's asphalt, since the two meet at an angle.)
      const under = (reach: number) => out(offsetLeft(p, reach)) <= ROAD_HALF_WIDTH - TUCK
      if (under(PIT_LANE_HALF_WIDTH)) continue
      let lo = PIT_LANE_HALF_WIDTH
      let hi = MAX_REACH
      if (!under(hi)) continue
      while (hi - lo > 0.05) {
        const mid = (lo + hi) / 2
        if (under(mid)) hi = mid
        else lo = mid
      }
      left[i] = hi
    }
  }
  return { left, right }
}

/** A flat strip along the lane's centreline, `left` and `right` metres either side of each sample. */
function ribbon(left: number[], right: number[], y: number) {
  const { path } = pitLane
  const position: number[] = []
  const index: number[] = []
  path.forEach((p, i) => {
    const l = offsetLeft(p, left[i])
    const r = offsetLeft(p, -right[i])
    position.push(l.x, y, l.z, r.x, y, r.z)
    if (i > 0) {
      const a = (i - 1) * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

/** The lane's asphalt, built once per circuit (where it meets the track depends on the corners). */
const laneSurface = perTrack(() => {
  const { left, right } = laneWidths()
  return ribbon(left, right, PIT_LANE_Y)
})

/** Where the speed limit starts and ends. */
function limitLines() {
  const limited = pitLane.path.filter((p) => p.limiter)
  return [limited[0], limited[limited.length - 1]]
}

/** The pit lane's asphalt, the same as the track's, plus its limiter lines. */
export function PitLaneSurface() {
  const road = useRacingPiece('roadStraight')
  // The same dark asphalt as the track: it's a lane you drive, not run-off.
  const asphalt = useMemo(() => {
    let found: THREE.Material | null = null
    road.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && (mesh.material as THREE.Material).name === 'road') found = mesh.material as THREE.Material
    })
    return trackAsphalt(found!)
  }, [road])

  const surface = laneSurface()

  return (
    <>
      <mesh geometry={surface} material={asphalt} receiveShadow />
      {limitLines().map((p, i) => (
        <mesh key={i} position={[p.x, PIT_LANE_Y + 0.003, p.z]} rotation-y={p.yaw} receiveShadow>
          <boxGeometry args={[PIT_LANE_HALF_WIDTH * 2, 0.002, LIMIT_LINE]} />
          <meshStandardMaterial color={PALETTE.lotLine} roughness={0.8} />
        </mesh>
      ))}
    </>
  )
}
