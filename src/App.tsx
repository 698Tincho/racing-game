import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { KeyboardControls, PerformanceMonitor } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { keyMap } from './game/controls'
import { Kart } from './game/Kart'
import { Track } from './game/track/Track'
import { Lights } from './game/Lights'
import { ChaseCamera } from './game/ChaseCamera'
import { RaceDirector } from './game/race/RaceDirector'
import { Sky } from './game/scene/Sky'
import { Board } from './game/scene/Board'
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
        <Board />
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]} timeStep="vary" debug={debug}>
            <Track />
            <Kart />
            <RaceDirector />
          </Physics>
          <Props />
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
