import { defineConfig, devices } from '@playwright/test'

/**
 * E2E：对构建产物 `vite preview`。请先 `npm run build`，或由 `verify:e2e` / `verify:all` 自动构建。
 * 浏览器：`npx playwright install chromium`（或 `npm run test:e2e:install`）。
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
  },
})
