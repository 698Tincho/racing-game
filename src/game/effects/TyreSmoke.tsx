import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { kartState } from '../kartState'
import { useGame } from '../race/store'
import { PALETTE } from '../scene/palette'
import { frameStep } from '../time'
import { tyreScrub } from './scrub'

const SMOKE_URL = '/sprites/smoke.png'
const POOL = 140
const SMOKE = new THREE.Color(PALETTE.tyreSmoke)
const DUST = new THREE.Color(PALETTE.dust)

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aShape; // size, angle, alpha
  attribute vec3 aTint;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vTint = aTint;
    vAlpha = aShape.z;
    float c = cos(aShape.y);
    float s = sin(aShape.y);
    vec4 view = modelViewMatrix * vec4(aCenter, 1.0);
    view.xy += mat2(c, s, -s, c) * position.xy * aShape.x; // always faces the camera
    gl_Position = projectionMatrix * view;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    float alpha = texture2D(map, vUv).a * vAlpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vTint, alpha);
    #include <colorspace_fragment>
  }
`

function createParticles(map: THREE.Texture) {
  const plane = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = plane.index
  geometry.setAttribute('position', plane.getAttribute('position'))
  geometry.setAttribute('uv', plane.getAttribute('uv'))
  geometry.instanceCount = POOL

  const attribute = (name: string) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 3), 3)
    a.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute(name, a)
    return a
  }
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { map: { value: map } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  return {
    geometry,
    material,
    center: attribute('aCenter'),
    shape: attribute('aShape'),
    tint: attribute('aTint'),
    velocity: new Float32Array(POOL * 3),
    age: new Float32Array(POOL),
    life: new Float32Array(POOL), // 0 = free
    size: new Float32Array(POOL),
  }
}

/**
 * Smoke from the rear tyres when sliding or launching, and dust when driving
 * on grass or gravel. A fixed pool of camera-facing quads in one draw call, so
 * nothing is allocated while racing.
 */
export function TyreSmoke() {
  const map = useTexture(SMOKE_URL)
  const p = useMemo(() => createParticles(map), [map])
  const carry = useRef(0)
  const next = useRef(0)
  const wheel = useRef(0)
  const lastTeleport = useRef(kartState.teleports)
  const previous = useRef(new THREE.Vector3().copy(kartState.position))

  useFrame((_, delta) => {
    const dt = frameStep(delta)
    const { position, yaw, speed, launch, impact, grounded, surface, teleports } = kartState
    const { phase, viewing } = useGame.getState()

    // The kart jumped (new lap, reset): don't leave its smoke hanging behind.
    if (teleports !== lastTeleport.current) {
      lastTeleport.current = teleports
      previous.current.copy(position)
      p.life.fill(0)
      p.shape.array.fill(0)
      p.shape.needsUpdate = true
      carry.current = 0
    }

    const offRoad = surface === 'grass' || surface === 'gravel'
    const moving = THREE.MathUtils.clamp(Math.abs(speed) / 8, 0, 1)
    const emitting = grounded && !viewing && (phase === 'outlap' || phase === 'racing' || phase === 'finished')
    const rate = emitting
      ? tyreScrub() * 70 + launch * 45 + impact * 80 + (offRoad ? moving * (surface === 'gravel' ? 42 : 18) : 0)
      : 0
    carry.current += rate * dt

    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    while (carry.current >= 1) {
      carry.current -= 1
      const i = next.current
      next.current = (i + 1) % POOL
      // Rear tyres relative to the car (x = left/right, z = forward), alternating.
      const w = { x: kartState.rearWheel.x * (wheel.current === 0 ? 1 : -1), z: kartState.rearWheel.z }
      wheel.current = 1 - wheel.current
      // Spread along the distance covered this frame, so fast slides don't clump.
      const along = Math.random()
      const baseX = THREE.MathUtils.lerp(previous.current.x, position.x, along)
      const baseZ = THREE.MathUtils.lerp(previous.current.z, position.z, along)
      p.center.setXYZ(i, baseX + w.x * cos + w.z * sin, position.y + 0.14, baseZ - w.x * sin + w.z * cos)
      p.velocity[i * 3] = -sin * speed * 0.12 + (Math.random() - 0.5) * 0.8
      p.velocity[i * 3 + 1] = 0.45 + Math.random() * 0.65
      p.velocity[i * 3 + 2] = -cos * speed * 0.12 + (Math.random() - 0.5) * 0.8
      p.age[i] = 0
      p.life[i] = 0.45 + Math.random() * 0.35
      p.size[i] = 0.5 + Math.random() * 0.36
      p.shape.setY(i, Math.random() * Math.PI * 2)
      const tint = offRoad ? DUST : SMOKE
      p.tint.setXYZ(i, tint.r, tint.g, tint.b)
      p.tint.needsUpdate = true
    }
    previous.current.copy(position)

    let alive = false
    const drag = Math.exp(-3 * dt)
    for (let i = 0; i < POOL; i++) {
      if (p.life[i] === 0) continue
      p.age[i] += dt
      const k = p.age[i] / p.life[i]
      if (k >= 1) {
        p.life[i] = 0
        p.shape.setX(i, 0)
        p.shape.setZ(i, 0)
        alive = true // upload the cleared slot
        continue
      }
      alive = true
      p.velocity[i * 3] *= drag
      p.velocity[i * 3 + 1] *= drag
      p.velocity[i * 3 + 2] *= drag
      p.center.setXYZ(
        i,
        p.center.getX(i) + p.velocity[i * 3] * dt,
        p.center.getY(i) + p.velocity[i * 3 + 1] * dt,
        p.center.getZ(i) + p.velocity[i * 3 + 2] * dt,
      )
      p.shape.setX(i, p.size[i] * (0.5 + k * 0.8))
      p.shape.setZ(i, 0.42 * Math.min(1, k * 6) * (1 - k) ** 1.2)
    }
    if (alive) {
      p.center.needsUpdate = true
      p.shape.needsUpdate = true
    }
  })

  return <mesh geometry={p.geometry} material={p.material} frustumCulled={false} renderOrder={5} />
}

useTexture.preload(SMOKE_URL)
