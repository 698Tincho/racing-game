import type { KeyboardControlsEntry } from '@react-three/drei'

export type Controls = 'forward' | 'back' | 'left' | 'right' | 'reset'

export const keyMap: KeyboardControlsEntry<Controls>[] = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'reset', keys: ['KeyR'] },
]
