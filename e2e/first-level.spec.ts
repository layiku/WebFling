import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fling-ui-locale', 'zh')
  })
})

/**
 * 第一槽位 w2-s1：两球一步可胜；用「提示一步」执行 pack 内参考步。
 */
test('第一关可通过提示一步通关', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.game-title')).toContainText('Fling')
  await expect(page.locator('.game-status')).toHaveAttribute('role', 'status')
  await expect(page.locator('.game-status')).toHaveAttribute(
    'aria-live',
    'polite',
  )
  await page.waitForSelector('.board .cell-ball', { timeout: 15_000 })
  await page.getByTestId('hint').click()
  await expect(page.locator('.game-status')).toContainText('胜利', {
    timeout: 10_000,
  })
})

test('切关后焦点落在重开按钮', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.board .cell-ball', { timeout: 15_000 })
  // 第一关通关后下一关按钮启用
  await page.getByTestId('hint').click()
  await expect(page.locator('.game-status')).toContainText('胜利', {
    timeout: 10_000,
  })
  await page.getByTestId('next-level').click()
  await expect(page.getByTestId('restart')).toBeFocused()
})
