import { useRef } from 'react'
import { useAfterPhysicsStep } from '@react-three/rapier'
import * as THREE from 'three'
import { kartState } from '../kartState'
import { nearestOnTrack, track } from '../track/layout'
import { pitLane } from '../track/pitLane'
import { race, useGame } from './store'
import { recordFrame, resetRecorder } from './ghostLap'
import { SIM_DT } from '../time'
import { crossing, passCheckpoints } from './lapProgress'

// The start/finish line also reaches across the pit lane, which passes it too.
const FINISH_HALF_WIDTH = 16

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * Runs the race rules every simulation step: countdown, out-lap, lap timer,
 * checkpoints, finish line and the "wrong way" warning. Sector and lap times
 * use the exact moment within the step that the kart crossed the line. Taking
 * the pit lane skips the checkpoints it bypasses. In practice, crossing the
 * line starts the next lap straight away; in qualy too, until the last lap.
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
        const n = nearestOnTrack(pos.x, pos.z)
        if (race.nextCheckpoint < cps.length) {
          // By their lines, or by your place along the track (see lapProgress).
          for (const { index, at } of passCheckpoints(race.nextCheckpoint, prev.current, pos, track.path[n.index].s)) {
            const sector = track.sectorEnds.indexOf(index)
            if (sector !== -1) game.completeSector(sector, at !== null ? timeAt(at) : race.time)
            race.nextCheckpoint = index + 1
          }
        } else {
          const at = crossing(track.finish, prev.current, pos, FINISH_HALF_WIDTH)
          if (at !== null) game.finishLap(timeAt(at))
        }

        race.wrongWay = !kartState.inPit && kartState.speed > 2 && Math.abs(wrapAngle(kartState.sim.yaw - n.yaw)) > 1.9
        break
      }

    }

    prev.current.copy(pos)
  })

  return null
}
