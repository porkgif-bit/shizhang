/* 每日食帳 · diet.js — 飲食：參考資料、熱量與營養計算、首頁、設定、記一筆、修改紀錄、飲水、阿鹽評語、每日評分、指數說明 */
import { $, MEALS, N0, TODAY, addDays, clamp01, closeSheet, dayOf, days, esc, hasData, isLogged, items, mainsOf, meta, mmdd, n0na, newId, now, openSheet, parseYmd, pickOne, profile, r0, r1, saveDay, saveProfile, sel, setProfile, setSel, toast, weekStart, who } from './core.js';
import { avoidMsg, renderCare } from './care.js';
import { openItemForm, openItems, renderSpend } from './money.js';
import { renderWeekCard } from './review.js';


/* ---------- reference data ---------- */
// 國健署 食物代換表（每 1 份）。熱量與三大營養素依代換表；
// 纖維 fb(g)、鈉 na(mg) 為代換表沒有的粗估值；s 只計添加糖，原型食物的天然糖記 0
export const EXCH = [
  {id:'grain', n:'全穀雜糧', d:'飯 1/4 碗、吐司 1/2 片、地瓜 1/2 個', k:70, p:2, c:15, f:0, s:0, fb:0.6, na:5},
  {id:'meatL', n:'豆魚蛋肉（低脂）', d:'雞胸 30 g、魚 35 g、蝦仁 50 g、豆漿 190 ml', k:55, p:7, c:0, f:3, s:0, fb:0, na:40},
  {id:'meatM', n:'豆魚蛋肉（中脂）', d:'雞蛋 1 顆、豆腐 80 g、豬里肌 35 g', k:75, p:7, c:0, f:5, s:0, fb:0, na:60},
  {id:'meatH', n:'豆魚蛋肉（高脂）', d:'五花肉、香腸 40 g、秋刀魚', k:120, p:7, c:0, f:10, s:0, fb:0, na:250},
  {id:'milkF', n:'乳品（全脂）', d:'鮮奶 240 ml', k:150, p:8, c:12, f:8, s:0, fb:0, na:105},
  {id:'milkL', n:'乳品（低脂）', d:'低脂奶 240 ml', k:120, p:8, c:12, f:4, s:0, fb:0, na:110},
  {id:'veg', n:'蔬菜', d:'生菜 100 g、煮熟約半碗', k:25, p:1, c:5, f:0, s:0, fb:2, na:25},
  {id:'fruit', n:'水果', d:'拳頭大 1 個、切塊 1 碗', k:60, p:0, c:15, f:0, s:0, fb:1.8, na:2},
  {id:'oil', n:'油脂與堅果', d:'油 1 茶匙 5 g、堅果 1 湯匙', k:45, p:0, c:0, f:5, s:0, fb:0, na:0},
  {id:'salt', n:'調味（外食醬汁）', d:'醬油 1 茶匙、滷汁或醬料一小匙', k:5, p:0.5, c:0.5, f:0, s:0, fb:0, na:300},
  {id:'sugar', n:'添加糖', d:'砂糖 5 g、半糖飲料約每 100 ml 4 g', k:20, p:0, c:5, f:0, s:5, fb:0, na:0}
];
// 常見食物：近似值（每 100 g 或 100 ml），請以包裝標示為準
// 欄位：品名, kcal, 蛋白質, 碳水, 脂肪, 單位, 每單位克數, 添加糖 g, 纖維 g, 鈉 mg（後三項皆每 100 g）
export const FOODS = [
  ['白飯',183,3.1,41,0.3,'碗',200,0,0.6,2],['糙米飯',178,3.7,37,1.2,'碗',200,0,1.6,4],['地瓜（蒸）',114,1.3,27,0.2,'條',150,0,2.5,20],
  ['燕麥片（乾）',389,13,66,7,'份',40,0,10,5],['全麥吐司',270,10,48,4,'片',35,5,6,450],['饅頭',245,7,49,1.5,'個',100,6,1.5,250],
  ['水煮蛋',134,12.7,1.8,8.9,'顆',55,0,0,140],['茶葉蛋',134,12.7,1.8,8.9,'顆',55,0,0,330],['雞胸肉（熟）',165,31,0,3.6,'份',100,0,0,75],
  ['雞腿肉去皮（熟）',180,26,0,8,'份',100,0,0,90],['鮭魚（熟）',206,22,0,12.4,'片',100,0,0,60],['蝦仁（熟）',99,24,0.2,0.3,'份',100,0,0,220],
  ['板豆腐',88,8.5,5,3.4,'塊',140,0,0.6,5],['嫩豆腐',51,4.9,2,2.5,'盒',300,0,0.3,5],['無糖豆漿',35,3.6,0.7,1.9,'杯',400,0,1.3,15],
  ['鮮乳（全脂）',63,3.1,4.8,3.6,'杯',240,0,0,45],['無糖優格',70,3.5,5,4,'杯',200,0,0,50],['希臘優格（無糖）',97,9,4,5,'杯',150,0,0,40],
  ['香蕉',85,1.5,22,0.1,'根',100,0,1.6,1],['蘋果',51,0.3,14,0.2,'顆',200,0,1.6,1],['芭樂',38,0.7,9.6,0.1,'顆',160,0,3,5],
  ['燙青菜（無油）',22,1.5,3.5,0.3,'份',100,0,2.2,30],['綠花椰菜',23,2.5,4,0.2,'份',100,0,3.1,30],['綜合堅果',600,18,20,50,'湯匙',15,0,8,5],
  ['食用油',884,0,0,100,'茶匙',5,0,0,0],['御飯糰（鮪魚）',190,4.5,36,3,'個',105,2,1,420],['南部肉粽（估）',210,7,28,8,'顆',200,1,1,350],
  ['四神湯（估）',60,3.5,6,2.5,'碗',350,0,0.5,250],['滷肉飯（估）',190,5.5,26,7,'碗',200,3,0.6,330],['陽春麵（估）',105,3.8,18,2,'碗',400,0,0.6,300],
  ['全糖手搖飲（估）',45,0,11,0,'杯',700,10,0,5],['半糖手搖飲（估）',25,0,6,0,'杯',700,5,0,5]
].map(([n,k,p,c,f,u,g,s,fb,na]) => ({n,k,p,c,f,u,g,s,fb,na}));
export const METS = [
  ['重訓（一般）',3.5],['重訓（高強度）',6.0],['徒手／彈力帶（中等）',3.8],['走路（一般）',3.5],['快走',4.3],
  ['慢跑',7.0],['騎腳踏車（休閒）',5.8],['游泳（休閒）',6.0],['爬樓梯（慢）',4.0],['瑜伽',2.5],['跳繩（中等）',9.0],['打掃（費力）',3.5]
];
export const PALS = [[1.40,'整天坐著'],[1.55,'坐為主、偶爾走動'],[1.70,'常走動或站著工作'],[1.90,'勞力工作']];
export function curWeight(date = sel){
  const ds = Object.keys(days).filter(k => k <= date && days[k].weight).sort();
  return ds.length ? days[ds[ds.length-1]].weight : profile.weight;
}
export function calc(date){
  const W = curWeight(date);
  const bf = N0(profile.bf);
  const ffm = bf > 0 ? W * (1 - bf/100) : null;
  const bmrMethod = ffm ? 'cunningham' : 'mifflin';
  const bmr = ffm ? 370 + 21.6*ffm : 10*W + 6.25*profile.height - 5*profile.age + (profile.sex === 'm' ? 5 : -161);
  const tdeeFormula = bmr * profile.pal;
  const tdee = profile.tdeeOverride || tdeeFormula;
  const d = dayOf(date);
  const exNet = d.ex.reduce((s,e) => s + Math.max(0, (e.met-1)) * W * e.min/60, 0);
  const exHours = d.ex.reduce((s,e) => s + e.min/60, 0);
  const floor = Math.max(bmr, 1200);
  const base = Math.max(tdee * (1 - profile.deficit), floor);
  const target = base; // D1：運動估算消耗只顯示、不加進可吃額度；實測 TDEE 已包含訓練效果
  const pT = profile.pkg * W, fT = target * 0.25 / 9, cT = Math.max(0, (target - pT*4 - fT*9) / 4);
  const eat = d.food.reduce((s,f) => ({k:s.k+f.k, p:s.p+f.p, c:s.c+f.c, f:s.f+f.f, s:s.s+N0(f.s), fb:s.fb+N0(f.fb), na:s.na+N0(f.na)}), {k:0,p:0,c:0,f:0,s:0,fb:0,na:0});
  const waterT = 1600 + 500 * exHours;
  const sT = target * 0.10 / 4, fbT = target / 1000 * 14, naT = 2300;
  return {W, bf, ffm, bmrMethod, bmr, tdee, tdeeFormula, exNet, exHours, floor, base, target, floorHit: tdee*(1-profile.deficit) < floor,
    pT, fT, cT, sT, fbT, naT, eat, waterT, d};
}

/* ---------- render ---------- */
export const WD = ['日','一','二','三','四','五','六'];
export function renderWeek(){
  const d = parseYmd(sel); const mon = addDays(sel, -((d.getDay()+6)%7));
  let h = '<button class="arrow" data-wk="-7" aria-label="上一週">‹</button>';
  for (let i=0;i<7;i++){ const k = addDays(mon,i), dd = parseYmd(k);
    h += `<button class="day${k===sel?' sel':''}${k===TODAY?' today':''}${hasData(k)?' logged':''}" data-day="${k}" aria-label="${k}"><span class="wd">${WD[dd.getDay()]}</span><span class="d">${dd.getDate()}</span><span class="dot"></span></button>`; }
  h += '<button class="arrow" data-wk="7" aria-label="下一週">›</button>';
  $('#week').innerHTML = h;
}
export function render(){
  renderWeek();
  if (!profile) return;
  $('#appTitle').textContent = profile.nick ? profile.nick + '的食帳' : '每日食帳';
  const R = calc(sel), e = R.eat;
  const remain = R.target - e.k;
  $('#remain').textContent = remain >= 0 ? r0(remain).toLocaleString() : '超過 ' + r0(-remain).toLocaleString();
  $('#remain').classList.toggle('over', remain < 0);
  $('#eatenLine').innerHTML = `已吃 <b>${r0(e.k).toLocaleString()}</b> / ${r0(R.target).toLocaleString()} kcal`;
  const frac = Math.min(1, e.k / R.target);
  $('#ringVal').setAttribute('stroke-dashoffset', (314.16 * (1-frac)).toFixed(1));
  $('#ringVal').classList.toggle('over', remain < 0);
  $('#chips').innerHTML =
    `<button class="chip" data-explain="bmr">BMR <b>${r0(R.bmr)}</b></button>` +
    `<button class="chip" data-explain="tdee">TDEE <b>${r0(R.tdee)}</b>${profile.tdeeOverride?'（實測）':''}</button>` +
    (R.exNet ? `<button class="chip" data-explain="ex">運動約 <b>${r0(R.exNet)}</b> kcal（參考）</button>` : '') +
    (R.floorHit ? `<button class="chip" data-explain="target">已套用下限</button>` : '');
  const m = (key, name, eat, tgt, col, kcalPer) => {
    const pct = e.k ? r0(eat*kcalPer / e.k * 100) : 0;
    return `<button class="macro" data-explain="${key}"><span class="name">${name}</span><span class="v">${r0(eat)}<small> / ${r0(tgt)} g</small></span>
      <div class="bar"><i style="width:${Math.min(100, eat/tgt*100||0)}%;background:${col}"></i></div><span class="pct">${e.k?'佔熱量 '+pct+'%':' '}</span></button>`; };
  $('#macros').innerHTML = m('protein','蛋白質', e.p, R.pT, 'var(--protein)', 4) + m('carb','碳水', e.c, R.cT, 'var(--carb)', 4) + m('fat','脂肪', e.f, R.fT, 'var(--fat)', 9);
  // 上限型（糖、鈉）超過會變色；下限型（纖維）是要吃到
  const mm = (key, name, eat, tgt, unit, col, kind) => {
    const over = kind === 'max' && eat > tgt;
    const note = kind === 'max' ? (over ? `超過 ${r0(eat-tgt)} ${unit}` : `上限，還有 ${r0(tgt-eat)}`) : (eat >= tgt ? '達標' : `還差 ${r0(tgt-eat)} ${unit}`);
    return `<button class="macro${kind==='max'?' limit':''}${over?' over':''}" data-explain="${key}"><span class="name">${name}</span><span class="v">${r0(eat).toLocaleString()}<small> / ${r0(tgt).toLocaleString()}${unit==='mg'?'':' '+unit}</small></span>
      <div class="bar"><i style="width:${Math.min(100, eat/tgt*100||0)}%;background:${col}"></i></div><span class="pct">${note}</span></button>`; };
  $('#micros').innerHTML = mm('sugar','添加糖', e.s, R.sT, 'g', 'var(--protein)', 'max') + mm('fiber','纖維', e.fb, R.fbT, 'g', 'var(--accent)', 'min') + mm('sodium','鈉 mg', e.na, R.naT, 'mg', 'var(--water)', 'max');
  // tip
  let tip = '';
  const gapP = R.pT - e.p;
  if (sel === TODAY && e.k > 0) {
    if (remain < 0) tip = `今天已超過目標 ${r0(-remain)} kcal。一天的波動不影響趨勢，明天照常就好。`;
    else if (gapP > 7) tip = `蛋白質還差 ${r0(gapP)} g，約 ${r1(gapP/7)} 份豆魚蛋肉（1 份＝雞蛋 1 顆或無糖豆漿 190 ml）。`;
    else if (remain > 300) tip = `蛋白質已達標，還有 ${r0(remain)} kcal 可以分配給蔬菜、全穀和水果。`;
  }
  $('#tip').hidden = !tip; $('#tip').textContent = tip;
  // meals
  const d = R.d;
  const foodCost = d.food.reduce((s,f) => s + N0(f.cost), 0);
  $('#foodSum').textContent = `${d.food.length} 筆` + (foodCost ? ` · NT$${foodCost.toLocaleString()}` : '');
  $('#foodHint').hidden = !d.food.length; // P11：有可修改的列才提示
  $('#meals').innerHTML = d.food.length ? MEALS.map(([mk, ml]) => {
    const items = d.food.map((f,i) => ({...f, i})).filter(f => f.meal === mk);
    if (!items.length) return '';
    const sum = items.reduce((s,f)=>s+f.k,0);
    return `<div class="meal"><h3><span>${ml}</span><span class="num">${r0(sum)} kcal</span></h3>` + items.map(f =>
      `<div class="row fr"><button type="button" class="erow" data-editfood="${f.i}" aria-label="修改 ${esc(f.name)}"><div class="t"><div class="nm">${esc(f.name)}${f.snack?'<span class="tag">零食</span>':''}</div><div class="m">${N0(f.cost)?`NT$${N0(f.cost).toLocaleString()} · `:''}P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}${N0(f.na)?` · 鈉 ${r0(f.na)}`:''}${N0(f.s)?` · 糖 ${r1(f.s)}`:''}</div></div><span class="k">${r0(f.k)}</span><span class="chev" aria-hidden="true">›</span></button><button class="del" data-delfood="${f.i}" aria-label="刪除 ${esc(f.name)}">×</button></div>`).join('') + '</div>';
  }).join('') : `<div class="empty">${sel===TODAY?'今天還沒記錄。點下方「記一筆」，用份數最快。':'這天沒有飲食紀錄。'}</div>`;
  // 記錄完整度：0–1 餐的日子可標「這天就吃這些」
  const needFull = d.food.length && mainsOf(d) < 2 && sel <= TODAY;
  $('#fullRow').hidden = !needFull;
  $('#fullRow').innerHTML = !needFull ? '' : d.full
    ? `<span>✓ 已標記這天就吃這些，算進記錄天數。</span><button class="btn ghost" id="fullOff">取消標記</button>`
    : `<span>只記到${mainsOf(d) ? '一餐' : '點心'}。如果這天真的就吃這些，標記一下才會算進記錄天數；沒標記的當作可能漏記，不納入 TDEE 回推。</span><button class="btn" id="fullOn">這天就吃這些</button>`;
  // water
  $('#waterSum').textContent = `${d.water} / ${r0(R.waterT)} ml`;
  $('#waterFill').style.width = Math.min(100, d.water / R.waterT * 100) + '%';
  const wl = d.waterLog || [];
  const cupsN = wl.filter(x => !x.old).length;
  $('#waterLog').textContent = wl.length ? `今天 ${cupsN} 杯：` + wl.map(x => (x.old ? '之前 ' : '') + x.ml + (x.from ? `（${x.from}）` : '')).join(' + ') + ' ml' : '';
  $('#cupUndo').hidden = !wl.length;
  $('#cupUndo').textContent = wl.length ? `復原上一杯（${wl[wl.length-1].ml} ml）` : '復原上一杯';
  renderCups();
  renderCare();
  // exercise
  $('#exSum').textContent = R.exNet ? `淨 ${r0(R.exNet)} kcal` : '';
  $('#exList').innerHTML = d.ex.length ? d.ex.map((x,i) =>
    `<div class="row"><div class="t"><div>${esc(x.name)}</div><div class="m">${x.min} 分 · MET ${x.met}</div></div><span class="k">${r0((x.met-1)*R.W*x.min/60)}</span><button class="del" data-delex="${i}" aria-label="刪除">×</button></div>`).join('') : '<div class="empty">沒有運動紀錄。</div>';
  // weight
  $('#wtSum').textContent = d.weight ? `${d.weight} kg` : `目前以 ${R.W} kg 計算`;
  $('#wtIn').value = d.weight || '';
  renderCalib(R);
  renderTdeeNotice(R);
  renderGrade();
  renderWeekCard();
  renderSpend();
}

// 實測校正：近 28 天平均攝取 − 體重斜率 × 7,700。D1 後不再扣運動，回推值直接代表含訓練的總消耗
// 窗口：最近 4 個已過完的日曆週（週一到週日）。攝取只取記錄 ≥6 天之週的記錄日；體重用窗口內全部紀錄（5.1）
export function calibData(){
  const end = addDays(weekStart(TODAY), -1), start = addDays(end, -27);
  const weeks = [0,1,2,3].map(i => { const ws = addDays(start, i*7), ks = Array.from({length:7}, (_, j) => addDays(ws, j));
    const logged = ks.filter(isLogged); return {ws, logged, ok: logged.length >= 6}; });
  const okWeeks = weeks.filter(w => w.ok).length;
  const intakeDays = weeks.filter(w => w.ok).flatMap(w => w.logged);
  const wts = Object.keys(days).filter(k => k >= start && k <= end && days[k].weight).sort().map(k => [ (parseYmd(k)-parseYmd(start))/864e5, days[k].weight ]);
  const span = wts.length ? wts[wts.length-1][0] - wts[0][0] : 0;
  const base = {start, end, okWeeks, nIn:intakeDays.length, nW:wts.length};
  if (intakeDays.length < 14 || wts.length < 4 || span < 10) return {ok:false, ...base};
  const n = wts.length, mx = wts.reduce((s,w)=>s+w[0],0)/n, my = wts.reduce((s,w)=>s+w[1],0)/n;
  const slope = wts.reduce((s,w)=>s+(w[0]-mx)*(w[1]-my),0) / wts.reduce((s,w)=>s+(w[0]-mx)**2,0);
  const avgIn = intakeDays.reduce((s,k)=>s+days[k].food.reduce((a,f)=>a+f.k,0),0) / intakeDays.length;
  return {ok:true, ...base, slope, avgIn, obs: avgIn - slope*7700};
}
export function renderCalib(R){
  const C = calibData();
  let h;
  if (!C.ok) {
    h = `<div class="note">實測校正：用最近 4 個完整週（${mmdd(C.start)}–${mmdd(C.end)}），只算記錄 ≥6 天的週。需合格週的記錄日 ≥14 天、≥4 次體重（跨 10 天以上）。目前 ${C.okWeeks}/4 週合格、${C.nIn} 天可用、${C.nW} 次體重。</div>`;
  } else {
    const {slope, avgIn, obs} = C;
    const diff = (obs - R.tdeeFormula) / R.tdeeFormula;
    h = `<div class="note">${mmdd(C.start)}–${mmdd(C.end)}：4 週中 ${C.okWeeks} 週記錄滿 6 天，採計 ${C.nIn} 天飲食</div>
      <div>體重趨勢 <b class="num">${slope>=0?'+':''}${r1(slope*7)}</b> kg／週；平均攝取 <b class="num">${r0(avgIn)}</b> kcal</div>
      <div>回推每日總消耗約 <b class="num">${r0(obs)}</b> kcal（含運動；公式 ${r0(R.tdeeFormula)}，差 ${r0(diff*100)}%）</div>
      ${Math.abs(diff) > 0.10 ? '<div class="note warn">差距超過 10%，可考慮改用實測值。紀錄若有漏記，實測值會偏低。</div>' : '<div class="note">與公式差距在 10% 內。</div>'}
      <div class="btnrow">${profile.tdeeOverride ? '<button class="btn" id="calOff">改回公式值</button>' : ''}<button class="btn" id="calOn" data-v="${r0(obs)}">採用 ${r0(obs)} kcal</button></div>`;
  }
  $('#calib').innerHTML = h;
}
export const TDEE_VER = 2; // 2＝D1 後的實測公式（不扣運動）
export function renderTdeeNotice(R){
  const el = $('#tdeeNotice');
  const need = profile.tdeeOverride && profile.tdeeVer !== TDEE_VER;
  el.hidden = !need; if (!need) { el.innerHTML = ''; return; }
  const C = calibData();
  el.innerHTML = `計算方式已更新：運動消耗不再加進可吃額度，實測 TDEE 也不再扣掉運動。你目前採用的 ${r0(profile.tdeeOverride)} kcal 是舊算法，通常偏低，建議重新校正。`
    + (C.ok ? '' : `<br>最近 4 個完整週的紀錄還不夠重算（需記錄滿 6 天的週合計 ≥14 天、≥4 次體重），可以先改回公式值，等紀錄夠了再校正。`)
    + `<div class="btnrow">${C.ok ? `<button class="btn primary" id="tnNew" data-v="${r0(C.obs)}">採用新值 ${r0(C.obs)} kcal</button>` : ''}`
    + `<button class="btn" id="tnFormula">改回公式值 ${r0(R.tdeeFormula)} kcal</button><button class="btn ghost" id="tnKeep">先保留</button></div>`;
}

export function openSettings(first){
  const p = profile || {sex:'f', height:'', weight:'', age:'', pal:1.40, deficit:0.15, pkg:1.2};
  openSheet(`
    <h2>${first ? '先建立你的基本資料' : '設定'}</h2>
    ${first ? '<div class="note">只存在這個 App 的私人資料區，用來計算 BMR 與每日目標。</div>' : ''}
    <div class="field">暱稱（阿鹽會這樣叫你，可留空）<input id="sNick" maxlength="12" placeholder="例如 搭檔" value="${esc(p.nick||'')}"></div>
    <div class="grid2">
      <label>生理性別<select id="sSex"><option value="f">女</option><option value="m">男</option></select></label>
      <label>年齡<input id="sAge" type="number" inputmode="numeric" min="18" max="100" value="${p.age}"></label>
      <label>身高 cm<input id="sH" type="number" inputmode="decimal" min="120" max="220" value="${p.height}"></label>
      <label>體重 kg<input id="sW" type="number" inputmode="decimal" step="0.1" min="30" max="250" value="${p.weight}"></label>
      <label>體脂率 %（選填）<input id="sBf" type="number" inputmode="decimal" step="0.1" min="5" max="60" placeholder="有量才填" value="${p.bf||''}"></label>
    </div>
    <div class="field">日常活動<div class="seg" id="sPal">${PALS.map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${v===p.pal}">${l} ${v.toFixed(2)}</button>`).join('')}</div></div>
    <div class="field">減重赤字<div class="seg" id="sDef">${[0,0.10,0.15,0.20].map(v=>`<button type="button" data-v="${v}" aria-pressed="${v===p.deficit}">${v?Math.round(v*100)+'%':'維持'}</button>`).join('')}</div></div>
    <div class="field">蛋白質 g/kg<div class="seg" id="sPk">${[1.0,1.2,1.4,1.6].map(v=>`<button type="button" data-v="${v}" aria-pressed="${v===p.pkg}">${v.toFixed(1)}</button>`).join('')}</div></div>
    <div class="note" id="sNote"></div>
    <div class="btnrow"><button class="btn primary" id="sSave">儲存</button>${first?'<button class="btn ghost" id="sImport">我有備份檔，從備份匯入</button>':'<button class="btn ghost" id="sCancel">取消</button>'}</div>
    <div class="note">資料保存：${meta.linked ? '存在你自己 Google 雲端的 App 專用資料夾，換手機登入同一個帳號就會同步回來；其他人看不到你的資料。' : '目前只存在這支手機的瀏覽器，清除網站資料會遺失。建議按右上角「連結 Google 雲端」。'}<br>iOS 健康 App 無法從網頁連接，需要原生 App 才能讀寫，等上架版再做。</div>
  `, () => {
    $('#sSex').value = p.sex;
    ['#sPal','#sDef','#sPk'].forEach(id => $(id).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
    $('#sCancel') && ($('#sCancel').onclick = closeSheet);
    $('#sImport') && ($('#sImport').onclick = () => { closeSheet(); $('#bkFile').value = ''; $('#bkFile').click(); });
    $('#sSave').onclick = () => {
      const pick = id => +$(id+' [aria-pressed=true]').dataset.v;
      // 在原 profile 上更新設定欄位；weekNotes、weekGoals、history 等其他欄位原樣保留（P1）
      const base = profile || {};
      const n = {...base, nick:$('#sNick').value.trim().slice(0,12), sex:$('#sSex').value, age:+$('#sAge').value, height:+$('#sH').value, weight:+$('#sW').value, bf:(+$('#sBf').value >= 5 && +$('#sBf').value <= 60) ? r1(+$('#sBf').value) : 0,
        pal:pick('#sPal'), deficit:pick('#sDef'), pkg:pick('#sPk')};
      ['history','supps','meds','customFoods'].forEach(k => { if (!Array.isArray(n[k])) n[k] = []; });
      if (n.cups !== undefined && !Array.isArray(n.cups)) delete n.cups;
      if (!(n.age>=18 && n.age<=100 && n.height>=120 && n.height<=220 && n.weight>=30 && n.weight<=250)) {
        $('#sNote').className = 'note warn'; $('#sNote').textContent = '請填年齡 18–100、身高 120–220 cm、體重 30–250 kg。'; return; }
      setProfile(n); saveProfile(); closeSheet(); render();
    };
  });
}

export function openAdd(){
  const defMeal = (() => { const h = new Date().getHours(); return h < 10 ? 'b' : h < 15 ? 'l' : h < 21 ? 'd' : 's'; })();
  let tab = (profile.history||[]).length ? 'food' : 'ex', counts = {}, pick = null;
  openSheet(`
    <h2>記一筆 · ${sel === TODAY ? '今天' : sel}</h2>
    <div class="seg" id="aMeal">${MEALS.map(([k,l])=>`<button type="button" data-v="${k}" aria-pressed="${k===defMeal}">${l}</button>`).join('')}</div>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="ex" aria-selected="${tab==='ex'}">份數</button>
      <button role="tab" data-tab="food" aria-selected="${tab==='food'}">找食物</button>
      <button role="tab" data-tab="custom" aria-selected="false">營養標示</button>
    </div>
    <div id="aBody"></div>
    <div class="sum" id="aSum"></div>
    <div class="inline wtoggle"><label class="note"><input id="aWater" type="checkbox"> 也算進飲水</label>
      <input id="aWaterMl" type="number" inputmode="numeric" min="10" max="2000" step="10" placeholder="ml" style="width:90px" aria-label="算進飲水的 ml" disabled><span class="note">ml</span></div>
    <div class="inline"><input id="aCost" type="number" inputmode="numeric" min="0" max="999999" step="1" placeholder="花了多少" style="width:120px" aria-label="金額（元）"><span class="note">元（選填）</span>
      <label class="note"><input id="aSnack" type="checkbox"> 零食（非正餐）</label></div>
    <div class="btnrow"><button class="btn primary" id="aAdd">加入</button><button class="btn ghost" id="aClose">完成</button></div>
  `, () => {
    const meal = () => $('#aMeal [aria-pressed=true]').dataset.v;
    let wmlTouched = false;
    $('#aWater').onchange = () => { $('#aWaterMl').disabled = !$('#aWater').checked; if ($('#aWater').checked && !$('#aWaterMl').value) $('#aWaterMl').focus(); };
    $('#aWaterMl').oninput = () => { wmlTouched = true; };
    // 零食預設：選「點心」就勾；自己動過就不再自動改
    let snackTouched = false;
    const syncSnack = () => { if (!snackTouched) $('#aSnack').checked = meal() === 's'; };
    $('#aSnack').onchange = () => { snackTouched = true; };
    $('#aMeal').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      $('#aMeal').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x===b)); syncSnack(); });
    syncSnack();
    $('#aClose').onclick = closeSheet;
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      tab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x===b)); body(); });
    let cur = null; // {name,k,p,c,f} or null
    const showSum = () => { $('#aSum').textContent = cur ? `${cur.name}：${r0(cur.k)} kcal · P ${r1(cur.p)} · C ${r1(cur.c)} · F ${r1(cur.f)}` : ''; };
    function body(){
      cur = null; const B = $('#aBody'); B.onclick = null; B.oninput = null;
      if (tab === 'ex') {
        B.innerHTML = EXCH.map(x => `<div class="ex"><div><div>${x.n}</div><div class="d">${x.d}</div></div>
          <div class="step"><button type="button" data-dec="${x.id}" aria-label="減少">−</button><span id="c_${x.id}">${counts[x.id]||0}</span><button type="button" data-inc="${x.id}" aria-label="增加">＋</button></div></div>`).join('')
          + '<div class="note">依國健署食物代換表；可用 0.5 份。外食不確定時，油脂和調味各多記 1 份。纖維與鈉為粗估。</div>';
        const upd = () => {
          const t = {k:0,p:0,c:0,f:0,s:0,fb:0,na:0}, parts = [];
          EXCH.forEach(x => { const n = counts[x.id]||0; if (n) { for (const key in t) t[key] += N0(x[key])*n; parts.push(x.n.replace(/（.+）/,'')+' '+n); } $('#c_'+x.id).textContent = n; });
          cur = parts.length ? {name: parts.join('、'), ...t} : null; showSum(); };
        B.onclick = e => { const b = e.target.closest('button'); if (!b) return;
          const id = b.dataset.inc || b.dataset.dec; if (!id) return;
          counts[id] = Math.max(0, (counts[id]||0) + (b.dataset.inc ? 0.5 : -0.5)); upd(); };
        upd();
      } else if (tab === 'food') {
        const hist = [...(profile.history||[])].sort((a,b) => (b.last||'').localeCompare(a.last||'') || b.cnt - a.cnt);
        const seen = new Set(hist.map(h => h.n));
        const all = [...hist.map(f => ({...f, hist:true})),
          ...(profile.customFoods||[]).filter(f => !seen.has(f.n)).map(f => ({...f, mine:true})), ...FOODS];
        B.innerHTML = `<input id="fQ" type="search" placeholder="搜尋吃過的或常見食物" aria-label="搜尋食物">
          <div class="list" id="fList"></div>
          <div class="inline"><input id="fQty" type="number" inputmode="decimal" step="0.5" min="0.25" value="1" style="width:86px" aria-label="數量">
          <select id="fUnit"></select><button type="button" class="btn ghost danger" id="fForget" hidden>從吃過的移除</button></div>
          <div class="note">「吃過」的會排最前面，記一次就存下來。內建清單為近似值，標「估」者為外食估算。</div>`;
        const list = () => { const q = $('#fQ').value.trim();
          $('#fList').innerHTML = all.map((f,i)=>({f,i})).filter(({f}) => !q || f.n.includes(q)).map(({f,i}) =>
            `<button type="button" data-fi="${i}" aria-pressed="${pick===i}"><span>${esc(f.n)}${f.hist?`<span class="tag">吃過 ${f.cnt} 次</span>`:f.mine?'<span class="tag">我的</span>':''}</span><span class="s">${f.per?r0(f.k)+' kcal/份':r0(f.k*f.g/100)+' kcal/'+f.u}</span></button>`).join('') || '<div class="empty" style="padding:10px 12px">找不到，請改用營養標示新增。</div>';
          const rm = $('#fForget'); if (rm) rm.hidden = !(pick !== null && all[pick] && all[pick].hist); };
        const upd = () => { if (pick===null) { cur=null; showSum(); return; } const f = all[pick], q = +$('#fQty').value || 0;
          const grams = f.per ? null : ($('#fUnit').value === 'g' ? q : q * f.g);
          const mul = f.per ? q : grams/100;
          const nm = f.per ? (q === 1 ? f.n : f.n + ' ×' + q) : f.n + ' ' + ($('#fUnit').value==='g' ? q+' g' : q+' '+f.u);
          cur = {name: nm, k:f.k*mul, p:f.p*mul, c:f.c*mul, f:f.f*mul, s:N0(f.s)*mul, fb:N0(f.fb)*mul, na:N0(f.na)*mul}; showSum();
          // 杯裝品項：先把容量帶進飲水欄位（不會自動勾選）
          if (!wmlTouched) $('#aWaterMl').value = (!f.per && f.u === '杯') ? Math.round(grams) : ''; };
        $('#fForget').onclick = () => { const f = all[pick]; if (!f || !f.hist) return;
          profile.history = (profile.history||[]).filter(h => h.n !== f.n); saveProfile(); pick = null; body(); $('#aSum').textContent = `已從吃過的移除：${f.n}`; };
        $('#fQ').oninput = list;
        $('#fList').onclick = e => { const b = e.target.closest('[data-fi]'); if (!b) return; pick = +b.dataset.fi; const f = all[pick];
          $('#fUnit').innerHTML = f.per ? '<option value="u">份</option>' : `<option value="u">${f.u}（${f.g} g）</option><option value="g">克</option>`;
          $('#fQty').value = 1;
          if (f.hist && N0(f.cost) > 0 && !$('#aCost').value) $('#aCost').value = f.cost; // 吃過的：帶入上次的價錢
          list(); upd(); };
        $('#fQty').oninput = upd; $('#fUnit').onchange = () => { $('#fQty').value = $('#fUnit').value==='g' ? all[pick].g : 1; upd(); };
        list(); upd();
      } else {
        B.innerHTML = `<div class="field">品名<input id="cN" placeholder="例如 統一無糖豆漿"></div>
          <div class="grid2">
            <label>每份熱量 kcal<input id="cK" type="number" inputmode="decimal"></label>
            <label>吃了幾份<input id="cQ" type="number" inputmode="decimal" step="0.5" value="1"></label>
            <label>蛋白質 g<input id="cP" type="number" inputmode="decimal"></label>
            <label>碳水 g<input id="cC" type="number" inputmode="decimal"></label>
            <label>脂肪 g<input id="cF" type="number" inputmode="decimal"></label>
            <label>糖 g<input id="cS" type="number" inputmode="decimal"></label>
            <label>膳食纖維 g<input id="cFb" type="number" inputmode="decimal" placeholder="標示沒有就留空"></label>
            <label>鈉 mg<input id="cNa" type="number" inputmode="decimal"></label>
          </div>
          <label class="note"><input id="cSave" type="checkbox" checked> 存到我的食物</label>
          <div class="note">照包裝「每一份量」那欄填。標示的「糖」含乳糖、果糖等天然糖，計入「添加糖」會偏保守；無糖鮮奶、純果汁可以填 0。</div>`;
        const upd = () => { const v = id => +$(id).value || 0, q = v('#cQ'), n = $('#cN').value.trim();
          cur = n && v('#cK') ? {name: n + (q!==1 ? ' ×'+q : ''), k:v('#cK')*q, p:v('#cP')*q, c:v('#cC')*q, f:v('#cF')*q, s:v('#cS')*q, fb:v('#cFb')*q, na:v('#cNa')*q, _base:{n, k:v('#cK'), p:v('#cP'), c:v('#cC'), f:v('#cF'), s:v('#cS'), fb:v('#cFb'), na:v('#cNa'), per:true}} : null; showSum(); };
        B.oninput = upd; upd();
      }
      showSum();
    }
    $('#aAdd').onclick = () => {
      if (!cur) { $('#aSum').textContent = '先選擇或填寫食物。'; return; }
      if (tab === 'custom' && $('#cSave').checked && cur._base) {
        profile.customFoods = (profile.customFoods||[]).filter(f => f.n !== cur._base.n); profile.customFoods.unshift(cur._base); saveProfile(); }
      const wOn = $('#aWater').checked, wml = Math.round(+$('#aWaterMl').value || 0);
      if (wOn && !(wml >= 10 && wml <= 2000)) { $('#aSum').textContent = '勾了算進飲水，請填 10～2000 ml。'; $('#aWaterMl').focus(); return; }
      const costIn = $('#aCost').value.trim(), cost = Math.round(+costIn || 0);
      if (costIn && !(cost >= 0 && cost <= 999999)) { $('#aSum').textContent = '金額請填 0～999,999 元，或留空。'; $('#aCost').focus(); return; }
      const {name,k,p,c,f} = cur;
      const entry = {name, k:r1(k), p:r1(p), c:r1(c), f:r1(f), s:r1(N0(cur.s)), fb:r1(N0(cur.fb)), na:r0(N0(cur.na)), meal: meal()};
      if (cost > 0) entry.cost = cost;
      if ($('#aSnack').checked) entry.snack = true;
      if (wOn) entry.wid = newId();
      dayOf(sel).food.push(entry); remember(entry);
      if (wOn) pushWater(wml, entry);
      saveDay(sel); render(); toast((avoidMsg(entry.name) || foodComment(entry)) + (wOn ? ` 💧 也算進飲水 ${wml} ml。` : ''));
      $('#aWater').checked = false; $('#aWaterMl').disabled = true; $('#aWaterMl').value = ''; wmlTouched = false;
      $('#aCost').value = ''; snackTouched = false; syncSnack();
      counts = {}; pick = null; body(); $('#aSum').textContent = `已加入：${name}`;
    };
    body();
  });
}
export function foodComment(e){
  const R = calc(sel), remain = R.target - R.eat.k, gapP = R.pT - R.eat.p;
  const pr = e.k ? e.p*4/e.k : 0, fr = e.k ? e.f*9/e.k : 0;
  const hour = new Date().getHours(), isToday = sel === TODAY;
  if (remain < -200) return pickOne([`超標 ${r0(-remain)} kcal 了。今天就到這，明天照常，一天不會毀掉趨勢。`, `已經超過 ${r0(-remain)} kcal，接下來飲水就好，別用明天挨餓來補。`]);
  if (remain < 0) return pickOne([`剛好壓線超過 ${r0(-remain)} kcal，誤差範圍內，收工。`, `超一點點（${r0(-remain)} kcal），今天的帳差不多結清了。`]);
  if (isToday && hour >= 22 && e.k >= 150) return pickOne([`宵夜 ${r0(e.k)} kcal 記到了。記下來就比沒記強，${who()}。`, `深夜加點 ${r0(e.k)} kcal，還剩 ${r0(remain)}。`]);
  if (N0(e.s) >= 25) return pickOne([`這筆添加糖 ${r0(e.s)} g，今天上限 ${r0(R.sT)} g。手搖飲下次試試微糖或無糖。`, `糖 ${r0(e.s)} g 入帳，今天糖的額度${R.eat.s > R.sT ? '已經用完了' : `還剩 ${r0(R.sT - R.eat.s)} g`}。`]);
  if (N0(e.na) >= 1000) return pickOne([`這筆鈉 ${n0na(e.na)} mg，快到一天上限的一半。湯少喝幾口，醬汁別拌飯。`, `偏鹹（鈉 ${n0na(e.na)} mg）。明天早上體重高一點多半是水分，別被嚇到。`]);
  if (R.eat.na > R.naT && R.eat.na - N0(e.na) <= R.naT) return `今天鈉超過 2,300 mg 了，接下來挑原型食物、多飲水。`;
  if (pr >= 0.3 && e.p >= 10) return pickOne([`這筆蛋白質 ${r1(e.p)} g，選得漂亮 💪`, `高蛋白一筆，蛋白質還差 ${r0(Math.max(0,gapP))} g。`, `${r1(e.p)} g 蛋白質入帳，這才是重訓人的吃法。`]);
  if (fr >= 0.55 && e.k >= 150) return pickOne([`這筆熱量一半以上來自脂肪，下一餐清淡點、多點蛋白質。`, `油有點多（脂肪佔 ${r0(fr*100)}%），下一餐挑燙的或蒸的。`]);
  if (e.k >= 600) return pickOne([`單筆 ${r0(e.k)} kcal，大餐一頓。還剩 ${r0(remain)}，晚點吃輕一點。`, `這筆分量不小（${r0(e.k)} kcal），剩下的額度要省著用。`]);
  if (gapP > 30 && remain < gapP*4 + 150) return `額度剩 ${r0(remain)} kcal，但蛋白質還差 ${r0(gapP)} g。接下來優先無糖豆漿、雞胸、蛋。`;
  if (R.d.food.length === 1) return pickOne([`${who()}，今天第一筆，開帳成功 ✍️ 還剩 ${r0(remain)} kcal。`, `開張了。記錄本身就是最有效的習慣。`]);
  return pickOne([`記好了，還剩 ${r0(remain)} kcal。`, `入帳。剩 ${r0(remain)} kcal，蛋白質還差 ${r0(Math.max(0,gapP))} g。`, `收到，進度穩定。`]);
}
/* 飲水：每一杯各自記容量，杯數照實際喝的次數算 */
export function addWater(ml){
  if (!profile) return;
  ml = Math.round(ml);
  if (!(ml >= 10 && ml <= 2000)) { toast('水量請填 10～2000 ml。'); return; }
  const d = dayOf(sel), before = pushWater(ml);
  saveDay(sel); render();
  toast(waterComment(before, d.water, d.waterLog.filter(x => !x.old).length, ml));
}
// 只寫入、不存檔不提示；「記一筆」勾選算進飲水時也用這個
export function pushWater(ml, from){
  const d = dayOf(sel), before = d.water;
  d.waterLog = d.waterLog || [];
  // 舊紀錄只有總量沒有分杯：先補一筆，復原時才不會算錯
  const logged = d.waterLog.reduce((a,x) => a + x.ml, 0);
  if (before > logged) d.waterLog.unshift({ml: before - logged, old:true});
  d.waterLog.push(from ? {ml, t: now(), from: from.name, wid: from.wid} : {ml, t: now()});
  d.water = before + ml;
  return before;
}
// 飲食紀錄和飲水的連結：食物有 wid，對應的飲水那筆也有同一個 wid（舊資料沒有 wid，就用品名對）
export function linkedWater(d, e){
  const wl = d.waterLog || [];
  if (e.wid) return wl.find(x => x.wid === e.wid) || null;
  return wl.find(x => !x.wid && x.from === e.name) || null;
}
export function unlinkWater(d, e){
  const w = linkedWater(d, e); if (!w) return 0;
  d.waterLog.splice(d.waterLog.indexOf(w), 1); d.water = Math.max(0, d.water - w.ml); return w.ml;
}
export function removeFood(idx, date = sel){
  const d = dayOf(date), e = d.food[idx]; if (!e) return;
  d.food.splice(idx, 1); const ml = unlinkWater(d, e);
  saveDay(date); render(); if (ml) toast(`已刪除 ${e.name}，連同算進飲水的 ${ml} ml 一起扣掉。`);
}
/* 快捷杯：使用者自己的杯子清單，可以新增、刪除 */
export const DEFAULT_CUPS = [240, 300, 450];
export const myCups = () => Array.isArray(profile.cups) ? profile.cups : DEFAULT_CUPS;
export let cupEditing = false, askMl = 0;
export function renderCups(){
  const cups = myCups();
  $('#cups').innerHTML = cups.length
    ? cups.map(ml => cupEditing
        ? `<button class="btn cup del-cup" data-delcup="${ml}" aria-label="刪除 ${ml} ml 杯子">${ml} ml ✕</button>`
        : `<button class="btn cup" data-water="${ml}">+${ml} ml</button>`).join('')
    : '<span class="note">還沒有快捷杯。在下面輸入你杯子的容量，加入時選「記住」就會出現在這裡。</span>';
  $('#cupEdit').textContent = cupEditing ? '完成' : '管理杯子';
  $('#cupEdit').hidden = !cups.length && !cupEditing;
}
export function askRemember(ml){
  if (myCups().includes(ml) || myCups().length >= 6) return;
  askMl = ml; $('#cupAskText').textContent = `要把 ${ml} ml 存成快捷杯嗎？之後按一下就好。`; $('#cupAsk').hidden = false;
}
export function waterComment(before, after, cups, ml){
  const R = calc(sel), left = Math.max(0, R.waterT - after);
  if (before < R.waterT && after >= R.waterT) return pickOne([`${who()}飲水目標達成 💧 ${after} ml，今天的水帳結清。`, `達標！${after} ml，腎臟向你致敬。`]);
  if (ml >= 1000) return `一次 ${ml} ml？確認一下有沒有多打一個 0，打錯可以按「復原上一杯」。`;
  const say = {
    1: pickOne([`第 1 杯，開喝了。`, `第 1 杯入帳，今天還差 ${left} ml。`]),
    3: pickOne([`第 3 杯，進度 ${r0(after/R.waterT*100)}%。`, `3 杯了，保持這個節奏。`]),
    5: pickOne([`第 5 杯，比大多數人都穩。`, `5 杯，剩 ${left} ml 就達標。`]),
    7: pickOne([`第 7 杯，終點線在眼前。`, `7 杯！再 ${left} ml 就結清。`])
  };
  return say[cups] || '';
}
/* ---------- 每日評分 v2 ----------
   熱量 35（連續給分；超過目標但沒超過 TDEE 的部分只算一半）
   蛋白質 25、飲食品質 15（脂肪／鈉／添加糖各 5）、飲水 10
   三正餐紀錄 8＋運動 2、補給品 5（只算「每天吃」的品項；沒有每天吃的品項直接給滿，P9）
   當天結束（午夜）後鎖定；之後補登會顯示「補登後 B→C」 */
export const GRADE_VER = 4; // 3＝D1 後熱量目標不含運動；4＝P9 補給品只算每天吃的品項。舊版鎖定的分數保留不覆寫，畫面標「舊制」
export const letter = s => s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : s >= 50 ? 'E' : 'F';
export function gradeDay(date){
  const d = days[date]; if (!d || !d.food.length) return null;
  const R = calc(date), e = R.eat;
  // 今天用「今天／明天」；過去日期用「這天／下次」（P7）
  const isToday = date >= TODAY, dT = isToday ? '今天' : '這天', nT = isToday ? '明天' : '下次';
  // 熱量
  let effDev;
  if (e.k <= R.target) effDev = (R.target - e.k) / R.target;
  else { const over = e.k - R.target, toTdee = Math.max(0, R.tdee - R.target);
    effDev = (Math.min(over, toTdee) * 0.5 + Math.max(0, over - toTdee)) / R.target; }
  const sK = r1(35 * clamp01(1 - Math.max(0, effDev - 0.05) / 0.30));
  const sP = r1(25 * clamp01(e.p / R.pT));
  // 品質：脂肪佔熱量 30% 以內滿分、45% 歸零；鈉 2,300 內滿分、3,500 歸零；添加糖在上限內滿分、兩倍歸零
  const fatPct = e.k ? e.f * 9 / e.k : 0;
  const qF = r1(5 * clamp01(1 - Math.max(0, fatPct - 0.30) / 0.15));
  const qN = r1(5 * clamp01(1 - Math.max(0, e.na - R.naT) / 1200));
  const qS = r1(5 * clamp01(1 - Math.max(0, e.s - R.sT) / R.sT));
  const sQ = r1(qF + qN + qS);
  const sW = r1(10 * clamp01(d.water / R.waterT));
  const mains = ['b','l','d'].filter(m => d.food.some(f => f.meal === m)).length;
  const sL = r1(mains * 8/3 + (d.ex.length ? 2 : 0));
  // 只有設成「每天吃」的補給品計分；需要時才吃、或還沒選頻率的品項不計分（P9）
  const plan = (profile.supps || []).filter(s => s.freq === 'daily');
  const took = new Set((d.supps || []).map(x => x.id));
  const sS = plan.length ? r1(5 * plan.filter(s => took.has(s.id)).length / plan.length) : 5;
  const score = Math.round(sK + sP + sQ + sW + sL + sS);
  const g = letter(score);
  // 評語挑失分最多的一項（失分＝滿分－得分）；失分相同時挑配分大的（P8）。用得分比例會讓配分小的項目蓋過配分大的
  const parts = [['熱量', sK, 35], ['蛋白質', sP, 25], ['品質', sQ, 15], ['飲水', sW, 10], ['紀錄', sL, 10], ['補給品', sS, 5]];
  const loss = x => r1(x[2] - x[1]);
  const weak = parts.slice().sort((a,b) => loss(b) - loss(a) || b[2] - a[2])[0][0];
  const qWorst = [['脂肪', qF], ['鈉', qN], ['糖', qS]].sort((a,b) => a[1]-b[1])[0][0];
  const missing = [['b','早餐'],['l','午餐'],['d','晚餐']].filter(([m]) => !d.food.some(f => f.meal === m)).map(x => x[1]);
  const fix = {
    '熱量': e.k > R.target ? `熱量超了 ${r0(e.k-R.target)} kcal${e.k <= R.tdee ? '（還在維持量內，不會胖）' : ''}，${nT}正餐固定、點心先記再吃。` : `熱量比目標少 ${r0(R.target-e.k)} kcal，吃太少會拖累肌肉，${nT}補足。`,
    '蛋白質': `蛋白質只到 ${r0(e.p)}/${r0(R.pT)} g，${nT}每餐先放一份豆魚蛋肉。`,
    '品質': {'脂肪': `脂肪佔熱量 ${r0(fatPct*100)}%，${nT}主菜選烤、滷、蒸，青菜要燙的。`, '鈉': `鈉 ${r0(e.na).toLocaleString()} mg，${nT}湯少喝、醬汁分開放。`, '糖': `添加糖 ${r0(e.s)} g，${nT}飲料改微糖或無糖。`}[qWorst],
    '飲水': `水只喝了 ${d.water} ml，${nT}桌上放一瓶，看到就喝。`,
    '紀錄': missing.length ? `${missing.join('、')}沒記到，漏記的那餐才是看不見的帳。` : '記得把運動也記上，有加分。',
    '補給品': `補給品還有 ${plan.filter(s => !took.has(s.id)).map(s => s.name).join('、')} 沒吃。`
  }[weak];
  let hsh = 0; for (const ch of date + g) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = a => a[hsh % a.length];
  const head = {
    A: pick([`滿分級的一天，${who()}你就是自律本人 🏆`, '帳目漂亮，阿鹽沒什麼好挑的。']),
    B: pick(['穩，差一點就是 A。', '很不錯的一天，小地方修一下。']),
    C: pick(['及格有餘，還有進步空間。', '中規中矩，主線有顧到。']),
    D: pick(['有在記，但有一項明顯掉了。', '勉強過關，有個洞要補。']),
    E: pick([`${dT}有點散，但你有記，這很重要。`, '偏離目標了，問題很集中，好修。']),
    F: pick([`${dT}放飛了。一天不算數，趨勢才算數。`, `分數很低，但重點是${nT}怎麼做。`])
  }[g];
  return {g, score, sK, sP, sQ, sW, sL, sS, qF, qN, qS, fatPct, comment: g === 'A' ? head : head + fix};
}
// 過完的日子：第一次看到時把分數存下來（鎖定），之後補登會並列顯示
export function lockedGrade(date){
  const d = days[date]; if (!d) return null;
  if (d.grade) return d.grade; // 任何版本的鎖定都保留；版本較舊者由畫面標「舊制」
  if (date >= TODAY) return null;
  const G = gradeDay(date); if (!G) return null;
  d.grade = {v:GRADE_VER, g:G.g, score:G.score}; saveDay(date);
  return d.grade;
}
export function renderGrade(){
  const G = gradeDay(sel), card = $('#gradeCard');
  if (!G) { card.hidden = true; return; }
  card.hidden = false;
  const L = sel < TODAY ? lockedGrade(sel) : null;
  const changed = L && L.score !== G.score;
  // 大字與評語都取自同一次計算（G）；補登後分數有變時，小字標出午夜結算時的等第（P7）
  $('#gLetter').textContent = G.g;
  $('#gLetter').className = 'gletter num g' + G.g;
  $('#gWas').hidden = !changed;
  const old = changed && L.v < GRADE_VER; // 分數不同是因為計分方式更新，不是補登
  $('#gWas').textContent = changed ? (old ? `舊制 ${L.g}` : `結算時 ${L.g}`) : '';
  $('#gLabel').textContent = sel === TODAY ? `今日暫評 · ${G.score} 分（午夜結算）`
    : old ? `${sel} ${G.score} 分 · 舊制 ${L.g}（${L.score} 分，計分方式已更新）`
    : changed ? `${sel} 補登後 ${G.score} 分 · 結算時 ${L.g}（${L.score} 分）` : `${sel} 結算 · ${G.score} 分`;
  $('#gComment').textContent = G.comment;
  $('#gParts').innerHTML = [['熱量',G.sK,35],['蛋白質',G.sP,25],['品質',G.sQ,15],['飲水',G.sW,10],['紀錄',G.sL,10],['補給品',G.sS,5]]
    .map(([n,v,m]) => `<div>${n}<b>${r0(v)}/${m}</b></div>`).join('');
}

/* ---------- 指數說明 ---------- */
export const SRC = {
  frank: ['Frankenfield 2005 系統性回顧','https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/'],
  ath: ['運動員 RMR 公式統合分析 2023','https://pubmed.ncbi.nlm.nih.gov/37632665/'],
  pal: ['FAO/WHO/UNU 活動係數','https://bmcpublichealth.biomedcentral.com/articles/10.1186/1471-2458-10-144/tables/1'],
  hall: ['Hall 2011《Lancet》','https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593'],
  guide: ['國健署每日飲食指南','https://fae.moa.gov.tw/files/topics/4154/A02_1.pdf'],
  comp: ['Compendium of Physical Activities','https://pubmed.ncbi.nlm.nih.gov/10993420/'],
  morton: ['Morton 2018 統合分析','https://pubmed.ncbi.nlm.nih.gov/28698222/'],
  dri: ['DRIs 第八版重點','https://www.commonhealth.com.tw/article/86819'],
  sugar: ['衛福部：添加糖不超過 10%','https://mohw.gov.tw/dl-46281-0a5fcd86-3b05-4290-981e-97fe82ca3614.html'],
  fiber: ['纖維 14 g／1,000 kcal','https://www.commonhealth.com.tw/article/75209'],
  efsa: ['EFSA 飲水建議','https://www.efsa.europa.eu/en/press/news/nda100326'],
  ulTable: ['食藥署營養素上限值附表','https://www.rootlaw.com.tw/Attach/L-Doc/A040170050001700-1121130-19000-001.pdf'],
  efsaFish: ['EFSA 魚油安全評估','https://www.efsa.europa.eu/en/press/news/120727'],
  apap: ['乙醯胺酚正確用法（TVBS 健康 2.0）','https://health.tvbs.com.tw/medical/358888'],
  cgmh: ['長庚：藥物與飲食交互作用','https://www.cgmh.org.tw/cgmn/cgmn_file/0903024.pdf']
};
export function explain(key){
  const R = calc(sel), e = R.eat, n0 = x => r0(x).toLocaleString(), W = R.W;
  const pdef = Math.round(profile.deficit*100);
  const X = {
    bmr: R.bmrMethod === 'cunningham' ? {
      eb:'BMR', t:'睡著也在燒的熱量', lead:'維持心跳、呼吸、體溫的基本消耗',
      tag:'Cunningham (1991)', f:`瘦體重 = ${W} × (1 − ${R.bf}%) = ${r1(R.ffm)} kg\nBMR = 370 + 21.6 × ${r1(R.ffm)}`, res:`${n0(R.bmr)} kcal`,
      body:['你填了體脂率，所以改用瘦體重計算。基礎代謝主要由肌肉和器官決定，脂肪貢獻很少，用瘦體重算比用總體重準。',
        '2023 年統合分析顯示，這條公式用在規律訓練的人身上，和實測值沒有顯著差異。前提是體脂率要準，體脂計誤差大時，結果也會跟著偏。'],
      src:['ath','frank']
    } : {
      eb:'BMR', t:'睡著也在燒的熱量', lead:'維持心跳、呼吸、體溫的基本消耗',
      tag:'Mifflin-St Jeor (1990)', f:`10 × ${W} kg + 6.25 × ${profile.height} cm − 5 × ${profile.age} 歲 ${profile.sex==='m'?'+ 5':'− 161'}`, res:`${n0(R.bmr)} kcal`,
      body:['2005 年系統性回顧比較四條常用公式，這條最常落在實測值 ±10% 以內，所以是預設。',
        '肌肉量高的人容易被低估。在設定填入體脂率，會改用 Cunningham 瘦體重公式。'],
      src:['frank','ath']
    },
    tdee: {
      eb:'TDEE', t:'一天總共燒掉的熱量', lead:'基礎代謝加上走路、站立、做家事',
      tag: profile.tdeeOverride ? '體重趨勢回推（實測）' : '活動係數法', 
      f: profile.tdeeOverride ? `近 28 天平均攝取 − 體重變化 × 7,700 kcal/kg` : `BMR ${n0(R.bmr)} × 活動係數 ${profile.pal.toFixed(2)}`,
      res:`${n0(R.tdee)} kcal`,
      body:[profile.tdeeOverride ? `你已採用實測值，公式估計是 ${n0(R.tdeeFormula)} kcal。實測值反映你真實的身體，比公式可靠，前提是紀錄沒有漏記。`
        : `活動係數依 FAO/WHO/UNU 分級，1.40 是久坐生活的下緣。市面常見的 1.2 低於這個區間，容易把需求算太低。`,
        profile.tdeeOverride ? '實測值由體重趨勢回推，已經包含你平常的運動，所以運動消耗不再另外加。' : '公式值不含刻意運動；但可吃額度不會再加回運動估算，規律運動的效果交給實測校正反映。'],
      src:['pal']
    },
    target: {
      eb:'目標熱量', t:'今天可以吃多少', lead:'每日消耗扣掉減重赤字，運動不另外加',
      tag:`赤字 ${pdef}%`, f:`TDEE ${n0(R.tdee)} × (1 − ${pdef}%) = ${n0(R.tdee*(1-profile.deficit))}\n下限 max(BMR, 1,200) = ${n0(R.floor)}`, res:`${n0(R.target)} kcal`,
      body:[R.floorHit ? '赤字算出來低於下限，所以今天用下限。吃得比基礎代謝還少，掉的會有更多是肌肉。' : '用百分比而不是固定減 500 kcal，因為體重越輕消耗越少，固定數字會讓赤字越來越大。',
        '體重對熱量變化反應很慢，看兩週以上的趨勢，不要看單日體重。'],
      src:['hall','guide']
    },
    ex: {
      eb:'運動', t:'運動多燒的熱量（參考）', lead:'只顯示，不加進可吃額度',
      tag:'MET 淨消耗', f:`(MET − 1) × 體重 ${W} kg × 時數`, res:`今天約 ${n0(R.exNet)} kcal`,
      body:['手錶或 MET 估算的誤差常達 ±30%，加進額度容易越吃越多。所以這個數字只給你參考，不會讓你多吃；運動真正多燒的熱量，會透過體重趨勢反映在實測 TDEE 裡。', '減 1 是扣掉本來就算在 TDEE 裡的靜止消耗，不然會重複計算。',
        'MET 是群體平均值，個人差異可以到 ±20%。重訓的組間休息也算在時間裡，數字會比感覺少，這是正常的。'],
      src:['comp']
    },
    protein: {
      eb:'蛋白質', t:'保住肌肉的那一項', lead:'減脂期最該優先吃到的營養素',
      tag:`${profile.pkg} g/kg`, f:`${profile.pkg} g × 體重 ${W} kg`, res:`${n0(R.pT)} g`,
      body:['DRIs 第八版成年女性建議 60 g，約 1.0–1.2 g/kg。有重訓的話，研究顯示到 1.6 g/kg 左右增肌效益最大，可在設定調整。',
        `今天蛋白質佔熱量 ${e.k ? r0(e.p*4/e.k*100) : 0}%，台灣指南建議 10–20%。`],
      src:['dri','morton']
    },
    fat: {
      eb:'脂肪', t:'荷爾蒙和脂溶性維生素需要它', lead:'不是越少越好',
      tag:'熱量 25%', f:`目標 ${n0(R.target)} kcal × 25% ÷ 9 kcal/g`, res:`${n0(R.fT)} g`,
      body:['DRIs 第八版建議脂肪佔總熱量 20–30%，取中間值 25%。飽和脂肪不超過 10%，反式脂肪不超過 1%。',
        '長期只吃水煮餐，脂肪太低也不利健康。'],
      src:['dri']
    },
    carb: {
      eb:'碳水化合物', t:'剩下的熱量給碳水', lead:'大腦和訓練的主要燃料',
      tag:'補足剩餘熱量', f:`(${n0(R.target)} − 蛋白質 ${n0(R.pT*4)} − 脂肪 ${n0(R.fT*9)}) ÷ 4`, res:`${n0(R.cT)} g`,
      body:['先保住蛋白質和脂肪，剩下的分給碳水，所以熱量目標下修時，最先減少的是碳水。',
        '國健署每日飲食指南建議佔 50–60%。蛋白質設得高時，碳水比例會略低於這個範圍。'],
      src:['guide']
    },
    sugar: {
      eb:'添加糖', t:'手搖飲最容易爆的那一項', lead:'只算加進去的糖，不算水果和鮮奶的天然糖',
      tag:'上限 10% 熱量', f:`目標 ${n0(R.target)} kcal × 10% ÷ 4 kcal/g`, res:`上限 ${n0(R.sT)} g`,
      body:['國健署建議每日添加糖不超過總熱量 10%，以 2,000 kcal 計是 50 g，約 10 顆方糖。一杯全糖手搖飲就可能超過。',
        '包裝標示的「糖」包含天然糖，照標示填會偏高，算是保守估計。內建食物只計添加糖。'],
      src:['sugar']
    },
    fiber: {
      eb:'膳食纖維', t:'吃得飽、腸道順的那一項', lead:'這項是要吃到，不是限制',
      tag:'14 g / 1,000 kcal', f:`目標 ${n0(R.target)} kcal ÷ 1,000 × 14 g`, res:`${n0(R.fbT)} g`,
      body:['常見建議是成人每天 25–35 g，或每 1,000 kcal 吃 14 g。熱量吃得少，目標也跟著降。',
        '最快補法：一餐一份燙青菜約 2 g，白飯換糙米飯一碗多 2 g，芭樂一顆約 5 g。'],
      src:['fiber']
    },
    sodium: {
      eb:'鈉', t:'外食最難躲的那一項', lead:'吃太鹹會讓體重短暫上升，也關係到血壓',
      tag:'上限 2,300 mg', f:`鈉 2,300 mg ≈ 鹽 6 g`, res:`上限 2,300 mg`,
      body:['DRIs 第八版建議 10 歲以上每天鈉控制在 2,300 mg 左右。',
        '外食的鈉大多藏在醬汁和湯裡，內建數值只是估計，喝湯、加滷汁時用「份數」裡的「調味」補記。吃鹹後隔天體重上升，多半是水分，不是脂肪。'],
      src:['dri']
    },
    water: {
      eb:'飲水', t:'今天的飲水目標', lead:'指喝下去的飲品，不含食物裡的水',
      tag:'EFSA 女性 2.0 L', f:`2.0 L × 約 80% 來自飲品 = 1,600 ml\n+ 運動 ${r1(R.exHours)} 小時 × 500 ml`, res:`${n0(R.waterT)} ml`,
      body:['EFSA 建議女性每天總水分 2.0 L，條件是氣溫和活動量中等。高雄天氣熱，流汗多時請自己多喝。',
        '「80% 來自飲品」是常用的近似值，不是精確數字。'],
      src:['efsa']
    },
    supp: {
      eb:'補給品', t:'每日上限怎麼算', lead:'同一種營養素，不同產品會加總',
      tag:'每日上限值', f:'今天吃的每一顆 × 每顆含量，全部產品加總', res:'超過上限會標紅並提醒',
      body:['上限取自食藥署營養素規格附表的「每日建議攝取量上限值」；魚油採 EFSA 的安全評估，EPA+DHA 每天 5 g 以內沒有安全疑慮。',
        '上限只算補充劑，不含食物。小標語只寫怎麼吃，不寫功效。',
        '每個品項可設「每天吃」或「需要時才吃」。只有每天吃的列入每日評分；需要時才吃的（例如不舒服才補充）照常可以打卡、照常算進每日上限，但沒吃不扣分。'],
      src:['ulTable','efsaFish']
    },
    med: {
      eb:'用藥', t:'App 幫你守住的三條線', lead:'數值都照你的藥袋填，App 不判斷藥怎麼吃',
      tag:'防重複服用', f:'1. 間隔鎖：上次吃後未滿間隔會先問你\n2. 每日次數上限\n3. 乙醯胺酚：所有藥加總，近 24 小時不超過 4,000 mg', res:'超過時先確認，再記錄',
      body:['很多感冒藥、止痛藥都含乙醯胺酚，分開吃容易不知不覺超量；醫師與藥師提醒，成人一天超過 4,000 mg 或與酒精併用，會大幅增加肝損傷風險。',
        '避開清單由你照藥袋勾選，療程中記到相關食物會提醒。名稱比對會漏，只當補強。網頁關著不會響鈴，固定時間的藥請用「加到行事曆」。'],
      src:['apap','cgmh']
    },
    grade: {
      eb:'每日結算', t:'A 到 F 怎麼算', lead:'滿分 100，分六項',
      tag:'計分規則', f:`熱量貼近目標 35 分\n蛋白質達標 25 分\n飲食品質 15 分（脂肪、鈉、添加糖各 5）\n飲水達標 10 分\n早午晚三餐都有記 8 分 + 有運動 2 分\n每天吃的補給品照表吃 5 分`, res:'90↑ A · 80 B · 70 C · 60 D · 50 E · 50↓ F',
      body:['熱量誤差 5% 內拿滿分，之後連續扣分，不會因為差一點就掉一大截。超過目標但還在維持量（TDEE）以內的部分只扣一半，因為不會變胖；吃太少一樣會扣，長期赤字太大會掉肌肉。',
        '品質：脂肪佔熱量 30% 以內、鈉 2,300 mg 以內、添加糖在上限內各拿滿 5 分，超過越多扣越多。點心不算正餐。補給品只算設成「每天吃」的品項；需要時才吃的照常打卡、照常檢查每日上限，但不計分。沒有每天吃的品項時，補給品 5 分直接給滿。',
        '阿鹽評語會挑失分最多的一項（滿分減得分）給建議；失分一樣時，挑配分大的那項。當天的分數會到午夜才結算鎖定；之後補登或修改，大字改顯示補登後的等第，旁邊小字標「結算時 B」，原本的分數保留。這是阿鹽自訂的規則，不是醫學標準。'],
      src:[]
    }
  }[key];
  if (!X) return;
  openSheet(`
    <div class="xp"><span class="eyebrow">${X.eb}</span><h2>${X.t}</h2><span class="lead">${X.lead}</span></div>
    <div class="fbox"><span class="mtag">${esc(X.tag)}</span><code>${esc(X.f)}</code><span class="res">${key === 'grade' ? '' : '= '}${esc(X.res)}</span></div>
    <div class="xbody">${X.body.map(p => `<p>${esc(p)}</p>`).join('')}</div>
    ${X.src.length ? `<div class="xlinks">${X.src.map(k => `<a href="${SRC[k][1]}" target="_blank" rel="noopener">${SRC[k][0]} ↗</a>`).join('')}</div>` : ''}
    <button class="btn primary block" id="xOk">知道了</button>
  `, () => { $('#xOk').onclick = closeSheet; $('#xOk').focus(); });
}

/* ---------- history & editing ---------- */
export function remember(e){
  const h = profile.history || (profile.history = []);
  const i = h.findIndex(x => x.n === e.name);
  const item = {n:e.name, k:e.k, p:e.p, c:e.c, f:e.f, s:N0(e.s), fb:N0(e.fb), na:N0(e.na), per:true, cnt:(i>=0 ? h[i].cnt : 0) + 1, last:TODAY};
  if (N0(e.cost) > 0) item.cost = e.cost; else if (i >= 0 && N0(h[i].cost) > 0) item.cost = h[i].cost;
  if (i >= 0) h.splice(i, 1);
  h.unshift(item);
  if (h.length > 300) h.length = 300;
  saveProfile();
}
// opt.date：要修改哪一天（預設首頁選取日）；opt.back：存檔、取消、刪除後回到哪裡（例如花費明細，P6）
export function openEdit(idx, opt = {}){
  const date = opt.date || sel, goBack = () => opt.back ? opt.back() : closeSheet();
  const e = dayOf(date).food[idx]; if (!e) return;
  const base = {...e}, lw = linkedWater(dayOf(date), e);
  openSheet(`
    <h2>修改這筆</h2>
    <div class="field">品名<input id="eN" value="${esc(e.name)}"></div>
    <div class="seg" id="eMeal">${MEALS.map(([k,l])=>`<button type="button" data-v="${k}" aria-pressed="${k===e.meal}">${l}</button>`).join('')}</div>
    <div class="field">份量倍數（全部數值等比例調整）
      <div class="inline"><button type="button" class="btn" data-mul="0.5">½</button><button type="button" class="btn" data-mul="1">原本</button><button type="button" class="btn" data-mul="1.5">1.5 倍</button><button type="button" class="btn" data-mul="2">2 倍</button>
      <input id="eMul" type="number" inputmode="decimal" step="0.1" min="0.1" value="1" style="width:76px" aria-label="倍數"></div></div>
    <div class="grid2">
      <label>熱量 kcal<input id="eK" type="number" inputmode="decimal" value="${e.k}"></label>
      <label>蛋白質 g<input id="eP" type="number" inputmode="decimal" value="${e.p}"></label>
      <label>碳水 g<input id="eC" type="number" inputmode="decimal" value="${e.c}"></label>
      <label>脂肪 g<input id="eF" type="number" inputmode="decimal" value="${e.f}"></label>
      <label>添加糖 g<input id="eS" type="number" inputmode="decimal" value="${N0(e.s)}"></label>
      <label>纖維 g<input id="eFb" type="number" inputmode="decimal" value="${N0(e.fb)}"></label>
      <label>鈉 mg<input id="eNa" type="number" inputmode="decimal" value="${N0(e.na)}"></label>
    </div>
    <div class="inline wtoggle"><label class="note"><input id="eWater" type="checkbox" ${lw ? 'checked' : ''}> 也算進飲水</label>
      <input id="eWaterMl" type="number" inputmode="numeric" min="10" max="2000" step="10" placeholder="ml" style="width:90px" aria-label="算進飲水的 ml" value="${lw ? lw.ml : ''}" ${lw ? '' : 'disabled'}><span class="note">ml</span></div>
    <div class="inline"><input id="eCost" type="number" inputmode="numeric" min="0" max="999999" step="1" placeholder="花了多少" style="width:120px" aria-label="金額（元）" value="${N0(e.cost) || ''}"><span class="note">元（選填）</span>
      <label class="note"><input id="eSnack" type="checkbox" ${e.snack ? 'checked' : ''}> 零食（非正餐）</label></div>
    <label class="note"><input id="eHist" type="checkbox" checked> 同步更新「吃過的」，下次搜尋用新數值</label>
    <div class="note" id="eNote"></div>
    <div class="btnrow"><button class="btn primary" id="eSave">儲存</button><button class="btn ghost" id="eCancel">取消</button><button class="btn ghost danger" id="eDel">刪除這筆</button></div>
  `, () => {
    $('#eMeal').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return;
      $('#eMeal').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x===b)); });
    const applyMul = m => { if (!(m > 0)) return; $('#eMul').value = m;
      $('#eK').value = r1(base.k*m); $('#eP').value = r1(base.p*m); $('#eC').value = r1(base.c*m); $('#eF').value = r1(base.f*m); };
    document.querySelectorAll('[data-mul]').forEach(b => b.onclick = () => applyMul(+b.dataset.mul));
    $('#eMul').oninput = () => applyMul(+$('#eMul').value);
    $('#eCancel').onclick = goBack;
    $('#eWater').onchange = () => { $('#eWaterMl').disabled = !$('#eWater').checked; if ($('#eWater').checked && !$('#eWaterMl').value) $('#eWaterMl').focus(); };
    let armed = false;
    $('#eDel').onclick = () => {
      if (!armed) { armed = true; $('#eDel').textContent = '再按一次確認刪除'; return; }
      removeFood(idx, date); goBack(); };
    $('#eSave').onclick = () => {
      const name = $('#eN').value.trim(), k = +$('#eK').value;
      if (!name || !(k >= 0) || $('#eK').value === '') { $('#eNote').className = 'note warn'; $('#eNote').textContent = '請填品名和熱量。'; return; }
      const wOn = $('#eWater').checked, wml = Math.round(+$('#eWaterMl').value || 0);
      if (wOn && !(wml >= 10 && wml <= 2000)) { $('#eNote').className = 'note warn'; $('#eNote').textContent = '勾了算進飲水，請填 10～2000 ml。'; return; }
      const costIn = $('#eCost').value.trim(), cost = Math.round(+costIn || 0);
      if (costIn && !(cost >= 0 && cost <= 999999)) { $('#eNote').className = 'note warn'; $('#eNote').textContent = '金額請填 0～999,999 元，或留空。'; return; }
      const upd = {name, k:r1(k), p:r1(+$('#eP').value||0), c:r1(+$('#eC').value||0), f:r1(+$('#eF').value||0), s:r1(+$('#eS').value||0), fb:r1(+$('#eFb').value||0), na:r0(+$('#eNa').value||0), meal: $('#eMeal [aria-pressed=true]').dataset.v};
      if (cost > 0) upd.cost = cost;
      if ($('#eSnack').checked) upd.snack = true;
      const d = dayOf(date); let wmsg = '';
      if (wOn) {
        upd.wid = e.wid || newId();
        const w = linkedWater(d, e);
        if (w) { const old = w.ml; d.water = Math.max(0, d.water - old + wml); w.ml = wml; w.from = name; w.wid = upd.wid; if (wml !== old) wmsg = `飲水從 ${old} 改成 ${wml} ml。`; }
        else { pushWater(wml, upd); wmsg = `已算進飲水 ${wml} ml。`; }
      } else { const ml = unlinkWater(d, e); if (ml) wmsg = `已從飲水扣掉 ${ml} ml。`; }
      d.food[idx] = upd; saveDay(date);
      if ($('#eHist').checked) {
        const h = profile.history || (profile.history = []);
        const i = h.findIndex(x => x.n === base.name || x.n === name);
        if (i >= 0) { h[i] = {...h[i], n:name, k:upd.k, p:upd.p, c:upd.c, f:upd.f, s:upd.s, fb:upd.fb, na:upd.na}; if (upd.cost) h[i].cost = upd.cost; saveProfile(); }
        else remember(upd);
      }
      render(); goBack(); if (wmsg) toast(wmsg); };
  });
}

/* ---------- 綁定按鈕與事件（原本在頂層直接執行；入口在全部模組載入後依序呼叫）---------- */
export function bindDiet(){

  /* ---------- events ---------- */
  document.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.day){ setSel(t.dataset.day); render(); }
    else if (t.dataset.wk){ setSel(addDays(sel, +t.dataset.wk)); render(); }
    else if (t.dataset.water){ addWater(+t.dataset.water); }
    else if (t.dataset.explain){ if (profile) explain(t.dataset.explain); }
    else if (t.dataset.editfood !== undefined){ openEdit(+t.dataset.editfood); }
    else if (t.dataset.edititem){ const it = items.find(x => x.id === t.dataset.edititem && !x.del); if (it) openItemForm(it, openItems); }
    else if (t.dataset.delfood !== undefined){ removeFood(+t.dataset.delfood); }
    else if (t.dataset.delex !== undefined){ dayOf(sel).ex.splice(+t.dataset.delex,1); saveDay(sel); render(); }
    else if (t.id === 'calOn' || t.id === 'tnNew'){ profile.tdeeOverride = +t.dataset.v; profile.tdeeVer = TDEE_VER; saveProfile(); render(); }
    else if (t.id === 'calOff' || t.id === 'tnFormula'){ delete profile.tdeeOverride; profile.tdeeVer = TDEE_VER; saveProfile(); render(); }
    else if (t.id === 'fullOn'){ dayOf(sel).full = true; saveDay(sel); render(); }
    else if (t.id === 'fullOff'){ delete dayOf(sel).full; saveDay(sel); render(); }
    else if (t.id === 'tnKeep'){ profile.tdeeVer = TDEE_VER; saveProfile(); render(); }
  });
  $('#exType').innerHTML = METS.map(([n,m],i)=>`<option value="${i}">${n}（${m}）</option>`).join('');
  $('#exAdd').onclick = () => {
    const min = +$('#exMin').value; if (!(min>0)) return;
    const [name, met] = METS[+$('#exType').value];
    dayOf(sel).ex.push({name, met, min}); saveDay(sel); render();
  };
  $('#wtSave').onclick = () => {
    const w = parseFloat($('#wtIn').value); if (!(w>=25 && w<=250)) return;
    dayOf(sel).weight = r1(w); saveDay(sel); render();
  };
  $('#btnSettings').onclick = () => openSettings(false);
  $('#fab').onclick = () => { if (profile) openAdd(); else openSettings(true); };
  $('#itemsOpen').onclick = () => { if (profile) openItems(); else openSettings(true); };
  $('#itemAddBtn').onclick = () => { if (profile) openItemForm(null, null); else openSettings(true); };
  $('#cupEdit').onclick = () => { cupEditing = !cupEditing; renderCups(); };
  $('#cups').addEventListener('click', e => {
    const b = e.target.closest('[data-delcup]'); if (!b) return;
    e.stopPropagation();
    profile.cups = myCups().filter(x => x !== +b.dataset.delcup); saveProfile();
    if (!profile.cups.length) cupEditing = false;
    renderCups(); toast(`已刪除 ${b.dataset.delcup} ml 杯子。`);
  });
  $('#cupAskYes').onclick = () => {
    profile.cups = [...new Set([...myCups(), askMl])].sort((a,b) => a - b); saveProfile();
    $('#cupAsk').hidden = true; renderCups(); toast(`已記住 ${askMl} ml 杯子。`);
  };
  $('#cupAskNo').onclick = () => { $('#cupAsk').hidden = true; };
  $('#cupAdd').onclick = () => {
    if (!profile) return;
    const v = Math.round(+$('#cupIn').value || 0);
    if (!v) { $('#cupIn').focus(); return; }
    $('#cupIn').value = ''; addWater(v);
    if (v >= 10 && v <= 2000) askRemember(v);
  };
  $('#cupIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#cupAdd').click(); });
  $('#cupUndo').onclick = () => {
    const d = dayOf(sel); if (!d.waterLog || !d.waterLog.length) return;
    const x = d.waterLog.pop(); d.water = Math.max(0, d.water - x.ml);
    saveDay(sel); render(); toast(`已復原 ${x.ml} ml。`);
  };
}
