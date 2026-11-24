import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRacingPiece } from '../kit'
import { FLOOR_Y } from './boardSize'
import { PALETTE } from './palette'
import {
  EMERGENCY_BAY,
  LOT_BAY_LENGTH,
  LOT_BAY_WIDTH,
  LOT_BAYS_PER_ROW,
  LOT_DRIVE,
  LOT_SURFACE,
  PARKING_LOT,
  PAVED_AREAS,
  PIT_BUILDING,
  PIT_GROUND_FLOOR,
  SERVICE_ROAD,
} from './scenery'
import { TILE } from '../track/layout'

const EDGE = 0.35 // the pale strip along every paved edge, like the track's
const LINE_WIDTH = 0.12
const DASH_LENGTH = 1.6
const DASH_EVERY = 3.4

type Mark = { x: number; z: number; width: number; depth: number }

/** The painted lines: bay dividers, the road's centre dashes and the emergency bays. */
function buildMarks() {
  const { x, z, depth } = PARKING_LOT
  const marks: Mark[] = []
  for (let i = 0; i <= LOT_BAYS_PER_ROW; i++) {
    const lineX = x - (LOT_BAYS_PER_ROW * LOT_BAY_WIDTH) / 2 + i * LOT_BAY_WIDTH
    marks.push({ x: lineX, z: z - (depth / 2 - LOT_BAY_LENGTH / 2), width: LINE_WIDTH, depth: LOT_BAY_LENGTH })
    marks.push({ x: lineX, z: z + (depth / 2 - LOT_BAY_LENGTH / 2), width: LINE_WIDTH, depth: LOT_BAY_LENGTH })
  }
  const roadEnd = SERVICE_ROAD.z + SERVICE_ROAD.depth / 2
  for (let dz = SERVICE_ROAD.z - SERVICE_ROAD.depth / 2 + DASH_EVERY; dz < roadEnd - 1; dz += DASH_EVERY) {
    marks.push({ x: SERVICE_ROAD.x, z: dz, width: LINE_WIDTH * 1.3, depth: DASH_LENGTH })
  }
  // A painted box in the pit lane in front of each garage.
  for (let bay = 0; bay <= PIT_GROUND_FLOOR.length; bay++) {
    marks.push({
      x: SERVICE_ROAD.x + SERVICE_ROAD.width / 4,
      z: PIT_BUILDING.south - bay * TILE,
      width: SERVICE_ROAD.width / 2 - 0.2,
      depth: LINE_WIDTH,
    })
  }
  const driveEnd = SERVICE_ROAD.x - SERVICE_ROAD.width / 2
  for (let dx = LOT_DRIVE.x - LOT_DRIVE.width / 2 + 1.2; dx < driveEnd; dx += DASH_EVERY) {
    marks.push({ x: dx, z: LOT_DRIVE.z, width: DASH_LENGTH, depth: LINE_WIDTH * 1.3 })
  }
  for (const dz of [-4.2, 0, 4.2]) {
    marks.push({ x: EMERGENCY_BAY.x, z: EMERGENCY_BAY.z + dz, width: EMERGENCY_BAY.width - 1, depth: LINE_WIDTH })
  }
  return marks
}

/**
 * The lot, its service road and the emergency bay, paved with the track's own
 * asphalt and edge materials so they read as part of the circuit. The cars on
 * it come from carKitScenery.
 */
export function ParkingLot() {
  const road = useRacingPiece('roadStraight')
  const lines = useRef<THREE.InstancedMesh>(null)

  const { asphalt, edge } = useMemo(() => {
    const found: Record<string, THREE.Material> = {}
    road.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) found[(mesh.material as THREE.Material).name] = mesh.material as THREE.Material
    })
    return { asphalt: found.road, edge: found.grey }
  }, [road])

  const { marks, geometry, material } = useMemo(
    () => ({
      marks: buildMarks(),
      geometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      material: new THREE.MeshStandardMaterial({ color: PALETTE.lotLine, roughness: 0.8 }),
    }),
    [],
  )

  useLayoutEffect(() => {
    const mesh = lines.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    marks.forEach((mark, i) => {
      position.set(mark.x, FLOOR_Y + LOT_SURFACE + 0.015, mark.z)
      scale.set(mark.width, 1, mark.depth)
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [marks, geometry, material])

  return (
    <>
      {PAVED_AREAS.map((area, i) => (
        <group key={i} position={[area.x, FLOOR_Y, area.z]}>
          <mesh position-y={(LOT_SURFACE - 0.01) / 2} material={edge} receiveShadow>
            <boxGeometry args={[area.width + EDGE * 2, LOT_SURFACE - 0.01, area.depth + EDGE * 2]} />
          </mesh>
          <mesh position-y={LOT_SURFACE / 2} material={asphalt} receiveShadow>
            <boxGeometry args={[area.width, LOT_SURFACE, area.depth]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={lines} args={[geometry, material, marks.length]} receiveShadow />
    </>
  )
}

useRacingPiece.preload('roadStraight')
