import { Suspense, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { kartState } from './kartState'
import { frameStep } from './time'
import { CARS, CAR_SCALE, carUrl, type CarId } from './cars'
import { lit } from './kit'
import { useGame } from './race/store'

/**
 * The car you picked on the menu, used everywhere (your car, the ghost, the
 * garage). The models are from Kenney's Car Kit (CC0).
 * Open the game with ?garage to look at it from every side.
 *
 * `prepare` scales it to the shared CAR_SCALE, puts it on y = 0 centred between
 * the axles, and wraps each wheel in a steer (Y) group with a spin (X) group
 * inside. The files already face +Z.
 */

/** What the model animates from: the player's car or a ghost replay. */
export type KartMotion = { speed: number; steer: number; pitch?: number; roll?: number; lift?: number }

const WHEEL_NAME = /^wheel-?(front|back)-?(left|right)$/i

type Prepared = {
  object: THREE.Group
  /** Everything except the wheels. Tilts around axle height. */
  body: THREE.Group
  axleHeight: number
  /** Left rear tyre relative to the car. */
  rearWheel: { x: number; z: number }
  spinners: { group: THREE.Group; radius: number }[]
  steerers: THREE.Group[]
}

const measure = (o: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(o)
  return { box, centre: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) }
}

function prepare(source: THREE.Object3D, ghost: THREE.Material | null): Prepared {
  const root = new THREE.Group()
  const body = new THREE.Group()
  const fit = new THREE.Group()
  fit.add(source.clone(true))
  body.add(fit)
  root.add(body)
  root.updateMatrixWorld(true)

  const wheels: { o: THREE.Object3D; front: boolean }[] = []
  root.traverse((o) => {
    const m = WHEEL_NAME.exec(o.name)
    if (m) wheels.push({ o, front: m[1].toLowerCase() === 'front' })
  })
  if (wheels.length !== 4) console.warn('KartModel: expected 4 wheels, found', wheels.length)

  const axleZ = (front: boolean) => {
    const pair = wheels.filter((w) => w.front === front)
    return pair.reduce((z, w) => z + measure(w.o).centre.z, 0) / pair.length
  }
  const frontZ = axleZ(true)
  const rearZ = axleZ(false)

  // Scale up, centre between the axles, tyres on the ground.
  fit.scale.setScalar(CAR_SCALE)
  root.updateMatrixWorld(true)
  const { box, centre } = measure(fit)
  fit.position.set(-centre.x, -box.min.y, -((frontZ + rearZ) / 2) * CAR_SCALE)
  root.updateMatrixWorld(true)

  // Wheel pivots: steer (Y) on the outside, spin (X) inside.
  const spinners: Prepared['spinners'] = []
  const steerers: THREE.Group[] = []
  const rearWheel = { x: 0, z: 0 }
  let axleHeight = 0
  for (const w of wheels) {
    const { centre, size } = measure(w.o)
    axleHeight += centre.y / wheels.length
    if (!w.front) {
      rearWheel.x = Math.max(rearWheel.x, Math.abs(centre.x))
      rearWheel.z = centre.z
    }
    const steer = new THREE.Group()
    const spin = new THREE.Group()
    steer.position.copy(centre)
    steer.add(spin)
    root.add(steer)
    spin.attach(w.o) // keeps it where it was
    spinners.push({ group: spin, radius: size.y / 2 })
    if (w.front) steerers.push(steer)
  }

  // The wheels now hang off the root, so moving `body` leaves them on the road.
  body.position.y = axleHeight
  fit.position.y -= axleHeight

  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = ghost ?? (Array.isArray(mesh.material) ? mesh.material.map(lit) : lit(mesh.material))
    mesh.castShadow = !ghost
    mesh.receiveShadow = !ghost
  })

  return { object: root, body, axleHeight, rearWheel, spinners, steerers }
}

type Props = {
  /** Draw as a see-through ghost in this colour (no shadows). */
  ghost?: string
  motion?: KartMotion
}

export function KartModel(props: Props) {
  const carId = useGame((s) => s.carId)
  // Its own boundary, so switching to a car still loading doesn't pause the race scene.
  return (
    <Suspense fallback={null}>
      <Car key={carId} carId={carId} {...props} />
    </Suspense>
  )
}

function Car({ carId, ghost, motion = kartState }: Props & { carId: CarId }) {
  const { scene } = useGLTF(carUrl(carId))
  const ghostMaterial = useMemo(
    () =>
      ghost
        ? new THREE.MeshStandardMaterial({
            color: ghost,
            emissive: ghost,
            emissiveIntensity: 0.35,
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
          })
        : null,
    [ghost],
  )
  // Every car gets its own copy of the parts, so each can steer on its own.
  const kart = useMemo(() => prepare(scene, ghostMaterial), [scene, ghostMaterial])

  useLayoutEffect(() => {
    if (!ghost) kartState.rearWheel = kart.rearWheel
  }, [ghost, kart])

  useFrame((_, delta) => {
    const dt = frameStep(delta)
    for (const s of kart.spinners) s.group.rotation.x += (motion.speed / s.radius) * dt
    for (const s of kart.steerers) s.rotation.y = motion.steer * 0.42
    kart.body.rotation.set(motion.pitch ?? 0, 0, motion.roll ?? 0)
    kart.body.position.y = kart.axleHeight + (motion.lift ?? 0)
  })

  return <primitive object={kart.object} />
}

for (const car of CARS) useGLTF.preload(carUrl(car.id))
