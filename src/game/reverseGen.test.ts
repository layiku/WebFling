import { describe, expect, it } from 'vitest'
import { canMove, cloneBoard, countBalls, createBoard, isWon, move } from './flingBoard.js'
import {
  IllegalMoveError,
  boardToPiecePositions,
  generateLevel,
  mulberry32,
  applyMoves,
  occupancyKey,
  replaySolution,
  tryReverseAddBall,
  verifySolution,
} from './reverseGen.js'

describe('tryReverseAddBall', () => {
  it('forward check: some 2-ball 5x5 states collapse to exactly 1 ball in one move', () => {
    let anyOne = 0
    for (let a = 0; a < 25; a++) {
      for (let b = a + 1; b < 25; b++) {
        const B = createBoard(5, 5, [a, b])
        for (let c = 0; c < 25; c++) {
          if (B.cells[c] < 0) continue
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            if (!canMove(B, c, dx, dy)) continue
            const C = cloneBoard(B)
            move(C, c, dx, dy)
            if (countBalls(C) === 1) anyOne++
          }
        }
      }
    }
    expect(anyOne).toBeGreaterThan(0)
  })

  it('finds a reverse step from 1-ball target (random placements)', () => {
    const rng = mulberry32(42)
    const target = createBoard(5, 5, [12])

    const r = tryReverseAddBall(target, rng, 8000)
    expect(r).not.toBeNull()
    if (!r) return
    expect(countBalls(r.board)).toBe(2)
    expect(occupancyKey(r.board)).not.toBe(occupancyKey(target))
  })
})

describe('IllegalMoveError', () => {
  it('applyMoves throws IllegalMoveError (not plain Error) on illegal step', () => {
    const b = createBoard(3, 3, [0, 4])
    // Step from empty cell — always illegal
    expect(() => applyMoves(b, [{ startCell: 1, dx: 1, dy: 0 }])).toThrow(
      IllegalMoveError,
    )
  })

  it('IllegalMoveError extends Error with correct name', () => {
    const err = new IllegalMoveError()
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(IllegalMoveError)
    expect(err.name).toBe('IllegalMoveError')
    expect(err.message).toBe('illegal move in applyMoves')
  })
})

describe('verifySolution', () => {
  it('returns false when a step is illegal', () => {
    const b = createBoard(3, 3, [0, 8])
    expect(
      verifySolution(b, [{ startCell: 4, dx: 1, dy: 0 }]),
    ).toBe(false)
  })
})

describe('generateLevel + verifySolution', () => {
  it('produces a winning sequence for small N (deterministic seed)', () => {
    const rng = mulberry32(999111)
    const g = generateLevel(7, 7, 4, rng, {
      roundTries: 120,
    })
    expect(g).not.toBeNull()
    if (!g) return
    expect(countBalls(g.board)).toBe(4)
    expect(g.solution.length).toBe(3)
    expect(verifySolution(g.board, g.solution)).toBe(true)
    const final = replaySolution(
      g.board.width,
      g.board.height,
      boardToPiecePositions(g.board),
      g.solution,
    )
    expect(isWon(final)).toBe(true)
  })

  it('handles ballCount 2', () => {
    const rng = mulberry32(20260406)
    const g = generateLevel(6, 6, 2, rng, { roundTries: 80 })
    expect(g).not.toBeNull()
    if (!g) return
    expect(g.solution).toHaveLength(1)
    expect(verifySolution(g.board, g.solution)).toBe(true)
  })
})
