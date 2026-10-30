// P11：可以點開修改的列，要看得出來可以點。
// 規則：畫面上任何會打開「修改」的元素（data-edititem、data-editfood）都必須帶「›」箭頭；
// 有這種列的區塊，標題旁要有「點一下可修改」。之後新增的可修改列也會被這條規則抓到。
import { test, expect } from '@playwright/test';
import { openApp, gotoDay } from './helpers.mjs';

const HINT = '點一下可修改';
const REMIND = '記錯了？到物品與花費點這一筆就能改';

async function everyEditableHasChevron(root) {
  const eds = root.locator('[data-edititem], [data-editfood]');
  const n = await eds.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const chev = eds.nth(i).locator('.chev');
    await expect(chev, `第 ${i + 1} 個可修改列沒有箭頭：${await eds.nth(i).innerText()}`).toHaveText('›');
    await expect(chev).toBeVisible();
  }
  return n;
}

test('P11：物品與花費裡每個可修改的列都有「›」，四個區塊標題都有提示', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#itemsOpen').click();
  const sheet = page.locator('#sheetHost .sheet');
  await expect(sheet).toBeVisible();
  // 示範資料：全部物品 6 件＋大件 2 件＋後悔 1 件＋消耗品 2 組
  expect(await everyEditableHasChevron(sheet)).toBe(11);
  for (const [sec, n] of [['all', 6], ['big', 2], ['regret', 1], ['cons', 2]]) {
    await expect(sheet.locator(`[data-sec="${sec}"] h3`)).toContainText(HINT);
    await expect(sheet.locator(`[data-sec="${sec}"] [data-edititem]`)).toHaveCount(n);
  }
  expect(errors).toEqual([]);
});

test('P11：消耗品回購週期的列可以點，打開最近一次購買', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#itemsOpen').click();
  await page.locator('[data-sec="cons"] [data-edititem]', { hasText: '示範洗髮精' }).click();
  await expect(page.locator('#sheetHost h2')).toHaveText('修改物品');
  await expect(page.locator('#iN')).toHaveValue('示範洗髮精');
  await expect(page.locator('#iP')).toHaveValue('299'); // 兩次購買中較新的那一筆（9/14）
  await expect(page.locator('#iD')).toHaveValue('2026-09-14');
  expect(errors).toEqual([]);
});

test('P11：首頁飲食列都有「›」，飲食標題有提示', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#meals [data-editfood]').first()).toBeVisible();
  await everyEditableHasChevron(page.locator('#meals'));
  await expect(page.locator('#foodHint')).toHaveText(HINT);
  // 箭頭在點擊範圍內：點箭頭就打開修改
  await page.locator('#meals [data-editfood] .chev').first().click();
  await expect(page.locator('#sheetHost .sheet')).toBeVisible();
  expect(errors).toEqual([]);
});

test('P11：沒有飲食紀錄的日子，飲食標題不顯示提示', async ({ page }) => {
  const errors = await openApp(page);
  await gotoDay(page, '2026-09-14'); // 示範資料從 9/21 開始記
  await expect(page.locator('#meals [data-editfood]')).toHaveCount(0);
  await expect(page.locator('#foodHint')).toBeHidden();
  expect(errors).toEqual([]);
});

test('P11：新增物品、儲存修改後，提示記錯時到哪裡改', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#itemsOpen').click();
  await page.locator('#iAdd').click();
  await page.locator('#iN').fill('示範雨傘');
  await page.locator('#iP').fill('350');
  await page.locator('#iCat [data-v="其他"]').click();
  await page.locator('#iSave').click();
  await expect(page.locator('#toast')).toContainText('示範雨傘 記好了');
  await expect(page.locator('#toast')).toContainText(REMIND);
  // 回到清單，新物品也有箭頭
  await expect(page.locator('[data-sec="all"] [data-edititem]', { hasText: '示範雨傘' }).locator('.chev')).toHaveText('›');
  await page.locator('[data-sec="all"] [data-edititem]', { hasText: '示範雨傘' }).click();
  await page.locator('#iP').fill('380');
  await page.locator('#iSave').click();
  await expect(page.locator('#toast')).toContainText('示範雨傘 已更新');
  await expect(page.locator('#toast')).toContainText(REMIND);
  expect(errors).toEqual([]);
});
