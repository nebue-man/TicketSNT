import { createAdminClient } from '@/lib/supabase/admin'
import type { Event } from '@/types/database'

export type EventInsert = {
  name: string
  date_time: string
  venue: string
  description: string
  cover_image_url: string | null
  max_per_reservation: number
  gate_pin: string
  status: 'published' | 'draft'
}

// Supabase's typed client does not infer insert/update argument shapes correctly
// for this schema, so we cast through unknown on write operations (same pattern
// used in src/lib/data/reservations.ts).
type AnyTable = {
  select: (cols: string) => AnyTable
  insert: (row: unknown) => AnyTable
  update: (patch: unknown) => AnyTable
  eq: (col: string, val: string) => AnyTable
  order: (col: string, opts?: { ascending: boolean }) => AnyTable
  single: () => Promise<{ data: unknown; error: { message: string } | null }>
  then: undefined
}
type SupabaseAny = { from: (table: string) => AnyTable }

export async function getAllEvents(): Promise<Event[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date_time', { ascending: false })
  if (error || !data) return []
  return data as Event[]
}

export async function getAdminEvent(id: string): Promise<Event | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('events').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as Event
}

export async function createEvent(insert: EventInsert): Promise<{ id: string } | null> {
  const supabase = createAdminClient() as unknown as SupabaseAny
  const { data, error } = await supabase
    .from('events').insert(insert).select('id').single()
  if (error || !data) return null
  return data as { id: string }
}

export async function updateEvent(id: string, patch: Partial<EventInsert>): Promise<boolean> {
  const supabase = createAdminClient() as unknown as SupabaseAny
  const { error } = await supabase.from('events').update(patch).eq('id', id).single()
  return !error
}

export async function closeEvent(id: string): Promise<boolean> {
  const supabase = createAdminClient() as unknown as SupabaseAny
  const { error } = await supabase
    .from('events').update({ status: 'closed' }).eq('id', id).single()
  return !error
}
