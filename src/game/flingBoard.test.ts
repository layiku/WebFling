import { describe, expect, it } from 'vitest'
import {
  canMove,
  cloneBoard,
  computeMovePlan,
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

describe('computeMovePlan', () => {
  it('returns null when the move is illegal', () => {
    const b = createBoard(3, 1, [0, 1])
    expect(computeMovePlan(b, 0, 1, 0)).toBeNull()
  })

  it('matches a single strike then exit: segments and final board equal move()', () => {
    const b = createBoard(3, 1, [0, 2])
    const plan = computeMovePlan(b, 0, 1, 0)
    expect(plan).not.toBeNull()
    expect(plan).toEqual([
      { kind: 'roll', pieceId: 0, path: [0, 1] },
      {
        kind: 'impact',
        strikerId: 0,
        strikerStopCell: 1,
        targetId: 1,
        hitCell: 2,
      },
      { kind: 'flyOff', pieceId: 1, fromCell: 2, dx: 1, dy: 0 },
    ])
    const after = cloneBoard(b)
    move(after, 0, 1, 0)
    expect(after.cells).not.toEqual(b.cells)
  })

  it('records a chain: second roll may be a one-cell path before the next impact', () => {
    const b = createBoard(7, 1, [0, 2, 4])
    const plan = computeMovePlan(b, 0, 1, 0)
    expect(plan).not.toBeNull()
    const kinds = plan!.map((s) => s.kind)
    expect(kinds).toEqual(['roll', 'impact', 'roll', 'impact', 'roll', 'flyOff'])
    expect(plan![1]).toMatchObject({ kind: 'impact', strikerStopCell: 1, hitCell: 2 })
    expect(plan![2]).toEqual({ kind: 'roll', pieceId: 1, path: [2, 3] })
    expect(plan![3]).toMatchObject({ kind: 'impact', strikerStopCell: 3, hitCell: 4 })
    expect(plan![4]).toEqual({ kind: 'roll', pieceId: 2, path: [4, 5, 6] })
  })

  it('includes a roll segment for post-impact travel before flyOff', () => {
    // 7x1 board: piece 0 at cell 0, piece 1 at cell 2.
    // Piece 0 rolls to 1, impacts piece 1 at cell 2.
    // Piece 1 then rolls through cells 3,4,5,6 and exits —
    // there MUST be a roll segment [2,3,4,5,6] before the flyOff.
    const b = createBoard(7, 1, [0, 2])
    const plan = computeMovePlan(b, 0, 1, 0)
    expect(plan).not.toBeNull()
    const kinds = plan!.map((s) => s.kind)
    expect(kinds).toEqual(['roll', 'impact', 'roll', 'flyOff'])
    expect(plan![2]).toEqual({ kind: 'roll', pieceId: 1, path: [2, 3, 4, 5, 6] })
    expect(plan![3]).toMatchObject({ kind: 'flyOff', pieceId: 1, fromCell: 6 })
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

// ─── Zero-direction guard ─────────────────────────────────────

describe('zero direction vector (dx=0, dy=0)', () => {
  it('canMove returns false', () => {
    const b = createBoard(3, 3, [0, 4])
    expect(canMove(b, 0, 0, 0)).toBe(false)
  })

  it('move throws', () => {
    const b = createBoard(3, 3, [0, 4])
    expect(() => move(b, 0, 0, 0)).toThrow(/zero direction/)
  })
})

// ─── Vertical movement ────────────────────────────────────────

describe('canMove vertical', () => {
  it('returns true when there is an empty row before the first piece (down)', () => {
    const b = createBoard(1, 5, [0, 2])
    expect(canMove(b, 0, 0, 1)).toBe(true)
  })

  it('returns false when the first cell below is occupied (adjacent)', () => {
    const b = createBoard(1, 3, [0, 1])
    expect(canMove(b, 0, 0, 1)).toBe(false)
  })

  it('returns true upward', () => {
    // ball at row 4, ball at row 2, on a 1×5 board
    const b = createBoard(1, 5, [4, 2])
    expect(canMove(b, 4, 0, -1)).toBe(true)
  })

  it('returns false upward when adjacent', () => {
    const b = createBoard(1, 3, [2, 1])
    expect(canMove(b, 2, 0, -1)).toBe(false)
  })

  it('returns false when no piece in direction', () => {
    const b = createBoard(1, 5, [0])
    expect(canMove(b, 0, 0, 1)).toBe(false)
  })
})

describe('move vertical (chain + exit)', () => {
  it('down: striker stops before impact, struck exits', () => {
    const b = createBoard(1, 5, [0, 2])
    move(b, 0, 0, 1)
    expect(countBalls(b)).toBe(1)
    expect(b.cells[1]).toBe(0)
    expect(isWon(b)).toBe(true)
  })

  it('up: striker stops before impact, struck exits', () => {
    const b = createBoard(1, 5, [4, 2])
    move(b, 4, 0, -1)
    expect(countBalls(b)).toBe(1)
    expect(b.cells[3]).toBe(0)
    expect(isWon(b)).toBe(true)
  })

  it('down: 3-ball chain where struck piece hits another and both chain out', () => {
    // cells 0, 2, 4 on a 1×7 board → ball 0 hits ball 1 at cell 2, ball 1 hits ball 2 at cell 4
    const b = createBoard(1, 7, [0, 2, 4])
    move(b, 0, 0, 1)
    // ball 2 exits, ball 1 stops at cell 3, ball 0 stops at cell 1
    expect(countBalls(b)).toBe(2)
    expect(b.cells[1]).toBe(0)
    expect(b.cells[3]).toBe(1)
  })
})

// ─── Leftward movement ────────────────────────────────────────

describe('canMove leftward', () => {
  it('returns true when there is a gap then a piece to the left', () => {
    const b = createBoard(5, 1, [4, 2])
    expect(canMove(b, 4, -1, 0)).toBe(true)
  })

  it('returns false when adjacent piece to the left', () => {
    const b = createBoard(3, 1, [2, 1])
    expect(canMove(b, 2, -1, 0)).toBe(false)
  })
})

describe('move leftward', () => {
  it('striker stops before impact, struck exits left', () => {
    const b = createBoard(5, 1, [4, 2])
    move(b, 4, -1, 0)
    expect(countBalls(b)).toBe(1)
    expect(b.cells[3]).toBe(0)
    expect(isWon(b)).toBe(true)
  })
})

// ─── computeMovePlan vs move consistency ───────────────────────

describe('computeMovePlan vs move board state consistency', () => {
  it('rightward 2-ball', () => {
    const orig = createBoard(5, 1, [0, 2])
    const afterMove = cloneBoard(orig)
    move(afterMove, 0, 1, 0)
    const plan = computeMovePlan(cloneBoard(orig), 0, 1, 0)
    expect(plan).not.toBeNull()
    // Simulate: apply move on another clone and compare
    const sim = cloneBoard(orig)
    move(sim, 0, 1, 0)
    expect(sim.cells).toEqual(afterMove.cells)
  })

  it('downward 2-ball', () => {
    const orig = createBoard(1, 5, [0, 2])
    const afterMove = cloneBoard(orig)
    move(afterMove, 0, 0, 1)
    const plan = computeMovePlan(cloneBoard(orig), 0, 0, 1)
    expect(plan).not.toBeNull()
    const sim = cloneBoard(orig)
    move(sim, 0, 0, 1)
    expect(sim.cells).toEqual(afterMove.cells)
  })

  it('leftward 2-ball', () => {
    const orig = createBoard(5, 1, [4, 2])
    const afterMove = cloneBoard(orig)
    move(afterMove, 4, -1, 0)
    const plan = computeMovePlan(cloneBoard(orig), 4, -1, 0)
    expect(plan).not.toBeNull()
    const sim = cloneBoard(orig)
    move(sim, 4, -1, 0)
    expect(sim.cells).toEqual(afterMove.cells)
  })

  it('upward 2-ball', () => {
    const orig = createBoard(1, 5, [4, 2])
    const afterMove = cloneBoard(orig)
    move(afterMove, 4, 0, -1)
    const plan = computeMovePlan(cloneBoard(orig), 4, 0, -1)
    expect(plan).not.toBeNull()
    const sim = cloneBoard(orig)
    move(sim, 4, 0, -1)
    expect(sim.cells).toEqual(afterMove.cells)
  })

  it('3-ball horizontal chain', () => {
    const orig = createBoard(7, 1, [0, 2, 4])
    const afterMove = cloneBoard(orig)
    move(afterMove, 0, 1, 0)
    const plan = computeMovePlan(cloneBoard(orig), 0, 1, 0)
    expect(plan).not.toBeNull()
    const sim = cloneBoard(orig)
    move(sim, 0, 1, 0)
    expect(sim.cells).toEqual(afterMove.cells)
  })

  it('3-ball vertical chain', () => {
    const orig = createBoard(1, 7, [0, 2, 4])
    const afterMove = cloneBoard(orig)
    move(afterMove, 0, 0, 1)
    const plan = computeMovePlan(cloneBoard(orig), 0, 0, 1)
    expect(plan).not.toBeNull()
    const sim = cloneBoard(orig)
    move(sim, 0, 0, 1)
    expect(sim.cells).toEqual(afterMove.cells)
  })

  it('2D layout: move right on a 3×3 board', () => {
    // ball at (0,0), ball at (2,0) on 3×3
    const orig = createBoard(3, 3, [0, 2])
    const afterMove = cloneBoard(orig)
    move(afterMove, 0, 1, 0)
    const plan = computeMovePlan(cloneBoard(orig), 0, 1, 0)
    expect(plan).not.toBeNull()
    const sim = cloneBoard(orig)
    move(sim, 0, 1, 0)
    expect(sim.cells).toEqual(afterMove.cells)
  })
})
