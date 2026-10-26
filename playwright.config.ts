import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the live GitHub Pages site by default.
// Set BASE_URL to test another copy, e.g. a local `npm run preview`.
const baseURL = process.env.BASE_URL ?? 'https://kenshirosaito.github.io/Little-World/'

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
