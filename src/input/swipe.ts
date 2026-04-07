/**
 * 将指针位移（像素）映射为四向一步；幅度不足则视为无效。
 */
export function pixelDeltaToDirection(
  dx: number,
  dy: number,
  minDistancePx: number,
): { dx: number; dy: number } | null {
  const len = Math.hypot(dx, dy)
  if (len < minDistancePx || len === 0) return null
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 }
  }
  return dy > 0 ? { dx: 0, dy: 1 } : { dx: 0, dy: -1 }
}
