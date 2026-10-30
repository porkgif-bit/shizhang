/* 每日食帳 · money.js — 花費：物品清單、每日成本、回購週期、30 天回顧、花費圖表、首頁花費卡、物品 CSV */
import { $, ITEM_CATS, ITEM_TYPES, MEALS, N0, REVIEWS, TODAY, addDays, addMonths, bkMsg, closeSheet, days, daysBetween, esc, fullDate, items, liveItems, mmdd, money, moneyShort, newId, openSheet, r0, reviewName, saveFile, saveItem, sel, stamp, toast, typeName, useLabel } from './core.js';
import { render } from './diet.js';


// 買滿 30 天、開了回顧、還沒回答的
export const dueReviews = () => liveItems().filter(x => x.ask && !x.review && daysBetween(x.date, TODAY) >= 30).sort((a,b) => a.date.localeCompare(b.date));

// 大件：價格 ÷ 用了幾天
export function dailyCost(x){
  const used = Math.max(1, daysBetween(x.date, TODAY) + 1);
  return {used, now: x.price / used, plan: x.price / (x.years * 365)};
}
export function costCurve(x){
  const W = 300, H = 64, start = 30;
  const used = Math.max(1, daysBetween(x.date, TODAY) + 1);
  const end = Math.max(x.years * 365, used);
  const ymax = x.price / start;
  const X = d => 4 + (d - start) / (end - start) * (W - 8), Y = v => 6 + (1 - v / ymax) * (H - 12);
  let path = '';
  for (let i = 0; i <= 48; i++) { const d = start + (end - start) * i / 48; path += (i ? 'L' : 'M') + X(d).toFixed(1) + ' ' + Y(x.price / d).toFixed(1); }
  const u = Math.min(end, Math.max(start, used));
  return `<svg class="ccurve" viewBox="0 0 ${W} ${H}" role="img" aria-label="每日成本從第一個月約 ${money(x.price/start)} 降到現在 ${money(x.price/used)}">
    <line x1="0" y1="${H-1}" x2="${W}" y2="${H-1}" class="ax"/><path d="${path}" class="cl"/>
    <line x1="${X(u).toFixed(1)}" y1="4" x2="${X(u).toFixed(1)}" y2="${H-1}" class="nowl"/><circle cx="${X(u).toFixed(1)}" cy="${Y(x.price/u).toFixed(1)}" r="4" class="dot"/></svg>`;
}

// 消耗品：同名的歸一組，算平均間隔
export function cycles(){
  const g = {};
  liveItems().filter(x => x.type === 'cons').forEach(x => { const k = x.name.trim(); (g[k] = g[k] || []).push(x); });
  return Object.entries(g).map(([name, list]) => {
    list.sort((a,b) => a.date.localeCompare(b.date));
    const last = list[list.length-1], avgPrice = list.reduce((s,x) => s + x.price, 0) / list.length;
    if (list.length < 2) return {name, n:1, last, avgPrice};
    const span = daysBetween(list[0].date, last.date);
    const avg = Math.max(1, span / (list.length - 1));
    const next = addDays(last.date, r0(avg));
    return {name, n:list.length, last, avgPrice, avg, next, left:daysBetween(TODAY, next), year:avgPrice * 365 / avg};
  }).sort((a,b) => (a.left ?? 1e9) - (b.left ?? 1e9));
}

// 一個月的花費：飲食有填金額的 + 那個月買的物品
export function monthStats(ym){
  let food = 0, snack = 0;
  Object.keys(days).filter(k => k.startsWith(ym)).forEach(k => (days[k].food || []).forEach(f => { food += N0(f.cost); if (f.snack) snack += N0(f.cost); }));
  const goods = liveItems().filter(x => x.date.startsWith(ym)).reduce((s,x) => s + x.price, 0);
  return {food, snack, goods, total: food + goods};
}
export function monthChart(endYm){
  const ms = []; for (let i = 5; i >= 0; i--) { const ym = addMonths(endYm, -i); ms.push({ym, ...monthStats(ym)}); }
  const max = Math.max(...ms.map(m => m.total));
  if (!max) return '<div class="empty">還沒有花費紀錄。記一筆時填金額，或新增物品，這裡就會長出圖。</div>';
  const W = 320, H = 150, top = 22, base = H - 22, bw = 30, gap = (W - 6*bw) / 6;
  const hY = v => v / max * (base - top);
  const bars = ms.map((m, i) => {
    const x = gap/2 + i * (bw + gap), hf = hY(m.food), hg = hY(m.goods);
    return `<g><rect x="${x.toFixed(1)}" y="${(base-hf).toFixed(1)}" width="${bw}" height="${hf.toFixed(1)}" class="bfood"/>
      <rect x="${x.toFixed(1)}" y="${(base-hf-hg).toFixed(1)}" width="${bw}" height="${hg.toFixed(1)}" class="bgoods"/>
      ${m.total ? `<text x="${(x+bw/2).toFixed(1)}" y="${(base-hf-hg-6).toFixed(1)}" text-anchor="middle" class="bv">${moneyShort(m.total)}</text>` : ''}
      <text x="${(x+bw/2).toFixed(1)}" y="${H-6}" text-anchor="middle" class="bl">${+m.ym.slice(5)} 月</text></g>`; }).join('');
  return `<svg class="mchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="近六個月花費：${ms.map(m => `${+m.ym.slice(5)} 月 ${money(m.total)}`).join('、')}">
    <line x1="0" y1="${base}" x2="${W}" y2="${base}" class="ax"/>${bars}</svg>
    <div class="legend"><span><i class="lf"></i>飲食</span><span><i class="lg"></i>物品</span></div>`;
}

export function reviewCard(x){
  const d = daysBetween(x.date, TODAY);
  return `<div class="rvcard" data-rid="${esc(x.id)}">
    <div class="rvhead">30 天回顧</div>
    <div class="rvq">${d <= 45 ? '一個月前' : fullDate(x.date) + ' '}買的 <b>${esc(x.name)} ${money(x.price)}</b>，用起來值得嗎？</div>
    <div class="rvopts" role="group" aria-label="值不值得">${REVIEWS.map(([k,l]) => `<button type="button" class="btn rvopt${k==='regret'?' rvregret':''}" data-rv="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
    <label class="field">備註（選填）<textarea rows="2" maxlength="200" placeholder="例：比想像中好用／買了其實很少用"></textarea></label>
    <div class="inline"><button type="button" class="btn primary" data-rvsave>記下來</button><button type="button" class="btn ghost" data-rvskip>這件不用問了</button><span class="note rvmsg" role="status"></span></div>
  </div>`;
}
export function bindReview(root, after){
  root.querySelectorAll('.rvcard').forEach(card => {
    const id = card.dataset.rid; let pick = null;
    const msg = card.querySelector('.rvmsg');
    card.querySelectorAll('[data-rv]').forEach(b => b.onclick = () => {
      pick = b.dataset.rv; card.querySelectorAll('[data-rv]').forEach(x => x.setAttribute('aria-pressed', x === b)); msg.textContent = ''; });
    card.querySelector('[data-rvsave]').onclick = () => {
      if (!pick) { msg.className = 'note warn rvmsg'; msg.textContent = '先選值得、普通或後悔。'; return; }
      const it = items.find(x => x.id === id); if (!it) return;
      saveItem({...it, review:{v:pick, note:card.querySelector('textarea').value.trim().slice(0,200), at:TODAY}});
      toast(pick === 'regret' ? `${it.name} 放進後悔清單了。下次想買類似的東西，先翻一下這張清單。`
        : pick === 'good' ? `${it.name}：值得。好東西就多用幾次，每天的成本會一直往下掉。` : `${it.name}：普通。記下來了。`);
      after(); };
    card.querySelector('[data-rvskip]').onclick = () => { const it = items.find(x => x.id === id); if (!it) return; saveItem({...it, ask:false}); after(); };
  });
}

/* 首頁的花費卡 */
export function renderSpend(){
  const ym = sel.slice(0,7), m = monthStats(ym);
  const label = ym === TODAY.slice(0,7) ? '本月' : `${+ym.slice(5)} 月`;
  $('#spendSum').textContent = m.total ? `${label} ${money(m.total)}` : '';
  $('#spendLine').textContent = m.total
    ? `飲食 ${money(m.food)}${m.snack ? `（零食 ${money(m.snack)}）` : ''} · 物品 ${money(m.goods)}`
    : `${label}還沒有花費紀錄。記一筆時順手填金額，買東西就新增物品。`;
  const due = dueReviews();
  $('#spendReview').innerHTML = due.length ? reviewCard(due[0]) + (due.length > 1 ? `<div class="note">還有 ${due.length - 1} 件等你回顧，在「物品與花費」裡。</div>` : '') : '';
  bindReview($('#spendReview'), render);
}

/* 物品與花費 */
export function openItems(){
  const live = liveItems(), year = TODAY.slice(0,4), due = dueReviews();
  const big = live.filter(x => x.type === 'big').sort((a,b) => b.date.localeCompare(a.date));
  const cyc = cycles();
  // 今年各分類
  const cats = {};
  live.filter(x => x.date.startsWith(year)).forEach(x => { cats[x.cat] = (cats[x.cat] || 0) + x.price; });
  let food = 0, snack = 0;
  Object.keys(days).filter(k => k.startsWith(year)).forEach(k => (days[k].food || []).forEach(f => { food += N0(f.cost); if (f.snack) snack += N0(f.cost); }));
  const rowsY = [...(food ? [['飲食', food, snack ? `其中零食 ${money(snack)}` : '']] : []), ...Object.entries(cats).map(([c,v]) => [c, v, ''])].sort((a,b) => b[1] - a[1]);
  const maxY = Math.max(1, ...rowsY.map(r => r[1]));
  const reviewed = live.filter(x => x.review);
  const regret = reviewed.filter(x => x.review.v === 'regret').sort((a,b) => b.price - a.price);
  const cnt = v => reviewed.filter(x => x.review.v === v).length;
  const all = [...live].sort((a,b) => b.date.localeCompare(a.date) || N0(b._t) - N0(a._t));

  openSheet(`
    <div class="sechead"><h2>物品與花費</h2><button class="btn primary" id="iAdd">＋ 新增物品</button></div>
    ${due.length ? `<div class="mlist">${due.map(reviewCard).join('')}</div>` : ''}
    <div class="wsec"><h3>近六個月花費</h3>${monthChart(TODAY.slice(0,7))}</div>
    <div class="wsec"><h3>${year} 年花在哪</h3>${rowsY.length ? rowsY.map(([c,v,sub]) => `<div class="yrow"><div class="t"><div>${esc(c)}${sub ? `<span class="m"> · ${sub}</span>` : ''}</div><div class="bar"><i style="width:${(v/maxY*100).toFixed(1)}%;background:var(--accent)"></i></div></div><span class="k num">${money(v)}</span></div>`).join('') : '<div class="empty">今年還沒有花費紀錄。</div>'}</div>
    <div class="wsec"><h3>大件：每日成本</h3>${big.length ? big.map(x => { const c = dailyCost(x); return `<div class="bigcard">
      <div class="sechead"><button type="button" class="linkish" data-edititem="${esc(x.id)}">${esc(x.name)}</button><span class="m num">${money(x.price)} · 已用 ${useLabel(c.used)}</span></div>
      ${costCurve(x)}
      <div class="sechead"><span class="note">現在每天</span><b class="big2 num">${money(c.now)}</b></div>
      <div class="note">${c.used >= x.years * 365 ? `已經用滿預計的 ${x.years} 年，之後每多用一天都是賺到。` : `用滿 ${x.years} 年，會降到每天 ${money(c.plan)}。`}</div></div>`; }).join('') : '<div class="empty">新增物品時選「大件」，就會在這裡看到它每天花你多少錢。</div>'}</div>
    <div class="wsec"><h3>消耗品：回購週期</h3>${cyc.length ? cyc.map(c => c.n < 2
      ? `<div class="crow"><div class="t"><div>${esc(c.name)}</div><div class="m">買過 1 次（${fullDate(c.last.date)}，${money(c.last.price)}）· 再買一次就算得出週期</div></div></div>`
      : `<div class="crow"><div class="t"><div>${esc(c.name)}</div><div class="m">平均 ${r0(c.avg)} 天一次 · 一年約 ${money(c.year)}</div></div><span class="${c.left <= 7 ? 'due' : 'm num'}">${c.left < 0 ? `可能用完了（預計 ${mmdd(c.next)}）` : c.left <= 7 ? `約 ${mmdd(c.next)} 用完` : `還有 ${c.left} 天`}</span></div>`).join('')
      : '<div class="empty">新增物品時選「消耗品」，同一個品名買第二次，就會算出多久買一次。</div>'}</div>
    <div class="wsec"><h3>後悔清單</h3>
      ${reviewed.length ? `<div class="m num">回顧過 ${reviewed.length} 件：值得 ${cnt('good')} · 普通 ${cnt('meh')} · 後悔 ${cnt('regret')}${regret.length ? ` · 後悔的共 ${money(regret.reduce((s,x) => s + x.price, 0))}` : ''}</div>` : ''}
      ${regret.length ? regret.map(x => `<div class="crow"><div class="t"><button type="button" class="linkish" data-edititem="${esc(x.id)}">${esc(x.name)}</button><div class="m">${fullDate(x.date)} · ${esc(x.cat)}${x.review.note ? ` · ${esc(x.review.note)}` : ''}</div></div><span class="k num">${money(x.price)}</span></div>`).join('')
        : `<div class="empty">${reviewed.length ? '目前沒有後悔的東西 👍' : '買滿 30 天的物品會問你值不值得，選「後悔」的會出現在這裡。'}</div>`}</div>
    <div class="wsec"><h3>全部物品 <span class="m num">${all.length} 件</span></h3>
      ${all.length ? all.map(x => `<div class="row"><button class="t" data-edititem="${esc(x.id)}" aria-label="修改 ${esc(x.name)}"><div class="nm">${esc(x.name)}<span class="tag">${typeName(x.type)}</span>${x.review ? `<span class="tag${x.review.v === 'regret' ? ' avoid' : ''}">${reviewName(x.review.v)}</span>` : ''}</div><div class="m">${fullDate(x.date)} · ${esc(x.cat)}</div></button><span class="k">${money(x.price)}</span></div>`).join('') : '<div class="empty">還沒有物品。</div>'}</div>
    <button class="btn block" id="iClose">完成</button>
  `, host => {
    $('#iAdd').onclick = () => openItemForm(null, openItems);
    $('#iClose').onclick = closeSheet;
    bindReview(host, () => { openItems(); render(); });
    host.querySelector('.sheet').scrollTop = 0;
  });
}

/* 新增／修改物品 */
export function openItemForm(it, back){
  const isNew = !it;
  const x = it ? {...it} : {name:'', price:'', date:sel, type:'gen', cat:'', years:3, ask:true};
  let type = x.type, cat = x.cat, years = x.years || 3, askTouched = !isNew, rv = x.review ? x.review.v : null;
  const names = [...new Set(liveItems().map(i => i.name))].slice(0, 200);
  openSheet(`
    <h2>${isNew ? '新增物品' : '修改物品'}</h2>
    <div class="field"><label for="iN">品名</label><input id="iN" maxlength="60" list="iNames" placeholder="例如 手機、洗髮精、外套" value="${esc(x.name)}" autocomplete="off">
      <datalist id="iNames">${names.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist></div>
    <div class="grid2">
      <label>價格（元）<input id="iP" type="number" inputmode="numeric" min="0" max="9999999" step="1" value="${x.price === '' ? '' : x.price}"></label>
      <label>購買日期<input id="iD" type="date" value="${x.date}" max="${TODAY}"></label>
    </div>
    <div class="field">類型<div class="tabs" id="iType" role="radiogroup" aria-label="類型">${ITEM_TYPES.map(([k,l]) => `<button type="button" role="radio" data-v="${k}" aria-selected="${k===type}" aria-checked="${k===type}">${l}</button>`).join('')}</div>
      <span class="note" id="iTypeNote"></span></div>
    <div class="field">分類<div class="seg" id="iCat">${ITEM_CATS.map(c => `<button type="button" data-v="${c}" aria-pressed="${c===cat}">${c}</button>`).join('')}</div></div>
    <div class="bigbox" id="iBig">
      <div class="sechead"><span>預計用幾年</span><div class="step"><button type="button" id="iYm" aria-label="減少一年">−</button><span id="iY"></span><button type="button" id="iYp" aria-label="增加一年">＋</button></div></div>
      <div class="sechead"><span class="note" id="iYNote"></span><b class="big2 num" id="iPer"></b></div>
    </div>
    <label class="note asktoggle"><input id="iAsk" type="checkbox" ${x.ask ? 'checked' : ''}> 30 天後問我值不值得（只跳一題，點一下就好）</label>
    ${!isNew && x.review ? `<div class="field">回顧<div class="seg" id="iRv">${REVIEWS.map(([k,l]) => `<button type="button" data-v="${k}" aria-pressed="${k===rv}">${l}</button>`).join('')}</div>
      <label class="field">備註<textarea id="iRvNote" rows="2" maxlength="200">${esc(x.review.note || '')}</textarea></label></div>` : ''}
    <div class="note" id="iMsg" role="status"></div>
    <div class="btnrow"><button class="btn primary" id="iSave">${isNew ? '記下來' : '儲存'}</button><button class="btn ghost" id="iBack">取消</button>${isNew ? '' : '<button class="btn ghost danger" id="iDel">刪除</button>'}</div>
  `, () => {
    const price = () => +$('#iP').value || 0;
    const showBig = () => {
      $('#iBig').hidden = type !== 'big';
      $('#iY').textContent = years + ' 年';
      $('#iYNote').textContent = `用滿 ${years} 年，每天約`;
      $('#iPer').textContent = price() ? money(price() / (years * 365)) : '—';
      $('#iTypeNote').textContent = type === 'big' ? '用很久的東西：手機、電腦、家電、包包。' : type === 'cons' ? '會用完再買的：洗髮精、保養品、衛生紙、貓砂。同一個品名，下次才算得出週期。' : '其他一次性的東西。';
    };
    $('#iType').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; type = b.dataset.v;
      $('#iType').querySelectorAll('button').forEach(z => { z.setAttribute('aria-selected', z === b); z.setAttribute('aria-checked', z === b); });
      if (!askTouched) $('#iAsk').checked = type !== 'cons';
      showBig(); });
    $('#iCat').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.v;
      $('#iCat').querySelectorAll('button').forEach(z => z.setAttribute('aria-pressed', z === b)); });
    $('#iRv') && $('#iRv').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; rv = b.dataset.v;
      $('#iRv').querySelectorAll('button').forEach(z => z.setAttribute('aria-pressed', z === b)); });
    $('#iYm').onclick = () => { years = Math.max(1, years - 1); showBig(); };
    $('#iYp').onclick = () => { years = Math.min(30, years + 1); showBig(); };
    $('#iP').oninput = showBig;
    $('#iAsk').onchange = () => { askTouched = true; };
    // 同名消耗品：帶入上次的分類和價格
    $('#iN').onchange = () => { if (!isNew) return; const prev = liveItems().filter(i => i.name === $('#iN').value.trim()).sort((a,b) => b.date.localeCompare(a.date))[0];
      if (!prev) return;
      if (!cat) { cat = prev.cat; $('#iCat').querySelectorAll('button').forEach(z => z.setAttribute('aria-pressed', z.dataset.v === cat)); }
      if (!$('#iP').value) $('#iP').value = prev.price;
      if (type !== prev.type) { const b = $(`#iType [data-v="${prev.type}"]`); b && b.click(); }
      showBig(); };
    const goBack = () => back ? back() : closeSheet();
    $('#iBack').onclick = goBack;
    let armed = false;
    $('#iDel') && ($('#iDel').onclick = () => {
      if (!armed) { armed = true; $('#iDel').textContent = '再按一次確認刪除'; return; }
      saveItem({...it, del:true}); render(); toast(`已刪除 ${it.name}。`); goBack(); });
    $('#iSave').onclick = () => {
      const msg = t => { $('#iMsg').className = 'note warn'; $('#iMsg').textContent = t; };
      const name = $('#iN').value.trim(), pIn = $('#iP').value.trim(), p = Math.round(+pIn), date = $('#iD').value;
      if (!name) return msg('請填品名。');
      if (pIn === '' || !(p >= 0 && p <= 9999999)) return msg('請填價格（0～9,999,999 元）。');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > TODAY) return msg('請選購買日期（不能是未來）。');
      if (!cat) return msg('請選一個分類。');
      const out = {id: isNew ? newId() + newId() : it.id, name, price:p, date, type, cat};
      if (type === 'big') out.years = years;
      if ($('#iAsk').checked) out.ask = true;
      if (!isNew && x.review && rv) out.review = {v:rv, note:($('#iRvNote') ? $('#iRvNote').value.trim().slice(0,200) : x.review.note || ''), at:x.review.at || TODAY};
      saveItem(out); render();
      let t;
      if (!isNew) t = `${name} 已更新。`;
      else if (type === 'big') t = `${name} 記好了。用滿 ${years} 年，每天約 ${money(p / (years * 365))}。`;
      else if (type === 'cons') { const c = cycles().find(z => z.name === name); t = c && c.n >= 2 ? `${name} 記好了，平均 ${r0(c.avg)} 天買一次，一年約 ${money(c.year)}。` : `${name} 記好了。下次再買，就算得出多久買一次。`; }
      else t = `${name} 記好了${out.ask ? '，30 天後問你值不值得' : ''}。`;
      toast(t); goBack(); };
    showBig();
  });
}

/* ---------- 綁定按鈕與事件（原本在頂層直接執行；入口在全部模組載入後依序呼叫）---------- */
export function bindMoney(){
  $('#bkCsv').onclick = () => {
    const q = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g,'""') + '"' : t; };
    const ml = Object.fromEntries(MEALS);
    const rows = [['日期','餐別','品名','熱量 kcal','蛋白質 g','碳水 g','脂肪 g','添加糖 g','纖維 g','鈉 mg','金額 元','零食','當日飲水 ml','當日體重 kg']];
    Object.keys(days).sort().forEach(k => { const d = days[k];
      if (!d.food.length && (d.water || d.weight)) rows.push([k,'','','','','','','','','','','',d.water||'',d.weight||'']);
      d.food.forEach((f,i) => rows.push([k, ml[f.meal]||'', f.name, f.k, f.p, f.c, f.f, N0(f.s), N0(f.fb), N0(f.na), N0(f.cost)||'', f.snack?'是':'', i===0?(d.water||''):'', i===0?(d.weight||''):''])); });
    if (rows.length === 1) { bkMsg('還沒有紀錄可以匯出。', true); return; }
    saveFile(`每日食帳-${stamp()}.csv`, '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'));
  };
}
