import { describe, expect, it } from 'vitest'
import { buildCellAriaLabel } from './cellAriaLabel.js'

describe('buildCellAriaLabel', () => {
  it('describes empty cell', () => {
    expect(buildCellAriaLabel(0, 0, -1, 0, null)).toBe('格子 A1，空')
  })

  it('describes ball with color', () => {
    expect(buildCellAriaLabel(1, 2, 0, 15, null)).toMatch(/粉红色毛球/)
    expect(buildCellAriaLabel(1, 2, 0, 15, null)).not.toContain('已选中')
  })

  it('describes selected ball with color', () => {
    expect(buildCellAriaLabel(0, 0, 0, 0, 0)).toMatch(/已选中.*色毛球/)
  })
})
