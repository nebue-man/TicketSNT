import { createAdminClient } from '@/lib/supabase/admin'
import type { Event, TicketType } from '@/types/database'

export async function getEventForGate(eventId: string): Promise<Event | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_get_event', { p_id: eventId })
  if (error) console.error('[getEventForGate] rpc error:', JSON.stringify(error))
  const rows = data as Event[] | null
  return rows?.[0] ?? null
}

export interface EventWithTicketTypes {
  event: Event
  ticketTypes: TicketType[]
}

export async function getEventWithTicketTypes(
  eventId: string
): Promise<EventWithTicketTypes | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabase as any
  const [eventResult, tiersResult] = await Promise.all([
    s.rpc('admin_get_event', { p_id: eventId }),
    s.rpc('admin_get_tiers', { p_event_id: eventId }),
  ])
  if (eventResult.error) console.error('[getEventWithTicketTypes] event error:', JSON.stringify(eventResult.error))
  if (tiersResult.error) console.error('[getEventWithTicketTypes] tiers error:', JSON.stringify(tiersResult.error))
  const event = (eventResult.data as Event[] | null)?.[0]
  if (!event) return null
  const ticketTypes = (tiersResult.data as TicketType[] | null) ?? []
  return { event, ticketTypes }
}

export async function getUpcomingEvents(): Promise<Event[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_get_all_events')
  if (error) console.error('[getUpcomingEvents] rpc error:', JSON.stringify(error))
  // Filter to draft/published only — closed and archived events are not bookable
  return ((data as Event[] | null) ?? []).filter(e => e.status === 'published' || e.status === 'draft')
}
