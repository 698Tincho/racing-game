import { useLayoutEffect, useMemo, useRef } from 'react'
import { Clone } from '@react-three/drei'
import * as THREE from 'three'
import { useCityModel, useNatureModel, useRacingModel } from '../kit'
import { FLOOR_Y } from './boardSize'
import { pool, scenery, type Placement } from './scenery'
import { FOREST_MODELS } from './forestScenery'
import { CITY_MODELS } from './cityScenery'
import { PALETTE } from './palette'

// Models that appear many times are drawn as instances (one draw call per
// part instead of one per copy). So is all of the forest and the city.
const INSTANCED = new Set(['treeLarge', 'treeSmall', 'lightPostModern', 'barrierRed', 'barrierWhite', 'barrierWall', 'fenceStraight', 'grandStandCovered'])
const instanced = (p: Placement) => p.kit !== undefined || INSTANCED.has(p.model)

/**
 * Trackside dressing, visual only: tents, the radar dish, light posts,
 * billboards, flags, walls, the perimeter fence and trees from the Racing Kit,
 * and in the forest the Nature Kit's pines, rocks and ridges (laid out in
 * scenery.ts and forestScenery.ts).
 */
export function Props() {
  const groups = useMemo(() => {
    const by = new Map<string, Placement[]>()
    for (const p of scenery) if (instanced(p)) by.set(p.model, [...(by.get(p.model) ?? []), p])
    return [...by]
  }, [])
  return (
    <>
      {scenery
        // (PitBuilding draws the pits, stacked on the kit's own grid.)
        .filter((p) => !instanced(p) && !p.model.startsWith('pits'))
        .map((p, i) => (
          <SceneryModel key={i} p={p} />
        ))}
      {groups.map(([model, list]) =>
        list[0].kit === 'nature' ? (
          <InstancedNature key={model} model={model} placements={list} />
        ) : list[0].kit === 'city' ? (
          <InstancedCity key={model} model={model} placements={list} />
        ) : (
          <InstancedModel key={model} model={model} placements={list} />
        ),
      )}
      {pool && <Pool />}
    </>
  )
}

function SceneryModel({ p }: { p: Placement }) {
  const scene = useRacingModel(p.model)
  return <Clone object={scene} position={[p.x, FLOOR_Y + (p.lift ?? 0), p.z]} rotation={[0, p.yaw, 0]} scale={p.scale} />
}

/** Every copy of one Racing Kit model, as one instanced mesh per part. */
export function InstancedModel({ model, placements }: { model: string; placements: Placement[] }) {
  return <InstancedScene scene={useRacingModel(model)} placements={placements} />
}

/** Every copy of one Nature Kit model, the same way. */
function InstancedNature({ model, placements }: { model: string; placements: Placement[] }) {
  return <InstancedScene scene={useNatureModel(model)} placements={placements} />
}

/** Every copy of one City Kit model, the same way. */
function InstancedCity({ model, placements }: { model: string; placements: Placement[] }) {
  return <InstancedScene scene={useCityModel(model)} placements={placements} />
}

function InstancedScene({ scene, placements }: { scene: THREE.Object3D; placements: Placement[] }) {
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) out.push({ geometry: m.geometry, material: m.material as THREE.Material, matrix: m.matrixWorld.clone() })
    })
    return out
  }, [scene])
  return (
    <>
      {parts.map((part, i) => (
        <InstancedPart key={i} {...part} placements={placements} />
      ))}
    </>
  )
}

function InstancedPart({
  geometry,
  material,
  matrix,
  placements,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrix: THREE.Matrix4
  placements: Placement[]
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const place = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    placements.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw)
      place.compose(new THREE.Vector3(p.x, FLOOR_Y + (p.lift ?? 0), p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale))
      m.setMatrixAt(i, place.multiply(matrix))
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [placements, matrix])
  return <instancedMesh ref={mesh} args={[geometry, material, placements.length]} castShadow receiveShadow />
}

/** The pool at the foot of the forest's waterfall: still water, a touch above the grass. */
function Pool() {
  const { x, z, radius } = pool!
  return (
    <mesh position={[x, FLOOR_Y + 0.04, z]} rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[radius, 40]} />
      <meshStandardMaterial color={PALETTE.nature.water} roughness={0.15} metalness={0.1} />
    </mesh>
  )
}

for (const name of new Set(scenery.filter((p) => !p.kit).map((p) => p.model))) useRacingModel.preload(name)
// (Only on a forest circuit: elsewhere they'd download for nothing.)
if (scenery.some((p) => p.kit === 'nature')) for (const name of FOREST_MODELS) useNatureModel.preload(name)
if (scenery.some((p) => p.kit === 'city')) for (const name of CITY_MODELS) useCityModel.preload(name)
