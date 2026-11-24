import * as THREE from 'three'
import { kartState } from '../kartState'

// Slip (m/s) where the tyres start to complain, and where they're fully sliding.
const SCRUB_START = 4.5
const SCRUB_FULL = 8.5

/** 0..1, how hard the tyres are sliding. Shared by the skid sound and the smoke. */
export const tyreScrub = () =>
  kartState.grounded ? Math.max(kartState.drift, THREE.MathUtils.smoothstep(kartState.slip, SCRUB_START, SCRUB_FULL)) : 0
