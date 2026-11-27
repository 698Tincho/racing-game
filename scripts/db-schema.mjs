// Creates the leaderboard's tables if they're missing (db/schema.sql). Safe to run again.
//   npm run db:schema         → the database in .env.local (Postgres.app)
//   npm run db:schema:prod    → the database in .env.production (Neon)

import fs from 'node:fs/promises'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('✖ DATABASE_URL is missing. Put it in .env.local (local) or .env.production (Neon).')
  process.exit(1)
}

const db = new pg.Client({ connectionString: url })
await db.connect()
await db.query(await fs.readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
const { rows } = await db.query("select table_name from information_schema.tables where table_schema = 'public' order by 1")
console.log(`✔ ${new URL(url).hostname}: tables ${rows.map((r) => r.table_name).join(', ')}`)
await db.end()
