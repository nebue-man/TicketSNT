// Test harness: a throwaway in-memory Postgres (PGlite) with Supabase's roles and
// default grants, so migrations and RPCs can be tested exactly as they'd run in
// the Supabase SQL editor.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

export const migrationFiles = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()

// What a fresh Supabase project grants out of the box: the API roles can use the
// public schema, and new tables/functions are granted to them by default.
const SUPABASE_ROLES = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`

export type Role = 'anon' | 'authenticated' | 'service_role'

export async function createDb(opts: { upTo?: string } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto } })
  await db.exec(SUPABASE_ROLES)
  for (const file of migrationFiles) {
    await applyMigration(db, file)
    if (opts.upTo && file.startsWith(opts.upTo)) break
  }
  return db
}

export async function applyMigration(db: PGlite, file: string) {
  try {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  } catch (err) {
    throw new Error(`Migration ${file} failed: ${(err as Error).message}`)
  }
}

/** Runs one query as an API role (like a request with that key), then switches back. */
export async function asRole<T = Record<string, unknown>>(db: PGlite, role: Role, sql: string, params: unknown[] = []) {
  await db.exec(`SET ROLE ${role}`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('RESET ROLE')
  }
}

/** Seeds one event with two ticket types. Returns their ids. */
export async function seedEvent(db: PGlite, opts: { gatePin?: string; capacity?: number } = {}) {
  const { rows: [event] } = await db.query<{ id: string }>(
    `INSERT INTO events (name, date_time, venue, description, gate_pin, status)
     VALUES ('Test Show', now() + interval '1 day', 'Test Hall', 'Test', $1, 'published') RETURNING id`,
    [opts.gatePin ?? 'PIN123'],
  )
  const { rows: [general] } = await db.query<{ id: string }>(
    `INSERT INTO ticket_types (event_id, name, price, capacity, sort_order) VALUES ($1, 'General', 5000, $2, 1) RETURNING id`,
    [event.id, opts.capacity ?? 100],
  )
  const { rows: [vip] } = await db.query<{ id: string }>(
    `INSERT INTO ticket_types (event_id, name, price, capacity, sort_order) VALUES ($1, 'VIP', 15000, $2, 2) RETURNING id`,
    [event.id, opts.capacity ?? 100],
  )
  return { eventId: event.id, generalId: general.id, vipId: vip.id }
}

export function items(...pairs: [string, number][]) {
  return JSON.stringify(pairs.map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity })))
}
