import { createAdminClient } from '@/lib/supabase/admin'
import type { Event, EventStatus } from '@/types/database'

export type EventInsert = {
  name: string
  date_time: string
  venue: string
  description: string
  cover_image_url: string | null
  max_per_reservation: number
  gate_pin: string
  status: EventStatus
}

export async function getAllEvents(): Promise<Event[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_get_all_events')
  if (error) console.error('[getAllEvents] rpc error:', JSON.stringify(error))
  return (data as Event[] | null) ?? []
}

export async function getAdminEvent(id: string): Promise<Event | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_get_event', { p_id: id })
  if (error) console.error('[getAdminEvent] id:', id, 'rpc error:', JSON.stringify(error))
  const rows = data as Event[] | null
  return rows?.[0] ?? null
}

export async function createEvent(insert: EventInsert): Promise<{ id: string } | { error: string }> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_create_event', {
    p_name:                insert.name,
    p_date_time:           insert.date_time,
    p_venue:               insert.venue,
    p_description:         insert.description,
    p_cover_image_url:     insert.cover_image_url,
    p_max_per_reservation: insert.max_per_reservation,
    p_gate_pin:            insert.gate_pin,
    p_status:              insert.status,
  })
  console.log('[createEvent] rpc result — data:', JSON.stringify(data), 'error:', JSON.stringify(error))
  if (error) {
    return { error: (error as { message?: string }).message ?? 'Failed to create event' }
  }
  // Supabase returns scalar uuid as a plain string, but guard against objects
  const id = typeof data === 'string' ? data : (data as Record<string, string> | null)?.id ?? null
  if (!id) return { error: 'RPC returned no ID — check Netlify logs' }
  return { id }
}

export async function updateEvent(id: string, patch: Partial<EventInsert>): Promise<boolean> {
  const current = await getAdminEvent(id)
  if (!current) return false
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('admin_update_event', {
    p_id:                  id,
    p_name:                patch.name               ?? current.name,
    p_date_time:           patch.date_time          ?? current.date_time,
    p_venue:               patch.venue              ?? current.venue,
    p_description:         patch.description        ?? current.description,
    p_cover_image_url:     patch.cover_image_url    ?? current.cover_image_url,
    p_max_per_reservation: patch.max_per_reservation ?? current.max_per_reservation,
    p_gate_pin:            patch.gate_pin           ?? current.gate_pin,
    p_status:              patch.status             ?? current.status,
  })
  if (error) console.error('[updateEvent] rpc error:', error)
  return !error
}

export async function closeEvent(id: string): Promise<boolean> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('admin_close_event', { p_id: id })
  if (error) console.error('[closeEvent] rpc error:', error)
  return !error
}
