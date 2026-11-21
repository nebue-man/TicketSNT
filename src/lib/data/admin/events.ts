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

// Supabase's typed client does not infer insert/update argument shapes correctly
// for this schema (args resolve to `never`), so write operations cast through unknown.
type WriteResult = { data: unknown; error: { message: string } | null }
type AnyTable = PromiseLike<WriteResult> & {
  select: (cols: string) => AnyTable
  insert: (row: unknown) => AnyTable
  update: (patch: unknown) => AnyTable
  eq: (col: string, val: unknown) => AnyTable
  order: (col: string, opts?: { ascending: boolean }) => AnyTable
  single: () => PromiseLike<WriteResult>
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

export async function createEvent(insert: EventInsert): Promise<{ id: string } | { error: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  console.log('[createEvent] baseUrl:', baseUrl, '| keyPrefix:', serviceKey?.slice(0, 15))

  const res = await fetch(`${baseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(insert),
  })

  const text = await res.text()
  console.log('[createEvent] status:', res.status, '| body:', text.slice(0, 200))

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg } catch { /* not JSON */ }
    return { error: msg }
  }

  try {
    const rows = JSON.parse(text) as { id: string }[]
    if (!rows[0]?.id) return { error: 'No ID returned from insert' }
    return { id: rows[0].id }
  } catch {
    return { error: 'Unexpected response from database' }
  }
}

export async function updateEvent(id: string, patch: Partial<EventInsert>): Promise<boolean> {
  const supabase = createAdminClient() as unknown as SupabaseAny
  const { error } = await supabase.from('events').update(patch).eq('id', id)
  return !error
}

export async function closeEvent(id: string): Promise<boolean> {
  const supabase = createAdminClient() as unknown as SupabaseAny
  const { error } = await supabase
    .from('events').update({ status: 'closed' }).eq('id', id)
  return !error
}
