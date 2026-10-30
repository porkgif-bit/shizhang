// 首頁預算進度條（D10）與明細的預算對照／月底結算（5.2-J）
// 流水開支：刻度＝照日期應花到哪，超前標黃、超過標紅。固定開支（使用者 10/30 決定）：只看未付／已付，不標黃紅。
import { test, expect } from '@playwright/test';
import { openApp, store, fixture, gotoDay } from './helpers.mjs';

const B = (cat, amount, from, more = {}) => ({ id: `${from}:${cat}`, cat, amount, from, _t: 1, ...more });
// 預算測試值：寵物 2,000、住（房租）17,800、食 6,500
const TEST_BUDGETS = [B('食', 6500, '2026-10', { essential: true }), B('住', 17800, '2026-10', { essential: true, fixed: true }), B('寵物', 2000, '2026-10', { essential: true })];
const withBudgets = (budgets = TEST_BUDGETS, extra = {}) => ({ ...fixture('demo'), budgets, ...extra });
const bar = (page, c) => page.locator(`#spendBudget [data-bgcat="${c}"]`);

test('首頁預算：沒設預算時不顯示任何預算列', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#spendBudget')).toBeHidden();
  expect(errors).toEqual([]);
});

test('首頁預算：依統一分類順序；食超過標紅、寵物正常、住（固定）顯示還沒付', async ({ page }) => {
  const errors = await openApp(page, { data: withBudgets() });
  await expect(page.locator('#spendBudget [data-bgcat]')).toHaveCount(3);
  expect(await page.locator('#spendBudget [data-bgcat]').evaluateAll(els => els.map(e => e.dataset.bgcat))).toEqual(['食', '住', '寵物']);
  // 食：7,045 / 6,500 → 超過 545
  await expect(bar(page, '食')).toHaveClass(/\bover\b/);
  await expect(bar(page, '食')).toContainText('NT$7,045 / NT$6,500');
  await expect(bar(page, '食')).toContainText('超過 NT$545');
  // 刻度：10/28 是 31 天裡的第 28 天 → 90.3%
  await expect(bar(page, '食').locator('.tick')).toHaveAttribute('style', /left:\s*90\.3%/);
  // 寵物：450 / 2,000＝22.5%，低於日期進度 → 正常
  await expect(bar(page, '寵物')).toHaveClass(/\bok\b/);
  await expect(bar(page, '寵物')).toContainText('剩 NT$1,550');
  // 住：固定開支，沒有刻度、不標黃紅
  await expect(bar(page, '住')).toHaveClass(/\bfixed\b/);
  await expect(bar(page, '住')).not.toHaveClass(/\b(over|ahead)\b/);
  await expect(bar(page, '住')).toContainText('還沒付 · 預算 NT$17,800');
  await expect(bar(page, '住').locator('.tick')).toHaveCount(0);
  await expect(page.locator('#spendBudget')).toContainText('刻度＝照日期應花到哪');
  expect(errors).toEqual([]);
});

test('首頁預算：比日期進度快但還沒超過 → 標黃', async ({ page }) => {
  const errors = await openApp(page, { data: withBudgets([B('寵物', 480, '2026-10')]) });
  // 450 / 480＝93.8%，日期進度 90.3% → 超前
  await expect(bar(page, '寵物')).toHaveClass(/\bahead\b/);
  await expect(bar(page, '寵物')).toContainText('剩 NT$30 · 比日期進度快');
  expect(errors).toEqual([]);
});

test('首頁預算：固定開支點「還沒付」→ 預填分類與金額的新增物品；記下後顯示本月已付，超過預算也不標紅', async ({ page }) => {
  const errors = await openApp(page, { data: withBudgets() });
  await bar(page, '住').click();
  await expect(page.locator('#sheetHost h2')).toHaveText('新增物品');
  await expect(page.locator('#iCat [data-v="住"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#iP')).toHaveValue('17800');
  await expect(page.locator('#iAsk')).not.toBeChecked();
  await page.locator('#iN').fill('示範房租');
  await page.locator('#iP').fill('18000');
  await page.locator('#iSave').click();
  await expect(bar(page, '住')).toContainText('本月已付 NT$18,000 · 比預算多 NT$200');
  await expect(bar(page, '住')).not.toHaveClass(/\b(over|ahead)\b/);
  const it = (await store(page)).items.find(x => x.name === '示範房租');
  expect(it).toMatchObject({ cat: '住', price: 18000, type: 'gen', date: '2026-10-28' });
  expect(it.ask).toBeUndefined();
  expect(errors).toEqual([]);
});

test('首頁預算：點流水開支那列 → 明細篩選該分類', async ({ page }) => {
  const errors = await openApp(page, { data: withBudgets() });
  await bar(page, '寵物').click();
  await expect(page.locator('#sheetHost h2')).toHaveText('花費明細');
  await expect(page.locator('#ledCat [data-v="寵物"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sheetHost [data-edititem]')).toHaveCount(1);
  await expect(page.locator('#sheetHost [data-editfood]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('首頁預算：看過去月份時用那個月有效的預算，刻度在 100%', async ({ page }) => {
  const errors = await openApp(page, { data: withBudgets([B('食', 5000, '2026-09'), ...TEST_BUDGETS]) });
  await gotoDay(page, '2026-09-25');
  await expect(page.locator('#spendBudget [data-bgcat]')).toHaveCount(1);
  await expect(bar(page, '食')).toContainText('NT$2,980 / NT$5,000');
  await expect(bar(page, '食')).toHaveClass(/\bok\b/);
  await expect(bar(page, '食').locator('.tick')).toHaveAttribute('style', /left:\s*100%/);
  expect(errors).toEqual([]);
});

test('明細：有預算時顯示預算對照；過去月份標「結算」，差額為預算減實際', async ({ page }) => {
  const errors = await openApp(page, { data: withBudgets([B('食', 5000, '2026-09'), ...TEST_BUDGETS]) });
  await page.locator('#ledgerOpen').click();
  const t = page.locator('#ledBudget');
  await expect(t.locator('h3')).toHaveText('預算對照（10 月到目前）');
  const rows = async () => t.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.cells].map(c => c.textContent.trim())));
  expect(await rows()).toEqual([
    ['食', '6,500', '7,045', '−545'],
    ['住（固定）', '17,800', '0', '+17,800'],
    ['寵物', '2,000', '450', '+1,550'],
  ]);
  await expect(t.locator('tbody tr').first().locator('td').last()).toHaveClass(/\bneg\b/);
  await expect(t.locator('tfoot')).toContainText('合計26,3007,495+18,805');
  await page.locator('#ledPrev').click();
  await expect(t.locator('h3')).toHaveText('預算結算（9 月）');
  expect(await rows()).toEqual([['食', '5,000', '2,980', '+2,020']]);
  // 沒有預算的月份不顯示對照
  await page.locator('#ledPrev').click();
  await expect(page.locator('#ledBudget')).toHaveCount(0);
  expect(errors).toEqual([]);
});
