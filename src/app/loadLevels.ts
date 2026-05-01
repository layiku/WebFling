import { createBoard } from '../game/flingBoard.js'
import { verifySolution } from '../game/reverseGen.js'
import type { LevelPack, LevelRecord } from '../levels/schema.js'
import { PRODUCTION_BOARD_W, PRODUCTION_BOARD_H } from '../levels/schema.js'

function parseMoveStep(
  raw: unknown,
  ctx: string,
  boardSize: number,
): NonNullable<LevelRecord['solution']>[number] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${ctx}: step must be an object`)
  }
  const o = raw as Record<string, unknown>
  if (typeof o.startCell !== 'number' || !Number.isInteger(o.startCell)) {
    throw new Error(`${ctx}: invalid startCell`)
  }
  if (o.startCell < 0 || o.startCell >= boardSize) {
    throw new Error(
      `${ctx}: startCell ${o.startCell} out of range [0, ${boardSize})`,
    )
  }
  if (typeof o.dx !== 'number' || !Number.isInteger(o.dx)) {
    throw new Error(`${ctx}: invalid dx`)
  }
  if (typeof o.dy !== 'number' || !Number.isInteger(o.dy)) {
    throw new Error(`${ctx}: invalid dy`)
  }
  const ok4 =
    (Math.abs(o.dx) === 1 && o.dy === 0) || (Math.abs(o.dy) === 1 && o.dx === 0)
  if (!ok4) {
    throw new Error(`${ctx}: dx/dy must be a 4-way unit step`)
  }
  return { startCell: o.startCell, dx: o.dx, dy: o.dy }
}

/**
 * 校验并解析关卡包 JSON（供运行时加载与单元测试）。
 * @throws 结构或棋盘不合法时
 */
export function parseLevelPackData(data: unknown): LevelPack {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('loadLevelPack: response is not an object')
  }
  const o = data as Record<string, unknown>
  if (
    typeof o.rulesVersion !== 'number' ||
    !Number.isInteger(o.rulesVersion) ||
    o.rulesVersion < 1
  ) {
    throw new Error('loadLevelPack: invalid rulesVersion')
  }
  if (typeof o.generatedAt !== 'string') {
    throw new Error('loadLevelPack: generatedAt must be a string')
  }
  if (!Array.isArray(o.levels) || o.levels.length === 0) {
    throw new Error('loadLevelPack: levels must be a non-empty array')
  }
  const levels = o.levels.map((lev, i) => parseLevelRecord(lev, i))
  return {
    rulesVersion: o.rulesVersion,
    generatedAt: o.generatedAt,
    levels,
  }
}

function parseLevelRecord(raw: unknown, index: number): LevelRecord {
  const prefix = `levels[${index}]`
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${prefix}: not an object`)
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id.trim()) {
    throw new Error(`${prefix}: invalid id`)
  }
  if (
    typeof o.ballCount !== 'number' ||
    !Number.isInteger(o.ballCount) ||
    o.ballCount < 1
  ) {
    throw new Error(`${prefix}: invalid ballCount`)
  }
  if (
    typeof o.stepCount !== 'number' ||
    !Number.isInteger(o.stepCount) ||
    o.stepCount < 0
  ) {
    throw new Error(`${prefix}: invalid stepCount`)
  }
  if (typeof o.width !== 'number' || !Number.isInteger(o.width) || o.width < 1) {
    throw new Error(`${prefix}: invalid width`)
  }
  if (typeof o.height !== 'number' || !Number.isInteger(o.height) || o.height < 1) {
    throw new Error(`${prefix}: invalid height`)
  }
  if (o.width !== PRODUCTION_BOARD_W || o.height !== PRODUCTION_BOARD_H) {
    throw new Error(`${prefix}: dimensions must be ${PRODUCTION_BOARD_W}×${PRODUCTION_BOARD_H}`)
  }
  if (!Array.isArray(o.piecePositions)) {
    throw new Error(`${prefix}: piecePositions must be an array`)
  }
  if (o.piecePositions.length !== o.ballCount) {
    throw new Error(`${prefix}: piecePositions.length must equal ballCount`)
  }
  for (let i = 0; i < o.piecePositions.length; i++) {
    const p = o.piecePositions[i]
    if (typeof p !== 'number' || !Number.isInteger(p)) {
      throw new Error(`${prefix}: piecePositions[${i}] must be an integer`)
    }
  }
  try {
    createBoard(o.width, o.height, o.piecePositions as number[])
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${prefix}: invalid piecePositions (${msg})`)
  }

  let solution: LevelRecord['solution'] | undefined = undefined
  if (o.solution === undefined) {
    throw new Error(`${prefix}: solution is required`)
  }
  if (!Array.isArray(o.solution)) {
    throw new Error(`${prefix}: solution must be an array`)
  }
  const boardSize = (o.width as number) * (o.height as number)
  solution = o.solution.map((step, j) =>
    parseMoveStep(step, `${prefix}.solution[${j}]`, boardSize),
  )

  const actualStepCount = solution.length
  if (o.stepCount !== actualStepCount) {
    throw new Error(
      `${prefix}: stepCount (${o.stepCount}) != solution.length (${actualStepCount})`,
    )
  }

  // 重放整条 solution，确认每步均合法且最终只剩 1 个球
  if (solution.length > 0) {
    const board = createBoard(o.width, o.height, o.piecePositions as number[])
    if (!verifySolution(board, solution)) {
      throw new Error(`${prefix}: solution replay failed (illegal move or wrong end state)`)
    }
  }

  return {
    id: o.id,
    ballCount: o.ballCount,
    stepCount: o.stepCount,
    width: o.width,
    height: o.height,
    piecePositions: o.piecePositions as readonly number[],
    solution,
  }
}

/**
 * 运行时加载预生成的关卡包（默认 `public/levels.json` → `/levels.json`）。
 */
export async function loadLevelPack(url = '/levels.json'): Promise<LevelPack> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`loadLevelPack: HTTP ${res.status} ${res.statusText}`)
    }
    const data = (await res.json()) as unknown
    return parseLevelPackData(data)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`loadLevelPack: request timed out (${url})`)
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}
