import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { kartState } from '../kartState'
import { modelUrl } from '../assets'
import { PALETTE } from '../scene/palette'
import { frameStep } from '../time'

const POOL = 60
// Rear wheels relative to the kart (x = left/right, z = forward), meters.
const REAR_WHEELS = [
  { x: 0.42, z: -0.6 },
  { x: -0.42, z: -0.6 },
]

type Puff = { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; vel: THREE.Vector3; age: number; life: number; size: number }

/**
 * Little dust puffs from the rear wheels: when launching, scrubbing through
 * corners, or scraping a wall. A fixed pool of meshes is recycled, so nothing
 * is allocated while racing.
 */
export function Dust() {
  const { scene } = useGLTF(modelUrl('smoke'))
  const group = useRef<THREE.Group>(null)
  const carry = useRef(0)
  const next = useRef(0)

  const puffs = useMemo<Puff[]>(() => {
    let geometry: THREE.BufferGeometry | undefined
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) geometry = (o as THREE.Mesh).geometry
    })
    return Array.from({ length: POOL }, () => {
      const mat = new THREE.MeshStandardMaterial({
        color: PALETTE.dust,
        roughness: 1,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      })
      const mesh = new THREE.Mesh(geometry, mat)
      mesh.visible = false
      return { mesh, mat, vel: new THREE.Vector3(), age: 0, life: 1, size: 1 }
    })
  }, [scene])

  useFrame((_, delta) => {
    const dt = frameStep(delta)
    const { position, yaw, speed, slip, launch, impact, grounded, surface } = kartState
    const offRoad = surface === 'grass' || surface === 'gravel' ? THREE.MathUtils.clamp(Math.abs(speed) / 8, 0, 1) : 0

    // How many puffs per second right now.
    const rate = grounded
      ? THREE.MathUtils.clamp((slip - 2) / 4, 0, 1) * 28 + launch * 30 + impact * 60 + offRoad * (surface === 'gravel' ? 30 : 12)
      : 0
    carry.current += rate * dt
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)

    while (carry.current >= 1) {
      carry.current -= 1
      const p = puffs[next.current]
      next.current = (next.current + 1) % POOL
      const w = REAR_WHEELS[Math.random() < 0.5 ? 0 : 1]
      // Kart-local (x, z) to world, same convention as everywhere else.
      p.mesh.position.set(
        position.x + w.x * cos + w.z * sin,
        position.y + 0.15,
        position.z - w.x * sin + w.z * cos,
      )
      // Kicked backwards and up, plus a bit of random spread.
      p.vel.set(-sin * speed * 0.15 + (Math.random() - 0.5), 0.6 + Math.random() * 0.8, -cos * speed * 0.15 + (Math.random() - 0.5))
      p.age = 0
      p.life = 0.5 + Math.random() * 0.5
      p.size = 1.6 + Math.random() * 1.2
      p.mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0)
      p.mesh.visible = true
    }

    for (const p of puffs) {
      if (!p.mesh.visible) continue
      p.age += dt
      const k = p.age / p.life
      if (k >= 1) {
        p.mesh.visible = false
        continue
      }
      p.vel.multiplyScalar(Math.exp(-3 * dt))
      p.mesh.position.addScaledVector(p.vel, dt)
      p.mesh.scale.setScalar(p.size * (0.5 + k * 1.2))
      p.mat.opacity = 0.55 * (1 - k) * Math.min(1, k * 8)
    }
  })

  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <primitive key={i} object={p.mesh} />
      ))}
    </group>
  )
}

useGLTF.preload(modelUrl('smoke'))
