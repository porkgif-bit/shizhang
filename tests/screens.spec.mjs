// 截圖比對：同一份示範資料、同一個時鐘下，畫面必須和基準逐像素相同。
// 基準在拆檔前（1bfd3b0）拍下；之後刻意改變畫面的修正，會在 commit 說明中寫出更新了哪張、為什麼。
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { openApp } from './helpers.mjs';

const hasBaseline = (name, info) => existsSync(new URL(`./__screenshots__/${name}-${process.platform}.png`, import.meta.url))
  || info.config.updateSnapshots === 'all' || info.config.updateSnapshots === 'changed';

const SCREENS = [
  { name: '01-首頁', open: null, fullPage: true },
  { name: '02-記一筆', open: '#fab', tall: true },
  { name: '03-週回顧', open: '#weekBtn', tall: true },
  { name: '04-物品與花費', open: '#itemsOpen', tall: true },
  { name: '05-設定', open: '#btnSettings', tall: true },
];

for (const s of SCREENS) {
  test(`截圖：${s.name}`, async ({ page }, info) => {
    test.skip(!hasBaseline(s.name, info), `這台電腦（${process.platform}）還沒有截圖基準；請在已知正確的版本執行 npm run baseline`);
    if (s.tall) await page.setViewportSize({ width: 390, height: 1600 }); // 底部彈出的面板拉高，能拍到更多內容
    const errors = await openApp(page);
    if (s.open) { await page.locator(s.open).click(); await expect(page.locator('#sheetHost .sheet')).toBeVisible(); }
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${s.name}.png`, { fullPage: !!s.fullPage });
    expect(errors).toEqual([]);
  });
}
