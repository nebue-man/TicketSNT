import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent } from '../../../supabase/tests/db'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const { createReservation } = await import('./reservations')

let ids: Awaited<ReturnType<typeof seedEvent>>
const buyer = { buyer_name: 'Amal', buyer_email: 'a@example.com', buyer_phone: '0771234567', buyer_nic: '200012345678', consent: true as const }

beforeEach(async () => {
  t.db = await createDb()
  ids = await seedEvent(t.db, { capacity: 2 })
})

describe('createReservation', () => {
  it('creates a Reservation and answers its id', async () => {
    const r = await createReservation(ids.eventId, { ...buyer, items: [{ ticket_type_id: ids.generalId, quantity: 2 }] })
    expect(r).toMatchObject({ ok: true, reservationId: expect.stringMatching(/^RES-/) })
    const { rows } = await t.db.query('SELECT r.status, count(s.*)::int AS scans FROM reservations r LEFT JOIN scan_logs s ON s.reservation_id = r.id GROUP BY r.status')
    expect(rows).toEqual([{ status: 'active', scans: 0 }])
  })

  it('creates a Door sale already admitted', async () => {
    const r = await createReservation(ids.eventId, { ...buyer, items: [{ ticket_type_id: ids.vipId, quantity: 1 }] }, { admittedAt: null })
    expect(r.ok).toBe(true)
    const { rows } = await t.db.query('SELECT source, confirmed FROM scan_logs')
    expect(rows).toEqual([{ source: 'box_office', confirmed: true }])
  })

  it('refuses more tickets than are left', async () => {
    const r = await createReservation(ids.eventId, { ...buyer, items: [{ ticket_type_id: ids.generalId, quantity: 3 }] })
    expect(r).toEqual({ ok: false, error: 'capacity_exceeded' })
  })

  it('refuses a ticket type that is not on sale for the event', async () => {
    const r = await createReservation(ids.eventId, { ...buyer, items: [{ ticket_type_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }] })
    expect(r).toEqual({ ok: false, error: 'ticket_type_not_found' })
  })

  it('answers failed when the database cannot answer', async () => {
    await t.db.exec('DROP FUNCTION create_reservation CASCADE')
    const r = await createReservation(ids.eventId, { ...buyer, items: [{ ticket_type_id: ids.generalId, quantity: 1 }] })
    expect(r).toEqual({ ok: false, error: 'failed' })
  })
})
