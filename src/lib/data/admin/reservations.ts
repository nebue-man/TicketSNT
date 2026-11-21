import { createAdminClient } from '@/lib/supabase/admin'
import type { Reservation } from '@/types/database'


export interface TierStat {
  id: string
  name: string
  price: number
  capacity: number
  sold: number
  remaining: number
}

export async function getEventStats(eventId: string): Promise<TierStat[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ticket_types')
    .select('id, name, price, capacity, sold')
    .eq('event_id', eventId)
    .order('sort_order')
  if (error || !data) return []
  return (data as { id: string; name: string; price: number; capacity: number; sold: number }[])
    .map(t => ({ ...t, remaining: t.capacity - t.sold }))
}

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

export async function voidReservation(id: string): Promise<boolean> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('admin_void_reservation', { p_id: id })
  if (error) console.error('[voidReservation] rpc error:', error)
  return !error
}
