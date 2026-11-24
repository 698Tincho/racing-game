import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { kartState } from './kartState'
import { frameStep } from './time'

/**
 * NOT USED: the kart we built in code before switching to the downloaded model
 * (see KartModel.tsx). Kept for reference only.
 *
 * The kart, built from simple shapes in a chunky toy style: two-tone bodywork
 * with racing stripes, a rear wing, fat tyres, and no driver body, just a big
 * helmet sitting in a bucket seat.
 * All sizes are in meters; the kart faces +Z and sits on y = 0.
 * Open the game with ?garage to look at it from every side.
 *
 *   body   — nose, spoiler, side pods, bumper and wing (the main colour)
 *   accent — racing stripes and rims
 *   helmet / stripe — the helmet and the stripe over it
 */
export type KartColors = {
  body: string
  accent: string
  helmet: string
  stripe: string
}

export const DEFAULT_KART_COLORS: KartColors = {
  body: '#ff6a13',
  accent: '#f6f1e7',
  helmet: '#ff6a13',
  stripe: '#1c1f26',
}

export const KART_SCALE = 1.05 // the kart below is ~1.85 m long; this makes it ~1.95 m

// Wheel layout (before KART_SCALE). Rear tyres are fatter, like a real kart.
type WheelSpec = { x: number; z: number; r: number; w: number }
const FRONT: WheelSpec = { x: 0.5, z: 0.5, r: 0.16, w: 0.18 }
const REAR: WheelSpec = { x: 0.53, z: -0.48, r: 0.2, w: 0.28 }

/** What the model animates from: the player's kart or a ghost replay. */
type KartMotion = { speed: number; steer: number }

type Props = {
  colors?: KartColors
  /** Draw as a see-through ghost (no shadows, one flat colour). */
  ghost?: string
  motion?: KartMotion
}

type Materials = Record<
  'body' | 'accent' | 'frame' | 'tray' | 'dark' | 'seat' | 'rubber' | 'helmet' | 'stripe' | 'visor',
  THREE.Material
>

export function CodeKart({ colors = DEFAULT_KART_COLORS, ghost, motion = kartState }: Props) {
  const m = useMemo<Materials>(() => {
    if (ghost) {
      const g = new THREE.MeshStandardMaterial({
        color: ghost,
        emissive: ghost,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
      return { body: g, accent: g, frame: g, tray: g, dark: g, seat: g, rubber: g, helmet: g, stripe: g, visor: g }
    }
    const mat = (color: string, roughness: number, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness })
    // Glossy toy plastic: a clear coat over a slightly soft base.
    const plastic = (color: string) =>
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.2 })
    return {
      body: plastic(colors.body),
      accent: plastic(colors.accent),
      frame: mat('#a9afb9', 0.3, 0.6),
      tray: mat('#b7bcc4', 0.55, 0.2),
      dark: mat('#2a2d35', 0.6),
      seat: mat('#34373f', 0.75),
      rubber: mat('#2b2c31', 0.85),
      helmet: plastic(colors.helmet),
      stripe: plastic(colors.stripe),
      visor: new THREE.MeshPhysicalMaterial({ color: '#10151f', roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
    }
  }, [colors, ghost])

  const root = useRef<THREE.Group>(null)
  const spinners = useRef<THREE.Group[]>([])
  const steerers = useRef<THREE.Group[]>([])
  const wheel = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)

  // Real karts cast shadows; ghosts don't.
  useLayoutEffect(() => {
    root.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = !ghost
        o.receiveShadow = !ghost
      }
    })
  }, [ghost])

  useFrame((_, delta) => {
    const dt = frameStep(delta)
    for (const s of spinners.current) {
      const r = (s.userData.radius as number) * KART_SCALE
      s.rotation.x += (motion.speed / r) * dt
    }
    for (const s of steerers.current) s.rotation.y = motion.steer * 0.42
    if (wheel.current) wheel.current.rotation.z = -motion.steer * 1.2

    // The helmet leans into corners (more at speed) and turns to look where it's going.
    if (head.current) {
      const k = 1 - Math.exp(-10 * dt)
      const speedFactor = Math.min(1, Math.abs(motion.speed) / 8)
      const lean = -motion.steer * (0.06 + 0.14 * speedFactor)
      head.current.rotation.z += (lean - head.current.rotation.z) * k
      head.current.rotation.y += (motion.steer * 0.3 - head.current.rotation.y) * k
    }
  })

  const addSpinner = (g: THREE.Group | null) => {
    if (g && !spinners.current.includes(g)) spinners.current.push(g)
  }
  const addSteerer = (g: THREE.Group | null) => {
    if (g && !steerers.current.includes(g)) steerers.current.push(g)
  }
  const wheelProps = { m, onSpin: addSpinner }

  return (
    <group ref={root} scale={KART_SCALE}>
      {/* Wheels */}
      <Wheel spec={FRONT} side={1} onSteer={addSteerer} {...wheelProps} />
      <Wheel spec={FRONT} side={-1} onSteer={addSteerer} {...wheelProps} />
      <Wheel spec={REAR} side={1} {...wheelProps} />
      <Wheel spec={REAR} side={-1} {...wheelProps} />

      {/* Chassis: light floor tray and a grey tube frame */}
      <mesh material={m.tray} position={[0, 0.085, 0.02]}>
        <boxGeometry args={[0.58, 0.02, 1.0]} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <Tube from={[s * 0.32, 0.11, -0.58]} to={[s * 0.32, 0.11, 0.6]} r={0.026} material={m.frame} />
          <Tube from={[s * 0.32, 0.11, 0.6]} to={[s * 0.12, 0.11, 0.72]} r={0.024} material={m.frame} />
          {/* Kingpin up to the front stub axle */}
          <Tube from={[s * 0.38, 0.11, FRONT.z]} to={[s * 0.38, FRONT.r + 0.03, FRONT.z]} r={0.022} material={m.frame} />
          <Tube from={[s * 0.32, 0.11, FRONT.z]} to={[s * 0.38, 0.11, FRONT.z]} r={0.022} material={m.frame} />
          {/* Side pod mounts and rear bumper mounts */}
          <Tube from={[s * 0.32, 0.14, 0.15]} to={[s * 0.45, 0.17, 0.15]} r={0.02} material={m.frame} />
          <Tube from={[s * 0.32, 0.14, -0.15]} to={[s * 0.45, 0.17, -0.15]} r={0.02} material={m.frame} />
          <Tube from={[s * 0.28, 0.11, -0.58]} to={[s * 0.28, 0.18, -0.74]} r={0.022} material={m.frame} />
          {/* Pedals */}
          <Rounded material={m.dark} size={[0.06, 0.1, 0.03]} position={[s * 0.09, 0.15, 0.56]} rotation={[-0.4, 0, 0]} />
        </group>
      ))}
      <Tube from={[-0.32, 0.11, -0.58]} to={[0.32, 0.11, -0.58]} r={0.024} material={m.frame} />
      <Tube from={[-REAR.x, REAR.r, REAR.z]} to={[REAR.x, REAR.r, REAR.z]} r={0.03} material={m.frame} />
      <Tube from={[-FRONT.x + 0.06, FRONT.r, FRONT.z]} to={[FRONT.x - 0.06, FRONT.r, FRONT.z]} r={0.02} material={m.frame} />
      {/* Brake disc and sprocket on the rear axle */}
      <mesh material={m.dark} position={[-0.2, REAR.r, REAR.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.015, 24]} />
      </mesh>
      <mesh material={m.frame} position={[0.24, REAR.r, REAR.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.075, 0.075, 0.02, 18]} />
      </mesh>

      {/* Side pods: long chunky bars between the wheels, with a wide and a
          thin racing band wrapped around them */}
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.53, 0.2, 0.03]}>
          <Rounded material={m.body} size={[0.2, 0.18, 0.6]} position={[0, 0, 0]} />
          <Rounded material={m.accent} size={[0.206, 0.186, 0.11]} position={[0, 0, 0.09]} radius={0.06} />
          <Rounded material={m.accent} size={[0.206, 0.186, 0.035]} position={[0, 0, -0.03]} radius={0.06} />
        </group>
      ))}

      {/* Front spoiler (a curved band) and a long nose cone up to the steering
          wheel, both with a stripe down the middle */}
      <mesh material={m.body} geometry={SHAPES.spoiler} position={[0, 0.12, 0]} />
      <Rounded material={m.accent} size={[0.13, 0.02, 0.2]} position={[0, 0.25, 0.85]} radius={0.008} />
      <group position={[0, 0.27, 0.58]} rotation={[0.35, 0, 0]}>
        <Rounded material={m.body} size={[0.3, 0.15, 0.52]} position={[0, 0, 0]} />
        <Rounded material={m.accent} size={[0.11, 0.156, 0.526]} position={[0, 0, 0]} radius={0.05} />
      </group>

      {/* Rear bumper: one wide piece that wraps around the rear tyres, stripe in the middle */}
      <mesh material={m.body} geometry={SHAPES.bumper} position={[0, 0.14, 0]} />
      <Rounded material={m.accent} size={[0.24, 0.23, 0.22]} position={[0, 0.21, -0.795]} radius={0.045} />

      {/* Rear wing on two struts, with the stripe across the middle. Kept low so
          the chase camera still sees the whole helmet above it. */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Tube from={[s * 0.32, 0.12, -0.58]} to={[s * 0.3, 0.5, -0.7]} r={0.022} material={m.frame} />
          <Rounded material={m.body} size={[0.035, 0.17, 0.27]} position={[s * 0.6, 0.51, -0.72]} />
        </group>
      ))}
      <group position={[0, 0.53, -0.72]} rotation={[0.12, 0, 0]}>
        <Rounded material={m.body} size={[1.2, 0.045, 0.24]} position={[0, 0, 0]} />
        <Rounded material={m.accent} size={[0.28, 0.05, 0.245]} position={[0, 0, 0]} radius={0.015} />
      </group>

      {/* Steering column and three-spoke wheel */}
      <Tube from={[0, 0.12, 0.48]} to={[0, 0.41, 0.22]} r={0.02} material={m.frame} />
      <group position={[0, 0.42, 0.2]} rotation={[-1.0, 0, 0]}>
        <group ref={wheel}>
          <mesh material={m.dark}>
            <torusGeometry args={[0.12, 0.026, 10, 28]} />
          </mesh>
          {[Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 - (2 * Math.PI) / 3].map((a) => (
            <mesh key={a} material={m.frame} position={[Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0]} rotation={[0, 0, a + Math.PI / 2]}>
              <boxGeometry args={[0.028, 0.12, 0.014]} />
            </mesh>
          ))}
          <mesh material={m.body} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
          </mesh>
        </group>
      </group>

      {/* Curved bucket seat: a cushion and a U-shaped shell, tilted back */}
      <group position={[0, 0.1, -0.15]} rotation={[0.2, 0, 0]}>
        <Rounded material={m.seat} size={[0.36, 0.07, 0.3]} position={[0, 0.03, 0.01]} />
        <mesh material={m.seat} geometry={SHAPES.seat} position={[0, 0.02, 0]} />
      </group>

      {/* Engine beside the seat, pipe into a big silver silencer behind it */}
      <Rounded material={m.frame} size={[0.18, 0.2, 0.2]} position={[0.3, 0.24, -0.4]} />
      <mesh material={m.dark} position={[0.3, 0.4, -0.4]}>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 14]} />
      </mesh>
      {[0.37, 0.395, 0.42].map((y) => (
        <mesh key={y} material={m.frame} position={[0.3, y, -0.4]}>
          <cylinderGeometry args={[0.085, 0.085, 0.012, 16]} />
        </mesh>
      ))}
      <Tube from={[0.3, 0.28, -0.5]} to={[0.2, 0.36, -0.62]} r={0.03} material={m.frame} />
      <Tube from={[-0.26, 0.36, -0.63]} to={[0.22, 0.36, -0.63]} r={0.07} material={m.frame} />
      <Tube from={[-0.26, 0.36, -0.63]} to={[-0.34, 0.37, -0.66]} r={0.025} material={m.dark} />

      {/* Just the helmet, resting on the seat. Pivots at the neck to lean. */}
      <group ref={head} position={[0, 0.42, -0.17]}>
        <group position={[0, 0.17, 0]}>
          <mesh material={m.helmet}>
            <sphereGeometry args={[0.2, 32, 24]} />
          </mesh>
          {/* Dark rim around the bottom opening */}
          <mesh material={m.dark} position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.03, 8, 24]} />
          </mesh>
          {/* Visor across the front */}
          <mesh material={m.visor}>
            <sphereGeometry args={[0.204, 28, 10, Math.PI / 2 - 0.85, 1.7, 1.0, 0.6]} />
          </mesh>
          {/* Wide flat stripe from the back, over the top, to just above the visor.
              (A band of a sphere turned on its side: phi runs front → top → back.) */}
          <mesh material={m.stripe} rotation={[0, 0, Math.PI / 2]}>
            <sphereGeometry args={[0.2025, 32, 2, 2.27, 2.63, Math.PI / 2 - 0.28, 0.56]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// --- Shapes -------------------------------------------------------------------

/**
 * A plan-view outline extruded upward with rounded edges. Points are given as
 * (x, -z) so the outline reads like a top view with the front pointing down.
 */
function slab(shape: THREE.Shape, height: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 16,
  })
  g.rotateX(-Math.PI / 2) // outline y → -z, extrusion → up
  return g
}

/** Front spoiler: a curved band in front of the front wheels, open towards the driver. */
function spoilerShape() {
  const cz = 0.42 // centre of the curve (z)
  const inner = 0.34
  const outer = 0.5
  const half = 0.96 // ±55°: the tips stop just inside the front wheels
  const pts: THREE.Vector2[] = []
  const N = 24
  for (let i = 0; i <= N; i++) {
    const a = -half + (2 * half * i) / N
    pts.push(new THREE.Vector2(outer * Math.sin(a), -(cz + outer * Math.cos(a))))
  }
  for (let i = N; i >= 0; i--) {
    const a = -half + (2 * half * i) / N
    pts.push(new THREE.Vector2(inner * Math.sin(a), -(cz + inner * Math.cos(a))))
  }
  return new THREE.Shape(pts)
}

/** Rear bumper: straight across the back, ends wrapping forward around the tyres. */
function bumperShape() {
  const s = new THREE.Shape()
  s.moveTo(-0.5, 0.73)
  s.lineTo(0.5, 0.73)
  s.quadraticCurveTo(0.62, 0.73, 0.64, 0.7)
  s.lineTo(0.7, 0.7)
  s.quadraticCurveTo(0.7, 0.86, 0.56, 0.86)
  s.lineTo(-0.56, 0.86)
  s.quadraticCurveTo(-0.7, 0.86, -0.7, 0.7)
  s.lineTo(-0.64, 0.7)
  s.quadraticCurveTo(-0.62, 0.73, -0.5, 0.73)
  return s
}

/** Seat shell: a U open towards the front, curving round behind the helmet. */
function seatShape() {
  const outer = 0.22
  const inner = 0.165
  const front = -0.1 // the sides reach 0.1 m forward of the curve's centre
  const s = new THREE.Shape()
  s.moveTo(outer, front)
  s.lineTo(outer, 0)
  s.absarc(0, 0, outer, 0, Math.PI, false) // round the back
  s.lineTo(-outer, front)
  s.lineTo(-inner, front)
  s.lineTo(-inner, 0)
  s.absarc(0, 0, inner, Math.PI, 0, true)
  s.lineTo(inner, front)
  s.closePath()
  return s
}

/** A tyre with rounded shoulders: a profile spun around the axle. */
function tyreGeometry({ r, w }: WheelSpec) {
  const inner = r * 0.62
  const c = Math.min(r - inner, w / 2) * 0.6 // shoulder radius
  const pts: THREE.Vector2[] = [new THREE.Vector2(inner, -w / 2)]
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = from + (i / 6) * (Math.PI / 2)
      pts.push(new THREE.Vector2(cx + Math.cos(a) * c, cy + Math.sin(a) * c))
    }
  }
  corner(r - c, -w / 2 + c, -Math.PI / 2)
  corner(r - c, w / 2 - c, 0)
  pts.push(new THREE.Vector2(inner, w / 2))
  const g = new THREE.LatheGeometry(pts, 32)
  g.rotateZ(Math.PI / 2) // spin axis from Y to X
  return g
}

// Built once and shared by every kart (player and ghost).
const SHAPES = {
  spoiler: slab(spoilerShape(), 0.09, 0.035),
  bumper: slab(bumperShape(), 0.14, 0.04),
  seat: slab(seatShape(), 0.34, 0.025),
}
const TYRES = new Map<WheelSpec, THREE.BufferGeometry>([
  [FRONT, tyreGeometry(FRONT)],
  [REAR, tyreGeometry(REAR)],
])

// --- Parts ------------------------------------------------------------------

type Vec3 = [number, number, number]

/** Tyre and coloured dish rim, silver hub and wheel nuts so you can see it spin. */
function Wheel({
  spec,
  side,
  m,
  onSpin,
  onSteer,
}: {
  spec: WheelSpec
  side: 1 | -1
  m: Materials
  onSpin: (g: THREE.Group | null) => void
  onSteer?: (g: THREE.Group | null) => void
}) {
  const { r, w } = spec
  const inner = r * 0.62
  const face = side * w * 0.38
  return (
    <group position={[side * spec.x, r, spec.z]} ref={onSteer}>
      <group ref={onSpin} userData={{ radius: r }}>
        <mesh material={m.rubber} geometry={TYRES.get(spec)} />
        <mesh material={m.accent} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[inner, inner, w * 0.76, 24]} />
        </mesh>
        {/* Raised hub in the middle of the dish */}
        <mesh material={m.frame} rotation={[0, 0, Math.PI / 2]} position={[side * 0.012, 0, 0]}>
          <cylinderGeometry args={[r * 0.26, r * 0.3, w * 0.76, 16]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2
          return (
            <mesh
              key={i}
              material={m.dark}
              position={[face + side * 0.014, Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.02, 8]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

/**
 * A rounded box (bodywork, seat). Stripes are rounded boxes a hair bigger than
 * the part they wrap; give them a corner `radius` that matches the part.
 */
function Rounded({
  size,
  position,
  rotation,
  material,
  radius = Math.min(...size) * 0.35,
}: {
  size: Vec3
  position: Vec3
  rotation?: Vec3
  material: THREE.Material
  radius?: number
}) {
  return (
    <RoundedBox args={size} radius={radius} smoothness={3} position={position} rotation={rotation} material={material} />
  )
}

/** A tube between two points (frame, mounts, pipes). */
function Tube({ from, to, r, material }: { from: Vec3; to: Vec3; r: number; material: THREE.Material }): ReactNode {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const dir = b.clone().sub(a)
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.join(), to.join()])
  return (
    <mesh position={position} quaternion={quaternion} material={material}>
      <capsuleGeometry args={[r, Math.max(0.001, length - r * 2), 4, 10]} />
    </mesh>
  )
}
