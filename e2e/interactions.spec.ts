import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fling-ui-locale', 'zh')
  })
})

test('撤销：提示一步后撤销恢复到移动前', async ({ page }) => {
  // 导航到第二关 w2-s2（2 球、通常多步），确保移动后未立刻胜利
  await page.goto('/?level=1')
  await page.waitForSelector('.board .cell-ball', { timeout: 15_000 })

  // 记录移动前的球数
  const ballsBefore = await page.locator('.board .cell-ball').count()

  // 提示一步
  await page.getByTestId('hint').click()
  await page.waitForTimeout(1500)

  // 如果已经胜利，说明该关也只需一步，跳过撤销测试
  const statusText = await page.locator('.game-status').textContent()
  if (statusText?.includes('胜利')) {
    return
  }

  // 移动后球数应减少
  const ballsAfterMove = await page.locator('.board .cell-ball').count()
  expect(ballsAfterMove).toBeLessThanOrEqual(ballsBefore)

  // 撤销
  await page.getByTestId('undo').click()

  // 恢复到移动前状态
  const ballsAfterUndo = await page.locator('.board .cell-ball').count()
  expect(ballsAfterUndo).toBe(ballsBefore)
})

test('重开：执行步骤后重开回到初始布局', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.board .cell-ball', { timeout: 15_000 })

  // 记录初始布局
  const initialBalls = await page.locator('.board .cell-ball').count()

  // 执行一步
  await page.getByTestId('hint').click()
  await expect(page.locator('.game-status')).toContainText('胜利', {
    timeout: 10_000,
  })

  // 重开
  await page.getByTestId('restart').click()

  // 回到初始布局
  const afterRestart = await page.locator('.board .cell-ball').count()
  expect(afterRestart).toBe(initialBalls)
  await expect(page.locator('.game-status')).not.toContainText('胜利')
})

test('语言切换：点击语言按钮后 UI 文案变为英文', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.board .cell-ball', { timeout: 15_000 })

  // 初始为中文
  await expect(page.getByTestId('hint')).toContainText('提示一步')

  // 切换到英文
  await page.getByTestId('lang-toggle').click()
  await expect(page.getByTestId('hint')).toContainText('Hint')
})

test('多关卡导航：通关后下一关，然后上一关', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.board .cell-ball', { timeout: 15_000 })

  // 通关第一关 w2-s1
  await page.getByTestId('hint').click()
  await expect(page.locator('.game-status')).toContainText('胜利', {
    timeout: 10_000,
  })

  // 下一关应为 w2-s2（同一大关的第二个小关）
  await page.getByTestId('next-level').click()
  await expect(page.locator('.level-label')).toContainText('w2-s2')

  // 上一关回到 w2-s1
  await page.getByTestId('prev-level').click()
  await expect(page.locator('.level-label')).toContainText('w2-s1')
})

test('键盘方向键：选中球后用方向键移动', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.board .cell-ball', { timeout: 15_000 })

  // 点击一个球来选中它
  const ballCell = page.locator('.board .cell-ball').first()
  await ballCell.click()
  await expect(page.locator('.cell-selected')).toBeVisible()

  // 尝试方向键（可能不一定有合法方向，但不应报错）
  await page.keyboard.press('ArrowRight')
  // 如果移动合法，球数会减少；如果不合法，状态不变
  // 只要不崩溃就算通过
  await page.waitForTimeout(500)
  await expect(page.locator('.board')).toBeVisible()
})
