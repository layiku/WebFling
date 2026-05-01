import { describe, expect, it } from 'vitest'
import { countBalls } from '../game/flingBoard.js'
import type { LevelRecord } from '../levels/schema.js'
import { GameSession } from './gameSession.js'

describe('GameSession packaged hint', () => {
  const hintLevel: LevelRecord = {
    id: 'w3-h',
    ballCount: 3,
    stepCount: 2,
    width: 7,
    height: 7,
    piecePositions: [2, 37, 44],
    solution: [
      { startCell: 37, dx: 0, dy: -1 },
      { startCell: 9, dx: 0, dy: 1 },
    ],
  }

  it('applies first reference step', () => {
    const g = new GameSession(hintLevel)
    const r = g.tryApplyPackagedHint()
    expect(r.ok).toBe(true)
    expect(countBalls(g.getBoard())).toBe(2)
  })

  it('applies second step and wins', () => {
    const g = new GameSession(hintLevel)
    g.tryApplyPackagedHint()
    const r = g.tryApplyPackagedHint()
    expect(r.ok).toBe(true)
    expect(g.getPhase()).toBe('won')
  })

  it('returns not_playing when already won (not "done")', () => {
    // After all solution steps, phase becomes "won". The next
    // tryApplyPackagedHint hits the not_playing guard first.
    const g = new GameSession(hintLevel)
    g.tryApplyPackagedHint()
    g.tryApplyPackagedHint()
    const r = g.tryApplyPackagedHint()
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('not_playing')
  })

  it('returns off_path after a player moves off the solution', () => {
    const g = new GameSession(hintLevel)
    // Position 2 = (col 2, row 0). Moving down lands on row 5, col 2 (=37),
    // which is a legal move that diverges from the packaged solution.
    g.selectCell(2)
    const moved = g.tryMoveFromSelection(0, 1)
    expect(moved).toBe(true)
    const r = g.tryApplyPackagedHint()
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('off_path')
  })

  it('returns no_solution when level has no solution', () => {
    const noSolLevel: LevelRecord = {
      id: 'w2-x',
      ballCount: 2,
      stepCount: 0,
      width: 3,
      height: 3,
      piecePositions: [0, 4],
      solution: [],
    }
    const g = new GameSession(noSolLevel)
    const r = g.tryApplyPackagedHint()
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('no_solution')
  })

  it('hint step is undoable', () => {
    const g = new GameSession(hintLevel)
    g.tryApplyPackagedHint()
    expect(g.canUndo()).toBe(true)
    g.undo()
    expect(countBalls(g.getBoard())).toBe(3)
  })
})

describe('GameSession', () => {
  it('tryMoveFromSelection applies a legal fling', () => {
    const level: LevelRecord = {
      id: 't1',
      ballCount: 2,
      stepCount: 1,
      width: 7,
      height: 7,
      piecePositions: [8, 22],
      solution: [{ startCell: 8, dx: 0, dy: 1 }],
    }
    const g = new GameSession(level)
    g.selectCell(8)
    const ok = g.tryMoveFromSelection(0, 1)
    expect(ok).toBe(true)
    expect(countBalls(g.getBoard())).toBe(1)
    expect(g.getPhase()).toBe('won')
  })

  it('undo restores previous position', () => {
    const level: LevelRecord = {
      id: 't2',
      ballCount: 3,
      stepCount: 2,
      width: 7,
      height: 7,
      piecePositions: [2, 37, 44],
      solution: [],
    }
    const g = new GameSession(level)
    g.selectCell(37)
    const moved = g.tryMoveFromSelection(0, -1)
    expect(moved).toBe(true)
    expect(g.getPhase()).toBe('playing')
    expect(countBalls(g.getBoard())).toBe(2)
    expect(g.undo()).toBe(true)
    expect(countBalls(g.getBoard())).toBe(3)
  })

  it('illegal move does not change board', () => {
    const level: LevelRecord = {
      id: 't3',
      ballCount: 2,
      stepCount: 1,
      width: 3,
      height: 3,
      piecePositions: [0, 1],
      solution: [],
    }
    const g = new GameSession(level)
    g.selectCell(0)
    const before = new Int16Array(g.getBoard().cells)
    const ok = g.tryMoveFromSelection(1, 0)
    expect(ok).toBe(false)
    expect(Array.from(g.getBoard().cells)).toEqual(Array.from(before))
  })

  it('restart resets to initial layout', () => {
    const level: LevelRecord = {
      id: 't4',
      ballCount: 2,
      stepCount: 1,
      width: 4,
      height: 4,
      piecePositions: [0, 6],
      solution: [],
    }
    const g = new GameSession(level)
    g.selectCell(0)
    g.tryMoveFromSelection(1, 0)
    g.restart()
    expect(countBalls(g.getBoard())).toBe(2)
    expect(g.getPhase()).toBe('playing')
  })

  it('selectCell ignores out-of-bounds indices', () => {
    const level: LevelRecord = {
      id: 't5',
      ballCount: 2,
      stepCount: 1,
      width: 3,
      height: 3,
      piecePositions: [0, 4],
      solution: [],
    }
    const g = new GameSession(level)
    g.selectCell(0)
    expect(g.getSelectedCell()).toBe(0)
    g.selectCell(-1)
    expect(g.getSelectedCell()).toBe(0)
    g.selectCell(999)
    expect(g.getSelectedCell()).toBe(0)
  })

  it('tryMoveFromCell returns false for out-of-bounds startCell', () => {
    const level: LevelRecord = {
      id: 't6',
      ballCount: 2,
      stepCount: 1,
      width: 3,
      height: 3,
      piecePositions: [0, 4],
      solution: [],
    }
    const g = new GameSession(level)
    expect(g.tryMoveFromCell(-1, 1, 0)).toBe(false)
    expect(g.tryMoveFromCell(999, 1, 0)).toBe(false)
  })

  it('commitMove returns false after win and leaves board unchanged', () => {
    // 3x3 board with two balls: ball at 0 can fling ball at 1 rightward off edge
    const level: LevelRecord = {
      id: 't-guard',
      ballCount: 2,
      stepCount: 1,
      width: 3,
      height: 3,
      piecePositions: [0, 1],
      solution: [],
    }
    const g = new GameSession(level)
    // Move ball 0 rightward — hits ball 1, which exits the right edge
    g.commitMove(0, 1, 0)
    expect(g.getPhase()).toBe('won')
    const snapshot = new Int16Array(g.getBoard().cells)
    const result = g.commitMove(0, 1, 0)
    expect(result).toBe(false)
    expect(Array.from(g.getBoard().cells)).toEqual(Array.from(snapshot))
  })

  it('enters lost phase when board has zero balls', () => {
    // 3x3 board: single ball at cell 0 (top-left).
    // Abnormal: move upward (bypasses canMove) → exits immediately → 0 balls → lost.
    // Note: this is only reachable via commitMove (which bypasses canMove);
    // normal flow checks canMove first which prevents this.
    const level: LevelRecord = {
      id: 't7',
      ballCount: 1,
      stepCount: 0,
      width: 3,
      height: 3,
      piecePositions: [0],
      solution: [],
    }
    const g = new GameSession(level)
    g.commitMove(0, 0, -1)
    expect(g.getPhase()).toBe('lost')
    expect(g.canUndo()).toBe(false)
    g.restart()
    expect(g.getPhase()).toBe('playing')
  })
})
