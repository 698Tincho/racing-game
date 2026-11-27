// POST /api/runs: the game starts a qualifying run.
//
//   {"track":"lider-7","device":"<uuid>"}  →  {"run":"<uuid>"}
//
// The answer is a one-time ticket. POST /api/laps only takes a lap with an unused ticket that's
// old enough for the whole run (minRunMs in _rules.ts), so a made-up lap has to wait as long as
// driving it would. One address can hold only a few open tickets at once, so asking for many in
// parallel doesn't get round the wait.

import { hasDatabase, query } from './_db.js'
import { addressHash, json } from './_board.js'
import { TRACKS, isDeviceId } from './_rules.js'

const MAX_BYTES = 500
/** Unused tickets from the last half hour one address may hold. */
const OPEN_RUNS_PER_ADDRESS = 3

export async function POST(request: Request) {
  if (!hasDatabase()) return json(503, { error: 'The leaderboard is offline' })
  const text = await request.text()
  if (text.length > MAX_BYTES) return json(413, { error: 'Too large' })
  let body: { track?: unknown; device?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'Not JSON' })
  }
  if (typeof body.track !== 'string' || !TRACKS[body.track]) return json(400, { error: 'Unknown track' })
  if (!isDeviceId(body.device)) return json(400, { error: 'Bad device id' })

  try {
    const ip = addressHash(request)
    await query(`delete from runs where started_at < now() - interval '1 day'`)
    const [{ open }] = await query<{ open: number }>(
      `select count(*)::int as open from runs where ip_hash = $1 and used_at is null and started_at > now() - interval '30 minutes'`,
      [ip],
    )
    if (open >= OPEN_RUNS_PER_ADDRESS) {
      // Retire the oldest open one, so a player who restarts a lot is never locked out.
      await query(
        `update runs set used_at = now()
          where id = (select id from runs where ip_hash = $1 and used_at is null order by started_at limit 1)`,
        [ip],
      )
    }
    const [{ id }] = await query<{ id: string }>(`insert into runs (track_id, device_id, ip_hash) values ($1, $2::uuid, $3) returning id`, [
      body.track,
      body.device,
      ip,
    ])
    return json(200, { run: id })
  } catch (error) {
    console.error('[runs]', error)
    return json(503, { error: 'The leaderboard is offline' })
  }
}
