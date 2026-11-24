import { OrbitControls } from '@react-three/drei'
import { useGame } from './race/store'
import { board } from './scene/boardSize'

/**
 * "View the track" from the menu: the menu hides and you get a free orbit
 * camera around the whole circuit. Starts from wherever the menu camera was.
 */
export function TrackViewer() {
  const viewing = useGame((s) => s.viewing)
  if (!viewing) return null
  return (
    <OrbitControls
      makeDefault
      target={[board.centerX, 0, board.centerZ]}
      enableDamping
      minDistance={8}
      maxDistance={320}
      maxPolarAngle={Math.PI / 2 - 0.05}
    />
  )
}
