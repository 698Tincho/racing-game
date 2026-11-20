import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { kartState } from '../kartState'
import { WALL_OUTER, nearestOnTrack, track, type Pose } from '../track/layout'
import { race, useGame } from './store'
import { recordFrame, resetRecorder } from './ghostLap'
import { frameStep } from '../time'

// How far sideways from a checkpoint's center you can be and still count as
// crossing it. Reaches out to the tyre walls, so running wide still counts.
const LINE_HALF_WIDTH = WALL_OUTER + 1

/** Did the kart go from behind the line to in front of it this frame? */
function crossed(line: Pose, from: THREE.Vector3, to: THREE.Vector3) {
  const fx = Math.sin(line.yaw)
  const fz = Math.cos(line.yaw)
  const before = (from.x - line.x) * fx + (from.z - line.z) * fz
  const after = (to.x - line.x) * fx + (to.z - line.z) * fz
  const side = Math.abs((to.x - line.x) * fz - (to.z - line.z) * fx)
  return before < 0 && after >= 0 && side < LINE_HALF_WIDTH
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * Runs the race rules every frame: countdown, lap timer, checkpoints, finish
 * line and the "wrong way" warning. In practice, crossing the line starts the
 * next lap straight away; in qualy the store stops and waits. Renders nothing.
 */
export function RaceDirector() {
  const prev = useRef(new THREE.Vector3().copy(kartState.position))
  const lastTeleport = useRef(kartState.teleports)

  useFrame((_, delta) => {
    // Same clamped step as the kart, so the timer matches the simulation even
    // if the frame rate drops.
    const dt = frameStep(delta)
    const game = useGame.getState()
    const pos = kartState.position

    // After a teleport (grid reset), don't treat the jump as driving.
    if (kartState.teleports !== lastTeleport.current) {
      lastTeleport.current = kartState.teleports
      prev.current.copy(pos)
    }

    switch (game.phase) {
      case 'countdown':
        race.countdown -= dt
        if (race.countdown <= 0) {
          race.countdown = 0
          race.time = 0
          resetRecorder()
          useGame.setState({ phase: 'racing' })
        }
        break

      case 'racing': {
        race.time += dt
        race.sinceLap += dt
        recordFrame(race.time, { x: pos.x, z: pos.z, yaw: kartState.yaw, speed: kartState.speed, steer: kartState.steer })
        const cps = track.checkpoints
        if (race.nextCheckpoint < cps.length) {
          if (crossed(cps[race.nextCheckpoint], prev.current, pos)) {
            const sector = track.sectorEnds.indexOf(race.nextCheckpoint)
            if (sector !== -1) game.completeSector(sector, race.time)
            race.nextCheckpoint++
          }
        } else if (crossed(track.finish, prev.current, pos)) {
          game.finishLap(race.time)
        }

        const n = nearestOnTrack(pos.x, pos.z)
        race.wrongWay = kartState.speed > 2 && Math.abs(wrapAngle(kartState.yaw - n.yaw)) > 1.9
        break
      }

      // 'finished' (qualy): nothing to do, the screen waits for Enter.
    }

    prev.current.copy(pos)
  })

  return null
}
