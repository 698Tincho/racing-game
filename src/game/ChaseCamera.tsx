import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { kartState } from './kartState'
import { TUNING as T } from './tuning'
import { frameStep } from './time'
import { useGame } from './race/store'
import { board } from './scene/boardSize'

const desired = new THREE.Vector3()
const lookAt = new THREE.Vector3()

const ORBIT_SPEED = 0.06 // rad/s
const ORBIT_RADIUS = Math.max(board.width, board.depth) * 0.62
const ORBIT_HEIGHT = Math.max(board.width, board.depth) * 0.3

/**
 * Racing: follows behind the kart with a little lag, widens the FOV with
 * speed so going fast feels fast, and shakes on wall hits.
 * Menu / results: slowly flies around the whole diorama.
 */
export function ChaseCamera() {
  const look = useRef(new THREE.Vector3(0, 1, 5))
  const lastTeleport = useRef(-1)
  const orbitAngle = useRef(0.6)

  useFrame((state, delta) => {
    const cam = state.camera as THREE.PerspectiveCamera
    const dt = frameStep(delta)
    const { phase } = useGame.getState()
    let targetFov = T.baseFov

    if (phase === 'menu' || phase === 'results') {
      orbitAngle.current += ORBIT_SPEED * dt
      const a = orbitAngle.current
      desired.set(board.centerX + Math.cos(a) * ORBIT_RADIUS, ORBIT_HEIGHT, board.centerZ + Math.sin(a) * ORBIT_RADIUS)
      lookAt.set(board.centerX, -4, board.centerZ)
      cam.position.lerp(desired, 1 - Math.exp(-1.5 * dt))
      look.current.lerp(lookAt, 1 - Math.exp(-1.5 * dt))
      lastTeleport.current = -1 // cut straight to the kart when the race starts
    } else {
      const { position, yaw, speed } = kartState
      const fx = Math.sin(yaw)
      const fz = Math.cos(yaw)
      desired.set(position.x - fx * T.camDistance, position.y + T.camHeight, position.z - fz * T.camDistance)
      lookAt.set(position.x + fx * 2, position.y + 0.8, position.z + fz * 2)

      if (kartState.teleports !== lastTeleport.current) {
        // The kart jumped (new lap, reset): cut straight to it instead of flying over.
        lastTeleport.current = kartState.teleports
        cam.position.copy(desired)
        look.current.copy(lookAt)
      } else {
        cam.position.lerp(desired, 1 - Math.exp(-T.camFollow * dt))
        look.current.lerp(lookAt, 1 - Math.exp(-T.camFollow * 2 * dt))
      }

      // Wall hit: a quick, fading shake.
      const shake = kartState.impact * kartState.impact * 0.45 + kartState.rumble * 0.04
      if (shake > 0.001) {
        cam.position.x += (Math.random() - 0.5) * shake
        cam.position.y += (Math.random() - 0.5) * shake
        cam.position.z += (Math.random() - 0.5) * shake
      }
      targetFov += T.speedFov * THREE.MathUtils.clamp(Math.abs(speed) / T.maxSpeed, 0, 1)
    }

    cam.lookAt(look.current)
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-4 * dt))
    cam.updateProjectionMatrix()
  })

  return null
}
