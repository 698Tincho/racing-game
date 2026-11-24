import { useLayoutEffect, useMemo, useRef } from 'react'
import { Clone } from '@react-three/drei'
import * as THREE from 'three'
import { useRacingModel } from '../kit'
import { FLOOR_Y } from './boardSize'
import { scenery, type Placement } from './scenery'

// Models that appear many times are drawn as instances (one draw call per
// part instead of one per copy).
const INSTANCED = new Set(['treeLarge', 'treeSmall', 'lightPostModern', 'barrierRed', 'barrierWhite', 'barrierWall', 'fenceStraight'])

/**
 * Trackside dressing from the Racing Kit, visual only: tents, the radar dish,
 * light posts, billboards, flags, walls, the perimeter fence and trees (laid
 * out in scenery.ts).
 */
export function Props() {
  const groups = useMemo(() => {
    const by = new Map<string, Placement[]>()
    for (const p of scenery) if (INSTANCED.has(p.model)) by.set(p.model, [...(by.get(p.model) ?? []), p])
    return [...by]
  }, [])
  return (
    <>
      {scenery
        // (PitBuilding draws the pits, stacked on the kit's own grid.)
        .filter((p) => !INSTANCED.has(p.model) && !p.model.startsWith('pits'))
        .map((p, i) => (
          <SceneryModel key={i} p={p} />
        ))}
      {groups.map(([model, list]) => (
        <InstancedModel key={model} model={model} placements={list} />
      ))}
    </>
  )
}

function SceneryModel({ p }: { p: Placement }) {
  const scene = useRacingModel(p.model)
  return <Clone object={scene} position={[p.x, FLOOR_Y + (p.lift ?? 0), p.z]} rotation={[0, p.yaw, 0]} scale={p.scale} />
}

/** Every copy of one Racing Kit model, as one instanced mesh per part. */
export function InstancedModel({ model, placements }: { model: string; placements: Placement[] }) {
  const scene = useRacingModel(model)
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
      place.compose(new THREE.Vector3(p.x, FLOOR_Y, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale))
      m.setMatrixAt(i, place.multiply(matrix))
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [placements, matrix])
  return <instancedMesh ref={mesh} args={[geometry, material, placements.length]} castShadow receiveShadow />
}

for (const name of new Set(scenery.map((p) => p.model))) useRacingModel.preload(name)
