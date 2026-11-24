import * as THREE from 'three'

// Where the sun is. Used by the directional light (shadows) and the sky glow.
// Dusk: low over the horizon, so shadows are long, but high enough that they
// don't stretch across the whole track.
export const SUN_DIRECTION = new THREE.Vector3(-0.62, 0.46, 0.64).normalize()
