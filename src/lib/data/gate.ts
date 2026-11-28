import { createAdminClient } from '@/lib/supabase/admin'
import { getDoorCount } from '@/lib/data/admin/door-count'
import type { ScanWire, WireDoorCount } from '@/lib/gate-scan/outcome'

export type { GateDoorCount } from '@/lib/gate-scan/outcome'

export type ScanResult =
  | { ok: true; reservation: ScannedReservation; alreadyScanned: false }
  | { ok: true; reservation: ScannedReservation; alreadyScanned: true; scannedAt: string }
  | { ok: false; error: 'invalid_pin' | 'not_found' | 'wrong_event' | 'voided' | 'unknown' }

/** What a Gate phone may know about a scanned Reservation: no email or phone (ADR-0004). */
export interface ScannedReservation {
  id: string
  buyer_name: string
  items: { ticket_type_name: string; quantity: number }[]
}

type ScanCode = 'admitted' | 'already_scanned' | 'invalid_pin' | 'not_found' | 'wrong_event' | 'voided'
type ErrorCode = Extract<ScanResult, { ok: false }>['error']

interface ScanPayload {
  code: ScanCode
  reservation_id?: string
  buyer_name?: string
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
  const supabase = createAdminClient()

  type RpcCall = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: ScanPayload | null; error: unknown }>
  const { data, error } = await (supabase.rpc as unknown as RpcCall)(
    'scan_reservation',
    { p_reservation_id: reservationId, p_event_id: eventId, p_gate_pin: gatePin }
  )

  if (error || !data) return { ok: false, error: 'unknown' }

  if (data.code === 'admitted' || data.code === 'already_scanned') {
    const reservation: ScannedReservation = {
      id:         data.reservation_id!,
      buyer_name: data.buyer_name!,
      items:      data.items ?? [],
    }
    if (data.code === 'already_scanned') {
      return { ok: true, reservation, alreadyScanned: true, scannedAt: data.scanned_at! }
    }
    return { ok: true, reservation, alreadyScanned: false }
  }

  return { ok: false, error: ERROR_CODES[data.code] ?? 'unknown' }
}

// The Scan is already recorded when the count is loaded: a slow count must not
// push the answer past the phone's 5 s limit and show a false Not checked.
const DOOR_COUNT_TIMEOUT_MS = 1500

async function loadDoorCount(eventId: string): Promise<WireDoorCount> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const count = await Promise.race([
      getDoorCount(eventId),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), DOOR_COUNT_TIMEOUT_MS) }),
    ])
    return count
      ? { status: 'live', ticketsAdmitted: count.ticketsAdmitted, ticketsSold: count.ticketsSold }
      : { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The server half of the gate-scan module (ADR-0005): records a Scan and answers
 * with its Scan outcome and the Door count after it. null when the database
 * decided nothing; the phone then shows Not checked. The Door count is
 * withheld for a wrong gate PIN.
 */
export async function decideScan(reservationId: string, eventId: string, gatePin: string): Promise<ScanWire | null> {
  const id = reservationId.trim().toUpperCase()
  const result = await scanReservation(id, eventId, gatePin)
  if (!result.ok) {
    const reason = result.error
    if (reason === 'unknown') return null
    if (reason === 'invalid_pin') return { outcome: 'not_admitted', reservationId: id, reason, doorCount: { status: 'withheld' } }
    return { outcome: 'not_admitted', reservationId: id, reason, doorCount: await loadDoorCount(eventId) }
  }

  const doorCount = await loadDoorCount(eventId)

  const reservation = { id: result.reservation.id, buyerName: result.reservation.buyer_name, items: result.reservation.items }
  return result.alreadyScanned
    ? { outcome: 'already_scanned', reservation, admittedAt: result.scannedAt, doorCount }
    : { outcome: 'admitted', reservation, doorCount }
}
