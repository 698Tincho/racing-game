import { useMemo } from 'react'
import { Clone } from '@react-three/drei'
import * as THREE from 'three'
import { useRacingModel } from '../kit'
import { ROAD_HALF_WIDTH, track } from '../track/layout'
import { FLOOR_Y } from './boardSize'
import { scenery, type Placement } from './scenery'

const HALF = ROAD_HALF_WIDTH

/**
 * Trackside dressing, visual only: grandstands, pits, tents and flags from
 * the Racing Kit (laid out in scenery.ts), the checkered start/finish line
 * and the 8-car starting grid.
 */
export function Props() {
  return (
    <>
      {scenery.map((p, i) => (
        <SceneryModel key={i} p={p} />
      ))}
      <StartLine />
      <Grid />
    </>
  )
}

function SceneryModel({ p }: { p: Placement }) {
  const scene = useRacingModel(p.model)
  return <Clone object={scene} position={[p.x, FLOOR_Y, p.z]} rotation={[0, p.yaw, 0]} scale={p.scale} />
}

function useCanvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d')!)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

const decal = { polygonOffset: true, polygonOffsetFactor: -2, transparent: true, roughness: 0.9 } as const

function StartLine() {
  const cols = 16
  const rows = 3
  const tex = useCanvasTexture(cols * 16, rows * 16, (ctx) => {
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++) {
        ctx.fillStyle = (x + y) % 2 ? '#1d2433' : '#ffffff'
        ctx.fillRect(x * 16, y * 16, 16, 16)
      }
  })
  tex.magFilter = THREE.NearestFilter
  const { x, z, yaw } = track.finish
  return (
    <mesh position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, yaw]} receiveShadow>
      <planeGeometry args={[HALF * 2, (HALF * 2 * rows) / cols]} />
      <meshStandardMaterial map={tex} {...decal} />
    </mesh>
  )
}

/** All 8 starting positions, F1 style. */
function Grid() {
  return (
    <>
      {track.grid.map((slot) => (
        <GridSlot key={slot.position} slot={slot} />
      ))}
    </>
  )
}

const SLOT_WIDTH = 1.5
const SLOT_LENGTH = 2

/**
 * One grid position: a white bracket just ahead of the car's nose (bar across,
 * short legs back) and the position number painted beside it, on the side
 * nearer the edge of the road, readable from the driver's seat.
 */
function GridSlot({ slot }: { slot: (typeof track.grid)[number] }) {
  const bracket = useCanvasTexture(260, 320, (ctx) => {
    // Chunky lines like the Racing Kit's start-position markings.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 260, 32) // front bar
    ctx.fillRect(0, 0, 32, 150) // left leg
    ctx.fillRect(228, 0, 32, 150) // right leg
  })
  const number = useCanvasTexture(160, 160, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = '900 128px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(slot.position), 80, 88)
  })

  // Positions in the slot's own frame: +z forward, +x left.
  const fx = Math.sin(slot.yaw)
  const fz = Math.cos(slot.yaw)
  const at = (forward: number, left: number) => ({
    x: slot.x + fx * forward + Math.cos(slot.yaw) * left,
    z: slot.z + fz * forward - Math.sin(slot.yaw) * left,
  })
  // Car centre sits ~0.4 m behind the middle of the box, nose just short of the bar.
  const box = at(0.3, 0)
  const outward = slot.position % 2 === 1 ? 1 : -1 // odd slots are on the left
  const label = at(0.6, outward * (SLOT_WIDTH / 2 + 0.45))

  // Canvas top = front of the slot; rotating by yaw + π makes it read upright
  // for a driver looking down the track.
  const rotation: [number, number, number] = [-Math.PI / 2, 0, slot.yaw + Math.PI]
  return (
    <>
      <mesh position={[box.x, 0.04, box.z]} rotation={rotation} receiveShadow>
        <planeGeometry args={[SLOT_WIDTH, SLOT_LENGTH]} />
        <meshStandardMaterial map={bracket} {...decal} />
      </mesh>
      <mesh position={[label.x, 0.04, label.z]} rotation={rotation} receiveShadow>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial map={number} {...decal} />
      </mesh>
    </>
  )
}

for (const name of new Set(scenery.map((p) => p.model))) useRacingModel.preload(name)
