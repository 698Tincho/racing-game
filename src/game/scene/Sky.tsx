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
  uniform vec3 horizon;
  uniform vec3 bottom;
  uniform vec3 glow;
  uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0
      ? mix(horizon, top, smoothstep(0.0, 0.55, h))
      : mix(horizon, bottom, smoothstep(0.0, -0.25, h));
    // Soft warm halo around the sun.
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += glow * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 0.8);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

/** Gradient sky dome that always surrounds the camera, plus a few drifting clouds. */
export function Sky() {
  const dome = useRef<THREE.Mesh>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          top: { value: new THREE.Color(PALETTE.skyTop) },
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
    <>
      <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[500, 32, 16]} />
      </mesh>
      <Clouds />
    </>
  )
}

// Low-poly puffy clouds: a few flat-shaded blobs per cloud, in a slow-turning ring.
function Clouds() {
  const group = useRef<THREE.Group>(null)

  const clouds = useMemo(() => {
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    return Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + rand() * 0.3
      // Well outside the menu camera's orbit so it never flies through one.
      const radius = 300 + rand() * 150
      return {
        position: [Math.cos(angle) * radius, 60 + rand() * 50, Math.sin(angle) * radius] as const,
        scale: 9 + rand() * 8,
        puffs: Array.from({ length: 3 + Math.floor(rand() * 3) }, (_, j) => ({
          x: (j - 1.5) * 1.3 + rand() * 0.6,
          y: rand() * 0.5,
          z: rand() * 0.8 - 0.4,
          r: 0.9 + rand() * 0.7,
        })),
      }
    })
  }, [])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.004
  })

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={c.position} scale={c.scale}>
          {c.puffs.map((p, j) => (
            <mesh key={j} position={[p.x, p.y, p.z]} scale={[p.r, p.r * 0.75, p.r]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={PALETTE.cloud} flatShading fog={false} emissive="#e8f3ff" emissiveIntensity={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
