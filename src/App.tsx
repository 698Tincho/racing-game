import { Suspense, memo, useCallback, useEffect, useState, type ComponentType } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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
import { expectSteps, type LoadStep } from './game/loading'
import { Ready } from './game/Ready'
import { CarShowcase, drawShowcase } from './ui/CarShowcase'
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
        <Scene />
        <CarShowcase />
        <Frame />
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

/** Scenery around the track, mounted one per frame once the track is up, so its setup doesn't land all at once. */
const SCENERY: (LoadStep & { Part: ComponentType })[] = [
  { id: 'pits', label: 'Opening the pits', Part: PitBuilding },
  { id: 'parking', label: 'Painting the parking lot', Part: ParkingLot },
  { id: 'cars', label: 'Parking the cars', Part: CarKitDecor },
  { id: 'trees', label: 'Planting the trees', Part: Props },
  { id: 'lights', label: 'Switching on the lights', Part: TrackLights },
  { id: 'ghost', label: 'Warming up the tyres', Part: Ghost },
  { id: 'smoke', label: 'Warming up the tyres', Part: TyreSmoke },
]

// What the loading screen waits for, in order.
expectSteps([
  { id: 'car', label: 'Bringing out your car' },
  { id: 'track', label: 'Laying the track' },
  ...SCENERY.map(({ id, label }) => ({ id, label })),
])

/**
 * The 3D world, in two stages: first the track, physics and your car, then
 * the scenery around it, while the loading screen is up. (Memoised: nothing
 * here depends on the canvas resolution, so changing it doesn't rebuild the
 * world.)
 */
const Scene = memo(function Scene() {
  const [trackUp, setTrackUp] = useState(false)
  const showTrack = useCallback(() => {
    performance.mark('track-shown') // (handy for checking load times)
    setTrackUp(true)
  }, [])
  return (
    <>
      <Suspense fallback={null}>
        {/* Paused: SimLoop steps it at a fixed rate instead of once per frame. */}
        <Physics gravity={[0, -20, 0]} timeStep="vary" paused debug={debug}>
          <SimLoop />
          <Track />
          <Kart />
          <RaceDirector />
        </Physics>
        <PitLaneSurface />
        <StartLights />
        <OnShow run={showTrack} />
        <Ready id="track" />
      </Suspense>
      {trackUp && <OneByOne parts={SCENERY} />}
    </>
  )
})

/** Calls `run` once, when it first shows (so, inside a Suspense boundary, once everything there has loaded). */
function OnShow({ run }: { run: () => void }) {
  useEffect(run, [run])
  return null
}

/** Mounts the parts one per animation frame, each loading on its own and saying when it's in. */
function OneByOne({ parts }: { parts: typeof SCENERY }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (count >= parts.length) return
    const frame = requestAnimationFrame(() => setCount((n) => n + 1))
    return () => cancelAnimationFrame(frame)
  }, [count, parts.length])
  return (
    <>
      {parts.slice(0, count).map(({ id, Part }) => (
        <Suspense key={id} fallback={null}>
          <Part />
          <Ready id={id} />
        </Suspense>
      ))}
    </>
  )
}

/**
 * Renders each frame: the world, then the menu's turntable and shade over it
 * (see CarShowcase). Taking over rendering is why this runs at priority 1.
 * (Behind the loading screen it draws too, so each part's first, slowest
 * frame happens there, as it arrives, rather than all at once after.)
 */
function Frame() {
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera)
    drawShowcase(gl, camera)
  }, 1)
  return null
}
