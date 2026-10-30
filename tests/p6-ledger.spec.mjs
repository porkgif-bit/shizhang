// P6：花費明細。依月份列出所有金錢紀錄（有填金額的飲食＋物品），每筆可點開修改，改完回到明細。
import { test, expect } from '@playwright/test';
import { openApp, store, fixture } from './helpers.mjs';

const demo = fixture('demo');
const foodRows = ym => Object.keys(demo.days).filter(k => k.startsWith(ym)).flatMap(k => demo.days[k].food.filter(f => f.cost > 0));
const sum = a => a.reduce((s, x) => s + x, 0);

async function openLedger(page) {
  await page.locator('#ledgerOpen').click();
  const sheet = page.locator('#sheetHost .sheet');
  await expect(sheet.locator('h2')).toHaveText('花費明細');
  return sheet;
}

test('P6：首頁花費卡有「明細」入口，預設本月，列出有金額的飲食與物品', async ({ page }) => {
  const errors = await openApp(page);
  const sheet = await openLedger(page);
  await expect(sheet.locator('#ledMonth')).toHaveText('2026 年 10 月');
  const food = foodRows('2026-10');
  expect(sum(food.map(f => f.cost))).toBe(7045); // 先手算：示範資料 10 月食費 7,045、物品只有貓砂 450
  await expect(sheet.locator('#ledTotal')).toHaveText('合計 NT$7,495 · 飲食 NT$7,045 · 物品 NT$450');
  await expect(sheet.locator('[data-editfood]')).toHaveCount(food.length);
  await expect(sheet.locator('[data-edititem]')).toHaveCount(1);
  await expect(sheet.locator('[data-edititem]')).toContainText('示範貓砂');
  await expect(sheet.locator('[data-edititem]')).toContainText('寵物');
  // 日期由新到舊：第一個日期標題是 10/28（三）
  await expect(sheet.locator('.ledday').first()).toContainText('10/28（三）');
  // P11 規則：每個可修改的列都要有「›」
  const n = await sheet.locator('[data-editfood], [data-edititem]').count();
  for (let i = 0; i < n; i++) await expect(sheet.locator('[data-editfood], [data-edititem]').nth(i).locator('.chev')).toHaveText('›');
  expect(errors).toEqual([]);
});

test('P6：篩選全部／飲食／物品，並可依分類篩選', async ({ page }) => {
  const errors = await openApp(page);
  const sheet = await openLedger(page);
  await sheet.locator('#ledKind [data-v="item"]').click();
  await expect(sheet.locator('[data-editfood]')).toHaveCount(0);
  await expect(sheet.locator('[data-edititem]')).toHaveCount(1);
  await expect(sheet.locator('#ledShown')).toHaveText('1 筆 · NT$450');
  await sheet.locator('#ledKind [data-v="food"]').click();
  await expect(sheet.locator('[data-edititem]')).toHaveCount(0);
  await expect(sheet.locator('[data-editfood]')).toHaveCount(foodRows('2026-10').length);
  await sheet.locator('#ledKind [data-v="all"]').click();
  // 分類：只列出這個月有花費的分類
  await expect(sheet.locator('#ledCat button')).toHaveText(['全部分類', '食', '寵物']);
  await sheet.locator('#ledCat [data-v="寵物"]').click();
  await expect(sheet.locator('[data-editfood]')).toHaveCount(0);
  await expect(sheet.locator('[data-edititem]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('P6：可翻到上個月；不能翻到未來', async ({ page }) => {
  const errors = await openApp(page);
  const sheet = await openLedger(page);
  await expect(sheet.locator('#ledNext')).toBeDisabled();
  await sheet.locator('#ledPrev').click();
  await expect(sheet.locator('#ledMonth')).toHaveText('2026 年 9 月');
  // 9 月：食費 2,980；物品 外套 1,680＋洗髮精 299
  await expect(sheet.locator('#ledTotal')).toHaveText('合計 NT$4,959 · 飲食 NT$2,980 · 物品 NT$1,979');
  await expect(sheet.locator('[data-edititem]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('P6：點飲食列 → 修改那一天的那一筆 → 儲存後回到明細，首頁選取日不變', async ({ page }) => {
  const errors = await openApp(page);
  let sheet = await openLedger(page);
  await sheet.locator('#ledPrev').click();
  await sheet.locator('#ledKind [data-v="food"]').click();
  const row = sheet.locator('[data-editfood][data-date="2026-09-25"]').first();
  const idx = +(await row.getAttribute('data-editfood'));
  const before = demo.days['2026-09-25'].food[idx];
  await row.click();
  await expect(page.locator('#sheetHost h2')).toHaveText('修改這筆');
  await expect(page.locator('#eN')).toHaveValue(before.name);
  await page.locator('#eCost').fill(String(before.cost + 1000));
  await page.locator('#eSave').click();
  // 回到明細，月份與篩選都保留
  sheet = page.locator('#sheetHost .sheet');
  await expect(sheet.locator('h2')).toHaveText('花費明細');
  await expect(sheet.locator('#ledMonth')).toHaveText('2026 年 9 月');
  await expect(sheet.locator('#ledKind [data-v="food"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.locator('#ledTotal')).toHaveText('合計 NT$5,959 · 飲食 NT$3,980 · 物品 NT$1,979');
  const s = await store(page);
  expect(s.days['2026-09-25'].food[idx].cost).toBe(before.cost + 1000);
  expect(s.days['2026-09-25'].food[idx].name).toBe(before.name);
  // 首頁還停在今天
  await page.locator('#sheetHost .sheet button', { hasText: '完成' }).last().click();
  await expect(page.locator('#week .day.sel[data-day="2026-10-28"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('P6：從明細取消、刪除飲食都回到明細；刪除的是那一天的那一筆', async ({ page }) => {
  const errors = await openApp(page);
  let sheet = await openLedger(page);
  await sheet.locator('[data-editfood][data-date="2026-10-21"]').first().click();
  await page.locator('#eCancel').click();
  await expect(page.locator('#sheetHost h2')).toHaveText('花費明細');
  const n21 = demo.days['2026-10-21'].food.length;
  sheet = page.locator('#sheetHost .sheet');
  const row = sheet.locator('[data-editfood][data-date="2026-10-21"]', { hasText: '珍珠奶茶' });
  const idx = +(await row.getAttribute('data-editfood'));
  await row.click();
  await page.locator('#eDel').click(); await page.locator('#eDel').click();
  await expect(page.locator('#sheetHost h2')).toHaveText('花費明細');
  await expect(page.locator('#ledTotal')).toHaveText('合計 NT$7,440 · 飲食 NT$6,990 · 物品 NT$450');
  const s = await store(page);
  expect(s.days['2026-10-21'].food).toHaveLength(n21 - 1);
  expect(s.days['2026-10-21'].food.map(f => f.name)).not.toContain(demo.days['2026-10-21'].food[idx].name);
  expect(s.days['2026-10-28'].food).toHaveLength(demo.days['2026-10-28'].food.length); // 首頁選取日的資料沒被動到
  expect(errors).toEqual([]);
});

test('P6：點物品列 → 修改物品 → 儲存後回到明細', async ({ page }) => {
  const errors = await openApp(page);
  const sheet = await openLedger(page);
  await sheet.locator('[data-edititem]').click();
  await expect(page.locator('#sheetHost h2')).toHaveText('修改物品');
  await page.locator('#iP').fill('500');
  await page.locator('#iSave').click();
  await expect(page.locator('#sheetHost h2')).toHaveText('花費明細');
  await expect(page.locator('#ledTotal')).toHaveText('合計 NT$7,545 · 飲食 NT$7,045 · 物品 NT$500');
  expect(errors).toEqual([]);
});

test('P6：沒有任何花費紀錄的月份顯示空狀態', async ({ page }) => {
  const errors = await openApp(page, { data: { ...demo, items: [], days: { '2026-10-28': { food: [{ name: '水煮蛋', k: 70, p: 6, c: 0, f: 5, meal: 'b' }], water: 0, ex: [], weight: null } } } });
  const sheet = await openLedger(page);
  await expect(sheet.locator('.empty')).toContainText('這個月沒有花費紀錄');
  await expect(sheet.locator('#ledPrev')).toBeDisabled();
  expect(errors).toEqual([]);
});
