import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Environment, KeyboardControls, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { keyMap } from './game/controls'
import { Kart } from './game/Kart'
import { Track } from './game/track/Track'
import { Lights } from './game/Lights'
import { ChaseCamera } from './game/ChaseCamera'
import { RaceDirector } from './game/race/RaceDirector'
import { Ghost } from './game/race/Ghost'
import { Sky } from './game/scene/Sky'
import { Hall } from './game/scene/Hall'
import { Props } from './game/scene/Props'
import { FOG } from './game/scene/palette'
import { Dust } from './game/effects/Dust'
import { Hud } from './ui/Hud'
import { Screens } from './ui/Screens'

// Open with ?debug to see the physics colliders.
const debug = new URLSearchParams(window.location.search).has('debug')

export default function App() {
  // Resolution adapts to the machine: sharper on fast GPUs, lighter on laptops.
  const [dpr, setDpr] = useState(1.5)

  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        shadows
        camera={{ position: [60, 48, 60], fov: 55, near: 0.3, far: 1500 }}
        dpr={dpr}
        // Neutral keeps the toy colours bright and saturated (ACES greys them out a bit).
        gl={{ toneMapping: THREE.NeutralToneMapping }}
        onCreated={({ gl }) => {
          // Handy while developing: `renderer.info` in the console shows draw calls.
          if (import.meta.env.DEV) Object.assign(window, { renderer: gl })
        }}
      >
        <PerformanceMonitor
          onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
          onDecline={() => setDpr(1)}
          flipflops={3}
          onFallback={() => setDpr(1)}
        />
        <color attach="background" args={[FOG.color]} />
        <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
        <Sky />
        <Lights />
        <Hall />
        {/* Soft reflections on the glossy floor and karts: a few light panels, rendered once. */}
        <Environment resolution={128} frames={1}>
          <color attach="background" args={['#3a3f4a']} />
          {[-12, 0, 12].map((x) => (
            <Lightformer key={x} form="rect" intensity={3} position={[x, 8, 0]} rotation-x={Math.PI / 2} scale={[6, 30, 1]} />
          ))}
          <Lightformer form="rect" intensity={1.2} color="#cfe6ff" position={[0, 4, -20]} scale={[40, 3, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]} timeStep="vary" debug={debug}>
            <Track />
            <Kart />
            <RaceDirector />
          </Physics>
          <Props />
          <Ghost />
          <Dust />
        </Suspense>
        <ChaseCamera />
      </Canvas>
      <div className="vignette" />
      <Hud />
      <Screens />
    </KeyboardControls>
  )
}
