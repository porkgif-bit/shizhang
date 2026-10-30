/* 每日食帳 · care.js — 補給品與用藥：成分上限、打卡、間隔與乙醯胺酚守門、管理頁、行事曆提醒檔 */
import { $, N0, TODAY, addDays, closeSheet, dayOf, days, dur, esc, hm, newId, now, openSheet, profile, r1, saveDay, saveProfile, sel, toast } from './core.js';
import { render } from './diet.js';


/* ---------- 補給品與用藥 ---------- */
// 每日上限：食藥署「營養均衡完整配方食品」營養素規格附表的每日建議攝取量上限值；魚油為 EFSA 安全評估
export const NUTR = {
  vitc:{n:'維生素 C', u:'mg', ul:2000, tip:'大量吃容易腸胃不適，分次吃'},
  b6:{n:'維生素 B6', u:'mg', ul:80, tip:'B 群裡的 B6 有上限，吃兩種 B 群要加總'},
  niacin:{n:'菸鹼素（B3）', u:'mg', ul:35, tip:'臉紅發熱多半來自菸鹼酸型式'},
  folate:{n:'葉酸', u:'μg', ul:1000, tip:'上限指補充劑的葉酸，不含食物'},
  vitd:{n:'維生素 D', u:'μg', ul:50, tip:'脂溶性，隨餐吃。50 μg ＝ 2,000 IU'},
  vite:{n:'維生素 E', u:'mg', ul:1000, tip:'脂溶性，隨餐吃'},
  vita:{n:'維生素 A', u:'μg', ul:3000, tip:'脂溶性，會累積，綜合維他命也要算'},
  ca:{n:'鈣', u:'mg', ul:2500, tip:'一次吃太多吸收率下降，分次吃'},
  mg:{n:'鎂', u:'mg', ul:700, tip:'一次吃多容易拉肚子'},
  zn:{n:'鋅', u:'mg', ul:35, tip:'空腹吃容易反胃，可飯後吃'},
  fe:{n:'鐵', u:'mg', ul:40, tip:'和鈣片錯開吃'},
  epadha:{n:'魚油（EPA+DHA）', u:'mg', ul:5000, tip:'看「EPA+DHA」含量，不是魚油總量'},
  other:{n:'其他成分', u:'', ul:0, tip:''}
};
export const AVOIDS = ['酒精','葡萄柚／柚子','牛奶／乳製品','鈣片／鐵劑／制酸劑','咖啡因'];
export const AVOID_KW = {
  '酒精':['酒','啤酒','紅酒','白酒','高粱','調酒','燒酒','清酒','梅酒'],
  '葡萄柚／柚子':['葡萄柚','柚'],
  '牛奶／乳製品':['奶','乳','優格','優酪','起司','乳酪'],
  '咖啡因':['咖啡','茶','可樂','能量飲','拿鐵']
};
export const APAP_MAX = 4000;
export const TIMINGS = ['飯前','飯後','睡前','不限'];
export const KINDS = {short:'短期療程', long:'長期固定', prn:'需要時才吃'};
export const supps = () => profile.supps || (profile.supps = []);
export const meds = () => profile.meds || (profile.meds = []);
export const medActive = m => !m.archived && !(m.kind === 'short' && m.end && m.end < TODAY);
export function logsSince(kind, ms){
  const out = [];
  [addDays(TODAY,-1), TODAY].forEach(k => { const d = days[k]; if (d && Array.isArray(d[kind])) d[kind].forEach(x => { if (x.t >= now() - ms) out.push(x); }); });
  return out;
}
export function lastDose(id){ const l = logsSince('meds', 3*864e5).filter(x => x.id === id).sort((a,b) => b.t - a.t); return l[0] ? l[0].t : null; }
export function apap24(){ return logsSince('meds', 864e5).reduce((a,x) => a + N0(x.apap) * N0(x.qty), 0); }
export function nutrTotals(dayKey){
  const tot = {};
  ((days[dayKey] || {}).supps || []).forEach(x => (x.items || []).forEach(it => {
    if (!it.n || it.n === 'other') return; tot[it.n] = (tot[it.n] || 0) + N0(it.amt) * N0(x.qty); }));
  return tot;
}
export function activeAvoids(){
  const set = {};
  meds().filter(medActive).forEach(m => (m.avoid || []).forEach(a => { (set[a] = set[a] || []).push(m.name); }));
  return set;
}
// 記食物時：療程中勾了要避開的東西，名稱比對到就提醒（比對會漏，只當補強）
export function avoidMsg(foodName){
  const act = activeAvoids();
  for (const [a, names] of Object.entries(act)) {
    const kws = AVOID_KW[a]; if (!kws) continue;
    if (kws.some(k => foodName.includes(k))) return `你正在服用「${names.join('、')}」，藥袋註明要避開${a}。這筆已記錄，有疑問請問藥師。`;
  }
  return '';
}

export function renderCare(){
  const today = sel === TODAY, d = dayOf(sel);
  // 補給品
  const sl = supps(), dl = d.supps || [];
  $('#suppList').innerHTML = sl.length ? sl.map(s => {
    const mine = dl.filter(x => x.id === s.id), last = mine[mine.length - 1];
    const ing = (s.items || []).map(it => `${it.n === 'other' ? (it.label || '其他') : NUTR[it.n].n} ${it.amt}${it.n === 'other' ? (it.unit || '') : NUTR[it.n].u}`).join('、');
    const tip = (s.items || []).map(it => NUTR[it.n] && NUTR[it.n].tip).filter(Boolean)[0] || '';
    return `<div class="crow"><div class="t"><div>${esc(s.name)}${s.when ? `<span class="tag">${esc(s.when)}</span>` : ''}</div>
      <div class="m">${esc(ing)}${s.dose > 1 ? ` · 一次 ${s.dose} 顆` : ''}</div>${tip ? `<div class="tipline">${esc(tip)}</div>` : ''}</div>
      <div class="cact">${mine.length ? `<span class="done num">✓ ${hm(last.t)}${mine.length > 1 ? ` ×${mine.length}` : ''}</span>` : ''}
      ${today ? `<button class="btn${mine.length ? ' ghost' : ' primary'}" data-takesupp="${s.id}">${mine.length ? '再吃一次' : '吃了'}</button>` : ''}
      ${today && mine.length ? `<button class="linkbtn" data-undosupp="${s.id}">復原</button>` : ''}</div></div>`;
  }).join('') : '<div class="empty">還沒有補給品。按「管理」新增你在吃的品項。</div>';
  const tot = nutrTotals(sel);
  $('#suppTotals').innerHTML = Object.keys(tot).length ? '<div class="totals">' + Object.entries(tot).map(([k,v]) => {
    const N = NUTR[k], over = v > N.ul;
    return `<span class="chip${over ? ' overchip' : ''}">${N.n} <b>${r1(v).toLocaleString()}</b> / ${N.ul.toLocaleString()} ${N.u}</span>`; }).join('') + '</div>' : '';
  // 用藥
  const ml = meds().filter(medActive), dm = d.meds || [];
  $('#medList').innerHTML = ml.length ? ml.map(m => {
    const mine = dm.filter(x => x.id === m.id), last = lastDose(m.id);
    const next = last ? last + N0(m.gap) * 36e5 : null, wait = next && next > now() ? next - now() : 0;
    const full = N0(m.max) && mine.length >= m.max;
    const tags = [KINDS[m.kind], m.timing !== '不限' ? m.timing : '', m.kind === 'short' && m.end ? `到 ${m.end.slice(5).replace('-','/')}` : ''].filter(Boolean)
      .map(x => `<span class="tag">${esc(x)}</span>`).join('') + (m.avoid || []).map(a => `<span class="tag avoid">🚫 ${esc(a)}</span>`).join('');
    let status = `今天 ${mine.length}${N0(m.max) ? ` / ${m.max}` : ''} 次`;
    if (today) status += full ? ' · 今天已達上限' : wait ? ` · 下次最早 ${hm(next)}（還要 ${dur(wait)}）` : last ? ' · 現在可以吃' : '';
    return `<div class="crow${full || wait ? ' locked' : ''}"><div class="t"><div>${esc(m.name)}</div><div class="tags">${tags}</div>
      <div class="m">${status}${last ? ` · 上次 ${hm(last)}` : ''}</div></div>
      <div class="cact">${today ? `<button class="btn${full || wait ? ' ghost' : ' primary'}" data-takemed="${m.id}">吃了</button>` : ''}
      ${today && mine.length ? `<button class="linkbtn" data-undomed="${m.id}">復原</button>` : ''}</div></div>`;
  }).join('') : '<div class="empty">沒有進行中的藥物。按「管理」照藥袋新增。</div>';
  const ap = apap24();
  $('#apapLine').innerHTML = ap ? `<div class="note${ap >= APAP_MAX * 0.75 ? ' warn' : ''}">近 24 小時乙醯胺酚合計 <b class="num">${ap.toLocaleString()}</b> / ${APAP_MAX.toLocaleString()} mg（所有含此成分的藥一起算）</div>` : '';
  $('#careNote').hidden = today;
}

export function takeSupp(id){
  const s = supps().find(x => x.id === id); if (!s || sel !== TODAY) return;
  const d = dayOf(TODAY); d.supps = d.supps || [];
  const before = nutrTotals(TODAY);
  d.supps.push({id:s.id, name:s.name, t:now(), qty:N0(s.dose) || 1, items:(s.items || []).map(it => ({...it}))});
  saveDay(TODAY); render();
  const after = nutrTotals(TODAY), msgs = [];
  Object.entries(after).forEach(([k,v]) => { const N = NUTR[k]; if (v > N.ul && !(before[k] > N.ul)) msgs.push(`${N.n}今天 ${r1(v).toLocaleString()} ${N.u}，超過每日上限 ${N.ul.toLocaleString()} ${N.u}。有不適請聯絡藥師或就醫。`); });
  const has = (x, n) => (x.items || []).some(it => it.n === n);
  const recent = logsSince('supps', 2*36e5).filter(x => x.t < now() - 1000);
  if ((has(s,'fe') && recent.some(x => has(x,'ca'))) || (has(s,'ca') && recent.some(x => has(x,'fe')))) msgs.push('鈣和鐵會互搶吸收，下次建議錯開吃。');
  if ((has(s,'ca') || has(s,'fe')) && activeAvoids()['鈣片／鐵劑／制酸劑']) msgs.push(`你正在服用「${activeAvoids()['鈣片／鐵劑／制酸劑'].join('、')}」，藥袋註明要和鈣片／鐵劑錯開。間隔請照藥袋或問藥師。`);
  toast(msgs.join('') || `已記錄 ${s.name}，${hm(now())}。`);
}
export function takeMed(id, force){
  const m = meds().find(x => x.id === id); if (!m || sel !== TODAY) return;
  const qty = N0(m.dose) || 1, warns = [];
  const last = lastDose(m.id), mine = (dayOf(TODAY).meds || []).filter(x => x.id === m.id);
  if (last && N0(m.gap) && now() - last < m.gap * 36e5) warns.push(`上次 ${hm(last)} 才吃過，藥袋寫要間隔 ${m.gap} 小時，還要等 ${dur(last + m.gap*36e5 - now())}。`);
  if (N0(m.max) && mine.length >= m.max) warns.push(`今天已經吃了 ${mine.length} 次，藥袋寫一天最多 ${m.max} 次。`);
  const add = N0(m.apap) * qty, ap = apap24();
  if (add && ap + add > APAP_MAX) warns.push(`這次吃了之後，近 24 小時乙醯胺酚會到 ${(ap + add).toLocaleString()} mg，超過成人每日上限 ${APAP_MAX.toLocaleString()} mg。超量會增加肝損傷風險。`);
  if (warns.length && !force) {
    openSheet(`<h2>先確認一下</h2><div class="xbody">${warns.map(w => `<p>⚠️ ${esc(w)}</p>`).join('')}<p>如果是醫師或藥師另外交代的，可以照樣記錄。不確定的話，先問藥師。</p></div>
      <div class="btnrow"><button class="btn primary" id="mNo">先不要吃</button><button class="btn ghost" id="mYes">我確定，照樣記錄</button></div>`,
      () => { $('#mNo').onclick = closeSheet; $('#mYes').onclick = () => { closeSheet(); takeMed(id, true); }; });
    return;
  }
  const d = dayOf(TODAY); d.meds = d.meds || [];
  d.meds.push({id:m.id, name:m.name, t:now(), qty, apap:N0(m.apap)});
  saveDay(TODAY); render();
  let msg = `已記錄 ${m.name}，${hm(now())}。`;
  if (N0(m.gap)) msg += `下次最早 ${hm(now() + m.gap*36e5)}。`;
  if ((m.avoid || []).length) msg += `記得避開${m.avoid.join('、')}。`;
  toast(msg);
}
export function undoLog(kind, id){
  const d = dayOf(TODAY), arr = d[kind] || [];
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].id === id) { const x = arr.splice(i, 1)[0]; saveDay(TODAY); render(); toast(`已復原 ${x.name} ${hm(x.t)} 那一筆。`); return; }
}

/* --- 補給品管理 --- */
export function openSuppManager(){
  const sl = supps();
  openSheet(`<h2>我的補給品</h2>
    <div class="mlist">${sl.length ? sl.map(s => `<div class="crow"><div class="t"><div>${esc(s.name)}</div><div class="m">${(s.items||[]).length} 種成分${s.when ? ' · ' + esc(s.when) : ''}</div></div>
      <div class="cact"><button class="btn ghost" data-editsupp="${s.id}">編輯</button></div></div>`).join('') : '<div class="empty">還沒有補給品。</div>'}</div>
    <div class="btnrow"><button class="btn primary" id="sNew">新增補給品</button><button class="btn ghost" id="sDone">完成</button></div>`, () => {
    $('#sNew').onclick = () => openSuppForm(null);
    $('#sDone').onclick = closeSheet;
    document.querySelectorAll('[data-editsupp]').forEach(b => b.onclick = () => openSuppForm(b.dataset.editsupp));
  });
}
export function openSuppForm(id){
  const s = id ? supps().find(x => x.id === id) : {name:'', dose:1, when:'', items:[{n:'vitc', amt:''}]};
  let items = (s.items || []).map(x => ({...x}));
  const opts = sel => Object.entries(NUTR).map(([k,v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v.n}${v.u ? `（${v.u}）` : ''}</option>`).join('');
  openSheet(`<h2>${id ? '編輯' : '新增'}補給品</h2>
    <div class="field">品名<input id="fsName" maxlength="40" placeholder="例如 某牌 B 群、魚油" value="${esc(s.name)}"></div>
    <div class="grid2"><label>一次吃幾顆<input id="fsDose" type="number" inputmode="decimal" step="0.5" min="0.5" value="${s.dose || 1}"></label>
      <label>什麼時候吃<select id="fsWhen">${['','早餐','午餐','晚餐','睡前'].map(w => `<option value="${w}"${w === s.when ? ' selected' : ''}>${w || '不固定'}</option>`).join('')}</select></label></div>
    <div class="field">成分（每一顆的含量，看包裝營養標示）<div id="fsItems"></div></div>
    <button class="btn ghost" id="fsAddItem" type="button">＋ 再加一個成分</button>
    <div class="note">綜合維他命、B 群請把有上限的成分都填進去，App 才能跟其他產品加總。沒有列在清單的成分選「其他成分」，只記錄不檢查上限。</div>
    <div class="note warn" id="fsErr"></div>
    <div class="btnrow"><button class="btn primary" id="fsSave">儲存</button><button class="btn ghost" id="fsBack">返回</button>${id ? '<button class="btn ghost danger" id="fsDel">刪除</button>' : ''}</div>`, () => {
    const draw = () => {
      $('#fsItems').innerHTML = items.map((it, i) => `<div class="irow"><select data-i="${i}" class="iN">${opts(it.n)}</select>
        ${it.n === 'other' ? `<input data-i="${i}" class="iL" placeholder="名稱" value="${esc(it.label || '')}" style="width:90px">` : ''}
        <input data-i="${i}" class="iA" type="number" inputmode="decimal" placeholder="含量" value="${it.amt}" style="width:84px">
        ${it.n === 'other' ? `<input data-i="${i}" class="iU" placeholder="單位" value="${esc(it.unit || '')}" style="width:56px">` : `<span class="note">${NUTR[it.n].u}</span>`}
        <button class="del" type="button" data-rm="${i}" aria-label="移除這個成分">×</button>
        ${NUTR[it.n].tip ? `<div class="tipline">${NUTR[it.n].tip}</div>` : ''}</div>`).join('') || '<div class="empty">至少要有一個成分。</div>';
    };
    draw();
    $('#fsItems').addEventListener('change', e => { const i = +e.target.dataset.i; if (e.target.classList.contains('iN')) { items[i].n = e.target.value; draw(); } });
    $('#fsItems').addEventListener('input', e => { const i = +e.target.dataset.i, c = e.target.classList;
      if (c.contains('iA')) items[i].amt = e.target.value; if (c.contains('iL')) items[i].label = e.target.value; if (c.contains('iU')) items[i].unit = e.target.value; });
    $('#fsItems').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { items.splice(+b.dataset.rm, 1); draw(); } });
    $('#fsAddItem').onclick = () => { items.push({n:'zn', amt:''}); draw(); };
    $('#fsBack').onclick = openSuppManager;
    let armed = false;
    if ($('#fsDel')) $('#fsDel').onclick = () => { if (!armed) { armed = true; $('#fsDel').textContent = '再按一次確認刪除'; return; }
      profile.supps = supps().filter(x => x.id !== id); saveProfile(); render(); openSuppManager(); };
    $('#fsSave').onclick = () => {
      const name = $('#fsName').value.trim(), clean = items.filter(it => +it.amt > 0).map(it => it.n === 'other'
        ? {n:'other', amt:+it.amt, label:(it.label||'').trim().slice(0,20), unit:(it.unit||'').trim().slice(0,8)} : {n:it.n, amt:+it.amt});
      if (!name) { $('#fsErr').textContent = '請填品名。'; return; }
      if (!clean.length) { $('#fsErr').textContent = '請至少填一個成分的含量。'; return; }
      const v = {id: id || newId(), name, dose: Math.max(0.5, +$('#fsDose').value || 1), when: $('#fsWhen').value, items: clean};
      profile.supps = id ? supps().map(x => x.id === id ? v : x) : [...supps(), v];
      saveProfile(); render(); openSuppManager(); toast(`已儲存 ${name}。`);
    };
  });
}

/* --- 藥物管理 --- */
export function openMedManager(){
  const all = meds();
  openSheet(`<h2>我的藥物</h2>
    <div class="note">所有數值請照藥袋或藥師指示填寫。App 只幫你記得、守住間隔與次數，不判斷藥該怎麼吃。</div>
    <div class="mlist">${all.length ? all.map(m => `<div class="crow"><div class="t"><div>${esc(m.name)}${medActive(m) ? '' : '<span class="tag">已結束</span>'}</div>
      <div class="m">${KINDS[m.kind]}${N0(m.gap) ? ` · 間隔 ${m.gap} 小時` : ''}${N0(m.max) ? ` · 一天最多 ${m.max} 次` : ''}</div></div>
      <div class="cact"><button class="btn ghost" data-editmed="${m.id}">編輯</button></div></div>`).join('') : '<div class="empty">還沒有藥物。</div>'}</div>
    <div class="btnrow"><button class="btn primary" id="mNew">新增藥物</button><button class="btn ghost" id="mDone">完成</button></div>`, () => {
    $('#mNew').onclick = () => openMedForm(null);
    $('#mDone').onclick = closeSheet;
    document.querySelectorAll('[data-editmed]').forEach(b => b.onclick = () => openMedForm(b.dataset.editmed));
  });
}
export function openMedForm(id){
  const m = id ? meds().find(x => x.id === id) : {name:'', kind:'short', dose:1, apap:0, gap:'', max:'', timing:'飯後', end:addDays(TODAY, 2), times:'', avoid:[], other:''};
  const seg = (gid, list, cur) => `<div class="seg" id="${gid}">${list.map(([v,l]) => `<button type="button" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
  openSheet(`<h2>${id ? '編輯' : '新增'}藥物</h2>
    <div class="note">請拿著藥袋填。藥袋沒寫的欄位留空，或問藥師。</div>
    <div class="field">藥名<input id="fmName" maxlength="40" placeholder="例如 普拿疼加強錠" value="${esc(m.name)}"></div>
    <div class="field">類型${seg('fmKind', Object.entries(KINDS), m.kind)}</div>
    <div class="grid2">
      <label>一次幾顆<input id="fmDose" type="number" inputmode="decimal" step="0.5" min="0.5" value="${m.dose || 1}"></label>
      <label>最短間隔（小時）<input id="fmGap" type="number" inputmode="decimal" step="0.5" min="0" placeholder="例如 4" value="${m.gap || ''}"></label>
      <label>一天最多幾次<input id="fmMax" type="number" inputmode="numeric" min="0" placeholder="例如 4" value="${m.max || ''}"></label>
      <label id="fmEndL">療程最後一天<input id="fmEnd" type="date" value="${m.end || ''}"></label>
    </div>
    <div class="field">服用時機${seg('fmTiming', TIMINGS.map(t => [t,t]), m.timing)}</div>
    <label class="note"><input id="fmApapOn" type="checkbox" ${N0(m.apap) ? 'checked' : ''}> 成分含「乙醯胺酚」（普拿疼、很多感冒藥都有）</label>
    <div class="inline" id="fmApapRow"${N0(m.apap) ? '' : ' hidden'}>每顆 <input id="fmApap" type="number" inputmode="numeric" min="0" step="25" value="${m.apap || 500}" style="width:90px"> mg</div>
    <div class="field">藥袋註明要避開
      <div class="seg" id="fmAvoid">${AVOIDS.map(a => `<button type="button" data-v="${a}" aria-pressed="${(m.avoid||[]).includes(a)}">${a}</button>`).join('')}</div>
      <input id="fmOther" maxlength="30" placeholder="其他要避開的（選填）" value="${esc(m.other || '')}"></div>
    <div class="note" id="fmAvoidHelp">酒精：會增強鎮靜類藥物作用，和乙醯胺酚併用增加肝毒性風險。葡萄柚：會讓部分降血脂藥、鈣離子阻斷劑血中濃度變高。牛奶／鈣：會和部分抗生素結合、降低藥效。以上為一般說明，是否需要避開以藥袋或藥師為準。</div>
    <div class="field" id="fmTimesF">固定服藥時間（選填，加到行事曆用）<input id="fmTimes" placeholder="例如 08:00, 20:00" value="${esc(m.times || '')}"></div>
    <div class="note warn" id="fmErr"></div>
    <div class="btnrow"><button class="btn primary" id="fmSave">儲存</button><button class="btn ghost" id="fmBack">返回</button>
      ${id ? '<button class="btn ghost" id="fmIcs">加到行事曆</button><button class="btn ghost" id="fmArch"></button><button class="btn ghost danger" id="fmDel">刪除</button>' : ''}</div>`, () => {
    ['#fmKind','#fmTiming'].forEach(g => $(g).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      $(g).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); syncKind(); }));
    $('#fmAvoid').addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); });
    $('#fmApapOn').onchange = () => { $('#fmApapRow').hidden = !$('#fmApapOn').checked; };
    const kind = () => $('#fmKind [aria-pressed=true]').dataset.v;
    function syncKind(){ $('#fmEndL').hidden = kind() !== 'short'; $('#fmTimesF').hidden = kind() === 'prn'; }
    syncKind();
    $('#fmBack').onclick = openMedManager;
    const read = () => {
      const name = $('#fmName').value.trim();
      if (!name) { $('#fmErr').textContent = '請填藥名。'; return null; }
      const times = $('#fmTimes').value.split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean);
      if (times.some(t => !/^([01]?\d|2[0-3]):[0-5]\d$/.test(t))) { $('#fmErr').textContent = '服藥時間請用 08:00 這種格式，多個用逗號隔開。'; return null; }
      const avoid = [...document.querySelectorAll('#fmAvoid [aria-pressed=true]')].map(b => b.dataset.v);
      const other = $('#fmOther').value.trim(); if (other) avoid.push(other);
      return {id: id || newId(), name, kind: kind(), dose: Math.max(0.5, +$('#fmDose').value || 1), gap: Math.max(0, +$('#fmGap').value || 0),
        max: Math.max(0, Math.round(+$('#fmMax').value || 0)), timing: $('#fmTiming [aria-pressed=true]').dataset.v,
        end: kind() === 'short' ? ($('#fmEnd').value || '') : '', times: times.map(t => t.padStart(5,'0')).join(', '),
        apap: $('#fmApapOn').checked ? Math.max(0, +$('#fmApap').value || 0) : 0, avoid, other, archived: !!(m.archived)};
    };
    $('#fmSave').onclick = () => { const v = read(); if (!v) return;
      profile.meds = id ? meds().map(x => x.id === id ? v : x) : [...meds(), v]; saveProfile(); render(); openMedManager(); toast(`已儲存 ${v.name}。`); };
    if (id) {
      $('#fmArch').textContent = m.archived ? '重新啟用' : '結束這個藥';
      $('#fmArch').onclick = () => { profile.meds = meds().map(x => x.id === id ? {...x, archived: !x.archived} : x); saveProfile(); render(); openMedManager(); };
      let armed = false;
      $('#fmDel').onclick = () => { if (!armed) { armed = true; $('#fmDel').textContent = '再按一次確認刪除'; return; }
        profile.meds = meds().filter(x => x.id !== id); saveProfile(); render(); openMedManager(); };
      $('#fmIcs').onclick = () => { const v = read(); if (v) medIcs(v); };
    }
  });
}
// 產生行事曆檔：每天固定時間響鈴，交給 iPhone 行事曆提醒（App 關著也會響）
export function medIcs(m){
  if (!m.times) { toast('先在「固定服藥時間」填時間，例如 08:00, 20:00。'); return; }
  const z = n => String(n).padStart(2,'0'), d0 = TODAY.replace(/-/g,'');
  const st = new Date(), stamp = `${st.getUTCFullYear()}${z(st.getUTCMonth()+1)}${z(st.getUTCDate())}T${z(st.getUTCHours())}${z(st.getUTCMinutes())}00Z`;
  const escI = s => String(s).replace(/[\\,;]/g, c => '\\' + c).replace(/\n/g, '\\n');
  const desc = [m.timing !== '不限' ? m.timing : '', `一次 ${m.dose} 顆`, (m.avoid||[]).length ? '避開：' + m.avoid.join('、') : ''].filter(Boolean).join('｜');
  const ev = m.times.split(', ').map((t, i) => [
    'BEGIN:VEVENT', `UID:${m.id}-${i}-${d0}@shizhang`, `DTSTAMP:${stamp}`, `DTSTART:${d0}T${t.replace(':','')}00`, 'DURATION:PT5M',
    'RRULE:FREQ=DAILY' + (m.kind === 'short' && m.end ? `;UNTIL=${m.end.replace(/-/g,'')}T235959` : ''),
    `SUMMARY:${escI('吃藥：' + m.name)}`, `DESCRIPTION:${escI(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escI('吃藥：' + m.name)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//shizhang//每日食帳//ZH','CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], {type:'text/calendar'})); a.download = `吃藥提醒-${m.name}.ics`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast('已產生行事曆檔。iPhone 會問你要不要加入行事曆，選「加入全部」。改了時間要重新產生，並刪掉舊的行程。');
}

/* ---------- 綁定按鈕與事件（原本在頂層直接執行；入口在全部模組載入後依序呼叫）---------- */
export function bindCare(){
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.takesupp) takeSupp(b.dataset.takesupp);
    else if (b.dataset.undosupp) undoLog('supps', b.dataset.undosupp);
    else if (b.dataset.takemed) takeMed(b.dataset.takemed);
    else if (b.dataset.undomed) undoLog('meds', b.dataset.undomed);
  });
  $('#suppManage').onclick = () => openSuppManager();
  $('#medManage').onclick = () => openMedManager();
  // 倒數每分鐘更新一次
  setInterval(() => { if (profile && sel === TODAY && document.visibilityState === 'visible' && !$('#sheetHost').innerHTML) renderCare(); }, 60000);
}
