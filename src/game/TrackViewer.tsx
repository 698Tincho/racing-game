import { useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useGame } from './race/store'
import { cameraLook } from './ChaseCamera'

/**
 * "View the track" from the menu: the menu hides and you get a free orbit
 * camera around the whole circuit. It starts exactly where the menu camera
 * was, looking at the same spot, so nothing jumps.
 */
export function TrackViewer() {
  const viewing = useGame((s) => s.viewing)
  if (!viewing) return null
  return <Orbit />
}

function Orbit() {
  const [target] = useState(() => cameraLook.toArray())
  return <OrbitControls makeDefault target={target} enableDamping minDistance={8} maxDistance={320} maxPolarAngle={Math.PI / 2 - 0.05} />
}
