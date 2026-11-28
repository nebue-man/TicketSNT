import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent, items } from '../../../../supabase/tests/db'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const tiers = await import('./tiers')
const reservations = await import('./reservations')
const { getDoorCount } = await import('./door-count')
const { DbFailure } = await import('../db')

let ids: Awaited<ReturnType<typeof seedEvent>>

async function reserve(id: string, ...pairs: [string, number][]) {
  await t.db.query(
    `SELECT create_reservation($1, $2, 'Amal', 'a@example.com', '0771234567', '200012345678', $3::jsonb)`,
    [id, ids.eventId, items(...pairs)],
  )
}

beforeEach(async () => {
  t.db = await createDb()
  ids = await seedEvent(t.db, { capacity: 10 })
})

describe('admin tiers', () => {
  it('lists an event’s tiers in order', async () => {
    expect((await tiers.getTiersForEvent(ids.eventId)).map(x => x.name)).toEqual(['General', 'VIP'])
  })

  it('adds a tier', async () => {
    expect(await tiers.createTier(ids.eventId, { name: 'Balcony', price: 2500, capacity: 50, sort_order: 3 })).toEqual({ ok: true })
    expect((await tiers.getTiersForEvent(ids.eventId)).map(x => x.name)).toEqual(['General', 'VIP', 'Balcony'])
  })

  it('updates only the fields given', async () => {
    expect(await tiers.updateTier(ids.generalId, { capacity: 20 })).toEqual({ ok: true })
    expect((await tiers.getTiersForEvent(ids.eventId))[0]).toMatchObject({ name: 'General', capacity: 20 })
  })

  it('refuses a capacity below the tickets already sold, saying how many', async () => {
    await reserve('RES-AAAAAA', [ids.generalId, 4])
    expect(await tiers.updateTier(ids.generalId, { capacity: 3 })).toEqual({ ok: false, reason: 'capacity_too_low', sold: 4 })
  })

  it('refuses to update a tier that does not exist', async () => {
    expect(await tiers.updateTier('00000000-0000-0000-0000-000000000000', { capacity: 3 })).toEqual({ ok: false, reason: 'not_found' })
  })

  it('removes a tier with no bookings, and refuses one with bookings', async () => {
    await reserve('RES-AAAAAA', [ids.generalId, 1])
    expect(await tiers.deleteTier(ids.vipId)).toEqual({ ok: true })
    expect(await tiers.deleteTier(ids.generalId)).toEqual({ ok: false, reason: 'has_bookings' })
  })

  it('throws a DbFailure instead of showing “No tiers yet” when the database cannot answer', async () => {
    await t.db.exec('DROP FUNCTION admin_get_tiers(uuid)')
    await expect(tiers.getTiersForEvent(ids.eventId)).rejects.toBeInstanceOf(DbFailure)
  })
})

describe('admin reservations', () => {
  it('reports tickets sold and remaining per tier', async () => {
    await reserve('RES-AAAAAA', [ids.generalId, 3], [ids.vipId, 1])
    expect(await reservations.getEventStats(ids.eventId)).toMatchObject([
      { name: 'General', capacity: 10, sold: 3, remaining: 7 },
      { name: 'VIP', capacity: 10, sold: 1, remaining: 9 },
    ])
  })

  it('voids a Reservation', async () => {
    await reserve('RES-AAAAAA', [ids.generalId, 1])
    expect(await reservations.voidReservation('RES-AAAAAA')).toEqual({ ok: true })
    const { rows: [r] } = await t.db.query<{ status: string }>(`SELECT status FROM reservations WHERE id = 'RES-AAAAAA'`)
    expect(r.status).toBe('void')
  })

  it('throws a DbFailure for event stats the database could not answer', async () => {
    await t.db.exec('DROP FUNCTION admin_get_tiers(uuid)')
    await expect(reservations.getEventStats(ids.eventId)).rejects.toBeInstanceOf(DbFailure)
  })
})

describe('Door count', () => {
  it('counts every ticket in each admitted Reservation, out of tickets sold', async () => {
    await reserve('RES-AAAAAA', [ids.generalId, 2])
    await reserve('RES-BBBBBB', [ids.vipId, 1])
    await t.db.query(`SELECT scan_reservation('RES-AAAAAA', $1, 'PIN123')`, [ids.eventId])
    expect(await getDoorCount(ids.eventId)).toMatchObject({ ticketsSold: 3, ticketsAdmitted: 2, ticketsAdmittedGate: 2, reservationsAdmitted: 1 })
  })

  it('is null, shown as unavailable, when the database cannot answer', async () => {
    await t.db.exec('DROP FUNCTION admin_get_door_count(uuid)')
    expect(await getDoorCount(ids.eventId)).toBeNull()
  })
})
