import { describe, it, expect, vi } from 'vitest'
import { createGateScan, type ScanSend, type OfflineScanning } from './phone'
import type { ScanWire } from './outcome'

const RES = { id: 'RES-AAAAAA', buyerName: 'Amal', items: [{ ticket_type_name: 'General', quantity: 2 }] }
const LIVE = { status: 'live', ticketsAdmitted: 312, ticketsSold: 800 } as const

/** A server that answers every Scan with `wire` (HTTP 200). */
const answers = (wire: ScanWire | unknown, status = 200): ScanSend => async () => ({ status, body: wire })
const online: OfflineScanning = {
  inOfflineMode: () => false,
  scan: () => { throw new Error('should not scan offline') },
  count: () => null,
}

function gate(send: ScanSend, offline: OfflineScanning = online) {
  return createGateScan({ eventId: 'ev1', pin: '1234', send, offline })
}

describe('createGateScan: online', () => {
  it('shows Admitted with the live Door count', async () => {
    const r = await gate(answers({ outcome: 'admitted', reservation: RES, doorCount: LIVE })).scan('RES-AAAAAA')
    expect(r).toEqual({
      outcome: { kind: 'admitted', reservationId: 'RES-AAAAAA', buyerName: 'Amal', items: RES.items, offline: false },
      doorCount: { kind: 'live', count: { ticketsAdmitted: 312, ticketsSold: 800 } },
    })
  })

  it('sends the event, the gate PIN and the Reservation ID', async () => {
    const send = vi.fn<ScanSend>(answers({ outcome: 'admitted', reservation: RES, doorCount: LIVE }))
    await gate(send).scan('RES-AAAAAA')
    expect(send.mock.calls[0][0]).toEqual({ reservationId: 'RES-AAAAAA', eventId: 'ev1', gatePin: '1234' })
  })

  it('shows Already scanned with the time of the original Admission', async () => {
    const r = await gate(answers({ outcome: 'already_scanned', reservation: RES, admittedAt: '2026-12-01T14:05:00Z', doorCount: LIVE }))
      .scan('RES-AAAAAA')
    expect(r.outcome).toMatchObject({ kind: 'already_scanned', admittedAt: '2026-12-01T14:05:00Z', offline: false })
  })

  it.each([
    ['not_found', 'Reservation not found'],
    ['wrong_event', 'Ticket is for a different event'],
    ['voided', 'This reservation has been voided'],
  ] as const)('shows Not admitted (%s) in staff words, with the Door count', async (reason, message) => {
    const r = await gate(answers({ outcome: 'not_admitted', reservationId: 'RES-AAAAAA', reason, doorCount: LIVE })).scan('RES-AAAAAA')
    expect(r.outcome).toEqual({ kind: 'not_admitted', reservationId: 'RES-AAAAAA', reason, message })
    expect(r.doorCount.kind).toBe('live')
  })

  it('shows no Door count at all for a wrong gate PIN', async () => {
    const r = await gate(answers({ outcome: 'not_admitted', reservationId: 'RES-AAAAAA', reason: 'invalid_pin', doorCount: { status: 'withheld' } }))
      .scan('RES-AAAAAA')
    expect(r).toEqual({
      outcome: { kind: 'not_admitted', reservationId: 'RES-AAAAAA', reason: 'invalid_pin', message: 'Incorrect gate PIN' },
      doorCount: { kind: 'hidden' },
    })
  })

  it('shows the Door count as unavailable when the server could not load it', async () => {
    const r = await gate(answers({ outcome: 'admitted', reservation: RES, doorCount: { status: 'unavailable' } })).scan('RES-AAAAAA')
    expect(r.doorCount).toEqual({ kind: 'unavailable' })
  })
})

describe('createGateScan: Not checked', () => {
  it('is Not checked when the server decided nothing (non-200)', async () => {
    const r = await gate(answers({ error: 'boom' }, 500)).scan('RES-AAAAAA')
    expect(r).toEqual({ outcome: { kind: 'not_checked', reservationId: 'RES-AAAAAA' }, doorCount: { kind: 'unavailable' } })
  })

  it('is Not checked, never Admitted, when a 200 answer is not a Scan outcome', async () => {
    const r = await gate(answers({ ok: true, reservation: { id: 'RES-AAAAAA' } })).scan('RES-AAAAAA')
    expect(r.outcome.kind).toBe('not_checked')
  })

  it('is Not checked when the network fails', async () => {
    const r = await gate(async () => { throw new TypeError('Failed to fetch') }).scan('RES-AAAAAA')
    expect(r.outcome.kind).toBe('not_checked')
  })

  it('is Not checked after the time limit, cancelling the request', async () => {
    vi.useFakeTimers()
    try {
      let signal: AbortSignal | undefined
      const send: ScanSend = (_body, s) => {
        signal = s
        return new Promise((_, reject) => s.addEventListener('abort', () => reject(new Error('aborted'))))
      }
      const pending = gate(send).scan('RES-AAAAAA')
      await vi.advanceTimersByTimeAsync(5000)
      expect((await pending).outcome.kind).toBe('not_checked')
      expect(signal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the last live Door count, marked not updated', async () => {
    let up = true
    const gateScan = gate(async () => {
      if (!up) throw new TypeError('Failed to fetch')
      return { status: 200, body: { outcome: 'admitted', reservation: RES, doorCount: LIVE } }
    })
    await gateScan.scan('RES-AAAAAA')
    up = false
    const r = await gateScan.scan('RES-BBBBBB')
    expect(r.doorCount).toEqual({ kind: 'stale', count: { ticketsAdmitted: 312, ticketsSold: 800 } })
  })

  it('does not take a wrong-PIN scan as the last Door count', async () => {
    let wire: unknown = { outcome: 'not_admitted', reservationId: 'RES-AAAAAA', reason: 'invalid_pin', doorCount: { status: 'withheld' } }
    const gateScan = gate(async () => {
      if (!wire) throw new TypeError('Failed to fetch')
      return { status: 200, body: wire }
    })
    await gateScan.scan('RES-AAAAAA')
    wire = null
    expect((await gateScan.scan('RES-AAAAAA')).doorCount).toEqual({ kind: 'unavailable' })
  })
})

describe('createGateScan: offline mode', () => {
  const entry = { buyerName: 'Amal', items: RES.items, void: false, admittedAt: null }
  const offline = (o: ReturnType<OfflineScanning['scan']>): OfflineScanning => ({
    inOfflineMode: () => true,
    scan: () => o,
    count: () => ({ ticketsAdmitted: 40, ticketsSold: 800 }),
  })
  const noNetwork: ScanSend = async () => { throw new Error('should not send while offline') }

  it('shows an Offline scan as Admitted, with the approximate Door count', async () => {
    const r = await gate(noNetwork, offline({ kind: 'admitted', reservationId: 'RES-AAAAAA', entry })).scan('RES-AAAAAA')
    expect(r).toEqual({
      outcome: { kind: 'admitted', reservationId: 'RES-AAAAAA', buyerName: 'Amal', items: RES.items, offline: true },
      doorCount: { kind: 'offline', count: { ticketsAdmitted: 40, ticketsSold: 800 } },
    })
  })

  it('shows Already scanned from the Gate list or this phone', async () => {
    const r = await gate(noNetwork, offline({ kind: 'already_scanned', reservationId: 'RES-AAAAAA', entry, admittedAt: '2026-12-01T13:40:00Z' }))
      .scan('RES-AAAAAA')
    expect(r.outcome).toMatchObject({ kind: 'already_scanned', admittedAt: '2026-12-01T13:40:00Z', offline: true })
  })

  it.each([
    ['not_in_gate_list', 'Not in the gate list — send to the box office'],
    ['voided', 'This reservation has been voided'],
    ['no_gate_list', 'No gate list on this phone'],
    ['not_saved', "Couldn't save on this phone — write the ID down and admit manually"],
  ] as const)('shows Not admitted (%s) in staff words', async (reason, message) => {
    const r = await gate(noNetwork, offline({ kind: 'denied', reservationId: 'RES-ZZZZZZ', reason })).scan('RES-ZZZZZZ')
    expect(r.outcome).toEqual({ kind: 'not_admitted', reservationId: 'RES-ZZZZZZ', reason, message })
  })

  it('uses the same words for a voided Reservation online and offline', async () => {
    const online = await gate(answers({ outcome: 'not_admitted', reservationId: 'RES-AAAAAA', reason: 'voided', doorCount: LIVE })).scan('RES-AAAAAA')
    const off = await gate(noNetwork, offline({ kind: 'denied', reservationId: 'RES-AAAAAA', reason: 'voided' })).scan('RES-AAAAAA')
    expect(off.outcome).toEqual(online.outcome)
  })

  it('shows the Door count as unavailable with no Gate list', async () => {
    const r = await gate(noNetwork, { ...offline({ kind: 'denied', reservationId: 'RES-AAAAAA', reason: 'no_gate_list' }), count: () => null })
      .scan('RES-AAAAAA')
    expect(r.doorCount).toEqual({ kind: 'unavailable' })
  })
})
