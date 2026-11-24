import { create } from 'zustand'
import { finishRecording, loadGhost, resetRecorder } from './ghostLap'
import { DEFAULT_CAR, isCarId, type CarId } from '../cars'

// Two ways to play:
//   practice — as many laps as you like. First lap from the grid, then flying
//              laps; each lap time pops up as you cross the line. Not saved.
//   qualy    — ATTEMPTS flying laps. Each starts in your pit box: drive out of
//              the pits, do an out-lap, and the timed lap starts when you cross
//              the line. After each lap the game waits for you to press Enter
//              before the next one. Your best attempt is saved as the track record.
export type Mode = 'practice' | 'qualy'

export const ATTEMPTS = 3
export const COUNTDOWN_SECONDS = 3
// Bump this when the track's layout or the driving physics change, so old
// records don't carry over.
const TRACK_ID = 'lider-7'

export type Phase =
  | 'menu' // title screen
  | 'countdown' // 3, 2, 1 on the grid
  | 'outlap' // qualy: out of the pits and round to the line, timer not running yet
  | 'racing' // timer running
  | 'finished' // qualy: lap done, waiting for Enter
  | 'results' // qualy: summary after the last attempt

/**
 * How a sector time compares, like F1 timing screens:
 *   purple — fastest ever on this track
 *   green  — your best this session
 *   yellow — slower than that
 */
export type SectorStatus = 'purple' | 'green' | 'yellow'
export type SectorTime = { time: number; status: SectorStatus }
export const SECTORS = 3

type GameState = {
  mode: Mode
  phase: Phase
  /** Qualy: times of the attempts done so far. */
  attempts: number[]
  /** Practice: every completed lap this session. */
  practiceLaps: number[]
  lastLapTime: number | null
  /** Best qualy attempt ever on this track (saved in the browser). */
  personalBest: number | null
  /** Record before this session started, to show "new record!". */
  previousBest: number | null
  /** Bumped every time the kart must go back to the grid. */
  gridId: number

  /** Sector times of the lap in progress (S1, S2, S3). */
  sectors: SectorTime[]
  /** Sector times of the last completed lap. */
  lastSectors: SectorTime[]
  /** Best time for each sector this session, and ever (saved). */
  bestSectors: (number | null)[]
  recordSectors: (number | null)[]
  /** Show the ghost of your fastest lap. */
  showGhost: boolean
  /** Menu hidden, free camera to look around the whole track. */
  viewing: boolean
  /** The menu is sliding out on its way to the track view; the camera holds still meanwhile. */
  leavingMenu: boolean
  /** Which camera you race with. The high view is switched off for now. */
  cameraView: CameraView
  /** Which car you drive (saved). */
  carId: CarId

  startPractice: () => void
  startQualy: () => void
  finishLap: (time: number) => void
  /** Qualy: Enter after a lap → next attempt, or results after the last one. */
  advance: () => void
  backToMenu: () => void
  /** The kart crossed the end of sector `index` at lap time `time`. */
  completeSector: (index: number, time: number) => void
  toggleGhost: () => void
  setViewing: (on: boolean) => void
  /** From the menu: slide it away, then look around the track (MainMenu calls setViewing when it's gone). */
  viewTrack: () => void
  setCar: (id: CarId) => void
}

const carKey = 'kart-race:car'
const loadCar = (): CarId => {
  try {
    const saved = localStorage.getItem(carKey)
    return isCarId(saved) ? saved : DEFAULT_CAR
  } catch {
    return DEFAULT_CAR
  }
}

export type CameraView = 'high' | 'chase'

// Values that change every frame. Kept out of React on purpose (see kartState).
export const race = {
  time: 0, // current lap time in seconds
  countdown: 0, // seconds left before GO
  nextCheckpoint: 0,
  wrongWay: false,
  /** Practice: seconds since the last lap was completed (drives the pop-up). */
  sinceLap: Infinity,
  /** Lap time when the current sector started. */
  sectorStart: 0,
  /** Qualy out-lap: you've left the pit lane, so the next time over the line starts the lap. */
  leftPits: false,
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

const sectorsKey = `kart-race:sectors:${TRACK_ID}`
const loadSectors = (): (number | null)[] => {
  try {
    const v = JSON.parse(localStorage.getItem(sectorsKey) ?? 'null')
    return Array.isArray(v) && v.length === SECTORS ? v : [null, null, null]
  } catch {
    return [null, null, null]
  }
}
const saveSectors = (v: (number | null)[]) => {
  try {
    localStorage.setItem(sectorsKey, JSON.stringify(v))
  } catch {
    // fine, they just won't survive a reload
  }
}

loadGhost(TRACK_ID)

const resetLap = () => {
  race.time = 0
  race.countdown = COUNTDOWN_SECONDS
  race.nextCheckpoint = 0
  race.wrongWay = false
  race.sinceLap = Infinity
  race.sectorStart = 0
  race.leftPits = false
  resetRecorder()
}

export const useGame = create<GameState>()((set, get) => ({
  mode: 'qualy',
  phase: 'menu',
  attempts: [],
  practiceLaps: [],
  lastLapTime: null,
  personalBest: loadBest(),
  previousBest: loadBest(),
  gridId: 0,
  sectors: [],
  lastSectors: [],
  bestSectors: [null, null, null],
  recordSectors: loadSectors(),
  showGhost: true,
  viewing: false,
  leavingMenu: false,
  cameraView: 'chase',
  carId: loadCar(),

  startPractice: () => {
    resetLap()
    set((s) => ({
      mode: 'practice',
      phase: 'countdown',
      practiceLaps: [],
      lastLapTime: null,
      sectors: [],
      lastSectors: [],
      gridId: s.gridId + 1,
    }))
  },

  startQualy: () => {
    resetLap()
    set((s) => ({
      mode: 'qualy',
      phase: 'outlap',
      attempts: [],
      lastLapTime: null,
      sectors: [],
      lastSectors: [],
      previousBest: s.personalBest,
      gridId: s.gridId + 1,
    }))
  },

  finishLap: (time) => {
    // `time` is the exact moment at the line, a little before the current step ended.
    const pastTheLine = Math.max(0, race.time - time)
    // Sector 3 ends at the line.
    get().completeSector(SECTORS - 1, time)
    finishRecording(time)
    const { mode, attempts, practiceLaps, personalBest, sectors } = get()
    const lapSectors = { lastSectors: sectors, sectors: [] as SectorTime[] }

    if (mode === 'practice') {
      // Keep going: the next lap started at the line, so it already has this bit.
      race.time = pastTheLine
      race.nextCheckpoint = 0
      race.sinceLap = 0
      race.sectorStart = 0
      set({ practiceLaps: [...practiceLaps, time], lastLapTime: time, ...lapSectors })
      return
    }

    const isRecord = personalBest === null || time < personalBest
    if (isRecord) saveBest(time)
    race.time = time // the on-screen timer stops on the exact lap time
    set({
      phase: 'finished',
      attempts: [...attempts, time],
      lastLapTime: time,
      personalBest: isRecord ? time : personalBest,
      ...lapSectors,
    })
  },

  advance: () => {
    const { phase, attempts } = get()
    if (phase !== 'finished') return
    if (attempts.length >= ATTEMPTS) {
      set({ phase: 'results' })
      return
    }
    resetLap()
    set((s) => ({ phase: 'outlap', gridId: s.gridId + 1 }))
  },

  backToMenu: () => set((s) => ({ phase: 'menu', viewing: false, leavingMenu: false, gridId: s.gridId + 1 })),

  completeSector: (index, time) => {
    const { sectors, bestSectors, recordSectors } = get()
    if (sectors.length !== index) return // already counted, or one was skipped
    const t = time - race.sectorStart
    race.sectorStart = time
    const record = recordSectors[index]
    const best = bestSectors[index]
    let status: SectorStatus = 'yellow'
    const nextBest = [...bestSectors]
    const nextRecord = [...recordSectors]
    if (record === null || t < record) {
      status = 'purple'
      nextRecord[index] = t
      nextBest[index] = t
      saveSectors(nextRecord)
    } else if (best === null || t < best) {
      status = 'green'
      nextBest[index] = t
    }
    set({ sectors: [...sectors, { time: t, status }], bestSectors: nextBest, recordSectors: nextRecord })
  },

  toggleGhost: () => set((s) => ({ showGhost: !s.showGhost })),
  setViewing: (on) => set({ viewing: on, leavingMenu: false }),
  viewTrack: () => {
    const { phase, viewing, leavingMenu } = get()
    if (phase !== 'menu' || viewing || leavingMenu) return
    // Nothing to wait for without the animation.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) set({ viewing: true })
    else set({ leavingMenu: true })
  },
  setCar: (carId) => {
    set({ carId })
    try {
      localStorage.setItem(carKey, carId)
    } catch {
      // private mode etc: the choice just won't survive a reload
    }
  },
}))

/** Fastest of a list of lap times, or null. */
export const bestOf = (laps: number[]) => (laps.length ? Math.min(...laps) : null)

/** 83.456 -> "1:23.456" */
export function formatTime(t: number | null | undefined) {
  if (t === null || t === undefined || !Number.isFinite(t)) return '—'
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

/** +0.512 / −1.204 */
export const formatDelta = (d: number) => `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(3)}`

// Handy while developing: poke the game from the browser console.
if (import.meta.env.DEV) Object.assign(window, { game: useGame, race })
