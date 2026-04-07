import { ballColorLocalized, type UiLocale } from './i18n.js'
import { cellNotation } from './boardCoords.js'

/** 棋格按钮的简短读屏文案。 */
export function buildCellAriaLabel(
  col: number,
  row: number,
  pieceId: number,
  cellIndex: number,
  selectedCell: number | null,
  locale: UiLocale,
): string {
  const notation = cellNotation(col, row)
  if (pieceId < 0) {
    return locale === 'zh'
      ? `格子 ${notation}，空`
      : `Cell ${notation}, empty`
  }
  const color = ballColorLocalized(locale, pieceId % 5)
  if (locale === 'zh') {
    if (selectedCell === cellIndex) {
      return `格子 ${notation}，已选中${color}色毛球`
    }
    return `格子 ${notation}，${color}色毛球`
  }
  if (selectedCell === cellIndex) {
    return `Cell ${notation}, selected ${color} plush ball`
  }
  return `Cell ${notation}, ${color} plush ball`
}
