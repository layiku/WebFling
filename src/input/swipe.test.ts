import { describe, expect, it } from 'vitest'
import { pixelDeltaToDirection } from './swipe.js'

describe('pixelDeltaToDirection', () => {
  it('returns null when movement is too short', () => {
    expect(pixelDeltaToDirection(3, 0, 20)).toBeNull()
    expect(pixelDeltaToDirection(0, 0, 10)).toBeNull()
  })

  it('maps dominant horizontal axis', () => {
    expect(pixelDeltaToDirection(30, 5, 20)).toEqual({ dx: 1, dy: 0 })
    expect(pixelDeltaToDirection(-40, 2, 20)).toEqual({ dx: -1, dy: 0 })
  })

  it('maps dominant vertical axis', () => {
    expect(pixelDeltaToDirection(4, 35, 20)).toEqual({ dx: 0, dy: 1 })
    expect(pixelDeltaToDirection(3, -50, 20)).toEqual({ dx: 0, dy: -1 })
  })

  it('tie-break: equal |dx|===|dy| resolves to horizontal', () => {
    // code uses >= so equal magnitude → horizontal wins
    expect(pixelDeltaToDirection(30, 30, 20)).toEqual({ dx: 1, dy: 0 })
    expect(pixelDeltaToDirection(-30, 30, 20)).toEqual({ dx: -1, dy: 0 })
    expect(pixelDeltaToDirection(30, -30, 20)).toEqual({ dx: 1, dy: 0 })
    expect(pixelDeltaToDirection(-30, -30, 20)).toEqual({ dx: -1, dy: 0 })
  })
})
