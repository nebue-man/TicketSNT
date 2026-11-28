import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent } from '../../../../supabase/tests/db'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const { POST } = await import('./route')

let ids: Awaited<ReturnType<typeof seedEvent>>
beforeEach(async () => {
  t.db = await createDb()
  ids = await seedEvent(t.db, { capacity: 2 })
})

async function reserve(quantity: number, eventId = ids.eventId) {
  const body = {
    buyer_name: 'Amal Perera', buyer_email: 'amal@example.com', buyer_phone: '0771234567', buyer_nic: '200012345678',
    items: [{ ticket_type_id: ids.generalId, quantity }], consent: true,
  }
  const res = await POST(new NextRequest(`https://tickets.test/api/reserve?eventId=${eventId}`, { method: 'POST', body: JSON.stringify(body) }))
  return { status: res.status, body: await res.json() }
}

describe('POST /api/reserve', () => {
  it('creates a Reservation', async () => {
    expect(await reserve(1)).toMatchObject({ status: 201, body: { reservationId: expect.stringMatching(/^RES-/) } })
  })

  it('answers 409 capacity_exceeded when the tickets are gone', async () => {
    expect(await reserve(3)).toEqual({ status: 409, body: { error: 'capacity_exceeded' } })
  })

  it('answers 404 for an event that does not exist', async () => {
    expect((await reserve(1, 'foo')).status).toBe(404)
  })

  it('answers 503 when the database cannot load the event', async () => {
    await t.db.exec('REVOKE EXECUTE ON FUNCTION admin_get_event(uuid) FROM PUBLIC, anon, authenticated, service_role')
    expect(await reserve(1)).toEqual({ status: 503, body: { error: 'Something went wrong. Please try again in a moment.' } })
  })

  it('answers 503 when the database cannot save the Reservation', async () => {
    await t.db.exec('DROP FUNCTION create_reservation CASCADE')
    expect(await reserve(1)).toEqual({ status: 503, body: { error: 'Something went wrong. Please try again in a moment.' } })
  })
})
