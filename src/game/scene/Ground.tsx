import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRacingPiece } from '../kit'
import { TILE } from '../track/layout'
import { FLOOR_Y } from './boardSize'
import { PALETTE } from './palette'

/** Grass tiles this many tiles out from the middle in every direction. */
const REACH = 40

// The kit's grass tile has its surface at y = -0.01 tiles. Lift it by that much
// so the surface lands exactly on FLOOR_Y, where the scenery stands.
const GROUND_Y = FLOOR_Y + 0.01 * TILE

/**
 * The ground: the Racing Kit's grass tile, repeated in a big square around
 * the circuit. Instanced, so it's one draw call. The fog hides where it ends.
 */
export function Ground() {
  const scene = useRacingPiece('grass')
  const mesh = useRef<THREE.InstancedMesh>(null)

  const { geometry, material, matrix } = useMemo(() => {
    scene.updateMatrixWorld(true)
    let found: THREE.Mesh | undefined
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) found = o as THREE.Mesh
    })
    return { geometry: found!.geometry, material: groundMaterial(found!.material as THREE.MeshStandardMaterial), matrix: found!.matrixWorld.clone() }
  }, [scene])

  const cells = useMemo(() => {
    const out: [number, number][] = []
    for (let c = -REACH; c <= REACH; c++) for (let r = -REACH; r <= REACH; r++) out.push([c, r])
    return out
  }, [])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const place = new THREE.Matrix4()
    const scale = new THREE.Vector3(TILE, TILE, TILE)
    const q = new THREE.Quaternion()
    cells.forEach(([c, r], i) => {
      // The kit tile spans x -0.35..0.65, z -1.65..-0.65: move its middle onto the cell.
      place.compose(new THREE.Vector3((c - 0.15) * TILE, GROUND_Y, (r + 1.15) * TILE), q, scale)
      m.setMatrixAt(i, place.multiply(matrix))
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [cells, matrix])

  return <instancedMesh ref={mesh} args={[geometry, material, cells.length]} receiveShadow />
}

/** The kit's grass, or a copy in the venue's own green. */
const tinted = new Map<string, THREE.Material>()
function groundMaterial(grass: THREE.MeshStandardMaterial) {
  const color = PALETTE.ground
  if (!color) return grass
  if (!tinted.has(color)) {
    const copy = grass.clone()
    copy.color.set(color)
    tinted.set(color, copy)
  }
  return tinted.get(color)!
}

useRacingPiece.preload('grass')
