import { describe, it, expect, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, applyMigration, asRole, seedEvent, items } from './db'

type Scan = { reservation_id: string; scanned_at: string }

describe('0010 offline gate mode', () => {
  let db: PGlite
  let ids: Awaited<ReturnType<typeof seedEvent>>

  beforeEach(async () => {
    db = await createDb()
    ids = await seedEvent(db)
  })

  async function reserve(id: string, qty: [string, number][]) {
    await asRole(db, 'service_role',
      `SELECT create_reservation($1, $2, 'Buyer ' || $1, 'b@x.lk', '077', 'NIC', $3::jsonb)`,
      [id, ids.eventId, items(...qty)])
  }
  async function scan(id: string) {
    await asRole(db, 'service_role', `SELECT scan_reservation($1, $2, 'PIN123')`, [id, ids.eventId])
  }
  async function gateList(pin = 'PIN123') {
    const [row] = await asRole<{ r: Record<string, unknown> }>(db, 'service_role',
      'SELECT gate_get_list($1, $2) AS r', [ids.eventId, pin])
    return row.r
  }
  async function upload(scans: Scan[], phone = 'Gate A', pin = 'PIN123') {
    const [row] = await asRole<{ r: { code: string; results?: { reservation_id: string; result: string }[] } }>(
      db, 'service_role', 'SELECT gate_upload_offline_scans($1, $2, $3, $4::jsonb) AS r',
      [ids.eventId, pin, phone, JSON.stringify(scans)])
    return row.r
  }
  async function issues() {
    return asRole<{ reservation_id: string; issue: string; gate_phone: string; original_source: string | null }>(
      db, 'service_role',
      'SELECT reservation_id, issue, gate_phone, original_source FROM admin_get_offline_scan_issues($1)', [ids.eventId])
  }

  it('can be run a second time without error', async () => {
    await applyMigration(db, '0010_gate_offline_mode.sql')
  })

  it('anon cannot call the new functions or read the issues table', async () => {
    for (const sql of [
      `SELECT gate_get_list(gen_random_uuid(), 'x')`,
      `SELECT gate_upload_offline_scans(gen_random_uuid(), 'x', 'p', '[]'::jsonb)`,
      `SELECT * FROM admin_get_offline_scan_issues(gen_random_uuid())`,
      `SELECT * FROM offline_scan_issues`,
    ]) {
      await expect(asRole(db, 'anon', sql)).rejects.toThrow(/permission denied/)
    }
  })

  describe('Gate list', () => {
    it('refuses a wrong gate PIN', async () => {
      expect(await gateList('WRONG')).toEqual({ code: 'invalid_pin' })
    })

    it('has names, tickets, void status and Admissions — but no email, phone or NIC', async () => {
      await reserve('RES-AAAAAA', [[ids.generalId, 2], [ids.vipId, 1]])
      await reserve('RES-BBBBBB', [[ids.generalId, 1]])
      await reserve('RES-CCCCCC', [[ids.vipId, 1]])
      await scan('RES-BBBBBB')
      await asRole(db, 'service_role', `SELECT admin_void_reservation('RES-CCCCCC')`)

      const list = await gateList()
      expect(list.code).toBe('ok')
      const res = list.reservations as Record<string, unknown>[]
      expect(res.map(r => [r.id, r.void, r.admitted_at !== null])).toEqual([
        ['RES-AAAAAA', false, false],
        ['RES-BBBBBB', false, true],
        ['RES-CCCCCC', true, false],
      ])
      expect(res[0]).toMatchObject({
        buyer_name: 'Buyer RES-AAAAAA',
        items: [{ ticket_type_name: 'General', quantity: 2 }, { ticket_type_name: 'VIP', quantity: 1 }],
      })
      expect(Object.keys(res[0]).sort()).toEqual(['admitted_at', 'buyer_name', 'id', 'items', 'void'])
    })
  })

  describe('uploading Offline scans', () => {
    beforeEach(async () => {
      await reserve('RES-AAAAAA', [[ids.generalId, 2]])
      await reserve('RES-BBBBBB', [[ids.generalId, 1]])
    })

    it('turns each Offline scan into an Admission at the time on the phone', async () => {
      const r = await upload([{ reservation_id: 'RES-AAAAAA', scanned_at: '2026-12-01T19:30:00Z' }])
      expect(r.results).toEqual([{ reservation_id: 'RES-AAAAAA', result: 'recorded' }])
      const { rows } = await db.query(`SELECT source, offline, gate_phone, scanned_at = '2026-12-01T19:30:00Z' AS same_time
        FROM scan_logs WHERE reservation_id = 'RES-AAAAAA'`)
      expect(rows).toEqual([{ source: 'gate', offline: true, gate_phone: 'Gate A', same_time: true }])
    })

    it('Offline Admissions count in the Door count once uploaded', async () => {
      await upload([{ reservation_id: 'RES-AAAAAA', scanned_at: '2026-12-01T19:30:00Z' }])
      const [row] = await asRole<{ c: Record<string, number> }>(db, 'service_role', 'SELECT admin_get_door_count($1) AS c', [ids.eventId])
      expect(row.c.tickets_admitted).toBe(2)
    })

    it('re-uploading the same scans changes nothing (lost response)', async () => {
      const scans = [{ reservation_id: 'RES-AAAAAA', scanned_at: '2026-12-01T19:30:00Z' }]
      await upload(scans)
      expect((await upload(scans)).results).toEqual([{ reservation_id: 'RES-AAAAAA', result: 'already_uploaded' }])
      expect(await issues()).toEqual([])
    })

    it('records a Double entry when another gate already admitted the Reservation', async () => {
      await scan('RES-AAAAAA') // online gate, before the upload
      const r = await upload([{ reservation_id: 'RES-AAAAAA', scanned_at: '2026-12-01T19:30:00Z' }], 'Gate B')
      expect(r.results).toEqual([{ reservation_id: 'RES-AAAAAA', result: 'double_entry' }])
      expect(await issues()).toEqual([
        { reservation_id: 'RES-AAAAAA', issue: 'double_entry', gate_phone: 'Gate B', original_source: 'gate' },
      ])
    })

    it('records a Double entry between two offline phones, once even if re-uploaded', async () => {
      await upload([{ reservation_id: 'RES-AAAAAA', scanned_at: '2026-12-01T19:30:00Z' }], 'Gate A')
      const scansB = [{ reservation_id: 'RES-AAAAAA', scanned_at: '2026-12-01T19:31:00Z' }]
      expect((await upload(scansB, 'Gate B')).results?.[0].result).toBe('double_entry')
      expect((await upload(scansB, 'Gate B')).results?.[0].result).toBe('double_entry')
      expect(await issues()).toHaveLength(1)
    })

    it('reports a Reservation voided after the Gate list was downloaded, without admitting it', async () => {
      await asRole(db, 'service_role', `SELECT admin_void_reservation('RES-BBBBBB')`)
      const r = await upload([{ reservation_id: 'RES-BBBBBB', scanned_at: '2026-12-01T19:30:00Z' }])
      expect(r.results?.[0].result).toBe('voided')
      expect((await db.query(`SELECT 1 FROM scan_logs WHERE reservation_id = 'RES-BBBBBB'`)).rows).toEqual([])
      expect((await issues())[0].issue).toBe('voided')
    })

    it('rejects unknown Reservations and bad times, and keeps going', async () => {
      const r = await upload([
        { reservation_id: 'RES-NOPE00', scanned_at: '2026-12-01T19:30:00Z' },
        { reservation_id: 'RES-BBBBBB', scanned_at: 'not a time' },
        { reservation_id: 'res-bbbbbb', scanned_at: '2026-12-01T19:32:00Z' },
      ])
      expect(r.results?.map(x => x.result)).toEqual(['rejected', 'rejected', 'recorded'])
    })

    it('refuses a wrong gate PIN or a missing phone name', async () => {
      expect((await upload([], 'Gate A', 'WRONG')).code).toBe('invalid_pin')
      expect((await upload([], '  ')).code).toBe('invalid_input')
    })
  })
})
