/**
 * 原版 Fling 风格：圆形毛绒球，多色（按棋子编号循环）。
 * 配色与 `style.css` 中 `.ball-plush--*` 一一对应。
 */
export const BALL_COLOR_COUNT = 5 as const

export function ballColorIndex(pieceId: number): number {
  const m = pieceId % BALL_COLOR_COUNT
  return m < 0 ? m + BALL_COLOR_COUNT : m
}

/** 读屏用简短色名（中文） */
const COLOR_NAMES = ['粉红', '天蓝', '草绿', '明黄', '淡紫'] as const

export function ballColorName(pieceId: number): string {
  return COLOR_NAMES[ballColorIndex(pieceId)]!
}

/** CSS 修饰类后缀 0..4 */
export function ballPlushClass(pieceId: number): string {
  return `ball-plush--${ballColorIndex(pieceId)}`
}
