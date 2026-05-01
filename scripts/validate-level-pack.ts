/**
 * Validates public/levels.json (structure, ids, monotonic steps, solution replay).
 * Run: npm run levels:validate
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { countBalls, createBoard } from '../src/game/flingBoard.js'
import {
  MAX_WORLD_BALLS,
  MIN_WORLD_BALLS,
  STAGES_PER_WORLD,
  TOTAL_LEVEL_SLOTS,
  levelKey,
  parseLevelKey,
} from '../src/levels/levelIndex.js'
import type { LevelPack, LevelRecord } from '../src/levels/schema.js'
import { PRODUCTION_BOARD_W, PRODUCTION_BOARD_H } from '../src/levels/schema.js'
import { replaySolution, verifySolution } from '../src/game/reverseGen.js'

const __dir = dirname(fileURLToPath(import.meta.url))

export type ValidateResult =
  | { ok: true }
  | { ok: false; errors: string[] }

function validatePositions(lev: LevelRecord): string[] {
  const errs: string[] = []
  const cells = lev.width * lev.height
  const seen = new Set<number>()
  if (lev.piecePositions.length !== lev.ballCount) {
    errs.push(`${lev.id}: piecePositions.length !== ballCount`)
  }
  for (const p of lev.piecePositions) {
    if (p < 0 || p >= cells) {
      errs.push(`${lev.id}: bad position ${p}`)
    }
    if (seen.has(p)) {
      errs.push(`${lev.id}: duplicate position ${p}`)
    }
    seen.add(p)
  }
  return errs
}

/**
 * @param expectedLevelCount — default TOTAL_LEVEL_SLOTS (75); use smaller when validating partial packs in tests.
 */
export function validateLevelPack(
  pack: LevelPack,
  expectedLevelCount: number = TOTAL_LEVEL_SLOTS,
): ValidateResult {
  const errors: string[] = []

  if (typeof pack.rulesVersion !== 'number' || pack.rulesVersion < 1) {
    errors.push('rulesVersion must be >= 1')
  }
  if (!Array.isArray(pack.levels)) {
    errors.push('levels must be an array')
    return { ok: false, errors }
  }
  if (pack.levels.length !== expectedLevelCount) {
    errors.push(
      `expected ${expectedLevelCount} levels, got ${pack.levels.length}`,
    )
  }

  const seenId = new Set<string>()

  for (const lev of pack.levels) {
    if (seenId.has(lev.id)) {
      errors.push(`duplicate id: ${lev.id}`)
    }
    seenId.add(lev.id)

    let world: number
    try {
      const p = parseLevelKey(lev.id)
      world = p.world
    } catch {
      errors.push(`invalid id: ${lev.id}`)
      continue
    }

    if (lev.ballCount !== world) {
      errors.push(`${lev.id}: ballCount ${lev.ballCount} !== world ${world}`)
    }
    if (lev.stepCount !== (lev.solution?.length ?? -999)) {
      errors.push(
        `${lev.id}: stepCount ${lev.stepCount} !== solution.length ${lev.solution?.length ?? 'missing'}`,
      )
    }

    errors.push(...validatePositions(lev))

    if (lev.width !== PRODUCTION_BOARD_W || lev.height !== PRODUCTION_BOARD_H) {
      errors.push(`${lev.id}: dimensions must be ${PRODUCTION_BOARD_W}×${PRODUCTION_BOARD_H}`)
    }

    if (lev.solution && lev.solution.length > 0) {
      try {
        const b = createBoard(lev.width, lev.height, lev.piecePositions)
        if (countBalls(b) !== lev.ballCount) {
          errors.push(`${lev.id}: board ball count mismatch`)
        }
        if (!verifySolution(b, lev.solution)) {
          errors.push(`${lev.id}: verifySolution failed`)
        }
        const fin = replaySolution(
          lev.width,
          lev.height,
          lev.piecePositions,
          lev.solution,
        )
        if (countBalls(fin) !== 1) {
          errors.push(`${lev.id}: after solution expected 1 ball, got ${countBalls(fin)}`)
        }
      } catch (e) {
        errors.push(
          `${lev.id}: replay error: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    } else {
      errors.push(`${lev.id}: missing or empty solution`)
    }
  }

  const byWorld = new Map<number, LevelRecord[]>()
  for (const lev of pack.levels) {
    try {
      const { world } = parseLevelKey(lev.id)
      if (!byWorld.has(world)) byWorld.set(world, [])
      byWorld.get(world)!.push(lev)
    } catch {
      /* already flagged */
    }
  }

  const completeWorlds = Math.floor(expectedLevelCount / STAGES_PER_WORLD)

  for (let wi = 0; wi < completeWorlds; wi++) {
    const w = MIN_WORLD_BALLS + wi
    const list = byWorld.get(w)
    if (!list || list.length !== STAGES_PER_WORLD) {
      errors.push(
        `world ${w}: expected ${STAGES_PER_WORLD} levels, got ${list?.length ?? 0}`,
      )
      continue
    }
    const sorted = [...list].sort(
      (a, b) => parseLevelKey(a.id).stage - parseLevelKey(b.id).stage,
    )
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.stepCount < sorted[i - 1]!.stepCount) {
        errors.push(
          `world ${w}: stepCount not non-decreasing between stages`,
        )
        break
      }
    }
  }

  if (expectedLevelCount === TOTAL_LEVEL_SLOTS) {
    const want = new Set<string>()
    for (let w = MIN_WORLD_BALLS; w <= MAX_WORLD_BALLS; w++) {
      for (let s = 1; s <= STAGES_PER_WORLD; s++) {
        want.add(levelKey(w, s))
      }
    }
    for (const id of want) {
      if (!seenId.has(id)) {
        errors.push(`missing level id: ${id}`)
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

function main(): void {
  const path = join(__dir, '..', 'public', 'levels.json')
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    console.error(`validate-level-pack: cannot read file: ${path}`)
    process.exit(1)
  }
  let pack: LevelPack
  try {
    pack = JSON.parse(raw) as LevelPack
  } catch {
    console.error('validate-level-pack: levels.json is not valid JSON')
    process.exit(1)
  }
  let r: ValidateResult
  try {
    r = validateLevelPack(pack)
  } catch (e) {
    console.error(
      `validate-level-pack: unexpected error during validation: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exit(1)
  }
  if (!r.ok) {
    for (const e of r.errors) {
      console.error(e)
    }
    process.exit(1)
  }
  console.log(`levels OK (${pack.levels.length} levels)`)
}

if (!process.env['VITEST']) {
  main()
}
