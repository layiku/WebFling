/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyDocumentLocale,
  ballColorLocalized,
  documentTitle,
  getUiLocale,
  hintReasonMessage,
  loadFailurePrefix,
  loadingMessage,
  setUiLocale,
  uiMessages,
} from './i18n.js'

describe('i18n', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('getUiLocale returns zh when storage empty and navigator is zh', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    expect(getUiLocale()).toBe('zh')
  })

  it('getUiLocale returns en when storage empty and navigator is ja', () => {
    vi.stubGlobal('navigator', { language: 'ja-JP' })
    expect(getUiLocale()).toBe('en')
  })

  it('getUiLocale returns en when storage empty and navigator is en', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(getUiLocale()).toBe('en')
  })

  it('getUiLocale reads storage', () => {
    localStorage.setItem('fling-ui-locale', 'en')
    expect(getUiLocale()).toBe('en')
  })

  it('setUiLocale persists and applies html lang', () => {
    setUiLocale('en')
    expect(localStorage.getItem('fling-ui-locale')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    setUiLocale('zh')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('applyDocumentLocale sets lang', () => {
    applyDocumentLocale('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('documentTitle and loading strings', () => {
    expect(documentTitle('zh')).toBe('Fling Web')
    expect(loadingMessage('en')).toContain('Loading')
    expect(loadFailurePrefix('zh')).toContain('无法')
  })

  it('ballColorLocalized', () => {
    expect(ballColorLocalized('zh', 0)).toBe('粉红')
    expect(ballColorLocalized('en', 0)).toBe('pink')
  })

  it('uiMessages and hintReasonMessage', () => {
    const zh = uiMessages('zh')
    expect(zh.prevLevel).toBe('上一关')
    expect(zh.remainingBalls(3)).toContain('3')
    expect(hintReasonMessage('en', 'done')).toContain('No more')
  })
})
