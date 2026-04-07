import { describe, expect, it } from 'vitest'
import { buildCellAriaLabel } from './cellAriaLabel.js'

describe('buildCellAriaLabel', () => {
  it('describes empty cell (zh)', () => {
    expect(buildCellAriaLabel(0, 0, -1, 0, null, 'zh')).toBe('格子 A1，空')
  })

  it('describes empty cell (en)', () => {
    expect(buildCellAriaLabel(0, 0, -1, 0, null, 'en')).toBe('Cell A1, empty')
  })

  it('describes ball with color (zh)', () => {
    expect(buildCellAriaLabel(1, 2, 0, 15, null, 'zh')).toMatch(/粉红色毛球/)
    expect(buildCellAriaLabel(1, 2, 0, 15, null, 'zh')).not.toContain('已选中')
  })

  it('describes selected ball with color (zh)', () => {
    expect(buildCellAriaLabel(0, 0, 0, 0, 0, 'zh')).toMatch(/已选中.*色毛球/)
  })

  it('describes ball in English', () => {
    expect(buildCellAriaLabel(0, 0, 0, 0, null, 'en')).toContain('pink plush ball')
  })
})
