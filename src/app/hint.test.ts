import { describe, expect, it } from 'vitest'
import { canMove, cloneBoard, createBoard, move } from '../game/flingBoard.js'
import { applyMoves } from '../game/reverseGen.js'
import type { LevelRecord } from '../levels/schema.js'
import {
  boardsEqual,
  findSolutionPrefixDepth,
} from './hint.js'

describe('hint / packaged solution', () => {
  const level: LevelRecord = {
    id: 'w3-s1',
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
  const sol = level.solution!

  it('findSolutionPrefixDepth is 0 at start', () => {
    const b = createBoard(7, 7, level.piecePositions)
    expect(findSolutionPrefixDepth(level, b)).toBe(0)
  })

  it('findSolutionPrefixDepth matches after first packaged step', () => {
    const b = createBoard(7, 7, level.piecePositions)
    applyMoves(b, [sol[0]!])
    expect(findSolutionPrefixDepth(level, b)).toBe(1)
  })

  it('findSolutionPrefixDepth matches full prefix before last step', () => {
    const b = createBoard(7, 7, level.piecePositions)
    applyMoves(b, [sol[0]!, sol[1]!])
    expect(findSolutionPrefixDepth(level, b)).toBe(2)
  })

  it('findSolutionPrefixDepth returns null when off path', () => {
    const b = createBoard(7, 7, level.piecePositions)
    applyMoves(b, [sol[0]!])
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const
    const s1 = sol[1]!
    let found = false
    for (let c = 0; c < b.cells.length; c++) {
      if (b.cells[c]! < 0) continue
      for (const [dx, dy] of dirs) {
        if (!canMove(b, c, dx, dy)) continue
        if (c === s1.startCell && dx === s1.dx && dy === s1.dy) continue
        const alt = cloneBoard(b)
        move(alt, c, dx, dy)
        expect(findSolutionPrefixDepth(level, alt)).toBeNull()
        found = true
        break
      }
      if (found) break
    }
    expect(found).toBe(true)
  })

  it('boardsEqual detects identical boards', () => {
    const a = createBoard(7, 7, level.piecePositions)
    const b = createBoard(7, 7, level.piecePositions)
    expect(boardsEqual(a, b)).toBe(true)
  })

  it('findSolutionPrefixDepth returns null (not throws) when solution has an illegal step', () => {
    // startCell 0 在 level 的初始局面上没有棋子，applyMoves 将抛出 IllegalMoveError。
    // current 与初始局面不同，迫使循环真正执行到那个非法步骤。
    const corrupted: LevelRecord = {
      ...level,
      stepCount: 1,
      solution: [{ startCell: 0, dx: 1, dy: 0 }],
    }
    // 一个任意的、与初始局面不相同的棋盘（不同格局）
    const differentBoard = createBoard(7, 7, [1, 38, 44])
    expect(() => findSolutionPrefixDepth(corrupted, differentBoard)).not.toThrow()
    expect(findSolutionPrefixDepth(corrupted, differentBoard)).toBeNull()
  })
})
