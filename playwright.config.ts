import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/fixtures/run-manifest.ts',
  testMatch: /(?:ui-mock|visual)\/.*\.spec\.ts$/,
  testIgnore: ['**/ai/**', '**/api/**', '**/flows/**'],
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ['list'],
    ['./e2e/fixtures/result-reporter.ts'],
    ['json', { outputFile: 'test-results/playwright.json' }],
  ],
  outputDir: 'test-results/browser',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4179',
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4179 --strictPort',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
  },
})
