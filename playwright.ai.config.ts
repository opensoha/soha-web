import { defineConfig } from '@playwright/test'
import basic from './playwright.config'

export default defineConfig({
  ...basic,
  globalSetup: './e2e/fixtures/ai-setup.ts',
  testMatch: /ai\/.*\.spec\.ts$/,
  testIgnore: [],
  timeout: 180_000,
  globalTimeout: 900_000,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/ai-browser',
})
