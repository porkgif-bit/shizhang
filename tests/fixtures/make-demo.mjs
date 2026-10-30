// 產生示範資料（全部虛構，不含任何真實紀錄）。固定亂數種子，每次產生的內容一樣。
// 用法：node tests/fixtures/make-demo.mjs  → 寫出 tests/fixtures/demo.json
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let seed = 20261028;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const r1 = n => Math.round(n * 10) / 10;
const T0 = Date.UTC(2026, 9, 28, 12, 0, 0); // 時間戳的基準，和測試鎖定的時鐘同一天

const ymd = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

// 品名, kcal, P, C, F, 添加糖, 纖維, 鈉, 金額
const B = [['鮪魚蛋餅', 380, 18, 40, 16, 0, 1.5, 620, 55], ['無糖豆漿＋饅頭', 330, 16, 52, 6, 0, 2.5, 280, 45],
  ['地瓜＋茶葉蛋 ×2', 310, 15, 40, 10, 0, 4, 520, 50], ['燕麥優格', 290, 14, 42, 7, 6, 5, 110, 0]];
const L = [['雞腿便當', 780, 38, 92, 28, 2, 4, 1450, 110], ['滷肉飯＋燙青菜＋蛋花湯', 690, 20, 95, 24, 3, 3.5, 1650, 95],
  ['鮭魚握壽司 8 貫', 520, 26, 78, 10, 8, 1.5, 1100, 160], ['雞胸沙拉＋地瓜', 480, 36, 50, 14, 2, 8, 680, 140],
  ['牛肉麵', 720, 34, 82, 26, 2, 3, 2300, 150]];
const D = [['自煮：糙米飯＋清蒸魚＋炒青菜', 620, 36, 70, 18, 0, 7, 780, 0], ['水餃 12 顆＋酸辣湯', 690, 28, 84, 26, 3, 3, 1900, 100],
  ['鍋貼 10 個', 650, 22, 70, 30, 1, 2.5, 1500, 80], ['自煮：雞胸＋花椰菜＋白飯', 560, 42, 62, 12, 0, 6, 520, 0],
  ['義大利麵（青醬）', 760, 24, 88, 34, 2, 4, 1300, 220]];
const S = [['珍珠奶茶（半糖）', 330, 2, 58, 10, 28, 0, 90, 55, true], ['香蕉', 105, 1.3, 27, 0.4, 0, 3, 1, 0, false],
  ['洋芋片 半包', 270, 3, 26, 17, 1, 2, 300, 35, false], ['無糖綠茶', 0, 0, 0, 0, 0, 0, 10, 30, true]];

const mk = (row, meal) => { const [name, k, p, c, f, s, fb, na, cost] = row;
  const e = { name, k, p, c, f, s, fb, na, meal }; if (cost) e.cost = cost; if (meal === 's') e.snack = true; return e; };

const SUPPS = [
  { id: 'dmB01', name: '示範 B 群', dose: 1, when: '早餐', items: [{ n: 'b6', amt: 20 }, { n: 'niacin', amt: 15 }] },
  { id: 'dmD02', name: '示範維生素 D', dose: 1, when: '午餐', items: [{ n: 'vitd', amt: 25 }] },
  { id: 'dmZn3', name: '示範鋅（不舒服時吃）', dose: 1, when: '', items: [{ n: 'zn', amt: 15 }] }];

const days = {};
const START = '2026-09-21', TODAY = '2026-10-28';
let w = 60.4, k = START, i = 0, wid = 0;
while (k <= TODAY) {
  const d = { food: [], water: 0, ex: [], weight: null };
  const today = k === TODAY;
  if (rnd() > 0.12 || today) d.food.push(mk(pick(B), 'b'));
  d.food.push(mk(pick(L), 'l'));
  if (!today) d.food.push(mk(pick(D), 'd'));
  if (rnd() < 0.45) {
    const sn = pick(S), e = mk(sn, 's');
    if (sn[9]) { e.wid = 'dw' + (++wid); }
    d.food.push(e);
    if (e.wid) { d.waterLog = [{ ml: 500, t: T0 - (30 - i) * 864e5, from: e.name, wid: e.wid }]; d.water = 500; }
  }
  const cups = today ? 3 : 4 + Math.floor(rnd() * 4);
  d.waterLog = d.waterLog || [];
  for (let c = 0; c < cups; c++) { const ml = pick([240, 300, 450]); d.waterLog.push({ ml, t: T0 - (40 - i) * 864e5 + c * 36e5 }); d.water += ml; }
  if (rnd() < 0.4 && !today) d.ex.push({ name: '重訓（一般）', met: 3.5, min: 45 });
  if (rnd() < 0.2 && !today) d.ex.push({ name: '快走', met: 4.3, min: 30 });
  w -= 0.035 + (rnd() - 0.5) * 0.05;
  if (i % 2 === 0 || today) d.weight = r1(w + (rnd() - 0.5) * 0.4);
  if (rnd() < 0.7) d.supps = [{ id: 'dmB01', name: '示範 B 群', t: T0 - (37 - i) * 864e5, qty: 1, items: [{ n: 'b6', amt: 20 }, { n: 'niacin', amt: 15 }] }];
  d._t = T0 - (37 - i) * 864e5;
  days[k] = d; k = addDays(k, 1); i++;
}
// 10/22 只記一餐並標記「這天就吃這些」
days['2026-10-22'].food = days['2026-10-22'].food.filter(f => f.meal === 'l'); days['2026-10-22'].full = true;
// 9/21–9/27 已鎖定舊制分數（v2），模擬 D1 前結算的日子
['2026-09-21', '2026-09-22', '2026-09-23'].forEach((x, j) => { days[x].grade = { v: 2, g: ['A', 'B', 'C'][j], score: [91, 84, 73][j] }; });

const hist = {};
Object.keys(days).forEach(x => days[x].food.forEach(f => { const h = hist[f.name] || (hist[f.name] = { n: f.name, k: f.k, p: f.p, c: f.c, f: f.f, s: f.s, fb: f.fb, na: f.na, per: true, cnt: 0 });
  h.cnt++; h.last = x; if (f.cost) h.cost = f.cost; }));

const profile = {
  nick: '示範', sex: 'f', age: 30, height: 160, weight: 60.5, bf: 0, pal: 1.4, deficit: 0.15, pkg: 1.2,
  history: Object.values(hist).sort((a, b) => b.last.localeCompare(a.last) || b.cnt - a.cnt),
  customFoods: [{ n: '示範高蛋白飲', k: 160, p: 25, c: 8, f: 3, s: 2, fb: 1, na: 150, per: true }],
  cups: [240, 300, 450], supps: SUPPS, meds: [],
  weekNotes: { '2026-10-19': { hard: 3, keep: '示範：早餐都有吃', hardText: '示範：週五聚餐', next: '示範：晚餐少油', t: T0 - 4 * 864e5 } },
  weekGoals: { '2026-10-26': [{ type: 'fat', v: 55, text: '示範：脂肪每天 55 g 以內' }] },
  tdeeVer: 2, _t: T0 - 864e5,
};

const items = [
  { id: 'dmI1', name: '示範筆電', price: 32000, date: '2025-12-01', type: 'big', cat: '3C', years: 4, ask: true, review: { v: 'good', note: '每天都在用', at: '2026-01-05' }, _t: T0 - 300 * 864e5 },
  { id: 'dmI2', name: '示範洗髮精', price: 289, date: '2026-08-02', type: 'cons', cat: '保養美妝', _t: T0 - 90 * 864e5 },
  { id: 'dmI3', name: '示範洗髮精', price: 299, date: '2026-09-14', type: 'cons', cat: '保養美妝', _t: T0 - 44 * 864e5 },
  { id: 'dmI4', name: '示範貓砂', price: 450, date: '2026-10-03', type: 'cons', cat: '寵物', _t: T0 - 25 * 864e5 },
  { id: 'dmI5', name: '示範外套', price: 1680, date: '2026-09-20', type: 'gen', cat: '衣', ask: true, _t: T0 - 38 * 864e5 },
  { id: 'dmI6', name: '示範空氣炸鍋', price: 2490, date: '2026-07-10', type: 'big', cat: '居家民生', years: 5, ask: true, review: { v: 'regret', note: '示範：很少用', at: '2026-08-12' }, _t: T0 - 110 * 864e5 },
];

const out = { profile, days, items };
writeFileSync(fileURLToPath(new URL('./demo.json', import.meta.url)), JSON.stringify(out, null, 1) + '\n');
console.log('demo.json：', Object.keys(days).length, '天，', items.length, '件物品');
