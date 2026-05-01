import {
  canMove,
  computeMovePlan,
  countOccupiedCells,
  type MoveAnimSegment,
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
import {
  applyDocumentLocale,
  documentTitle,
  getUiLocale,
  hintReasonMessage,
  setUiLocale,
  type UiLocale,
  uiMessages,
} from './i18n.js'

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
  let locale: UiLocale = getUiLocale()
  applyDocumentLocale(locale)
  document.title = documentTitle(locale)

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

  root.replaceChildren()
  root.className = 'game-root'

  const header = document.createElement('header')
  header.className = 'game-header'

  const title = document.createElement('h1')
  title.className = 'game-title'
  title.textContent = 'Fling'

  const subtitle = document.createElement('p')
  subtitle.className = 'game-subtitle muted'

  const headerTop = document.createElement('div')
  headerTop.className = 'game-header-top'
  const headerBrand = document.createElement('div')
  headerBrand.className = 'game-header-brand'
  const langWrap = document.createElement('div')
  langWrap.className = 'game-lang'
  const langBtn = document.createElement('button')
  langBtn.type = 'button'
  langBtn.className = 'btn btn-lang'
  langBtn.dataset.testid = 'lang-toggle'

  const nav = document.createElement('div')
  nav.className = 'game-nav'

  const prevBtn = document.createElement('button')
  prevBtn.type = 'button'
  prevBtn.className = 'btn'
  prevBtn.dataset.testid = 'prev-level'
  prevBtn.textContent = ''
  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className = 'btn'
  nextBtn.dataset.testid = 'next-level'
  nextBtn.textContent = ''

  const levelLabel = document.createElement('div')
  levelLabel.className = 'level-label'

  const toolbar = document.createElement('div')
  toolbar.className = 'game-toolbar'
  const undoBtn = document.createElement('button')
  undoBtn.type = 'button'
  undoBtn.className = 'btn'
  undoBtn.dataset.testid = 'undo'
  undoBtn.textContent = ''
  const restartBtn = document.createElement('button')
  restartBtn.type = 'button'
  restartBtn.className = 'btn'
  restartBtn.dataset.testid = 'restart'
  restartBtn.textContent = ''
  const hintBtn = document.createElement('button')
  hintBtn.type = 'button'
  hintBtn.className = 'btn btn-secondary'
  hintBtn.dataset.testid = 'hint'
  hintBtn.textContent = ''

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

  headerBrand.append(title, subtitle)
  langWrap.appendChild(langBtn)
  headerTop.append(headerBrand, langWrap)
  nav.append(prevBtn, levelLabel, nextBtn)
  toolbar.append(undoBtn, restartBtn, hintBtn)
  header.append(headerTop, nav, toolbar, statusEl, hintLine)

  function refreshChromeStrings(): void {
    const m = uiMessages(locale)
    subtitle.textContent = m.subtitle
    prevBtn.textContent = m.prevLevel
    nextBtn.textContent = m.nextLevel
    undoBtn.textContent = m.undo
    restartBtn.textContent = m.restart
    hintBtn.textContent = m.hintStep
    hint.textContent = m.bottomHint
    langBtn.textContent =
      locale === 'zh' ? m.langButtonShowEn : m.langButtonShowZh
    langBtn.setAttribute('aria-label', m.langSwitchAria)
    document.title = documentTitle(locale)
  }

  langBtn.addEventListener('click', () => {
    locale = locale === 'zh' ? 'en' : 'zh'
    setUiLocale(locale)
    refreshChromeStrings()
    renderAll()
  })

  refreshChromeStrings()
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

  async function commitAnimatedMove(
    startCell: number,
    dx: number,
    dy: number,
    precomputedPlan?: MoveAnimSegment[] | null,
  ): Promise<void> {
    const plan = precomputedPlan ?? computeMovePlan(session.getBoard(), startCell, dx, dy)
    if (!plan?.length) return
    moveAnimating = true
    boardEl.setAttribute('aria-busy', 'true')
    try {
      await runMoveAnimation(plan, boardEl, dx, dy)
      session.commitMove(startCell, dx, dy)
    } catch (e) {
      if (typeof console !== 'undefined') console.error('Animation error:', e)
    } finally {
      moveAnimating = false
      boardEl.removeAttribute('aria-busy')
      boardEl.classList.remove('board--animating')
      renderAll()
    }
  }

  async function playMoveWithAnimation(
    startCell: number,
    dx: number,
    dy: number,
  ): Promise<void> {
    if (moveAnimating) return
    if (session.getPhase() !== 'playing') return
    if (session.getBoard().cells[startCell]! < 0) return
    if (!canMove(session.getBoard(), startCell, dx, dy)) return
    await commitAnimatedMove(startCell, dx, dy)
  }

  async function playHintWithAnimation(): Promise<void> {
    if (moveAnimating) return
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
    hintLine.hidden = true
    await commitAnimatedMove(startCell, dx, dy, plan)
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
    hintLine.textContent = hintReasonMessage(locale, reason)
    hintLine.hidden = false
  }

  function renderAll(): void {
    const ph = session.getPhase()
    const { state: nextProgress, merged } = mergeWinIfNeeded(progress, idx, ph)
    progress = nextProgress
    if (merged) persistProgress()

    const { world, stage } = levelFromIndex(idx)
    const m = uiMessages(locale)
    levelLabel.textContent = m.levelLabel(world, stage, pack.levels[idx]!.id)
    undoBtn.disabled = !session.canUndo() || moveAnimating
    prevBtn.disabled = idx <= 0 || moveAnimating
    nextBtn.disabled =
      !isNextLevelEnabled(progress, idx, TOTAL_LEVEL_SLOTS) || moveAnimating
    hintBtn.disabled = ph !== 'playing' || moveAnimating
    langBtn.disabled = moveAnimating

    if (ph === 'won') {
      statusEl.textContent = m.statusWon
      statusEl.setAttribute('role', 'status')
      statusEl.classList.remove('status-bad')
      statusEl.classList.add('status-good')
    } else if (ph === 'lost') {
      statusEl.textContent = m.statusLost
      statusEl.setAttribute('role', 'alert')
      statusEl.classList.remove('status-good')
      statusEl.classList.add('status-bad')
    } else {
      statusEl.textContent = m.remainingBalls(countOccupiedCells(session.getBoard()))
      statusEl.setAttribute('role', 'status')
      statusEl.classList.remove('status-good', 'status-bad')
    }
    renderBoard()
  }

  function renderBoard(): void {
    const b = session.getBoard()
    const w = b.width
    const h = b.height
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
    for (let r = 0; r < h; r++) {
      const rowEl = document.createElement('div')
      rowEl.className = 'board-row'
      rowEl.setAttribute('role', 'row')
      for (let c = 0; c < w; c++) {
        const i = r * w + c
        const id = b.cells[i]!
        const cell = document.createElement('button')
        cell.type = 'button'
        cell.className = 'cell'
        cell.dataset.index = String(i)
        cell.setAttribute('role', 'gridcell')
        cell.tabIndex = sel === i ? 0 : -1
        cell.setAttribute(
          'aria-label',
          buildCellAriaLabel(c, r, id, i, sel, locale),
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
        rowEl.appendChild(cell)
      }
      boardEl.appendChild(rowEl)
    }
  }

  /**
   * 当前活跃的滑动追踪：只允许同时存在一组 pointerup/pointercancel 监听。
   * 新的 pointerdown 会先清理上一组，防止旧回调泄漏导致卡死。
   */
  let swipeCleanup: (() => void) | null = null

  boardEl.addEventListener('pointerdown', (ev) => {
    swipeCleanup?.()
    swipeCleanup = null

    if (moveAnimating) return

    const t = (ev.target as HTMLElement).closest('button.cell') as
      | HTMLButtonElement
      | null
    if (!t) return
    const cell = Number(t.dataset.index)

    // 空格点击 → 取消选中（无需追踪滑动）
    if (session.getBoard().cells[cell]! < 0) {
      session.selectCell(cell)
      renderAll()
      return
    }

    // 阻止浏览器把触摸解释为滚动/长按菜单，避免 pointercancel 吞掉手势
    ev.preventDefault()

    const pid = ev.pointerId
    const startX = ev.clientX
    const startY = ev.clientY

    const cleanup = (): void => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      if (swipeCleanup === cleanup) swipeCleanup = null
    }
    const onUp = (e: PointerEvent): void => {
      if (e.pointerId !== pid) return
      cleanup()
      if (moveAnimating) return
      const dir = pixelDeltaToDirection(
        e.clientX - startX,
        e.clientY - startY,
        SWIPE_MIN_PX,
      )
      if (dir && session.getPhase() === 'playing') {
        playMoveWithAnimation(cell, dir.dx, dir.dy)
      } else {
        // 位移不足判定为轻触 → 选中该球
        session.selectCell(cell)
        renderAll()
      }
    }
    const onCancel = (e: PointerEvent): void => {
      if (e.pointerId !== pid) return
      cleanup()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    swipeCleanup = cleanup
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
    playMoveWithAnimation(sel, dx, dy)
  })

  prevBtn.addEventListener('click', () => setIndex(idx - 1))
  nextBtn.addEventListener('click', () => setIndex(idx + 1))
  undoBtn.addEventListener('click', () => {
    if (session.undo()) {
      hintLine.hidden = true
      renderAll()
    }
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
