import { CAR_SCALE } from '../cars'
import { beyondWall } from '../track/layout'
import { board } from './boardSize'
import {
  EMERGENCY_BAY,
  LOT_BAY_WIDTH,
  LOT_BAYS_PER_ROW,
  LOT_SURFACE,
  PARKING_LOT,
  LOT_DRIVE,
  PARTS_TENT,
  inInfield,
  inParkingLot,
  mulberry32,
  scenery,
} from './scenery'

/**
 * Dressing from Kenney's Car Kit, visual only and always behind the barriers:
 * race cars in the pit garages, the ambulance and fire truck parked together,
 * road cars in the parking lot, and tyres on the islands inside the lap.
 * Seeded, so it's the same each time.
 */

const EMERGENCY_MODELS = ['ambulance', 'firetruck'] as const
const ROAD_VEHICLES = [
  'police',
  'sedan',
  'delivery',
  'taxi',
  'suv-luxury',
  'truck-flat',
  'suv',
  'van',
  'truck',
  'hatchback-sports',
  'sedan-sports',
] as const
const GARAGE_TEAMS = ['race', 'race-future'] as const

/** Models this file places, so they can be loaded up front. */
export const PARKED_VEHICLES = [...EMERGENCY_MODELS, ...ROAD_VEHICLES, ...GARAGE_TEAMS] as const

export const TIRE_MODELS = [
  'wheel-default',
  'wheel-dark',
  'wheel-racing',
  'wheel-truck',
  'wheel-tractor-front',
  'wheel-tractor-dark-front',
  'wheel-tractor-back',
  'wheel-tractor-dark-back',
  'debris-tire',
] as const

/** Spare parts under the island's tent: model, then x, z (metres from the tent's centre) and yaw. */
const TENT_PARTS = [
  ['box', -2.3, -2.1, 0.1],
  ['box', -2.4, -0.9, -0.15],
  ['box', -1.3, -2.3, 0.3],
  ['debris-bumper', 1.5, -2.2, 0.35],
  ['debris-door', 2.5, 0.1, 1.3],
  ['debris-door-window', 1.4, 1.5, -0.6],
  ['debris-drivetrain', -0.5, 0.3, 0.9],
  ['debris-drivetrain-axle', -1.2, 2.1, 0.2],
  ['debris-spoiler-a', 0.5, -0.8, -0.3],
  ['debris-spoiler-b', -2.4, 1.3, 1.6],
  ['debris-plate-a', 2.4, 2.4, 0.5],
  ['debris-plate-b', -0.1, -2.5, 2.1],
  ['debris-nut', 0.3, 2.5, 0],
  ['debris-bolt', 0.8, 2.7, 1],
] as const

export const PART_MODELS = [...new Set(TENT_PARTS.map(([model]) => model))]

export type PartPlacement = { model: (typeof TENT_PARTS)[number][0]; x: number; z: number; yaw: number }

export type ParkedVehicle = {
  model: (typeof PARKED_VEHICLES)[number]
  x: number
  z: number
  yaw: number
  scale: number
  /** Height above the grass (the garage floor is a raised slab). */
  lift: number
}
export type TirePlacement = {
  model: (typeof TIRE_MODELS)[number]
  x: number
  z: number
  yaw: number
  /** Lying on its side rather than standing up. */
  flat: boolean
  /** How many tyres are under this one in a stack. */
  level: number
}

// Pit garages: the floor slab's height, and where the two cars stand in a bay.
const GARAGE_FLOOR = 0.16
const GARAGE_CAR_OFFSET = 1.55

const EMERGENCY_SCALE = 1.6 // a little larger than the cars, like the real thing
const EMERGENCY_SPACING = 2.1 // metres from the bay's centre to each vehicle

const LOT_CARS = 24 // of the 32 bays, so it looks lived in
const BAY_NOSE_GAP = 2.9 // from the lot's edge to the middle of a parked car

const TIRE_CLUSTERS = 30
const CLUSTER_RADIUS = 2.2

function build() {
  const rand = mulberry32(27)
  const blockers = scenery.map((p) => ({ x: p.x, z: p.z, r: Math.max(p.width, p.depth) / 2 }))
  const free = (x: number, z: number, r: number) =>
    !inParkingLot(x, z, r) && blockers.every((b) => Math.hypot(b.x - x, b.z - z) >= b.r + r)
  const vehicles: ParkedVehicle[] = []

  // Race cars: two per garage, nose towards the pit lane, one team per bay.
  scenery
    .filter((p) => p.model === 'pitsGarage')
    .forEach((garage, bay) => {
      const c = Math.cos(garage.yaw)
      const s = Math.sin(garage.yaw)
      for (const side of [1, -1]) {
        vehicles.push({
          model: GARAGE_TEAMS[bay % GARAGE_TEAMS.length],
          x: garage.x + side * GARAGE_CAR_OFFSET * c,
          z: garage.z - side * GARAGE_CAR_OFFSET * s,
          yaw: garage.yaw,
          scale: CAR_SCALE,
          lift: GARAGE_FLOOR,
        })
      }
    })

  // Ambulance and fire truck: side by side in their bay, noses to the service road.
  EMERGENCY_MODELS.forEach((model, k) => {
    vehicles.push({
      model,
      x: EMERGENCY_BAY.x,
      z: EMERGENCY_BAY.z + (k === 0 ? -EMERGENCY_SPACING : EMERGENCY_SPACING),
      yaw: -Math.PI / 2,
      scale: EMERGENCY_SCALE,
      lift: LOT_SURFACE,
    })
  })

  // Road cars: nose-in to random bays.
  const bays: { x: number; z: number; yaw: number }[] = []
  for (let c = 0; c < LOT_BAYS_PER_ROW; c++) {
    const x = PARKING_LOT.x - (LOT_BAYS_PER_ROW * LOT_BAY_WIDTH) / 2 + (c + 0.5) * LOT_BAY_WIDTH
    bays.push({ x, z: PARKING_LOT.z - PARKING_LOT.depth / 2 + BAY_NOSE_GAP, yaw: Math.PI })
    bays.push({ x, z: PARKING_LOT.z + PARKING_LOT.depth / 2 - BAY_NOSE_GAP, yaw: 0 })
  }
  for (let i = bays.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[bays[i], bays[j]] = [bays[j], bays[i]]
  }
  bays.slice(0, LOT_CARS).forEach((bay, i) => {
    vehicles.push({
      model: ROAD_VEHICLES[i % ROAD_VEHICLES.length],
      x: bay.x,
      z: bay.z,
      yaw: bay.yaw + (rand() - 0.5) * 0.06,
      scale: CAR_SCALE,
      lift: LOT_SURFACE,
    })
  })

  // Cones either side of the drive, at the lot's gate.
  const gateX = PARKING_LOT.x + PARKING_LOT.width / 2 + 2
  const cones = [-1, 1].flatMap((side) =>
    [0, 2.4].map((dx) => ({ x: gateX + dx, z: LOT_DRIVE.z + side * (LOT_DRIVE.depth / 2 + 0.8) })),
  )

  // Tyres: small groups, only on the islands enclosed by the track.
  const tires: TirePlacement[] = []
  let nextModel = 0
  const takeModel = () => TIRE_MODELS[nextModel++ % TIRE_MODELS.length]
  let clusters = 0
  for (let attempt = 0; attempt < 2500 && clusters < TIRE_CLUSTERS; attempt++) {
    const x = board.minX + rand() * board.width
    const z = board.minZ + rand() * board.depth
    if (!inInfield(x, z)) continue
    if (beyondWall(x, z) < CLUSTER_RADIUS) continue
    if (!free(x, z, CLUSTER_RADIUS)) continue
    blockers.push({ x, z, r: CLUSTER_RADIUS })
    clusters++

    if (rand() < 0.25) {
      // A neat stack of the same tyre.
      const model = takeModel()
      const height = 2 + Math.floor(rand() * 3)
      const yaw = rand() * Math.PI * 2
      for (let level = 0; level < height; level++) tires.push({ model, x, z, yaw: yaw + level * 0.4, flat: true, level })
      continue
    }
    const count = 1 + Math.floor(rand() * 4)
    const placed: { x: number; z: number }[] = []
    for (let j = 0; j < count; j++) {
      const a = rand() * Math.PI * 2
      const r = j === 0 ? 0 : 1 + rand() * 1
      const tx = x + Math.cos(a) * r
      const tz = z + Math.sin(a) * r
      if (placed.some((t) => Math.hypot(t.x - tx, t.z - tz) < 1.25)) continue
      placed.push({ x: tx, z: tz })
      tires.push({ model: takeModel(), x: tx, z: tz, yaw: rand() * Math.PI * 2, flat: rand() < 0.55, level: 0 })
    }
  }

  // Spare parts under the tent on the square island.
  const c = Math.cos(PARTS_TENT.yaw)
  const s = Math.sin(PARTS_TENT.yaw)
  const parts: PartPlacement[] = TENT_PARTS.map(([model, dx, dz, yaw]) => ({
    model,
    x: PARTS_TENT.x + dx * c + dz * s,
    z: PARTS_TENT.z - dx * s + dz * c,
    yaw: PARTS_TENT.yaw + yaw,
  }))

  return { vehicles, tires, cones, parts }
}

export const carKitScenery = build()
