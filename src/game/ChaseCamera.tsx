import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { kartState } from './kartState'
import { TUNING as T } from './tuning'
import { frameStep } from './time'
import { useGame } from './race/store'
import { board } from './scene/boardSize'
import { nearestOnTrack, track } from './track/layout'

/** Where the camera is looking right now, so the track view can take over without a jump. */
export const cameraLook = new THREE.Vector3()

const desired = new THREE.Vector3()
const lookAt = new THREE.Vector3()
const focusWanted = new THREE.Vector3()

const ORBIT_SPEED = 0.06 // rad/s
const ORBIT_RADIUS = Math.max(board.width, board.depth) * 0.6
const ORBIT_HEIGHT = Math.max(board.width, board.depth) * 0.45
const MENU_ZOOM_OUT = 1.35
const MENU_SHIFT = 0.25 // of the screen's width: the middle of the right half
const MENU_SPLIT_MIN_WIDTH = 860 // narrower, the menu stacks and the whole screen is red (index.css)

const PATH_STEP = Math.hypot(track.path[1].x - track.path[0].x, track.path[1].z - track.path[0].z)
const SAMPLES_AHEAD = Math.max(1, Math.round(T.high.trackAhead / PATH_STEP))
const HIGH_GLIDE = 14 // how quickly the camera settles on its target
const FACING_BACKWARDS = 2.2 // radians away from the track direction

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const { clamp, lerp } = THREE.MathUtils

/**
 * Two views while racing (set by `cameraView` in the store):
 *   chase — right behind the kart, widening the FOV with speed. The one in use.
 *   high  — up and to one side with a narrow lens, turning slowly with the
 *           track, looking ahead and zooming out with speed. Off for now.
 * Both shake on wall hits. Menu / results: slowly flies around the whole track.
 */
export function ChaseCamera() {
  const look = useRef(new THREE.Vector3(0, 1, 5))
  const lastTeleport = useRef(-1)
  const lastView = useRef<string | null>(null)
  const orbitAngle = useRef(0.6)
  const viewYaw = useRef(0)
  const focus = useRef(new THREE.Vector3())
  const distance = useRef<number>(T.high.distanceSlow)
  const menuShift = useRef(0)

  useFrame((state, delta) => {
    const cam = state.camera as THREE.PerspectiveCamera
    const dt = frameStep(delta)
    const { phase, viewing, leavingMenu, cameraView } = useGame.getState()
    // On the menu the left half of the screen is the red car panel, so the
    // picture is shifted right to centre the track in the half you can see.
    // It slides back to the middle as the menu leaves.
    const onMenu = phase === 'menu' && !viewing && !leavingMenu && window.innerWidth >= MENU_SPLIT_MIN_WIDTH
    // (Straight to the middle once a race starts: the camera cuts to the car anyway.)
    menuShift.current = phase === 'menu' ? lerp(menuShift.current, onMenu ? MENU_SHIFT : 0, 1 - Math.exp(-7 * dt)) : 0
    const shift = menuShift.current < 0.001 ? 0 : menuShift.current
    const filmOffset = -shift * 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect * cam.getFilmWidth()
    if (cam.filmOffset !== filmOffset) {
      cam.filmOffset = filmOffset
      cam.updateProjectionMatrix()
    }
    // Looking around the track: the orbit controls have the camera. While the
    // menu slides away on the way there, it holds still.
    if (viewing || leavingMenu) return
    let targetFov: number = T.baseFov

    if (phase === 'menu' || phase === 'results') {
      orbitAngle.current += ORBIT_SPEED * dt
      const a = orbitAngle.current
      // Further out on the menu, so the whole circuit fits in the right half.
      const away = phase === 'menu' ? MENU_ZOOM_OUT : 1
      desired.set(
        board.centerX + Math.cos(a) * ORBIT_RADIUS * away,
        ORBIT_HEIGHT * away,
        board.centerZ + Math.sin(a) * ORBIT_RADIUS * away,
      )
      lookAt.set(board.centerX, -2, board.centerZ)
      cam.position.lerp(desired, 1 - Math.exp(-1.5 * dt))
      look.current.lerp(lookAt, 1 - Math.exp(-1.5 * dt))
      lastTeleport.current = -1 // cut straight to the kart when the race starts
    } else {
      const { position, yaw, speed } = kartState
      const speedK = clamp(Math.abs(speed) / T.maxSpeed, 0, 1)
      // The kart jumped (new lap, reset): cut straight to it instead of flying over.
      const cut = kartState.teleports !== lastTeleport.current
      lastTeleport.current = kartState.teleports

      if (cameraView === 'high') {
        const H = T.high
        const ahead = track.path[(nearestOnTrack(position.x, position.z).index + SAMPLES_AHEAD) % track.path.length]
        // Follow the track, unless you've turned round and are driving against it.
        const targetYaw = Math.abs(wrapAngle(yaw - ahead.yaw)) > FACING_BACKWARDS ? yaw : ahead.yaw
        const switched = lastView.current !== 'high'

        if (cut || switched) viewYaw.current = targetYaw
        else viewYaw.current += wrapAngle(targetYaw - viewYaw.current) * (1 - Math.exp(-H.turn * dt))
        if (cut) distance.current = H.distanceSlow
        else distance.current = lerp(distance.current, lerp(H.distanceSlow, H.distanceFast, speedK), 1 - Math.exp(-H.zoom * dt))

        const lookAhead = lerp(H.lookAheadSlow, H.lookAheadFast, speedK)
        focusWanted.set(
          position.x + Math.sin(viewYaw.current) * lookAhead,
          position.y + 0.4,
          position.z + Math.cos(viewYaw.current) * lookAhead,
        )
        if (cut || switched) focus.current.copy(focusWanted)
        else focus.current.lerp(focusWanted, 1 - Math.exp(-H.follow * dt))

        const orbit = viewYaw.current + H.side
        const across = Math.cos(H.pitch) * distance.current
        desired.set(
          focus.current.x - Math.sin(orbit) * across,
          focus.current.y + Math.sin(H.pitch) * distance.current,
          focus.current.z - Math.cos(orbit) * across,
        )
        lookAt.copy(focus.current)
        kartState.viewFocus.copy(focus.current)
        targetFov = H.fov

        if (cut) {
          cam.position.copy(desired)
          look.current.copy(lookAt)
        } else {
          cam.position.lerp(desired, 1 - Math.exp(-HIGH_GLIDE * dt))
          look.current.lerp(lookAt, 1 - Math.exp(-HIGH_GLIDE * dt))
        }
      } else {
        const fx = Math.sin(yaw)
        const fz = Math.cos(yaw)
        desired.set(position.x - fx * T.camDistance, position.y + T.camHeight, position.z - fz * T.camDistance)
        lookAt.set(position.x + fx * T.camLookAhead, position.y + T.camLookHeight, position.z + fz * T.camLookAhead)
        kartState.viewFocus.copy(position)

        if (cut) {
          cam.position.copy(desired)
          look.current.copy(lookAt)
        } else {
          cam.position.lerp(desired, 1 - Math.exp(-T.camFollow * dt))
          look.current.lerp(lookAt, 1 - Math.exp(-T.camFollow * 2 * dt))
        }
        targetFov += T.speedFov * speedK
      }
      lastView.current = cameraView

      // Wall hit: a quick, fading shake.
      const shake = kartState.impact * kartState.impact * 0.3 + kartState.rumble * 0.02
      if (shake > 0.001) {
        cam.position.x += (Math.random() - 0.5) * shake
        cam.position.y += (Math.random() - 0.5) * shake
        cam.position.z += (Math.random() - 0.5) * shake
      }
    }

    cam.lookAt(look.current)
    cameraLook.copy(look.current)
    cam.fov = lerp(cam.fov, targetFov, 1 - Math.exp(-4 * dt))
    cam.updateProjectionMatrix()
  })

  return null
}
