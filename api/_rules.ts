// The leaderboard's rules, shared by the API and the game, so both check a lap and a nickname
// the same way. (The leading _ keeps Vercel from serving this file as an endpoint.)
// Plain TypeScript with no imports that run: the API runs it in Node, the game in the browser.

import type { CarId } from '../src/game/cars'

/**
 * Circuits with a board. The key is the circuit's id (src/game/track/circuits.ts), which changes
 * with its layout or the driving physics: a new id starts a fresh board here. `minLapMs` is the fastest believable lap,
 * comfortably under the best real ones, so only made-up times are turned away.
 */
export const TRACKS: Record<string, { name: string; minLapMs: number }> = {
  // About 54% of a steady bot lap (46.7 s, 54.6 s and 43.2 s): well under any real one.
  'lider-7': { name: 'Circuit 01', minLapMs: 25_000 },
  'forest-1': { name: 'Circuit 02', minLapMs: 29_000 },
  'city-1': { name: 'Circuit 03', minLapMs: 23_000 },
}

export const CAR_IDS = ['race', 'race-future', 'sedan-sports'] as const satisfies readonly CarId[]

export const BOARD_SIZE = 10
export const SECTORS = 3
/** Timed laps in a qualifying run (the game's ATTEMPTS). */
export const QUALY_LAPS = 3

/**
 * The least time a whole qualifying run can take, from asking for its ticket to sending its best
 * lap: the out-lap from the pit box (well over this), then QUALY_LAPS laps, none faster than the
 * best. Shaved a little, as the game's clock and the server's can drift apart.
 */
export const OUT_LAP_MIN_MS = 15_000
export const minRunMs = (bestLapMs: number) => Math.floor((OUT_LAP_MIN_MS + QUALY_LAPS * bestLapMs) * 0.97)
const MAX_LAP_MS = 10 * 60_000
const MIN_SECTOR_MS = 4_000
/** The three sector times are rounded to the millisecond, so their sum can be a hair off the lap. */
const SECTOR_SLACK_MS = 5

export const NICKNAME_MIN = 3
export const NICKNAME_MAX = 12
const NICKNAME_CHARS = /^[\p{L}\p{N} ._-]+$/u

// Not a complete filter, just the obvious ones, in English and Spanish. Checked against the
// nickname's letters only, without accents, so spaces and dots don't get round it.
const BLOCKED = [
  'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'porn',
  'dick', 'cock', 'pussy', 'puta', 'puto', 'mierda', 'concha', 'pija', 'verga', 'pelotud', 'forro',
  'trolo', 'maricon', 'culiao', 'chupala', 'garcha',
]

/** Spaces trimmed and collapsed, in one Unicode form. */
export const tidyNickname = (raw: string) => raw.normalize('NFC').trim().replace(/\s+/g, ' ')

/** Why a nickname can't be used, or null when it's fine. Pass it through tidyNickname first. */
export function nicknameProblem(nickname: string): string | null {
  const length = [...nickname].length
  if (length < NICKNAME_MIN) return `At least ${NICKNAME_MIN} characters`
  if (length > NICKNAME_MAX) return `At most ${NICKNAME_MAX} characters`
  if (!NICKNAME_CHARS.test(nickname)) return 'Letters, numbers, spaces, dots, dashes and underscores only'
  const letters = nickname
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
  if (BLOCKED.some((word) => letters.includes(word))) return 'Pick another nickname'
  return null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isDeviceId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

export type LapSubmission = {
  track: string
  device: string
  /** The qualifying run's ticket (POST /api/runs). */
  run: string
  nickname: string
  carId: string
  timeMs: number
  sectorsMs: number[]
}

/** A lap from the game, checked: the lap itself, or what's wrong with it. */
export function readSubmission(body: unknown): { lap: LapSubmission } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Expected a JSON object' }
  const b = body as Record<string, unknown>
  const track = typeof b.track === 'string' ? TRACKS[b.track] : undefined
  if (!track) return { error: 'Unknown track' }
  if (!isDeviceId(b.device)) return { error: 'Bad device id' }
  if (!isDeviceId(b.run)) return { error: 'This lap is not from a qualifying run' }
  if (typeof b.nickname !== 'string') return { error: 'Nickname missing' }
  const nickname = tidyNickname(b.nickname)
  const problem = nicknameProblem(nickname)
  if (problem) return { error: problem }
  if (typeof b.carId !== 'string' || !(CAR_IDS as readonly string[]).includes(b.carId)) return { error: 'Unknown car' }

  const timeMs = b.timeMs
  if (typeof timeMs !== 'number' || !Number.isInteger(timeMs)) return { error: 'Bad lap time' }
  if (timeMs < track.minLapMs || timeMs > MAX_LAP_MS) return { error: 'Lap time out of range' }
  const sectors = b.sectorsMs
  if (!Array.isArray(sectors) || sectors.length !== SECTORS) return { error: 'Expected three sector times' }
  if (!sectors.every((s) => typeof s === 'number' && Number.isInteger(s) && s >= MIN_SECTOR_MS)) return { error: 'Bad sector time' }
  const sum = (sectors as number[]).reduce((a, s) => a + s, 0)
  if (Math.abs(sum - timeMs) > SECTOR_SLACK_MS) return { error: "Sector times don't add up to the lap" }

  return { lap: { track: b.track as string, device: b.device, run: b.run, nickname, carId: b.carId, timeMs, sectorsMs: sectors as number[] } }
}

/** One line of the board, as the API sends it. */
export type BoardRow = { rank: number; nickname: string; timeMs: number; carId: string; mine: boolean }

/** What GET /api/leaderboard and POST /api/laps answer with. `you` is this browser's best, if it has one. */
export type BoardResponse = {
  track: string
  top: BoardRow[]
  you: { rank: number; nickname: string; timeMs: number } | null
  /** POST only: whether this lap beat this browser's best on the board. */
  improved?: boolean
}
