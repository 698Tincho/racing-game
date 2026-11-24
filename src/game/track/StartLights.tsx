import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Clone } from '@react-three/drei'
import * as THREE from 'three'
import { useRacingModel } from '../kit'
import { COUNTDOWN_SECONDS, race, useGame } from '../race/store'
import { FLOOR_Y } from '../scene/boardSize'
import { glowTexture } from '../scene/glow'
import { TILE, track } from './layout'

// Where the gantry model's eight lamps are, in metres from its centre.
const LAMP_COLUMNS = [-0.85, -0.28, 0.28, 0.85]
const LAMP_ROWS = [5.27, 4.63]
const LAMP_FACE = 0.39
const LAMP_RADIUS = 0.2

// The columns light up one at a time during the countdown. All out means GO.
const FIRST_LAMP_AT = 0.2
const LAMP_INTERVAL = 0.7

const LAMP_OFF = new THREE.Color('#3a0b0e')
const LAMP_ON = new THREE.Color('#ff2a1f')

/** The start gantry over the line, with race-start lights facing the grid. */
export function StartLights() {
  const gantry = useRacingModel('overheadLights')
  const shown = useRef(-1)

  const { disc, lamps, halos } = useMemo(
    () => ({
      disc: new THREE.CircleGeometry(LAMP_RADIUS, 20),
      lamps: LAMP_COLUMNS.map(() => new THREE.MeshBasicMaterial({ color: LAMP_OFF, toneMapped: false, fog: false })),
      halos: LAMP_COLUMNS.map(
        () =>
          new THREE.SpriteMaterial({
            map: glowTexture(),
            color: '#ff3a25',
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
            fog: false,
          }),
      ),
    }),
    [],
  )

  useFrame(() => {
    const counting = useGame.getState().phase === 'countdown'
    const elapsed = COUNTDOWN_SECONDS - race.countdown
    const lit = counting
      ? THREE.MathUtils.clamp(Math.floor((elapsed - FIRST_LAMP_AT) / LAMP_INTERVAL) + 1, 0, LAMP_COLUMNS.length)
      : 0
    if (lit === shown.current) return
    shown.current = lit
    lamps.forEach((lamp, i) => lamp.color.copy(i < lit ? LAMP_ON : LAMP_OFF))
    halos.forEach((halo, i) => (halo.opacity = i < lit ? 0.95 : 0))
  })

  return (
    <group position={[track.finish.x, FLOOR_Y, track.finish.z]} rotation-y={track.finish.yaw + Math.PI}>
      <Clone object={gantry} scale={TILE} />
      {LAMP_COLUMNS.flatMap((x, column) =>
        LAMP_ROWS.map((y) => (
          <group key={`${column}-${y}`} position={[x, y, LAMP_FACE]}>
            <mesh geometry={disc} material={lamps[column]} />
            <sprite material={halos[column]} position={[0, 0, 0.04]} scale={1.5} />
          </group>
        )),
      )}
    </group>
  )
}

useRacingModel.preload('overheadLights')
