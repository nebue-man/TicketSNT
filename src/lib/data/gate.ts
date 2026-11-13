import { createUntypedClient } from '@/lib/supabase/untyped'

export type ScanResult =
  | { ok: true; reservation: ScannedReservation; alreadyScanned: false }
  | { ok: true; reservation: ScannedReservation; alreadyScanned: true; scannedAt: string }
  | { ok: false; error: 'invalid_pin' | 'not_found' | 'wrong_event' | 'voided' | 'unknown' }

export interface ScannedReservation {
  id: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  items: { ticket_type_name: string; quantity: number }[]
}

export async function scanReservation(
  reservationId: string,
  eventId: string,
  gatePin: string
): Promise<ScanResult> {
  const supabase = await createUntypedClient()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, gate_pin')
    .eq('id', eventId)
    .single()

  if (eventError || !event) return { ok: false, error: 'unknown' }
  if (event.gate_pin !== gatePin) return { ok: false, error: 'invalid_pin' }

  const { data: reservation, error: resError } = await supabase
    .from('reservations')
    .select('id, event_id, buyer_name, buyer_email, buyer_phone, status')
    .eq('id', reservationId)
    .single()

  if (resError || !reservation) return { ok: false, error: 'not_found' }
  if (reservation.event_id !== eventId) return { ok: false, error: 'wrong_event' }
  if (reservation.status === 'void') return { ok: false, error: 'voided' }

  const { data: items } = await supabase
    .from('reservation_items')
    .select('quantity, ticket_types(name)')
    .eq('reservation_id', reservationId)

  const scannedReservation: ScannedReservation = {
    id: reservation.id,
    buyer_name: reservation.buyer_name,
    buyer_email: reservation.buyer_email,
    buyer_phone: reservation.buyer_phone,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (items ?? []).map((item: any) => ({
      ticket_type_name: item.ticket_types?.name ?? 'Unknown',
      quantity: item.quantity,
    })),
  }

  const { data: existingScan } = await supabase
    .from('scan_logs')
    .select('scanned_at')
    .eq('reservation_id', reservationId)
    .eq('confirmed', true)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingScan) {
    return { ok: true, reservation: scannedReservation, alreadyScanned: true, scannedAt: existingScan.scanned_at }
  }

  await supabase
    .from('scan_logs')
    .insert({ reservation_id: reservationId, confirmed: true })

  return { ok: true, reservation: scannedReservation, alreadyScanned: false }
}
