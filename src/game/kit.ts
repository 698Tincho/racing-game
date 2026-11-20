import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { racingModelUrl } from './assets'

/**
 * Load a Racing Kit model, tidied up so it's easy to place:
 * centred on x/z, sitting on y = 0, casting and receiving shadows.
 *
 * (The kit's files come with their origin in an odd spot, about half a tile
 * off; without this every model would be placed slightly wrong.)
 */
export function useRacingModel(name: string) {
  const { scene } = useGLTF(racingModelUrl(name))
  if (!scene.userData.tidied) {
    scene.userData.tidied = true
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const shift = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    for (const child of scene.children) child.position.sub(shift)
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }
  return scene
}

useRacingModel.preload = (name: string) => useGLTF.preload(racingModelUrl(name))
