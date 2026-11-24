import { useRef } from 'react'
import { useAfterPhysicsStep } from '@react-three/rapier'
import * as THREE from 'three'
import { kartState } from '../kartState'
import { WALL_OUTER, nearestOnTrack, track, type Pose } from '../track/layout'
import { pitLane } from '../track/pitLane'
import { race, useGame } from './store'
import { recordFrame, resetRecorder } from './ghostLap'
import { SIM_DT } from '../time'

// How far sideways from a checkpoint's center you can be and still count as
// crossing it. Reaches out to the tyre walls, so running wide still counts.
const LINE_HALF_WIDTH = WALL_OUTER + 1
// The start/finish line also reaches across the pit lane, which passes it too.
const FINISH_HALF_WIDTH = 16

/**
 * Did the kart go from behind the line to in front of it this step?
 * Returns how far through the step it crossed (0..1), or null if it didn't.
 */
function crossing(line: Pose, from: THREE.Vector3, to: THREE.Vector3, halfWidth = LINE_HALF_WIDTH) {
  const fx = Math.sin(line.yaw)
  const fz = Math.cos(line.yaw)
  const before = (from.x - line.x) * fx + (from.z - line.z) * fz
  const after = (to.x - line.x) * fx + (to.z - line.z) * fz
  const side = Math.abs((to.x - line.x) * fz - (to.z - line.z) * fx)
  if (!(before < 0 && after >= 0 && side < halfWidth)) return null
  return before / (before - after)
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * Runs the race rules every simulation step: countdown, out-lap, lap timer,
 * checkpoints, finish line and the "wrong way" warning. Sector and lap times
 * use the exact moment within the step that the kart crossed the line. Taking
 * the pit lane skips the checkpoints it bypasses. In practice, crossing the
 * line starts the next lap straight away; in qualy the store stops and waits.
 * Renders nothing.
 */
export function RaceDirector() {
  const prev = useRef(new THREE.Vector3().copy(kartState.sim.position))
  const lastTeleport = useRef(kartState.teleports)

  useAfterPhysicsStep(() => {
    const dt = SIM_DT
    const game = useGame.getState()
    const pos = kartState.sim.position

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

      case 'outlap': {
        // Out of the pits and once round: the timed lap starts at the line.
        if (!race.leftPits && !kartState.inPit) race.leftPits = true
        const at = race.leftPits ? crossing(track.finish, prev.current, pos, FINISH_HALF_WIDTH) : null
        if (at !== null) {
          race.time = dt * (1 - at)
          race.nextCheckpoint = 0
          race.sectorStart = 0
          resetRecorder()
          useGame.setState({ phase: 'racing' })
        }
        break
      }

      case 'racing': {
        race.time += dt
        race.sinceLap += dt
        recordFrame(race.time, { x: pos.x, z: pos.z, yaw: kartState.sim.yaw, speed: kartState.speed, steer: kartState.steer })
        const timeAt = (fraction: number) => race.time - dt * (1 - fraction)
        const cps = track.checkpoints
        // The pit lane goes round these, so they count as passed.
        while (kartState.inPit && race.nextCheckpoint < cps.length && pitLane.bypassed.has(race.nextCheckpoint)) {
          race.nextCheckpoint++
        }
        if (race.nextCheckpoint < cps.length) {
          const at = crossing(cps[race.nextCheckpoint], prev.current, pos)
          if (at !== null) {
            const sector = track.sectorEnds.indexOf(race.nextCheckpoint)
            if (sector !== -1) game.completeSector(sector, timeAt(at))
            race.nextCheckpoint++
          }
        } else {
          const at = crossing(track.finish, prev.current, pos, FINISH_HALF_WIDTH)
          if (at !== null) game.finishLap(timeAt(at))
        }

        const n = nearestOnTrack(pos.x, pos.z)
        race.wrongWay = !kartState.inPit && kartState.speed > 2 && Math.abs(wrapAngle(kartState.sim.yaw - n.yaw)) > 1.9
        break
      }

      // 'finished' (qualy): nothing to do, the screen waits for Enter.
    }

    prev.current.copy(pos)
  })

  return null
}
