import {
  canMove,
  cloneBoard,
  countBalls,
  countOccupiedCells,
  createBoard,
  EMPTY,
  isWon,
  move,
  type FlingBoard,
} from './flingBoard.js'

// ─── Types ──────────────────────────────────────────────────────────

export type MoveStep = { startCell: number; dx: number; dy: number }

export type GeneratedLevel = {
  board: FlingBoard
  /** Moves that solve this puzzle (length = ballCount − 1) */
  solution: MoveStep[]
}

// ─── Constants ──────────────────────────────────────────────────────

const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// ─── PRNG ───────────────────────────────────────────────────────────

/** Mulberry32 PRNG returning values in [0, 1). */
export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Board Utilities ────────────────────────────────────────────────

/** Sorted occupied cell indices as a comma-separated string (ignores piece ids). */
export function occupancyKey(board: FlingBoard): string {
  const xs: number[] = []
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] >= 0) xs.push(i)
  }
  xs.sort((a, b) => a - b)
  return xs.join(',')
}

/**
 * Occupancy key without sort — cells are iterated in ascending index
 * order so the result is naturally sorted. Faster than occupancyKey.
 */
function fastKey(board: FlingBoard): string {
  let key = ''
  let sep = false
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] >= 0) {
      if (sep) key += ','
      key += i
      sep = true
    }
  }
  return key
}


/** Renumber pieces to 0..n−1 by increasing cell index (stable for JSON export). */
export function normalizeBoard(board: FlingBoard): FlingBoard {
  const occupied: number[] = []
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] >= 0) occupied.push(i)
  }
  occupied.sort((a, b) => a - b)
  const b = cloneBoard(board)
  b.cells.fill(EMPTY)
  for (let k = 0; k < occupied.length; k++) {
    b.cells[occupied[k]] = k
  }
  return b
}

export function boardToPiecePositions(board: FlingBoard): number[] {
  const norm = normalizeBoard(board)
  const n = countBalls(norm)
  const out: number[] = new Array(n)
  for (let i = 0; i < norm.cells.length; i++) {
    const id = norm.cells[i]
    if (id >= 0) out[id] = i
  }
  return out
}

export function randomOneBallBoard(
  width: number,
  height: number,
  rng: () => number,
): FlingBoard {
  const pos = Math.floor(rng() * width * height)
  return createBoard(width, height, [pos])
}

// ─── Move Application & Verification ────────────────────────────────

/**
 * Thrown by `applyMoves` when a step is illegal according to HOG2 rules.
 * Callers may catch this specific class to distinguish illegal-move failures
 * from unexpected errors without relying on message-string matching.
 */
export class IllegalMoveError extends Error {
  constructor() {
    super('illegal move in applyMoves')
    this.name = 'IllegalMoveError'
  }
}

/** Apply a sequence of moves to a board (mutates it). */
export function applyMoves(board: FlingBoard, steps: readonly MoveStep[]): void {
  for (const s of steps) {
    if (!canMove(board, s.startCell, s.dx, s.dy)) {
      throw new IllegalMoveError()
    }
    move(board, s.startCell, s.dx, s.dy)
  }
}

export function replaySolution(
  width: number,
  height: number,
  piecePositions: readonly number[],
  steps: readonly MoveStep[],
): FlingBoard {
  const b = createBoard(width, height, piecePositions)
  applyMoves(b, steps)
  return b
}

/** Verify that applying the solution reduces the board to exactly one ball. */
export function verifySolution(
  board: FlingBoard,
  solution: readonly MoveStep[],
): boolean {
  const b = cloneBoard(board)
  try {
    applyMoves(b, solution)
  } catch (e) {
    if (e instanceof IllegalMoveError) return false
    throw e
  }
  return isWon(b)
}

// ─── Random Placement Helpers ───────────────────────────────────────

/**
 * Choose k distinct indices from [0, n), returned sorted ascending.
 * Uses sparse rejection when k ≪ n, Fisher-Yates shuffle otherwise.
 */
function randomKSortedIndices(
  n: number,
  k: number,
  rng: () => number,
  scratch: Int32Array,
): number[] | null {
  if (k > n || k < 0) return null
  if (k === 0) return []

  if (k * 14 < n) {
    const s = new Set<number>()
    let guard = 0
    const limit = k * 45 + 80
    while (s.size < k && guard < limit) {
      guard++
      s.add(Math.floor(rng() * n))
    }
    if (s.size >= k) {
      return [...s].sort((a, b) => a - b)
    }
  }

  for (let i = 0; i < n; i++) scratch[i] = i
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (n - i))
    const t = scratch[i]!
    scratch[i] = scratch[j]!
    scratch[j] = t
  }
  const out = new Array<number>(k)
  for (let i = 0; i < k; i++) out[i] = scratch[i]!
  out.sort((a, b) => a - b)
  return out
}

/**
 * True if any ball has no other ball in its row AND no other ball in its
 * column. Such a ball can never participate in any move → puzzle unsolvable.
 */
function hasIsolatedBall(
  w: number,
  h: number,
  positions: readonly number[],
): boolean {
  const rowCnt = new Uint8Array(h)
  const colCnt = new Uint8Array(w)
  for (const p of positions) {
    rowCnt[Math.floor(p / w)]++
    colCnt[p % w]++
  }
  for (const p of positions) {
    if (rowCnt[Math.floor(p / w)] === 1 && colCnt[p % w] === 1) return true
  }
  return false
}

/**
 * True when all balls form one connected component where two balls are
 * linked if they share a row or column. Disconnected groups can never
 * interact through Fling moves.
 */
function isConnected(w: number, positions: readonly number[]): boolean {
  const n = positions.length
  if (n <= 1) return true
  const vis = new Uint8Array(n)
  const stack = [0]
  vis[0] = 1
  let found = 1
  while (stack.length > 0) {
    const idx = stack.pop()!
    const row = Math.floor(positions[idx] / w)
    const col = positions[idx] % w
    for (let j = 0; j < n; j++) {
      if (vis[j]) continue
      if (Math.floor(positions[j] / w) === row || positions[j] % w === col) {
        vis[j] = 1
        found++
        stack.push(j)
      }
    }
  }
  return found === n
}

// ─── DFS Solver ─────────────────────────────────────────────────────

/**
 * Solve a Fling board via depth-first search with dead-end memoization.
 *
 * Every legal Fling move removes exactly one ball, so any solution has
 * exactly (ballCount − 1) moves. The search prunes:
 *   - States already proven to be dead ends (memoized via Set).
 *   - States containing an isolated ball (row+col unique → unsolvable).
 *   - Exploration beyond the state-visit budget (returns null = "unknown").
 */
function solveDFS(board: FlingBoard, maxStates: number): MoveStep[] | null {
  const totalBalls = countOccupiedCells(board)
  if (totalBalls <= 1) return []

  const w = board.width
  const h = board.height
  const deadEnds = new Set<string>()
  let visited = 0
  const path: MoveStep[] = new Array(totalBalls - 1)

  const rowBuf = new Uint8Array(h)
  const colBuf = new Uint8Array(w)

  function hasIsolation(b: FlingBoard): boolean {
    rowBuf.fill(0)
    colBuf.fill(0)
    for (let i = 0; i < b.cells.length; i++) {
      if (b.cells[i] >= 0) {
        rowBuf[Math.floor(i / w)]++
        colBuf[i % w]++
      }
    }
    for (let i = 0; i < b.cells.length; i++) {
      if (b.cells[i] >= 0) {
        if (rowBuf[Math.floor(i / w)] === 1 && colBuf[i % w] === 1) return true
      }
    }
    return false
  }

  function dfs(b: FlingBoard, depth: number): boolean {
    if (depth === totalBalls - 1) return true
    if (visited >= maxStates) return false

    const key = fastKey(b)
    if (deadEnds.has(key)) return false
    visited++

    // Isolation pruning is only SAFE when exactly 2 balls remain.
    // With ≥ 3 balls, an initially-isolated ball can become reachable
    // after another ball flings into its row/column (e.g. A1→A8 lands at
    // A7, putting the striker in the same row as a previously-isolated G7).
    // With 2 balls remaining they must share a row/col directly — no future
    // move can rescue an isolated ball — so the pruning is correct there.
    const remaining = totalBalls - depth
    if (remaining === 2 && hasIsolation(b)) {
      deadEnds.add(key)
      return false
    }

    for (let c = 0; c < b.cells.length; c++) {
      if (b.cells[c] < 0) continue
      for (const [dx, dy] of DIRS) {
        if (!canMove(b, c, dx, dy)) continue
        const next = cloneBoard(b)
        move(next, c, dx, dy)
        path[depth] = { startCell: c, dx, dy }
        if (dfs(next, depth + 1)) return true
      }
    }

    deadEnds.add(key)
    return false
  }

  return dfs(board, 0) ? path.slice(0, totalBalls - 1) : null
}

// ─── Reverse Construction (preserved for API compatibility) ─────────

function maxPieceId(board: FlingBoard): number {
  let m = -1
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] > m) m = board.cells[i]
  }
  return m
}

function sortedOccupiedIndices(board: FlingBoard): number[] {
  const xs: number[] = []
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] >= 0) xs.push(i)
  }
  xs.sort((a, b) => a - b)
  return xs
}

function sameSortedCells(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Find a (k+1)-ball board whose one legal move yields the same occupancy
 * as `target` (k balls). Uses a fast path that adds one ball to each empty
 * cell, then a limited random fallback.
 */
export function tryReverseAddBall(
  target: FlingBoard,
  rng: () => number,
  maxAttempts = 12000,
): {
  board: FlingBoard
  forwardMove: { startCell: number; dx: number; dy: number }
} | null {
  const targetCount = countBalls(target)
  const w = target.width
  const h = target.height
  const n = w * h
  if (targetCount + 1 > n) return null

  const targetCells = sortedOccupiedIndices(target)
  const occScratch: number[] = []

  const tryBoard = (
    B: FlingBoard,
  ): {
    board: FlingBoard
    forwardMove: { startCell: number; dx: number; dy: number }
  } | null => {
    for (let c = 0; c < B.cells.length; c++) {
      if (B.cells[c] < 0) continue
      for (const [dx, dy] of DIRS) {
        if (!canMove(B, c, dx, dy)) continue
        const C = cloneBoard(B)
        move(C, c, dx, dy)
        if (countOccupiedCells(C) !== targetCount) continue
        occScratch.length = 0
        for (let i = 0; i < C.cells.length; i++) {
          if (C.cells[i] >= 0) occScratch.push(i)
        }
        occScratch.sort((a, b) => a - b)
        if (sameSortedCells(occScratch, targetCells)) {
          return { board: B, forwardMove: { startCell: c, dx, dy } }
        }
      }
    }
    return null
  }

  const newId = maxPieceId(target) + 1
  for (let e = 0; e < target.cells.length; e++) {
    if (target.cells[e] >= 0) continue
    const B = cloneBoard(target)
    B.cells[e] = newId
    const hit = tryBoard(B)
    if (hit) return hit
  }

  const k = targetCount + 1
  const randomBudget = Math.min(maxAttempts, 480 + targetCount * 110)
  const scratch = new Int32Array(n)
  for (let attempt = 0; attempt < randomBudget; attempt++) {
    const positions = randomKSortedIndices(n, k, rng, scratch)
    if (!positions) continue
    const B = createBoard(w, h, positions)
    const hit = tryBoard(B)
    if (hit) return hit
  }

  return null
}

// ─── Main Generation: Forward Placement + DFS Solve ─────────────────

/**
 * Generate an N-ball Fling puzzle.
 *
 * Algorithm (forward generate-and-solve):
 *   1. Place N balls at random positions on the board.
 *   2. Reject placements trivially unsolvable (isolated or disconnected balls).
 *   3. Run a bounded DFS to find a winning move sequence.
 *   4. Repeat with fresh placements until a solvable board is found.
 *
 * Time complexity per attempt: O(S) where S ≤ maxSolverStates. The DFS
 * memoizes dead-end states so each unique board configuration is visited
 * at most once. Pre-filters reject ~50-80% of random placements cheaply
 * before the solver is invoked.
 */
export function generateLevel(
  width: number,
  height: number,
  ballCount: number,
  rng: () => number,
  options?: {
    roundTries?: number
    maxSolverStates?: number
    /**
     * When true, skip the `hasIsolatedBall` and `isConnected` pre-filters.
     *
     * The default filters reject configurations where any ball initially has
     * no row/column companions, assuming it can never participate in a move.
     * That assumption is WRONG: another ball can land in the isolated ball's
     * row/column after a previous move, enabling chain solutions like:
     *   A1 → A8 (stops A7) then A7 → G7 (A7 collinear with G7 after move 1).
     *
     * Use `skipPreFilters: true` when generating small-N non-collinear puzzles
     * where such "initially-isolated" configurations are valid.
     */
    skipPreFilters?: boolean
  },
): GeneratedLevel | null {
  if (ballCount < 1) throw new RangeError('ballCount')
  if (ballCount > width * height) return null

  if (ballCount === 1) {
    const board = randomOneBallBoard(width, height, rng)
    return { board: normalizeBoard(board), solution: [] }
  }

  const maxAttempts = options?.roundTries != null
    ? Math.max(2000, options.roundTries * 12)
    : 3000
  const maxSolverStates = options?.maxSolverStates ?? 200_000
  const usePreFilters = !options?.skipPreFilters
  const n = width * height
  const scratch = new Int32Array(n)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const positions = randomKSortedIndices(n, ballCount, rng, scratch)
    if (!positions) continue

    if (usePreFilters) {
      if (hasIsolatedBall(width, height, positions)) continue
      if (!isConnected(width, positions)) continue
    }

    const board = createBoard(width, height, positions)
    const solution = solveDFS(board, maxSolverStates)
    if (solution) {
      return { board: normalizeBoard(board), solution }
    }
  }

  return null
}
