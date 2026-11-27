import { create } from 'zustand'
import { finishRecording, loadGhost, resetRecorder } from './ghostLap'
import { DEFAULT_CAR, isCarId, type CarId } from '../cars'
import { QUALY_LAPS } from '../../../api/_rules'
import { saveCircuit, savedCircuit } from '../track/circuits'
import { selectTrack } from '../track/layout'

// Two ways to play:
//   practice — as many laps as you like. First lap from the grid, then flying
//              laps; each lap time pops up as you cross the line. Not saved.
//   qualy    — one run from your pit box: drive out of the pits and round to the
//              line (the out-lap), then ATTEMPTS timed laps back to back. Each lap
//              time pops up as you cross the line; after the last one the results
//              come up. Your best lap is saved as the track record.
export type Mode = 'practice' | 'qualy'

/** Qualy: timed laps in a run. The leaderboard's rules count on the same number. */
export const ATTEMPTS = QUALY_LAPS
export const COUNTDOWN_SECONDS = 3

export type Phase =
  | 'menu' // title screen
  | 'countdown' // 3, 2, 1 on the grid
  | 'outlap' // qualy: out of the pits and round to the line, timer not running yet
  | 'racing' // timer running
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
  /** The circuit you race on (saved). Its id keys the records, the ghost and the leaderboard. */
  circuitId: string
  mode: Mode
  phase: Phase
  /** Qualy: times of the attempts done so far. */
  attempts: number[]
  /** Qualy: each attempt's three sector times, for sending a lap to the leaderboard. */
  attemptSectors: number[][]
  /** Practice: every completed lap this session. */
  practiceLaps: number[]
  lastLapTime: number | null
  /** Best qualy attempt ever on this circuit (saved in the browser). */
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
  backToMenu: () => void
  /** The kart crossed the end of sector `index` at lap time `time`. */
  completeSector: (index: number, time: number) => void
  toggleGhost: () => void
  setViewing: (on: boolean) => void
  /** From the menu: slide it away, then look around the track (MainMenu calls setViewing when it's gone). */
  viewTrack: () => void
  setCar: (id: CarId) => void
  /** Race on another circuit (from the menu): the world is rebuilt for it, and its own records load. */
  setCircuit: (id: string) => void
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

const bestKey = (circuit: string) => `kart-race:best:${circuit}`
const loadBest = (circuit: string): number | null => {
  try {
    const v = localStorage.getItem(bestKey(circuit))
    return v ? Number(v) : null
  } catch {
    return null
  }
}
const saveBest = (circuit: string, t: number) => {
  try {
    localStorage.setItem(bestKey(circuit), String(t))
  } catch {
    // private mode etc: the record just won't survive a reload
  }
}

const sectorsKey = (circuit: string) => `kart-race:sectors:${circuit}`
const loadSectors = (circuit: string): (number | null)[] => {
  try {
    const v = JSON.parse(localStorage.getItem(sectorsKey(circuit)) ?? 'null')
    return Array.isArray(v) && v.length === SECTORS ? v : [null, null, null]
  } catch {
    return [null, null, null]
  }
}
const saveSectors = (circuit: string, v: (number | null)[]) => {
  try {
    localStorage.setItem(sectorsKey(circuit), JSON.stringify(v))
  } catch {
    // fine, they just won't survive a reload
  }
}

// The same circuit as the track (layout.ts reads the saved choice too).
const firstCircuit = savedCircuit()
loadGhost(firstCircuit)

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
  circuitId: firstCircuit,
  mode: 'qualy',
  phase: 'menu',
  attempts: [],
  attemptSectors: [],
  practiceLaps: [],
  lastLapTime: null,
  personalBest: loadBest(firstCircuit),
  previousBest: loadBest(firstCircuit),
  gridId: 0,
  sectors: [],
  lastSectors: [],
  bestSectors: [null, null, null],
  recordSectors: loadSectors(firstCircuit),
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
      attemptSectors: [],
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
    const { mode, attempts, attemptSectors, practiceLaps, personalBest, sectors } = get()
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
    if (isRecord) saveBest(get().circuitId, time)
    const laps = [...attempts, time]
    const qualyLap = {
      attempts: laps,
      attemptSectors: [...attemptSectors, sectors.map((s) => s.time)],
      lastLapTime: time,
      personalBest: isRecord ? time : personalBest,
      ...lapSectors,
    }

    if (laps.length >= ATTEMPTS) {
      // Last timed lap: stop the clock on it and show the results.
      race.time = time
      set({ phase: 'results', ...qualyLap })
      return
    }
    // More to go: the next timed lap starts at the line, like a practice lap.
    race.time = pastTheLine
    race.nextCheckpoint = 0
    race.sinceLap = 0
    race.sectorStart = 0
    set(qualyLap)
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
      saveSectors(get().circuitId, nextRecord)
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
  setCircuit: (circuitId) => {
    if (circuitId === get().circuitId || get().phase !== 'menu') return
    // The track first: the world is rebuilt from it as soon as circuitId changes.
    selectTrack(circuitId)
    saveCircuit(circuitId)
    loadGhost(circuitId)
    resetRecorder()
    const best = loadBest(circuitId)
    set((s) => ({
      circuitId,
      personalBest: best,
      previousBest: best,
      recordSectors: loadSectors(circuitId),
      bestSectors: [null, null, null],
      attempts: [],
      attemptSectors: [],
      practiceLaps: [],
      lastLapTime: null,
      sectors: [],
      lastSectors: [],
      viewing: false,
      leavingMenu: false,
      gridId: s.gridId + 1,
    }))
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
