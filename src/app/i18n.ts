/**
 * UI 文案：中文 / 英文。语言偏好存 `localStorage`（键 `fling-ui-locale`）。
 */

export type UiLocale = 'zh' | 'en'

const STORAGE_KEY = 'fling-ui-locale'

export function getUiLocale(): UiLocale {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'en' || s === 'zh') return s
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const nav = navigator.language.toLowerCase()
    if (nav.startsWith('en')) return 'en'
    if (nav.startsWith('zh')) return 'zh'
  }
  return 'en'
}

export function setUiLocale(locale: UiLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  applyDocumentLocale(locale)
}

/** 设置 `<html lang>`，供无障碍与字体回退 */
export function applyDocumentLocale(locale: UiLocale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
}

export function documentTitle(locale: UiLocale): string {
  return locale === 'zh' ? 'Fling Web' : 'Fling Web'
}

export function loadingMessage(locale: UiLocale): string {
  return locale === 'zh' ? '加载关卡…' : 'Loading levels…'
}

export function loadFailurePrefix(locale: UiLocale): string {
  return locale === 'zh' ? '无法加载关卡：' : 'Failed to load levels: '
}

/** 棋子颜色名（与 ballPlush 下标 0..4 对应） */
export function ballColorLocalized(locale: UiLocale, colorIndex: number): string {
  const i = ((colorIndex % 5) + 5) % 5
  const zh = ['粉红', '天蓝', '草绿', '明黄', '淡紫'] as const
  const en = ['pink', 'sky blue', 'green', 'yellow', 'purple'] as const
  return locale === 'zh' ? zh[i]! : en[i]!
}

export type UiMessages = {
  subtitle: string
  prevLevel: string
  nextLevel: string
  undo: string
  restart: string
  hintStep: string
  bottomHint: string
  statusWon: string
  statusLost: string
  remainingBalls: (n: number) => string
  levelLabel: (world: number, stage: number, id: string) => string
  hintNoSolution: string
  hintOffPath: string
  hintDone: string
  hintNotPlaying: string
  hintIllegal: string
  langButtonShowEn: string
  langButtonShowZh: string
  langSwitchAria: string
}

const messages: Record<UiLocale, UiMessages> = {
  zh: {
    subtitle: '彩色圆形毛绒球（5 色循环）',
    prevLevel: '上一关',
    nextLevel: '下一关',
    undo: '撤销',
    restart: '重开',
    hintStep: '提示一步',
    bottomHint:
      '点选毛球后，用方向键或滑动发射；仅当与 HOG2 规则一致时可走。',
    statusWon: '胜利：只剩一球',
    statusLost: '无效局面（0 球）— 请撤销或重开',
    remainingBalls: (n) => `剩余 ${n} 球`,
    levelLabel: (world, stage, id) =>
      `第 ${world} 大关 · 第 ${stage} 小关 · ${id}`,
    hintNoSolution: '本关没有参考解法数据。',
    hintOffPath: '当前局面与参考解法不一致，请撤销或重开。',
    hintDone: '参考步已用完。',
    hintNotPlaying: '请先重开对局。',
    hintIllegal: '提示步无法执行（数据异常）。',
    langButtonShowEn: 'EN',
    langButtonShowZh: '中文',
    langSwitchAria: '切换界面语言',
  },
  en: {
    subtitle: 'Round plush balls (5 colors, cycling)',
    prevLevel: 'Previous',
    nextLevel: 'Next',
    undo: 'Undo',
    restart: 'Restart',
    hintStep: 'Hint',
    bottomHint:
      'Tap a ball to select, then swipe or use arrow keys; moves must follow HOG2 rules.',
    statusWon: 'You win: one ball left',
    statusLost: 'Invalid (0 balls)—undo or restart',
    remainingBalls: (n) => `${n} ball${n === 1 ? '' : 's'} left`,
    levelLabel: (world, stage, id) =>
      `World ${world} · Stage ${stage} · ${id}`,
    hintNoSolution: 'This level has no packaged solution.',
    hintOffPath: 'Position does not match the reference; undo or restart.',
    hintDone: 'No more reference steps.',
    hintNotPlaying: 'Restart the game first.',
    hintIllegal: 'Hint step cannot run (data error).',
    langButtonShowEn: 'EN',
    langButtonShowZh: '中文',
    langSwitchAria: 'Switch interface language',
  },
}

export function uiMessages(locale: UiLocale): UiMessages {
  return messages[locale]
}

export function hintReasonMessage(locale: UiLocale, reason: string): string {
  const m = messages[locale]
  const map: Record<string, string> = {
    no_solution: m.hintNoSolution,
    off_path: m.hintOffPath,
    done: m.hintDone,
    not_playing: m.hintNotPlaying,
    illegal: m.hintIllegal,
  }
  return map[reason] ?? reason
}
