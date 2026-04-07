import { describe, expect, it } from 'vitest'
import { TOTAL_LEVEL_SLOTS } from '../levels/levelIndex.js'
import {
  PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  isLevelUnlocked,
  isNextLevelEnabled,
  loadProgress,
  markLevelCleared,
  mergeWinIfNeeded,
  saveProgress,
  setLastPlayed,
} from './progress.js'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

/** setItem 始终抛出（模拟隐私模式 / 存储配额满） */
class ThrowingStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  getItem(_key: string): null {
    return null
  }
  setItem(_key: string, _value: string): void {
    throw new DOMException('QuotaExceededError', 'QuotaExceededError')
  }
}

describe('progress', () => {
  it('defaults and round-trips', () => {
    const mem = new MemoryStorage()
    const a = createDefaultProgress(1)
    expect(a.cleared).toEqual([])
    expect(isLevelUnlocked(a, 0)).toBe(true)
    expect(isLevelUnlocked(a, 1)).toBe(false)
    saveProgress(mem, a)
    const b = loadProgress(mem, 1)
    expect(b.lastLevelIndex).toBe(0)
    expect(b.rulesVersion).toBe(1)
  })

  it('markLevelCleared unlocks next', () => {
    let s = createDefaultProgress(1)
    s = markLevelCleared(s, 0)
    expect(s.cleared).toContain(0)
    expect(isLevelUnlocked(s, 1)).toBe(true)
    s = markLevelCleared(s, 1)
    expect(isLevelUnlocked(s, 2)).toBe(true)
  })

  it('resets when rulesVersion mismatches', () => {
    const mem = new MemoryStorage()
    saveProgress(mem, { ...createDefaultProgress(1), lastLevelIndex: 5 })
    const s = loadProgress(mem, 2)
    expect(s.lastLevelIndex).toBe(0)
    expect(s.cleared).toEqual([])
  })

  it('resets when stored JSON is not an object', () => {
    const mem = new MemoryStorage()
    mem.setItem(PROGRESS_STORAGE_KEY, '[1,2,3]')
    const s = loadProgress(mem, 1)
    expect(s.cleared).toEqual([])
  })

  it('drops cleared indices outside 0..TOTAL-1 and clamps lastLevelIndex', () => {
    const mem = new MemoryStorage()
    mem.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        rulesVersion: 1,
        lastLevelIndex: 999,
        // TOTAL_LEVEL_SLOTS is now 75, so valid range is 0..74
        cleared: [-1, 0, 500, 74],
      }),
    )
    const s = loadProgress(mem, 1)
    expect(s.cleared).toEqual([0, 74])
    expect(s.lastLevelIndex).toBe(0)
  })

  it('setLastPlayed updates index', () => {
    let s = createDefaultProgress(1)
    s = setLastPlayed(s, 12)
    expect(s.lastLevelIndex).toBe(12)
  })

  it('uses PROGRESS_STORAGE_KEY', () => {
    expect(PROGRESS_STORAGE_KEY.length).toBeGreaterThan(3)
  })

  it('saveProgress does not throw when storage quota is exceeded', () => {
    const s = createDefaultProgress(1)
    expect(() => saveProgress(new ThrowingStorage(), s)).not.toThrow()
  })
})

const TOTAL = TOTAL_LEVEL_SLOTS

describe('胜利后「下一关」导航（回归：须先 merge 再判断解锁）', () => {
  it('未通关当前槽位时，下一关按钮应禁用', () => {
    const s = createDefaultProgress(1)
    expect(isNextLevelEnabled(s, 0, TOTAL)).toBe(false)
  })

  it('mergeWinIfNeeded(won) 写入 cleared 后，下一关按钮应变可点', () => {
    let s = createDefaultProgress(1)
    const r = mergeWinIfNeeded(s, 0, 'won')
    expect(r.merged).toBe(true)
    s = r.state
    expect(s.cleared).toContain(0)
    expect(isNextLevelEnabled(s, 0, TOTAL)).toBe(true)
  })

  it('playing 态不写入 cleared', () => {
    let s = createDefaultProgress(1)
    const r = mergeWinIfNeeded(s, 0, 'playing')
    expect(r.merged).toBe(false)
    expect(r.state.cleared).toEqual([])
  })

  it('已记录通关时再次 won 不重复 merge', () => {
    let s = createDefaultProgress(1)
    s = markLevelCleared(s, 0)
    const r = mergeWinIfNeeded(s, 0, 'won')
    expect(r.merged).toBe(false)
  })

  it('最后一关无下一关', () => {
    const s = createDefaultProgress(1)
    expect(isNextLevelEnabled(s, TOTAL - 1, TOTAL)).toBe(false)
  })

  it('反例：若未调用 merge 仅用初始 state 判断，会误判下一关锁死', () => {
    const fresh = createDefaultProgress(1)
    expect(isLevelUnlocked(fresh, 1)).toBe(false)
    const afterMerge = mergeWinIfNeeded(fresh, 0, 'won').state
    expect(isLevelUnlocked(afterMerge, 1)).toBe(true)
  })
})
