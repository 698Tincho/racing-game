import { create } from 'zustand'
import { TRACKS, type BoardResponse } from '../../../api/_rules'

// ---------------------------------------------------------------------------
// The online leaderboard (api/leaderboard.ts, api/laps.ts). No accounts: this
// browser gets a random id, kept in localStorage, so its best lap has one row
// on the board; the nickname is remembered for next time. If the API can't be
// reached the board just doesn't show, and the game carries on as before.
// ---------------------------------------------------------------------------

/** Does this circuit have a board? (One being designed doesn't yet.) */
export const hasBoard = (track: string) => track in TRACKS

const DEVICE_KEY = 'kart-race:device'
const NICKNAME_KEY = 'kart-race:nickname'
const TIMEOUT_MS = 6000

/** This browser's id on the board, made the first time it's needed. */
export function deviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY)
    if (saved) return saved
    const id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    // Storage blocked: a fresh id each visit (its laps still count, just not as one row).
    return crypto.randomUUID()
  }
}

export const savedNickname = () => {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

const saveNickname = (nickname: string) => {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname)
  } catch {
    // fine: it'll be asked again next time
  }
}

async function call<T = BoardResponse>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(path, { ...init, signal: controller.signal })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new LeaderboardError(response.status, (body as { error?: string }).error ?? 'The leaderboard is offline')
    return body as T
  } catch (error) {
    if (error instanceof LeaderboardError) throw error
    throw new LeaderboardError(0, 'The leaderboard is offline')
  } finally {
    window.clearTimeout(timer)
  }
}

class LeaderboardError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export type LapToSend = { track: string; nickname: string; carId: string; time: number; sectors: number[] }

const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

type BoardState = {
  /** The last board fetched, for `track`. */
  board: BoardResponse | null
  /** 'offline': the API couldn't be reached (or there's no database): don't show the board. */
  status: 'idle' | 'loading' | 'ready' | 'offline'
  /** Whether `board` was fetched with this browser's id, so its `you` can be trusted. */
  mine: boolean
  sending: 'idle' | 'sending' | 'sent' | 'error'
  /**
   * The current qualifying run's ticket from the server (api/runs.ts), asked for as the run starts.
   * A lap is only taken with it, so without one (offline when the run began) nothing is offered.
   */
  run: { id: string; track: string } | null
  /** Why a send failed, to show under the nickname field. */
  sendError: string | null
  /** A qualifying run on `track` is starting: get its ticket. */
  startRun: (track: string) => Promise<void>
  /** Fetch the board. `mine`: include this browser's place (not cached), for the results. */
  load: (track: string, mine: boolean) => Promise<void>
  /** Send a qualifying lap; the board comes back updated. */
  send: (lap: LapToSend) => Promise<void>
  /** Forget the last send, for the next results screen. */
  resetSend: () => void
}

export const useBoard = create<BoardState>()((set, get) => ({
  board: null,
  status: 'idle',
  mine: false,
  run: null,
  sending: 'idle',
  sendError: null,

  startRun: async (track) => {
    set({ run: null })
    if (!hasBoard(track)) return
    try {
      const { run } = await call<{ run: string }>('/api/runs', post({ track, device: deviceId() }))
      set({ run: { id: run, track } })
    } catch {
      // Offline: this run won't go on the board.
    }
  },

  load: async (track, mine) => {
    // No board for this circuit: nothing to show, as when it can't be reached.
    if (!hasBoard(track)) return set({ status: 'offline' })
    set((s) => ({ status: s.board?.track === track ? s.status : 'loading', mine: s.mine && !mine ? false : s.mine }))
    const params = new URLSearchParams({ track })
    if (mine) params.set('device', deviceId())
    try {
      set({ board: await call(`/api/leaderboard?${params}`), status: 'ready', mine })
    } catch {
      set({ status: 'offline' })
    }
  },

  send: async (lap) => {
    const run = get().run
    if (!run || run.track !== lap.track) return
    set({ sending: 'sending', sendError: null })
    try {
      const board = await call(
        '/api/laps',
        post({
          track: lap.track,
          device: deviceId(),
          run: run.id,
          nickname: lap.nickname,
          carId: lap.carId,
          timeMs: Math.round(lap.time * 1000),
          sectorsMs: lap.sectors.map((s) => Math.round(s * 1000)),
        }),
      )
      saveNickname(lap.nickname)
      // The ticket is used up: the next run asks for a new one.
      set({ board, status: 'ready', mine: true, sending: 'sent', run: null })
    } catch (error) {
      const failure = error as LeaderboardError
      // A refused ticket won't work a second time; a network blip can be retried with the same one.
      set({ sending: 'error', sendError: failure.message, run: failure.status === 403 ? null : run })
    }
  },

  resetSend: () => set({ sending: 'idle', sendError: null }),
}))
