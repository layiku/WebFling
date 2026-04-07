import { TOTAL_LEVEL_SLOTS } from '../levels/levelIndex.js'

/** localStorage 键；变更结构时请换新键并迁移或清档 */
export const PROGRESS_STORAGE_KEY = 'flinginc-progress-v1'

export type ProgressStateV1 = {
  version: 1
  /** 与关卡包一致；不一致时重置进度 */
  rulesVersion: number
  /** 上次打开的线性关卡下标 0..189 */
  lastLevelIndex: number
  /** 已通关的关卡下标（通关后解锁下一关） */
  cleared: number[]
}

export function createDefaultProgress(rulesVersion: number): ProgressStateV1 {
  return {
    version: 1,
    rulesVersion,
    lastLevelIndex: 0,
    cleared: [],
  }
}

export function loadProgress(
  storage: Pick<Storage, 'getItem'>,
  rulesVersion: number,
): ProgressStateV1 {
  const raw = storage.getItem(PROGRESS_STORAGE_KEY)
  if (!raw) return createDefaultProgress(rulesVersion)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return createDefaultProgress(rulesVersion)
    }
    const p = parsed as ProgressStateV1
    if (p.version !== 1 || p.rulesVersion !== rulesVersion) {
      return createDefaultProgress(rulesVersion)
    }
    if (!Array.isArray(p.cleared)) return createDefaultProgress(rulesVersion)
    const maxIdx = TOTAL_LEVEL_SLOTS - 1
    p.cleared = [...new Set(p.cleared)].filter(
      (n) => Number.isInteger(n) && n >= 0 && n <= maxIdx,
    )
    p.cleared.sort((a, b) => a - b)
    if (
      typeof p.lastLevelIndex !== 'number' ||
      !Number.isInteger(p.lastLevelIndex) ||
      p.lastLevelIndex < 0 ||
      p.lastLevelIndex > maxIdx
    ) {
      p.lastLevelIndex = 0
    }
    return p
  } catch {
    return createDefaultProgress(rulesVersion)
  }
}

/**
 * 持久化进度。`setItem` 在隐私模式或存储配额满时可能抛出 `QuotaExceededError` /
 * `SecurityError`——静默降级：进度仅在当前会话中有效，不中断游戏。
 */
export function saveProgress(
  storage: Pick<Storage, 'setItem'>,
  state: ProgressStateV1,
): void {
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储不可用（配额超限、隐私模式等）时静默忽略
  }
}

/** 第 `index` 关是否可进入：第 0 关始终可进；否则需已通关前一关 */
export function isLevelUnlocked(state: ProgressStateV1, index: number): boolean {
  if (index === 0) return true
  return state.cleared.includes(index - 1)
}

/** 通关：记录 cleared，并更新上次停留关 */
export function markLevelCleared(
  state: ProgressStateV1,
  index: number,
): ProgressStateV1 {
  if (state.cleared.includes(index)) {
    return { ...state, lastLevelIndex: index }
  }
  const cleared = [...state.cleared, index].sort((a, b) => a - b)
  return { ...state, cleared, lastLevelIndex: index }
}

export function setLastPlayed(
  state: ProgressStateV1,
  index: number,
): ProgressStateV1 {
  return { ...state, lastLevelIndex: index }
}

/** 与 `GameSession` 的胜负态一致，供导航逻辑使用 */
export type NavPhase = 'playing' | 'won' | 'lost'

/**
 * 胜利当帧须先把 `currentLevelIndex` 写入 `cleared`，再判断「下一关」是否解锁；
 * 若先判断再写入，则 `isLevelUnlocked(_, idx+1)` 会误判为未解锁。
 */
export function mergeWinIfNeeded(
  state: ProgressStateV1,
  currentLevelIndex: number,
  phase: NavPhase,
): { state: ProgressStateV1; merged: boolean } {
  if (phase !== 'won') return { state, merged: false }
  if (state.cleared.includes(currentLevelIndex)) return { state, merged: false }
  return { state: markLevelCleared(state, currentLevelIndex), merged: true }
}

/** 「下一关」是否应可点击（已合并胜利进度后的 `state`） */
export function isNextLevelEnabled(
  state: ProgressStateV1,
  currentLevelIndex: number,
  totalSlots: number,
): boolean {
  if (currentLevelIndex >= totalSlots - 1) return false
  return isLevelUnlocked(state, currentLevelIndex + 1)
}
