import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { KartModel } from '../KartModel'
import { sampleGhost } from './ghostLap'
import { race, useGame } from './store'

const GHOST_COLOR = '#ffd23f'

/** The see-through kart replaying your fastest lap, in step with your lap timer. */
export function Ghost() {
  const group = useRef<THREE.Group>(null)
  const sample = useMemo(() => ({ x: 0, z: 0, yaw: 0, speed: 0, steer: 0 }), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { phase, showGhost } = useGame.getState()
    const at = showGhost && phase === 'racing' ? sampleGhost(race.time, sample) : null
    g.visible = at !== null
    if (at) {
      g.position.set(at.x, 0, at.z)
      g.rotation.y = at.yaw
    }
  })

  return (
    <group ref={group} visible={false}>
      <KartModel ghost={GHOST_COLOR} motion={sample} />
    </group>
  )
}
