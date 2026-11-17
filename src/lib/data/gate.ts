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

type ScanCode = 'admitted' | 'already_scanned' | 'invalid_pin' | 'not_found' | 'wrong_event' | 'voided'
type ErrorCode = Extract<ScanResult, { ok: false }>['error']

interface ScanPayload {
  code: ScanCode
  reservation_id?: string
  buyer_name?: string
  buyer_email?: string
  buyer_phone?: string
  items?: { ticket_type_name: string; quantity: number }[]
  scanned_at?: string
}

const ERROR_CODES: Partial<Record<ScanCode, ErrorCode>> = {
  invalid_pin: 'invalid_pin',
  not_found:   'not_found',
  wrong_event: 'wrong_event',
  voided:      'voided',
}

export async function scanReservation(
  reservationId: string,
  eventId: string,
  gatePin: string
): Promise<ScanResult> {
  const supabase = await createUntypedClient()

  type RpcCall = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: ScanPayload | null; error: unknown }>
  const { data, error } = await (supabase.rpc as unknown as RpcCall)(
    'scan_reservation',
    { p_reservation_id: reservationId, p_event_id: eventId, p_gate_pin: gatePin }
  )

  if (error || !data) return { ok: false, error: 'unknown' }

  if (data.code === 'admitted' || data.code === 'already_scanned') {
    const reservation: ScannedReservation = {
      id:          data.reservation_id!,
      buyer_name:  data.buyer_name!,
      buyer_email: data.buyer_email!,
      buyer_phone: data.buyer_phone!,
      items:       data.items ?? [],
    }
    if (data.code === 'already_scanned') {
      return { ok: true, reservation, alreadyScanned: true, scannedAt: data.scanned_at! }
    }
    return { ok: true, reservation, alreadyScanned: false }
  }

  return { ok: false, error: ERROR_CODES[data.code] ?? 'unknown' }
}
