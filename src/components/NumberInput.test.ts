import { describe, it, expect } from 'vitest'
import { parseWholeNumber, settleWholeNumber } from './NumberInput'

describe('parseWholeNumber (while typing)', () => {
  it('accepts a whole number in range', () => {
    expect(parseWholeNumber('12', 1, 20)).toBe(12)
  })
  it.each(['', ' ', '-3', '1.5', 'abc'])('treats %j as not a number yet', text => {
    expect(parseWholeNumber(text, 0, 100)).toBeNull()
  })
  it('treats out-of-range values as not ready', () => {
    expect(parseWholeNumber('0', 1, 20)).toBeNull()
    expect(parseWholeNumber('25', 1, 20)).toBeNull()
  })
})

describe('settleWholeNumber (on leaving the field)', () => {
  it('keeps the last good value when the field is left empty', () => {
    expect(settleWholeNumber('', 6, 1, 20)).toBe(6)
  })
  it('clamps to the limits', () => {
    expect(settleWholeNumber('0', 6, 1, 20)).toBe(1)
    expect(settleWholeNumber('99', 6, 1, 20)).toBe(20)
  })
  it('keeps a valid entry', () => {
    expect(settleWholeNumber('8', 6, 1, 20)).toBe(8)
  })
})
