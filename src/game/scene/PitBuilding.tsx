import { useMemo } from 'react'
import * as THREE from 'three'
import { useRacingPiece, useRacingPieces } from '../kit'
import { TILE } from '../track/layout'
import { FLOOR_Y } from './boardSize'
import { mergeParts, partsOf } from './mergeStatic'
import { PIT_BUILDING, PIT_GROUND_FLOOR, PIT_UPPER_FLOOR } from './scenery'

// In tiles. The kit's pit pieces share one grid, so they line up exactly when
// stacked: each is centred at x 0.15, z -1.105 and rests at y -0.01.
const PIECE_CENTRE_X = 0.15
const PIECE_CENTRE_Z = -1.105
const PIECE_BASE_Y = -0.01
const FLOOR_HEIGHT = 0.7

const MODELS = [...new Set([...PIT_GROUND_FLOOR, ...PIT_UPPER_FLOOR])]

/**
 * The kit's two-story pit building: garages below, offices above. It never
 * moves, so it's baked into one mesh per colour. Built once.
 */
export function PitBuilding() {
  const scenes = useRacingPieces(MODELS)
  const meshes = useMemo(() => {
    if (cache) return cache
    const byName = new Map(MODELS.map((name, i) => [name, scenes[i]]))
    const building = new THREE.Matrix4()
      .makeTranslation(PIT_BUILDING.x, FLOOR_Y, PIT_BUILDING.z)
      .multiply(new THREE.Matrix4().makeRotationY(PIT_BUILDING.yaw))
      .multiply(new THREE.Matrix4().makeScale(TILE, TILE, TILE))
    const parts = [PIT_GROUND_FLOOR, PIT_UPPER_FLOOR].flatMap((floor, level) =>
      floor.flatMap((model, bay) => {
        // Bay 0 is the south end, which is the building's local +x.
        const x = (PIT_GROUND_FLOOR.length - 1) / 2 - bay - PIECE_CENTRE_X
        const place = building.clone().multiply(new THREE.Matrix4().makeTranslation(x, level * FLOOR_HEIGHT - PIECE_BASE_Y, -PIECE_CENTRE_Z))
        return partsOf(byName.get(model)!, place)
      }),
    )
    // The kit's colours are plain materials named after them, the same in every piece.
    cache = mergeParts(parts, (m) => `${m.name}|${m.transparent}`)
    for (const mesh of cache) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    return cache
  }, [scenes])
  return (
    <>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </>
  )
}
let cache: THREE.Mesh[] | null = null

for (const model of MODELS) useRacingPiece.preload(model)
