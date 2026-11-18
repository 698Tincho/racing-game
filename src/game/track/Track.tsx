import { useMemo } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { PIECES, ROAD_SURFACE_Y, TILE_ORIGIN_Y, modelUrl } from './pieces'
import { TRACK_SCALE, WALL_HEIGHT, WALL_THICKNESS, track } from './layout'
import { FLOOR_Y, board } from '../scene/boardSize'

const S = TRACK_SCALE
// Lift tiles so the road surface sits exactly at y = 0 (where physics ground is).
const TILE_Y = -(TILE_ORIGIN_Y + ROAD_SURFACE_Y) * S

function Tile({ model, x, z, yaw, mirror }: { model: string; x: number; z: number; yaw: number; mirror: boolean }) {
  const { scene } = useGLTF(modelUrl(model))
  return (
    <Clone
      object={scene}
      position={[x, TILE_Y, z]}
      rotation={[0, yaw, 0]}
      scale={[mirror ? -S : S, S, S]}
      castShadow
      receiveShadow
    />
  )
}

function FinishGate() {
  const { scene } = useGLTF(modelUrl('gate-finish'))
  // The gate is made for narrow track, so stretch it to straddle the wide road.
  return (
    <Clone
      object={scene}
      position={[track.finish.x, FLOOR_Y, track.finish.z]}
      rotation={[0, track.finish.yaw, 0]}
      scale={[1.4 * S, S, S]}
      castShadow
    />
  )
}

// Seeded random so trees are always in the same place.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Trees() {
  const tree = useGLTF(modelUrl('tree')).scene
  const pine = useGLTF(modelUrl('tree-pine')).scene

  const trees = useMemo(() => {
    const rand = mulberry32(7)
    // Stay a few meters inside the board's edge, and well clear of the road.
    const inset = 4
    const clearance = 0.9 * S + 6
    const out: { x: number; z: number; s: number; r: number; pine: boolean }[] = []
    for (let tries = 0; out.length < 110 && tries < 6000; tries++) {
      const x = board.minX + inset + rand() * (board.width - inset * 2)
      const z = board.minZ + inset + rand() * (board.depth - inset * 2)
      const nearTrack = track.centerline.some((p) => Math.hypot(p.x - x, p.z - z) < clearance)
      const nearTree = out.some((t) => Math.hypot(t.x - x, t.z - z) < 4)
      if (nearTrack || nearTree) continue
      out.push({ x, z, s: S * (1.1 + rand() * 0.9), r: rand() * Math.PI * 2, pine: rand() > 0.45 })
    }
    return out
  }, [])

  return (
    <>
      {trees.map((t, i) => (
        <Clone
          key={i}
          object={t.pine ? pine : tree}
          position={[t.x, FLOOR_Y, t.z]}
          rotation={[0, t.r, 0]}
          scale={t.s}
          castShadow
        />
      ))}
    </>
  )
}

export function Track() {
  const { minX, maxX, minZ, maxZ } = track.bounds
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  return (
    <>
      {track.pieces.map(({ id, index, pose }) => (
        <Tile key={index} model={PIECES[id].model} mirror={PIECES[id].mirror} {...pose} />
      ))}
      <FinishGate />
      <Trees />

      {/* Physics: flat ground at road height plus invisible walls along the rails */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(maxX - minX) / 2 + 20, 0.5, (maxZ - minZ) / 2 + 20]} position={[cx, -0.5, cz]} />
        {track.walls.map((w, i) => (
          <CuboidCollider
            key={i}
            args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, w.length / 2]}
            position={[w.x, WALL_HEIGHT / 2 - 0.2, w.z]}
            rotation={[0, w.yaw, 0]}
          />
        ))}
      </RigidBody>

    </>
  )
}

// Start loading every model as soon as this module is imported.
for (const def of Object.values(PIECES)) useGLTF.preload(modelUrl(def.model))
useGLTF.preload(modelUrl('gate-finish'))
useGLTF.preload(modelUrl('tree'))
useGLTF.preload(modelUrl('tree-pine'))
