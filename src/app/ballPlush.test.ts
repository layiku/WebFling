import { describe, expect, it } from 'vitest'
import {
  BALL_COLOR_COUNT,
  ballColorIndex,
  ballColorName,
  ballPlushClass,
} from './ballPlush.js'

describe('ballPlush', () => {
  it('cycles 5 colors by piece id', () => {
    expect(ballColorIndex(0)).toBe(0)
    expect(ballColorIndex(4)).toBe(4)
    expect(ballColorIndex(5)).toBe(0)
    expect(ballColorIndex(7)).toBe(2)
  })

  it('handles negative ids defensively', () => {
    expect(ballColorIndex(-1)).toBe(4)
    expect(ballPlushClass(-1)).toBe('ball-plush--4')
  })

  it('exposes stable color names for aria', () => {
    expect(ballColorName(0)).toBe('粉红')
    expect(ballColorName(1)).toBe('天蓝')
    expect(BALL_COLOR_COUNT).toBe(5)
  })
})
