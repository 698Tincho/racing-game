import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { KartModel, type KartMotion } from '../game/KartModel'
import { TUNING as T } from '../game/tuning'

/**
 * The garage: the kart on a turntable, to look at it from every side without
 * driving. Open with ?garage (or the link on the menu).
 */

type View = { position: [number, number, number]; target: [number, number, number]; fov: number }

const VIEWS: Record<string, View> = {
  '3/4': { position: [5.4, 3, 5.8], target: [0, 0.7, 0], fov: 32 },
  Front: { position: [0, 1.8, 8], target: [0, 0.7, 0], fov: 32 },
  Side: { position: [8.3, 1.6, 0], target: [0, 0.7, 0], fov: 32 },
  Back: { position: [-1.9, 2.4, -7.7], target: [0, 0.8, 0], fov: 32 },
  Top: { position: [0, 10.4, 0.01], target: [0, 0, 0], fov: 32 },
  // What you see while racing.
  Chase: { position: [0, T.camHeight, -T.camDistance], target: [0, T.camLookHeight, T.camLookAhead], fov: T.baseFov },
}

type ViewName = keyof typeof VIEWS

export function Garage() {
  const [view, setView] = useState<ViewName>('3/4')
  const [spin, setSpin] = useState(true)
  const [steer, setSteer] = useState(0)
  const [rolling, setRolling] = useState(false)
  const motion = useMemo<KartMotion>(() => ({ speed: 0, steer: 0 }), [])
  motion.steer = steer
  motion.speed = rolling ? 8 : 0

  const pick = (name: ViewName) => {
    setView(name)
    setSpin(false)
  }

  return (
    <>
      <Canvas shadows dpr={[1, 2]} gl={{ toneMapping: THREE.NeutralToneMapping }} camera={{ fov: 32, near: 0.1, far: 100 }}>
        <color attach="background" args={['#262b36']} />
        <hemisphereLight args={['#eef2fa', '#4a4f5a', 1.1]} />
        <directionalLight
          position={[4, 8, 3]}
          intensity={2.2}
          color="#fff7ea"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        <Environment resolution={128} frames={1}>
          <color attach="background" args={['#3a3f4a']} />
          {[-4, 0, 4].map((x) => (
            <Lightformer key={x} form="rect" intensity={3} position={[x, 6, 0]} rotation-x={Math.PI / 2} scale={[3, 12, 1]} />
          ))}
          <Lightformer form="rect" intensity={1.2} color="#cfe6ff" position={[0, 2, -8]} scale={[16, 2, 1]} />
        </Environment>

        <Turntable />
        <Suspense fallback={null}>
          <KartModel motion={motion} />
        </Suspense>
        <Camera view={VIEWS[view]} spin={spin} />
      </Canvas>

      <div className="garage-ui">
        <p className="eyebrow">Kart Race</p>
        <h1>Garage</h1>
        <div className="garage-views">
          {(Object.keys(VIEWS) as ViewName[]).map((name) => (
            <button key={name} className={name === view && !spin ? 'is-on' : ''} onClick={() => pick(name)}>
              {name}
            </button>
          ))}
          <button className={spin ? 'is-on' : ''} onClick={() => setSpin(!spin)}>
            Spin
          </button>
        </div>
        <label className="garage-row">
          Steer
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={steer}
            onChange={(e) => setSteer(Number(e.target.value))}
            onDoubleClick={() => setSteer(0)}
          />
        </label>
        <label className="garage-row">
          <input type="checkbox" checked={rolling} onChange={(e) => setRolling(e.target.checked)} />
          Wheels turning
        </label>
        <p className="garage-help">Drag to orbit · scroll to zoom</p>
        <a className="garage-back" href="./">
          ← Back to the game
        </a>
      </div>
    </>
  )
}

/** Jumps to a preset view; between jumps you can orbit freely. */
function Camera({ view, spin }: { view: View; spin: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera

  useEffect(() => {
    camera.position.set(...view.position)
    camera.fov = view.fov
    camera.updateProjectionMatrix()
    controls.current?.target.set(...view.target)
    controls.current?.update()
  }, [view, camera])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      autoRotate={spin}
      autoRotateSpeed={1.2}
      minDistance={2.5}
      maxDistance={18}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  )
}

/** A round display plinth with a ring of light around it. */
function Turntable() {
  return (
    <group>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[3, 3.1, 0.12, 64]} />
        <meshStandardMaterial color="#4a505c" roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.005, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.88, 2.96, 64]} />
        <meshStandardMaterial color="#ffd23f" emissive="#ffd23f" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, -0.3, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color="#1e222b" roughness={0.6} />
      </mesh>
    </group>
  )
}
