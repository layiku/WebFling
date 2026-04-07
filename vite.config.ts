import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      /** 阈值 = 实测值 - 2～3%，避免偶发抖动同时保证大量回归可被检测 */
      thresholds: {
        statements: 79,
        branches: 75,
        functions: 87,
        lines: 80,
      },
    },
  },
})
