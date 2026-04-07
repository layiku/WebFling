/**
 * 棋盘坐标：列为 1 基英文列名（A…Z, AA…），行为 1 基自然数（与 UI 顶行第 1 行一致）。
 */

/** 1-based column index → `A` … `Z`, `AA`, …（与 Excel 列名相同） */
export function columnLetters(oneBasedCol: number): string {
  if (oneBasedCol < 1 || !Number.isInteger(oneBasedCol)) {
    throw new RangeError(`columnLetters: expected positive integer, got ${oneBasedCol}`)
  }
  let out = ''
  let n = oneBasedCol
  while (n > 0) {
    const remainder = (n - 1) % 26
    out = String.fromCharCode(65 + remainder) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** 0-based 列、行 → `A1`, `B3` 等记谱字符串 */
export function cellNotation(col0: number, row0: number): string {
  return `${columnLetters(col0 + 1)}${row0 + 1}`
}
