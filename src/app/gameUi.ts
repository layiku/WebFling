import {
  canMove,
  computeMovePlan,
  countOccupiedCells,
} from '../game/flingBoard.js'
import { ballPlushClass } from './ballPlush.js'
import { buildCellAriaLabel } from './cellAriaLabel.js'
import { columnLetters } from './boardCoords.js'
import { TOTAL_LEVEL_SLOTS, levelFromIndex } from '../levels/levelIndex.js'
import type { LevelPack } from '../levels/schema.js'
import { pixelDeltaToDirection } from '../input/swipe.js'
import { GameSession } from './gameSession.js'
import { runMoveAnimation } from './runMoveAnimation.js'
import {
  isLevelUnlocked,
  loadProgress,
  mergeWinIfNeeded,
  isNextLevelEnabled,
  saveProgress,
  setLastPlayed,
  type ProgressStateV1,
} from './progress.js'

const SWIPE_MIN_PX = 28

function firstUnlockedIndex(state: ProgressStateV1): number {
  for (let i = 0; i < TOTAL_LEVEL_SLOTS; i++) {
    if (isLevelUnlocked(state, i)) return i
  }
  return 0
}

function clampToUnlocked(
  state: ProgressStateV1,
  requested: number,
): number {
  if (requested < 0) return 0
  if (requested >= TOTAL_LEVEL_SLOTS) return TOTAL_LEVEL_SLOTS - 1
  if (isLevelUnlocked(state, requested)) return requested
  return firstUnlockedIndex(state)
}

/**
 * 将关卡包挂载到容器：选关、棋盘、撤销、滑动发射、方向键、提示、进度。
 */
export function mountGame(root: HTMLElement, pack: LevelPack): void {
  let progress = loadProgress(localStorage, pack.rulesVersion)

  const paramsInit = new URLSearchParams(window.location.search)
  const qInit = paramsInit.get('level')
  let idx: number
  if (qInit !== null) {
    const n = Number(qInit)
    if (Number.isInteger(n) && n >= 0 && n < TOTAL_LEVEL_SLOTS) {
      idx = clampToUnlocked(progress, n)
    } else {
      idx = clampToUnlocked(progress, progress.lastLevelIndex)
    }
  } else {
    idx = clampToUnlocked(progress, progress.lastLevelIndex)
  }

  let session = new GameSession(pack.levels[idx]!)

  root.innerHTML = ''
  root.className = 'game-root'

  const header = document.createElement('header')
  header.className = 'game-header'

  const title = document.createElement('h1')
  title.className = 'game-title'
  title.textContent = 'Fling'

  const subtitle = document.createElement('p')
  subtitle.className = 'game-subtitle muted'
  subtitle.textContent = '彩色圆形毛绒球（5 色循环）'

  const nav = document.createElement('div')
  nav.className = 'game-nav'

  const prevBtn = document.createElement('button')
  prevBtn.type = 'button'
  prevBtn.className = 'btn'
  prevBtn.textContent = '上一关'
  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className = 'btn'
  nextBtn.textContent = '下一关'

  const levelLabel = document.createElement('div')
  levelLabel.className = 'level-label'

  const toolbar = document.createElement('div')
  toolbar.className = 'game-toolbar'
  const undoBtn = document.createElement('button')
  undoBtn.type = 'button'
  undoBtn.className = 'btn'
  undoBtn.textContent = '撤销'
  const restartBtn = document.createElement('button')
  restartBtn.type = 'button'
  restartBtn.className = 'btn'
  restartBtn.textContent = '重开'
  const hintBtn = document.createElement('button')
  hintBtn.type = 'button'
  hintBtn.className = 'btn btn-secondary'
  hintBtn.textContent = '提示一步'

  const statusEl = document.createElement('p')
  statusEl.className = 'game-status'
  statusEl.setAttribute('role', 'status')
  statusEl.setAttribute('aria-live', 'polite')
  const hintLine = document.createElement('p')
  hintLine.className = 'game-hintline muted'
  hintLine.setAttribute('role', 'status')
  hintLine.setAttribute('aria-live', 'polite')
  hintLine.hidden = true

  const boardWrap = document.createElement('div')
  boardWrap.className = 'board-wrap'

  const hint = document.createElement('p')
  hint.className = 'game-hint muted'
  hint.textContent =
    '点选毛球后，用方向键或滑动发射；仅当与 HOG2 规则一致时可走。'

  nav.append(prevBtn, levelLabel, nextBtn)
  toolbar.append(undoBtn, restartBtn, hintBtn)
  header.append(title, subtitle, nav, toolbar, statusEl, hintLine)
  root.append(header, boardWrap, hint)

  const boardFrame = document.createElement('div')
  boardFrame.className = 'board-frame'
  const boardCorner = document.createElement('div')
  boardCorner.className = 'board-corner'
  boardCorner.setAttribute('aria-hidden', 'true')
  const colLabelsEl = document.createElement('div')
  colLabelsEl.className = 'board-col-labels'
  colLabelsEl.setAttribute('aria-hidden', 'true')
  const rowLabelsEl = document.createElement('div')
  rowLabelsEl.className = 'board-row-labels'
  rowLabelsEl.setAttribute('aria-hidden', 'true')
  const boardEl = document.createElement('div')
  boardEl.className = 'board'
  boardEl.setAttribute('role', 'grid')
  boardFrame.append(boardCorner, colLabelsEl, rowLabelsEl, boardEl)
  boardWrap.appendChild(boardFrame)

  let lastAxisW = -1
  let lastAxisH = -1
  let moveAnimating = false

  async function playMoveWithAnimation(
    startCell: number,
    dx: number,
    dy: number,
  ): Promise<boolean> {
    if (moveAnimating) return false
    if (session.getPhase() !== 'playing') return false
    if (session.getBoard().cells[startCell]! < 0) return false
    if (!canMove(session.getBoard(), startCell, dx, dy)) return false

    const plan = computeMovePlan(session.getBoard(), startCell, dx, dy)
    if (!plan?.length) return false

    moveAnimating = true
    boardEl.setAttribute('aria-busy', 'true')
    try {
      session.pushUndoSnapshot()
      await runMoveAnimation(plan, boardEl, dx, dy)
      session.executeMovePhysics(startCell, dx, dy)
    } catch {
      session.undo()
    } finally {
      moveAnimating = false
      boardEl.removeAttribute('aria-busy')
      // 兜底：确保 board--animating 不会因异常路径永久残留（pointer-events: none 会卡死交互）
      boardEl.classList.remove('board--animating')
      renderAll()
    }
    return true
  }

  async function playHintWithAnimation(): Promise<void> {
    const r = session.getPackagedHintStep()
    if (!r.ok) {
      hintMessage(r.reason)
      renderAll()
      return
    }
    const { startCell, dx, dy } = r.step
    const plan = computeMovePlan(session.getBoard(), startCell, dx, dy)
    if (!plan?.length) {
      hintMessage('illegal')
      renderAll()
      return
    }
    moveAnimating = true
    boardEl.setAttribute('aria-busy', 'true')
    hintLine.hidden = true
    try {
      session.pushUndoSnapshot()
      await runMoveAnimation(plan, boardEl, dx, dy)
      session.executeMovePhysics(startCell, dx, dy)
    } catch {
      session.undo()
    } finally {
      moveAnimating = false
      boardEl.removeAttribute('aria-busy')
      boardEl.classList.remove('board--animating')
      renderAll()
    }
  }

  function persistProgress(): void {
    saveProgress(localStorage, progress)
  }

  function setIndex(next: number): void {
    const clamped = clampToUnlocked(progress, next)
    idx = Math.max(0, Math.min(TOTAL_LEVEL_SLOTS - 1, clamped))
    session = new GameSession(pack.levels[idx]!)
    progress = setLastPlayed(progress, idx)
    persistProgress()
    hintLine.hidden = true
    renderAll()
    // 切关后将焦点移至稳定控件，防止焦点卡在已禁用的按钮上
    restartBtn.focus()
  }

  function hintMessage(reason: string): void {
    const map: Record<string, string> = {
      no_solution: '本关没有参考解法数据。',
      off_path: '当前局面与参考解法不一致，请撤销或重开。',
      done: '参考步已用完。',
      not_playing: '请先重开对局。',
      illegal: '提示步无法执行（数据异常）。',
    }
    hintLine.textContent = map[reason] ?? reason
    hintLine.hidden = false
  }

  function renderAll(): void {
    const ph = session.getPhase()
    const { state: nextProgress, merged } = mergeWinIfNeeded(progress, idx, ph)
    progress = nextProgress
    if (merged) persistProgress()

    const { world, stage } = levelFromIndex(idx)
    levelLabel.textContent = `第 ${world} 大关 · 第 ${stage} 小关 · ${pack.levels[idx]!.id}`
    undoBtn.disabled = !session.canUndo() || moveAnimating
    prevBtn.disabled = idx <= 0 || moveAnimating
    nextBtn.disabled =
      !isNextLevelEnabled(progress, idx, TOTAL_LEVEL_SLOTS) || moveAnimating
    hintBtn.disabled = ph !== 'playing' || moveAnimating

    if (ph === 'won') {
      statusEl.textContent = '胜利：只剩一球'
      statusEl.classList.remove('status-bad')
      statusEl.classList.add('status-good')
    } else if (ph === 'lost') {
      statusEl.textContent = '无效局面（0 球）— 请撤销或重开'
      statusEl.classList.remove('status-good')
      statusEl.classList.add('status-bad')
    } else {
      statusEl.textContent = `剩余 ${countOccupiedCells(session.getBoard())} 球`
      statusEl.classList.remove('status-good', 'status-bad')
    }
    renderBoard()
  }

  function renderBoard(): void {
    const b = session.getBoard()
    const w = b.width
    const h = b.height
    const cells = w * h
    boardFrame.style.setProperty('--bw', String(w))
    boardFrame.style.setProperty('--bh', String(h))

    if (w !== lastAxisW || h !== lastAxisH) {
      lastAxisW = w
      lastAxisH = h
      colLabelsEl.replaceChildren()
      for (let c = 0; c < w; c++) {
        const lab = document.createElement('div')
        lab.className = 'axis-label axis-col'
        lab.textContent = columnLetters(c + 1)
        colLabelsEl.appendChild(lab)
      }

      rowLabelsEl.replaceChildren()
      for (let r = 0; r < h; r++) {
        const lab = document.createElement('div')
        lab.className = 'axis-label axis-row'
        lab.textContent = String(r + 1)
        rowLabelsEl.appendChild(lab)
      }
    }

    // 列、行均分，配合 .board 的 aspect-ratio，保证每格为正方形
    boardEl.style.gridTemplateColumns = `repeat(${w}, minmax(0, 1fr))`
    boardEl.style.gridTemplateRows = `repeat(${h}, minmax(0, 1fr))`
    boardEl.replaceChildren()
    const sel = session.getSelectedCell()
    for (let i = 0; i < cells; i++) {
      const col = i % w
      const row = Math.floor(i / w)
      const id = b.cells[i]!
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'cell'
      cell.dataset.index = String(i)
      cell.setAttribute(
        'aria-label',
        buildCellAriaLabel(col, row, id, i, sel),
      )
      if (id >= 0) {
        cell.classList.add('cell-ball')
        if (sel === i) cell.classList.add('cell-selected')
        const plush = document.createElement('span')
        plush.className = `ball-plush ${ballPlushClass(id)}`
        plush.setAttribute('aria-hidden', 'true')
        cell.appendChild(plush)
      } else {
        cell.classList.add('cell-empty')
      }
      boardEl.appendChild(cell)
    }
  }

  boardEl.addEventListener('click', (ev) => {
    if (moveAnimating) return
    const t = (ev.target as HTMLElement).closest('button.cell') as
      | HTMLButtonElement
      | null
    if (!t) return
    const i = Number(t.dataset.index)
    session.selectCell(i)
    renderAll()
  })

  boardEl.addEventListener('pointerdown', (ev) => {
    if (moveAnimating) return
    if (session.getPhase() !== 'playing') return
    const t = (ev.target as HTMLElement).closest('button.cell') as
      | HTMLButtonElement
      | null
    if (!t) return
    const cell = Number(t.dataset.index)
    if (session.getBoard().cells[cell] < 0) return
    const start = { cell, x: ev.clientX, y: ev.clientY }
    const cleanup = (): void => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    const onUp = (e: PointerEvent): void => {
      cleanup()
      const ddx = e.clientX - start.x
      const ddy = e.clientY - start.y
      const dir = pixelDeltaToDirection(ddx, ddy, SWIPE_MIN_PX)
      if (!dir) return
      void playMoveWithAnimation(start.cell, dir.dx, dir.dy)
    }
    const onCancel = (): void => {
      cleanup()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  })

  window.addEventListener('keydown', (ev) => {
    if (moveAnimating) return
    if (session.getPhase() !== 'playing') return
    // 仅在棋盘格子获得焦点（或无焦点）时响应方向键，
    // 避免焦点在其他按钮上时意外触发棋子移动
    const active = document.activeElement
    if (active && active !== document.body && !boardEl.contains(active)) return
    const sel = session.getSelectedCell()
    if (sel === null) return
    let dx = 0
    let dy = 0
    if (ev.key === 'ArrowRight') dx = 1
    else if (ev.key === 'ArrowLeft') dx = -1
    else if (ev.key === 'ArrowDown') dy = 1
    else if (ev.key === 'ArrowUp') dy = -1
    else return
    ev.preventDefault()
    void playMoveWithAnimation(sel, dx, dy)
  })

  prevBtn.addEventListener('click', () => setIndex(idx - 1))
  nextBtn.addEventListener('click', () => setIndex(idx + 1))
  undoBtn.addEventListener('click', () => {
    session.undo()
    hintLine.hidden = true
    renderAll()
  })
  restartBtn.addEventListener('click', () => {
    session.restart()
    hintLine.hidden = true
    renderAll()
  })
  hintBtn.addEventListener('click', () => {
    void playHintWithAnimation()
  })

  renderAll()
}
