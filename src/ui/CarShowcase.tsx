import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { KartModel, type KartMotion } from '../game/KartModel'
import { useGame } from '../game/race/store'
import { PALETTE } from '../game/scene/palette'

const TURN_SPEED = 0.32 // radians per second
const CHANGE_SPIN = 3.2 // extra speed when you pick another car, fading out
const PLINTH_RADIUS = 2.4
const KERB_BLOCKS = 24
const PLINTH_TOP = 0.14
const START_ANGLE = -0.55
const CAMERA = new THREE.Vector3(6.1, 3.5, 8.1)
const LOOK_AT = new THREE.Vector3(0, 0.42, 0)
const FIT_ASPECT = 1.45 // narrower than this and the camera backs off

// Wheels turned a little, the way cars are posed for a photo.
const POSE: KartMotion = { speed: 0, steer: 0.55 }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The selected car on a kerb-ringed turntable, drawn over the live track. */
export function CarShowcase() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.NeutralToneMapping }}
      camera={{ position: CAMERA.toArray(), fov: 27 }}
    >
      <FitCamera />
      <hemisphereLight args={['#c9c7f2', PALETTE.hemisphereGround, 2]} />
      <directionalLight
        color="#ffe0c4"
        intensity={2.7}
        position={[-4, 7, 5]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight color={PALETTE.sun} intensity={1.5} position={[5, 2.5, -6]} />
      <Turntable />
    </Canvas>
  )
}

/** Backs the camera off on narrow screens, so the whole turntable stays in frame. */
function FitCamera() {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useLayoutEffect(() => {
    if (!width || !height) return
    const zoomOut = Math.max(1, FIT_ASPECT / (width / height))
    camera.position.copy(LOOK_AT).addScaledVector(CAMERA.clone().sub(LOOK_AT), zoomOut)
    camera.lookAt(LOOK_AT)
  }, [camera, width, height])

  return null
}

function Turntable() {
  const table = useRef<THREE.Group>(null)
  const carId = useGame((s) => s.carId)
  const shownCar = useRef(carId)
  const spin = useRef(0)

  useFrame((_, delta) => {
    if (!table.current) return
    if (shownCar.current !== carId) {
      shownCar.current = carId
      spin.current = CHANGE_SPIN
    }
    if (reducedMotion()) return
    const dt = Math.min(delta, 0.1)
    spin.current *= Math.exp(-3.4 * dt)
    table.current.rotation.y += (TURN_SPEED + spin.current) * dt
  })

  return (
    <group ref={table} rotation-y={START_ANGLE}>
      <mesh position-y={PLINTH_TOP / 2} receiveShadow>
        <cylinderGeometry args={[PLINTH_RADIUS - 0.14, PLINTH_RADIUS - 0.06, PLINTH_TOP, 56]} />
        <meshStandardMaterial color="#3b3350" roughness={0.85} />
      </mesh>
      <KerbRing />
      <group position-y={PLINTH_TOP}>
        <Suspense fallback={null}>
          <KartModel motion={POSE} />
        </Suspense>
      </group>
    </group>
  )
}

/** Red and white blocks round the edge, like the kerbs on the circuit. */
function KerbRing() {
  const ring = useRef<THREE.InstancedMesh>(null)
  const { geometry, material } = useMemo(() => {
    const length = ((2 * Math.PI * PLINTH_RADIUS) / KERB_BLOCKS) * 0.95
    return {
      geometry: new THREE.BoxGeometry(length, 0.2, 0.34),
      material: new THREE.MeshStandardMaterial({ color: 'white', roughness: 0.7 }),
    }
  }, [])

  useLayoutEffect(() => {
    const mesh = ring.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const scale = new THREE.Vector3(1, 1, 1)
    const position = new THREE.Vector3()
    const red = new THREE.Color('#df3f4a')
    const white = new THREE.Color('#f6f0f2')
    for (let i = 0; i < KERB_BLOCKS; i++) {
      const angle = (i / KERB_BLOCKS) * Math.PI * 2
      position.set(Math.cos(angle) * PLINTH_RADIUS, 0.1, Math.sin(angle) * PLINTH_RADIUS)
      rotation.setFromAxisAngle(up, -angle - Math.PI / 2)
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
      mesh.setColorAt(i, i % 2 ? white : red)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [geometry, material])

  return <instancedMesh ref={ring} args={[geometry, material, KERB_BLOCKS]} castShadow receiveShadow />
}
