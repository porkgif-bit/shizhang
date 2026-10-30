// P10：模組載入失敗時自動重新整理一次；同一次開啟只重整一次，避免無限重整。
// 模擬部署後的快取空窗：手機拿到的模組新舊混搭，某個模組要的匯出在另一個模組裡不存在，瀏覽器在連結階段就失敗。
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixture, FIXED_NOW } from './helpers.mjs';

const MIXED = "import { 新版才有的函式 } from './core.js';\nexport const bindMoney = () => 新版才有的函式();\n";

async function setup(page, { failTimes }) {
  const loads = { html: 0, money: 0 };
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.context().route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort('blockedbyclient'));
  await page.route(/\/index\.html(\?|#|$)|\/$/, r => { loads.html++; r.continue(); });
  await page.route(/\/money\.js/, r => {
    loads.money++;
    if (loads.money <= failTimes) return r.fulfill({ status: 200, contentType: 'text/javascript', body: MIXED });
    return r.continue();
  });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(data => { try { if (!localStorage.getItem('shizhang.v1')) localStorage.setItem('shizhang.v1', JSON.stringify(data)); } catch {} }, fixture('demo'));
  return { loads, pageErrors };
}

test('P10：模組新舊混搭載入失敗，自動重新整理一次後正常顯示', async ({ page }) => {
  const { loads, pageErrors } = await setup(page, { failTimes: 1 });
  await page.goto('index.html');
  await expect(page.locator('#week .day')).toHaveCount(7);
  await expect(page.locator('#remain')).not.toHaveText('—');
  expect(loads.html).toBe(2);
  await expect(page.locator('#loadFail')).toHaveCount(0);
  // 成功後清掉記號：之後再遇到一次失敗，仍能自動重整一次
  expect(await page.evaluate(() => sessionStorage.getItem('shizhang.reloaded'))).toBeNull();
  expect(pageErrors).toEqual([]);
});

test('P10：一直載入失敗時只重整一次，之後顯示提示與重新整理按鈕，不無限重整', async ({ page }) => {
  const { loads } = await setup(page, { failTimes: 99 });
  await page.goto('index.html');
  await expect(page.locator('#loadFail')).toBeVisible();
  await expect(page.locator('#loadFail')).toContainText('沒有載入完整');
  await page.waitForTimeout(1500); // 確認沒有第三次載入
  expect(loads.html).toBe(2);
  // 手動按「重新整理」照樣可用；這次伺服器恢復正常
  await page.unroute(/\/money\.js/);
  await page.locator('#loadFail button').click();
  await expect(page.locator('#remain')).not.toHaveText('—');
  expect(loads.html).toBe(3);
});

test('P10：瀏覽器不能用 sessionStorage 時不自動重整，直接顯示提示', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } }); });
  const { loads } = await setup(page, { failTimes: 99 });
  await page.goto('index.html');
  await expect(page.locator('#loadFail')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(loads.html).toBe(1);
});

test('P10：入口的模組載入順序與拆檔時相同（core → diet → care → money → review）', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const entry = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const order = [...entry.matchAll(/import\(['"]\.\/(\w+)\.js['"]\)/g)].map(m => m[1]);
  expect(order).toEqual(['core', 'diet', 'care', 'money', 'review']);
});
