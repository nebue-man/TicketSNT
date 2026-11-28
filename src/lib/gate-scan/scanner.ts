// The phone half of the gate-scan module (ADR-0005): one Scan in, one Scan
// outcome and the Door count to show out, whether the Scan went to the server,
// was decided offline, or never got an answer. No React, no DOM: the network
// and the phone's offline mode come in as adapters.

import type { OfflineScanOutcome } from '@/lib/gate-offline/gate-list'
import {
  notAdmitted, parseScanWire,
  type GateDoorCount, type GateScanResult, type ScanOutcome, type ShownDoorCount,
} from './outcome'

/** Sends one Scan to the server. Resolves with the HTTP status and parsed body; rejects if nothing came back. */
export type ScanSend = (
  body: { reservationId: string; eventId: string; gatePin: string },
  signal: AbortSignal,
) => Promise<{ status: number; body: unknown }>

/** What the gate-scan module asks the phone about offline mode (owned by useGateOffline). */
export interface OfflineScanning {
  inOfflineMode(): boolean
  /** Decides an Offline scan from the Gate list, saving an Admission before answering. */
  scan(reservationId: string): OfflineScanOutcome
  /** The approximate Door count from the Gate list and this phone's Offline scans; null with no list. */
  count(): GateDoorCount | null
}

export interface GateScan {
  scan(reservationId: string): Promise<GateScanResult>
}

export const SCAN_TIMEOUT_MS = 5000

export function createGateScan({ eventId, pin, send, offline, timeoutMs = SCAN_TIMEOUT_MS }: {
  eventId: string
  pin: string
  send: ScanSend
  offline: OfflineScanning
  timeoutMs?: number
}): GateScan {
  let lastLive: GateDoorCount | null = null // shown, marked not updated, when a Scan is Not checked

  function scanOffline(reservationId: string): GateScanResult {
    const o = offline.scan(reservationId)
    const outcome: ScanOutcome =
      o.kind === 'denied' ? notAdmitted(o.reservationId, o.reason)
      : o.kind === 'admitted'
        ? { kind: 'admitted', reservationId: o.reservationId, buyerName: o.entry.buyerName, items: o.entry.items, offline: true }
        : { kind: 'already_scanned', reservationId: o.reservationId, buyerName: o.entry.buyerName, items: o.entry.items, admittedAt: o.admittedAt, offline: true }
    const count = offline.count()
    return { outcome, doorCount: count ? { kind: 'offline', count } : { kind: 'unavailable' } }
  }

  async function scanOnline(reservationId: string): Promise<GateScanResult> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    let wire
    try {
      const res = await send({ reservationId, eventId, gatePin: pin }, ctrl.signal)
      wire = res.status === 200 ? parseScanWire(res.body) : null
    } catch {
      wire = null
    } finally {
      clearTimeout(timer)
    }

    if (!wire) {
      return {
        outcome: { kind: 'not_checked', reservationId },
        doorCount: lastLive ? { kind: 'stale', count: lastLive } : { kind: 'unavailable' },
      }
    }

    let doorCount: ShownDoorCount
    if (wire.doorCount.status === 'live') {
      lastLive = { ticketsAdmitted: wire.doorCount.ticketsAdmitted, ticketsSold: wire.doorCount.ticketsSold }
      doorCount = { kind: 'live', count: lastLive }
    } else {
      doorCount = wire.doorCount.status === 'withheld' ? { kind: 'hidden' } : { kind: 'unavailable' }
    }

    const outcome: ScanOutcome =
      wire.outcome === 'not_admitted' ? notAdmitted(wire.reservationId, wire.reason)
      : wire.outcome === 'admitted'
        ? { kind: 'admitted', reservationId: wire.reservation.id, buyerName: wire.reservation.buyerName, items: wire.reservation.items, offline: false }
        : { kind: 'already_scanned', reservationId: wire.reservation.id, buyerName: wire.reservation.buyerName, items: wire.reservation.items, admittedAt: wire.admittedAt, offline: false }
    return { outcome, doorCount }
  }

  return {
    scan: reservationId => offline.inOfflineMode() ? Promise.resolve(scanOffline(reservationId)) : scanOnline(reservationId),
  }
}

/** The production ScanSend: POST to the scan-outcome route. */
export const fetchScan: ScanSend = async (body, signal) => {
  const res = await fetch('/api/gate/scan-outcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}
