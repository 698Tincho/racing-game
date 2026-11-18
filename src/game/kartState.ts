import * as THREE from 'three'

// Shared, mutable kart telemetry. Written every frame by <Kart />, read by the
// camera, lights, wheels and HUD. It's a plain object on purpose: putting
// per-frame values in React state (or zustand) would re-render 60x a second.
export const kartState = {
  position: new THREE.Vector3(),
  yaw: 0, // heading in radians, 0 = facing +Z
  speed: 0, // forward speed in m/s (negative when reversing)
  steer: 0, // smoothed steering input, -1 (right) .. 1 (left)
  grounded: true,
  teleports: 0, // bumped whenever the kart is moved instantly (grid, reset)
  slip: 0, // sideways sliding speed in m/s (drifting through corners)
  launch: 0, // 0..1, hard acceleration from low speed (wheelspin)
  impact: 0, // 0..1, spikes when hitting a wall, then fades out
}

// Handy while developing: inspect `kartState` from the browser console.
if (import.meta.env.DEV) (window as unknown as { kartState: typeof kartState }).kartState = kartState
