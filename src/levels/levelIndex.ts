/** One "world" per ball count N ∈ [MIN_WORLD_BALLS, MAX_WORLD_BALLS] (15 worlds). */
export const MIN_WORLD_BALLS = 2
export const MAX_WORLD_BALLS = 16
export const STAGES_PER_WORLD = 5

export const WORLD_COUNT =
  MAX_WORLD_BALLS - MIN_WORLD_BALLS + 1

export const TOTAL_LEVEL_SLOTS = WORLD_COUNT * STAGES_PER_WORLD

export type WorldId = number
export type StageIndex = number

export function isWorldId(n: number): n is WorldId {
  return Number.isInteger(n) && n >= MIN_WORLD_BALLS && n <= MAX_WORLD_BALLS
}

export function isStageIndex(n: number): n is StageIndex {
  return Number.isInteger(n) && n >= 1 && n <= STAGES_PER_WORLD
}

/** Stable string id, e.g. "w7-s3" for world 7 stage 3 */
export function levelKey(world: WorldId, stage: StageIndex): string {
  if (!isWorldId(world)) throw new RangeError(`invalid world ${world}`)
  if (!isStageIndex(stage)) throw new RangeError(`invalid stage ${stage}`)
  return `w${world}-s${stage}`
}

export function parseLevelKey(key: string): { world: WorldId; stage: StageIndex } {
  const m = /^w(\d+)-s(\d+)$/.exec(key.trim())
  if (!m) throw new Error(`bad level key: ${key}`)
  const world = Number(m[1])
  const stage = Number(m[2])
  if (!isWorldId(world) || !isStageIndex(stage)) {
    throw new RangeError(`out of range level key: ${key}`)
  }
  return { world, stage }
}

/** Linear index 0..TOTAL_LEVEL_SLOTS-1 row-major: world 2 stage1, … world 2 stage5, world 3 … */
export function levelIndex(world: WorldId, stage: StageIndex): number {
  if (!isWorldId(world)) throw new RangeError(`invalid world ${world}`)
  if (!isStageIndex(stage)) throw new RangeError(`invalid stage ${stage}`)
  return (world - MIN_WORLD_BALLS) * STAGES_PER_WORLD + (stage - 1)
}

export function levelFromIndex(index: number): { world: WorldId; stage: StageIndex } {
  if (!Number.isInteger(index) || index < 0 || index >= TOTAL_LEVEL_SLOTS) {
    throw new RangeError(`index out of range: ${index}`)
  }
  const world = MIN_WORLD_BALLS + Math.floor(index / STAGES_PER_WORLD)
  const stage = (index % STAGES_PER_WORLD) + 1
  return { world, stage }
}
