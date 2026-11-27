// POST /api/laps: a qualifying lap from the game, for the board.
//
//   {"track":"lider-7","device":"<uuid>","nickname":"TINCHO","carId":"race",
//    "timeMs":36811,"sectorsMs":[12001,12500,12310]}
//
// No accounts, so the checks are about believability (_rules.ts) and pace: a few submissions a
// minute per address. Each browser keeps only its best per track; a slower lap changes nothing.

import { hasDatabase, query } from './_db.js'
import { addressHash, json, readBoard } from './_board.js'
import { readSubmission } from './_rules.js'

const MAX_BYTES = 2_000
const ATTEMPTS_PER_WINDOW = 20
const WINDOW = '10 minutes'

export async function POST(request: Request) {
  if (!hasDatabase()) return json(503, { error: 'The leaderboard is offline' })
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return json(413, { error: 'Too large' })
  const text = await request.text()
  if (text.length > MAX_BYTES) return json(413, { error: 'Too large' })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'Not JSON' })
  }
  const read = readSubmission(body)
  if ('error' in read) return json(400, { error: read.error })
  const { lap } = read

  try {
    // Pace: count this address's recent submissions first, then note this one.
    const ip = addressHash(request)
    const [{ count }] = await query<{ count: number }>(
      `select count(*)::int as count from lap_attempts where ip_hash = $1 and at > now() - $2::interval`,
      [ip, WINDOW],
    )
    if (count >= ATTEMPTS_PER_WINDOW) return json(429, { error: 'Too many laps sent. Try again in a few minutes.' })
    await query(`insert into lap_attempts (ip_hash) values ($1)`, [ip])
    await query(`delete from lap_attempts where at < now() - interval '1 day'`)

    // Keep the browser's best: a new row, or an update only when this lap is faster.
    const saved = await query(
      `insert into laps (track_id, device_id, nickname, time_ms, sectors_ms, car_id)
       values ($1, $2::uuid, $3, $4, $5::int[], $6)
       on conflict (track_id, device_id) do update
         set nickname = excluded.nickname, time_ms = excluded.time_ms, sectors_ms = excluded.sectors_ms,
             car_id = excluded.car_id, updated_at = now()
         where excluded.time_ms < laps.time_ms
       returning id`,
      [lap.track, lap.device, lap.nickname, lap.timeMs, lap.sectorsMs, lap.carId],
    )
    const board = await readBoard(lap.track, lap.device)
    return json(200, { ...board, improved: saved.length > 0 })
  } catch (error) {
    console.error('[laps]', error)
    return json(503, { error: 'The leaderboard is offline' })
  }
}
