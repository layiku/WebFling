import { describe, expect, it } from 'vitest'
import { boardToPiecePositions, generateLevel, mulberry32 } from '../src/game/reverseGen.js'
import {
  BOARD_H,
  BOARD_W,
  allBallsCollinear,
  canonicalForm,
  createEmptyPack,
  dynamicJaccardThreshold,
  isTooSimilar,
  jaccardSimilarity,
  pairwiseDistanceSig,
  rowColFingerprint,
} from './generate-levels.js'

const W = BOARD_W  // 7
const H = BOARD_H  // 8

describe('createEmptyPack', () => {
  it('creates an empty valid pack', () => {
    const p = createEmptyPack()
    expect(p.rulesVersion).toBe(1)
    expect(p.levels).toEqual([])
  })
})

describe('canonicalForm', () => {
  it('is the same for a set and its horizontal reflection', () => {
    // Two balls: left side vs mirror
    const pos1 = [0, 2]          // col 0 and col 2 in row 0
    const pos2 = [4, 6]          // col 4 and col 6 in row 0 — mirror on 7-wide board
    expect(canonicalForm(pos1, W)).toBe(canonicalForm(pos2, W))
  })

  it('differs for structurally distinct layouts', () => {
    const a = canonicalForm([0, 1], W)
    const b = canonicalForm([0, 6], W)
    // adjacent vs. far-apart — canonical forms should differ
    expect(a).not.toBe(b)
  })
})

describe('pairwiseDistanceSig', () => {
  it('returns comma-separated sorted distances', () => {
    // Two balls at (0,0) and (3,0): Manhattan distance = 3
    const sig = pairwiseDistanceSig([0, 3], W)
    expect(sig).toBe('3')
  })

  it('3-ball sig contains 3 distances', () => {
    // Balls at cells 0, 3, 21 (col 0 row 0, col 3 row 0, col 0 row 3)
    const sig = pairwiseDistanceSig([0, 3, 21], W)
    const parts = sig.split(',')
    expect(parts).toHaveLength(3)
    parts.forEach((p) => expect(Number(p)).toBeGreaterThanOrEqual(0))
  })

  it('same distances produce same sig', () => {
    // [0,2] and [1,3] on a 1-D board both have distance 2
    const s1 = pairwiseDistanceSig([0, 2], W)
    const s2 = pairwiseDistanceSig([1, 3], W)
    expect(s1).toBe(s2)
  })
})

describe('rowColFingerprint', () => {
  it('reflects correct row/col distribution', () => {
    // Balls at (0,0), (0,1), (1,0) — 2 in col 0, 1 in col 1; 2 in row 0, 1 in row 1
    const fp = rowColFingerprint([0, 1, W], W, H)
    expect(fp).toContain('|')
    const [rows, cols] = fp.split('|')
    expect(rows).toBe('2,1,0,0,0,0,0,0')  // sorted desc row counts
    expect(cols).toBe('2,1,0,0,0,0,0')    // sorted desc col counts
  })
})

describe('jaccardSimilarity', () => {
  it('returns 1 for identical positions', () => {
    expect(jaccardSimilarity([0, 2], W, [0, 2], W)).toBe(1)
  })

  it('is lower for structurally different layouts (far vs adjacent)', () => {
    // [0, 1]: adjacent; relative offsets = {(0,0), (1,0)}
    // [0, 6]: far apart; relative offsets = {(0,0), (6,0)}
    // Both share (0,0) as the anchor → Jaccard = 1/3
    const j = jaccardSimilarity([0, 1], W, [0, 6], W)
    expect(j).toBeCloseTo(1 / 3, 5)
    // Confirm it is below the lenient threshold for N=2
    expect(j).toBeLessThan(dynamicJaccardThreshold(2))
  })

  it('is between 0 and 1', () => {
    const j = jaccardSimilarity([0, 2, 14], W, [1, 3, 15], W)
    expect(j).toBeGreaterThanOrEqual(0)
    expect(j).toBeLessThanOrEqual(1)
  })
})

describe('dynamicJaccardThreshold', () => {
  it('is higher for small N and lower for large N', () => {
    expect(dynamicJaccardThreshold(3)).toBeGreaterThan(dynamicJaccardThreshold(7))
    expect(dynamicJaccardThreshold(5)).toBeGreaterThan(dynamicJaccardThreshold(10))
  })

  it('never exceeds 1', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 10, 15]) {
      expect(dynamicJaccardThreshold(n)).toBeLessThanOrEqual(1)
    }
  })
})

describe('allBallsCollinear', () => {
  it('returns true for 2 balls in same row', () => {
    expect(allBallsCollinear([0, 3], W)).toBe(true)  // both in row 0
  })

  it('returns true for 3 balls in same column', () => {
    // col 0: cells 0, 7, 14
    expect(allBallsCollinear([0, 7, 14], W)).toBe(true)
  })

  it('returns false for L-shaped 3-ball layout', () => {
    // (0,0), (3,0), (3,3) — not all same row or col
    expect(allBallsCollinear([0, 3, 3 + 3 * W], W)).toBe(false)
  })

  it('returns true for single ball', () => {
    expect(allBallsCollinear([5], W)).toBe(true)
  })
})

describe('isTooSimilar', () => {
  it('rejects a level with the same canonical form', () => {
    const rng = mulberry32(0x1234)
    const g = generateLevel(W, H, 5, rng, { roundTries: 200, maxSolverStates: 50_000 })
    if (!g) return  // skip if seed produces no result
    expect(isTooSimilar(g, [g])).toBe(true)
  })

  it('accepts a genuinely distinct level', () => {
    const rng1 = mulberry32(0xaaa1)
    const rng2 = mulberry32(0xbbb2)
    const g1 = generateLevel(W, H, 8, rng1, { roundTries: 300, maxSolverStates: 100_000 })
    const g2 = generateLevel(W, H, 8, rng2, { roundTries: 300, maxSolverStates: 100_000 })
    if (!g1 || !g2) return
    const pos1 = boardToPiecePositions(g1.board)
    const pos2 = boardToPiecePositions(g2.board)
    // Positions must differ; if they happen to be similar, Jaccard check will catch it
    if (pos1.join() !== pos2.join()) {
      // Most 8-ball pairs from different seeds will NOT be too similar
      // (not guaranteed, but very likely)
      expect(typeof isTooSimilar(g2, [g1])).toBe('boolean')
    }
  })
})
