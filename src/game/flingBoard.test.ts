import { describe, expect, it } from 'vitest'
import {
  canMove,
  cloneBoard,
  countBalls,
  countOccupiedCells,
  createBoard,
  EMPTY,
  isErrorZeroBalls,
  isWon,
  move,
} from './flingBoard.js'

describe('createBoard', () => {
  it('places piece ids 0..n-1', () => {
    const b = createBoard(3, 3, [0, 4, 8])
    expect(b.cells[0]).toBe(0)
    expect(b.cells[4]).toBe(1)
    expect(b.cells[8]).toBe(2)
    expect(b.cells[1]).toBe(EMPTY)
  })

  it('rejects duplicate positions', () => {
    expect(() => createBoard(3, 3, [0, 0])).toThrow(/duplicate/)
  })

  it('rejects out-of-bounds positions', () => {
    expect(() => createBoard(2, 2, [9])).toThrow(/out of bounds/)
  })
})

describe('move validation', () => {
  it('throws when starting from an empty cell', () => {
    const b = createBoard(2, 2, [0])
    expect(() => move(b, 1, 1, 0)).toThrow(/no piece/)
  })

  it('throws RangeError when startCell is negative', () => {
    const b = createBoard(3, 3, [0, 4])
    expect(() => move(b, -1, 1, 0)).toThrow(RangeError)
  })

  it('throws RangeError when startCell is >= board size', () => {
    const b = createBoard(3, 3, [0, 4])
    expect(() => move(b, 9, 1, 0)).toThrow(RangeError)
  })
})

describe('canMove bounds', () => {
  it('returns false for out-of-bounds startCell (negative)', () => {
    const b = createBoard(3, 3, [0, 4])
    expect(canMove(b, -1, 1, 0)).toBe(false)
  })

  it('returns false for out-of-bounds startCell (>= size)', () => {
    const b = createBoard(3, 3, [0, 4])
    expect(canMove(b, 99, 1, 0)).toBe(false)
  })

  it('returns false when startCell is empty (no piece to move)', () => {
    // cell 1 为空，cell 4 有棋子；不应因方向上有棋子而误判为可移动
    const b = createBoard(3, 3, [0, 4])
    expect(canMove(b, 1, 1, 0)).toBe(false)
  })
})

describe('canMove (adjacent gap rule)', () => {
  it('returns false when the first cell in direction holds a piece', () => {
    const b = createBoard(3, 1, [0, 1])
    expect(canMove(b, 0, 1, 0)).toBe(false)
  })

  it('returns true when there is at least one empty cell before the first piece', () => {
    const b = createBoard(5, 1, [0, 2])
    expect(canMove(b, 0, 1, 0)).toBe(true)
  })
})

describe('move (chain + exit)', () => {
  it('does not allow a lone ball to exit without a prior strike (canMove false)', () => {
    const b = createBoard(4, 1, [0])
    expect(canMove(b, 0, 1, 0)).toBe(false)
  })

  it('after a strike, the chain mover may exit and leave remaining balls on the board', () => {
    const b = createBoard(3, 1, [0, 2])
    expect(canMove(b, 0, 1, 0)).toBe(true)
    move(b, 0, 1, 0)
    expect(countBalls(b)).toBe(1)
    expect(b.cells[1]).toBe(0)
    expect(isWon(b)).toBe(true)
  })

  it('stops striker on last empty before impact; struck piece continues and may exit', () => {
    const b = createBoard(5, 1, [0, 2])
    const before = cloneBoard(b)
    move(b, 0, 1, 0)
    expect(b.cells[1]).toBe(0)
    expect(countBalls(b)).toBe(1)
    expect(isWon(b)).toBe(true)
    expect(canMove(before, 0, 1, 0)).toBe(true)
  })

  it('does not mutate the original when using cloneBoard', () => {
    const b = createBoard(5, 1, [0, 2])
    const c = cloneBoard(b)
    move(c, 0, 1, 0)
    expect(countBalls(b)).toBe(2)
    expect(countBalls(c)).toBe(1)
  })
})

describe('countOccupiedCells', () => {
  it('matches countBalls on valid boards', () => {
    const b = createBoard(3, 3, [0, 4, 8])
    expect(countOccupiedCells(b)).toBe(countBalls(b))
  })
})

describe('win / error counts', () => {
  it('detects win with exactly one ball', () => {
    const b = createBoard(3, 3, [4])
    expect(isWon(b)).toBe(true)
  })

  it('detects error state with zero balls (caller applied an exit without legality check)', () => {
    const b = createBoard(2, 1, [0])
    move(b, 0, 1, 0)
    expect(isErrorZeroBalls(b)).toBe(true)
  })
})
