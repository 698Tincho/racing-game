import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { kartState } from './kartState'
import { useGame } from './race/store'
import { PALETTE } from './scene/palette'
import { SUN_DIRECTION } from './scene/sun'
import { board } from './scene/boardSize'

const SUN_DISTANCE = 140
const RACE_SHADOW_SIZE = 32 // sharp shadows around the kart while racing
const OVERVIEW_SHADOW_SIZE = Math.max(board.width, board.depth) * 0.55 // covers the whole board on the menu

/**
 * While racing, the sun follows the kart so the shadow map only covers the
 * area around you (sharp shadows). On the menu/results the camera flies
 * around the whole track, so the shadow area grows to cover the board.
 */
export function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const size = useRef(RACE_SHADOW_SIZE)
  const target = new THREE.Vector3()

  useFrame(() => {
    const light = sun.current
    if (!light) return
    const { phase } = useGame.getState()
    const overview = phase === 'menu' || phase === 'results'

    if (overview) target.set(board.centerX, 0, board.centerZ)
    else target.copy(kartState.position)

    light.position.copy(target).addScaledVector(SUN_DIRECTION, SUN_DISTANCE)
    light.target.position.copy(target)
    light.target.updateMatrixWorld()

    const wanted = overview ? OVERVIEW_SHADOW_SIZE : RACE_SHADOW_SIZE
    if (size.current !== wanted) {
      size.current = wanted
      const cam = light.shadow.camera
      cam.left = cam.bottom = -wanted
      cam.right = cam.top = wanted
      cam.updateProjectionMatrix()
    }
  })

  return (
    <>
      <hemisphereLight args={['#d6ecff', '#7da85a', 1.25]} />
      <directionalLight
        ref={sun}
        color={PALETTE.sun}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-RACE_SHADOW_SIZE}
        shadow-camera-right={RACE_SHADOW_SIZE}
        shadow-camera-top={RACE_SHADOW_SIZE}
        shadow-camera-bottom={-RACE_SHADOW_SIZE}
        shadow-camera-near={1}
        shadow-camera-far={320}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}
