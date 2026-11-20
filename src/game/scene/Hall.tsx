import { useMemo } from 'react'
import * as THREE from 'three'
import { BOARD_THICKNESS, FLOOR_Y, HALL_HEIGHT, board } from './boardSize'

/**
 * The indoor kart hall: a polished concrete floor, walls with sponsor
 * banners, steel columns and a ceiling full of light panels.
 *
 * Diorama trick: the walls and ceiling are one-sided and face inwards, so
 * from inside you see them, but the menu camera (outside, above) looks
 * straight through the near walls and the roof into the hall.
 */
export function Hall() {
  return (
    <group>
      <Floor />
      <Walls />
      <Ceiling />
    </group>
  )
}

// --- Textures drawn on a canvas ---------------------------------------------

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// Seeded random, so the floor looks the same every time.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SLAB = 6 // concrete slab size, meters

/** One 6×6 m concrete slab: mottled grey with a thin seam on two edges. */
function concreteTexture() {
  const size = 256
  const rand = mulberry32(3)
  return canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#6c7078'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 140; i++) {
      const r = 10 + rand() * 40
      ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '20,22,28'},${0.01 + rand() * 0.018})`
      ctx.beginPath()
      ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(30,32,38,0.4)'
    ctx.fillRect(0, 0, size, 2)
    ctx.fillRect(0, 0, 2, size)
  })
}

function Floor() {
  const map = useMemo(() => {
    const t = concreteTexture()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(board.width / SLAB, board.depth / SLAB)
    return t
  }, [])
  return (
    <group position={[board.centerX, 0, board.centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[board.width, board.depth]} />
        <meshStandardMaterial map={map} roughness={0.32} metalness={0.05} />
      </mesh>
      {/* The slab's sides, seen from the menu camera */}
      <mesh position={[0, FLOOR_Y - BOARD_THICKNESS / 2 - 0.01, 0]}>
        <boxGeometry args={[board.width, BOARD_THICKNESS, board.depth]} />
        <meshStandardMaterial color="#565a63" roughness={0.9} />
      </mesh>
    </group>
  )
}

// --- Walls ------------------------------------------------------------------

const DADO = 2.6 // height of the dark lower band, where the banners hang
const COLUMN_EVERY = 12

/** Made-up sponsors for the wall banners. */
const SPONSORS = [
  { name: 'NITRO NOODLES', bg: '#1f6feb', fg: '#ffffff' },
  { name: 'PITSTOP PIZZA', bg: '#ffcc00', fg: '#1a1a1a' },
  { name: 'BOLT BATTERIES', bg: '#14161c', fg: '#7cff4f' },
  { name: 'TURBO TEA', bg: '#e0352b', fg: '#ffffff' },
  { name: 'KARTCO', bg: '#ffffff', fg: '#e0352b' },
  { name: 'GRIP+ TYRES', bg: '#7b2ff7', fg: '#ffffff' },
]

function bannerTexture(s: (typeof SPONSORS)[number]) {
  return canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = s.bg
    ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = s.fg
    ctx.font = '900 64px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.name, 256, 68, 480)
  })
}

/** Corrugated cladding for the upper walls. */
function claddingTexture() {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#d3d7de'
    ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(0, 0, 10, 64)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(12, 0, 4, 64)
  })
}

type WallDef = { x: number; z: number; yaw: number; length: number }

/** Each wall's centre, the way it faces (into the hall) and its length. */
const WALLS: WallDef[] = [
  { x: board.centerX, z: board.minZ, yaw: 0, length: board.width }, // faces +z
  { x: board.centerX, z: board.maxZ, yaw: Math.PI, length: board.width }, // faces -z
  { x: board.minX, z: board.centerZ, yaw: Math.PI / 2, length: board.depth }, // faces +x
  { x: board.maxX, z: board.centerZ, yaw: -Math.PI / 2, length: board.depth }, // faces -x
]

function Walls() {
  const banners = useMemo(() => SPONSORS.map(bannerTexture), [])
  const cladding = useMemo(() => claddingTexture(), [])

  return (
    <>
      {WALLS.map((w, wi) => {
        const upper = cladding.clone()
        upper.wrapS = upper.wrapT = THREE.RepeatWrapping
        upper.repeat.set(w.length / 1.2, 1)
        upper.needsUpdate = true
        const columns = Math.floor(w.length / COLUMN_EVERY)
        const bannerCount = Math.max(1, Math.floor(w.length / 9))
        return (
          <group key={wi} position={[w.x, FLOOR_Y, w.z]} rotation={[0, w.yaw, 0]}>
            {/* Dark lower band */}
            <mesh position={[0, DADO / 2, 0]}>
              <planeGeometry args={[w.length, DADO]} />
              <meshStandardMaterial color="#262a34" roughness={0.8} />
            </mesh>
            {/* Light cladding above */}
            <mesh position={[0, DADO + (HALL_HEIGHT - DADO) / 2, 0]}>
              <planeGeometry args={[w.length, HALL_HEIGHT - DADO]} />
              <meshStandardMaterial map={upper} roughness={0.7} />
            </mesh>
            {/* High windows */}
            <mesh position={[0, HALL_HEIGHT - 1.6, 0.02]}>
              <planeGeometry args={[w.length - 4, 1.1]} />
              <meshStandardMaterial color="#cfe6ff" emissive="#bfe0ff" emissiveIntensity={0.9} />
            </mesh>
            {/* Sponsor banners */}
            {Array.from({ length: bannerCount }, (_, i) => {
              const along = -w.length / 2 + (i + 0.5) * (w.length / bannerCount)
              return (
                <mesh key={i} position={[along, 1.35, 0.03]}>
                  <planeGeometry args={[6, 1.5]} />
                  <meshStandardMaterial map={banners[(i + wi * 2) % banners.length]} roughness={0.6} />
                </mesh>
              )
            })}
            {/* Steel columns */}
            {Array.from({ length: columns + 1 }, (_, i) => {
              const along = -w.length / 2 + (i * w.length) / columns
              return (
                <mesh key={`c${i}`} position={[along, HALL_HEIGHT / 2, 0.3]} castShadow>
                  <boxGeometry args={[0.5, HALL_HEIGHT, 0.5]} />
                  <meshStandardMaterial color="#3a404c" roughness={0.5} metalness={0.4} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </>
  )
}

// --- Ceiling ----------------------------------------------------------------

const PANEL_EVERY = 8

function Ceiling() {
  const panels = useMemo(() => {
    const out: { x: number; z: number }[] = []
    for (let x = board.minX + PANEL_EVERY / 2; x < board.maxX; x += PANEL_EVERY)
      for (let z = board.minZ + PANEL_EVERY / 2; z < board.maxZ; z += PANEL_EVERY) out.push({ x, z })
    return out
  }, [])

  return (
    <group position={[0, FLOOR_Y + HALL_HEIGHT, 0]}>
      {/* Faces down: visible from inside, see-through from above */}
      <mesh position={[board.centerX, 0, board.centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[board.width, board.depth]} />
        <meshStandardMaterial color="#2b2f38" roughness={0.9} />
      </mesh>
      {panels.map((p, i) => (
        <mesh key={i} position={[p.x, -0.05, p.z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.6, 1]} />
          <meshStandardMaterial color="#ffffff" emissive="#fff6e6" emissiveIntensity={1.6} />
        </mesh>
      ))}
    </group>
  )
}
