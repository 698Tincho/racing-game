// GET /api/leaderboard?track=lider-7[&device=<this browser's id>]
// The fastest laps on a track. With a device id it also says where that browser's best stands,
// and isn't cached; without, it's cached at the edge for a few seconds (the menu asks on load).

import { hasDatabase } from './_db.js'
import { json, readBoard } from './_board.js'
import { TRACKS, isDeviceId } from './_rules.js'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const track = params.get('track') ?? ''
  if (!TRACKS[track]) return json(400, { error: 'Unknown track' })
  const device = params.get('device')
  if (device !== null && !isDeviceId(device)) return json(400, { error: 'Bad device id' })
  if (!hasDatabase()) return json(503, { error: 'The leaderboard is offline' })

  try {
    const board = await readBoard(track, device)
    return json(200, board, device ? {} : { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' })
  } catch (error) {
    console.error('[leaderboard]', error)
    return json(503, { error: 'The leaderboard is offline' })
  }
}
