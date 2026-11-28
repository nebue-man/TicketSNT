import { callDb, DbFailure, isUuid } from '@/lib/data/db'
import type { Event, TicketType } from '@/types/database'

/** One event, or null if there is no such event. Throws DbFailure if the database can't answer. */
export async function getEvent(eventId: string): Promise<Event | null> {
  if (!isUuid(eventId)) return null
  const r = await callDb<Event[]>('admin_get_event', { p_id: eventId })
  if (r.kind !== 'ok') throw new DbFailure('admin_get_event')
  return r.data?.[0] ?? null
}

export interface EventWithTicketTypes {
  event: Event
  ticketTypes: TicketType[]
}

/** An event and its ticket types, or null if there is no such event. Throws DbFailure if the database can't answer. */
export async function getEventWithTicketTypes(eventId: string): Promise<EventWithTicketTypes | null> {
  if (!isUuid(eventId)) return null
  const [event, tiers] = await Promise.all([
    getEvent(eventId),
    callDb<TicketType[]>('admin_get_tiers', { p_event_id: eventId }),
  ])
  if (tiers.kind !== 'ok') throw new DbFailure('admin_get_tiers')
  if (!event) return null
  return { event, ticketTypes: tiers.data ?? [] }
}

/** Draft and published events; closed and archived events are not bookable. Throws DbFailure if the database can't answer. */
export async function getUpcomingEvents(): Promise<Event[]> {
  const r = await callDb<Event[]>('admin_get_all_events')
  if (r.kind !== 'ok') throw new DbFailure('admin_get_all_events')
  return (r.data ?? []).filter(e => e.status === 'published' || e.status === 'draft')
}
