import { describe, expect, it } from 'vitest'
import { cellNotation, columnLetters } from './boardCoords.js'

describe('columnLetters', () => {
  it('maps 1–26 to A–Z', () => {
    expect(columnLetters(1)).toBe('A')
    expect(columnLetters(26)).toBe('Z')
  })

  it('continues with AA, AB, … after Z', () => {
    expect(columnLetters(27)).toBe('AA')
    expect(columnLetters(28)).toBe('AB')
    expect(columnLetters(52)).toBe('AZ')
    expect(columnLetters(53)).toBe('BA')
  })

  it('throws RangeError for 0', () => {
    expect(() => columnLetters(0)).toThrow(RangeError)
  })

  it('throws RangeError for negative values', () => {
    expect(() => columnLetters(-5)).toThrow(RangeError)
  })

  it('throws RangeError for non-integer (1.5)', () => {
    expect(() => columnLetters(1.5)).toThrow(RangeError)
  })
})

describe('cellNotation', () => {
  it('uses 0-based col/row for display', () => {
    expect(cellNotation(0, 0)).toBe('A1')
    expect(cellNotation(2, 4)).toBe('C5')
  })
})
