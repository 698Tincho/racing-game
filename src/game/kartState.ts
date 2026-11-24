import * as THREE from 'three'
import type { Surface } from './track/layout'

// Shared, mutable kart telemetry. Written every frame by <Kart />, read by the
// camera, lights, wheels and HUD. It's a plain object on purpose: putting
// per-frame values in React state (or zustand) would re-render 60x a second.
export const kartState = {
  // Where the kart is drawn this frame, smoothed between simulation steps.
  position: new THREE.Vector3(),
  yaw: 0, // heading in radians, 0 = facing +Z
  // The exact result of the last simulation step. Race rules read this one.
  sim: { position: new THREE.Vector3(), yaw: 0 },
  alpha: 1, // 0..1, how far this frame is between the last two simulation steps
  // Body movement on its suspension. The wheels stay on the road.
  pitch: 0,
  roll: 0,
  lift: 0,
  speed: 0, // forward speed in m/s (negative when reversing)
  throttle: 0, // pedal input: 1 accelerating, -1 braking or reversing, 0 none
  steer: 0, // smoothed steering input, -1 (right) .. 1 (left)
  grounded: true,
  teleports: 0, // bumped whenever the kart is moved instantly (grid, reset)
  slip: 0, // sideways sliding speed in m/s (drifting through corners)
  drift: 0, // 0..1, how far into a drift the kart is
  rearWheel: { x: 0.37, z: -0.72 }, // left rear tyre of the current car, for the smoke
  inPit: false, // on (or right beside) the pit lane
  limiter: false, // in the speed-limited part of the pit lane
  viewFocus: new THREE.Vector3(), // the point the camera is aiming at
  launch: 0, // 0..1, hard acceleration from low speed (wheelspin)
  impact: 0, // 0..1, spikes when hitting a wall, then fades out
  surface: 'road' as Surface, // what the kart is driving on
  rumble: 0, // 0..1, shaking from kerbs / rough ground
}

// Handy while developing: inspect `kartState` from the browser console.
if (import.meta.env.DEV) (window as unknown as { kartState: typeof kartState }).kartState = kartState
