import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { trackAsphalt, useRacingModel, useRacingPiece, useRacingPieces } from '../kit'
import { BARRIER_HEIGHT, BARRIER_LENGTH, BARRIER_THICKNESS, RUNOFF_Y, TILE, inPitWall, perTrack, selectedCircuit, track } from './layout'
import { circuitById } from './circuits'
import { mergeParts, partsOf, type StaticPart } from '../scene/mergeStatic'
import { PIECES } from './pieces'
import { nearPitLane, pitLane } from './pitLane'
import { FLOOR_Y } from '../scene/boardSize'

/**
 * The circuit, entirely from Kenney's Racing Kit: road tiles snapped
 * together, red/white kerbs on the corners, and lines of red and white
 * barrier blocks along both sides. Plus the invisible physics walls.
 */
export const Track = memo(function Track() {
  return (
    <>
      <TrackSurface />
      <RunOff />
      <Barriers />
      <TrackColliders />
    </>
  )
})

/** Physics: the ground, plus invisible walls along the barriers and the pit lane. */
function TrackColliders() {
  const walls = useMemo(collisionWalls, [])
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[400, 0.5, 400]} position={[0, -0.5, 0]} />
      {walls.map((w, i) => (
        <CuboidCollider
          key={i}
          args={[BARRIER_THICKNESS / 2, BARRIER_HEIGHT / 2, w.length / 2]}
          position={[w.x, BARRIER_HEIGHT / 2 - 0.2, w.z]}
          rotation={[0, w.yaw, 0]}
        />
      ))}
    </RigidBody>
  )
}

// (The pit lane runs through where the track's barrier would be.)
const collisionWalls = () => [...track.barriers.flatMap((b) => b.segments.filter((w) => !nearPitLane(w.x, w.z))), ...pitLane.walls.segments]

// The kit's road surface is already at y = 0, where the car's wheels are. Its
// grass strips are 0.08 m below that and its kerbs 0.08 m above.
const ROAD_Y = 0
// In tiles. The sand comes in at the road tile's grass height (0.08 m down);
// lift it to just under the road, above the run-off, so it all looks flat.
const SAND_LIFT = 0.071 / TILE
/** Anything higher than this (in metres) on the start piece is its arch. */
const ROAD_TOP = 0.16
/** Grey closer than this (in tiles) to a straight's centreline is paint on the road; further out it's the raised edge line. */
const PAINT_REACH = 0.325

/** Every kit model the road uses: tiles, kerbs and sand. */
const surfaceModels = perTrack(() => [
  ...new Set(
    track.pieces.flatMap((p) => {
      const def = PIECES[p.id]
      return [def.model, ...def.kerbs, ...(p.sand && def.sand ? [def.sand] : [])]
    }),
  ),
])

/**
 * The road, kerbs and sand: every tile of the lap baked into one mesh per
 * material, so the whole circuit draws in a few calls. Built once per circuit.
 */
function TrackSurface() {
  const models = surfaceModels()
  const scenes = useRacingPieces(models)
  const meshes = useMemo(() => surfaceOf(new Map(models.map((name, i) => [name, scenes[i]]))), [models, scenes])
  return (
    <>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </>
  )
}

/**
 * The tiles as the track wants them, flat with the run-off: no grass strips
 * (RunOff paves out to the barriers), darker asphalt than the run-off, and
 * none of the raised white lines along their edges. Paint on the road itself
 * (the start line, the grid boxes) stays. The start tile loses its built-in
 * arch (StartLights puts a real gantry there), and where the pit lane crosses
 * a corner's outside kerb, that kerb comes out.
 */
const surfaces = new WeakMap<object, THREE.Mesh[]>()
function surfaceOf(scenes: Map<string, THREE.Object3D>) {
  if (!surfaces.has(track)) surfaces.set(track, buildSurface(scenes))
  return surfaces.get(track)!
}

function buildSurface(scenes: Map<string, THREE.Object3D>) {
  const parts: StaticPart[] = []
  const toLocal = new THREE.Matrix4()
  const centre = new THREE.Vector3()
  for (const piece of track.pieces) {
    const def = PIECES[piece.id]
    const { entry } = def
    // Where the piece's entry sits on its pose, the same as the kit lays tiles out.
    const place = new THREE.Matrix4()
      .makeTranslation(piece.pose.x, ROAD_Y, piece.pose.z)
      .multiply(new THREE.Matrix4().makeRotationY(piece.pose.yaw - entry.yaw))
      .multiply(new THREE.Matrix4().makeScale(TILE, TILE, TILE))
      .multiply(new THREE.Matrix4().makeTranslation(-entry.x, 0, -entry.z))
    const local = toLocal.clone().copy(place).invert()

    for (const part of partsOf(scenes.get(def.model)!, place, (m) => (m.name === 'grass' ? null : m.name === 'road' ? trackAsphalt(m) : m))) {
      const arch = def.model === 'roadStart'
      const edgeLines = part.material.name === 'grey'
      if (arch || edgeLines)
        part.keep = (a, b, c) => {
          if (arch && Math.max(a.y, b.y, c.y) > ROAD_Y + ROAD_TOP) return false
          if (!edgeLines) return true
          if (def.corner) return false // corners have no paint, only edge lines
          centre.copy(a).add(b).add(c).divideScalar(3).applyMatrix4(local)
          return Math.abs(centre.x - entry.x) < PAINT_REACH
        }
      parts.push(part)
    }
    for (const kerb of def.kerbs) {
      if (!kerb.endsWith('Inner') && pitLane.kerbless.has(piece.index)) continue
      parts.push(...partsOf(scenes.get(kerb)!, place))
    }
    if (piece.sand && def.sand) {
      const lifted = place.clone().multiply(new THREE.Matrix4().makeTranslation(0, SAND_LIFT, 0))
      parts.push(...partsOf(scenes.get(def.sand)!, lifted))
    }
  }
  return mergeParts(parts).map((mesh) => {
    mesh.receiveShadow = true
    // Only the kerbs stand up enough to cast a shadow worth drawing.
    mesh.castShadow = mesh.material instanceof THREE.Material && (mesh.material.name === 'red' || mesh.material.name === 'white')
    return mesh
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
  return <mesh geometry={runOffGeometry()} material={asphalt} receiveShadow />
}

const runOffGeometry = perTrack(() => {
  // In the shape's plane, (x, -z), so turning it flat puts it back at (x, z).
  const flat = (line: { x: number; z: number }[]) => line.map((p) => new THREE.Vector2(p.x, -p.z))
  const [a, b] = track.barriers.map((barrier) => flat(barrier.line))
  const [outer, inner] = Math.abs(THREE.ShapeUtils.area(a)) > Math.abs(THREE.ShapeUtils.area(b)) ? [a, b] : [b, a]
  const shape = new THREE.Shape(outer)
  shape.holes.push(new THREE.Path(inner))
  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, RUNOFF_Y, 0)
  return geometry
})

/** A small gap between blocks, like the kit's own layouts. */
const BLOCK_GAP = 0.02 * TILE

type Block = { x: number; z: number; yaw: number }

/**
 * Lines of barrier blocks along both sides and along the pit lane, alternating
 * red and white. On a street circuit, a concrete wall instead: the kit's wall
 * section cut to the same length, end to end.
 */
function Barriers() {
  const red = useRacingModel('barrierRed')
  const white = useRacingModel('barrierWhite')
  const wall = useRacingModel('barrierWall')
  const walls = circuitById(selectedCircuit()).walls

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

  if (walls) return <BlockInstances model={wall} blocks={[...reds, ...whites]} length={WALL_SECTION} />
  return (
    <>
      <BlockInstances model={red} blocks={reds} />
      <BlockInstances model={white} blocks={whites} />
    </>
  )
}

/** The wall model is a whole tile long: this much of it is one section, a touch longer than a block so they meet. */
const WALL_SECTION = (BARRIER_LENGTH + BLOCK_GAP) / TILE + 0.01

/** One instanced mesh per part of a barrier block model. */
function BlockInstances({ model, blocks, length = 1 }: { model: THREE.Object3D; blocks: Block[]; length?: number }) {
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
        <BlockPart key={i} {...p} blocks={blocks} length={length} />
      ))}
    </>
  )
}

function BlockPart({
  geometry,
  material,
  matrix,
  blocks,
  length,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrix: THREE.Matrix4
  blocks: Block[]
  /** How much of the model's length to use (it runs along its local x). */
  length: number
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const place = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const scale = new THREE.Vector3(TILE * length, TILE, TILE)
    blocks.forEach((b, i) => {
      // The block's long side is its local x; turn it to run along the line.
      q.setFromAxisAngle(up, b.yaw + Math.PI / 2)
      place.compose(new THREE.Vector3(b.x, FLOOR_Y, b.z), q, scale)
      m.setMatrixAt(i, place.multiply(matrix))
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [blocks, matrix, length])
  return <instancedMesh ref={mesh} args={[geometry, material, blocks.length]} castShadow receiveShadow />
}

for (const name of surfaceModels()) useRacingPiece.preload(name)
useRacingModel.preload('barrierRed')
useRacingModel.preload('barrierWhite')
useRacingModel.preload('barrierWall')
