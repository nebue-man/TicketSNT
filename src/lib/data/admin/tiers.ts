import { callDb, DbFailure, isUuid, type DbWrite } from '@/lib/data/db'
import type { TicketType } from '@/types/database'

/** An event's tiers in display order. Throws DbFailure if the database can't answer. */
export async function getTiersForEvent(eventId: string): Promise<TicketType[]> {
  if (!isUuid(eventId)) return []
  const r = await callDb<TicketType[]>('admin_get_tiers', { p_event_id: eventId })
  if (r.kind !== 'ok') throw new DbFailure('admin_get_tiers')
  return r.data ?? []
}

export async function createTier(eventId: string, tier: {
  name: string; price: number; capacity: number; sort_order: number
}): Promise<DbWrite> {
  const r = await callDb('admin_create_tier', {
    p_event_id:   eventId,
    p_name:       tier.name,
    p_price:      tier.price,
    p_capacity:   tier.capacity,
    p_sort_order: tier.sort_order,
  })
  return r.kind === 'ok' ? { ok: true } : { ok: false, reason: 'failed' }
}

/** Changes only the fields in `patch`. Not atomic: reads the tier, then writes it back (candidate #3). */
export async function updateTier(id: string, patch: {
  name?: string; price?: number; capacity?: number
}): Promise<DbWrite<'not_found'> | { ok: false; reason: 'capacity_too_low'; sold: number }> {
  if (!isUuid(id)) return { ok: false, reason: 'not_found' }
  const read = await callDb<TicketType[]>('admin_get_tier', { p_id: id })
  if (read.kind !== 'ok') return { ok: false, reason: 'failed' }
  const current = read.data?.[0]
  if (!current) return { ok: false, reason: 'not_found' }

  const r = await callDb<string | null>('admin_update_tier', {
    p_id:       id,
    p_name:     patch.name     ?? current.name,
    p_price:    patch.price    ?? current.price,
    p_capacity: patch.capacity ?? current.capacity,
  })
  if (r.kind !== 'ok') return { ok: false, reason: 'failed' }
  // admin_update_tier answers 'capacity_too_low:<sold>' rather than raising.
  if (typeof r.data === 'string' && r.data.startsWith('capacity_too_low:')) {
    return { ok: false, reason: 'capacity_too_low', sold: Number(r.data.split(':')[1]) || 0 }
  }
  if (r.data === 'ok') return { ok: true }
  console.error('[admin_update_tier] unexpected answer:', r.data)
  return { ok: false, reason: 'failed' }
}

/** Removes a tier. Refused once any Reservation includes it (the database calls this 'has_bookings'). */
export async function deleteTier(id: string): Promise<DbWrite<'not_found' | 'has_bookings'>> {
  if (!isUuid(id)) return { ok: false, reason: 'not_found' }
  const r = await callDb<string | null>('admin_delete_tier', { p_id: id })
  if (r.kind !== 'ok') return { ok: false, reason: 'failed' }
  if (r.data === 'has_bookings') return { ok: false, reason: 'has_bookings' }
  if (r.data === 'ok') return { ok: true }
  console.error('[admin_delete_tier] unexpected answer:', r.data)
  return { ok: false, reason: 'failed' }
}
