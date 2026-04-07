import { ballColorName } from './ballPlush.js'
import { cellNotation } from './boardCoords.js'

/** 棋格按钮的简短读屏文案（中文）。 */
export function buildCellAriaLabel(
  col: number,
  row: number,
  pieceId: number,
  cellIndex: number,
  selectedCell: number | null,
): string {
  const notation = cellNotation(col, row)
  if (pieceId < 0) return `格子 ${notation}，空`
  const color = ballColorName(pieceId)
  if (selectedCell === cellIndex) {
    return `格子 ${notation}，已选中${color}色毛球`
  }
  return `格子 ${notation}，${color}色毛球`
}
