/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest'
import { renderLoadFailure } from './renderLoadFailure.js'

describe('renderLoadFailure', () => {
  it('uses textContent so HTML in the message is not interpreted', () => {
    localStorage.setItem('fling-ui-locale', 'zh')
    const root = document.createElement('div')
    const malicious = '<img src=x onerror="window.__xss=1">'
    renderLoadFailure(root, malicious)
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('<img')
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined()
  })

  it('renders shell and muted paragraph', () => {
    localStorage.setItem('fling-ui-locale', 'zh')
    const root = document.createElement('div')
    renderLoadFailure(root, 'network')
    const main = root.querySelector('main.shell')
    expect(main).not.toBeNull()
    const p = root.querySelector('p.muted')
    expect(p?.textContent).toBe('无法加载关卡：network')
  })
})
