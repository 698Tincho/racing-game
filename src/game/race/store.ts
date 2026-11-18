import { create } from 'zustand'

// How a session goes: 1 practice lap, then ATTEMPTS timed laps. Each lap is a
// standing start from the grid after a countdown.
export const ATTEMPTS = 3
export const COUNTDOWN_SECONDS = 3
export const FINISH_BANNER_SECONDS = 2.5
// Bump this when a track's layout changes, so old records don't carry over.
const TRACK_ID = 'track-1-v2'

export type Phase =
  | 'menu' // title screen
  | 'countdown' // 3, 2, 1 on the grid
  | 'racing' // timer running
  | 'finished' // lap done, showing the time for a moment
  | 'results' // summary after the last attempt

type GameState = {
  phase: Phase
  lap: number // 0 = practice, 1..ATTEMPTS = timed attempts
  practiceTime: number | null
  attempts: number[]
  lastLapTime: number | null
  /** Best attempt ever on this track (saved in the browser). */
  personalBest: number | null
  /** Best attempt before this session started, to show "new record!". */
  previousBest: number | null
  /** Bumped every time the kart must go back to the grid. */
  gridId: number

  startSession: () => void
  finishLap: (time: number) => void
  advance: () => void
  backToMenu: () => void
}

// Values that change every frame. Kept out of React on purpose (see kartState).
export const race = {
  time: 0, // current lap time in seconds
  countdown: 0, // seconds left before GO
  nextCheckpoint: 0,
  bannerTime: 0, // how long the finish banner has been up
  wrongWay: false,
}

const bestKey = `kart-race:best:${TRACK_ID}`
const loadBest = (): number | null => {
  try {
    const v = localStorage.getItem(bestKey)
    return v ? Number(v) : null
  } catch {
    return null
  }
}
const saveBest = (t: number) => {
  try {
    localStorage.setItem(bestKey, String(t))
  } catch {
    // private mode etc: the record just won't survive a reload
  }
}

const resetLap = () => {
  race.time = 0
  race.countdown = COUNTDOWN_SECONDS
  race.nextCheckpoint = 0
  race.bannerTime = 0
  race.wrongWay = false
}

export const useGame = create<GameState>()((set, get) => ({
  phase: 'menu',
  lap: 0,
  practiceTime: null,
  attempts: [],
  lastLapTime: null,
  personalBest: loadBest(),
  previousBest: loadBest(),
  gridId: 0,

  startSession: () => {
    resetLap()
    set((s) => ({
      phase: 'countdown',
      lap: 0,
      practiceTime: null,
      attempts: [],
      lastLapTime: null,
      previousBest: s.personalBest,
      gridId: s.gridId + 1,
    }))
  },

  finishLap: (time) => {
    const { lap, attempts, personalBest } = get()
    race.bannerTime = 0
    if (lap === 0) {
      set({ phase: 'finished', practiceTime: time, lastLapTime: time })
      return
    }
    const isRecord = personalBest === null || time < personalBest
    if (isRecord) saveBest(time)
    set({
      phase: 'finished',
      attempts: [...attempts, time],
      lastLapTime: time,
      personalBest: isRecord ? time : personalBest,
    })
  },

  advance: () => {
    const { lap } = get()
    if (lap >= ATTEMPTS) {
      set({ phase: 'results' })
      return
    }
    resetLap()
    set((s) => ({ phase: 'countdown', lap: s.lap + 1, gridId: s.gridId + 1 }))
  },

  backToMenu: () => set((s) => ({ phase: 'menu', gridId: s.gridId + 1 })),
}))

/** Best of the timed attempts so far this session. */
export const sessionBest = (attempts: number[]) => (attempts.length ? Math.min(...attempts) : null)

/** 83.456 -> "1:23.456" */
export function formatTime(t: number | null | undefined) {
  if (t === null || t === undefined || !Number.isFinite(t)) return '—'
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

// Handy while developing: poke the game from the browser console.
if (import.meta.env.DEV) Object.assign(window, { game: useGame, race })
