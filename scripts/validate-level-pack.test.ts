import { describe, expect, it } from 'vitest'
import {
  boardToPiecePositions,
  generateLevel,
  mulberry32,
} from '../src/game/reverseGen.js'
import type { LevelPack } from '../src/levels/schema.js'
import { validateLevelPack } from './validate-level-pack.js'

describe('validateLevelPack', () => {
  it('rejects wrong level count', () => {
    const pack: LevelPack = {
      rulesVersion: 1,
      generatedAt: '',
      levels: [],
    }
    const r = validateLevelPack(pack, 75)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.some((e) => e.includes('expected 75'))).toBe(true)
  })

  it('rejects duplicate ids', () => {
    const pack: LevelPack = {
      rulesVersion: 1,
      generatedAt: '',
      levels: [
        {
          id: 'w2-s1',
          ballCount: 2,
          stepCount: 0,
          width: 3,
          height: 3,
          piecePositions: [0, 1],
          solution: [],
        },
        {
          id: 'w2-s1',
          ballCount: 2,
          stepCount: 0,
          width: 3,
          height: 3,
          piecePositions: [0, 1],
          solution: [],
        },
      ],
    }
    const r = validateLevelPack(pack, 2)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.some((e) => e.includes('duplicate'))).toBe(true)
  })

  it('rejects missing solution', () => {
    const pack = {
      rulesVersion: 1,
      generatedAt: '',
      levels: [
        {
          id: 'w2-s1',
          ballCount: 2,
          stepCount: 0,
          width: 3,
          height: 3,
          piecePositions: [0, 4],
        },
      ],
    } as unknown as LevelPack
    const r = validateLevelPack(pack, 1)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.some((e) => e.includes('solution'))).toBe(true)
  })

  it('rejects invalid rulesVersion', () => {
    const pack = {
      rulesVersion: 0,
      generatedAt: '',
      levels: [],
    } as unknown as import('../src/levels/schema.js').LevelPack
    const r = validateLevelPack(pack, 0)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.some((e) => e.includes('rulesVersion'))).toBe(true)
  })

  it('accepts a single generated level when count expectation is 1', () => {
    const rng = mulberry32(77_077)
    const g = generateLevel(7, 7, 3, rng, {
      roundTries: 120,
    })
    expect(g).not.toBeNull()
    if (!g) return
    const pack: LevelPack = {
      rulesVersion: 1,
      generatedAt: '',
      levels: [
        {
          id: 'w3-s1',
          ballCount: 3,
          stepCount: g.solution.length,
          width: g.board.width,
          height: g.board.height,
          piecePositions: boardToPiecePositions(g.board),
          solution: g.solution,
        },
      ],
    }
    const r = validateLevelPack(pack, 1)
    expect(r.ok).toBe(true)
  })
})
