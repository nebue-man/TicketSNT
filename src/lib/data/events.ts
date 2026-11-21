import { createClient } from '@/lib/supabase/server'
import type { Event, TicketType } from '@/types/database'

export async function getEventForGate(eventId: string): Promise<Event | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()
  if (error || !data) return null
  return data
}

export interface EventWithTicketTypes {
  event: Event
  ticketTypes: TicketType[]
}

export async function getEventWithTicketTypes(
  eventId: string
): Promise<EventWithTicketTypes | null> {
  const supabase = await createClient()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (eventError || !event) return null

  const { data: ticketTypes, error: typesError } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order')

  if (typesError || !ticketTypes) return null

  return { event, ticketTypes }
}

export async function getUpcomingEvents(): Promise<Event[]> {
  const supabase = await createClient()
  // Staff see all draft and published events (not closed/archived).
  // No date filter — staff may need to book tickets on the day of the event.
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('status', ['published', 'draft'])
    .order('date_time', { ascending: true })
  if (error || !data) return []
  return data
}
