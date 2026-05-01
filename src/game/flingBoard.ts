/**
 * HOG2-style Fling board (see hog2 FlingBoard::Move / CanMove).
 * Piece ids are stable integers ≥ 0; each id appears on at most one cell.
 */

export const EMPTY = -1 as const

export type FlingBoard = {
  width: number
  height: number
  /** Linear index → piece id, or EMPTY */
  cells: Int16Array
}

export function createBoard(
  width: number,
  height: number,
  piecePositions: readonly number[],
): FlingBoard {
  const cells = new Int16Array(width * height).fill(EMPTY)
  for (let i = 0; i < piecePositions.length; i++) {
    const p = piecePositions[i]
    if (p < 0 || p >= cells.length) {
      throw new RangeError(`piecePositions[${i}] out of bounds`)
    }
    if (cells[p] !== EMPTY) {
      throw new Error(`duplicate position ${p}`)
    }
    cells[p] = i
  }
  return { width, height, cells }
}

export function cloneBoard(board: FlingBoard): FlingBoard {
  return {
    width: board.width,
    height: board.height,
    cells: new Int16Array(board.cells),
  }
}

/**
 * 去重球数（含 Set 分配）。合法局面下与 countOccupiedCells 结果相同。
 * 仅用于 reverseGen 等需检测非法局面的场景；热路径请用 countOccupiedCells。
 */
export function countBalls(board: FlingBoard): number {
  const seen = new Set<number>()
  for (let i = 0; i < board.cells.length; i++) {
    const v = board.cells[i]
    if (v >= 0) seen.add(v)
  }
  return seen.size
}

/** 占用格数；合法局面下与 {@link countBalls} 相同，无 Set 分配。 */
export function countOccupiedCells(board: FlingBoard): number {
  let n = 0
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i]! >= 0) n++
  }
  return n
}

export function isWon(board: FlingBoard): boolean {
  return countOccupiedCells(board) === 1
}

export function isErrorZeroBalls(board: FlingBoard): boolean {
  return countOccupiedCells(board) === 0
}

/**
 * HOG2 CanMove: first cell in direction cannot be occupied; must hit a piece after ≥1 empty step.
 */
export function canMove(
  board: FlingBoard,
  startCell: number,
  dx: number,
  dy: number,
): boolean {
  if (dx === 0 && dy === 0) return false
  if (startCell < 0 || startCell >= board.cells.length) return false
  // 起点必须有棋子，否则没有球可以移动
  if (board.cells[startCell]! < 0) return false
  const w = board.width
  const h = board.height
  let xx = (startCell % w) + dx
  let yy = Math.floor(startCell / w) + dy
  let first = true
  while (xx >= 0 && xx < w && yy >= 0 && yy < h) {
    const idx = yy * w + xx
    if (board.cells[idx] >= 0) {
      return !first
    }
    first = false
    xx += dx
    yy += dy
  }
  return false
}

/**
 * Apply one fling from `startCell` in direction (dx,dy). Mutates `board`.
 * Chain transfer: striker stops on last empty before impact; struck piece continues.
 * UI 应在调用前用 `canMove` 判定；否则可能产生非法局面（例如独球飞出界）。
 */
export function move(
  board: FlingBoard,
  startCell: number,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) {
    throw new Error('zero direction vector')
  }
  if (startCell < 0 || startCell >= board.cells.length) {
    throw new RangeError(`startCell ${startCell} out of bounds`)
  }
  const w = board.width
  const h = board.height
  let movingId = board.cells[startCell]!
  if (movingId < 0) {
    throw new Error('no piece at startCell')
  }

  let lastx = startCell % w
  let lasty = Math.floor(startCell / w)
  let xx = lastx + dx
  let yy = lasty + dy

  while (xx >= 0 && xx < w && yy >= 0 && yy < h) {
    const idx = yy * w + xx
    if (board.cells[idx] >= 0) {
      board.cells[lasty * w + lastx] = movingId
      movingId = board.cells[idx]
    } else {
      board.cells[lasty * w + lastx] = EMPTY
      board.cells[idx] = movingId
    }
    lastx = xx
    lasty = yy
    xx += dx
    yy += dy
  }

  board.cells[lasty * w + lastx] = EMPTY
}

// ─── Move animation plan (mirrors {@link move} step semantics) ───────

/** 供 UI 播放滚动 / 撞击 / 飞出 动画，逻辑与 `move` 一致。
 *  与 move() 共享遍历逻辑；修改任一函数时必须同步另一函数。*/
export type MoveAnimSegment =
  | { kind: 'roll'; pieceId: number; path: number[] }
  | {
      kind: 'impact'
      strikerId: number
      strikerStopCell: number
      targetId: number
      hitCell: number
    }
  | { kind: 'flyOff'; pieceId: number; fromCell: number; dx: number; dy: number }

/**
 * 预计算一步移动的动画分段：连续滑动、每次撞击、最后飞出。
 * 不改变传入的 `board`。
 */
export function computeMovePlan(
  board: FlingBoard,
  startCell: number,
  dx: number,
  dy: number,
): MoveAnimSegment[] | null {
  if (!canMove(board, startCell, dx, dy)) return null
  const b = cloneBoard(board)
  const w = b.width
  const h = b.height
  const segments: MoveAnimSegment[] = []

  let movingId = b.cells[startCell]!
  let lastx = startCell % w
  let lasty = Math.floor(startCell / w)
  let xx = lastx + dx
  let yy = lasty + dy
  const path: number[] = [startCell]

  while (xx >= 0 && xx < w && yy >= 0 && yy < h) {
    const idx = yy * w + xx
    if (b.cells[idx]! >= 0) {
      const lastIdx = lasty * w + lastx
      segments.push({ kind: 'roll', pieceId: movingId, path: [...path] })
      segments.push({
        kind: 'impact',
        strikerId: movingId,
        strikerStopCell: lastIdx,
        targetId: b.cells[idx]!,
        hitCell: idx,
      })
      b.cells[lasty * w + lastx] = movingId
      movingId = b.cells[idx]!
      lastx = xx
      lasty = yy
      xx += dx
      yy += dy
      path.length = 0
      path.push(lasty * w + lastx)
    } else {
      b.cells[lasty * w + lastx] = EMPTY
      b.cells[idx] = movingId
      lastx = xx
      lasty = yy
      path.push(idx)
      xx += dx
      yy += dy
    }
  }

  // After the last impact, the exiting piece may travel through empty cells
  // before leaving the board — produce a roll segment for that travel.
  if (path.length >= 2) {
    segments.push({ kind: 'roll', pieceId: movingId, path: [...path] })
  }

  const exitCell = lasty * w + lastx
  segments.push({ kind: 'flyOff', pieceId: movingId, fromCell: exitCell, dx, dy })
  return segments
}
