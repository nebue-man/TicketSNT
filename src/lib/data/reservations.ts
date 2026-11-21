import { createAdminClient } from '@/lib/supabase/admin'
import { generateReservationId } from '@/lib/utils/reservation-id'
import type { ReservationInput } from '@/lib/utils/validate-reservation'

export type ReservationResult =
  | { ok: true; reservationId: string }
  | { ok: false; error: 'capacity_exceeded' | 'ticket_type_not_found' | 'unknown' }

export async function createReservation(
  eventId: string,
  input: ReservationInput
): Promise<ReservationResult> {
  const supabase = createAdminClient()
  const reservationId = generateReservationId()

  // rpc args cast needed until types are generated from local schema
  type RpcResult = { data: string | null; error: { message: string } | null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await ((supabase as any).rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>)(
    'create_reservation',
    {
      p_id: reservationId,
      p_event_id: eventId,
      p_buyer_name: input.buyer_name,
      p_buyer_email: input.buyer_email,
      p_buyer_phone: input.buyer_phone,
      p_buyer_nic: input.buyer_nic,
      p_items: input.items,
    }
  )

  if (error) {
    if (error.message.includes('capacity_exceeded')) return { ok: false, error: 'capacity_exceeded' }
    if (error.message.includes('ticket_type_not_found')) return { ok: false, error: 'ticket_type_not_found' }
    return { ok: false, error: 'unknown' }
  }

  return { ok: true, reservationId: data as string }
}
