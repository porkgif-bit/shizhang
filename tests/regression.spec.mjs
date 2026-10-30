// 回歸測試：第 1 階段複盤列出的「非黑即白」錯誤（規格書 1.3、8.1），以及舊備份匯入
import { test, expect } from '@playwright/test';
import { openApp, store, gotoDay, letter, fixture, fixturePath, TODAY } from './helpers.mjs';

// 評語開頭句，依等第分組（暱稱為示範資料的「示範」；過去日期用「這天／下次」）
const HEADS = {
  A: ['滿分級的一天，示範你就是自律本人 🏆', '帳目漂亮，阿鹽沒什麼好挑的。'],
  B: ['穩，差一點就是 A。', '很不錯的一天，小地方修一下。'],
  C: ['及格有餘，還有進步空間。', '中規中矩，主線有顧到。'],
  D: ['有在記，但有一項明顯掉了。', '勉強過關，有個洞要補。'],
  E: ['這天有點散，但你有記，這很重要。', '偏離目標了，問題很集中，好修。'],
  F: ['這天放飛了。一天不算數，趨勢才算數。', '分數很低，但重點是下次怎麼做。'],
};

test('P1：設定存檔後，週心得與下週目標仍在', async ({ page }) => {
  const errors = await openApp(page);
  const before = await store(page);
  expect(Object.keys(before.profile.weekNotes)).toContain('2026-10-19');
  await page.locator('#btnSettings').click();
  await page.locator('#sNick').fill('示範二號');
  await page.locator('#sSave').click();
  await expect(page.locator('#appTitle')).toHaveText('示範二號的食帳');
  const after = await store(page);
  expect(after.profile.nick).toBe('示範二號');
  expect(after.profile.weekNotes).toEqual(before.profile.weekNotes);
  expect(after.profile.weekGoals).toEqual(before.profile.weekGoals);
  expect(after.profile.history).toEqual(before.profile.history);
  expect(after.profile.supps).toEqual(before.profile.supps);
  // 重新整理後仍在（確認真的存進 localStorage，不只是畫面）
  await page.reload();
  await expect(page.locator('#appTitle')).toHaveText('示範二號的食帳');
  expect((await store(page)).profile.weekNotes).toEqual(before.profile.weekNotes);
  expect(errors).toEqual([]);
});

test('P7：補登過去日期後，大字等第、分數、評語出自同一次計算', async ({ page }) => {
  const errors = await openApp(page);
  const day = '2026-10-20';
  await gotoDay(page, day);
  const label0 = await page.locator('#gLabel').textContent();
  const [, s0] = label0.match(/結算 · (\d+) 分/) || [];
  expect(s0, `第一次看到 ${day} 應顯示「結算」：${label0}`).toBeTruthy();
  const locked = (await store(page)).days[day].grade;
  expect(locked).toMatchObject({ score: +s0, g: letter(+s0) });

  // 補登：油脂與堅果 10 份（450 kcal）＋添加糖 6 份，讓分數明顯下降
  await page.locator('#fab').click();
  await page.locator('[data-tab="ex"]').click();
  for (let i = 0; i < 20; i++) await page.locator('[data-inc="oil"]').click();
  for (let i = 0; i < 12; i++) await page.locator('[data-inc="sugar"]').click();
  await page.locator('#aAdd').click();
  await page.locator('#aClose').click();

  const label = await page.locator('#gLabel').textContent();
  const m = label.match(/補登後 (\d+) 分 · 結算時 ([A-F])（(\d+) 分）/);
  expect(m, `補登後標籤：${label}`).toBeTruthy();
  const [, s1, gWas, sWas] = m;
  expect(+s1).toBeLessThan(+s0);
  expect(gWas).toBe(locked.g); expect(+sWas).toBe(locked.score);
  const g1 = letter(+s1);
  await expect(page.locator('#gLetter')).toHaveText(g1);                 // 大字＝補登後新等第
  await expect(page.locator('#gWas')).toHaveText(`結算時 ${locked.g}`);   // 小字＝結算時等第
  const comment = await page.locator('#gComment').textContent();
  expect(HEADS[g1].some(h => comment.startsWith(h)), `評語應屬於 ${g1} 級：${comment}`).toBe(true);
  expect(comment).not.toMatch(/今天|明天/);                               // 過去日期用「這天／下次」
  expect((await store(page)).days[day].grade).toEqual(locked);           // 鎖定分數不被覆寫
  expect(errors).toEqual([]);
});

test('D1：加運動不改變可吃額度與熱量目標', async ({ page }) => {
  const errors = await openApp(page);
  const remain0 = await page.locator('#remain').textContent();
  const eaten0 = await page.locator('#eatenLine').textContent();
  await expect(page.locator('#chips')).not.toContainText('運動約');
  await page.locator('#exType').selectOption({ label: '重訓（高強度）（6）' });
  await page.locator('#exMin').fill('90');
  await page.locator('#exAdd').click();
  await expect(page.locator('#exList')).toContainText('重訓（高強度）');
  await expect(page.locator('#chips')).toContainText(/運動約 \d+ kcal（參考）/);
  await expect(page.locator('#remain')).toHaveText(remain0);
  await expect(page.locator('#eatenLine')).toHaveText(eaten0);
  // 飲水目標照 L3 增加 750 ml（1.5 小時 × 500）
  await expect(page.locator('#waterSum')).toContainText('/ 2350 ml');
  expect(errors).toEqual([]);
});

test('舊備份可匯入：全新裝置直接匯入', async ({ page }) => {
  const errors = await openApp(page, { data: null });
  await expect(page.locator('#sheetHost')).toContainText('歡迎使用每日食帳');
  await page.locator('#bkFile').setInputFiles(fixturePath('old-backup'));
  await expect(page.locator('#bkNote')).toHaveText('已匯入 5 天紀錄。');
  const s = await store(page), o = fixture('old-backup');
  expect(Object.keys(s.days).sort()).toEqual(Object.keys(o.days).sort());
  for (const k of Object.keys(o.days)) {
    expect(s.days[k].food.map(f => [f.name, f.k, f.p, f.c, f.f, f.meal])).toEqual(o.days[k].food.map(f => [f.name, f.k, f.p, f.c, f.f, f.meal]));
    expect(s.days[k].water).toBe(o.days[k].water);
  }
  expect(s.profile.weekNotes).toEqual(o.profile.weekNotes);
  expect(s.profile.history.map(h => h.n)).toEqual(['舊版示範：雞肉飯']);
  expect(s.days['2026-08-28'].full).toBe(true);
  // 匯入後首頁能正常計算
  await page.locator('#sheetHost .scrim').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#remain')).not.toHaveText('—');
  expect(errors).toEqual([]);
});

test('舊備份可匯入：已有資料時需再按一次確認，不重疊的日期保留', async ({ page }) => {
  const errors = await openApp(page);
  const before = await store(page);
  await page.locator('#bkFile').setInputFiles(fixturePath('old-backup'));
  await expect(page.locator('#bkNote')).toContainText('再按一次「確認匯入」才會寫入');
  expect(Object.keys((await store(page)).days)).not.toContain('2026-08-24'); // 還沒確認前不寫入
  await page.locator('#bkImportBtn').click();
  await expect(page.locator('#bkNote')).toHaveText('已匯入 5 天紀錄。');
  const s = await store(page);
  expect(Object.keys(s.days)).toEqual(expect.arrayContaining(['2026-08-24', '2026-08-28', TODAY, '2026-09-21']));
  expect(s.days[TODAY].food).toEqual(before.days[TODAY].food);
  expect(s.profile.nick).toBe('示範'); // 暱稱保留本機的
  expect(s.items).toEqual(before.items);
  expect(errors).toEqual([]);
});
