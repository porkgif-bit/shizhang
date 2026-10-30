// 預算設定畫面：在「物品與花費」最上方；可設分類（食＋現行 10 個物品分類）、金額、必要、固定開支；從本月起生效
import { test, expect } from '@playwright/test';
import { openApp, store, fixture } from './helpers.mjs';

const CATS = ['食', '住', '行', '衣', '育', '樂', '3C', '保養美妝', '居家民生', '寵物', '其他'];
const row = (page, c) => page.locator(`#sheetHost [data-bcat="${c}"]`);

async function openBudgetSheet(page) {
  await page.locator('#itemsOpen').click();
  await page.locator('[data-sec="budget"] #bgOpen').click();
  await expect(page.locator('#sheetHost h2')).toHaveText('每月預算');
}
async function setAmounts(page, m) { for (const [c, v] of Object.entries(m)) await row(page, c).locator('input[type=number]').fill(String(v)); }

test('預算設定：沒設時「物品與花費」最上方有說明與「設定預算」', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#itemsOpen').click();
  const sec = page.locator('[data-sec="budget"]');
  await expect(sec).toContainText('還沒設定');
  await expect(sec.locator('#bgOpen')).toHaveText('設定預算');
  expect(errors).toEqual([]);
});

test('預算設定：分類照統一順序；預設必要＝食、住、寵物，固定開支＝住；顯示本月實際', async ({ page }) => {
  const errors = await openApp(page);
  await openBudgetSheet(page);
  await expect(page.locator('#sheetHost [data-bcat]')).toHaveCount(CATS.length);
  expect(await page.locator('#sheetHost [data-bcat]').evaluateAll(els => els.map(e => e.dataset.bcat))).toEqual(CATS);
  for (const c of CATS) {
    await expect(row(page, c).locator('[data-ess]')).toBeChecked({ checked: ['食', '住', '寵物'].includes(c) });
    await expect(row(page, c).locator('[data-fix]')).toBeChecked({ checked: c === '住' });
    await expect(row(page, c).locator('input[type=number]')).toHaveValue('');
  }
  await expect(row(page, '食')).toContainText('本月 NT$7,045');
  await expect(row(page, '寵物')).toContainText('本月 NT$450');
  expect(errors).toEqual([]);
});

test('預算設定：存下寵物 2,000、住 17,800、食 6,500，從本月起生效，回到物品與花費看得到', async ({ page }) => {
  const errors = await openApp(page);
  await openBudgetSheet(page);
  await setAmounts(page, { '寵物': 2000, '住': 17800, '食': 6500 });
  await page.locator('#bgSave').click();
  await expect(page.locator('#toast')).toContainText('預算記好了，從 10 月開始算');
  await expect(page.locator('#sheetHost h2')).toHaveText('物品與花費');
  await expect(page.locator('[data-sec="budget"]')).toContainText('食 NT$6,500');
  await expect(page.locator('[data-sec="budget"]')).toContainText('住 NT$17,800（固定）');
  await expect(page.locator('[data-sec="budget"] #bgOpen')).toHaveText('調整預算');
  const b = (await store(page)).budgets.map(({ _t, ...x }) => x);
  expect(b).toEqual([
    { id: '2026-10:食', cat: '食', amount: 6500, from: '2026-10', essential: true },
    { id: '2026-10:住', cat: '住', amount: 17800, from: '2026-10', essential: true, fixed: true },
    { id: '2026-10:寵物', cat: '寵物', amount: 2000, from: '2026-10', essential: true }]);
  expect(errors).toEqual([]);
});

test('預算設定：同月再改覆寫同一筆；清空＝從本月起不設；沒改的分類不寫', async ({ page }) => {
  const errors = await openApp(page);
  await openBudgetSheet(page);
  await setAmounts(page, { '寵物': 2000, '食': 6500 });
  await page.locator('#bgSave').click();
  await page.locator('[data-sec="budget"] #bgOpen').click();
  await expect(row(page, '食').locator('input[type=number]')).toHaveValue('6500');
  await setAmounts(page, { '食': 7000, '寵物': '' });
  await row(page, '食').locator('[data-ess]').uncheck();
  await page.locator('#bgSave').click();
  const b = (await store(page)).budgets.map(({ _t, ...x }) => x);
  expect(b).toEqual([
    { id: '2026-10:食', cat: '食', amount: 7000, from: '2026-10' },
    { id: '2026-10:寵物', cat: '寵物', amount: 0, from: '2026-10', essential: true }]);
  await expect(page.locator('[data-sec="budget"]')).not.toContainText('寵物');
  expect(errors).toEqual([]);
});

test('預算設定：調整不影響以前的月份（另寫一筆本月的）', async ({ page }) => {
  const errors = await openApp(page, { data: { ...fixture('demo'), budgets: [{ id: '2026-09:食', cat: '食', amount: 5000, from: '2026-09', _t: 1 }] } });
  await openBudgetSheet(page);
  await expect(row(page, '食').locator('input[type=number]')).toHaveValue('5000');
  await setAmounts(page, { '食': 6500 });
  await page.locator('#bgSave').click();
  const b = (await store(page)).budgets.map(x => [x.id, x.amount]);
  expect(b).toEqual([['2026-09:食', 5000], ['2026-10:食', 6500]]);
  expect(errors).toEqual([]);
});

test('預算設定：金額不合理時不存並提示', async ({ page }) => {
  const errors = await openApp(page);
  await openBudgetSheet(page);
  await setAmounts(page, { '食': '1.5' });
  await page.locator('#bgSave').click();
  await expect(page.locator('#bgMsg')).toHaveText('食：金額請填 0～9,999,999 的整數，或留白。');
  expect((await store(page)).budgets || []).toEqual([]);
  expect(errors).toEqual([]);
});
