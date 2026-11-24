import { useLayoutEffect, useMemo, useRef } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { trackAsphalt, useRacingModel, useRacingPiece } from '../kit'
import { BARRIER_HEIGHT, BARRIER_LENGTH, BARRIER_THICKNESS, ROAD_HALF_WIDTH, RUNOFF_Y, TILE, inPitWall, nearestOnTrack, track, type PlacedPiece } from './layout'
import { PIECES } from './pieces'
import { nearPitLane, pitLane } from './pitLane'
import { FLOOR_Y } from '../scene/boardSize'

/**
 * The circuit, entirely from Kenney's Racing Kit: road tiles snapped
 * together, red/white kerbs on the corners, and lines of red and white
 * barrier blocks along both sides. Plus the invisible physics walls.
 */
export function Track() {
  return (
    <>
      {track.pieces.map((p) => (
        <RoadPiece key={p.index} piece={p} />
      ))}
      <RunOff />
      <Barriers />

      {/* Physics: the ground, plus invisible walls along the barriers */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[400, 0.5, 400]} position={[0, -0.5, 0]} />
        {track.barriers.flatMap((b, bi) =>
          // (The pit lane runs through where the barrier would be.)
          b.segments.filter((w) => !nearPitLane(w.x, w.z)).map((w, i) => (
            <CuboidCollider
              key={`${bi}-${i}`}
              args={[BARRIER_THICKNESS / 2, BARRIER_HEIGHT / 2, w.length / 2]}
              position={[w.x, BARRIER_HEIGHT / 2 - 0.2, w.z]}
              rotation={[0, w.yaw, 0]}
            />
          )),
        )}
        {pitLane.walls.segments.map((w, i) => (
          <CuboidCollider
            key={`pit-${i}`}
            args={[BARRIER_THICKNESS / 2, BARRIER_HEIGHT / 2, w.length / 2]}
            position={[w.x, BARRIER_HEIGHT / 2 - 0.2, w.z]}
            rotation={[0, w.yaw, 0]}
          />
        ))}
      </RigidBody>
    </>
  )
}

// The kit's road surface is already at y = 0, where the car's wheels are. Its
// grass strips are 0.08 m below that and its kerbs 0.08 m above.
const ROAD_Y = 0
// In tiles. The sand comes in at the road tile's grass height (0.08 m down);
// lift it to just under the road, above the run-off, so it all looks flat.
const SAND_LIFT = 0.071 / TILE

/** One road piece and its kerbs, placed so its entry sits on the piece's pose. */
function RoadPiece({ piece }: { piece: PlacedPiece }) {
  const def = PIECES[piece.id]
  const { entry } = def
  return (
    <group position={[piece.pose.x, ROAD_Y, piece.pose.z]} rotation-y={piece.pose.yaw - entry.yaw} scale={TILE}>
      <group position={[-entry.x, 0, -entry.z]}>
        <KitPiece name={def.model} piece={piece} />
        {def.kerbs
          // Where the pit lane crosses a corner's outside kerb, that kerb comes out.
          .filter((k) => k.endsWith('Inner') || !pitLane.kerbless.has(piece.index))
          .map((k) => (
            <KitPiece key={k} name={k} />
          ))}
        {piece.sand && def.sand && (
          <group position-y={SAND_LIFT}>
            <KitPiece name={def.sand} />
          </group>
        )}
      </group>
    </group>
  )
}

/** A kit model on the road grid. Given `piece`, it's that piece's road tile, restyled (see restyleRoad). */
function KitPiece({ name, piece }: { name: string; piece?: PlacedPiece }) {
  const scene = useRacingPiece(name)
  const clone = useMemo(() => {
    const copy = scene.clone()
    if (name === 'roadStart') removeBuiltInArch(copy)
    if (piece) restyleRoad(copy, piece)
    return copy
  }, [scene, name, piece])
  return <primitive object={clone} />
}

/**
 * The road tile as the track wants it, flat with the run-off: no grass strips
 * (RunOff paves out to the barriers), darker asphalt than the run-off, and
 * none of the raised white lines along its edges. Paint on the road itself
 * (the start line, the grid boxes) stays.
 */
function restyleRoad(root: THREE.Object3D, piece: PlacedPiece) {
  const { entry } = PIECES[piece.id]
  // The same placement RoadPiece gives the tile, to find each triangle on the track.
  const place = new THREE.Matrix4()
    .makeTranslation(piece.pose.x, ROAD_Y, piece.pose.z)
    .multiply(new THREE.Matrix4().makeRotationY(piece.pose.yaw - entry.yaw))
    .multiply(new THREE.Matrix4().makeScale(TILE, TILE, TILE))
    .multiply(new THREE.Matrix4().makeTranslation(-entry.x, 0, -entry.z))
  root.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
  })
  const road = meshes.find((m) => (m.material as THREE.Material).name === 'road')?.material as THREE.Material | undefined
  for (const mesh of meshes) {
    const material = mesh.material as THREE.Material
    if (material.name === 'grass') mesh.visible = false
    if (!road) continue
    if (material.name === 'road') mesh.material = trackAsphalt(road)
    if (material.name !== 'grey' || !mesh.geometry.index) continue

    // Keep the grey painted on the asphalt; drop the raised edge lines beside it.
    const toWorld = place.clone().multiply(mesh.matrixWorld)
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.index
    const v = new THREE.Vector3()
    const centre = new THREE.Vector3()
    const paint: number[] = []
    for (let t = 0; t < index.count; t += 3) {
      const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      centre.set(0, 0, 0)
      for (const i of tri) centre.add(v.fromBufferAttribute(position, i).applyMatrix4(toWorld))
      centre.divideScalar(3)
      if (nearestOnTrack(centre.x, centre.z).dist < ROAD_HALF_WIDTH - 0.2) paint.push(...tri)
    }
    mesh.geometry = mesh.geometry.clone()
    mesh.geometry.setIndex(paint)
  }
}

/** Anything higher than this (in tiles) on the start piece is its arch. */
const ROAD_TOP = 0.02

/** The start tile has an arch fused to it. StartLights puts a real gantry there instead. */
function removeBuiltInArch(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const v = new THREE.Vector3()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    if (!index) return
    const low = (i: number) => v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).y <= ROAD_TOP
    const kept: number[] = []
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      if (low(a) && low(b) && low(c)) kept.push(a, b, c)
    }
    mesh.geometry = mesh.geometry.clone()
    mesh.geometry.setIndex(kept)
  })
}

/**
 * Asphalt from the road's edges out to the barriers, so the barriers are the
 * track limits: the area between the outer and inner barrier lines, a touch
 * below the road (and below the sand, which sits on top of it).
 */
function RunOff() {
  const road = useRacingPiece('roadStraight')
  const asphalt = useMemo(() => {
    let found: THREE.Material | null = null
    road.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && (mesh.material as THREE.Material).name === 'road') found = mesh.material as THREE.Material
    })
    return found!
  }, [road])
  const geometry = useMemo(() => {
    // In the shape's plane, (x, -z), so turning it flat puts it back at (x, z).
    const flat = (line: { x: number; z: number }[]) => line.map((p) => new THREE.Vector2(p.x, -p.z))
    const [a, b] = track.barriers.map((barrier) => flat(barrier.line))
    const [outer, inner] = Math.abs(THREE.ShapeUtils.area(a)) > Math.abs(THREE.ShapeUtils.area(b)) ? [a, b] : [b, a]
    const shape = new THREE.Shape(outer)
    shape.holes.push(new THREE.Path(inner))
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    g.translate(0, RUNOFF_Y, 0)
    return g
  }, [])
  return <mesh geometry={geometry} material={asphalt} receiveShadow />
}

/** A small gap between blocks, like the kit's own layouts. */
const BLOCK_GAP = 0.02 * TILE

type Block = { x: number; z: number; yaw: number }

/** Lines of barrier blocks along both sides and along the pit lane, alternating red and white. */
function Barriers() {
  const red = useRacingModel('barrierRed')
  const white = useRacingModel('barrierWhite')

  const [reds, whites] = useMemo(() => {
    const r: Block[] = []
    const w: Block[] = []
    const lay = (line: { x: number; z: number }[], closed: boolean, skip: (x: number, z: number) => boolean) => {
      let carry = 0
      let n = 0
      for (let i = 0; i < (closed ? line.length : line.length - 1); i++) {
        const a = line[i]
        const c = line[(i + 1) % line.length]
        const len = Math.hypot(c.x - a.x, c.z - a.z)
        const yaw = Math.atan2(c.x - a.x, c.z - a.z)
        let d = carry
        while (d < len) {
          const u = d / len
          const block = { x: a.x + (c.x - a.x) * u, z: a.z + (c.z - a.z) * u, yaw }
          if (!skip(block.x, block.z)) (n % 2 === 0 ? r : w).push(block)
          n++
          d += BARRIER_LENGTH + BLOCK_GAP
        }
        carry = d - len
      }
    }
    // The pits have a concrete wall instead (see scenery.ts), and the pit lane cuts through.
    for (const b of track.barriers) lay(b.line, true, (x, z) => inPitWall(x, z) || nearPitLane(x, z))
    for (const line of pitLane.walls.visible) lay(line, false, () => false)
    return [r, w]
  }, [])

  return (
    <>
      <BlockInstances model={red} blocks={reds} />
      <BlockInstances model={white} blocks={whites} />
    </>
  )
}

/** One instanced mesh per part of a barrier block model. */
function BlockInstances({ model, blocks }: { model: THREE.Object3D; blocks: Block[] }) {
  const parts = useMemo(() => {
    model.updateMatrixWorld(true)
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = []
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) out.push({ geometry: m.geometry, material: m.material as THREE.Material, matrix: m.matrixWorld.clone() })
    })
    return out
  }, [model])
  return (
    <>
      {parts.map((p, i) => (
        <BlockPart key={i} {...p} blocks={blocks} />
      ))}
    </>
  )
}

function BlockPart({
  geometry,
  material,
  matrix,
  blocks,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrix: THREE.Matrix4
  blocks: Block[]
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const place = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const scale = new THREE.Vector3(TILE, TILE, TILE)
    blocks.forEach((b, i) => {
      // The block's long side is its local x; turn it to run along the line.
      q.setFromAxisAngle(up, b.yaw + Math.PI / 2)
      place.compose(new THREE.Vector3(b.x, FLOOR_Y, b.z), q, scale)
      m.setMatrixAt(i, place.multiply(matrix))
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [blocks, matrix])
  return <instancedMesh ref={mesh} args={[geometry, material, blocks.length]} castShadow receiveShadow />
}

for (const id of new Set(track.pieces.map((p) => p.id))) {
  useRacingPiece.preload(PIECES[id].model)
  for (const k of PIECES[id].kerbs) useRacingPiece.preload(k)
}
for (const p of track.pieces) if (p.sand) useRacingPiece.preload(PIECES[p.id].sand!)
useRacingModel.preload('barrierRed')
useRacingModel.preload('barrierWhite')
