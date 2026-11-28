import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent, items } from '../../../supabase/tests/db'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const { callDb } = await import('./db')

describe('callDb', () => {
  let ids: Awaited<ReturnType<typeof seedEvent>>
  beforeAll(async () => {
    t.db = await createDb()
    ids = await seedEvent(t.db, { capacity: 2 })
  })

  it("answers ok with a set-returning function's rows", async () => {
    const r = await callDb<{ name: string }[]>('admin_get_tiers', { p_event_id: ids.eventId })
    expect(r).toMatchObject({ kind: 'ok', data: [{ name: 'General' }, { name: 'VIP' }] })
  })

  it("answers ok with a scalar function's value", async () => {
    const r = await callDb<string>('admin_delete_event', { p_id: '00000000-0000-0000-0000-000000000000' })
    expect(r).toEqual({ kind: 'ok', data: 'not_found' })
  })

  it('answers refused for a raised error whose code the caller listed, with its detail', async () => {
    const r = await callDb('create_reservation', {
      p_id: 'RES-AAAAAA', p_event_id: ids.eventId, p_buyer_name: 'Amal', p_buyer_email: 'a@example.com',
      p_buyer_phone: '0771234567', p_buyer_nic: '200012345678', p_items: JSON.parse(items([ids.generalId, 3])),
    }, ['capacity_exceeded', 'ticket_type_not_found'])
    expect(r).toEqual({ kind: 'refused', code: 'capacity_exceeded', detail: ids.generalId })
  })

  it('answers failed for a raised error the caller did not list', async () => {
    const r = await callDb('create_reservation', {
      p_id: 'RES-BBBBBB', p_event_id: ids.eventId, p_buyer_name: 'Bina', p_buyer_email: 'b@example.com',
      p_buyer_phone: '0771234567', p_buyer_nic: '200012345678', p_items: JSON.parse(items([ids.generalId, 3])),
    })
    expect(r).toEqual({ kind: 'failed' })
  })

  it('answers failed when the database cannot run the function', async () => {
    expect(await callDb('no_such_function', {})).toEqual({ kind: 'failed' })
  })

  it('runs as the server role, so a function it may not call fails', async () => {
    await t.db.exec('REVOKE EXECUTE ON FUNCTION admin_get_tiers(uuid) FROM PUBLIC, anon, authenticated, service_role')
    try {
      expect(await callDb('admin_get_tiers', { p_event_id: ids.eventId })).toEqual({ kind: 'failed' })
    } finally {
      await t.db.exec('GRANT EXECUTE ON FUNCTION admin_get_tiers(uuid) TO service_role')
    }
  })
})
