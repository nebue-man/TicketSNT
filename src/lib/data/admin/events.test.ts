import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent, items } from '../../../../supabase/tests/db'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const events = await import('./events')
const { DbFailure } = await import('../db')

const NEW_EVENT = {
  name: 'New Year Show', date_time: '2026-12-31T14:00:00Z', venue: 'Nelum Pokuna', description: 'Countdown',
  cover_image_url: null, max_per_reservation: 6, gate_pin: 'PIN999', status: 'draft' as const,
}
const NOBODY = '00000000-0000-0000-0000-000000000000'

async function reserve(eventId: string, ticketTypeId: string) {
  await t.db.query(
    `SELECT create_reservation('RES-AAAAAA', $1, 'Amal', 'a@example.com', '0771234567', '200012345678', $2::jsonb)`,
    [eventId, items([ticketTypeId, 1])],
  )
}

describe('admin events', () => {
  beforeEach(async () => { t.db = await createDb() })

  it('creates an event and reads it back', async () => {
    const created = await events.createEvent(NEW_EVENT)
    expect(created.ok).toBe(true)
    const id = (created as { id: string }).id
    expect(await events.getAdminEvent(id)).toMatchObject({ name: 'New Year Show', venue: 'Nelum Pokuna', status: 'draft' })
    expect((await events.getAllEvents()).map(e => e.id)).toContain(id)
  })

  it('reads an event that does not exist as null', async () => {
    expect(await events.getAdminEvent(NOBODY)).toBeNull()
  })

  it('updates only the fields given', async () => {
    const { eventId } = await seedEvent(t.db)
    expect(await events.updateEvent(eventId, { venue: 'Lotus Tower' })).toEqual({ ok: true })
    expect(await events.getAdminEvent(eventId)).toMatchObject({ name: 'Test Show', venue: 'Lotus Tower' })
  })

  it('refuses to update an event that does not exist', async () => {
    expect(await events.updateEvent(NOBODY, { venue: 'Lotus Tower' })).toEqual({ ok: false, reason: 'not_found' })
  })

  it('closes an event', async () => {
    const { eventId } = await seedEvent(t.db)
    expect(await events.closeEvent(eventId)).toEqual({ ok: true })
    expect(await events.getAdminEvent(eventId)).toMatchObject({ status: 'closed' })
  })

  it('deletes an event with no Reservations', async () => {
    const { eventId } = await seedEvent(t.db)
    expect(await events.deleteEvent(eventId)).toEqual({ ok: true })
    expect(await events.getAdminEvent(eventId)).toBeNull()
  })

  it('refuses to delete an event once it has a Reservation', async () => {
    const { eventId, generalId } = await seedEvent(t.db)
    await reserve(eventId, generalId)
    expect(await events.deleteEvent(eventId)).toEqual({ ok: false, reason: 'has_reservations' })
  })

  it('archives an event and restores it as closed', async () => {
    const { eventId } = await seedEvent(t.db)
    expect(await events.archiveEvent(eventId)).toEqual({ ok: true })
    expect(await events.restoreEvent(eventId)).toEqual({ ok: true })
    expect(await events.getAdminEvent(eventId)).toMatchObject({ status: 'closed' })
  })

  it('refuses to restore an event that is not archived', async () => {
    const { eventId } = await seedEvent(t.db)
    expect(await events.restoreEvent(eventId)).toEqual({ ok: false, reason: 'not_archived' })
  })

  it.each(['deleteEvent', 'archiveEvent', 'restoreEvent'] as const)('%s refuses an event that does not exist', async fn => {
    expect(await events[fn](NOBODY)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('throws a DbFailure for a page read the database could not answer, never an empty list', async () => {
    await t.db.exec('DROP FUNCTION admin_get_all_events()')
    await expect(events.getAllEvents()).rejects.toBeInstanceOf(DbFailure)
  })

  it('answers failed for a write the database could not run', async () => {
    await t.db.exec('DROP FUNCTION admin_close_event(uuid)')
    expect(await events.closeEvent(NOBODY)).toEqual({ ok: false, reason: 'failed' })
  })
})
