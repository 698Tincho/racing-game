import { Suspense, useEffect, useRef } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { KartModel, type KartMotion } from '../game/KartModel'
import { CARS, carUrl } from '../game/cars'
import { useGame } from '../game/race/store'
import { PALETTE } from '../game/scene/palette'
import { Ready } from '../game/Ready'
import { useLoading } from '../game/loading'

// ---------------------------------------------------------------------------
// The menu's car on its turntable. It's drawn by the main canvas, not a
// canvas of its own (two WebGL canvases on one page halve the frame rate):
// the turntable is a small scene of its own, rendered each frame into a
// texture and laid over the main view where the menu leaves room for it.
// The menu's backdrop (the red field, the diagonal cut, the big race number)
// is drawn here too, under the car, so the car sits on top of it.
// ---------------------------------------------------------------------------

const TURN_SPEED = 0.32 // radians per second
const CHANGE_SPIN = 3.2 // extra speed when you pick another car, fading out
const FLOOR_RADIUS = 2.6 // the invisible floor that catches the car's shadow
const START_ANGLE = -0.55
// Close in, so the car fills its box on the red field (the box is wide and short).
const CAMERA = new THREE.Vector3(3.0, 1.9, 4.0)
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
        {/* No plinth: the car stands on the red field, only its shadow shows. */}
        <mesh rotation-x={-Math.PI / 2} position-y={0.002} receiveShadow>
          <circleGeometry args={[FLOOR_RADIUS, 48]} />
          <shadowMaterial opacity={0.42} color="#2a0006" />
        </mesh>
        <KartModel motion={POSE} />
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

// ---------------------------------------------------------------------------
// The backdrop: painted with the 2D canvas API into a texture the size of the
// screen, and only repainted when the screen size or the car changes. Its
// geometry follows the menu's layout in index.css: designed at 1280 × 720,
// scaled by the same unit (--u).
// ---------------------------------------------------------------------------

/** The menu's red. Same as --menu-red in index.css. */
export const MENU_RED = '#d0142f'
/** The menu's one slant, from the logo's slashes: 8 across for 26 up (about 17°). Same as --menu-lean in index.css. */
export const MENU_LEAN = 8 / 26
const NARROW = 860 // px; below this the menu stacks (index.css)

/** index.css's --u: 1px at 1280 × 720, scaling with the screen. */
export const menuUnit = (width: number, height: number) => THREE.MathUtils.clamp(Math.min(width / 1280, height / 720), 0.85, 1.6)

const paper = document.createElement('canvas')
const paint = paper.getContext('2d')!
const backdropTexture = new THREE.CanvasTexture(paper)
backdropTexture.generateMipmaps = false
backdropTexture.minFilter = THREE.LinearFilter
const painted = { key: '' }
// The race number is set in Archivo; repaint once it has loaded.
document.fonts?.load('900 100px "Archivo Variable"').then(() => (painted.key = ''))

function paintBackdrop(width: number, height: number, number: string) {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
  const key = `${width}x${height}@${ratio}:${number}`
  if (painted.key === key) return
  painted.key = key
  paper.width = Math.round(width * ratio)
  paper.height = Math.round(height * ratio)
  const g = paint
  g.setTransform(ratio, 0, 0, ratio, 0, 0)
  g.clearRect(0, 0, width, height)
  const u = menuUnit(width, height)

  // Where the cut runs: through the middle of the screen, at the menu's slant.
  const narrow = width < NARROW
  const top = narrow ? width * 2 : width / 2 + (height * MENU_LEAN) / 2
  const bottom = top - height * MENU_LEAN
  const field = new Path2D()
  field.moveTo(0, 0)
  field.lineTo(top, 0)
  field.lineTo(bottom, height)
  field.lineTo(0, height)
  field.closePath()

  // The track side: the live scene shows through, darkened. Then the solid red field over it.
  g.fillStyle = 'rgba(14, 14, 18, 0.7)'
  g.fillRect(0, 0, width, height)
  g.fillStyle = MENU_RED
  g.fill(field)

  // The race number, huge and faint, behind the car.
  g.save()
  g.clip(field)
  const size = (narrow ? 0.42 * width : 380 * u)
  g.font = `900 ${size}px "Archivo Variable", sans-serif`
  ;(g as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = 'expanded'
  ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${-0.03 * size}px`
  g.fillStyle = 'rgba(0, 0, 0, 0.09)'
  g.textBaseline = 'alphabetic'
  g.fillText(number, narrow ? 12 : 36 * u, narrow ? 0.38 * height : 168 * u + 0.74 * size)
  g.restore()

  if (!narrow) {
    // A lighter band and a white line down the cut, like a broadcast wipe.
    const band = (from: number, to: number) => {
      g.beginPath()
      g.moveTo(top + from * u, 0)
      g.lineTo(top + to * u, 0)
      g.lineTo(bottom + to * u, height)
      g.lineTo(bottom + from * u, height)
      g.closePath()
      g.fill()
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.12)'
    band(-100, 0)
    g.fillStyle = '#ffffff'
    band(-4, 2)
  }
  backdropTexture.needsUpdate = true
}

const shade = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        // Already in screen colours: painted in CSS colours, shown as they are.
        vec4 texel = texture2D(map, vUv);
        gl_FragColor = vec4(texel.rgb, texel.a * opacity);
      }
    `,
    uniforms: { rect: { value: new THREE.Vector4(-1, -1, 1, 1) }, map: { value: backdropTexture }, opacity: { value: 1 } },
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
 * Lays the menu's backdrop and car over the frame just drawn. Follows the menu's
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

  // The backdrop, over the whole view, with the selected car's number.
  const number = CARS.find((c) => c.id === useGame.getState().carId)?.number ?? ''
  paintBackdrop(canvas.width, canvas.height, number)
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
    car.material.uniforms.opacity.value = opacityOf(slot.closest('.menu-left'))
  }

  const autoClear = gl.autoClear
  gl.autoClear = false
  gl.render(overlay, camera)
  gl.autoClear = autoClear
}
