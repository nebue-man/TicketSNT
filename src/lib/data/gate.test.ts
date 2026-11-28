import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent, items } from '../../../supabase/tests/db'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const { decideScan } = await import('./gate')

let ids: Awaited<ReturnType<typeof seedEvent>>

beforeEach(async () => {
  t.db = await createDb()
  ids = await seedEvent(t.db, { gatePin: '1234' })
  await t.db.query(
    `SELECT create_reservation('RES-AAAAAA', $1, 'Amal', 'amal@example.com', '0771234567', '200012345678', $2::jsonb)`,
    [ids.eventId, items([ids.generalId, 2])],
  )
})

describe('decideScan', () => {
  it('admits a Reservation, with the Door count after the Scan, and no buyer email or phone', async () => {
    expect(await decideScan('res-aaaaaa', ids.eventId, '1234')).toEqual({
      outcome: 'admitted',
      reservation: { id: 'RES-AAAAAA', buyerName: 'Amal', items: [{ ticket_type_name: 'General', quantity: 2 }] },
      doorCount: { status: 'live', ticketsAdmitted: 2, ticketsSold: 2 },
    })
  })

  it('answers Already scanned on a Re-scan, with when it was admitted', async () => {
    await decideScan('RES-AAAAAA', ids.eventId, '1234')
    expect(await decideScan('RES-AAAAAA', ids.eventId, '1234')).toMatchObject({
      outcome: 'already_scanned', admittedAt: expect.any(String),
      doorCount: { status: 'live', ticketsAdmitted: 2, ticketsSold: 2 },
    })
  })

  it('answers Not admitted for an unknown Reservation', async () => {
    expect(await decideScan('RES-ZZZZZZ', ids.eventId, '1234')).toMatchObject({
      outcome: 'not_admitted', reason: 'not_found', doorCount: { status: 'live' },
    })
  })

  it('withholds the Door count for a wrong gate PIN', async () => {
    expect(await decideScan('RES-AAAAAA', ids.eventId, '9999')).toEqual({
      outcome: 'not_admitted', reservationId: 'RES-AAAAAA', reason: 'invalid_pin', doorCount: { status: 'withheld' },
    })
  })

  it('answers null (Not checked) when the database cannot answer', async () => {
    await t.db.exec('DROP FUNCTION scan_reservation CASCADE')
    expect(await decideScan('RES-AAAAAA', ids.eventId, '1234')).toBeNull()
  })
})
