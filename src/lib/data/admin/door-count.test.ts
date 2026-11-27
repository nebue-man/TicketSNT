import { describe, it, expect } from 'vitest'
import { toDoorCount, EMPTY_DOOR_COUNT } from './door-count'

describe('toDoorCount', () => {
  it('maps the database payload', () => {
    expect(toDoorCount({
      tickets_sold: 2950, tickets_admitted: 1842, tickets_admitted_gate: 1790,
      tickets_admitted_box_office: 52, reservations_admitted: 731,
    })).toEqual({
      ticketsSold: 2950, ticketsAdmitted: 1842, ticketsAdmittedGate: 1790,
      ticketsAdmittedBoxOffice: 52, reservationsAdmitted: 731,
    })
  })

  it('accepts numeric strings (Postgres bigint sums can arrive as strings)', () => {
    expect(toDoorCount({ tickets_sold: '12', tickets_admitted: '3' }).ticketsSold).toBe(12)
  })

  it('treats missing or malformed payloads as zero', () => {
    expect(toDoorCount(null)).toEqual(EMPTY_DOOR_COUNT)
    expect(toDoorCount({ tickets_sold: 'abc' })).toEqual(EMPTY_DOOR_COUNT)
  })
})
