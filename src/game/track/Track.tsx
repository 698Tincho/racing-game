import { useLayoutEffect, useMemo, useRef } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { modelUrl } from '../assets'
import {
  BARRIER_HEIGHT,
  BARRIER_THICKNESS,
  BARRIER_VISUAL_HEIGHT,
  BLOCK_LENGTH,
  WALL_OUTER,
  nearestOnTrack,
  offsetLeft,
  pointOnPiece,
  track,
} from './layout'
import { PIECES } from './pieces'
import { RoadMesh } from './RoadMesh'
import { useRacingModel } from '../kit'
import { FLOOR_Y } from '../scene/boardSize'

const GATE_MODEL = 'overheadLights'
// The start gantry's posts are 0.13 wide with a 1.0 gap between them.
// Scale it so the gap clears both walls, plus a little.
const GATE_SCALE = 2 * WALL_OUTER + 0.4
const GATE_POST_HALF = 0.065 * GATE_SCALE
const GATE_POST_OFFSET = (0.5 + 0.065) * GATE_SCALE

function FinishGate() {
  const scene = useRacingModel(GATE_MODEL)
  const { x, z, yaw } = track.finish
  return (
    <group position={[x, FLOOR_Y, z]} rotation={[0, yaw, 0]}>
      <Clone object={scene} scale={GATE_SCALE} />
      {/* Solid posts, so you can't drive through them. */}
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((side) => (
          <CuboidCollider
            key={side}
            args={[GATE_POST_HALF, 3, GATE_POST_HALF * 1.2]}
            position={[side * GATE_POST_OFFSET, 3, 0]}
          />
        ))}
      </RigidBody>
    </group>
  )
}

/**
 * The red/white block walls lining the whole track: every block on the
 * circuit is one instance of a single rounded box, alternating colours.
 */
function BlockWalls() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(
    () => new RoundedBoxGeometry(BARRIER_THICKNESS, BARRIER_VISUAL_HEIGHT, BLOCK_LENGTH * 1.04, 3, 0.12),
    [],
  )
  const blocks = useMemo(() => track.barriers.flatMap((b) => b.blocks), [])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const matrix = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const red = new THREE.Color('#e0352b')
    const white = new THREE.Color('#f4f2ec')
    let n = 0
    for (const barrier of track.barriers) {
      barrier.blocks.forEach((b, i) => {
        q.setFromEuler(new THREE.Euler(0, b.yaw, 0))
        matrix.compose(new THREE.Vector3(b.x, FLOOR_Y + BARRIER_VISUAL_HEIGHT / 2, b.z), q, one)
        m.setMatrixAt(n, matrix)
        m.setColorAt(n, i % 2 === 0 ? red : white)
        n++
      })
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [])

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, blocks.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.45} />
    </instancedMesh>
  )
}

// Tyre stacks: little piles of old tyres behind the walls on the outside of
// corners, where you'd fly off. Decoration only.
const TYRE_DIAMETER = 0.75
const TYRE_SCALE = TYRE_DIAMETER / 0.376 // kit tyre is 0.376 across
const TYRE_HEIGHT = 0.188 * TYRE_SCALE

function TyreStacks() {
  const { scene } = useGLTF(modelUrl('wheel-large'))
  const mesh = useRef<THREE.InstancedMesh>(null)

  const geometry = useMemo(() => {
    let g: THREE.BufferGeometry | undefined
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry
    })
    return g!
  }, [scene])

  const tyres = useMemo(() => {
    const out: { x: number; z: number; y: number; r: number }[] = []
    for (const piece of track.pieces) {
      const def = PIECES[piece.id]
      if (def.corner === 'none') continue
      const outside = -Math.sign(def.exit.turn)
      const mid = pointOnPiece(piece, 0.5)
      // A cluster of three stacks, a little behind the wall.
      for (const [along, out2, height] of [[0, 1.0, 3], [0.85, 1.25, 2], [-0.85, 1.3, 2]] as const) {
        const base = offsetLeft(mid, outside * (WALL_OUTER + 0.2 + out2 * TYRE_DIAMETER))
        const x = base.x + Math.sin(mid.yaw) * along
        const z = base.z + Math.cos(mid.yaw) * along
        // Skip stacks that would land on or next to another bit of track.
        if (nearestOnTrack(x, z).dist < WALL_OUTER + TYRE_DIAMETER / 2) continue
        for (let h = 0; h < height; h++) out.push({ x, z, y: FLOOR_Y + TYRE_HEIGHT * (h + 0.5), r: h * 0.7 + along })
      }
    }
    return out
  }, [])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const matrix = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const scale = new THREE.Vector3(TYRE_SCALE, TYRE_SCALE, TYRE_SCALE)
    tyres.forEach((t, i) => {
      // The kit tyre stands on its edge; tip it over so it lies flat.
      q.setFromEuler(new THREE.Euler(0, t.r, Math.PI / 2))
      matrix.compose(new THREE.Vector3(t.x, t.y, t.z), q, scale)
      m.setMatrixAt(i, matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [tyres])

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, tyres.length]} castShadow receiveShadow>
      <meshStandardMaterial color="#26282e" roughness={0.85} />
    </instancedMesh>
  )
}

export function Track() {
  return (
    <>
      <RoadMesh />
      <BlockWalls />
      <TyreStacks />
      <FinishGate />

      {/* Physics: the floor, plus invisible walls along the blocks */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[200, 0.5, 200]} position={[0, -0.5, 0]} />
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

useRacingModel.preload(GATE_MODEL)
useGLTF.preload(modelUrl('wheel-large'))
