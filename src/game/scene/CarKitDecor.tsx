import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CAR_SCALE } from '../cars'
import { useCarKitModel, useCarKitModels } from '../kit'
import { mergeParts, partsOf, type StaticPart } from './mergeStatic'
import { FLOOR_Y } from './boardSize'
import { PARKED_VEHICLES, PART_MODELS, TIRE_MODELS, carKitScenery, type TirePlacement } from './carKitScenery'

const TIRE_SCALE = CAR_SCALE

/** The Car Kit's parked vehicles, the tyres scattered on the islands and the spare parts under the tent. */
export function CarKitDecor() {
  const byModel = useMemo(() => {
    const groups = new Map<string, TirePlacement[]>()
    for (const t of carKitScenery.tires) groups.set(t.model, [...(groups.get(t.model) ?? []), t])
    return [...groups]
  }, [])
  return (
    <>
      <ParkedThings />
      {byModel.map(([model, placements]) => (
        <Tires key={model} model={model} placements={placements} />
      ))}
    </>
  )
}

/** Every model that stands still: vehicles, spare parts and cones. */
const PARKED_MODELS = [...new Set([...PARKED_VEHICLES, ...PART_MODELS, 'cone'])]

/**
 * The vehicles, parts and cones never move, so they're baked into one mesh
 * per material: the whole lot draws in a call or two. Built once.
 */
function ParkedThings() {
  const scenes = useCarKitModels(PARKED_MODELS)
  const meshes = useMemo(() => {
    if (parkedCache) return parkedCache
    const byName = new Map(PARKED_MODELS.map((name, i) => [name, scenes[i]]))
    const place = (x: number, y: number, z: number, yaw: number, scale: number) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(scale, scale, scale))
    const parts: StaticPart[] = [
      ...carKitScenery.vehicles.flatMap((v) => partsOf(byName.get(v.model)!, place(v.x, FLOOR_Y + v.lift, v.z, v.yaw, v.scale))),
      ...carKitScenery.parts.flatMap((p) => partsOf(byName.get(p.model)!, place(p.x, FLOOR_Y, p.z, p.yaw, CAR_SCALE))),
      ...carKitScenery.cones.flatMap((c) => partsOf(byName.get('cone')!, place(c.x, FLOOR_Y, c.z, 0, CAR_SCALE))),
    ]
    // The kit's models all share one texture, so one material per kind will do.
    parkedCache = mergeParts(parts, (m) => `${m.name}|${m.transparent}`)
    for (const mesh of parkedCache) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    return parkedCache
  }, [scenes])
  return (
    <>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </>
  )
}
let parkedCache: THREE.Mesh[] | null = null

/** Every copy of one tyre model, as one instanced mesh per part. */
function Tires({ model, placements }: { model: string; placements: TirePlacement[] }) {
  const scene = useCarKitModel(model)
  const { parts, width, height } = useMemo(() => {
    scene.updateMatrixWorld(true)
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3())
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) out.push({ geometry: m.geometry, material: m.material as THREE.Material, matrix: m.matrixWorld.clone() })
    })
    return { parts: out, width: size.x, height: size.y }
  }, [scene])
  return (
    <>
      {parts.map((part, i) => (
        <TirePart key={i} {...part} width={width} height={height} placements={placements} />
      ))}
    </>
  )
}

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)

function TirePart({
  geometry,
  material,
  matrix,
  width,
  height,
  placements,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrix: THREE.Matrix4
  width: number
  height: number
  placements: TirePlacement[]
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const place = new THREE.Matrix4()
    const toCentre = new THREE.Matrix4().makeTranslation(0, -height / 2, 0)
    const turn = new THREE.Quaternion()
    const tip = new THREE.Quaternion().setFromAxisAngle(FORWARD, Math.PI / 2)
    const q = new THREE.Quaternion()
    const scale = new THREE.Vector3(TIRE_SCALE, TIRE_SCALE, TIRE_SCALE)
    const position = new THREE.Vector3()
    placements.forEach((p, i) => {
      turn.setFromAxisAngle(UP, p.yaw)
      q.copy(turn)
      if (p.flat) q.multiply(tip)
      const centreY = p.flat ? (p.level + 0.5) * width * TIRE_SCALE : (height / 2) * TIRE_SCALE
      position.set(p.x, FLOOR_Y + centreY, p.z)
      place.compose(position, q, scale).multiply(toCentre).multiply(matrix)
      m.setMatrixAt(i, place)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [placements, matrix, width, height])
  return <instancedMesh ref={mesh} args={[geometry, material, placements.length]} castShadow receiveShadow />
}

for (const name of [...PARKED_VEHICLES, ...TIRE_MODELS, ...PART_MODELS, 'cone']) useCarKitModel.preload(name)
