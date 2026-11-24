import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Environment, KeyboardControls, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { keyMap } from './game/controls'
import { Kart } from './game/Kart'
import { SimLoop } from './game/SimLoop'
import { Track } from './game/track/Track'
import { Lights } from './game/Lights'
import { ChaseCamera } from './game/ChaseCamera'
import { TrackViewer } from './game/TrackViewer'
import { RaceDirector } from './game/race/RaceDirector'
import { Ghost } from './game/race/Ghost'
import { KartAudio } from './game/audio/KartAudio'
import { TyreSmoke } from './game/effects/TyreSmoke'
import { Sky } from './game/scene/Sky'
import { Ground } from './game/scene/Ground'
import { Props } from './game/scene/Props'
import { CarKitDecor } from './game/scene/CarKitDecor'
import { ParkingLot } from './game/scene/ParkingLot'
import { PitBuilding } from './game/scene/PitBuilding'
import { PitLaneSurface } from './game/scene/PitLaneSurface'
import { TrackLights } from './game/scene/TrackLights'
import { StartLights } from './game/track/StartLights'
import { FOG, PALETTE } from './game/scene/palette'
import { Hud } from './ui/Hud'
import { Screens } from './ui/Screens'
import { SoundButton } from './ui/SoundButton'

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
        onCreated={(state) => {
          // Handy while developing: `renderer.info` in the console shows draw
          // calls, `three` is the whole scene (camera, controls...).
          if (import.meta.env.DEV) Object.assign(window, { renderer: state.gl, three: state })
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
        <Ground />
        {/* Soft reflections on the car: a violet dusk sky, dark ground and a low orange sun, rendered once. */}
        <Environment resolution={128} frames={1}>
          <color attach="background" args={['#4d467f']} />
          <Lightformer form="rect" intensity={0.45} color="#4d4356" position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[100, 100, 1]} />
          <Lightformer form="circle" intensity={5} color={PALETTE.sun} position={[-16, 12, 17]} scale={7} />
        </Environment>
        <Suspense fallback={null}>
          {/* Paused: SimLoop steps it at a fixed rate instead of once per frame. */}
          <Physics gravity={[0, -20, 0]} timeStep="vary" paused debug={debug}>
            <SimLoop />
            <Track />
            <Kart />
            <RaceDirector />
          </Physics>
          <Props />
          <PitBuilding />
          <PitLaneSurface />
          <ParkingLot />
          <CarKitDecor />
          <StartLights />
          <TrackLights />
          <Ghost />
          <TyreSmoke />
        </Suspense>
        <KartAudio />
        <ChaseCamera />
        <TrackViewer />
      </Canvas>
      <div className="vignette" />
      <Hud />
      <Screens />
      <SoundButton />
    </KeyboardControls>
  )
}
