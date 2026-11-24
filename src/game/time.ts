// The longest frame we try to catch up on after a stutter.
export const MAX_STEP = 0.5
export const frameStep = (delta: number) => Math.min(delta, MAX_STEP)

// Driving, physics and the lap timer always advance in steps of this size, so
// the same driving gives the same lap time on any screen. Drawing still runs at
// the screen's rate, smoothly in between steps (see kartState.alpha).
export const SIM_DT = 1 / 60

// useFrame order: lower runs first. Negative values don't take over rendering.
export const FRAME_ORDER = { simulation: -2, kartPose: -1 } as const
