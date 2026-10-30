// P8：評語依「失分＝滿分－得分」挑弱項；失分相同時，配分大的優先
import { test, expect } from '@playwright/test';
import { openApp, store, fixture, TODAY } from './helpers.mjs';

const MAX = { 熱量: 35, 蛋白質: 25, 品質: 15, 飲水: 10, 紀錄: 10, 補給品: 5 };
const FIX = { 熱量: /熱量(超了|比目標少)/, 蛋白質: /蛋白質只到/, 品質: /脂肪佔熱量|鈉 [\d,]+ mg|添加糖 \d+ g/, 飲水: /水只喝了/, 紀錄: /沒記到|記得把運動/, 補給品: /補給品還有/ };

// 先讀出示範資料今天的熱量目標與蛋白質目標，再依此組出要測的那一天
async function targets(page) {
  await openApp(page);
  const T = +(await page.locator('#eatenLine').textContent()).match(/\/ ([\d,]+) kcal/)[1].replace(/,/g, '');
  const pT = +(await page.locator('#macros .macro').first().locator('small').textContent()).match(/([\d.]+) g/)[1];
  return { T, pT };
}
async function reopenWith(page, mutate) {
  const data = fixture('demo');
  data.profile.supps.forEach(s => { s.freq = 'daily'; }); // 三項都設為每天吃（P9 之前沒有這個欄位，全部計分，結果相同）
  mutate(data);
  await page.evaluate(d => localStorage.setItem('shizhang.v1', JSON.stringify(d)), data);
  await page.reload();
  await expect(page.locator('#gradeCard')).toBeVisible();
}
const parts = async page => Object.fromEntries((await page.locator('#gParts > div').allTextContents()).map(t => { const m = t.match(/^(.+?)(\d+)\/(\d+)$/); return [m[1], +m[2]]; }));
const meal = (meal, k, p, fatPct, na, s = 0) => ({ name: `示範 ${meal}`, k, p, c: Math.max(0, (k - p * 4 - k * fatPct) / 4), f: k * fatPct / 9, s, fb: 3, na, meal });

test('P8：使用者 10/28 回報的情況——熱量失 30 分以上時，評語講熱量，不是補給品', async ({ page }) => {
  const { T, pT } = await targets(page);
  await reopenWith(page, d => {
    const k = T * 1.4 / 3; // 吃到目標的 1.4 倍（熱量約 4/35，和回報的 5/35 同級）；脂肪佔 41%；鈉 3,000 mg；補給品都沒吃
    d.days[TODAY] = { food: [meal('b', k, pT / 2, 0.41, 1000), meal('l', k, pT / 2, 0.41, 1000), meal('d', k, pT / 2, 0.41, 1000)],
      water: 2000, waterLog: [{ ml: 2000, t: 1 }], ex: [], weight: null, supps: [] };
  });
  const P = await parts(page);
  expect(P.補給品).toBe(0);
  expect(P.熱量).toBeGreaterThan(0);                 // 舊算法用得分比例：熱量 >0、補給品 0，會挑補給品
  expect(MAX.熱量 - P.熱量).toBeGreaterThanOrEqual(29);
  const c = await page.locator('#gComment').textContent();
  expect(c, c).toMatch(FIX.熱量);
  expect(c).not.toMatch(FIX.補給品);
});

test('P8：失分相同時挑配分大的——飲水失 5（滿分 10）與補給品失 5（滿分 5），評語講飲水', async ({ page }) => {
  const { T, pT } = await targets(page);
  await reopenWith(page, d => {
    // 熱量剛好、品質滿分、三餐＋運動；蛋白質只到 88%（失 3 分，讓等第停在 B，才會出現建議句）；飲水一半；補給品沒吃
    const k = T / 3, p = pT * 0.88 / 3;
    d.days[TODAY] = { food: [meal('b', k, p, 0.25, 400), meal('l', k, p, 0.25, 400), meal('d', k, p, 0.25, 400)],
      water: 925, waterLog: [{ ml: 925, t: 1 }], ex: [{ name: '快走', met: 4.3, min: 30 }], weight: null, supps: [] };
  });
  const P = await parts(page);
  expect(P).toMatchObject({ 熱量: 35, 品質: 15, 飲水: 5, 紀錄: 10, 補給品: 0 });
  expect(MAX.蛋白質 - P.蛋白質).toBeLessThan(5);
  await expect(page.locator('#gLetter')).toHaveText('B');
  const c = await page.locator('#gComment').textContent();
  expect(c, c).toMatch(FIX.飲水);
  expect(c).not.toMatch(FIX.補給品);
});

test('P8：各種組合下，評語指向的項目永遠是失分最多的那一項', async ({ page }) => {
  const { T, pT } = await targets(page);
  const cases = [
    { k: 1.0, p: 0.5, fat: 0.25, na: 400, water: 2000, meals: 'bld' },  // 蛋白質失 12.5
    { k: 0.6, p: 1.2, fat: 0.25, na: 400, water: 2000, meals: 'bld' },  // 吃太少
    { k: 1.0, p: 1.2, fat: 0.25, na: 400, water: 2000, meals: 'b' },    // 只記一餐
    { k: 1.0, p: 1.2, fat: 0.45, na: 1600, water: 2000, meals: 'bld' }, // 品質失分
    { k: 1.0, p: 1.2, fat: 0.25, na: 400, water: 300, meals: 'bld' },   // 水太少
  ];
  for (const cs of cases) {
    await reopenWith(page, d => {
      const n = cs.meals.length;
      d.days[TODAY] = { food: [...cs.meals].map(m => meal(m, T * cs.k / n, pT * cs.p / n, cs.fat, cs.na)), water: cs.water, waterLog: [{ ml: cs.water, t: 1 }], ex: [], weight: null, supps: [] };
    });
    const P = await parts(page), c = await page.locator('#gComment').textContent();
    if (await page.locator('#gLetter').textContent() === 'A') continue; // A 只有開頭句
    const loss = Object.entries(P).map(([n, v]) => [n, MAX[n] - v]).sort((a, b) => b[1] - a[1] || MAX[b[0]] - MAX[a[0]]);
    // 畫面分數四捨五入到整數；失分最多的項目若和第二名差 1 分以上，才拿來斷言（避免四捨五入造成誤判）
    if (loss[0][1] - loss[1][1] >= 1) expect(c, `${JSON.stringify(cs)} → ${JSON.stringify(loss)}：${c}`).toMatch(FIX[loss[0][0]]);
  }
});
