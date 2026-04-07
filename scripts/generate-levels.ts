/**
 * Offline level generator: 75 fixed levels (15 worlds × 5 stages).
 * Board is fixed at 7 × 8.
 * Run: npm run levels:generate
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  boardToPiecePositions,
  generateLevel,
  mulberry32,
  type GeneratedLevel,
} from '../src/game/reverseGen.js'
import {
  MAX_WORLD_BALLS,
  MIN_WORLD_BALLS,
  STAGES_PER_WORLD,
  levelKey,
} from '../src/levels/levelIndex.js'
import type { LevelPack, LevelRecord } from '../src/levels/schema.js'

const __dir = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_MASTER_SEED = 0xf11c002

/** All levels use a fixed 7 × 8 board. */
export const BOARD_W = 7
export const BOARD_H = 8

// ─── Similarity helpers ──────────────────────────────────────────────

type Coord = [number, number]

/** Convert linear positions on a board of width `w` to (col, row) tuples. */
function toCoords(positions: readonly number[], w: number): Coord[] {
  return positions.map((p) => [p % w, Math.floor(p / w)])
}

/** Translate coords so the minimum x and y are 0. */
function normalize(coords: Coord[]): Coord[] {
  const minX = Math.min(...coords.map((c) => c[0]))
  const minY = Math.min(...coords.map((c) => c[1]))
  return coords.map((c) => [c[0] - minX, c[1] - minY])
}

/** Serialize sorted coords as a string for Set / Map lookup. */
function coordKey(coords: Coord[]): string {
  return coords
    .map((c) => `${c[0]},${c[1]}`)
    .sort()
    .join(';')
}

/**
 * Canonical form under the 8 symmetries of a rectangle (4 rotations × 2 reflections).
 * Picks the lexicographically smallest serialized form.
 */
export function canonicalForm(positions: readonly number[], w: number): string {
  const coords = toCoords(positions, w)
  const maxX = Math.max(...coords.map((c) => c[0]))
  const maxY = Math.max(...coords.map((c) => c[1]))

  const transforms: ((c: Coord, mx: number, my: number) => Coord)[] = [
    (c) => [c[0], c[1]],
    (c, mx) => [mx - c[0], c[1]],
    (c, _mx, my) => [c[0], my - c[1]],
    (c, mx, my) => [mx - c[0], my - c[1]],
    (c) => [c[1], c[0]],
    (c, _mx, my) => [my - c[1], c[0]],
    (c, mx) => [c[1], mx - c[0]],
    (c, mx, my) => [my - c[1], mx - c[0]],
  ]

  let best = ''
  for (const fn of transforms) {
    const mapped = coords.map((c) => fn(c, maxX, maxY))
    const k = coordKey(normalize(mapped))
    if (best === '' || k < best) best = k
  }
  return best
}

/**
 * Sorted list of all pairwise Manhattan distances between balls.
 * Two levels with the same signature have identical inter-ball spacing structure.
 */
export function pairwiseDistanceSig(
  positions: readonly number[],
  w: number,
): string {
  const coords = toCoords(positions, w)
  const dists: number[] = []
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      dists.push(
        Math.abs(coords[i]![0] - coords[j]![0]) +
          Math.abs(coords[i]![1] - coords[j]![1]),
      )
    }
  }
  dists.sort((a, b) => a - b)
  return dists.join(',')
}

/**
 * Sorted row-count and column-count distribution.
 * Captures how balls are spread across rows/columns independent of exact positions.
 */
export function rowColFingerprint(
  positions: readonly number[],
  w: number,
  h: number,
): string {
  const rows = new Array<number>(h).fill(0)
  const cols = new Array<number>(w).fill(0)
  for (const p of positions) {
    rows[Math.floor(p / w)]!++
    cols[p % w]!++
  }
  const sr = [...rows].sort((a, b) => b - a).join(',')
  const sc = [...cols].sort((a, b) => b - a).join(',')
  return `${sr}|${sc}`
}

/**
 * Jaccard similarity on relative-coordinate string sets.
 * Measures the overlap ratio of relative position patterns.
 */
export function jaccardSimilarity(
  posA: readonly number[],
  wA: number,
  posB: readonly number[],
  wB: number,
): number {
  const setA = new Set(normalize(toCoords(posA, wA)).map((c) => `${c[0]},${c[1]}`))
  const setB = new Set(normalize(toCoords(posB, wB)).map((c) => `${c[0]},${c[1]}`))
  let inter = 0
  for (const k of setA) if (setB.has(k)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 1 : inter / union
}

/**
 * Dynamic Jaccard rejection threshold based on ball count.
 *
 * For small N, any two N-ball layouts that share (N-1) relative positions
 * already have Jaccard ≥ (N-1)/(N+1). Setting a fixed low threshold would
 * cause almost all candidates to be rejected. We scale up the threshold
 * for small worlds so only near-identical layouts are filtered out.
 *
 * N ≤ 3 → 0.85   N=4 → 0.72   N=5 → 0.60   N=6 → 0.52   N ≥ 7 → 0.44
 */
export function dynamicJaccardThreshold(ballCount: number): number {
  if (ballCount <= 3) return 0.85
  if (ballCount === 4) return 0.72
  if (ballCount === 5) return 0.60
  if (ballCount === 6) return 0.52
  return 0.44
}

/**
 * Check if a candidate is too similar to any already-accepted level.
 * Checks (in order of cheapness):
 *   1. Same canonical form (equivalent under translation/rotation/reflection)
 *   2. Jaccard on relative coords > world-scaled threshold
 *   3. Same pairwise distance signature AND Jaccard > half-threshold
 *      (catches near-identical spacing without being overly aggressive)
 */
export function isTooSimilar(
  candidate: GeneratedLevel,
  accepted: GeneratedLevel[],
): boolean {
  const cPos = boardToPiecePositions(candidate.board)
  const cW = candidate.board.width
  const n = cPos.length
  const cCanon = canonicalForm(cPos, cW)
  const cDistSig = pairwiseDistanceSig(cPos, cW)
  const threshold = dynamicJaccardThreshold(n)

  for (const a of accepted) {
    const aPos = boardToPiecePositions(a.board)
    const aW = a.board.width

    if (canonicalForm(aPos, aW) === cCanon) return true
    const j = jaccardSimilarity(cPos, cW, aPos, aW)
    if (j > threshold) return true
    // Same distance structure + moderately high overlap → reject
    if (pairwiseDistanceSig(aPos, aW) === cDistSig && j > threshold * 0.6)
      return true
  }
  return false
}

// ─── Collinearity check ──────────────────────────────────────────────

/**
 * Returns true if all balls share the same row OR the same column.
 * Used to enforce at most 1 "all collinear" stage per world 2/3/4.
 */
export function allBallsCollinear(
  positions: readonly number[],
  w: number,
): boolean {
  if (positions.length < 2) return true
  const rows = new Set(positions.map((p) => Math.floor(p / w)))
  if (rows.size === 1) return true
  const cols = new Set(positions.map((p) => p % w))
  return cols.size === 1
}

// ─── Level collection per world ─────────────────────────────────────

export function collectLevelsForWorld(
  world: number,
  masterSeed: number,
): GeneratedLevel[] {
  const accepted: GeneratedLevel[] = []
  // Track how many accepted levels have all balls in a straight line
  let collinearCount = 0
  // Cap: at most 1 "all-collinear" stage per world, for worlds 3, 4, and 5.
  //
  // Background: the DFS pre-filters (`hasIsolatedBall` / `isConnected`) were
  // previously too aggressive, rejecting non-collinear solvable configurations
  // where an initially-isolated ball becomes reachable after another ball moves
  // into its row/column. After fixing the DFS (isolation pruning only when 2
  // balls remain), non-collinear 3/4-ball puzzles are now discoverable.
  //
  // World 2 (2 balls): all solvable layouts are collinear by definition.
  // Worlds 3, 4, 5 (3/4/5 balls): non-collinear solvable layouts exist and are
  //   common (~80%). Cap = 1 ensures variety.
  // World 6+ (6+ balls): predominantly non-collinear; cap = 1 applies similarly.
  const collinearCap = world >= 3 ? 1 : Infinity

  let seedSlot = 0
  // World 2 (2 balls): all solvable layouts are collinear by definition,
  // and there are few enough distinct placements to skip dedup entirely.
  const skipDedup = world === 2

  // Retry budget: fixed board → grow loop just retries with fresh seeds
  const totalBudget = STAGES_PER_WORLD * 400 + world * 200
  const attemptsPerCall = 600 + world * 60
  const maxStates = 200_000

  for (let batch = 0; batch < 12; batch++) {
    console.error(
      `[levelgen] world ${world} board=${BOARD_W}x${BOARD_H} (attempt batch ${batch}) have ${accepted.length}/${STAGES_PER_WORLD} …`,
    )

    const batchSize = Math.max(
      STAGES_PER_WORLD * 8,
      Math.ceil(totalBudget / 12),
    )

    for (
      let t = 0;
      t < batchSize && accepted.length < STAGES_PER_WORLD;
      t++
    ) {
      const rng = mulberry32(
        masterSeed + world * 1_000_003 + seedSlot * 1_315_423_911,
      )
      seedSlot++

      // When the collinear cap is already reached, use skipPreFilters so the
      // DFS can explore "initially-isolated-ball" L-shape configurations that
      // are solvable but filtered out by the static pre-filters.
      const needNonCollinear = collinearCount >= collinearCap
      const g = generateLevel(BOARD_W, BOARD_H, world, rng, {
        roundTries: attemptsPerCall,
        maxSolverStates: maxStates,
        skipPreFilters: needNonCollinear && world <= 5,
      })
      if (!g) continue

      const pos = boardToPiecePositions(g.board)
      const isCollinear = allBallsCollinear(pos, BOARD_W)

      // Enforce collinearity cap
      if (isCollinear && collinearCount >= collinearCap) continue

      if (!skipDedup && isTooSimilar(g, accepted)) continue

      if (isCollinear) collinearCount++
      accepted.push(g)
    }

    if (accepted.length >= STAGES_PER_WORLD) break
  }


  if (accepted.length < STAGES_PER_WORLD) {
    throw new Error(
      `generate-levels: could not collect ${STAGES_PER_WORLD} distinct candidates for world ${world}`,
    )
  }

  // Sort by solution length so stages go from easy to hard
  accepted.sort((a, b) => a.solution.length - b.solution.length)
  return accepted.slice(0, STAGES_PER_WORLD)
}

export function buildPack(masterSeed: number): LevelPack {
  const levels: LevelRecord[] = []
  const maxWorld = Number(process.env['LEVELGEN_MAX_WORLD'] ?? MAX_WORLD_BALLS)
  const hi = Number.isFinite(maxWorld)
    ? Math.min(MAX_WORLD_BALLS, Math.max(MIN_WORLD_BALLS, Math.floor(maxWorld)))
    : MAX_WORLD_BALLS

  for (let world = MIN_WORLD_BALLS; world <= hi; world++) {
    console.error(`[levelgen] world ${world}/${hi} …`)
    const gens = collectLevelsForWorld(world, masterSeed)
    for (let stage = 1; stage <= STAGES_PER_WORLD; stage++) {
      const gen = gens[stage - 1]!
      levels.push({
        id: levelKey(world, stage),
        ballCount: world,
        stepCount: gen.solution.length,
        width: gen.board.width,
        height: gen.board.height,
        piecePositions: boardToPiecePositions(gen.board),
        solution: gen.solution,
      })
    }
  }

  return {
    rulesVersion: 1,
    generatedAt: new Date().toISOString(),
    levels,
  }
}

export function createEmptyPack(): LevelPack {
  return {
    rulesVersion: 1,
    generatedAt: new Date().toISOString(),
    levels: [],
  }
}

function main(): void {
  const masterSeed =
    Number(process.env['LEVELGEN_SEED'] ?? DEFAULT_MASTER_SEED) >>> 0
  const pack = buildPack(masterSeed)
  const out = join(__dir, '..', 'public', 'levels.json')
  writeFileSync(out, JSON.stringify(pack, null, 2), 'utf8')
  console.log(
    `Wrote ${out} (${pack.levels.length} levels, seed=${masterSeed})`,
  )
}

if (!process.env['VITEST']) {
  main()
}
