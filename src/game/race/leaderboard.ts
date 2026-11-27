import { create } from 'zustand'
import type { BoardResponse } from '../../../api/_rules'

// ---------------------------------------------------------------------------
// The online leaderboard (api/leaderboard.ts, api/laps.ts). No accounts: this
// browser gets a random id, kept in localStorage, so its best lap has one row
// on the board; the nickname is remembered for next time. If the API can't be
// reached the board just doesn't show, and the game carries on as before.
// ---------------------------------------------------------------------------

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

async function call(path: string, init?: RequestInit): Promise<BoardResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(path, { ...init, signal: controller.signal })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new LeaderboardError(response.status, (body as { error?: string }).error ?? 'The leaderboard is offline')
    return body as BoardResponse
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

type BoardState = {
  /** The last board fetched, for `track`. */
  board: BoardResponse | null
  /** 'offline': the API couldn't be reached (or there's no database): don't show the board. */
  status: 'idle' | 'loading' | 'ready' | 'offline'
  /** Whether `board` was fetched with this browser's id, so its `you` can be trusted. */
  mine: boolean
  sending: 'idle' | 'sending' | 'sent' | 'error'
  /** Why a send failed, to show under the nickname field. */
  sendError: string | null
  /** Fetch the board. `mine`: include this browser's place (not cached), for the results. */
  load: (track: string, mine: boolean) => Promise<void>
  /** Send a qualifying lap; the board comes back updated. */
  send: (lap: LapToSend) => Promise<void>
  /** Forget the last send, for the next results screen. */
  resetSend: () => void
}

export const useBoard = create<BoardState>()((set) => ({
  board: null,
  status: 'idle',
  mine: false,
  sending: 'idle',
  sendError: null,

  load: async (track, mine) => {
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
    set({ sending: 'sending', sendError: null })
    try {
      const board = await call('/api/laps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track: lap.track,
          device: deviceId(),
          nickname: lap.nickname,
          carId: lap.carId,
          timeMs: Math.round(lap.time * 1000),
          sectorsMs: lap.sectors.map((s) => Math.round(s * 1000)),
        }),
      })
      saveNickname(lap.nickname)
      set({ board, status: 'ready', mine: true, sending: 'sent' })
    } catch (error) {
      set({ sending: 'error', sendError: (error as Error).message })
    }
  },

  resetSend: () => set({ sending: 'idle', sendError: null }),
}))
