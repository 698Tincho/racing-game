import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from './palette'
import { SUN_DIRECTION } from './sun'

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 top;
  uniform vec3 mid;
  uniform vec3 horizon;
  uniform vec3 bottom;
  uniform vec3 glow;
  uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0
      ? mix(mix(horizon, mid, smoothstep(0.0, 0.2, h)), top, smoothstep(0.14, 0.62, h))
      : mix(horizon, bottom, smoothstep(0.0, -0.25, h));
    // Soft warm halo around the sun.
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += glow * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 0.8);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

/** Gradient sky dome that always surrounds the camera (the kit has no sky, so this is drawn in code). */
export function Sky() {
  const dome = useRef<THREE.Mesh>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          top: { value: new THREE.Color(PALETTE.skyTop) },
          mid: { value: new THREE.Color(PALETTE.skyMid) },
          horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
          bottom: { value: new THREE.Color(PALETTE.skyBottom) },
          glow: { value: new THREE.Color(PALETTE.sunGlow) },
          sunDir: { value: SUN_DIRECTION.clone() },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  )

  useFrame(({ camera }) => {
    dome.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[500, 32, 16]} />
    </mesh>
  )
}
