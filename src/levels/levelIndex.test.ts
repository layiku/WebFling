import { describe, expect, it } from 'vitest'
import {
  MAX_WORLD_BALLS,
  MIN_WORLD_BALLS,
  STAGES_PER_WORLD,
  TOTAL_LEVEL_SLOTS,
  WORLD_COUNT,
  levelFromIndex,
  levelIndex,
  levelKey,
  parseLevelKey,
} from './levelIndex.js'

describe('levelIndex', () => {
  it('defines 15 worlds and 75 slots', () => {
    expect(WORLD_COUNT).toBe(15)
    expect(TOTAL_LEVEL_SLOTS).toBe(75)
    expect(STAGES_PER_WORLD).toBe(5)
    expect(MAX_WORLD_BALLS - MIN_WORLD_BALLS + 1).toBe(15)
  })

  it('round-trips key and linear index', () => {
    expect(levelKey(2, 1)).toBe('w2-s1')
    expect(parseLevelKey('w16-s5')).toEqual({ world: 16, stage: 5 })
    expect(levelIndex(2, 1)).toBe(0)
    expect(levelIndex(3, 1)).toBe(5)
    expect(levelFromIndex(0)).toEqual({ world: 2, stage: 1 })
    expect(levelFromIndex(74)).toEqual({ world: 16, stage: 5 })
  })

  it('rejects invalid keys and indices', () => {
    expect(() => parseLevelKey('bad')).toThrow()
    expect(() => parseLevelKey('w1-s1')).toThrow()
    expect(() => parseLevelKey('w17-s1')).toThrow()
    expect(() => parseLevelKey('w2-s6')).toThrow()
    expect(() => levelFromIndex(-1)).toThrow()
    expect(() => levelFromIndex(75)).toThrow()
  })

  it('rejects invalid world or stage for key helpers', () => {
    expect(() => levelKey(1, 1)).toThrow()
    expect(() => levelKey(2, 0)).toThrow()
    expect(() => levelIndex(17, 1)).toThrow()
  })
})
