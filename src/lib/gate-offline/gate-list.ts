// Offline gate mode (ADR-0004): the Gate list a Gate phone downloads before
// Doors, and how an Offline scan is decided from it. Pure — no storage, no
// network — so it runs the same on the phone and in tests.

import type { GateDoorCount } from '@/lib/data/gate'

export interface GateListItem {
  ticket_type_name: string
  quantity: number
}

export interface GateListEntry {
  buyerName: string
  items: GateListItem[]
  void: boolean
  admittedAt: string | null // Admission known when the list was downloaded
}

export interface GateList {
  eventId: string
  doorsAt: string      // event start; the list is wiped 12 h after this
  generatedAt: string  // server time the snapshot was taken
  reservations: Record<string, GateListEntry>
}

/** An Admission decided on the phone, waiting to be uploaded. */
export interface OfflineScan {
  reservationId: string
  scannedAt: string
}

export type OfflineScanOutcome =
  | { kind: 'admitted'; reservationId: string; entry: GateListEntry }
  | { kind: 'already_scanned'; reservationId: string; entry: GateListEntry; admittedAt: string }
  | { kind: 'denied'; reservationId: string; message: string }

export const GATE_LIST_TTL_AFTER_DOORS_MS = 12 * 60 * 60 * 1000

/**
 * Decides a Scan outcome from the Gate list plus this phone's own Offline scans.
 * A Reservation missing from the list is not admitted: Reservations made during
 * the Sales window are in the list, and Door sales are admitted at the box office.
 */
export function decideOfflineScan(
  list: GateList,
  offlineScans: readonly OfflineScan[],
  reservationId: string,
): OfflineScanOutcome {
  const id = reservationId.trim().toUpperCase()
  const entry = list.reservations[id]
  if (!entry) return { kind: 'denied', reservationId: id, message: 'Not in the gate list — send to the box office' }
  if (entry.void) return { kind: 'denied', reservationId: id, message: 'This reservation has been voided' }

  const own = offlineScans.find(s => s.reservationId === id)
  const admittedAt = entry.admittedAt ?? own?.scannedAt ?? null
  if (admittedAt) return { kind: 'already_scanned', reservationId: id, entry, admittedAt }

  return { kind: 'admitted', reservationId: id, entry }
}

export function isGateListExpired(list: GateList, now: Date = new Date()): boolean {
  const doors = new Date(list.doorsAt).getTime()
  return Number.isFinite(doors) && now.getTime() > doors + GATE_LIST_TTL_AFTER_DOORS_MS
}

export function countTickets(list: GateList): number {
  let n = 0
  for (const entry of Object.values(list.reservations)) {
    if (!entry.void) for (const item of entry.items) n += item.quantity
  }
  return n
}

/**
 * The approximate Door count a phone in offline mode can know (GLOSSARY.md):
 * Admissions in its Gate list plus its own Offline scans. Other phones'
 * Offline scans are missing, so it can only undercount.
 */
export function offlineDoorCount(
  list: GateList,
  offlineScans: readonly OfflineScan[],
): GateDoorCount {
  const ownScans = new Set(offlineScans.map(s => s.reservationId))
  let ticketsAdmitted = 0
  for (const [id, entry] of Object.entries(list.reservations)) {
    if (!entry.admittedAt && !ownScans.has(id)) continue
    for (const item of entry.items) ticketsAdmitted += item.quantity
  }
  return { ticketsAdmitted, ticketsSold: countTickets(list) }
}

/** Maps the gate_get_list payload. Returns null if it isn't a usable list. */
export function toGateList(raw: unknown): GateList | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.code !== 'ok' || typeof r.event_id !== 'string' || !Array.isArray(r.reservations)) return null

  const reservations: Record<string, GateListEntry> = {}
  for (const row of r.reservations as Record<string, unknown>[]) {
    if (typeof row?.id !== 'string') continue
    reservations[row.id] = {
      buyerName: String(row.buyer_name ?? ''),
      items: Array.isArray(row.items)
        ? (row.items as Record<string, unknown>[]).map(i => ({
            ticket_type_name: String(i.ticket_type_name ?? ''),
            quantity: Number(i.quantity) || 0,
          }))
        : [],
      void: row.void === true,
      admittedAt: typeof row.admitted_at === 'string' ? row.admitted_at : null,
    }
  }
  return {
    eventId: r.event_id,
    doorsAt: String(r.doors_at ?? ''),
    generatedAt: String(r.generated_at ?? ''),
    reservations,
  }
}
