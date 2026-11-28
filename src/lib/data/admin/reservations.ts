import { createAdminClient } from '@/lib/supabase/admin'
import { callDb, DbFailure } from '@/lib/data/db'
import type { Reservation } from '@/types/database'


export interface TierStat {
  id: string
  name: string
  price: number
  capacity: number
  sold: number
  remaining: number
}

/** Tickets sold and remaining per tier. Throws DbFailure if the database can't answer. */
export async function getEventStats(eventId: string): Promise<TierStat[]> {
  const r = await callDb<{ id: string; name: string; price: number; capacity: number; sold: number }[]>(
    'admin_get_tiers', { p_event_id: eventId })
  if (r.kind !== 'ok') throw new DbFailure('admin_get_tiers')
  return (r.data ?? []).map(t => ({ ...t, remaining: t.capacity - t.sold }))
}

// A table query, not a database function, so callDb can't cover it without new
// SQL (a migration). Left on the query builder for now (ADR-0006).
export async function getReservationsForEvent(
  eventId: string,
  search?: string
): Promise<(Reservation & { items: { ticket_type_name: string; quantity: number }[] })[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('reservations')
    .select(`
      *,
      reservation_items (
        quantity,
        ticket_types ( name )
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (search) {
    const term = `%${search}%`
    query = query.or(`buyer_name.ilike.${term},nic.ilike.${term},id.ilike.${term}`)
  }

  const { data, error } = await query
  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(r => {
    const rawItems = r.reservation_items as { quantity: number; ticket_types: { name: string } | null }[] | null
    const items = (rawItems ?? []).map(i => ({
      ticket_type_name: i.ticket_types?.name ?? '(deleted)',
      quantity: i.quantity,
    }))
    return { ...(r as unknown as Reservation), items }
  })
}

export async function voidReservation(id: string): Promise<{ ok: true } | { ok: false; reason: 'failed' }> {
  const r = await callDb('admin_void_reservation', { p_id: id })
  return r.kind === 'ok' ? { ok: true } : { ok: false, reason: 'failed' }
}
