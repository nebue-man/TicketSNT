import { describe, it, expect, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, asRole, seedEvent, items } from './db'

const PERMISSION_DENIED = /permission denied/

describe('0011 delete and archive events', () => {
  let db: PGlite
  let ids: Awaited<ReturnType<typeof seedEvent>>

  beforeEach(async () => {
    db = await createDb()
    ids = await seedEvent(db)
  })

  async function call(fn: string, id = ids.eventId) {
    const [row] = await asRole<{ r: string }>(db, 'service_role', `SELECT ${fn}($1) AS r`, [id])
    return row.r
  }
  async function status(id = ids.eventId) {
    const { rows } = await db.query<{ status: string }>('SELECT status FROM events WHERE id = $1', [id])
    return rows[0]?.status
  }
  async function reserve() {
    await asRole(db, 'service_role',
      `SELECT create_reservation('RES-AAAAAA', $1, 'Buyer', 'b@x.lk', '077', 'NIC', $2::jsonb)`,
      [ids.eventId, items([ids.generalId, 1])])
  }

  describe('admin_delete_event', () => {
    it('deletes an event with no reservations, along with its ticket tiers', async () => {
      expect(await call('admin_delete_event')).toBe('ok')
      expect(await status()).toBeUndefined()
      const { rows } = await db.query('SELECT 1 FROM ticket_types WHERE event_id = $1', [ids.eventId])
      expect(rows).toHaveLength(0)
    })

    it('refuses an event that has any reservation, even a voided one', async () => {
      await reserve()
      await db.query(`UPDATE reservations SET status = 'void'`)
      expect(await call('admin_delete_event')).toBe('has_reservations')
      expect(await status()).toBe('published')
    })

    it('refuses an event that has door sales', async () => {
      await asRole(db, 'service_role',
        `SELECT create_door_sale('RES-DOOR01', $1, 'Buyer', 'b@x.lk', '077', 'NIC', $2::jsonb, now())`,
        [ids.eventId, items([ids.generalId, 1])])
      expect(await call('admin_delete_event')).toBe('has_reservations')
    })

    it('reports an unknown event', async () => {
      expect(await call('admin_delete_event', '00000000-0000-0000-0000-000000000000')).toBe('not_found')
    })
  })

  describe('admin_archive_event / admin_restore_event', () => {
    it('archives an event and keeps its reservations', async () => {
      await reserve()
      expect(await call('admin_archive_event')).toBe('ok')
      expect(await status()).toBe('archived')
      const { rows } = await db.query('SELECT 1 FROM reservations WHERE event_id = $1', [ids.eventId])
      expect(rows).toHaveLength(1)
    })

    it('restores an archived event as closed, so sales do not reopen', async () => {
      await call('admin_archive_event')
      expect(await call('admin_restore_event')).toBe('ok')
      expect(await status()).toBe('closed')
    })

    it('restore leaves an event that is not archived alone', async () => {
      expect(await call('admin_restore_event')).toBe('not_archived')
      expect(await status()).toBe('published')
    })

    it('reports an unknown event', async () => {
      const missing = '00000000-0000-0000-0000-000000000000'
      expect(await call('admin_archive_event', missing)).toBe('not_found')
      expect(await call('admin_restore_event', missing)).toBe('not_found')
    })
  })

  it.each(['admin_delete_event', 'admin_archive_event', 'admin_restore_event'])(
    'anon and authenticated cannot call %s',
    async fn => {
      const sql = `SELECT ${fn}(gen_random_uuid())`
      await expect(asRole(db, 'anon', sql)).rejects.toThrow(PERMISSION_DENIED)
      await expect(asRole(db, 'authenticated', sql)).rejects.toThrow(PERMISSION_DENIED)
    },
  )
})
