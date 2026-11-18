import { useMemo } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { modelUrl } from '../assets'
import { ROAD_HALF_WIDTH, RUNOFF_WIDTH, offsetLeft, track } from '../track/layout'
import { FLOOR_Y } from './boardSize'

const HALF = ROAD_HALF_WIDTH
const CRATE_SCALE = 5

/**
 * Trackside dressing, visual only: crate piles behind the tyre walls by the
 * start, the checkered start/finish line and the grid box.
 */
export function Props() {
  const box = useGLTF(modelUrl('item-box')).scene

  // A couple of crate piles near the start, just for colour.
  const piles = useMemo(() => {
    const start = track.finish
    const behindWall = HALF + RUNOFF_WIDTH + 5
    return [
      { ...offsetLeft({ ...start, z: start.z + 14 }, behindWall), r: 0.3 },
      { ...offsetLeft({ ...start, z: start.z - 10 }, behindWall + 2), r: -0.5 },
    ]
  }, [])

  const S = CRATE_SCALE
  return (
    <>
      {piles.map((p, i) => (
        <group key={`p${i}`} position={[p.x, FLOOR_Y, p.z]} rotation={[0, p.r, 0]}>
          <Clone object={box} position={[-1.2, 0, 0]} scale={S} castShadow />
          <Clone object={box} position={[1.2, 0, 0.3]} rotation={[0, 0.4, 0]} scale={S} castShadow />
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
    <mesh position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, yaw]} receiveShadow>
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
    <mesh position={[x, 0.04, z + 0.4]} rotation={[-Math.PI / 2, 0, yaw + Math.PI]}>
      <planeGeometry args={[2.4, 3]} />
      <meshStandardMaterial map={tex} {...decal} opacity={0.9} />
    </mesh>
  )
}

useGLTF.preload(modelUrl('item-box'))
