// 記帳當下看得到剩餘額度（D10）＋ 80%／100% 各提醒一次（跨過門檻那一筆才說）。固定開支不提醒。
import { test, expect } from '@playwright/test';
import { openApp, store, fixture, gotoDay } from './helpers.mjs';

const B = (cat, amount, from = '2026-10', more = {}) => ({ id: `${from}:${cat}`, cat, amount, from, _t: 1, ...more });
const data = budgets => ({ ...fixture('demo'), budgets });
// 10/28：本月剩 4 天（28、29、30、31）

async function addFood(page, cost) {
  await page.locator('#sheetHost [data-fi]').first().click();
  await page.locator('#aCost').fill(String(cost));
  await page.locator('#aAdd').click();
}

test('記一筆：沒設食費預算時，填金額也不出現額度提示', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#fab').click();
  await page.locator('#aCost').fill('100');
  await expect(page.locator('#aBudget')).toBeHidden();
  expect(errors).toEqual([]);
});

test('記一筆：打開就看到本月食費剩多少、每天可用多少；填金額即時改成「記下後」', async ({ page }) => {
  const errors = await openApp(page, { data: data([B('食', 10000)]) });
  await page.locator('#fab').click();
  // 10,000 − 7,045 ＝ 2,955；÷ 4 天 ＝ 738.75
  await expect(page.locator('#aBudget')).toHaveText('本月食費剩 NT$2,955，接下來每天可用 NT$739');
  await page.locator('#aCost').fill('100');
  await expect(page.locator('#aBudget')).toHaveText('記下後，本月食費剩 NT$2,855，接下來每天可用 NT$714');
  await expect(page.locator('#aBudget')).not.toHaveClass(/warn/);
  expect(errors).toEqual([]);
});

test('記一筆：已經超過（測試值 6,500）時用警示色', async ({ page }) => {
  const errors = await openApp(page, { data: data([B('食', 6500)]) });
  await page.locator('#fab').click();
  await expect(page.locator('#aBudget')).toHaveText('本月食費已超過 NT$545');
  await expect(page.locator('#aBudget')).toHaveClass(/warn/);
  await page.locator('#aCost').fill('55');
  await expect(page.locator('#aBudget')).toHaveText('記下後，本月食費超過 NT$600');
  expect(errors).toEqual([]);
});

test('記一筆：記過去月份只顯示那個月剩多少，不算每天可用', async ({ page }) => {
  const errors = await openApp(page, { data: data([B('食', 5000, '2026-09'), B('食', 6500)]) });
  await gotoDay(page, '2026-09-25');
  await page.locator('#fab').click();
  await expect(page.locator('#aBudget')).toHaveText('9 月食費剩 NT$2,020');
  expect(errors).toEqual([]);
});

test('提醒：跨過 80% 那一筆提醒一次，之後不重複；跨過 100% 再提醒一次', async ({ page }) => {
  const errors = await openApp(page, { data: data([B('食', 9000)]) });
  await page.locator('#fab').click();
  await addFood(page, 200); // 7,045 → 7,245（80.5%）
  await expect(page.locator('#toast')).toContainText('本月食費已用 81%，剩 NT$1,755。');
  await addFood(page, 100); // 7,345：已經在 80% 以上，不再提醒
  await expect(page.locator('#toast')).not.toContainText('本月食費');
  await addFood(page, 1700); // 9,045：跨過 100%
  await expect(page.locator('#toast')).toContainText('本月食費超過預算 NT$45 了');
  await addFood(page, 10); // 已經超過，不再提醒
  await expect(page.locator('#toast')).not.toContainText('本月食費');
  expect(errors).toEqual([]);
});

test('提醒：修改飲食金額讓食費跨過 100% 也會提醒', async ({ page }) => {
  const errors = await openApp(page, { data: data([B('食', 7200)]) });
  await page.locator('#meals [data-editfood]', { hasText: '鮭魚握壽司' }).click();
  await page.locator('#eCost').fill('400'); // 7,045 − 160 ＋ 400 ＝ 7,285
  await page.locator('#eSave').click();
  await expect(page.locator('#toast')).toContainText('本月食費超過預算 NT$85 了');
  expect(errors).toEqual([]);
});

test('物品表單：依選到的分類顯示剩餘額度；修改既有物品時不重複算它自己；跨過 80% 提醒', async ({ page }) => {
  const errors = await openApp(page, { data: data([B('寵物', 2000)]) });
  await page.locator('#itemAddBtn').click();
  await expect(page.locator('#iBudget')).toBeHidden(); // 還沒選分類
  await page.locator('#iCat [data-v="寵物"]').click();
  await expect(page.locator('#iBudget')).toHaveText('本月寵物預算剩 NT$1,550，接下來每天可用 NT$388');
  await page.locator('#iP').fill('300');
  await expect(page.locator('#iBudget')).toHaveText('記下後，本月寵物預算剩 NT$1,250，接下來每天可用 NT$313');
  await page.locator('#iCat [data-v="衣"]').click();
  await expect(page.locator('#iBudget')).toBeHidden(); // 衣沒設預算
  await page.locator('#iCat [data-v="寵物"]').click();
  await page.locator('#iN').fill('示範飼料');
  await page.locator('#iP').fill('1300'); // 450 ＋ 1,300 ＝ 1,750（87.5%）
  await page.locator('#iSave').click();
  await expect(page.locator('#toast')).toContainText('本月寵物預算已用 88%，剩 NT$250。');
  // 修改貓砂（450）：不能把它自己算兩次
  await page.locator('#itemsOpen').click();
  await page.locator('[data-sec="all"] [data-edititem]', { hasText: '示範貓砂' }).click();
  await expect(page.locator('#iBudget')).toHaveText('記下後，本月寵物預算剩 NT$250，接下來每天可用 NT$63');
  expect(errors).toEqual([]);
});

test('固定開支：表單只說已付／還沒付，記下繳費不跳提醒', async ({ page }) => {
  const errors = await openApp(page, { data: data([B('住', 17800, '2026-10', { fixed: true })]) });
  await page.locator('#itemAddBtn').click();
  await page.locator('#iCat [data-v="住"]').click();
  await expect(page.locator('#iBudget')).toHaveText('本月住還沒付（預算 NT$17,800）');
  await page.locator('#iN').fill('示範房租');
  await page.locator('#iP').fill('17800');
  await expect(page.locator('#iBudget')).toHaveText('記下後，本月住已付 NT$17,800（預算 NT$17,800）');
  await page.locator('#iSave').click();
  await expect(page.locator('#toast')).not.toContainText('預算');
  expect((await store(page)).items.some(x => x.name === '示範房租')).toBe(true);
  expect(errors).toEqual([]);
});
