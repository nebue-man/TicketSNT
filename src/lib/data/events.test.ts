import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent } from '../../../supabase/tests/db'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const events = await import('./events')
const { DbFailure } = await import('./db')

let ids: Awaited<ReturnType<typeof seedEvent>>

beforeEach(async () => {
  t.db = await createDb()
  ids = await seedEvent(t.db)
})

async function breakDb() {
  await t.db.exec('REVOKE EXECUTE ON FUNCTION admin_get_event(uuid), admin_get_tiers(uuid), admin_get_all_events() FROM PUBLIC, anon, authenticated, service_role')
}

describe('buyer-facing event reads', () => {
  it('finds an event with its ticket types in order', async () => {
    const data = await events.getEventWithTicketTypes(ids.eventId)
    expect(data?.event).toMatchObject({ id: ids.eventId, name: 'Test Show' })
    expect(data?.ticketTypes).toMatchObject([{ name: 'General', price: 5000 }, { name: 'VIP', price: 15000 }])
  })

  it('finds one event by id', async () => {
    expect(await events.getEvent(ids.eventId)).toMatchObject({ id: ids.eventId, gate_pin: 'PIN123' })
  })

  it('answers null for an event that does not exist or an ID that is not a UUID', async () => {
    expect(await events.getEvent('00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(await events.getEvent('foo')).toBeNull()
    expect(await events.getEventWithTicketTypes('foo')).toBeNull()
  })

  it('lists only draft and published events as upcoming', async () => {
    await t.db.exec(`UPDATE events SET status = 'closed'`)
    const { eventId } = await seedEvent(t.db)
    expect((await events.getUpcomingEvents()).map(e => e.id)).toEqual([eventId])
  })

  it('throws DbFailure when the database cannot answer, instead of showing nothing', async () => {
    await breakDb()
    await expect(events.getEvent(ids.eventId)).rejects.toBeInstanceOf(DbFailure)
    await expect(events.getEventWithTicketTypes(ids.eventId)).rejects.toBeInstanceOf(DbFailure)
    await expect(events.getUpcomingEvents()).rejects.toBeInstanceOf(DbFailure)
  })
})
