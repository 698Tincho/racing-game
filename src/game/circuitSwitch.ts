import * as THREE from 'three'
import { useGame } from './race/store'
import { useLoading } from './loading'
import { FOG } from './scene/palette'
import { nextCircuit } from './track/circuits'

// ---------------------------------------------------------------------------
// Picking another circuit on the menu. The world fades into the haze, is
// rebuilt for the new circuit behind it (App mounts it again), and fades back
// once every part of it has been drawn. The menu, the red field and your car
// stay on screen throughout: they're drawn on top of the cover.
// ---------------------------------------------------------------------------

/** Seconds to fade the world out, and back in. */
const FADE_OUT = 0.2
const FADE_IN = 0.4
/** If the new world doesn't say it's in by then, show it anyway. */
const GIVE_UP_MS = 6000

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The circuit asked for last, while a switch is under way. */
let wanted: string | null = null
let running = false

/** Show `circuitId` on the menu (and race on it). Clicks during a switch just change where it ends up. */
export function switchCircuit(circuitId: string) {
  if (useGame.getState().phase !== 'menu') return
  wanted = circuitId
  if (!running) void run()
}

/** The circuit before or after the one on screen (or the one on its way). */
export function stepCircuit(step: 1 | -1) {
  switchCircuit(nextCircuit(wanted ?? useGame.getState().circuitId, step))
}

async function run() {
  running = true
  try {
    while (wanted !== null && wanted !== useGame.getState().circuitId && useGame.getState().phase === 'menu') {
      await fadeTo(1)
      const circuitId = wanted
      // Everything in the world reports in again once it's rebuilt (only the menu's car stays as it is).
      const parts = useLoading.getState().steps.map((s) => s.id).filter((id) => id !== 'car')
      useLoading.setState((s) => ({ done: s.done.filter((id) => !parts.includes(id)) }))
      useGame.getState().setCircuit(circuitId)
      await allIn(parts)
    }
  } finally {
    wanted = null
    await fadeTo(0)
    running = false
  }
}

/** Resolves once every one of `parts` is in, or after GIVE_UP_MS. */
function allIn(parts: string[]) {
  return new Promise<void>((resolve) => {
    const check = () => parts.every((id) => useLoading.getState().done.includes(id))
    if (check()) return resolve()
    const finish = () => {
      stop()
      clearTimeout(timer)
      resolve()
    }
    const stop = useLoading.subscribe(() => check() && finish())
    const timer = setTimeout(finish, GIVE_UP_MS)
  })
}

// The cover: a flat quad of the haze colour over the world, under the menu.
const cover = { opacity: 0, target: 0, arrived: null as (() => void) | null }

function fadeTo(target: number) {
  cover.target = target
  if (cover.opacity === target) return Promise.resolve()
  return new Promise<void>((resolve) => (cover.arrived = resolve))
}

const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      void main() {
        gl_FragColor = vec4(color, opacity);
        #include <colorspace_fragment>
      }
    `,
    uniforms: { color: { value: new THREE.Color(FOG.color) }, opacity: { value: 0 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }),
)
quad.frustumCulled = false
const haze = new THREE.Color()
const coverScene = new THREE.Scene().add(quad)

/** Moves the cover towards where it's going and draws it over the frame just drawn. Call after the world, before the menu's showcase. */
export function drawCover(gl: THREE.WebGLRenderer, camera: THREE.Camera, delta: number) {
  if (cover.opacity !== cover.target) {
    const duration = reducedMotion() ? 0 : cover.target > cover.opacity ? FADE_OUT : FADE_IN
    // (A long frame, say while the world is rebuilt, mustn't skip the whole fade in one go.)
    const step = duration > 0 ? Math.min(delta, 1 / 30) / duration : 1
    cover.opacity = cover.target > cover.opacity ? Math.min(cover.target, cover.opacity + step) : Math.max(cover.target, cover.opacity - step)
    if (cover.opacity === cover.target) {
      cover.arrived?.()
      cover.arrived = null
    }
  }
  // The haze of the circuit on screen: while covered, it turns into the new circuit's.
  quad.material.uniforms.color.value.lerp(haze.set(FOG.color), cover.opacity >= 1 ? 1 - Math.exp(-6 * delta) : 0)
  if (cover.opacity <= 0) {
    quad.material.uniforms.color.value.set(FOG.color)
    return
  }
  // Eased, so it starts and ends gently.
  const t = cover.opacity
  quad.material.uniforms.opacity.value = t * t * (3 - 2 * t)
  const autoClear = gl.autoClear
  gl.autoClear = false
  gl.render(coverScene, camera)
  gl.autoClear = autoClear
}
