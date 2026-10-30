// 拆檔（D11）的防護：版本號必須等於檔案內容雜湊，且每個模組都有被 importmap 管到
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = process.env.APP_DIR || fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const split = html.includes('type="importmap"');
const hash = f => createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex').slice(0, 10);

test('模組版本號＝檔案內容雜湊，且根目錄每個 .js 都在 importmap 裡', () => {
  test.skip(!split, '單檔版本（拆檔前）沒有 importmap');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const jsFiles = readdirSync(ROOT).filter(f => f.endsWith('.js')).sort();
  expect(Object.keys(map).map(k => k.replace('./', '')).sort()).toEqual(jsFiles);
  for (const [k, v] of Object.entries(map)) expect(v, `${k} 的版本號過期，請執行 npm run stamp`).toBe(`${k}?v=${hash(k.replace('./', ''))}`);
  expect(html).toContain(`href="style.css?v=${hash('style.css')}"`);
});

test('每個模組都能單獨被瀏覽器載入，沒有語法或匯入錯誤', async ({ page }) => {
  test.skip(!split, '單檔版本（拆檔前）沒有模組');
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.context().route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('index.html');
  for (const f of readdirSync(ROOT).filter(f => f.endsWith('.js'))) {
    const keys = await page.evaluate(async f => Object.keys(await import('./' + f)).length, f);
    expect(keys, `${f} 應有匯出`).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});
