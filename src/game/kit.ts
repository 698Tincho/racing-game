import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { carKitModelUrl, racingModelUrl } from './assets'

/**
 * The Racing Kit's materials are flat (unlit) and their colours are stored
 * as if they were already sRGB, so as-is everything looks pale and ignores
 * the sun. Swap each for a lit one in the intended colour, shared by every
 * model that uses it.
 */
const litCache = new Map<THREE.Material, THREE.Material>()
export function lit(source: THREE.Material) {
  let m = litCache.get(source)
  if (!m) {
    const basic = source as THREE.MeshBasicMaterial
    // A textured material (the checkered flag) keeps its texture, untinted.
    const color = basic.map ? new THREE.Color('white') : (basic.color ?? new THREE.Color('white')).clone().convertSRGBToLinear()
    const name = source.name
    const glass = name === 'glass'
    const metal = name === 'metal' || name === 'grey'
    m = new THREE.MeshStandardMaterial({
      color,
      map: basic.map ?? null,
      roughness: glass ? 0.1 : name === 'road' ? 0.8 : name === 'grass' ? 0.95 : 0.6,
      metalness: glass ? 0.3 : metal ? 0.05 : 0,
      // See-through parts, like the fence's net, stay see-through.
      transparent: source.transparent,
      opacity: source.opacity,
      alphaTest: source.alphaTest,
      side: source.side,
    })
    m.name = name
    litCache.set(source, m)
  }
  return m
}

/** How dark the track's own asphalt is next to the run-off and lot (which keep the kit's colour). */
export const TRACK_ASPHALT_SHADE = 0.4

const darkCache = new Map<THREE.Material, THREE.Material>()
/** The kit's road material, darker: the asphalt you race on, set apart from the run-off. */
export function trackAsphalt(road: THREE.Material) {
  let m = darkCache.get(road)
  if (!m) {
    const copy = (road as THREE.MeshStandardMaterial).clone()
    copy.color.multiplyScalar(TRACK_ASPHALT_SHADE)
    copy.name = 'trackRoad'
    m = copy
    darkCache.set(road, m)
  }
  return m
}

/** Give every mesh in a loaded kit scene lit materials and shadows (once). */
function prepare(scene: THREE.Object3D) {
  if (scene.userData.lit) return
  scene.userData.lit = true
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(lit) : lit(mesh.material)
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

/**
 * A Racing Kit piece exactly as the kit lays it out, for snapping road
 * tiles together: one tile spans x -0.35..0.65, z -1.65..-0.65.
 */
export function useRacingPiece(name: string) {
  const { scene } = useGLTF(racingModelUrl(name))
  prepare(scene)
  return scene
}

/**
 * A Racing Kit model tidied up so it's easy to place on its own: centred on
 * x/z and sitting on y = 0. (The kit's files have their origin about half a
 * tile off, for snapping to the road grid.) Don't use the same model with
 * useRacingPiece: this moves its parts.
 */
export function useRacingModel(name: string) {
  const { scene } = useGLTF(racingModelUrl(name))
  prepare(scene)
  if (!scene.userData.tidied) {
    scene.userData.tidied = true
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const shift = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    for (const child of scene.children) child.position.sub(shift)
  }
  return scene
}

useRacingModel.preload = (name: string) => useGLTF.preload(racingModelUrl(name))
useRacingPiece.preload = useRacingModel.preload

/** A Car Kit model for scenery: lit, centred on x/z and sitting on y = 0. */
export function useCarKitModel(name: string) {
  const { scene } = useGLTF(carKitModelUrl(name))
  prepare(scene)
  if (!scene.userData.tidied) {
    scene.userData.tidied = true
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const shift = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    for (const child of scene.children) child.position.sub(shift)
  }
  return scene
}

useCarKitModel.preload = (name: string) => useGLTF.preload(carKitModelUrl(name))
