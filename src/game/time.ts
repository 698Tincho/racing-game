// Rapier (timeStep="vary") steps the world by the frame time clamped to 0.5 s.
// Everything that advances with time (kart controls, lap timer, camera, wheels)
// uses the same clamp, so the lap timer always matches what physics simulated,
// even when the frame rate stutters.
export const MAX_STEP = 0.5
export const frameStep = (delta: number) => Math.min(delta, MAX_STEP)
