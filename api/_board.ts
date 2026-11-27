// Reading the board, shared by both endpoints.

import { createHash } from 'node:crypto'
import { query } from './_db.js'
import { BOARD_SIZE, type BoardResponse, type BoardRow } from './_rules.js'

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

/** The top of the board, and this browser's own best and place if `device` is given. */
export async function readBoard(track: string, device: string | null): Promise<BoardResponse> {
  const rows = await query<{ nickname: string; time_ms: number; car_id: string; mine: boolean }>(
    `select nickname, time_ms, car_id, coalesce(device_id = $2::uuid, false) as mine
       from laps where track_id = $1
      order by time_ms, updated_at
      limit $3`,
    [track, device, BOARD_SIZE],
  )
  const top: BoardRow[] = rows.map((r, i) => ({ rank: i + 1, nickname: r.nickname, timeMs: r.time_ms, carId: r.car_id, mine: r.mine }))

  let you: BoardResponse['you'] = null
  if (device) {
    const [own] = await query<{ nickname: string; time_ms: number; rank: number }>(
      `select l.nickname, l.time_ms,
              (select count(*)::int + 1 from laps o
                where o.track_id = l.track_id
                  and (o.time_ms < l.time_ms or (o.time_ms = l.time_ms and o.updated_at < l.updated_at))) as rank
         from laps l where l.track_id = $1 and l.device_id = $2::uuid`,
      [track, device],
    )
    if (own) you = { rank: own.rank, nickname: own.nickname, timeMs: own.time_ms }
  }
  return { track, top, you }
}

/**
 * A salted hash of the caller's address, for the rate limit: the address itself is never stored.
 * On Vercel the real address is the first one in x-forwarded-for. The salt must be secret (there
 * aren't many addresses to try): LAP_SALT if it's set, else the database's own address, which is.
 */
export function addressHash(request: Request) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const salt = process.env.LAP_SALT || process.env.DATABASE_URL || 'local-development'
  return createHash('sha256').update(`${salt}:${address}`).digest('hex')
}
