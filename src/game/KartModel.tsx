import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { kartState } from './kartState'
import { frameStep } from './time'

/**
 * The kart, built from simple shapes so every colour can be changed.
 * All sizes are in meters; the kart faces +Z and sits on y = 0.
 *
 *   body   — side pods and front fairing (the main colour)
 *   accent — rear bumper and nose trim
 *   suit / helmet / stripe — the driver
 */
export type KartColors = {
  body: string
  accent: string
  suit: string
  helmet: string
  stripe: string
}

export const DEFAULT_KART_COLORS: KartColors = {
  body: '#ff7a1a',
  accent: '#f4f4f2',
  suit: '#2b3040',
  helmet: '#ff7a1a',
  stripe: '#1c1f26',
}

export const KART_SCALE = 1.1 // the kart below is ~1.6 m long; this makes it ~1.75 m

// Wheel layout (before KART_SCALE).
const FRONT = { x: 0.56, z: 0.55, r: 0.135, w: 0.13 }
const REAR = { x: 0.6, z: -0.52, r: 0.15, w: 0.2 }

/** What the model animates from: the player's kart or a ghost replay. */
export type KartMotion = { speed: number; steer: number }

type Props = {
  colors?: KartColors
  /** Draw as a see-through ghost (no shadows, one flat colour). */
  ghost?: string
  motion?: KartMotion
}

export function KartModel({ colors = DEFAULT_KART_COLORS, ghost, motion = kartState }: Props) {
  const m = useMemo(() => {
    if (ghost) {
      const g = new THREE.MeshStandardMaterial({
        color: ghost,
        emissive: ghost,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
      return { body: g, accent: g, frame: g, dark: g, rubber: g, hub: g, suit: g, helmet: g, stripe: g, visor: g }
    }
    const mat = (color: string, roughness: number, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness })
    return {
      body: mat(colors.body, 0.35),
      accent: mat(colors.accent, 0.4),
      frame: mat('#c3c8d0', 0.35, 0.6),
      dark: mat('#23262d', 0.7),
      rubber: mat('#1b1c20', 0.9),
      hub: mat('#d9dce2', 0.3, 0.5),
      suit: mat(colors.suit, 0.8),
      helmet: mat(colors.helmet, 0.25),
      stripe: mat(colors.stripe, 0.3),
      visor: mat('#141a24', 0.08, 0.3),
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
    if (head.current) head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, -motion.steer * 0.12, 0.2)
  })

  const addSpinner = (g: THREE.Group | null) => {
    if (g && !spinners.current.includes(g)) spinners.current.push(g)
  }
  const addSteerer = (g: THREE.Group | null) => {
    if (g && !steerers.current.includes(g)) steerers.current.push(g)
  }

  const Wheel = ({ x, z, r, w, front }: { x: number; z: number; r: number; w: number; front?: boolean }) => (
    <group position={[x, r, z]} ref={front ? addSteerer : undefined}>
      <group ref={addSpinner} userData={{ radius: r }}>
        <mesh material={m.rubber} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[r, r, w, 20]} />
        </mesh>
        <mesh material={m.hub} rotation={[0, 0, Math.PI / 2]} position={[Math.sign(x) * 0.006, 0, 0]}>
          <cylinderGeometry args={[r * 0.55, r * 0.55, w + 0.01, 12]} />
        </mesh>
      </group>
    </group>
  )

  return (
    <group ref={root} scale={KART_SCALE}>
      {/* Wheels */}
      <Wheel x={FRONT.x} z={FRONT.z} r={FRONT.r} w={FRONT.w} front />
      <Wheel x={-FRONT.x} z={FRONT.z} r={FRONT.r} w={FRONT.w} front />
      <Wheel x={REAR.x} z={REAR.z} r={REAR.r} w={REAR.w} />
      <Wheel x={-REAR.x} z={REAR.z} r={REAR.r} w={REAR.w} />

      {/* Chassis: floor tray, side rails, axles */}
      <mesh material={m.frame} position={[0, 0.1, 0]}>
        <boxGeometry args={[0.72, 0.03, 1.25]} />
      </mesh>
      <Tube from={[0.4, 0.11, -0.62]} to={[0.4, 0.11, 0.62]} r={0.022} material={m.frame} />
      <Tube from={[-0.4, 0.11, -0.62]} to={[-0.4, 0.11, 0.62]} r={0.022} material={m.frame} />
      <Tube from={[-REAR.x, REAR.r, REAR.z]} to={[REAR.x, REAR.r, REAR.z]} r={0.025} material={m.frame} />
      <Tube from={[-FRONT.x + 0.05, FRONT.r, FRONT.z]} to={[FRONT.x - 0.05, FRONT.r, FRONT.z]} r={0.02} material={m.frame} />

      {/* Bodywork */}
      <Rounded material={m.body} size={[0.17, 0.15, 0.62]} position={[0.48, 0.2, 0.0]} />
      <Rounded material={m.body} size={[0.17, 0.15, 0.62]} position={[-0.48, 0.2, 0.0]} />
      <Rounded material={m.body} size={[1.0, 0.13, 0.3]} position={[0, 0.19, 0.8]} rotation={[-0.22, 0, 0]} />
      <Rounded material={m.accent} size={[0.98, 0.04, 0.06]} position={[0, 0.27, 0.86]} rotation={[-0.22, 0, 0]} />
      <Rounded material={m.body} size={[0.44, 0.24, 0.05]} position={[0, 0.3, 0.6]} rotation={[-0.75, 0, 0]} />

      {/* Rear bumper */}
      <Tube from={[-0.58, 0.18, -0.8]} to={[0.58, 0.18, -0.8]} r={0.035} material={m.accent} />
      <Tube from={[-0.35, 0.12, -0.6]} to={[-0.35, 0.18, -0.8]} r={0.02} material={m.frame} />
      <Tube from={[0.35, 0.12, -0.6]} to={[0.35, 0.18, -0.8]} r={0.02} material={m.frame} />

      {/* Seat and engine */}
      <Rounded material={m.dark} size={[0.42, 0.09, 0.32]} position={[0, 0.16, -0.06]} />
      <Rounded material={m.dark} size={[0.42, 0.38, 0.1]} position={[0, 0.33, -0.22]} rotation={[0.35, 0, 0]} />
      <mesh material={m.frame} position={[0.34, 0.27, -0.42]}>
        <boxGeometry args={[0.2, 0.22, 0.24]} />
      </mesh>
      <Tube from={[0.34, 0.3, -0.54]} to={[0.42, 0.34, -0.72]} r={0.03} material={m.dark} />

      {/* Steering column and wheel */}
      <Tube from={[0, 0.14, 0.45]} to={[0, 0.42, 0.24]} r={0.018} material={m.frame} />
      <group position={[0, 0.43, 0.23]} rotation={[-0.92, 0, 0]}>
        <group ref={wheel}>
          <mesh material={m.dark}>
            <torusGeometry args={[0.1, 0.018, 8, 20]} />
          </mesh>
          <mesh material={m.dark}>
            <boxGeometry args={[0.2, 0.025, 0.02]} />
          </mesh>
        </group>
      </group>

      {/* Driver */}
      <Rounded material={m.suit} size={[0.36, 0.42, 0.22]} position={[0, 0.52, -0.14]} rotation={[0.32, 0, 0]} />
      <Tube from={[0.11, 0.24, -0.02]} to={[0.13, 0.22, 0.48]} r={0.06} material={m.suit} />
      <Tube from={[-0.11, 0.24, -0.02]} to={[-0.13, 0.22, 0.48]} r={0.06} material={m.suit} />
      <Tube from={[0.19, 0.66, -0.1]} to={[0.1, 0.46, 0.2]} r={0.045} material={m.suit} />
      <Tube from={[-0.19, 0.66, -0.1]} to={[-0.1, 0.46, 0.2]} r={0.045} material={m.suit} />
      <group ref={head} position={[0, 0.74, -0.08]}>
        <mesh material={m.suit} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.08, 10]} />
        </mesh>
        <group position={[0, 0.18, 0]}>
          <mesh material={m.helmet}>
            <sphereGeometry args={[0.16, 24, 18]} />
          </mesh>
          {/* Visor band across the front */}
          <mesh material={m.visor}>
            <sphereGeometry args={[0.163, 24, 8, Math.PI / 2 - 0.95, 1.9, 1.15, 0.5]} />
          </mesh>
          {/* Stripe over the top, front to back */}
          <mesh material={m.stripe} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.161, 0.03, 6, 24, Math.PI * 0.95]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// --- Small helpers ----------------------------------------------------------

type Vec3 = [number, number, number]

/** A rounded box (bodywork, seat, torso). */
function Rounded({
  size,
  position,
  rotation,
  material,
}: {
  size: Vec3
  position: Vec3
  rotation?: Vec3
  material: THREE.Material
}) {
  const radius = Math.min(...size) * 0.35
  return (
    <RoundedBox args={size} radius={radius} smoothness={3} position={position} rotation={rotation} material={material} />
  )
}

/** A tube between two points (frame rails, bumper, arms, legs). */
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
