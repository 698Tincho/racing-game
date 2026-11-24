import { Clone } from '@react-three/drei'
import { useRacingPiece } from '../kit'
import { TILE } from '../track/layout'
import { FLOOR_Y } from './boardSize'
import { PIT_BUILDING, PIT_GROUND_FLOOR, PIT_UPPER_FLOOR } from './scenery'

// In tiles. The kit's pit pieces share one grid, so they line up exactly when
// stacked: each is centred at x 0.15, z -1.105 and rests at y -0.01.
const PIECE_CENTRE_X = 0.15
const PIECE_CENTRE_Z = -1.105
const PIECE_BASE_Y = -0.01
const FLOOR_HEIGHT = 0.7

/** The kit's two-story pit building: garages below, offices above. */
export function PitBuilding() {
  return (
    <group position={[PIT_BUILDING.x, FLOOR_Y, PIT_BUILDING.z]} rotation-y={PIT_BUILDING.yaw} scale={TILE}>
      {[PIT_GROUND_FLOOR, PIT_UPPER_FLOOR].flatMap((floor, level) =>
        floor.map((model, bay) => <PitPiece key={`${level}-${bay}`} model={model} bay={bay} level={level} />),
      )}
    </group>
  )
}

function PitPiece({ model, bay, level }: { model: string; bay: number; level: number }) {
  const scene = useRacingPiece(model)
  // Bay 0 is the south end, which is the building's local +x.
  const x = (PIT_GROUND_FLOOR.length - 1) / 2 - bay - PIECE_CENTRE_X
  return <Clone object={scene} position={[x, level * FLOOR_HEIGHT - PIECE_BASE_Y, -PIECE_CENTRE_Z]} />
}

for (const model of new Set([...PIT_GROUND_FLOOR, ...PIT_UPPER_FLOOR])) useRacingPiece.preload(model)
