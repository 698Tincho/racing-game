import { Suspense, useEffect, useRef } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { KartModel, type KartMotion } from '../game/KartModel'
import { carUrl } from '../game/cars'
import { useGame } from '../game/race/store'
import { PALETTE } from '../game/scene/palette'
import { Ready } from '../game/Ready'
import { useLoading } from '../game/loading'

// ---------------------------------------------------------------------------
// The menu's car on its turntable. It's drawn by the main canvas, not a
// canvas of its own (two WebGL canvases on one page halve the frame rate):
// the turntable is a small scene of its own, rendered each frame into a
// texture and laid over the main view where the menu leaves room for it.
// The menu's shade is drawn here too, under the car, so it doesn't dim it.
// ---------------------------------------------------------------------------

const TURN_SPEED = 0.32 // radians per second
const CHANGE_SPIN = 3.2 // extra speed when you pick another car, fading out
const PLINTH_RADIUS = 2.4
const RING_THICKNESS = 0.07
const PLINTH_TOP = 0.14
const START_ANGLE = -0.55
const CAMERA = new THREE.Vector3(6.1, 3.5, 8.1)
const LOOK_AT = new THREE.Vector3(0, 0.42, 0)
const FIT_ASPECT = 1.45 // narrower than this and the camera backs off

// Wheels turned a little, the way cars are posed for a photo.
const POSE: KartMotion = { speed: 0, steer: 0.55 }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The empty box in the menu the car is drawn into. MainMenu points this at it. */
export const showcaseSlot: { element: HTMLElement | null } = { element: null }

/** The turntable scene, while the menu is up. Goes inside the main Canvas; drawShowcase puts it on screen. */
export function CarShowcase() {
  const onMenu = useGame((s) => s.phase === 'menu' && !s.viewing)
  if (!onMenu) return null
  return createPortal(<Turntable />, turntable.scene)
}

function Turntable() {
  const table = useRef<THREE.Group>(null)
  const carId = useGame((s) => s.carId)
  const shownCar = useRef(carId)
  const spin = useRef(0)

  useEffect(() => {
    turntable.live = true
    return () => {
      turntable.live = false
    }
  }, [])

  useFrame((_, delta) => {
    if (!table.current) return
    if (shownCar.current !== carId) {
      shownCar.current = carId
      spin.current = CHANGE_SPIN
    }
    if (reducedMotion()) return
    const dt = Math.min(delta, 0.1)
    spin.current *= Math.exp(-3.4 * dt)
    table.current.rotation.y += (TURN_SPEED + spin.current) * dt
  })

  return (
    <>
      <hemisphereLight args={['#c9c7f2', PALETTE.hemisphereGround, 2]} />
      <directionalLight
        color="#ffe0c4"
        intensity={2.7}
        position={[-4, 7, 5]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight color={PALETTE.sun} intensity={1.5} position={[5, 2.5, -6]} />
      <group ref={table} rotation-y={START_ANGLE}>
        <mesh position-y={PLINTH_TOP / 2} receiveShadow>
          <cylinderGeometry args={[PLINTH_RADIUS - 0.14, PLINTH_RADIUS - 0.06, PLINTH_TOP, 56]} />
          <meshStandardMaterial color="#26262e" roughness={0.85} />
        </mesh>
        <RedRing />
        <group position-y={PLINTH_TOP}>
          <KartModel motion={POSE} />
        </group>
      </group>
      <Suspense fallback={null}>
        <CarReady />
      </Suspense>
    </>
  )
}

/** Tells the loading screen once the selected car's model has loaded and been drawn (see Ready). */
function CarReady() {
  useGLTF(carUrl(useGame.getState().carId))
  useEffect(() => {
    performance.mark('car-shown') // (handy for checking load times)
  }, [])
  return <Ready id="car" />
}

/** A red ring round the edge, lit a little so it reads against the dark plinth. */
function RedRing() {
  return (
    <mesh position-y={PLINTH_TOP} rotation-x={Math.PI / 2}>
      <torusGeometry args={[PLINTH_RADIUS - 0.1, RING_THICKNESS, 12, 96]} />
      <meshStandardMaterial color="#e5172f" emissive="#e5172f" emissiveIntensity={0.55} roughness={0.4} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Drawing it.
// ---------------------------------------------------------------------------

const turntable = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(27, 1, 0.1, 100),
  /** The turntable is mounted (the menu is up). */
  live: false,
  /** It has been drawn once. */
  warmed: false,
}

// A quad from its corners in clip space, for laying things over the view.
const quadVertex = /* glsl */ `
  uniform vec4 rect; // left, bottom, right, top, in clip space
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(mix(rect.xy, rect.zw, uv), 0.0, 1.0);
  }
`

/** The menu's shade: carbon, darker towards the bottom. */
const shade = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float a = vUv.y < 0.52 ? mix(0.9, 0.42, vUv.y / 0.52) : mix(0.42, 0.2, (vUv.y - 0.52) / 0.48);
        // Already in screen colours: the menu's carbon (#111116).
        gl_FragColor = vec4(17.0 / 255.0, 17.0 / 255.0, 22.0 / 255.0, a * opacity);
      }
    `,
    uniforms: { rect: { value: new THREE.Vector4(-1, -1, 1, 1) }, opacity: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }),
)

/** The turntable, as rendered into its texture (premultiplied, not yet tone-mapped). */
const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType })
const car = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(map, vUv);
        // Tone-map and convert the straight colour, then premultiply again.
        gl_FragColor = vec4(texel.rgb / max(texel.a, 1e-4), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        float a = texel.a * opacity;
        gl_FragColor = vec4(gl_FragColor.rgb * a, a);
      }
    `,
    uniforms: { rect: { value: new THREE.Vector4() }, map: { value: target.texture }, opacity: { value: 1 } },
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
  }),
)
const overlay = new THREE.Scene()
for (const [i, mesh] of [shade, car].entries()) {
  mesh.frustumCulled = false
  mesh.renderOrder = i
  overlay.add(mesh)
}

const clearColor = new THREE.Color()
const opacityOf = (element: Element | null, pseudo?: string) => (element ? Number(getComputedStyle(element, pseudo).opacity) : 1)

/**
 * Lays the menu's shade and car over the frame just drawn. Follows the menu's
 * box as it slides and fades (it reads the box and its opacity every frame).
 */
export function drawShowcase(gl: THREE.WebGLRenderer, camera: THREE.Camera) {
  const slot = showcaseSlot.element
  if (!turntable.live) return
  if (!slot) {
    // Not on screen yet (the loading screen is up): draw it once off screen,
    // so its first, slowest frame isn't the one where the menu appears.
    if (!turntable.warmed && useLoading.getState().done.includes('car')) {
      turntable.warmed = true
      gl.setRenderTarget(target)
      gl.render(turntable.scene, turntable.camera)
      gl.setRenderTarget(null)
      gl.compile(overlay, camera)
    }
    return
  }
  const canvas = gl.domElement.getBoundingClientRect()
  const box = slot.getBoundingClientRect()

  // The shade, over the whole view.
  shade.material.uniforms.opacity.value = opacityOf(slot.closest('.menu'), '::before')

  // The car, rendered at the box's size into the texture.
  const ratio = gl.getPixelRatio()
  const width = Math.max(1, Math.round(box.width * ratio))
  const height = Math.max(1, Math.round(box.height * ratio))
  car.visible = box.width > 0 && box.height > 0 && box.bottom > canvas.top && box.top < canvas.bottom
  if (car.visible) {
    if (target.width !== width || target.height !== height) target.setSize(width, height)
    const { camera: cam } = turntable
    const aspect = box.width / box.height
    // Backs the camera off on narrow boxes, so the whole turntable stays in frame.
    const zoomOut = Math.max(1, FIT_ASPECT / aspect)
    cam.position.copy(LOOK_AT).addScaledVector(CAMERA.clone().sub(LOOK_AT), zoomOut)
    cam.lookAt(LOOK_AT)
    if (cam.aspect !== aspect) {
      cam.aspect = aspect
      cam.updateProjectionMatrix()
    }
    gl.getClearColor(clearColor)
    const clearAlpha = gl.getClearAlpha()
    gl.setRenderTarget(target)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(turntable.scene, cam)
    gl.setRenderTarget(null)
    gl.setClearColor(clearColor, clearAlpha)

    const x = (px: number) => ((px - canvas.left) / canvas.width) * 2 - 1
    const y = (py: number) => 1 - ((py - canvas.top) / canvas.height) * 2
    car.material.uniforms.rect.value.set(x(box.left), y(box.bottom), x(box.right), y(box.top))
    car.material.uniforms.opacity.value = opacityOf(slot.closest('.menu-stage'))
  }

  const autoClear = gl.autoClear
  gl.autoClear = false
  gl.render(overlay, camera)
  gl.autoClear = autoClear
}
