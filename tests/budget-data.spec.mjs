// 預算資料層（5.2-J）：頂層 budgets[]，逐筆 id＋_t 合併；依 from 決定每月有效金額；匯入只留合理值；舊備份照常匯入
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { openApp, store, fixture, fixturePath } from './helpers.mjs';

const B = (cat, amount, from, more = {}) => ({ id: `${from}:${cat}`, cat, amount, from, essential: false, _t: 1, ...more });

test('預算資料：每月有效金額取 from ≤ 該月中最新的一筆；amount 0 代表從那個月起不設', async ({ page }) => {
  const data = { ...fixture('demo'), budgets: [B('食', 5000, '2026-09'), B('食', 6500, '2026-10'), B('住', 17800, '2026-09', { fixed: true }), B('住', 0, '2026-10'), B('寵物', 2000, '2026-10', { del: true })] };
  const errors = await openApp(page, { data });
  const got = await page.evaluate(async () => {
    const c = await import('./core.js');
    const a = (cat, ym) => { const b = c.effBudget(cat, ym); return b ? b.amount : null; };
    return [a('食', '2026-08'), a('食', '2026-09'), a('食', '2026-10'), a('食', '2027-03'), a('住', '2026-09'), a('住', '2026-10'), a('寵物', '2026-10'), c.effBudget('住', '2026-09').fixed];
  });
  expect(got).toEqual([null, 5000, 6500, 6500, 17800, null, null, true]);
  expect(errors).toEqual([]);
});

test('預算資料：存檔、同步合併逐筆比 _t，新的贏；不認得的遠端欄位不會讓 App 出錯', async ({ page }) => {
  const errors = await openApp(page);
  const out = await page.evaluate(async () => {
    const c = await import('./core.js');
    c.saveBudget({ id: '2026-10:食', cat: '食', amount: 6500, from: '2026-10', essential: true });
    const local = JSON.parse(localStorage.getItem('shizhang.v1')).budgets;
    const t = c.budgets[0]._t;
    c.merge({ budgets: [{ id: '2026-10:食', cat: '食', amount: 1, from: '2026-10', _t: t - 1 }, { id: '2026-10:寵物', cat: '寵物', amount: 2000, from: '2026-10', _t: 5 }] });
    const afterOld = c.budgets.map(b => [b.id, b.amount]);
    c.merge({ budgets: [{ id: '2026-10:食', cat: '食', amount: 7000, from: '2026-10', _t: t + 1 }] });
    return { local, afterOld, afterNew: c.budgets.map(b => [b.id, b.amount]) };
  });
  expect(out.local).toEqual([expect.objectContaining({ id: '2026-10:食', cat: '食', amount: 6500, from: '2026-10', essential: true })]);
  expect(out.afterOld).toEqual([['2026-10:食', 6500], ['2026-10:寵物', 2000]]);
  expect(out.afterNew).toEqual([['2026-10:食', 7000], ['2026-10:寵物', 2000]]);
  expect(errors).toEqual([]);
});

test('預算資料：匯出備份帶 budgets；匯入只留合理值，之後才開放的分類（水電電信）也保留', async ({ page }, info) => {
  const budgets = [
    B('食', 6500, '2026-10', { essential: true }), B('住', 17800, '2026-10', { essential: true, fixed: true }),
    B('水電電信', 1200, '2026-10'),
    { id: 'bad1', cat: '亂寫', amount: 100, from: '2026-10' }, { id: 'bad2', cat: '食', amount: -5, from: '2026-10' },
    { id: 'bad3', cat: '食', amount: 1.5, from: '2026-10' }, { id: 'bad4', cat: '食', amount: 100, from: '2026-13' }, { cat: '食', amount: 100, from: '2026-10' }];
  const backup = { app: '每日食帳', version: 1, profile: fixture('demo').profile, days: {}, items: [], budgets };
  // 路徑避開中文：檔名或資料夾有中文時，setInputFiles 不會觸發 change
  const path = `${info.project.outputDir}/budget-backup-${info.workerIndex}.json`; mkdirSync(info.project.outputDir, { recursive: true }); writeFileSync(path, JSON.stringify(backup));
  const errors = await openApp(page, { data: null });
  await page.locator('#bkFile').setInputFiles(path);
  await expect(page.locator('#bkNote')).toHaveText('已匯入 0 天紀錄。');
  const got = (await store(page)).budgets.map(({ _t, ...b }) => b);
  expect(got).toEqual([
    { id: '2026-10:食', cat: '食', amount: 6500, from: '2026-10', essential: true },
    { id: '2026-10:住', cat: '住', amount: 17800, from: '2026-10', essential: true, fixed: true },
    { id: '2026-10:水電電信', cat: '水電電信', amount: 1200, from: '2026-10' }]);
  // 匯出：檔案裡有 budgets
  await page.locator('#sheetHost .scrim').click({ position: { x: 5, y: 5 } });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#bkJson').click()]);
  const out = JSON.parse((await import('node:fs')).readFileSync(await dl.path(), 'utf8'));
  expect(out.budgets.map(b => b.id)).toEqual(['2026-10:食', '2026-10:住', '2026-10:水電電信']);
  expect(errors).toEqual([]);
});

test('預算資料：沒有 budgets 的舊備份照常匯入，budgets 為空', async ({ page }) => {
  const errors = await openApp(page, { data: null });
  await page.locator('#bkFile').setInputFiles(fixturePath('old-backup'));
  await expect(page.locator('#bkNote')).toHaveText('已匯入 5 天紀錄。');
  expect((await store(page)).budgets).toEqual([]);
  expect(errors).toEqual([]);
});
