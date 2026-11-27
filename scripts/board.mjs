// Look after the leaderboard: list the times, and take out fake ones or bad nicknames.
//
//   npm run board -- list                       every track's board on Neon (.env.production)
//   npm run board -- list lider-7               one track
//   npm run board -- remove McFly               shows what it would remove (any track)
//   npm run board -- remove McFly --yes         removes it
//   npm run board -- remove 42 --yes            by the row's id (the # in the list)
//   npm run board:local -- list                 the same against Postgres.app (.env.local)
//
// Removing a row takes that browser off the board; its next faster lap puts it back.

import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('✖ DATABASE_URL is missing. Put it in .env.production (Neon) or .env.local (Postgres.app).')
  process.exit(1)
}

const [command, target, ...flags] = process.argv.slice(2)
const yes = flags.includes('--yes') || target === '--yes'
const time = (ms) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`
const day = (d) => d.toISOString().slice(0, 16).replace('T', ' ')

const db = new pg.Client({ connectionString: url })
await db.connect()
console.log(`Database: ${new URL(url).hostname}\n`)

try {
  if (command === 'list') {
    const { rows } = await db.query(
      `select id, track_id, nickname, time_ms, car_id, updated_at,
              rank() over (partition by track_id order by time_ms, updated_at) as rank
         from laps where $1::text is null or track_id = $1
        order by track_id, time_ms, updated_at`,
      [target ?? null],
    )
    if (rows.length === 0) console.log('No times yet.')
    let track = null
    for (const r of rows) {
      if (r.track_id !== track) {
        track = r.track_id
        console.log(`${track}`)
      }
      console.log(`  ${String(r.rank).padStart(3)}  ${r.nickname.padEnd(12)}  ${time(r.time_ms)}  ${r.car_id.padEnd(12)}  ${day(r.updated_at)}  #${r.id}`)
    }
  } else if (command === 'remove' && target && target !== '--yes') {
    const byId = /^\d+$/.test(target)
    const where = byId ? 'id = $1::bigint' : 'lower(nickname) = lower($1)'
    const { rows } = await db.query(`select id, track_id, nickname, time_ms from laps where ${where} order by track_id`, [target])
    if (rows.length === 0) {
      console.log(`Nothing matches "${target}".`)
    } else {
      for (const r of rows) console.log(`  #${r.id}  ${r.track_id}  ${r.nickname}  ${time(r.time_ms)}`)
      if (!yes) {
        console.log(`\n${rows.length} row(s) would be removed. Run again with --yes to remove them.`)
      } else {
        await db.query(`delete from laps where ${where}`, [target])
        console.log(`\n✔ Removed ${rows.length} row(s).`)
      }
    }
  } else {
    console.log('Usage: npm run board -- list [track]  |  npm run board -- remove <nickname or #id> [--yes]')
    process.exitCode = 1
  }
} finally {
  await db.end()
}
