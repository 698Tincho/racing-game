import { useLayoutEffect, useMemo, useRef } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { modelUrl } from '../assets'
import { BARRIER_HEIGHT, BARRIER_THICKNESS, GRAVEL_WIDTH, KERB_WIDTH, ROAD_HALF_WIDTH, nearestOnTrack, track } from './layout'
import { RoadMesh } from './RoadMesh'
import { FLOOR_Y, board } from '../scene/boardSize'

function FinishGate() {
  const { scene } = useGLTF(modelUrl('gate-finish'))
  // The kit gate is 1.55 wide; scale it up evenly so it spans the road + kerbs.
  const scale = (ROAD_HALF_WIDTH * 2 + 2) / 1.55
  return (
    <Clone
      object={scene}
      position={[track.finish.x, FLOOR_Y, track.finish.z]}
      rotation={[0, track.finish.yaw, 0]}
      scale={scale}
      castShadow
    />
  )
}

// Seeded random so trees are always in the same place.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TREE_SCALE = 5

function Trees() {
  const tree = useGLTF(modelUrl('tree')).scene
  const pine = useGLTF(modelUrl('tree-pine')).scene

  const trees = useMemo(() => {
    const rand = mulberry32(7)
    // Stay a few meters inside the board's edge, and behind the tyre walls.
    const inset = 4
    const clearance = ROAD_HALF_WIDTH + KERB_WIDTH + GRAVEL_WIDTH + 6
    const out: { x: number; z: number; s: number; r: number; pine: boolean }[] = []
    for (let tries = 0; out.length < 170 && tries < 8000; tries++) {
      const x = board.minX + inset + rand() * (board.width - inset * 2)
      const z = board.minZ + inset + rand() * (board.depth - inset * 2)
      if (nearestOnTrack(x, z).dist < clearance) continue
      if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 5)) continue
      out.push({ x, z, s: TREE_SCALE * (1 + rand() * 0.9), r: rand() * Math.PI * 2, pine: rand() > 0.45 })
    }
    return out
  }, [])

  return (
    <>
      {trees.map((t, i) => (
        <Clone
          key={i}
          object={t.pine ? pine : tree}
          position={[t.x, FLOOR_Y, t.z]}
          rotation={[0, t.r, 0]}
          scale={t.s}
          castShadow
        />
      ))}
    </>
  )
}

// Tyre walls: every tyre on the circuit is one instance of a single mesh,
// two rows high. Bottom row black, top row in red/white blocks.
const TYRE_ROWS = 2
const TYRE_SCALE = BARRIER_THICKNESS / 0.376 // kit tyre is 0.376 across
const TYRE_HEIGHT = 0.188 * TYRE_SCALE

function TyreWalls() {
  const { scene } = useGLTF(modelUrl('wheel-large'))
  const mesh = useRef<THREE.InstancedMesh>(null)

  const geometry = useMemo(() => {
    let g: THREE.BufferGeometry | undefined
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry
    })
    return g!
  }, [scene])

  const tyres = useMemo(() => track.barriers.flatMap((b) => b.tyres), [])
  const count = tyres.length * TYRE_ROWS

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const matrix = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const scale = new THREE.Vector3(TYRE_SCALE, TYRE_SCALE, TYRE_SCALE)
    const dark = new THREE.Color('#2a2c33')
    const red = new THREE.Color('#d93a2b')
    const white = new THREE.Color('#eeece6')
    let k = 0
    tyres.forEach((t, i) => {
      // The kit tyre stands on its edge; tip it over so it lies flat.
      q.setFromEuler(new THREE.Euler(0, t.yaw, Math.PI / 2))
      for (let row = 0; row < TYRE_ROWS; row++) {
        matrix.compose(new THREE.Vector3(t.x, FLOOR_Y + TYRE_HEIGHT * (row + 0.5), t.z), q, scale)
        m.setMatrixAt(k, matrix)
        m.setColorAt(k, row === 0 ? dark : Math.floor(i / 4) % 2 === 0 ? red : white)
        k++
      }
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [tyres])

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  )
}

export function Track() {
  const { minX, maxX, minZ, maxZ } = track.bounds
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  return (
    <>
      <RoadMesh />
      <TyreWalls />
      <FinishGate />
      <Trees />

      {/* Physics: flat ground everywhere, plus invisible walls along the tyres */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(maxX - minX) / 2 + 30, 0.5, (maxZ - minZ) / 2 + 30]} position={[cx, -0.5, cz]} />
        {track.barriers.flatMap((b, bi) =>
          b.segments.map((w, i) => (
            <CuboidCollider
              key={`${bi}-${i}`}
              args={[BARRIER_THICKNESS / 2, BARRIER_HEIGHT / 2, w.length / 2]}
              position={[w.x, BARRIER_HEIGHT / 2 - 0.2, w.z]}
              rotation={[0, w.yaw, 0]}
            />
          )),
        )}
      </RigidBody>
    </>
  )
}

useGLTF.preload(modelUrl('gate-finish'))
useGLTF.preload(modelUrl('tree'))
useGLTF.preload(modelUrl('tree-pine'))
useGLTF.preload(modelUrl('wheel-large'))
