import { describe, expect, it, vi } from 'vitest'
import type { LevelPack } from '../levels/schema.js'
import { loadLevelPack, parseLevelPackData } from './loadLevels.js'

describe('parseLevelPackData', () => {
  it('rejects non-object root', () => {
    expect(() => parseLevelPackData(null)).toThrow(/not an object/)
    expect(() => parseLevelPackData([])).toThrow(/not an object/)
  })

  it('rejects missing generatedAt', () => {
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        levels: [{ id: 'x', ballCount: 1, stepCount: 0, width: 1, height: 1, piecePositions: [0] }],
      }),
    ).toThrow(/generatedAt/)
  })

  it('rejects invalid piece layout', () => {
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        generatedAt: '',
        levels: [
          {
            id: 'bad',
            ballCount: 2,
            stepCount: 1,
            width: 7,
            height: 8,
            piecePositions: [0, 0],
          },
        ],
      }),
    ).toThrow(/duplicate/)
  })

  it('rejects bad solution step direction', () => {
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        generatedAt: '',
        levels: [
          {
            id: 'a',
            ballCount: 1,
            stepCount: 0,
            width: 7,
            height: 8,
            piecePositions: [0],
            solution: [{ startCell: 0, dx: 1, dy: 1 }],
          },
        ],
      }),
    ).toThrow(/4-way/)
  })

  it('rejects solution step with startCell out of board range', () => {
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        generatedAt: '',
        levels: [
          {
            id: 'a',
            ballCount: 2,
            stepCount: 1,
            width: 7,
            height: 8,
            piecePositions: [0, 8],
            solution: [{ startCell: 99, dx: 1, dy: 0 }],
          },
        ],
      }),
    ).toThrow(/out of range/)
  })

  it('rejects stepCount that does not match solution length', () => {
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        generatedAt: '',
        levels: [
          {
            id: 'a',
            ballCount: 2,
            stepCount: 3,
            width: 7,
            height: 8,
            piecePositions: [0, 8],
            solution: [{ startCell: 0, dx: 1, dy: 0 }],
          },
        ],
      }),
    ).toThrow(/stepCount/)
  })

  it('rejects solution that is structurally valid but contains an illegal move sequence', () => {
    // startCell=0 向右可以移动（格局合法），但执行后不会只剩 1 个球（ballCount=3，stepCount=1 不够）
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        generatedAt: '',
        levels: [
          {
            id: 'bad-replay',
            ballCount: 3,
            stepCount: 1,
            width: 7,
            height: 8,
            piecePositions: [0, 2, 4],
            // 只走一步无法把 3 个球消到 1 个，verifySolution 返回 false
            solution: [{ startCell: 0, dx: 1, dy: 0 }],
          },
        ],
      }),
    ).toThrow(/solution replay failed/)
  })

  it('rejects when solution is absent', () => {
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        generatedAt: '',
        levels: [
          {
            id: 'a',
            ballCount: 2,
            stepCount: 1,
            width: 7,
            height: 8,
            piecePositions: [0, 8],
          },
        ],
      }),
    ).toThrow(/solution is required/)
  })

  it('rejects non-7×8 dimensions', () => {
    expect(() =>
      parseLevelPackData({
        rulesVersion: 1,
        generatedAt: '',
        levels: [
          {
            id: 'a',
            ballCount: 2,
            stepCount: 1,
            width: 5,
            height: 5,
            piecePositions: [0, 4],
            solution: [{ startCell: 0, dx: 1, dy: 0 }],
          },
        ],
      }),
    ).toThrow(/dimensions/)
  })
})

describe('loadLevelPack', () => {
  it('parses JSON from fetch', async () => {
    const pack: LevelPack = {
      rulesVersion: 1,
      generatedAt: 'x',
      levels: [
        {
          id: 'w2-s1',
          ballCount: 2,
          stepCount: 1,
          width: 7,
          height: 8,
          piecePositions: [0, 2],
          solution: [{ startCell: 0, dx: 1, dy: 0 }],
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pack,
      }),
    )
    const out = await loadLevelPack('/test-levels.json')
    expect(out.rulesVersion).toBe(1)
    expect(out.levels).toHaveLength(1)
    expect(out.levels[0]!.id).toBe('w2-s1')
    vi.unstubAllGlobals()
  })

  it('throws on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'N' }),
    )
    await expect(loadLevelPack()).rejects.toThrow('HTTP 404')
    vi.unstubAllGlobals()
  })

  it('throws descriptive error on timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      }),
    )
    const promise = loadLevelPack('/slow.json')
    // Prevent unhandled rejection warning
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(16_000)
    await expect(promise).rejects.toThrow(/timed out/)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})
