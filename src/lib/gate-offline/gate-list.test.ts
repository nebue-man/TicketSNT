import { describe, it, expect } from 'vitest'
import { decideOfflineScan, isGateListExpired, countTickets, offlineDoorCount, toGateList, type GateList } from './gate-list'

const list: GateList = {
  eventId: 'ev1',
  doorsAt: '2026-12-01T13:30:00Z',
  generatedAt: '2026-12-01T13:00:00Z',
  reservations: {
    'RES-AAAAAA': { buyerName: 'Amal', items: [{ ticket_type_name: 'General', quantity: 2 }], void: false, admittedAt: null },
    'RES-BBBBBB': { buyerName: 'Bina', items: [{ ticket_type_name: 'VIP', quantity: 1 }], void: false, admittedAt: '2026-12-01T12:55:00Z' },
    'RES-CCCCCC': { buyerName: 'Chen', items: [{ ticket_type_name: 'General', quantity: 4 }], void: true, admittedAt: null },
  },
}

describe('decideOfflineScan', () => {
  it('admits a Reservation in the list that has no Admission yet', () => {
    expect(decideOfflineScan(list, [], 'RES-AAAAAA')).toMatchObject({ kind: 'admitted', entry: { buyerName: 'Amal' } })
  })

  it('accepts a typed ID in lower case with spaces', () => {
    expect(decideOfflineScan(list, [], ' res-aaaaaa ').kind).toBe('admitted')
  })

  it('shows Already scanned for an Admission known when the list was downloaded', () => {
    expect(decideOfflineScan(list, [], 'RES-BBBBBB')).toMatchObject({ kind: 'already_scanned', admittedAt: '2026-12-01T12:55:00Z' })
  })

  it("shows Already scanned for this phone's own earlier Offline scan", () => {
    const scans = [{ reservationId: 'RES-AAAAAA', scannedAt: '2026-12-01T13:40:00Z' }]
    expect(decideOfflineScan(list, scans, 'RES-AAAAAA')).toMatchObject({ kind: 'already_scanned', admittedAt: '2026-12-01T13:40:00Z' })
  })

  it('does not admit a voided Reservation', () => {
    expect(decideOfflineScan(list, [], 'RES-CCCCCC')).toMatchObject({ kind: 'denied', reason: 'voided' })
  })

  it('does not admit a Reservation missing from the list', () => {
    expect(decideOfflineScan(list, [], 'RES-ZZZZZZ')).toMatchObject({ kind: 'denied', reservationId: 'RES-ZZZZZZ' })
  })
})

describe('isGateListExpired', () => {
  it('keeps the list until 12 h after Doors', () => {
    expect(isGateListExpired(list, new Date('2026-12-02T01:29:00Z'))).toBe(false)
    expect(isGateListExpired(list, new Date('2026-12-02T01:31:00Z'))).toBe(true)
  })
})

describe('countTickets', () => {
  it('counts every ticket except voided ones', () => {
    expect(countTickets(list)).toBe(3)
  })
})

describe('toGateList', () => {
  it('maps the server payload', () => {
    const mapped = toGateList({
      code: 'ok', event_id: 'ev1', doors_at: 'd', generated_at: 'g',
      reservations: [{ id: 'RES-AAAAAA', buyer_name: 'Amal', void: false, admitted_at: null, items: [{ ticket_type_name: 'General', quantity: 2 }] }],
    })
    expect(mapped).toEqual({
      eventId: 'ev1', doorsAt: 'd', generatedAt: 'g',
      reservations: { 'RES-AAAAAA': { buyerName: 'Amal', void: false, admittedAt: null, items: [{ ticket_type_name: 'General', quantity: 2 }] } },
    })
  })

  it('rejects an error payload', () => {
    expect(toGateList({ code: 'invalid_pin' })).toBeNull()
    expect(toGateList(null)).toBeNull()
  })
})

describe('offlineDoorCount', () => {
  it('counts tickets admitted when the list was downloaded, out of tickets sold', () => {
    // Bina's 1 VIP was admitted before download; Chen's 4 are void, so not sold.
    expect(offlineDoorCount(list, [])).toEqual({ ticketsAdmitted: 1, ticketsSold: 3 })
  })

  it("adds every ticket in this phone's own Offline scans", () => {
    const scans = [{ reservationId: 'RES-AAAAAA', scannedAt: '2026-12-01T13:40:00Z' }]
    expect(offlineDoorCount(list, scans)).toEqual({ ticketsAdmitted: 3, ticketsSold: 3 })
  })

  it('does not count a Reservation twice when it was admitted before download and scanned again', () => {
    const scans = [{ reservationId: 'RES-BBBBBB', scannedAt: '2026-12-01T13:40:00Z' }]
    expect(offlineDoorCount(list, scans).ticketsAdmitted).toBe(1)
  })
})