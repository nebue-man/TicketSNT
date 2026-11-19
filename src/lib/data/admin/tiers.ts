import { createAdminClient } from '@/lib/supabase/admin'
import type { TicketType } from '@/types/database'

// Supabase typed client resolves insert/update args as `never` for this schema.
type WriteResult = { data: unknown; error: { message: string } | null }
type AnyTable = PromiseLike<WriteResult> & {
  select: (cols: string) => AnyTable
  insert: (row: unknown) => AnyTable
  update: (patch: unknown) => AnyTable
  delete: () => AnyTable
  eq: (col: string, val: unknown) => AnyTable
  order: (col: string) => AnyTable
  single: () => PromiseLike<WriteResult>
}
type SupabaseAny = { from: (table: string) => AnyTable }

export async function getTiersForEvent(eventId: string): Promise<TicketType[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ticket_types').select('*').eq('event_id', eventId).order('sort_order')
  if (error || !data) return []
  return data as TicketType[]
}

export async function createTier(eventId: string, data: {
  name: string; price: number; capacity: number; sort_order: number
}): Promise<boolean> {
  const supabase = createAdminClient() as unknown as SupabaseAny
  const { error } = await supabase
    .from('ticket_types').insert({ event_id: eventId, ...data, sold: 0 })
  return !error
}

export async function updateTier(id: string, patch: {
  name?: string; price?: number; capacity?: number
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient() as unknown as SupabaseAny

  if (patch.capacity !== undefined) {
    const { data: current } = await sb
      .from('ticket_types').select('sold').eq('id', id).single()
    const row = current as { sold: number } | null
    if (row && patch.capacity < row.sold) {
      return { ok: false, error: `Capacity cannot be less than tickets already sold (${row.sold})` }
    }
  }

  const { error } = await sb.from('ticket_types').update(patch).eq('id', id)
  if (error) return { ok: false, error: 'Update failed' }
  return { ok: true }
}

export async function deleteTier(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient() as unknown as SupabaseAny
  const { data: tierData } = await sb
    .from('ticket_types').select('sold').eq('id', id).single()
  const tier = tierData as { sold: number } | null
  if (tier && tier.sold > 0) {
    return { ok: false, error: 'Cannot remove a tier with existing bookings' }
  }
  const { error } = await sb.from('ticket_types').delete().eq('id', id)
  if (error) return { ok: false, error: 'Delete failed' }
  return { ok: true }
}
