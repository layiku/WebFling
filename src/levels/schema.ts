/**
 * Serialized level pack (pre-generated JSON). See docs/LEVEL_SPEC.md.
 */

export type LevelRecord = {
  /** e.g. w7-s3 */
  id: string
  /** Initial ball count N (equals world id for this project) */
  ballCount: number
  /** Optimal or packaged solution length under agreed move semantics */
  stepCount: number
  width: number
  height: number
  /** Initial occupancy: linear indices of each piece id 0..N-1 in row-major order */
  piecePositions: readonly number[]
  /** Move list for hints / validation */
  solution: readonly { startCell: number; dx: number; dy: number }[]
}

/** Production board dimensions — generator and validators must reference these. */
export const PRODUCTION_BOARD_W = 7
export const PRODUCTION_BOARD_H = 8

export type LevelPack = {
  rulesVersion: number
  /** ISO date or semver of the pack */
  generatedAt: string
  levels: LevelRecord[]
}
