// The gate-scan module's shared definitions (ADR-0005): what a Scan outcome is,
// the words gate staff see for each Not admitted reason, and what the scan API
// sends to a Gate phone. Used by both the server and the phone, so it imports
// nothing from either.

export interface ScanItem {
  ticket_type_name: string
  quantity: number
}

/** The Door count as a Gate phone shows it. */
export interface GateDoorCount {
  ticketsAdmitted: number
  ticketsSold: number
}

/** Why a Scan was Not admitted. The first four come from the server, the rest from an Offline scan. */
export type NotAdmittedReason =
  | 'invalid_pin' | 'not_found' | 'wrong_event' | 'voided'
  | 'not_in_gate_list' | 'no_gate_list' | 'not_saved'

export const NOT_ADMITTED_MESSAGES: Record<NotAdmittedReason, string> = {
  invalid_pin:      'Incorrect gate PIN',
  not_found:        'Reservation not found',
  wrong_event:      'Ticket is for a different event',
  voided:           'This reservation has been voided',
  not_in_gate_list: 'Not in the gate list — send to the box office',
  no_gate_list:     'No gate list on this phone',
  not_saved:        "Couldn't save on this phone — write the ID down and admit manually",
}

/** What the gate screen shows after a Scan (GLOSSARY.md: Scan outcome). */
export type ScanOutcome =
  | { kind: 'admitted'; reservationId: string; buyerName: string; items: ScanItem[]; offline: boolean }
  | { kind: 'already_scanned'; reservationId: string; buyerName: string; items: ScanItem[]; admittedAt: string; offline: boolean }
  | { kind: 'not_admitted'; reservationId: string; reason: NotAdmittedReason; message: string }
  | { kind: 'not_checked'; reservationId: string }

/** The Door count shown with a Scan outcome (GLOSSARY.md: Door count). */
export type ShownDoorCount =
  | { kind: 'live'; count: GateDoorCount }    // sent with this Scan's answer
  | { kind: 'stale'; count: GateDoorCount }   // last live one; this Scan didn't reach the server
  | { kind: 'offline'; count: GateDoorCount } // approximate, from this phone's Gate list
  | { kind: 'unavailable' }
  | { kind: 'hidden' }                        // wrong gate PIN: no event numbers at all

export interface GateScanResult {
  outcome: ScanOutcome
  doorCount: ShownDoorCount
}

export function notAdmitted(reservationId: string, reason: NotAdmittedReason): ScanOutcome {
  return { kind: 'not_admitted', reservationId, reason, message: NOT_ADMITTED_MESSAGES[reason] }
}

// ── The wire: what /api/gate/scan-outcome answers, always with HTTP 200 ──────

export type ServerNotAdmittedReason = Extract<NotAdmittedReason, 'invalid_pin' | 'not_found' | 'wrong_event' | 'voided'>

export interface WireReservation {
  id: string
  buyerName: string
  items: ScanItem[]
}

export type WireDoorCount =
  | ({ status: 'live' } & GateDoorCount)
  | { status: 'unavailable' }
  | { status: 'withheld' } // wrong gate PIN

export type ScanWire =
  | { outcome: 'admitted'; reservation: WireReservation; doorCount: WireDoorCount }
  | { outcome: 'already_scanned'; reservation: WireReservation; admittedAt: string; doorCount: WireDoorCount }
  | { outcome: 'not_admitted'; reservationId: string; reason: ServerNotAdmittedReason; doorCount: WireDoorCount }

const SERVER_REASONS: readonly string[] = ['invalid_pin', 'not_found', 'wrong_event', 'voided'] satisfies ServerNotAdmittedReason[]

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseDoorCount(v: unknown): WireDoorCount | null {
  if (!isObj(v)) return null
  if (v.status === 'unavailable' || v.status === 'withheld') return { status: v.status }
  if (v.status === 'live' && isNum(v.ticketsAdmitted) && isNum(v.ticketsSold)) {
    return { status: 'live', ticketsAdmitted: v.ticketsAdmitted, ticketsSold: v.ticketsSold }
  }
  return null
}

function parseReservation(v: unknown): WireReservation | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.buyerName !== 'string' || !Array.isArray(v.items)) return null
  const items: ScanItem[] = []
  for (const i of v.items) {
    if (!isObj(i) || typeof i.ticket_type_name !== 'string' || !isNum(i.quantity)) return null
    items.push({ ticket_type_name: i.ticket_type_name, quantity: i.quantity })
  }
  return { id: v.id, buyerName: v.buyerName, items }
}

/** Reads a scan answer. null if it isn't one, which the phone treats as Not checked: never guess at green. */
export function parseScanWire(raw: unknown): ScanWire | null {
  if (!isObj(raw)) return null
  const doorCount = parseDoorCount(raw.doorCount)
  if (!doorCount) return null
  if (raw.outcome === 'not_admitted') {
    return typeof raw.reservationId === 'string' && typeof raw.reason === 'string' && SERVER_REASONS.includes(raw.reason)
      ? { outcome: 'not_admitted', reservationId: raw.reservationId, reason: raw.reason as ServerNotAdmittedReason, doorCount }
      : null
  }
  const reservation = parseReservation(raw.reservation)
  if (!reservation) return null
  if (raw.outcome === 'admitted') return { outcome: 'admitted', reservation, doorCount }
  if (raw.outcome === 'already_scanned' && typeof raw.admittedAt === 'string') {
    return { outcome: 'already_scanned', reservation, admittedAt: raw.admittedAt, doorCount }
  }
  return null
}
