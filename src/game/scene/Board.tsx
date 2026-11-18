import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from './palette'
import { BOARD_THICKNESS, FLOOR_Y, board } from './boardSize'

// Cheap smooth 2D value noise, enough for grass patches.
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

const SOIL_LAYERS = [
  { color: PALETTE.grassDark, height: 0.5 }, // grass lip
  { color: PALETTE.soil, height: BOARD_THICKNESS * 0.55 },
  { color: PALETTE.soilDark, height: BOARD_THICKNESS * 0.45 - 0.5 },
]

/**
 * The diorama base: a grass top with colour patches and mowed stripes,
 * sitting on layered soil, floating in the sky.
 */
export function Board() {
  const grass = useMemo(() => {
    const geo = new THREE.PlaneGeometry(board.width, board.depth, Math.ceil(board.width / 1.5), Math.ceil(board.depth / 1.5))
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const light = new THREE.Color(PALETTE.grassLight)
    const mid = new THREE.Color(PALETTE.grassMid)
    const dark = new THREE.Color(PALETTE.grassDark)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + board.centerX
      const z = pos.getZ(i) + board.centerZ
      const n = noise(x * 0.045, z * 0.045) * 0.7 + noise(x * 0.18, z * 0.18) * 0.3
      c.copy(dark).lerp(mid, THREE.MathUtils.smoothstep(n, 0.2, 0.55))
      c.lerp(light, THREE.MathUtils.smoothstep(n, 0.6, 0.9))
      // Mowed stripes, like a freshly cut lawn.
      const stripe = Math.floor((x + z * 0.15) / 7) % 2 === 0 ? 1.05 : 0.96
      c.multiplyScalar(stripe)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  let y = FLOOR_Y
  return (
    <group>
      <mesh geometry={grass} position={[board.centerX, FLOOR_Y, board.centerZ]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {SOIL_LAYERS.map((layer, i) => {
        const top = y
        y -= layer.height
        return (
          <mesh key={i} position={[board.centerX, top - layer.height / 2 - 0.01, board.centerZ]} receiveShadow>
            <boxGeometry args={[board.width, layer.height, board.depth]} />
            <meshStandardMaterial color={layer.color} roughness={1} />
          </mesh>
        )
      })}
    </group>
  )
}
