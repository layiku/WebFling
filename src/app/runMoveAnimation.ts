import type { MoveAnimSegment } from '../game/flingBoard.js'
import { ballPlushClass } from './ballPlush.js'

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 滑动结束 → 撞击：撞击球在格上停稳一拍再进入撞击逻辑 */
const SETTLE_MS_BEFORE_IMPACT = 170

/** 格子相对于棋盘左上角的坐标（与 boardEl 的 padding 对齐） */
function cellTopLeft(
  boardEl: HTMLElement,
  cellIndex: number,
): { x: number; y: number } {
  const btn = boardEl.querySelector(
    `button.cell[data-index="${cellIndex}"]`,
  ) as HTMLElement | null
  if (!btn) return { x: 0, y: 0 }
  const r = btn.getBoundingClientRect()
  const br = boardEl.getBoundingClientRect()
  return { x: r.left - br.left, y: r.top - br.top }
}

/** 格子的实际边长（正方形） */
function actualCellSize(boardEl: HTMLElement, cellIndex: number): number {
  const btn = boardEl.querySelector(
    `button.cell[data-index="${cellIndex}"]`,
  ) as HTMLElement | null
  if (!btn) return 36
  const r = btn.getBoundingClientRect()
  return Math.min(r.width, r.height)
}

/** 撞击后停在格上的幽灵球，动画结束在 finally 里统一移除 */
const PARKED_STRIKER_CLASS = 'ball-parked-after-impact'

/** 与 .cell-ball 保持一致的格子背景色 */
const CELL_BALL_BG = '#ececf0'

/**
 * 创建「分层格子幽灵」：
 *   wrapper   — 平移（格子灰色背景一起走）
 *   ball-shell — 球形容器（落地阴影 + 外圈光晕）
 *   ball-surface — 【旋转层】球面基础色（对称渐变，旋转时无高光漂移）
 *   ball-gloss  — 【固定层】镜面高光（始终在左上角，不参与旋转）
 */
function makeGhost(
  boardEl: HTMLElement,
  pieceId: number,
  topLeftX: number,
  topLeftY: number,
  cellSizePx: number,
): HTMLDivElement {
  const colorIdx = pieceId % 5

  const wrapper = document.createElement('div')
  wrapper.className = 'ball-move-ghost'
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.style.position = 'absolute'
  wrapper.style.left = `${topLeftX}px`
  wrapper.style.top = `${topLeftY}px`
  wrapper.style.width = `${cellSizePx}px`
  wrapper.style.height = `${cellSizePx}px`
  wrapper.style.borderRadius = '8px'
  wrapper.style.background = CELL_BALL_BG
  wrapper.style.display = 'flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'

  /* 球形容器 */
  const shell = document.createElement('div')
  shell.className = `ball-shell ball-shell--${colorIdx}`

  /* 旋转层：球面基础色 */
  const surface = document.createElement('div')
  surface.className = `ball-surface ball-surface--${colorIdx}`

  /* 固定层：镜面高光（不旋转） */
  const gloss = document.createElement('div')
  gloss.className = 'ball-gloss'

  shell.appendChild(surface)
  shell.appendChild(gloss)
  wrapper.appendChild(shell)
  boardEl.appendChild(wrapper)
  return wrapper
}

/**
 * 把幽灵内部的三层结构（ball-shell > ball-surface + ball-gloss）
 * 替换为与静止球完全一致的 .ball-plush。
 * 用于滚动结束后 / 停驻球，消除三层叠加与单层渐变之间的色差跳变。
 */
function swapToPlush(ghost: HTMLDivElement, pieceId: number): void {
  const shell = ghost.querySelector('.ball-shell')
  if (shell) shell.remove()
  const plush = document.createElement('span')
  plush.className = `ball-plush ${ballPlushClass(pieceId)}`
  plush.setAttribute('aria-hidden', 'true')
  ghost.appendChild(plush)
}

/** 滑动幽灵移除后，停球格尚无真实 plush（棋盘尚未 apply move），用静止幽灵占位 */
function showParkedStriker(
  boardEl: HTMLElement,
  strikerStopCell: number,
  strikerId: number,
): void {
  const cs = actualCellSize(boardEl, strikerStopCell)
  const tl = cellTopLeft(boardEl, strikerStopCell)
  const g = makeGhost(boardEl, strikerId, tl.x, tl.y, cs)
  swapToPlush(g, strikerId)
  g.classList.add(PARKED_STRIKER_CLASS)
}

/** 与 .cell-empty 保持一致的空格背景色 */
const CELL_EMPTY_BG = '#fafafa'

/**
 * 隐藏源格的球图像（opacity=0）并将背景换为空格色，
 * 使源格立刻呈现"已离开"的空格外观，幽灵格负责视觉上的移动过程。
 * 同时移除选中框，避免动画期间空格子显示蓝色轮廓。
 */
function hideSourceCell(cellIndex: number, boardEl: HTMLElement): void {
  const btn = boardEl.querySelector(
    `button.cell[data-index="${cellIndex}"]`,
  ) as HTMLElement | null
  if (!btn) return
  const plush = btn.querySelector('.ball-plush') as HTMLElement | null
  plush?.classList.add('ball-plush--anim-hide')
  btn.style.background = CELL_EMPTY_BG
  btn.classList.remove('cell-selected')
}

async function animateRollSegment(
  seg: Extract<MoveAnimSegment, { kind: 'roll' }>,
  boardEl: HTMLElement,
): Promise<HTMLDivElement | null> {
  const path = seg.path
  /** 仅一格：链式撞击时已在撞击格，无滑动，不隐藏、不生成幽灵 */
  if (path.length < 2) return null

  const from = path[0]!
  const to = path[path.length - 1]!
  hideSourceCell(from, boardEl)

  const cs = actualCellSize(boardEl, from)
  const tl0 = cellTopLeft(boardEl, from)
  const tl1 = cellTopLeft(boardEl, to)
  const ghost = makeGhost(boardEl, seg.pieceId, tl0.x, tl0.y, cs)
  const surface = ghost.querySelector('.ball-surface') as HTMLElement

  const dx = tl1.x - tl0.x
  const dy = tl1.y - tl0.y
  const dist = Math.hypot(dx, dy)
  const duration = Math.min(900, Math.max(220, 180 + (path.length - 1) * 42))
  /**
   * 球面旋转角：弧长 / 周长 × 360°，球直径 ≈ cellSize × 0.88
   * 方向符号：向右/向下 = 正（顺时针），向左/向上 = 负（逆时针）
   */
  const direction = dx !== 0 ? Math.sign(dx) : Math.sign(dy)
  const spin = direction * (dist / (Math.PI * cs * 0.88)) * 360

  /** 格子整体平移（含背景）；ease-out 模拟球滚到目标时减速停稳 */
  const aWrapper = ghost.animate(
    [
      { left: `${tl0.x}px`, top: `${tl0.y}px` },
      { left: `${tl1.x}px`, top: `${tl1.y}px` },
    ],
    { duration, easing: 'ease-out', fill: 'forwards' },
  )
  /** 球面旋转同步缓动 */
  const aSurface = surface.animate(
    [{ transform: 'rotate(0deg)' }, { transform: `rotate(${spin}deg)` }],
    { duration, easing: 'ease-out', fill: 'forwards' },
  )
  await Promise.all([aWrapper.finished, aSurface.finished])
  swapToPlush(ghost, seg.pieceId)
  return ghost
}

async function animateImpactSegment(
  seg: Extract<MoveAnimSegment, { kind: 'impact' }>,
  boardEl: HTMLElement,
  ghost: HTMLDivElement | null,
  _moveDx: number,
  _moveDy: number,
): Promise<void> {
  ghost?.remove()
  showParkedStriker(boardEl, seg.strikerStopCell, seg.strikerId)
  /** 撞击瞬间隐藏被撞击球的真实格，后续 roll/flyOff 幽灵接管视觉 */
  hideSourceCell(seg.hitCell, boardEl)
}

/** 沿出口方向滚出棋盘的像素距离 */
const FLYOFF_ROLL_PX = 150

async function animateFlyOffSegment(
  seg: Extract<MoveAnimSegment, { kind: 'flyOff' }>,
  boardEl: HTMLElement,
): Promise<void> {
  hideSourceCell(seg.fromCell, boardEl)
  const cs = actualCellSize(boardEl, seg.fromCell)
  const tl0 = cellTopLeft(boardEl, seg.fromCell)
  const ghost = makeGhost(boardEl, seg.pieceId, tl0.x, tl0.y, cs)
  const surface = ghost.querySelector('.ball-surface') as HTMLElement

  const tl1x = tl0.x + seg.dx * FLYOFF_ROLL_PX
  const tl1y = tl0.y + seg.dy * FLYOFF_ROLL_PX
  const duration = Math.min(1400, Math.max(420, 400 + FLYOFF_ROLL_PX * 0.75))
  /**
   * 方向符号：向右/向下 = 顺时针，向左/向上 = 逆时针
   */
  const direction = seg.dx !== 0 ? Math.sign(seg.dx) : Math.sign(seg.dy)
  const spin = direction * (FLYOFF_ROLL_PX / (Math.PI * cs * 0.88)) * 360

  /**
   * 位移：ease-out（撞击后立即高速飞出，轻微减速，无启动停顿感）
   * 透明度：前 55% 保持不透明，之后快速淡出（先看到球飞出去，再消失）
   */
  const aWrapperPos = ghost.animate(
    [
      { left: `${tl0.x}px`, top: `${tl0.y}px` },
      { left: `${tl1x}px`, top: `${tl1y}px` },
    ],
    { duration, easing: 'ease-out', fill: 'forwards' },
  )
  const aWrapperOpacity = ghost.animate(
    [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: 0.55 },
      { opacity: 0, offset: 1 },
    ],
    { duration, easing: 'linear', fill: 'forwards' },
  )
  /** 球面旋转同步（高光层固定在左上角） */
  const aSurface = surface.animate(
    [{ transform: 'rotate(0deg)' }, { transform: `rotate(${spin}deg)` }],
    { duration, easing: 'ease-out', fill: 'forwards' },
  )
  await Promise.all([aWrapperPos.finished, aWrapperOpacity.finished, aSurface.finished])
  ghost.remove()
}

/**
 * 播放一步移动的动画；不改变棋盘数据（调用方在之后执行 `move`）。
 */
export async function runMoveAnimation(
  segments: MoveAnimSegment[],
  boardEl: HTMLElement,
  moveDx: number,
  moveDy: number,
): Promise<void> {
  boardEl.classList.add('board--animating')
  let ghost: HTMLDivElement | null = null
  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!
      const next = segments[i + 1]
      if (seg.kind === 'roll') {
        ghost?.remove()
        ghost = await animateRollSegment(seg, boardEl)
        if (next?.kind === 'impact') await delay(SETTLE_MS_BEFORE_IMPACT)
      } else if (seg.kind === 'impact') {
        await animateImpactSegment(seg, boardEl, ghost, moveDx, moveDy)
        ghost = null
      } else {
        ghost?.remove()
        ghost = null
        await animateFlyOffSegment(seg, boardEl)
      }
    }
  } finally {
    ghost?.remove()
    boardEl.querySelectorAll(`.${PARKED_STRIKER_CLASS}`).forEach((el) => {
      el.remove()
    })
    boardEl.classList.remove('board--animating')
    /**
     * 不在此处恢复源格样式：调用方的 finally 始终会执行 renderAll()，
     * renderAll() 调用 boardEl.replaceChildren() 重建所有格子，
     * 旧元素（含内联 style、hide 类）一起移除，不会出现闪烁。
     */
  }
}
