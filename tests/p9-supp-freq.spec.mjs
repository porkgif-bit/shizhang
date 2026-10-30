// P9：補給品新增 freq（daily 每天吃／prn 需要時才吃）；只有每天吃的計分；
// 既有品項沒有 freq：管理頁請使用者逐項選，選之前當作需要時才吃、不扣分
import { test, expect } from '@playwright/test';
import { openApp, store, fixture, TODAY } from './helpers.mjs';

const suppScore = async page => +(await page.locator('#gParts > div', { hasText: '補給品' }).textContent()).match(/(\d+)\/5/)[1];
const took = (id, name) => ({ id, name, t: Date.parse('2026-10-28T08:00:00+08:00'), qty: 1, items: [] });
const withSupps = (freqs, takenIds) => {
  const d = fixture('demo');
  d.profile.supps.forEach((s, i) => { if (freqs[i]) s.freq = freqs[i]; else delete s.freq; });
  d.days[TODAY].supps = takenIds.map(id => took(id, d.profile.supps.find(s => s.id === id).name));
  return d;
};
// 示範補給品：dmB01 B 群、dmD02 維生素 D、dmZn3 鋅（不舒服時吃）

test('P9：需要時才吃的品項沒吃不扣分；每天吃的沒吃才扣分', async ({ page }) => {
  // B 群、D 每天吃且都吃了；鋅需要時才吃、沒吃 → 5/5
  await openApp(page, { data: withSupps(['daily', 'daily', 'prn'], ['dmB01', 'dmD02']) });
  expect(await suppScore(page)).toBe(5);
  await expect(page.locator('#gComment')).not.toContainText('示範鋅');
  await expect(page.locator('#suppList')).toContainText('需要時');
});

test('P9：每天吃的沒吃照樣扣分，評語只列每天吃的品項', async ({ page }) => {
  // B 群每天吃、沒吃；D、鋅需要時才吃 → 0/5
  await openApp(page, { data: withSupps(['daily', 'prn', 'prn'], ['dmZn3']) });
  expect(await suppScore(page)).toBe(0);
  const c = await page.locator('#gComment').textContent();
  if (/補給品還有/.test(c)) { expect(c).toContain('示範 B 群'); expect(c).not.toMatch(/示範維生素 D|示範鋅/); }
});

test('P9：沒有每天吃的品項 → 補給品 5 分直接給滿', async ({ page }) => {
  await openApp(page, { data: withSupps(['prn', 'prn', 'prn'], []) });
  expect(await suppScore(page)).toBe(5);
});

test('P9：舊品項沒有頻率 → 選之前不扣分；管理頁逐項選，選完才開始計分', async ({ page }) => {
  const errors = await openApp(page, { data: withSupps([null, null, null], []) }); // 三項都沒吃
  expect(await suppScore(page)).toBe(5);
  await expect(page.locator('#freqHint')).toContainText('有 3 項還沒選');

  await page.locator('#suppManage').click();
  const ask = page.locator('#freqAsk');
  await expect(ask).toContainText('每一項多久吃一次？');
  await expect(ask.locator('.crow')).toHaveCount(3);
  await ask.locator('[data-setfreq="dmB01"][data-v="daily"]').click();
  await expect(page.locator('#freqAsk .crow')).toHaveCount(2);
  await page.locator('#freqAsk [data-setfreq="dmD02"][data-v="daily"]').click();
  await page.locator('#freqAsk [data-setfreq="dmZn3"][data-v="prn"]').click();
  await expect(page.locator('#freqAsk')).toHaveCount(0);       // 全部選完，問題消失
  await expect(page.locator('.mlist')).toContainText('每天吃');
  await page.locator('#sDone').click();

  const s = await store(page);
  expect(Object.fromEntries(s.profile.supps.map(x => [x.id, x.freq]))).toEqual({ dmB01: 'daily', dmD02: 'daily', dmZn3: 'prn' });
  await expect(page.locator('#freqHint')).toHaveCount(0);
  expect(await suppScore(page)).toBe(0);                          // 兩項每天吃的都沒吃，開始計分
  // 吃了 B 群 → 2.5 分（畫面四捨五入）
  await page.locator('[data-takesupp="dmB01"]').click();
  expect(await suppScore(page)).toBe(3);
  await page.reload();
  await page.locator('#suppManage').click();
  await expect(page.locator('#freqAsk')).toHaveCount(0);         // 選過就不再問
  expect(errors).toEqual([]);
});

test('P9：需要時才吃的品項照常打卡、照常檢查每日上限', async ({ page }) => {
  await openApp(page, { data: withSupps(['daily', 'daily', 'prn'], []) });
  for (let i = 0; i < 3; i++) await page.locator('[data-takesupp="dmZn3"]').click(); // 鋅 15 mg × 3 ＝ 45 mg，上限 35
  await expect(page.locator('#toast')).toContainText('超過每日上限 35 mg');
  await expect(page.locator('#suppTotals .overchip')).toContainText('鋅');
  expect((await store(page)).days[TODAY].supps.filter(x => x.id === 'dmZn3')).toHaveLength(3);
});

test('P9：新增與編輯補給品可選頻率，存檔後保留', async ({ page }) => {
  const errors = await openApp(page, { data: withSupps(['daily', 'daily', 'prn'], []) });
  await page.locator('#suppManage').click();
  await page.locator('#sNew').click();
  await expect(page.locator('#fsFreq [aria-pressed=true]')).toHaveText('每天吃');  // 新增預設每天吃
  await page.locator('#fsName').fill('示範鎂');
  await page.locator('#fsItems .iN').selectOption('mg');
  await page.locator('#fsItems .iA').fill('100');
  await page.locator('#fsFreq button', { hasText: '需要時才吃' }).click();
  await page.locator('#fsSave').click();
  await expect(page.locator('.mlist')).toContainText('示範鎂');
  let s = (await store(page)).profile.supps.find(x => x.name === '示範鎂');
  expect(s.freq).toBe('prn');
  // 編輯 B 群（每天吃）只改顆數，頻率不能被洗掉
  await page.locator('[data-editsupp="dmB01"]').click();
  await expect(page.locator('#fsFreq [aria-pressed=true]')).toHaveText('每天吃');
  await page.locator('#fsDose').fill('2');
  await page.locator('#fsSave').click();
  s = (await store(page)).profile.supps.find(x => x.id === 'dmB01');
  expect(s).toMatchObject({ dose: 2, freq: 'daily' });
  expect(errors).toEqual([]);
});

test('P9：編輯還沒選頻率的品項，不選就不能存', async ({ page }) => {
  await openApp(page, { data: withSupps([null, 'daily', 'prn'], []) });
  await page.locator('#suppManage').click();
  await page.locator('[data-editsupp="dmB01"]').click();
  await expect(page.locator('#fsFreq [aria-pressed=true]')).toHaveCount(0);
  await page.locator('#fsSave').click();
  await expect(page.locator('#fsErr')).toHaveText('請選多久吃一次。');
  expect((await store(page)).profile.supps.find(x => x.id === 'dmB01').freq).toBeUndefined();
});

test('P9：計分方式更新（v4），過去用舊規則鎖定、分數因此改變的日子標「舊制」，不誤標「補登」', async ({ page }) => {
  const d = withSupps([null, null, null], []);
  const day = '2026-10-21';
  d.days[day].supps = [];                    // 這天補給品都沒吃：舊規則扣 5 分
  d.days[day].grade = { v: 3, g: 'B', score: 80 };
  await openApp(page, { data: d });
  await page.locator('#week [data-wk="-7"]').click();
  await page.locator(`#week [data-day="${day}"]`).click();
  const label = await page.locator('#gLabel').textContent();
  expect(label).not.toContain('補登');
  expect(label).toMatch(/舊制 B（80 分，計分方式已更新）|結算 · 80 分/);
  expect((await store(page)).days[day].grade).toEqual({ v: 3, g: 'B', score: 80 }); // 舊鎖定原樣保留
});
