import * as THREE from 'three'

// Where the main light comes from. Used by the directional light (shadows)
// and the sky glow. Indoors it's the ceiling lights: nearly straight down,
// tilted a little so shadows still read.
export const SUN_DIRECTION = new THREE.Vector3(0.3, 1, 0.22).normalize()
