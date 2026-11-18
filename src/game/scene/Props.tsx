import { useMemo } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { modelUrl, ROAD_HALF_WIDTH } from '../track/pieces'
import { TRACK_SCALE, offsetLeft, pointOnPiece, track } from '../track/layout'
import { FLOOR_Y } from './boardSize'

const S = TRACK_SCALE
const HALF = ROAD_HALF_WIDTH * S

/**
 * Trackside dressing, all visual only (it sits behind the walls):
 * tyre stacks on the outside of corners, cones on the inside apex,
 * a checkered start/finish line and the grid box.
 */
export function Props() {
  const tyre = useGLTF(modelUrl('wheel-large')).scene
  const cone = useGLTF(modelUrl('item-cone')).scene
  const box = useGLTF(modelUrl('item-box')).scene

  const { tyres, cones } = useMemo(() => {
    const tyres: { x: number; z: number; r: number }[] = []
    const cones: { x: number; z: number; r: number }[] = []
    for (const placed of track.pieces) {
      if (placed.id === 'S') continue
      const big = placed.id === 'RL' || placed.id === 'LL'
      const stacks = big ? [0.15, 0.32, 0.5, 0.68, 0.85] : [0.25, 0.5, 0.75]
      for (const t of stacks) {
        const p = pointOnPiece(placed, t)
        // Outside of the turn is the opposite side from `inside`.
        tyres.push({ ...offsetLeft(p, -p.inside * (HALF + 2.4)), r: p.yaw })
      }
      const apex = pointOnPiece(placed, 0.5)
      for (const k of [-1, 0, 1]) {
        const q = pointOnPiece(placed, 0.5 + k * 0.12)
        cones.push({ ...offsetLeft(q, q.inside * (HALF + 1.6)), r: apex.yaw + k })
      }
    }
    return { tyres, cones }
  }, [])

  // A couple of crate piles near the start, just for colour.
  const piles = useMemo(() => {
    const start = track.finish
    return [
      { ...offsetLeft({ ...start, z: start.z + 10 }, HALF + 4), r: 0.3 },
      { ...offsetLeft({ ...start, z: start.z - 6 }, -(HALF + 5)), r: -0.5 },
    ]
  }, [])

  return (
    <>
      {tyres.map((t, i) => (
        <group key={`t${i}`} position={[t.x, FLOOR_Y, t.z]} rotation={[0, t.r, 0]}>
          {[0, 1, 2].map((level) => (
            <Clone
              key={level}
              object={tyre}
              // The tyre model stands up on its side; lay it flat and stack it.
              rotation={[0, 0, Math.PI / 2]}
              position={[0, (0.094 + level * 0.19) * S, 0]}
              scale={S}
              castShadow
              receiveShadow
            />
          ))}
        </group>
      ))}
      {cones.map((c, i) => (
        <Clone key={`c${i}`} object={cone} position={[c.x, FLOOR_Y, c.z]} rotation={[0, c.r, 0]} scale={S * 1.2} castShadow />
      ))}
      {piles.map((p, i) => (
        <group key={`p${i}`} position={[p.x, FLOOR_Y, p.z]} rotation={[0, p.r, 0]}>
          <Clone object={box} position={[-1, 0, 0]} scale={S} castShadow />
          <Clone object={box} position={[1, 0, 0.3]} rotation={[0, 0.4, 0]} scale={S} castShadow />
          <Clone object={box} position={[0, 0.445 * S, 0.1]} rotation={[0, -0.2, 0]} scale={S} castShadow />
        </group>
      ))}
      <StartLine />
      <GridBox />
    </>
  )
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
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, yaw]} receiveShadow>
      <planeGeometry args={[HALF * 2, (HALF * 2 * rows) / cols]} />
      <meshStandardMaterial map={tex} {...decal} />
    </mesh>
  )
}

function GridBox() {
  const tex = useCanvasTexture(128, 160, (ctx) => {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(8, 152)
    ctx.lineTo(8, 8)
    ctx.lineTo(120, 8)
    ctx.lineTo(120, 152)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('1', 64, 112)
  })
  const { x, z, yaw } = track.start
  // Box drawn just behind the kart's nose; text faces the driver.
  return (
    <mesh position={[x, 0.02, z + 0.4]} rotation={[-Math.PI / 2, 0, yaw + Math.PI]}>
      <planeGeometry args={[2.4, 3]} />
      <meshStandardMaterial map={tex} {...decal} opacity={0.9} />
    </mesh>
  )
}

useGLTF.preload(modelUrl('wheel-large'))
useGLTF.preload(modelUrl('item-cone'))
useGLTF.preload(modelUrl('item-box'))
