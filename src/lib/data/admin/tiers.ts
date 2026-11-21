import { createAdminClient } from '@/lib/supabase/admin'
import type { TicketType } from '@/types/database'

export async function getTiersForEvent(eventId: string): Promise<TicketType[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_get_tiers', { p_event_id: eventId })
  if (error) console.error('[getTiersForEvent] rpc error:', JSON.stringify(error))
  return (data as TicketType[] | null) ?? []
}

export async function createTier(eventId: string, tier: {
  name: string; price: number; capacity: number; sort_order: number
}): Promise<boolean> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('admin_create_tier', {
    p_event_id:   eventId,
    p_name:       tier.name,
    p_price:      tier.price,
    p_capacity:   tier.capacity,
    p_sort_order: tier.sort_order,
  })
  if (error) console.error('[createTier] rpc error:', error)
  return !error
}

export async function updateTier(id: string, patch: {
  name?: string; price?: number; capacity?: number
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()

  // Read current values to fill in unchanged fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tierRows } = await (supabase as any).rpc('admin_get_tier', { p_id: id })
  const current = (tierRows as TicketType[] | null)?.[0]
  if (!current) return { ok: false, error: 'Tier not found' }
  const row = current as { name: string; price: number; capacity: number }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_update_tier', {
    p_id:       id,
    p_name:     patch.name     ?? row.name,
    p_price:    patch.price    ?? row.price,
    p_capacity: patch.capacity ?? row.capacity,
  })
  if (error) return { ok: false, error: 'Update failed' }
  if (typeof data === 'string' && data.startsWith('capacity_too_low:')) {
    const sold = data.split(':')[1]
    return { ok: false, error: `Capacity cannot be less than tickets already sold (${sold})` }
  }
  return { ok: true }
}

export async function deleteTier(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_delete_tier', { p_id: id })
  if (error) return { ok: false, error: 'Delete failed' }
  if (data === 'has_bookings') return { ok: false, error: 'Cannot remove a tier with existing bookings' }
  return { ok: true }
}
