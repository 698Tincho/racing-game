// The ghost: a recording of your fastest lap, replayed as a see-through kart
// while you drive, so you can see exactly where you're gaining or losing.
//
// While racing, the kart's position is sampled 20 times a second. When a lap
// ends, if it's faster than the stored ghost, it becomes the new ghost and is
// saved in the browser.

export const GHOST_DT = 1 / 20
const STRIDE = 5 // x, z, yaw, speed, steer

export type GhostLap = { time: number; frames: number[] }

type Sample = { x: number; z: number; yaw: number; speed: number; steer: number }

const recorder = { frames: [] as number[], next: 0 }

/** Start recording a new lap from scratch. */
export function resetRecorder() {
  recorder.frames = []
  recorder.next = 0
}

/** Call every frame while racing, with the lap time and the kart's state. */
export function recordFrame(t: number, s: Sample) {
  while (t >= recorder.next) {
    recorder.frames.push(s.x, s.z, s.yaw, s.speed, s.steer)
    recorder.next += GHOST_DT
  }
}

let storageKey = ''
export const ghost = { best: null as GhostLap | null }

/** Load the saved ghost for a track. */
export function loadGhost(trackId: string) {
  storageKey = `kart-race:ghost:${trackId}`
  try {
    const raw = localStorage.getItem(storageKey)
    ghost.best = raw ? (JSON.parse(raw) as GhostLap) : null
  } catch {
    ghost.best = null
  }
}

/** A lap just ended: keep its recording if it beats the current ghost. */
export function finishRecording(lapTime: number) {
  const frames = recorder.frames
  resetRecorder()
  if (frames.length < STRIDE * 2) return
  if (ghost.best && ghost.best.time <= lapTime) return
  // Round to centimetres / milliradians: keeps the saved JSON small.
  ghost.best = { time: lapTime, frames: frames.map((v) => Math.round(v * 1000) / 1000) }
  try {
    localStorage.setItem(storageKey, JSON.stringify(ghost.best))
  } catch {
    // storage full or blocked: the ghost just won't survive a reload
  }
}

/** Where the ghost is at lap time `t`, smoothly between samples. Null when its lap is over. */
export function sampleGhost(t: number, out: Sample): Sample | null {
  const g = ghost.best
  if (!g) return null
  const count = g.frames.length / STRIDE
  const f = t / GHOST_DT
  const i = Math.floor(f)
  if (i < 0 || i >= count - 1) return null
  const k = f - i
  const a = i * STRIDE
  const b = a + STRIDE
  const lerp = (o: number) => g.frames[a + o] + (g.frames[b + o] - g.frames[a + o]) * k
  out.x = lerp(0)
  out.z = lerp(1)
  // Yaw: take the short way round.
  const ya = g.frames[a + 2]
  const yb = g.frames[b + 2]
  out.yaw = ya + Math.atan2(Math.sin(yb - ya), Math.cos(yb - ya)) * k
  out.speed = lerp(3)
  out.steer = lerp(4)
  return out
}
