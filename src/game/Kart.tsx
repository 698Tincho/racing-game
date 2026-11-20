import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import {
  BallCollider,
  CoefficientCombineRule,
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { KartModel } from './KartModel'
import { WALL_OUTER, nearestOnTrack, surfaceFromNearest, track } from './track/layout'
import { kartState } from './kartState'
import { useGame } from './race/store'
import { TUNING as T } from './tuning'
import type { Controls } from './controls'
import { frameStep } from './time'

const SPAWN = { x: track.start.x, y: 1.2, z: track.start.z }
// The walls stop you well before this, so being further out means something went wrong.
const OFF_TRACK_DISTANCE = WALL_OUTER + 3

// Exponential smoothing that behaves the same at any frame rate.
const damp = (from: number, to: number, rate: number, dt: number) =>
  THREE.MathUtils.lerp(from, to, 1 - Math.exp(-rate * dt))
const moveToward = (from: number, to: number, step: number) =>
  from < to ? Math.min(from + step, to) : Math.max(from - step, to)
const clamp = THREE.MathUtils.clamp

/**
 * Arcade kart controller.
 *
 * Physics only sees a frictionless ball with locked rotation. Every frame we
 * read its velocity, split it into "forward" and "sideways" relative to the
 * kart's heading, apply engine/brake/grip to each part, and write it back.
 * The visible kart just follows the ball and is rotated to the heading.
 * Collisions (walls, cones, ramps) are still fully handled by Rapier.
 */
export function Kart() {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const { world, rapier } = useRapier()
  const [, getKeys] = useKeyboardControls<Controls>()

  const yaw = useRef(track.start.yaw)
  const steer = useRef(0)
  const prevSpeed = useRef(0)
  const pitch = useRef(0)
  const roll = useRef(0)

  const gridId = useRef(useGame.getState().gridId)
  const lastSetSpeed = useRef(0)

  const teleport = (rb: RapierRigidBody, x: number, z: number, heading: number) => {
    rb.setTranslation({ x, y: SPAWN.y, z }, true)
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    lastSetSpeed.current = 0
    yaw.current = heading
    steer.current = 0
    kartState.teleports++
  }

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = frameStep(delta)
    const keys = getKeys()
    const game = useGame.getState()

    // New lap (or back to menu): go to the grid.
    if (game.gridId !== gridId.current) {
      gridId.current = game.gridId
      teleport(rb, track.start.x, track.start.z, track.start.yaw)
    }

    // R, falling off the world, or somehow ending up behind the tyre walls:
    // back on the road at the closest point, facing the way the track goes.
    const here = rb.translation()
    const nearest = nearestOnTrack(here.x, here.z)
    const pressedReset = keys.reset && game.phase === 'racing'
    if (pressedReset || here.y < -10 || nearest.dist > OFF_TRACK_DISTANCE) {
      teleport(rb, nearest.x, nearest.z, nearest.yaw)
    }

    // You can only drive while a lap is running. During the countdown the
    // kart is held on the grid; after a qualy lap it brakes to a stop.
    const canDrive = game.phase === 'racing'
    const held = game.phase === 'countdown' || game.phase === 'menu'
    const throttle = canDrive ? Number(keys.forward) - Number(keys.back) : 0
    const surface = surfaceFromNearest(nearest)
    const steerInput = canDrive ? Number(keys.left) - Number(keys.right) : 0
    steer.current = damp(steer.current, steerInput, T.steerResponse, dt)

    const p = rb.translation()
    const v = rb.linvel()

    // Are we touching the ground? Cast a short ray straight down from the ball.
    const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(ray, T.radius + 0.25, true, undefined, undefined, undefined, rb)
    const grounded = hit !== null

    // Wall hit? Physics just took away a chunk of the speed we asked for last frame.
    const measured = Math.hypot(v.x, v.z)
    const lost = lastSetSpeed.current - measured
    if (game.phase === 'racing' && lost > 3) kartState.impact = Math.min(1, Math.max(kartState.impact, lost / 12))
    kartState.impact = Math.max(0, kartState.impact - dt * 2.5)

    // Split velocity into forward / sideways relative to the heading.
    let sin = Math.sin(yaw.current)
    let cos = Math.cos(yaw.current)
    let fwdSpeed = v.x * sin + v.z * cos
    let latSpeed = v.x * -cos + v.z * sin

    if (held) {
      fwdSpeed = 0
      latSpeed = 0
      rb.setLinvel({ x: 0, y: v.y, z: 0 }, true)
    } else if (grounded) {
      // Grass and gravel lower your top speed and grip, and bleed off any
      // extra speed you carried in: running wide costs time.
      const ground = T.surfaces[surface]
      const maxSpeed = T.maxSpeed * ground.maxSpeed
      if (throttle > 0) {
        if (fwdSpeed < 0) fwdSpeed = Math.min(0, fwdSpeed + T.brake * dt)
        else if (fwdSpeed < maxSpeed) {
          // Strong pull at low speed, tapering off near top speed.
          const curve = Math.max(0.1, 1 - (fwdSpeed / maxSpeed) ** 2)
          fwdSpeed = Math.min(maxSpeed, fwdSpeed + T.accel * ground.accel * curve * dt)
        }
      } else if (throttle < 0) {
        if (fwdSpeed > 0.5) fwdSpeed = Math.max(0, fwdSpeed - T.brake * dt)
        else fwdSpeed = Math.max(-T.maxReverse * ground.maxSpeed, fwdSpeed - T.reverseAccel * ground.accel * dt)
      } else if (game.phase === 'finished') {
        // Qualy lap done: pull up gently while the time is on screen.
        fwdSpeed = moveToward(fwdSpeed, 0, T.brake * 0.35 * dt)
      } else {
        fwdSpeed = moveToward(fwdSpeed, 0, T.coast * dt)
      }
      if (fwdSpeed > maxSpeed) fwdSpeed = moveToward(fwdSpeed, maxSpeed, ground.drag * dt)

      latSpeed *= Math.exp(-T.grip * ground.grip * dt)

      // You can only turn while moving; reversing flips the steering, like a car.
      const speedFactor = clamp(fwdSpeed / T.turnFullSpeedAt, -1, 1)
      const highSpeedLoss = 1 - T.highSpeedTurnLoss * clamp(Math.abs(fwdSpeed) / T.maxSpeed, 0, 1)
      yaw.current += steer.current * T.turnRate * speedFactor * highSpeedLoss * dt

      sin = Math.sin(yaw.current)
      cos = Math.cos(yaw.current)
      rb.setLinvel(
        {
          x: sin * fwdSpeed + -cos * latSpeed,
          y: v.y,
          z: cos * fwdSpeed + sin * latSpeed,
        },
        true,
      )
    }

    lastSetSpeed.current = Math.hypot(fwdSpeed, latSpeed)

    // --- Visuals ---------------------------------------------------------
    const accel = (fwdSpeed - prevSpeed.current) / dt
    prevSpeed.current = fwdSpeed

    // Tyre scrub for the dust: sliding sideways, or turning hard at speed.
    kartState.slip = grounded ? Math.abs(latSpeed) + Math.abs(steer.current) * Math.abs(fwdSpeed) * 0.2 : 0
    kartState.launch = grounded && throttle > 0 && fwdSpeed < 10 && fwdSpeed > 0.5 ? 1 - fwdSpeed / 10 : 0
    const speedNorm = clamp(Math.abs(fwdSpeed) / T.maxSpeed, 0, 1)
    pitch.current = damp(pitch.current, grounded ? clamp(-accel / 300, -0.06, 0.06) : 0, 8, dt)
    roll.current = damp(roll.current, grounded ? steer.current * speedNorm * 0.12 : 0, 8, dt)

    // Kerbs and rough ground make the kart buzz.
    const roughness = surface === 'kerb' ? 1 : surface === 'road' ? 0 : 0.45
    kartState.rumble = grounded ? roughness * clamp(Math.abs(fwdSpeed) / 12, 0, 1) : 0
    kartState.surface = surface

    if (visual.current && tilt.current) {
      visual.current.position.set(p.x, p.y - T.radius, p.z)
      visual.current.rotation.y = yaw.current
      tilt.current.rotation.set(pitch.current + (Math.random() - 0.5) * 0.025 * kartState.rumble, 0, roll.current)
      tilt.current.position.y = Math.random() * 0.04 * kartState.rumble
    }

    kartState.position.set(p.x, p.y - T.radius, p.z)
    kartState.yaw = yaw.current
    kartState.speed = fwdSpeed
    kartState.steer = steer.current
    kartState.grounded = grounded
  })

  return (
    <>
      <RigidBody
        ref={body}
        colliders={false}
        position={[SPAWN.x, SPAWN.y, SPAWN.z]}
        lockRotations
        ccd
        canSleep={false}
      >
        <BallCollider
          args={[T.radius]}
          friction={0}
          frictionCombineRule={CoefficientCombineRule.Min}
          restitution={0.1}
        />
      </RigidBody>

      <group ref={visual}>
        <group ref={tilt}>
          <KartModel />
        </group>
      </group>
    </>
  )
}
