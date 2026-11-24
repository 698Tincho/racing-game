import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** One piece of a model, placed in the world. */
export type StaticPart = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrix: THREE.Matrix4
  /** Keep only some triangles, judged by their corners in world space. */
  keep?: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => boolean
}

const inverse = new THREE.Matrix4()

/**
 * Every visible mesh of a loaded model, as parts placed by `place` (the
 * model's root goes there). Materials can be swapped or dropped with `style`.
 */
export function partsOf(
  root: THREE.Object3D,
  place: THREE.Matrix4,
  style: (material: THREE.Material, mesh: THREE.Mesh) => THREE.Material | null = (m) => m,
): StaticPart[] {
  root.updateMatrixWorld(true)
  inverse.copy(root.matrixWorld).invert()
  const parts: StaticPart[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible || Array.isArray(mesh.material)) return
    const material = style(mesh.material, mesh)
    if (!material) return
    parts.push({ geometry: mesh.geometry, material, matrix: place.clone().multiply(inverse).multiply(mesh.matrixWorld) })
  })
  return parts
}

const a = new THREE.Vector3()
const b = new THREE.Vector3()
const c = new THREE.Vector3()

/** The part's geometry in world space, indexed, with only the triangles it keeps. */
function bake(part: StaticPart) {
  const g = part.geometry.clone()
  g.applyMatrix4(part.matrix)
  // Only what every kit model has, so they can all be merged.
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
  g.morphAttributes = {}
  if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()])
  if (part.keep) {
    const position = g.getAttribute('position')
    const index = g.index!
    const kept: number[] = []
    for (let t = 0; t < index.count; t += 3) {
      const [i, j, k] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      if (part.keep(a.fromBufferAttribute(position, i), b.fromBufferAttribute(position, j), c.fromBufferAttribute(position, k))) kept.push(i, j, k)
    }
    g.setIndex(kept)
  }
  return g
}

/**
 * Bake parts that never move into one mesh per material, so hundreds of
 * models draw in a handful of calls. Parts whose materials match by `key`
 * share the first one's material.
 */
export function mergeParts(parts: StaticPart[], key: (m: THREE.Material) => string = (m) => m.uuid) {
  const groups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>()
  for (const part of parts) {
    const g = bake(part)
    if (!g.index || g.index.count === 0) continue
    const id = `${key(part.material)}|${Object.keys(g.attributes).sort().join(',')}`
    let group = groups.get(id)
    if (!group) groups.set(id, (group = { material: part.material, geometries: [] }))
    group.geometries.push(g)
  }
  return [...groups.values()].map(({ material, geometries }) => {
    const merged = mergeGeometries(geometries, false)!
    for (const g of geometries) g.dispose()
    merged.computeBoundingSphere()
    return new THREE.Mesh(merged, material)
  })
}
