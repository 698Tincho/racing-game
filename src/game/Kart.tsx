import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import {
  BallCollider,
  CoefficientCombineRule,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { KartModel } from './KartModel'
import { ROAD_HALF_WIDTH, RUNOFF_Y, WALL_OUTER, nearestOnTrack, surfaceFromNearest, track } from './track/layout'
import { PIECES } from './track/pieces'
import { PIT_LANE_HALF_WIDTH, PIT_LANE_Y, PIT_SPEED, pitLane, pitNearest } from './track/pitLane'
import { kartState } from './kartState'
import { useGame } from './race/store'
import { TUNING as T } from './tuning'
import type { Controls } from './controls'
import { FRAME_ORDER, SIM_DT } from './time'

const SPAWN = { x: track.start.x, y: 1.2, z: track.start.z }
// The walls stop you well before this, so being further out means something went wrong.
const OFF_TRACK_DISTANCE = WALL_OUTER + 3
// How high each surface is drawn relative to the road, in metres.
const SURFACE_HEIGHT = { road: 0, runoff: RUNOFF_Y, kerb: 0.08, grass: -0.08, gravel: -0.08, pit: PIT_LANE_Y } as const
// How hard the pit limiter slows you to the limit, m/s².
const LIMITER_BRAKE = 30

// Exponential smoothing that behaves the same at any frame rate.
const damp = (from: number, to: number, rate: number, dt: number) =>
  THREE.MathUtils.lerp(from, to, 1 - Math.exp(-rate * dt))
const moveToward = (from: number, to: number, step: number) =>
  from < to ? Math.min(from + step, to) : Math.max(from - step, to)
const clamp = THREE.MathUtils.clamp

/**
 * Arcade kart controller.
 *
 * Physics only sees a frictionless ball with locked rotation. Every simulation
 * step we read its velocity, split it into "forward" and "sideways" relative to
 * the kart's heading, apply engine/brake/grip to each part, and write it back.
 * The visible kart follows the ball, smoothed between steps, and is rotated to
 * the heading. Collisions (walls, cones, ramps) are still fully handled by Rapier.
 */
export function Kart() {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const { world, rapier } = useRapier()
  const [, getKeys] = useKeyboardControls<Controls>()

  const yaw = useRef(track.start.yaw)
  const steer = useRef(0)
  const drift = useRef(0)
  const prevSpeed = useRef(0)
  const pitch = useRef(0)
  const roll = useRef(0)
  const rideHeight = useRef(0)

  const gridId = useRef(useGame.getState().gridId)
  const lastSetSpeed = useRef(0)

  // The pose one step ago, to draw smoothly between steps.
  const previous = useRef({ position: new THREE.Vector3(SPAWN.x, SPAWN.y - T.radius, SPAWN.z), yaw: track.start.yaw })
  const snap = useRef(true) // the kart jumped: don't smooth across it

  useLayoutEffect(() => {
    kartState.sim.position.copy(previous.current.position)
    kartState.sim.yaw = previous.current.yaw
  }, [])

  const teleport = (rb: RapierRigidBody, x: number, z: number, heading: number) => {
    rb.setTranslation({ x, y: SPAWN.y, z }, true)
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    lastSetSpeed.current = 0
    yaw.current = heading
    steer.current = 0
    drift.current = 0
    snap.current = true
    kartState.teleports++
  }

  useBeforePhysicsStep(() => {
    const rb = body.current
    if (!rb) return
    const dt = SIM_DT
    const keys = getKeys()
    const game = useGame.getState()

    previous.current.position.copy(kartState.sim.position)
    previous.current.yaw = kartState.sim.yaw

    // New lap (or back to menu): go to the grid, or to your pit box for a qualifying out-lap.
    if (game.gridId !== gridId.current) {
      gridId.current = game.gridId
      const start = game.phase === 'outlap' ? pitLane.box : track.start
      teleport(rb, start.x, start.z, start.yaw)
    }

    // R, falling off the world, or somehow ending up behind the tyre walls:
    // back on the road at the closest point, facing the way the track goes.
    const here = rb.translation()
    const nearest = nearestOnTrack(here.x, here.z)
    const pit = pitNearest(here.x, here.z)
    const inPit = pit.dist < PIT_LANE_HALF_WIDTH + 2
    const driving = game.phase === 'racing' || game.phase === 'outlap'
    const pressedReset = keys.reset && driving
    if (pressedReset || here.y < -10 || (!inPit && nearest.dist > OFF_TRACK_DISTANCE)) {
      teleport(rb, nearest.x, nearest.z, nearest.yaw)
    }

    // You can only drive while a lap is running. During the countdown the
    // kart is held on the grid; after a qualy lap it brakes to a stop.
    const canDrive = driving
    const held = game.phase === 'countdown' || game.phase === 'menu'
    const throttle = canDrive ? Number(keys.forward) - Number(keys.back) : 0
    let surface = surfaceFromNearest(nearest)
    // The outside kerb where the pit lane crosses it isn't there: it's run-off.
    if (surface === 'kerb' && nearest.side !== PIECES[track.pieces[track.path[nearest.index].piece].id].corner?.inside) {
      if (pitLane.kerbless.has(track.path[nearest.index].piece)) surface = 'runoff'
    }
    // Off the track's own asphalt and on the lane: the pit lane (and its limiter).
    if (surface !== 'kerb' && nearest.dist > ROAD_HALF_WIDTH + 0.15 && pit.dist <= PIT_LANE_HALF_WIDTH + 0.3) surface = 'pit'
    const limiter = surface === 'pit' && pitLane.path[pit.index].limiter
    const steerInput = canDrive ? Number(keys.left) - Number(keys.right) : 0
    steer.current = damp(steer.current, steerInput, T.steerResponse, dt)

    const p = rb.translation()
    const v = rb.linvel()

    // Are we touching the ground? Cast a short ray straight down from the ball.
    const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(ray, T.radius + 0.25, true, undefined, undefined, undefined, rb)
    const grounded = hit !== null

    // Wall hit? Physics just took away a chunk of the speed we asked for last step.
    const measured = Math.hypot(v.x, v.z)
    const lost = lastSetSpeed.current - measured
    if (game.phase === 'racing' && lost > 3) kartState.impact = Math.min(1, Math.max(kartState.impact, lost / 12))
    kartState.impact = Math.max(0, kartState.impact - dt * 2.5)

    // Split velocity into forward / sideways relative to the heading.
    let sin = Math.sin(yaw.current)
    let cos = Math.cos(yaw.current)
    let fwdSpeed = v.x * sin + v.z * cos
    let latSpeed = v.x * -cos + v.z * sin

    // Full steering and throttle at speed on tarmac: the back steps out.
    const onTarmac = surface !== 'grass' && surface !== 'gravel'
    const wantsDrift =
      grounded && !held && onTarmac && throttle > 0
        ? THREE.MathUtils.smoothstep(Math.abs(steer.current), 0.6, 0.92) *
          THREE.MathUtils.smoothstep(fwdSpeed / T.maxSpeed, T.driftFromSpeed, T.driftFromSpeed + 0.25)
        : 0
    const driftRate = wantsDrift > drift.current ? T.driftBuild : T.driftRelease
    drift.current = moveToward(drift.current, wantsDrift, driftRate * dt)

    if (held) {
      fwdSpeed = 0
      latSpeed = 0
      rb.setLinvel({ x: 0, y: v.y, z: 0 }, true)
    } else if (grounded) {
      // Grass and gravel lower your top speed and grip, and bleed off any
      // extra speed you carried in: running wide costs time.
      const ground = T.surfaces[surface]
      const maxSpeed = limiter ? Math.min(PIT_SPEED, T.maxSpeed * ground.maxSpeed) : T.maxSpeed * ground.maxSpeed
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
      } else if (game.phase === 'results') {
        // Qualy run done: pull up gently while the results come up.
        fwdSpeed = moveToward(fwdSpeed, 0, T.brake * 0.35 * dt)
      } else {
        fwdSpeed = moveToward(fwdSpeed, 0, T.coast * dt)
      }
      if (fwdSpeed > maxSpeed) fwdSpeed = moveToward(fwdSpeed, maxSpeed, (limiter ? LIMITER_BRAKE : ground.drag) * dt)

      // Drifting: less sideways grip, a bit more rotation, and sliding scrubs off speed.
      const driftGrip = 1 - drift.current * (1 - T.driftGrip)
      latSpeed *= Math.exp(-T.grip * ground.grip * driftGrip * dt)
      fwdSpeed -= Math.abs(latSpeed) * drift.current * T.driftScrub * dt

      // You can only turn while moving; reversing flips the steering, like a car.
      const speedFactor = clamp(fwdSpeed / T.turnFullSpeedAt, -1, 1)
      const highSpeedLoss = 1 - T.highSpeedTurnLoss * clamp(Math.abs(fwdSpeed) / T.maxSpeed, 0, 1)
      const driftTurn = 1 + T.driftTurn * drift.current
      yaw.current += steer.current * T.turnRate * speedFactor * highSpeedLoss * driftTurn * dt

      const oldSin = sin
      const oldCos = cos
      sin = Math.sin(yaw.current)
      cos = Math.cos(yaw.current)

      // With grip, the kart goes where its nose points. Drifting, it keeps
      // travelling the way it was going while the nose turns: that's the slide.
      if (drift.current > 0) {
        const worldX = oldSin * fwdSpeed - oldCos * latSpeed
        const worldZ = oldCos * fwdSpeed + oldSin * latSpeed
        fwdSpeed = THREE.MathUtils.lerp(fwdSpeed, worldX * sin + worldZ * cos, drift.current)
        latSpeed = THREE.MathUtils.lerp(latSpeed, worldX * -cos + worldZ * sin, drift.current)
      }

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

    // --- Telemetry for the visuals and sound ------------------------------
    const accel = (fwdSpeed - prevSpeed.current) / dt
    prevSpeed.current = fwdSpeed

    // Tyre scrub for the smoke: sliding sideways, or turning hard at speed.
    kartState.slip = grounded ? Math.abs(latSpeed) + Math.abs(steer.current) * Math.abs(fwdSpeed) * 0.2 : 0
    kartState.launch = grounded && throttle > 0 && fwdSpeed < 10 && fwdSpeed > 0.5 ? 1 - fwdSpeed / 10 : 0
    const speedNorm = clamp(Math.abs(fwdSpeed) / T.maxSpeed, 0, 1)
    // Nose lifts when you accelerate, dips when you brake.
    pitch.current = damp(pitch.current, grounded ? clamp(-accel / 250, -0.07, 0.07) : 0, 8, dt)
    // Body rolls to the outside of the turn.
    roll.current = damp(roll.current, grounded ? steer.current * speedNorm * 0.15 : 0, 8, dt)

    // Kerbs and rough ground make the kart buzz.
    const roughness = surface === 'kerb' ? 1 : surface === 'grass' || surface === 'gravel' ? 0.45 : 0
    kartState.rumble = grounded ? roughness * clamp(Math.abs(fwdSpeed) / 12, 0, 1) : 0
    kartState.surface = surface
    kartState.inPit = inPit
    kartState.limiter = limiter
    // Physics is one flat plane; the wheels follow the real surface height.
    rideHeight.current = damp(rideHeight.current, SURFACE_HEIGHT[surface], 18, dt)

    kartState.speed = fwdSpeed
    kartState.throttle = throttle
    kartState.steer = steer.current
    kartState.drift = drift.current
    kartState.grounded = grounded
  })

  // Publish where this step ended up, for the race rules and for drawing.
  useAfterPhysicsStep(() => {
    const rb = body.current
    if (!rb) return
    const p = rb.translation()
    kartState.sim.position.set(p.x, p.y - T.radius, p.z)
    kartState.sim.yaw = yaw.current
    if (snap.current) {
      snap.current = false
      previous.current.position.copy(kartState.sim.position)
      previous.current.yaw = yaw.current
    }
  })

  // Every rendered frame: draw the kart between the last two simulation steps.
  useFrame(() => {
    const { sim, alpha, rumble } = kartState
    kartState.position.lerpVectors(previous.current.position, sim.position, alpha)
    kartState.yaw = THREE.MathUtils.lerp(previous.current.yaw, sim.yaw, alpha)
    kartState.pitch = pitch.current + (Math.random() - 0.5) * 0.025 * rumble
    kartState.roll = roll.current
    kartState.lift = Math.random() * 0.04 * rumble

    if (visual.current) {
      visual.current.position.copy(kartState.position)
      visual.current.position.y += rideHeight.current
      visual.current.rotation.y = kartState.yaw
    }
  }, FRAME_ORDER.kartPose)

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
        <KartModel />
      </group>
    </>
  )
}
