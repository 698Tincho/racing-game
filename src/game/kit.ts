import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { carKitModelUrl, cityModelUrl, natureModelUrl, racingModelUrl } from './assets'
import { PALETTE } from './scene/palette'

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
 * Several Racing Kit pieces (see useRacingPiece). One at a time on purpose:
 * that shares the cache with each model's preload, so nothing loads twice.
 * (`names` must stay the same between renders.)
 */
export function useRacingPieces(names: readonly string[]) {
  return names.map((name) => useRacingPiece(name))
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
  return tidyCarKit(scene)
}

/** Several Car Kit models (see useCarKitModel and useRacingPieces). */
export function useCarKitModels(names: readonly string[]) {
  return names.map((name) => useCarKitModel(name))
}

function tidyCarKit(scene: THREE.Group) {
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

/**
 * The Nature Kit comes in bright teal and orange. Its materials have plain
 * names (grass, leafsDark, stone...), so each is swapped for a lit one in the
 * venue's colour for that name (PALETTE.nature), shared by every model.
 */
const natureCache = new Map<string, THREE.Material>()
function natureMaterial(source: THREE.Material) {
  const color = PALETTE.nature[source.name]
  if (!color) return lit(source)
  const key = `${source.name}|${color}`
  let m = natureCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: source.name === 'water' ? 0.2 : 0.9 })
    m.name = source.name
    natureCache.set(key, m)
  }
  return m
}

/** A Nature Kit model in the venue's colours, centred on x/z and sitting on y = 0. */
export function useNatureModel(name: string) {
  const { scene } = useGLTF(natureModelUrl(name))
  if (!scene.userData.tidied) {
    scene.userData.tidied = true
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(natureMaterial) : natureMaterial(mesh.material)
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const shift = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    for (const child of scene.children) child.position.sub(shift)
  }
  return scene
}

useNatureModel.preload = (name: string) => useGLTF.preload(natureModelUrl(name))

/**
 * The City Kit's buildings all share one colour texture. They get one shared
 * material for it, and at night (PALETTE.windows) a glow on just the texture's
 * blue window colours, so the windows light up and the walls don't.
 */
let cityMaterial: THREE.MeshStandardMaterial | null = null
function cityMaterialFor(source: THREE.MeshStandardMaterial) {
  if (!cityMaterial) {
    cityMaterial = new THREE.MeshStandardMaterial({ map: source.map, roughness: 0.75, side: THREE.DoubleSide })
    cityMaterial.name = 'city'
  }
  const glow = PALETTE.windows
  if (glow && source.map && !cityMaterial.emissiveMap) {
    cityMaterial.emissiveMap = windowMask(source.map)
    cityMaterial.emissive.set(glow)
    cityMaterial.emissiveIntensity = 1.3
  } else if (!glow) {
    cityMaterial.emissive.set('black')
  }
  cityMaterial.needsUpdate = true
  return cityMaterial
}

/**
 * How much each part of the texture glows: its swatches sit on a grid of
 * 32 px squares (in a 512 px image), and the windows are the two blue columns
 * in the second band. The dark glass of the far skyline glows a little.
 */
function windowGlow(u: number, v: number) {
  if (u >= 0.5 && u < 0.75 && v >= 0.25 && v < 0.5) return 255
  if (u >= 0.5 && u < 0.875 && v >= 0.75) return 70
  return 0
}

/** The window glow as a texture laid out like the colour one. */
function windowMask(map: THREE.Texture) {
  const image = map.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const g = canvas.getContext('2d')!
  g.drawImage(image, 0, 0)
  const pixels = g.getImageData(0, 0, canvas.width, canvas.height)
  const d = pixels.data
  // The image may have come in upside down: the window blue should be 30% of the way down.
  const probe = (Math.floor(canvas.height * 0.3) * canvas.width + Math.floor(canvas.width * 0.53)) * 4
  const upright = d[probe + 2] - d[probe] > 40
  for (let i = 0; i < d.length; i += 4) {
    const p = i / 4
    const v = Math.floor(p / canvas.width) / canvas.height
    d[i] = d[i + 1] = d[i + 2] = windowGlow((p % canvas.width) / canvas.width, upright ? v : 1 - v)
  }
  g.putImageData(pixels, 0, 0)
  const mask = new THREE.CanvasTexture(canvas)
  // Laid out like the texture it came from.
  mask.flipY = map.flipY
  mask.channel = map.channel
  return mask
}

/** A City Kit model: one shared material, centred on x/z and sitting on y = 0. */
export function useCityModel(name: string) {
  const { scene } = useGLTF(cityModelUrl(name))
  if (!scene.userData.tidied) {
    scene.userData.tidied = true
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = cityMaterialFor(mesh.material as THREE.MeshStandardMaterial)
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const shift = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    for (const child of scene.children) child.position.sub(shift)
  }
  return scene
}

useCityModel.preload = (name: string) => useGLTF.preload(cityModelUrl(name))
