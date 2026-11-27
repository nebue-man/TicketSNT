import { describe, it, expect } from 'vitest'
import { validateDoorSale } from './validate-door-sale'

const NOW = new Date('2026-12-01T20:00:00+05:30')

describe('validateDoorSale', () => {
  it('treats a missing door_sale as an ordinary Reservation', () => {
    expect(validateDoorSale(undefined, NOW)).toEqual({ valid: true, doorSale: null })
    expect(validateDoorSale(null, NOW)).toEqual({ valid: true, doorSale: null })
  })

  it('admits now for mode "now"', () => {
    expect(validateDoorSale({ mode: 'now' }, NOW)).toEqual({ valid: true, doorSale: { admittedAt: null } })
  })

  it('keeps the paper time for mode "paper"', () => {
    expect(validateDoorSale({ mode: 'paper', admitted_at: '2026-12-01T19:42:00+05:30' }, NOW)).toEqual({
      valid: true, doorSale: { admittedAt: '2026-12-01T14:12:00.000Z' },
    })
  })

  it('allows a box-office clock a few minutes fast', () => {
    expect(validateDoorSale({ mode: 'paper', admitted_at: '2026-12-01T20:04:00+05:30' }, NOW).valid).toBe(true)
  })

  it.each([
    [{ mode: 'paper' }, 'Enter the time written on the paper'],
    [{ mode: 'paper', admitted_at: 'not a time' }, 'Enter the time written on the paper'],
    [{ mode: 'paper', admitted_at: '2026-12-01T21:00:00+05:30' }, 'The paper sale time is in the future'],
    [{ mode: 'paper', admitted_at: '2026-11-20T19:00:00+05:30' }, 'The paper sale time is more than 7 days ago'],
    [{ mode: 'later' }, 'Invalid door sale'],
    ['now', 'Invalid door sale'],
    [[], 'Invalid door sale'],
  ])('rejects %j', (raw, error) => {
    expect(validateDoorSale(raw, NOW)).toEqual({ valid: false, error })
  })
})
