import { callDb, DbFailure } from '@/lib/data/db'
import type { TicketType } from '@/types/database'

/** A write to a tier: done, or why not. Routes turn the reason into a message and status. */
export type TierWrite<R extends string = never> = { ok: true } | { ok: false; reason: R | 'failed' }

/** An event's tiers in display order. Throws DbFailure if the database can't answer. */
export async function getTiersForEvent(eventId: string): Promise<TicketType[]> {
  const r = await callDb<TicketType[]>('admin_get_tiers', { p_event_id: eventId })
  if (r.kind !== 'ok') throw new DbFailure('admin_get_tiers')
  return r.data ?? []
}

export async function createTier(eventId: string, tier: {
  name: string; price: number; capacity: number; sort_order: number
}): Promise<TierWrite> {
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
}): Promise<TierWrite<'not_found'> | { ok: false; reason: 'capacity_too_low'; sold: number }> {
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
  return { ok: true }
}

export async function deleteTier(id: string): Promise<TierWrite<'has_bookings'>> {
  const r = await callDb<string | null>('admin_delete_tier', { p_id: id })
  if (r.kind !== 'ok') return { ok: false, reason: 'failed' }
  if (r.data === 'has_bookings') return { ok: false, reason: 'has_bookings' }
  return { ok: true }
}
