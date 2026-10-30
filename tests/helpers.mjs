// 測試共用：固定時鐘、固定亂數、擋掉所有外部連線、載入示範資料
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const FIXED_NOW = new Date('2026-10-28T20:00:00+08:00'); // 示範資料的「今天」＝ 2026-10-28（週三）
export const TODAY = '2026-10-28';
export const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
export const fixturePath = name => new URL(`./fixtures/${name}.json`, import.meta.url).pathname;

/**
 * 開啟 App。data：要放進 localStorage 的 {profile, days, items}；null 代表全新裝置。
 * 回傳 errors 陣列：頁面上任何未捕捉的錯誤都會收進來，測試最後檢查是空的。
 */
export async function openApp(page, { data = fixture('demo') } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|ERR_BLOCKED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // 只允許本機測試伺服器；Google 字型、Google 登入與雲端一律擋掉，測試不碰任何真實帳號
  await page.context().route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort('blockedbyclient'));
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(({ data }) => {
    let s = 42; // 固定亂數：評語、id 每次都一樣，截圖才能逐像素比對
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    try { if (data && !localStorage.getItem('shizhang.v1')) localStorage.setItem('shizhang.v1', JSON.stringify(data)); } catch {}
  }, { data });
  await page.goto('index.html');
  await expect(page.locator('#week .day')).toHaveCount(7);
  if (data) await expect(page.locator('#remain')).not.toHaveText('—');
  return errors;
}

export const store = page => page.evaluate(() => JSON.parse(localStorage.getItem('shizhang.v1')));
export const gotoDay = async (page, date) => {
  // 週列只顯示選取日所在的一週；目標日不在畫面上就往前翻
  for (let i = 0; i < 20 && !(await page.locator(`#week [data-day="${date}"]`).count()); i++) await page.locator('#week [data-wk="-7"]').click();
  await page.locator(`#week [data-day="${date}"]`).click();
  await expect(page.locator(`#week .day.sel[data-day="${date}"]`)).toHaveCount(1);
};
export const letter = s => s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : s >= 50 ? 'E' : 'F';
