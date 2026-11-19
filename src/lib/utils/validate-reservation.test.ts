import { describe, it, expect } from 'vitest'
import { validateReservationInput } from './validate-reservation'

const valid = {
  buyer_name: 'Alice Perera',
  buyer_email: 'alice@example.com',
  buyer_phone: '0771234567',
  buyer_nic: '200012345678',
  items: [{ ticket_type_id: 'type-abc', quantity: 2 }],
  consent: true,
}

describe('validateReservationInput', () => {
  it('accepts valid input', () => {
    const result = validateReservationInput(valid, 10)
    expect(result.valid).toBe(true)
  })

  it('rejects missing name', () => {
    const result = validateReservationInput({ ...valid, buyer_name: '' }, 10)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/name/i)
  })

  it('rejects name that is only whitespace', () => {
    const result = validateReservationInput({ ...valid, buyer_name: '   ' }, 10)
    expect(result.valid).toBe(false)
  })

  it('rejects email without @', () => {
    const result = validateReservationInput({ ...valid, buyer_email: 'notanemail' }, 10)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/email/i)
  })

  it('rejects missing phone', () => {
    const result = validateReservationInput({ ...valid, buyer_phone: '' }, 10)
    expect(result.valid).toBe(false)
  })

  it('rejects missing NIC', () => {
    const result = validateReservationInput({ ...valid, buyer_nic: '' }, 10)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/nic/i)
  })

  it('rejects NIC that is only whitespace', () => {
    const result = validateReservationInput({ ...valid, buyer_nic: '   ' }, 10)
    expect(result.valid).toBe(false)
  })

  it('rejects empty items array', () => {
    const result = validateReservationInput({ ...valid, items: [] }, 10)
    expect(result.valid).toBe(false)
  })

  it('rejects item with quantity 0', () => {
    const result = validateReservationInput(
      { ...valid, items: [{ ticket_type_id: 'x', quantity: 0 }] },
      10
    )
    expect(result.valid).toBe(false)
  })

  it('rejects total exceeding max_per_reservation', () => {
    const result = validateReservationInput(
      { ...valid, items: [{ ticket_type_id: 'x', quantity: 5 }] },
      4
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/maximum/i)
  })

  it('rejects missing consent', () => {
    const result = validateReservationInput({ ...valid, consent: false }, 10)
    expect(result.valid).toBe(false)
  })

  it('trims buyer_name and lowercases buyer_email', () => {
    const result = validateReservationInput(
      { ...valid, buyer_name: '  Alice  ', buyer_email: '  ALICE@EXAMPLE.COM  ' },
      10
    )
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.buyer_name).toBe('Alice')
      expect(result.data.buyer_email).toBe('alice@example.com')
    }
  })

  it('rejects non-object body', () => {
    const result = validateReservationInput(null, 10)
    expect(result.valid).toBe(false)
  })
})
