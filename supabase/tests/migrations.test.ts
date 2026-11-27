import { describe, it, expect, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, applyMigration, asRole, seedEvent, items, migrationFiles } from './db'

const PERMISSION_DENIED = /permission denied/

describe('migrations', () => {
  it('apply cleanly from 0001 to the latest', async () => {
    const db = await createDb()
    expect(migrationFiles.at(-1)).toMatch(/^0011_/)
    await db.close()
  })

  it('0008 and 0009 can be run a second time without error', async () => {
    const db = await createDb()
    await applyMigration(db, '0008_lock_down_public_access.sql')
    await applyMigration(db, '0009_door_sales_and_door_count.sql')
    await db.close()
  })
})

describe('0008 lock-down', () => {
  it('closes the hole: before 0008 the public anon key can read gate PINs and buyer details', async () => {
    const before = await createDb({ upTo: '0007' })
    await seedEvent(before)
    await before.query(`INSERT INTO reservations (id, event_id, buyer_name, buyer_email, buyer_phone, nic)
      SELECT 'RES-AAAAAA', id, 'A', 'a@x.lk', '077', 'NIC1' FROM events`)
    expect(await asRole(before, 'anon', 'SELECT gate_pin FROM admin_get_all_events()')).toHaveLength(1)
    expect(await asRole(before, 'anon', 'SELECT nic FROM reservations')).toHaveLength(1)
    await before.close()
  })

  describe('after 0008', () => {
    let db: PGlite
    beforeEach(async () => {
      db = await createDb()
      await seedEvent(db)
    })

    it.each([
      ['admin_get_all_events()', 'SELECT * FROM admin_get_all_events()'],
      ['admin_get_door_count', `SELECT admin_get_door_count(gen_random_uuid())`],
      ['scan_reservation', `SELECT scan_reservation('RES-X', gen_random_uuid(), 'PIN')`],
      ['create_reservation', `SELECT create_reservation('RES-X', gen_random_uuid(), 'a', 'b', 'c', 'd', '[]'::jsonb)`],
      ['create_door_sale', `SELECT create_door_sale('RES-X', gen_random_uuid(), 'a', 'b', 'c', 'd', '[]'::jsonb)`],
      ['admin_void_reservation', `SELECT admin_void_reservation('RES-X')`],
    ])('anon and authenticated cannot call %s', async (_name, sql) => {
      await expect(asRole(db, 'anon', sql)).rejects.toThrow(PERMISSION_DENIED)
      await expect(asRole(db, 'authenticated', sql)).rejects.toThrow(PERMISSION_DENIED)
    })

    it.each(['events', 'ticket_types', 'reservations', 'reservation_items', 'scan_logs', 'settings'])(
      'anon cannot read the %s table',
      async table => {
        await expect(asRole(db, 'anon', `SELECT * FROM ${table}`)).rejects.toThrow(PERMISSION_DENIED)
      },
    )

    it('anon cannot write scan records directly', async () => {
      await expect(asRole(db, 'anon', `INSERT INTO scan_logs (reservation_id) VALUES ('RES-X')`)).rejects.toThrow(PERMISSION_DENIED)
    })

    it('service_role (the server) can still do everything the app needs', async () => {
      const events = await asRole<{ gate_pin: string }>(db, 'service_role', 'SELECT * FROM admin_get_all_events()')
      expect(events).toHaveLength(1)
      expect(await asRole(db, 'service_role', 'SELECT * FROM reservations')).toEqual([])
    })

    it('functions created after 0008 are not callable by anon by default', async () => {
      await db.exec(`CREATE FUNCTION later_fn() RETURNS int LANGUAGE sql AS 'SELECT 1'`)
      await expect(asRole(db, 'anon', 'SELECT later_fn()')).rejects.toThrow(PERMISSION_DENIED)
    })
  })
})

describe('0009 door sales and door count', () => {
  let db: PGlite
  let ids: Awaited<ReturnType<typeof seedEvent>>

  beforeEach(async () => {
    db = await createDb()
    ids = await seedEvent(db, { capacity: 10 })
  })

  async function doorSale(id: string, qty: [string, number][], admittedAt: string | null = null) {
    return asRole(db, 'service_role',
      `SELECT create_door_sale($1, $2, 'Buyer', 'b@x.lk', '077', 'NIC', $3::jsonb, $4::timestamptz) AS id`,
      [id, ids.eventId, items(...qty), admittedAt])
  }
  async function reserve(id: string, qty: [string, number][]) {
    return asRole(db, 'service_role',
      `SELECT create_reservation($1, $2, 'Buyer', 'b@x.lk', '077', 'NIC', $3::jsonb)`,
      [id, ids.eventId, items(...qty)])
  }
  async function scan(id: string) {
    const [row] = await asRole<{ r: { code: string } }>(db, 'service_role',
      `SELECT scan_reservation($1, $2, 'PIN123') AS r`, [id, ids.eventId])
    return row.r.code
  }
  async function doorCount() {
    const [row] = await asRole<{ c: Record<string, number> }>(db, 'service_role',
      'SELECT admin_get_door_count($1) AS c', [ids.eventId])
    return row.c
  }

  it('a Door sale is admitted at the box office in the same step', async () => {
    await doorSale('RES-DOOR01', [[ids.generalId, 2]])
    const logs = (await db.query<{ source: string }>(`SELECT source FROM scan_logs WHERE reservation_id = 'RES-DOOR01'`)).rows
    expect(logs).toEqual([{ source: 'box_office' }])
  })

  it('a Door sale scanned at the gate shows Already scanned', async () => {
    await doorSale('RES-DOOR01', [[ids.generalId, 2]])
    expect(await scan('RES-DOOR01')).toBe('already_scanned')
  })

  it('a paper Door sale keeps the time written on the paper', async () => {
    await doorSale('RES-PAPER1', [[ids.generalId, 1]], '2026-12-01T19:42:00+05:30')
    const { rows: [log] } = await db.query<{ at: string }>(
      `SELECT to_char(scanned_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS at FROM scan_logs WHERE reservation_id = 'RES-PAPER1'`)
    expect(log.at).toBe('2026-12-01 19:42')
  })

  it('a sold-out Door sale leaves nothing behind (no reservation, no admission, no tickets taken)', async () => {
    await reserve('RES-FILL01', [[ids.generalId, 9]])
    await expect(doorSale('RES-DOOR02', [[ids.generalId, 2]])).rejects.toThrow(/capacity_exceeded/)
    const { rows: [counts] } = await db.query<{ r: number; s: number; sold: number }>(`
      SELECT (SELECT count(*)::int FROM reservations WHERE id = 'RES-DOOR02') AS r,
             (SELECT count(*)::int FROM scan_logs WHERE reservation_id = 'RES-DOOR02') AS s,
             (SELECT sold FROM ticket_types WHERE id = '${ids.generalId}') AS sold`)
    expect(counts).toEqual({ r: 0, s: 0, sold: 9 })
  })

  it('gate scans are recorded with source gate', async () => {
    await reserve('RES-GATE01', [[ids.generalId, 1]])
    expect(await scan('RES-GATE01')).toBe('admitted')
    const { rows } = await db.query<{ source: string }>(`SELECT source FROM scan_logs WHERE reservation_id = 'RES-GATE01'`)
    expect(rows).toEqual([{ source: 'gate' }])
  })

  it('Door count adds up tickets by where they were admitted', async () => {
    await reserve('RES-GATE01', [[ids.generalId, 1], [ids.vipId, 1]]) // 2 tickets, gate
    await scan('RES-GATE01')
    await doorSale('RES-DOOR01', [[ids.generalId, 3]])                 // 3 tickets, box office
    await reserve('RES-WAIT01', [[ids.vipId, 1]])                      // 1 ticket, not yet in
    await reserve('RES-VOID01', [[ids.generalId, 4]])                  // voided, not counted as sold
    await asRole(db, 'service_role', `SELECT admin_void_reservation('RES-VOID01')`)

    expect(await doorCount()).toEqual({
      tickets_sold: 6,
      tickets_admitted: 5,
      tickets_admitted_gate: 2,
      tickets_admitted_box_office: 3,
      reservations_admitted: 2,
    })
  })

  it('Door count is all zeros for an event with no reservations', async () => {
    expect(await doorCount()).toEqual({
      tickets_sold: 0, tickets_admitted: 0, tickets_admitted_gate: 0,
      tickets_admitted_box_office: 0, reservations_admitted: 0,
    })
  })
})
