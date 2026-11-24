import { useMemo } from 'react'
import * as THREE from 'three'
import { glowTexture } from './glow'
import { PALETTE } from './palette'
import { streetLights } from './scenery'

const POOL_RADIUS = 8.5
// Just above the kerbs, so the light falls across them too.
const POOL_Y = 0.1
const HALO_SIZE = 3.4

/** Every pool of light baked into one mesh, so their positions can't get lost on a re-render. */
function buildPools() {
  const count = streetLights.length
  const position = new Float32Array(count * 12)
  const uv = new Float32Array(count * 8)
  const index = new Uint16Array(count * 6)
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
  streetLights.forEach(({ pool }, i) => {
    corners.forEach(([cx, cz], k) => {
      position.set([pool.x + cx * POOL_RADIUS, POOL_Y, pool.z + cz * POOL_RADIUS], i * 12 + k * 3)
      uv.set([(cx + 1) / 2, (cz + 1) / 2], i * 8 + k * 2)
    })
    const v = i * 4
    index.set([v, v + 2, v + 1, v, v + 3, v + 2], i * 6)
  })
  return new THREE.BufferGeometry()
    .setAttribute('position', new THREE.BufferAttribute(position, 3))
    .setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    .setIndex(new THREE.BufferAttribute(index, 1))
}

/**
 * The light from the posts. Real lights would be far too slow at this count,
 * so each post gets a glowing halo and a soft pool of light on the ground:
 * two draw calls in total.
 */
export function TrackLights() {
  const { poolGeometry, poolMaterial, haloGeometry, haloMaterial } = useMemo(() => {
    const map = glowTexture()
    const positions = new Float32Array(streetLights.flatMap((l) => [l.lamp.x, l.lamp.y, l.lamp.z]))
    return {
      poolGeometry: buildPools(),
      poolMaterial: new THREE.MeshBasicMaterial({
        map,
        color: PALETTE.lamp,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
      haloGeometry: new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)),
      haloMaterial: new THREE.PointsMaterial({
        map,
        color: PALETTE.lamp,
        size: HALO_SIZE,
        sizeAttenuation: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    }
  }, [])

  return (
    <>
      <mesh geometry={poolGeometry} material={poolMaterial} frustumCulled={false} renderOrder={2} />
      <points geometry={haloGeometry} material={haloMaterial} frustumCulled={false} renderOrder={3} />
    </>
  )
}
