import { callDb } from '@/lib/data/db'
import { generateReservationId } from '@/lib/utils/reservation-id'
import type { ReservationInput } from '@/lib/utils/validate-reservation'
import type { DoorSale } from '@/lib/utils/validate-door-sale'

/** Raised by create_reservation as `code:ticket_type_id` (migration 0004). */
const REFUSALS = ['capacity_exceeded', 'ticket_type_not_found'] as const
export type ReservationRefusal = (typeof REFUSALS)[number]

export type ReservationResult =
  | { ok: true; reservationId: string }
  | { ok: false; error: ReservationRefusal | 'failed' }

/**
 * Creates a Reservation. With `doorSale`, it is a Door sale: created and admitted
 * at the box office in one transaction (admittedAt null = now, else the paper time).
 * 'failed' means the database couldn't answer; nothing is known to be saved.
 */
export async function createReservation(
  eventId: string,
  input: ReservationInput,
  doorSale: DoorSale | null = null,
): Promise<ReservationResult> {
  const args: Record<string, unknown> = {
    p_id: generateReservationId(),
    p_event_id: eventId,
    p_buyer_name: input.buyer_name,
    p_buyer_email: input.buyer_email,
    p_buyer_phone: input.buyer_phone,
    p_buyer_nic: input.buyer_nic,
    p_items: input.items,
  }
  if (doorSale) args.p_admitted_at = doorSale.admittedAt

  const r = await callDb<string, ReservationRefusal>(doorSale ? 'create_door_sale' : 'create_reservation', args, REFUSALS)
  if (r.kind === 'refused') return { ok: false, error: r.code }
  if (r.kind === 'failed' || typeof r.data !== 'string') return { ok: false, error: 'failed' }
  return { ok: true, reservationId: r.data }
}
