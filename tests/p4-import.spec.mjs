// P4：匯入備份時保留飲水連結（wid、from）與鎖定評分（grade，含版本 v）
import { test, expect } from '@playwright/test';
import { openApp, store, gotoDay, fixture, fixturePath } from './helpers.mjs';

const importOld = async page => {
  const errors = await openApp(page, { data: null });
  await page.locator('#bkFile').setInputFiles(fixturePath('old-backup'));
  await expect(page.locator('#bkNote')).toHaveText('已匯入 5 天紀錄。');
  await page.locator('#sheetHost .scrim').click({ position: { x: 5, y: 5 } });
  return errors;
};

test('P4：匯入後飲料與飲水的連結碼（wid、from）都在', async ({ page }) => {
  const errors = await importOld(page);
  const d = (await store(page)).days['2026-08-26'], o = fixture('old-backup').days['2026-08-26'];
  expect(d.food.find(f => f.name === '舊版示範：無糖紅茶').wid).toBe('oldw1');
  expect(d.waterLog).toEqual(o.waterLog.map(x => ({ t: 0, ...x })));  // 舊總量那筆原本就會補 t: 0（既有行為）
  expect(errors).toEqual([]);
});

test('P4：匯入後刪除飲料，連結的飲水一併扣掉', async ({ page }) => {
  const errors = await importOld(page);
  await gotoDay(page, '2026-08-26');
  await expect(page.locator('#waterSum')).toContainText('2000 /');
  const row = page.locator('#meals .row', { hasText: '舊版示範：無糖紅茶' });
  await row.locator('.del').click();
  await expect(page.locator('#toast')).toContainText('連同算進飲水的 500 ml 一起扣掉');
  await expect(page.locator('#waterSum')).toContainText('1500 /');
  expect((await store(page)).days['2026-08-26'].waterLog).toEqual([{ ml: 1500, t: 0, old: true }]);
  expect(errors).toEqual([]);
});

test('P4：匯入後鎖定分數（含版本）原樣保留，舊制分數不被重算覆蓋', async ({ page }) => {
  const errors = await importOld(page);
  const o = fixture('old-backup').days;
  const grades = () => store(page).then(s => Object.fromEntries(['2026-08-25', '2026-08-26', '2026-08-27'].map(k => [k, s.days[k].grade])));
  const want = { '2026-08-25': o['2026-08-25'].grade, '2026-08-26': o['2026-08-26'].grade, '2026-08-27': o['2026-08-27'].grade };
  expect(await grades()).toEqual(want);
  // 打開這幾天（會觸發結算鎖定的流程）之後，存的分數仍不變；v2 的日子在畫面上標「舊制」
  await gotoDay(page, '2026-08-25');
  await expect(page.locator('#gLabel')).toContainText('舊制 B（82 分，計分方式已更新）');
  await gotoDay(page, '2026-08-26');
  await expect(page.locator('#gLabel')).toContainText('舊制 A（92 分');
  await gotoDay(page, '2026-08-27');
  await expect(page.locator('#gLabel')).toContainText(/結算 · 64 分|結算時 D（64 分）|舊制 D（64 分，計分方式已更新）/);  // P9 起計分版本為 v4，v3 的分數若不同標「舊制」
  expect(await grades()).toEqual(want);
  expect(errors).toEqual([]);
});

test('P4：備份裡格式不對的 grade、wid 不會被帶進來', async ({ page }) => {
  const errors = await openApp(page, { data: null });
  const bad = fixture('old-backup');
  bad.days['2026-08-24'].grade = { v: 2, g: 'Z', score: 'x' };
  bad.days['2026-08-24'].food[0].wid = 123;
  bad.days['2026-08-24'].waterLog = [{ ml: 300, t: 1, from: { evil: 1 }, wid: ['x'] }];
  await page.locator('#bkFile').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#bkNote')).toHaveText('已匯入 5 天紀錄。');
  const d = (await store(page)).days['2026-08-24'];
  expect(d.grade).toBeUndefined();
  expect(d.food[0].wid).toBeUndefined();
  expect(d.waterLog).toEqual([{ ml: 300, t: 1 }]);
  expect(errors).toEqual([]);
});
