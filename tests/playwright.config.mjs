import { defineConfig } from '@playwright/test';

const PORT = +process.env.PORT || 4173;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs$/,
  // 截圖基準依環境分開存：字型與反鋸齒在不同系統會有像素差。
  // 本機用作業系統名（linux、darwin、win32）；GitHub Actions 設 SHOT_ENV=ci，用固定版本容器拍的 -ci 基準。
  snapshotPathTemplate: `{testDir}/__screenshots__/{arg}-${process.env.SHOT_ENV || '{platform}'}{ext}`,
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: './report' }]],
  expect: { toHaveScreenshot: { maxDiffPixels: 0, animations: 'disabled', caret: 'hide' } },
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node serve.mjs',
    cwd: '.',
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), ...(process.env.APP_DIR ? { APP_DIR: process.env.APP_DIR } : {}) },
  },
});
