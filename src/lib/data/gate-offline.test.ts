import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, seedEvent, items } from '../../../supabase/tests/db'
import { toGateList } from '@/lib/gate-offline/gate-list'

const t = vi.hoisted(() => ({ db: undefined as unknown as PGlite }))
vi.mock('@/lib/data/db-adapter', async () => {
  const { pgliteAdapter } = await import('../../../supabase/tests/db-adapter')
  return { dbAdapter: pgliteAdapter(() => t.db) }
})

const { getGateList, uploadOfflineScans, getOfflineScanIssues } = await import('./gate-offline')
const { decideScan } = await import('./gate')

let ids: Awaited<ReturnType<typeof seedEvent>>
const NOBODY = '00000000-0000-0000-0000-000000000000'

beforeEach(async () => {
  t.db = await createDb()
  ids = await seedEvent(t.db, { gatePin: '1234' })
  await t.db.query(
    `SELECT create_reservation('RES-AAAAAA', $1, 'Amal', 'amal@example.com', '0771234567', '200012345678', $2::jsonb)`,
    [ids.eventId, items([ids.generalId, 2])],
  )
})

describe('getGateList', () => {
  it('answers the Gate list, without buyer email, phone or NIC', async () => {
    const r = await getGateList(ids.eventId, '1234')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(toGateList(r.payload)?.reservations['RES-AAAAAA']).toMatchObject({ buyerName: 'Amal' })
    expect(JSON.stringify(r.payload)).not.toMatch(/amal@example\.com|0771234567|200012345678/)
  })

  it('refuses a wrong gate PIN and an event that does not exist', async () => {
    expect(await getGateList(ids.eventId, '9999')).toEqual({ ok: false, error: 'invalid_pin' })
    expect(await getGateList(NOBODY, '1234')).toEqual({ ok: false, error: 'not_found' })
    expect(await getGateList('foo', '1234')).toEqual({ ok: false, error: 'not_found' })
  })

  it('answers unknown when the database cannot answer', async () => {
    await t.db.exec('DROP FUNCTION gate_get_list CASCADE')
    expect(await getGateList(ids.eventId, '1234')).toEqual({ ok: false, error: 'unknown' })
  })
})

describe('uploadOfflineScans and the offline scan issues', () => {
  const scan = { reservationId: 'RES-AAAAAA', scannedAt: new Date().toISOString() }

  it('records an Offline scan', async () => {
    expect(await uploadOfflineScans(ids.eventId, '1234', 'Gate 2', [scan])).toEqual({
      ok: true, results: [{ reservationId: 'RES-AAAAAA', result: 'recorded' }],
    })
    expect(await getOfflineScanIssues(ids.eventId)).toEqual([])
  })

  it('flags a Double entry for a Reservation already admitted online', async () => {
    await decideScan('RES-AAAAAA', ids.eventId, '1234')
    expect(await uploadOfflineScans(ids.eventId, '1234', 'Gate 2', [scan])).toEqual({
      ok: true, results: [{ reservationId: 'RES-AAAAAA', result: 'double_entry' }],
    })
    expect(await getOfflineScanIssues(ids.eventId)).toMatchObject([
      { reservationId: 'RES-AAAAAA', buyerName: 'Amal', tickets: 2, issue: 'double_entry', gatePhone: 'Gate 2' },
    ])
  })

  it('refuses a wrong gate PIN and an event that does not exist', async () => {
    expect(await uploadOfflineScans(ids.eventId, '9999', 'Gate 2', [scan])).toEqual({ ok: false, error: 'invalid_pin' })
    expect(await uploadOfflineScans('foo', '1234', 'Gate 2', [scan])).toEqual({ ok: false, error: 'not_found' })
  })

  it('answers unknown / null when the database cannot answer', async () => {
    await t.db.exec('DROP FUNCTION gate_upload_offline_scans CASCADE; DROP FUNCTION admin_get_offline_scan_issues CASCADE')
    expect(await uploadOfflineScans(ids.eventId, '1234', 'Gate 2', [scan])).toEqual({ ok: false, error: 'unknown' })
    expect(await getOfflineScanIssues(ids.eventId)).toBeNull()
  })
})
