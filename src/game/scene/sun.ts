import * as THREE from 'three'

// Where the sun is. Used by the directional light (shadows) and the sky glow.
// Low-ish and to the side gives long, readable shadows.
export const SUN_DIRECTION = new THREE.Vector3(0.55, 0.75, 0.38).normalize()
