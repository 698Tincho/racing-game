// Postgres, as in the finanzas dashboard: one small pool, values always passed apart ($1, $2…),
// never pasted into the SQL. DATABASE_URL comes from Vercel (Neon) or .env.local (Postgres.app).

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

// Kept on globalThis: in development the server reloads this module on every change, and a
// serverless function reuses it between requests while it stays warm.
const holder = globalThis as unknown as { racingPool?: pg.Pool; racingSchema?: Promise<void> }

export const hasDatabase = () => Boolean(process.env.DATABASE_URL)

function pool() {
  if (!holder.racingPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing')
    holder.racingPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
    // An idle connection the database drops (a restart, Neon scaling to zero) is reported here.
    // Without a listener Node treats it as a crash; with one, the next query just reconnects.
    holder.racingPool.on('error', (error) => console.error('[db] idle connection lost:', error.message))
  }
  return holder.racingPool
}

/**
 * The tables, made if they're missing (db/schema.sql: it only creates what isn't there), once
 * per server, before the first query. So a new database needs no setup step, and a change to the
 * schema reaches Neon with the next deploy. A lock keeps two servers starting at once from
 * running it together. (vercel.json ships db/schema.sql with the functions.)
 */
function schemaReady() {
  holder.racingSchema ??= (async () => {
    const sql = await readFile(join(process.cwd(), 'db', 'schema.sql'), 'utf8')
    const client = await pool().connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock(7240311)')
      await client.query(sql)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  })().catch((error) => {
    holder.racingSchema = undefined // try again on the next request
    throw error
  })
  return holder.racingSchema
}

export async function query<Row>(sql: string, values: unknown[] = []): Promise<Row[]> {
  await schemaReady()
  const { rows } = await pool().query(sql, values)
  return rows as Row[]
}
