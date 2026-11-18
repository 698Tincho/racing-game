import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { kartState } from './kartState'
import { modelUrl } from './track/pieces'
import { frameStep } from './time'

/**
 * Which toy car you drive. Any vehicle from the kit works since they all
 * have the same wheel names:
 *   vehicle-racer, vehicle-racer-low, vehicle-speedster, vehicle-vintage-racer,
 *   vehicle-drag-racer, vehicle-suv, vehicle-truck, vehicle-monster-truck
 */
export const CAR_MODEL = 'vehicle-racer'
export const CAR_SCALE = 2.2 // the kit car is 0.875 long, this makes it ~1.9 m

const WHEEL_RADIUS = 0.125 * CAR_SCALE

export function CarModel() {
  const { scene } = useGLTF(modelUrl(CAR_MODEL))

  const { car, wheels } = useMemo(() => {
    const car = scene.clone(true)
    car.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
    const find = (name: string) => {
      const w = car.getObjectByName(name)!
      w.rotation.order = 'YXZ' // steer (Y) first, then spin (X)
      return w
    }
    return {
      car,
      wheels: {
        front: [find('wheel-fl'), find('wheel-fr')],
        back: [find('wheel-bl'), find('wheel-br')],
      },
    }
  }, [scene])

  useFrame((_, delta) => {
    const dt = frameStep(delta)
    // The model faces -Z and we turn it around below, so forward spin is negative.
    const spin = (kartState.speed / WHEEL_RADIUS) * dt
    for (const w of [...wheels.front, ...wheels.back]) w.rotation.x -= spin
    for (const w of wheels.front) w.rotation.y = kartState.steer * 0.45
  })

  return <primitive object={car} scale={CAR_SCALE} rotation={[0, Math.PI, 0]} />
}

useGLTF.preload(modelUrl(CAR_MODEL))
