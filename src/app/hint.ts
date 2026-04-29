import { createBoard, type FlingBoard } from '../game/flingBoard.js'
import { IllegalMoveError, applyMoves } from '../game/reverseGen.js'
import type { LevelRecord } from '../levels/schema.js'

export function boardsEqual(a: FlingBoard, b: FlingBoard): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  if (a.cells.length !== b.cells.length) return false
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i] !== b.cells[i]) return false
  }
  return true
}

/**
 * 找到 k，使得从初始局面连续执行 `solution[0..k-1]` 后面与 `current` 完全一致（含棋子编号）。
 * 若玩家走偏，或关卡包含非法步骤（数据损坏），则返回 null。
 */
export function findSolutionPrefixDepth(
  level: LevelRecord,
  current: FlingBoard,
): number | null {
  const sol = level.solution
  if (!sol?.length) return null
  const b = createBoard(level.width, level.height, level.piecePositions)
  if (boardsEqual(b, current)) return 0
  try {
    for (let k = 0; k < sol.length; k++) {
      applyMoves(b, [sol[k]!])
      if (boardsEqual(b, current)) return k + 1
    }
  } catch (e) {
    // 关卡包数据损坏（非法步骤）：静默返回 null，让上层报告 off_path / no_solution
    if (!(e instanceof IllegalMoveError)) throw e
    return null
  }
  return null
}

export type HintFailureReason =
  | 'no_solution'
  | 'off_path'
  | 'done'
  | 'not_playing'
  | 'illegal'
