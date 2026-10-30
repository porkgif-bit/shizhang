// 截圖比對：同一份示範資料、同一個時鐘下，畫面必須和基準逐像素相同。
// 基準在拆檔前（1bfd3b0）拍下；之後刻意改變畫面的修正，會在 commit 說明中寫出更新了哪張、為什麼。
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { openApp, fixture } from './helpers.mjs';

// 預算測試值：寵物 2,000、住（房租，固定開支）17,800、食 6,500
const BUDGETS = [['食', 6500, {essential:true}], ['住', 17800, {essential:true, fixed:true}], ['寵物', 2000, {essential:true}]]
  .map(([cat, amount, more]) => ({ id: `2026-10:${cat}`, cat, amount, from: '2026-10', _t: 1, ...more }));

const SHOT_ENV = process.env.SHOT_ENV || process.platform; // 與 playwright.config.mjs 的 snapshotPathTemplate 一致
const hasBaseline = (name, info) => existsSync(new URL(`./__screenshots__/${name}-${SHOT_ENV}.png`, import.meta.url))
  || info.config.updateSnapshots === 'all' || info.config.updateSnapshots === 'changed';

const SCREENS = [
  { name: '01-首頁', open: null, fullPage: true },
  { name: '02-記一筆', open: '#fab', tall: true },
  { name: '03-週回顧', open: '#weekBtn', tall: true },
  { name: '04-物品與花費', open: '#itemsOpen', tall: true },
  { name: '05-設定', open: '#btnSettings', tall: true },
  { name: '06-花費明細', open: '#ledgerOpen', tall: true },
  { name: '07-預算設定', open: ['#itemsOpen', '#bgOpen'], tall: true },
  { name: '08-首頁預算', budgets: true, shot: '#spendCard' },
  { name: '09-明細預算對照', budgets: true, open: '#ledgerOpen', tall: true },
];

for (const s of SCREENS) {
  test(`截圖：${s.name}`, async ({ page }, info) => {
    // 本機沒有基準時略過；GitHub Actions 上沒有基準一律算失敗，不讓守門靜悄悄失效
    if (!hasBaseline(s.name, info)) {
      if (process.env.CI) throw new Error(`CI 缺少截圖基準 ${s.name}-${SHOT_ENV}.png：在已知正確的版本推一個 commit 說明含 [ci-baseline] 的 commit 讓 CI 重拍`);
      test.skip(true, `這個環境（${SHOT_ENV}）還沒有截圖基準；請在已知正確的版本執行 npm run baseline`);
    }
    if (s.tall) await page.setViewportSize({ width: 390, height: 1600 }); // 底部彈出的面板拉高，能拍到更多內容
    const errors = await openApp(page, s.budgets ? { data: { ...fixture('demo'), budgets: BUDGETS } } : {});
    for (const sel of [s.open].flat().filter(Boolean)) { await page.locator(sel).click(); await expect(page.locator('#sheetHost .sheet')).toBeVisible(); }
    await page.evaluate(() => document.fonts.ready);
    if (s.shot) await expect(page.locator(s.shot)).toHaveScreenshot(`${s.name}.png`);
    else await expect(page).toHaveScreenshot(`${s.name}.png`, { fullPage: !!s.fullPage });
    expect(errors).toEqual([]);
  });
}
