import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { kartState } from './kartState'
import { FRAME_ORDER, SIM_DT, frameStep } from './time'

// Keeps rounding errors in the frame time from delaying a step by a whole frame.
const EPSILON = 1e-9

/**
 * Runs the simulation in fixed steps, as many as the time since the last frame
 * calls for. Each step runs Kart and RaceDirector through Rapier's before/after
 * step hooks. Renders nothing.
 */
export function SimLoop() {
  const { step } = useRapier()
  const accumulator = useRef(0)

  useFrame((_, delta) => {
    accumulator.current += frameStep(delta)
    while (accumulator.current >= SIM_DT - EPSILON) {
      step(SIM_DT)
      accumulator.current -= SIM_DT
    }
    kartState.alpha = Math.min(Math.max(accumulator.current / SIM_DT, 0), 1)
  }, FRAME_ORDER.simulation)

  return null
}
