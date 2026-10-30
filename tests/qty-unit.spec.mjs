// 消耗品記包數（v1.8）：items[].qty、unit 選填；回購週期改算「每包約撐幾天」「每包多少錢」；未填視為 1。
// 示範：衛生棉 10 包 183 元。舊資料、舊備份（沒有 qty／unit）要照常讀取，畫面與原本相同。
import { test, expect } from '@playwright/test';
import { openApp, store, fixture, TODAY } from './helpers.mjs';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const T = Date.UTC(2026, 9, 20);
const pad = (id, date, price, extra = {}) => ({ id, name: '示範衛生棉', price, date, type: 'cons', cat: '居家民生', _t: T + id.length, ...extra });
const withItems = list => { const d = fixture('demo'); d.items = [...d.items, ...list]; return d; };
const openItems = async page => { await page.locator('#itemsOpen').click(); await expect(page.locator('#sheetHost .sheet')).toBeVisible(); };
const consRow = (page, name) => page.locator('[data-sec="cons"] [data-edititem]', { hasText: name });

test('包數：新增消耗品「衛生棉 10 包 183 元」，存下 qty 與 unit，清單顯示包數與每包價格', async ({ page }) => {
  const errors = await openApp(page);
  await openItems(page);
  await page.locator('#iAdd').click();
  await expect(page.locator('#iQtyBox')).toBeHidden(); // 預設「一般」不顯示
  await page.locator('#iType [data-v="cons"]').click();
  await expect(page.locator('#iQtyBox')).toBeVisible();
  await page.locator('#iN').fill('示範衛生棉');
  await page.locator('#iP').fill('183');
  await page.locator('#iQ').fill('10');
  await page.locator('#iU').fill('包');
  await expect(page.locator('#iPerPack')).toHaveText('每包約 NT$18');
  await page.locator('#iCat [data-v="居家民生"]').click();
  await page.locator('#iSave').click();
  await expect(page.locator('#toast')).toContainText('示範衛生棉 記好了');
  const it = (await store(page)).items.find(x => x.name === '示範衛生棉');
  expect(it).toMatchObject({ price: 183, type: 'cons', qty: 10, unit: '包', date: TODAY });
  await expect(consRow(page, '示範衛生棉')).toContainText('10 包');
  await expect(consRow(page, '示範衛生棉')).toContainText('每包 NT$18');
  await expect(page.locator('[data-sec="all"] [data-edititem]', { hasText: '示範衛生棉' })).toContainText('10 包');
  // 再打開修改，欄位帶回原值
  await page.locator('[data-sec="all"] [data-edititem]', { hasText: '示範衛生棉' }).click();
  await expect(page.locator('#iQ')).toHaveValue('10');
  await expect(page.locator('#iU')).toHaveValue('包');
  expect(errors).toEqual([]);
});

test('包數：買兩次後，回購週期以每包計算（每包撐幾天、每包多少錢、預計用完日、一年花費）', async ({ page }) => {
  const errors = await openApp(page, { data: withItems([pad('p1', '2026-09-01', 183, { qty: 10, unit: '包' }), pad('p22', '2026-10-01', 189, { qty: 10, unit: '包' })]) });
  await openItems(page);
  const row = consRow(page, '示範衛生棉');
  await expect(row).toContainText('每包約撐 3 天 · 每包 NT$19 · 一年約 NT$2,263');
  await expect(row).toContainText('約 10/31 用完'); // 10/01 那 10 包 × 3 天
  expect(errors).toEqual([]);
});

test('包數：只填數量沒填單位，以「個」稱呼；前一次沒填數量的視為 1', async ({ page }) => {
  const errors = await openApp(page, { data: withItems([pad('p1', '2026-09-28', 100), pad('p22', '2026-10-08', 200, { qty: 2 })]) });
  await openItems(page);
  // 9/28 那次視為 1 個，撐到 10/08：每個 10 天；每個 (100+200)/3＝100 元；10/08＋2×10＝10/28
  await expect(consRow(page, '示範衛生棉')).toContainText('每個約撐 10 天 · 每個 NT$100');
  await expect(consRow(page, '示範衛生棉')).toContainText('約 10/28 用完');
  expect(errors).toEqual([]);
});

test('包數：沒有填包數的舊資料，回購週期顯示與原本完全相同', async ({ page }) => {
  const errors = await openApp(page);
  await openItems(page);
  await expect(consRow(page, '示範洗髮精')).toContainText('平均 43 天一次 · 一年約 NT$2,496');
  await expect(consRow(page, '示範貓砂')).toContainText('買過 1 次（10/03，NT$450）· 再買一次就算得出週期');
  // 打開舊物品再儲存，不會憑空多出 qty／unit
  await consRow(page, '示範貓砂').click();
  await expect(page.locator('#iQ')).toHaveValue('');
  await page.locator('#iSave').click();
  const it = (await store(page)).items.find(x => x.id === 'dmI4');
  expect(it.qty).toBeUndefined();
  expect(it.unit).toBeUndefined();
  expect(errors).toEqual([]);
});

test('包數：同名品項帶入上次的數量與單位；改成非消耗品就不存包數', async ({ page }) => {
  const errors = await openApp(page, { data: withItems([pad('p1', '2026-09-01', 183, { qty: 10, unit: '包' })]) });
  await openItems(page);
  await page.locator('#iAdd').click();
  await page.locator('#iN').fill('示範衛生棉');
  await page.locator('#iN').dispatchEvent('change');
  await expect(page.locator('#iQ')).toHaveValue('10');
  await expect(page.locator('#iU')).toHaveValue('包');
  await page.locator('#iType [data-v="gen"]').click();
  await page.locator('#iSave').click();
  const mine = (await store(page)).items.filter(x => x.name === '示範衛生棉' && x.id !== 'p1');
  expect(mine).toHaveLength(1);
  expect(mine[0].type).toBe('gen');
  expect(mine[0].qty).toBeUndefined();
  expect(errors).toEqual([]);
});

test('包數：數量必須是 1–9999 的整數', async ({ page }) => {
  const errors = await openApp(page);
  await openItems(page);
  await page.locator('#iAdd').click();
  await page.locator('#iType [data-v="cons"]').click();
  await page.locator('#iN').fill('示範衛生棉');
  await page.locator('#iP').fill('183');
  await page.locator('#iCat [data-v="居家民生"]').click();
  await page.locator('#iQ').fill('2.5');
  await page.locator('#iSave').click();
  await expect(page.locator('#iMsg')).toHaveText('數量請填 1～9,999 的整數，或留白。');
  expect((await store(page)).items.some(x => x.name === '示範衛生棉')).toBe(false);
  expect(errors).toEqual([]);
});

test('包數：備份匯入保留 qty／unit，不合理的值丟掉；沒有這兩個欄位的舊備份照常匯入', async ({ page }) => {
  const errors = await openApp(page, { data: null });
  const o = fixture('old-backup');
  o.items = [pad('p1', '2026-09-01', 183, { qty: 10, unit: '包' }), pad('p22', '2026-10-01', 189, { qty: -3, unit: '一二三四五六七八九十' }), ...(o.items || [])];
  const f = join(mkdtempSync(join(tmpdir(), 'qty-')), 'backup.json');
  writeFileSync(f, JSON.stringify(o));
  await page.locator('#bkFile').setInputFiles(f);
  await expect(page.locator('#bkNote')).toHaveText('已匯入 5 天紀錄。');
  const s = await store(page);
  expect(s.items.find(x => x.id === 'p1')).toMatchObject({ qty: 10, unit: '包' });
  const bad = s.items.find(x => x.id === 'p22');
  expect(bad.qty).toBeUndefined();
  expect(bad.unit).toBe('一二三四五六');
  expect(errors).toEqual([]);
});

test('包數：物品 CSV 多出「數量」「單位」兩欄（加在最後，原本欄位順序不變）', async ({ page }) => {
  const errors = await openApp(page, { data: withItems([pad('p1', '2026-09-01', 183, { qty: 10, unit: '包' })]) });
  await page.evaluate(() => { delete navigator.canShare; Object.defineProperty(navigator, 'canShare', { value: undefined }); });
  const dl = page.waitForEvent('download');
  await page.locator('#bkItemsCsv').click();
  const path = await (await dl).path();
  const csv = (await import('node:fs')).readFileSync(path, 'utf8').replace(/^﻿/, '').split('\r\n');
  expect(csv[0]).toBe('購買日期,品名,價格 元,類型,分類,預計年限,回顧,回顧備註,數量,單位');
  expect(csv).toContain('2026-09-01,示範衛生棉,183,消耗品,居家民生,,,,10,包');
  expect(csv).toContain('2026-10-03,示範貓砂,450,消耗品,寵物,,,,,');
  expect(errors).toEqual([]);
});
