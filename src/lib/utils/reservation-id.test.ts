import { describe, it, expect } from 'vitest'
import { generateReservationId } from './reservation-id'

describe('generateReservationId', () => {
  it('has the RES- prefix', () => {
    expect(generateReservationId()).toMatch(/^RES-/)
  })

  it('has exactly 6 uppercase hex characters after the prefix', () => {
    expect(generateReservationId()).toMatch(/^RES-[0-9A-F]{6}$/)
  })

  it('generates unique IDs across 100 calls', () => {
    const ids = new Set(Array.from({ length: 100 }, generateReservationId))
    expect(ids.size).toBe(100)
  })
})
