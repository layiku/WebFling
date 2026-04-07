import {
  canMove,
  createBoard,
  isErrorZeroBalls,
  isWon,
  move,
  type FlingBoard,
} from '../game/flingBoard.js'
import type { LevelRecord } from '../levels/schema.js'
import {
  findSolutionPrefixDepth,
  type HintFailureReason,
} from './hint.js'

export type GamePhase = 'playing' | 'won' | 'lost'

export type ApplyHintResult =
  | { ok: true }
  | { ok: false; reason: HintFailureReason }

/**
 * 单关游玩状态：选球、落子、撤销、胜负。
 */
export class GameSession {
  private level: LevelRecord
  private board: FlingBoard
  /** 每步成功移动前的盘面快照（仅 cells） */
  private undoStack: Int16Array[] = []
  private selectedCell: number | null = null
  private phase: GamePhase = 'playing'

  constructor(level: LevelRecord) {
    this.level = level
    this.board = createBoard(
      level.width,
      level.height,
      level.piecePositions,
    )
  }

  getLevel(): LevelRecord {
    return this.level
  }

  /**
   * 返回当前局面的只读视图。
   * @remarks 请勿直接修改返回值的属性；如需改变局面，请使用
   *   `tryMoveFromSelection`、`undo`、`restart` 等方法。
   */
  getBoard(): Readonly<FlingBoard> {
    return this.board
  }

  getPhase(): GamePhase {
    return this.phase
  }

  getSelectedCell(): number | null {
    return this.selectedCell
  }

  /** 点击有球的格子选中；点空格清除选中 */
  selectCell(linearIndex: number): void {
    if (this.phase !== 'playing') return
    if (this.board.cells[linearIndex] >= 0) {
      this.selectedCell = linearIndex
    } else {
      this.selectedCell = null
    }
  }

  clearSelection(): void {
    this.selectedCell = null
  }

  /**
   * 仅压入撤销栈（供动画结束后再 {@link executeMovePhysics}）。
   */
  pushUndoSnapshot(): void {
    if (this.phase !== 'playing') return
    this.undoStack.push(new Int16Array(this.board.cells))
  }

  /**
   * 执行物理一步（不压栈）；调用前须已 {@link pushUndoSnapshot}。
   */
  executeMovePhysics(startCell: number, dx: number, dy: number): void {
    move(this.board, startCell, dx, dy)
    this.selectedCell = null
    if (isWon(this.board)) {
      this.phase = 'won'
    } else if (isErrorZeroBalls(this.board)) {
      this.phase = 'lost'
    }
  }

  /**
   * 从当前选中球沿 (dx,dy) 发射。成功则更新盘面并刷新 phase。
   * @returns 是否执行了合法一步
   */
  tryMoveFromSelection(dx: number, dy: number): boolean {
    if (this.phase !== 'playing' || this.selectedCell === null) return false
    const c = this.selectedCell
    if (!canMove(this.board, c, dx, dy)) return false

    this.pushUndoSnapshot()
    this.executeMovePhysics(c, dx, dy)
    return true
  }

  /**
   * 从指定格子尝试一步（用于滑动起点即持球格，无需先点选）。
   */
  tryMoveFromCell(startCell: number, dx: number, dy: number): boolean {
    if (this.phase !== 'playing') return false
    if (this.board.cells[startCell] < 0) return false
    if (!canMove(this.board, startCell, dx, dy)) return false

    this.pushUndoSnapshot()
    this.executeMovePhysics(startCell, dx, dy)
    return true
  }

  canUndo(): boolean {
    return this.undoStack.length > 0 && this.phase === 'playing'
  }

  /** 撤销上一步；胜负状态下不可撤销 */
  undo(): boolean {
    if (!this.canUndo()) return false
    const prev = this.undoStack.pop()!
    this.board.cells.set(prev)
    this.selectedCell = null
    return true
  }

  restart(): void {
    this.board = createBoard(
      this.level.width,
      this.level.height,
      this.level.piecePositions,
    )
    this.undoStack = []
    this.selectedCell = null
    this.phase = 'playing'
  }

  /**
   * 解析参考解下一步（不改盘面）；供带动画提示前校验。
   */
  getPackagedHintStep():
    | {
        ok: true
        step: { startCell: number; dx: number; dy: number }
      }
    | { ok: false; reason: HintFailureReason } {
    if (this.phase !== 'playing') return { ok: false, reason: 'not_playing' }
    const sol = this.level.solution
    if (!sol?.length) return { ok: false, reason: 'no_solution' }

    const depth = findSolutionPrefixDepth(this.level, this.board)
    if (depth === null) return { ok: false, reason: 'off_path' }
    if (depth >= sol.length) return { ok: false, reason: 'done' }

    const step = sol[depth]!
    if (!canMove(this.board, step.startCell, step.dx, step.dy)) {
      return { ok: false, reason: 'illegal' }
    }
    return { ok: true, step }
  }

  /**
   * 执行 `level.solution` 中与当前局面匹配的「下一步」（与玩家手动走一步等价，可撤销）。
   * 只调用一次 `findSolutionPrefixDepth`，同时确定「偏离 / 已完成 / 下一步」。
   */
  tryApplyPackagedHint(): ApplyHintResult {
    const r = this.getPackagedHintStep()
    if (!r.ok) return r
    this.pushUndoSnapshot()
    this.executeMovePhysics(r.step.startCell, r.step.dx, r.step.dy)
    return { ok: true }
  }
}
