/* 每日食帳 · review.js — 本週回顧：週資料彙整、換法建議、週心得、複製給 AI、首頁週卡 */
import { $, N0, TODAY, addDays, closeSheet, days, esc, isLogged, mmdd, now, openSheet, parseYmd, profile, r0, r1, saveProfile, sel, toast, weekStart } from './core.js';
import { GRADE_VER, calc, gradeDay } from './diet.js';

// 品項名稱 → 換法（規則比對，名稱越具體越準）
export const SWAPS = {
  fat: [
    [['炸','酥','雞排','排骨','鹹酥','薯條','天婦羅'], '改點烤、滷或蒸的版本，每份常可省 10 g 以上脂肪'],
    [['雞腿'], '換成雞胸，或雞腿去皮'],
    [['五花','三層','控肉','滷肉','肉燥','爌肉'], '換成瘦肉、里肌，或滷肉飯改雞肉飯'],
    [['奶茶','拿鐵','奶精'], '改低脂鮮奶或無糖茶'],
    [['可頌','酥皮','蛋塔','起酥'], '改全麥吐司、饅頭'],
    [['沙拉醬','美乃滋','千島'], '改和風醬，或醬另外放'],
    [['堅果','花生','腰果'], '一天一小把（約一湯匙）就好'],
    [['炒','乾煎','香煎'], '問店家能不能少油，或改燙、蒸'],
    [['油','奶油','豬油'], '這筆本身就是油，下次減半']
  ],
  na: [
    [['湯','麵','拉麵','火鍋'], '湯喝兩三口就好，鈉大多在湯裡'],
    [['滷','醬','燴','勾芡'], '醬汁另外放，不要拌飯'],
    [['泡麵','科學麵'], '調味包只放一半'],
    [['香腸','火腿','培根','熱狗','臘'], '換原型肉，加工肉品鈉很高'],
    [['醃','泡菜','鹹','梅干'], '醃漬配菜少夾幾口']
  ],
  s: [
    [['手搖','珍奶','奶茶','紅茶','綠茶','多多','冬瓜','可樂','汽水'], '改微糖或無糖，全糖換無糖一杯少 30 g 以上'],
    [['蛋糕','甜點','餅乾','巧克力','麵包','布丁'], '甜點改成飯後一小份，或換水果']
  ]
};
export function swapFor(kind, name){ const hit = SWAPS[kind].find(([kws]) => kws.some(k => name.includes(k))); return hit ? hit[1] : ''; }
export function weekData(ws){
  const keys = Array.from({length:7}, (_, i) => addDays(ws, i));
  const logged = keys.filter(k => days[k] && days[k].food.length);
  const rows = logged.map(k => { const R = calc(k), d = days[k], G = gradeDay(k), L = k < TODAY ? (d.grade || null) : null;
    return {k, R, e:R.eat, d, G, L, dow: parseYmd(k).getDay()}; });
  const avg = f => rows.length ? rows.reduce((a, r) => a + f(r), 0) / rows.length : 0;
  const agg = kind => { const m = {}; rows.forEach(r => r.d.food.forEach(f => { const v = N0(f[kind]); if (!v) return;
    const key = f.name.replace(/\s*[×x]\s*[\d.]+$/, '').replace(/\s+[\d.]+\s*(g|份|碗|顆|杯|片|個)$/, '');
    (m[key] = m[key] || {n:key, v:0, c:0}); m[key].v += v; m[key].c++; })); return Object.values(m).sort((a,b) => b.v - a.v); };
  const nLogged = keys.filter(isLogged).length;
  const elapsed = keys.filter(k => k <= TODAY).length; // 本週還沒過完時，已過幾天
  return {ws, keys, rows, avg, agg, nLogged, elapsed, done: elapsed === 7 && keys[6] < TODAY};
}
export function logLine(W, wk){ return `${wk}記錄 ${W.nLogged}/7 天` + (W.done ? '' : `（已過 ${W.elapsed} 天）`); }
export function weekReview(ws){
  const W = weekData(ws), rows = W.rows, n = rows.length;
  if (!n) return null;
  const avgK = W.avg(r => r.e.k), avgT = W.avg(r => r.R.tdee), avgTarget = W.avg(r => r.R.target);
  const deficit = avgT - avgK, planned = W.avg(r => r.R.tdee - r.R.target);
  const avgP = W.avg(r => r.e.p), pT = W.avg(r => r.R.pT), pDays = rows.filter(r => r.e.p >= r.R.pT * 0.95).length;
  const avgF = W.avg(r => r.e.f), fT = W.avg(r => r.R.fT), fatPct = W.avg(r => r.e.k ? r.e.f*9/r.e.k : 0);
  const fatDays = rows.filter(r => r.e.k && r.e.f*9/r.e.k > 0.30).length;
  const naRows = rows.filter(r => r.e.na > 0), naOver = naRows.filter(r => r.e.na > r.R.naT).length;
  const sOver = rows.filter(r => r.e.s > r.R.sT).length;
  const avgFb = W.avg(r => r.e.fb), fbT = W.avg(r => r.R.fbT);
  const waterDays = rows.filter(r => r.d.water >= r.R.waterT).length;
  // ① 結論
  let verdict;
  if (deficit < -50) verdict = `平均每天吃 ${r0(avgK).toLocaleString()} kcal，比消耗多約 ${r0(-deficit)} kcal，這週體重可能往上。`;
  else if (deficit < 50) verdict = `平均每天吃 ${r0(avgK).toLocaleString()} kcal，大約是維持量，體重應該持平。`;
  else if (planned > 0 && deficit < planned * 0.7) verdict = `平均每天吃 ${r0(avgK).toLocaleString()} kcal，比消耗少約 ${r0(deficit)} kcal。方向正確，但速度大約是計畫的 ${r0(deficit/planned*100)}%。`;
  else if (avgK < avgTarget * 0.9) verdict = `平均每天吃 ${r0(avgK).toLocaleString()} kcal，赤字約 ${r0(deficit)} kcal，比計畫還大。吃太少容易掉肌肉、撐不久，可以吃回目標。`;
  else verdict = `平均每天吃 ${r0(avgK).toLocaleString()} kcal，赤字約 ${r0(deficit)} kcal，照計畫在走。`;
  // ② 做得好的
  const good = [];
  if (pDays >= Math.ceil(n * 0.7)) good.push(`蛋白質平均 ${r0(avgP)} g，${pDays}/${n} 天達標，肌肉有顧到。`);
  if (waterDays >= Math.ceil(n * 0.7)) good.push(`飲水 ${waterDays}/${n} 天達標。`);
  if (sOver === 0 && rows.some(r => r.e.s > 0 || r.d.food.length)) good.push('添加糖整週沒有超過上限。');
  if (n >= 5) good.push(`這週記了 ${n} 天，紀錄本身就是最有效的習慣。`);
  if (deficit > 50 && !(avgK < avgTarget * 0.9)) good.push(`整週維持熱量赤字，平均每天約 ${r0(deficit)} kcal。`);
  // ③④ 問題排序：嚴重度
  const issues = [];
  if (fatPct > 0.32) issues.push({kind:'fat', sev:(fatPct - 0.30) * 12, title:'脂肪',
    stat:`平均每天 ${r0(avgF)} g，目標 ${r0(fT)} g，佔熱量 ${r0(fatPct*100)}%（建議 20–30%），${fatDays}/${n} 天超過 30%。`,
    goal:{type:'fat', v: Math.max(r0(fT), Math.round((avgF + fT) / 2 / 5) * 5), text: v => `脂肪每天 ${v} g 以下`}});
  if (naRows.length && naOver >= 2) issues.push({kind:'na', sev: naOver / n * 2, title:'鈉',
    stat:`${naOver}/${naRows.length} 天超過 2,300 mg。`, goal:{type:'na', v:2300, text: v => `鈉每天 ${v.toLocaleString()} mg 以下`}});
  if (sOver >= 2) issues.push({kind:'s', sev: sOver / n * 2, title:'添加糖', stat:`${sOver}/${n} 天超過上限。`, goal:{type:'s', v:0, text: () => '添加糖不超過上限'}});
  if (avgFb < fbT * 0.6) issues.push({kind:'fb', sev:(1 - avgFb / fbT) * 0.8, title:'纖維',
    stat:`平均每天 ${r1(avgFb)} g，目標 ${r0(fbT)} g。`, goal:{type:'fb', v: Math.min(r0(fbT), Math.max(8, Math.round((avgFb + fbT) / 2))), text: v => `纖維每天 ${v} g 以上（比現在每天多約 ${Math.max(1, Math.ceil((v - avgFb) / 2))} 份青菜）`}});
  if (pDays < Math.ceil(n * 0.5)) issues.push({kind:'p', sev:(1 - avgP / pT) * 3, title:'蛋白質', stat:`平均 ${r0(avgP)} g，目標 ${r0(pT)} g，只有 ${pDays}/${n} 天達標。`,
    goal:{type:'p', v:r0(pT), text: v => `蛋白質每天 ${v} g 以上`}});
  if (deficit < -50) issues.push({kind:'k', sev: -deficit / 200, title:'熱量', stat:`平均比消耗多 ${r0(-deficit)} kcal。`, goal:{type:'k', v:r0(avgTarget), text: v => `熱量每天 ${v.toLocaleString()} kcal 以內`}});
  issues.sort((a,b) => b.sev - a.sev);
  const top = issues.slice(0, 2).map(it => {
    let sources = [], how = '';
    if (it.kind === 'fat' || it.kind === 'na' || it.kind === 's') {
      const key = it.kind === 'fat' ? 'f' : it.kind;
      sources = W.agg(key).slice(0, 3).map(x => ({...x, swap: swapFor(it.kind, x.n)}));
      if (it.kind === 'fat') { const save = r0((avgF - it.goal.v) * 9); how = save > 0 ? `降到每天 ${it.goal.v} g，每天少約 ${save} kcal，一週約 ${(save*7).toLocaleString()} kcal 的赤字。` : ''; }
    } else if (it.kind === 'fb') how = '最省力的補法：午餐、晚餐各加一份燙青菜（每份約 2 g）；白飯換糙米飯，每碗再多 1 g；水果選芭樂，一顆約 5 g。';
    else if (it.kind === 'p') how = '每餐先放一份豆魚蛋肉（約 7 g 蛋白質）：一顆蛋、一杯無糖豆漿、掌心大小的魚或雞胸。';
    else if (it.kind === 'k') how = '先看熱量最高的前三筆，通常是飲料、炸物或宵夜，換掉其中一樣就夠。';
    return {...it, sources, how};
  });
  // ⑤ 時間模式
  const pattern = [];
  const wkend = rows.filter(r => r.dow === 0 || r.dow === 6), wkday = rows.filter(r => r.dow > 0 && r.dow < 6);
  if (wkend.length && wkday.length >= 2) { const a = wkend.reduce((s,r) => s + r.e.k, 0) / wkend.length, b = wkday.reduce((s,r) => s + r.e.k, 0) / wkday.length;
    if (Math.abs(a - b) >= 150) pattern.push(`週末平均比平日${a > b ? '多' : '少'} ${r0(Math.abs(a - b))} kcal。`); }
  const share = m => { const tot = rows.reduce((s,r) => s + r.e.k, 0); return tot ? rows.reduce((s,r) => s + r.d.food.filter(f => f.meal === m).reduce((x,f) => x + f.k, 0), 0) / tot : 0; };
  if (share('d') > 0.45) pattern.push(`晚餐佔全天熱量 ${r0(share('d')*100)}%，晚上吃得比較集中。`);
  if (share('s') > 0.20) pattern.push(`點心佔全天熱量 ${r0(share('s')*100)}%。`);
  if (n >= 3) { const hi = rows.slice().sort((a,b) => b.e.k - a.e.k)[0]; if (hi.e.k > avgK * 1.15) pattern.push(`吃最多的是 ${mmdd(hi.k)}（${r0(hi.e.k).toLocaleString()} kcal），比平均多 ${r0(hi.e.k - avgK)}。`); }
  // ⑦ 資料提醒
  const notes = [];
  const missingDays = W.keys.filter(k => k <= TODAY && !(days[k] && days[k].food.length));
  if (missingDays.length) notes.push(`${missingDays.map(mmdd).join('、')} 沒有飲食紀錄。`);
  const noNa = rows.filter(r => r.e.na < 300).length;
  if (noNa) notes.push(`有 ${noNa} 天的鈉低於 300 mg，可能是品項沒有填鈉，鈉的結論僅供參考。`);
  const thin = rows.filter(r => !isLogged(r.k)).length;
  if (thin) notes.push(`有 ${thin} 天只記到 0–1 餐且沒有標記「這天就吃這些」，當作可能漏記。`);
  // 上週目標達成
  const prevGoals = (profile.weekGoals || {})[ws] || [];
  const goalCheck = prevGoals.map(gl => {
    const ok = rows.filter(r => gl.type === 'fat' ? r.e.f <= gl.v : gl.type === 'na' ? r.e.na <= gl.v : gl.type === 's' ? r.e.s <= r.R.sT
      : gl.type === 'fb' ? r.e.fb >= gl.v : gl.type === 'p' ? r.e.p >= gl.v : gl.type === 'k' ? r.e.k <= gl.v : false).length;
    return {...gl, ok, n};
  });
  const grades = rows.map(r => ({k:r.k, g:r.G.g, score:r.G.score, was: r.L && r.L.score !== r.G.score ? r.L.g : '', old: !!(r.L && r.L.v < GRADE_VER)}));
  const logText = logLine(W, ws === weekStart(TODAY) ? '本週' : '這週')
    + (W.done ? (W.nLogged >= 6 ? ' · 納入 TDEE 回推' : ' · 未滿 6 天，這週不納入 TDEE 回推') : W.nLogged + (7 - W.elapsed) < 6 ? ' · 已無法滿 6 天，這週不納入 TDEE 回推' : '');
  return {ws, n, rows, logText, avgK, avgT, deficit, planned, avgP, avgF, fatPct, avgFb, verdict, good, top, pattern, notes, goalCheck, grades,
    nextGoals: top.map(t => ({type:t.goal.type, v:t.goal.v, text:t.goal.text(t.goal.v)}))};
}

export function openWeek(ws){
  ws = ws || weekStart(sel);
  const V = weekReview(ws), we = addDays(ws, 6), nextWs = addDays(ws, 7);
  const note = ((profile.weekNotes || {})[ws]) || {};
  const nav = `<div class="weeknav"><button class="btn ghost" id="wkPrev">‹ 上一週</button><b class="num">${mmdd(ws)}–${mmdd(we)}</b>
    <button class="btn ghost" id="wkNext"${nextWs > TODAY ? ' disabled' : ''}>下一週 ›</button></div>`;
  const body = !V ? '<div class="empty">這週還沒有飲食紀錄。</div>' : `
    <div class="note${V.logText.includes('不納入') ? ' warn' : ''}">${esc(V.logText)}</div>
    <div class="wsec"><h3>① 一句話結論</h3><p>${esc(V.verdict)}</p>
      <div class="gstrip">${V.grades.map(x => `<span class="gpill g${x.g}"><b>${x.was ? (x.old ? '舊' : '') + x.was + '→' : ''}${x.g}</b>${mmdd(x.k)}</span>`).join('')}</div></div>
    ${V.goalCheck.length ? `<div class="wsec"><h3>上週定的目標</h3>${V.goalCheck.map(gl => `<p>${gl.ok >= Math.ceil(gl.n*0.7) ? '✅' : '◻️'} ${esc(gl.text)}：達成 ${gl.ok}/${gl.n} 天</p>`).join('')}</div>` : ''}
    ${V.good.length ? `<div class="wsec"><h3>② 做得好的，繼續保持</h3>${V.good.map(x => `<p>👍 ${esc(x)}</p>`).join('')}</div>` : ''}
    ${V.top.map((t, i) => `<div class="wsec"><h3>${i === 0 ? '③ 最該調整的一件事' : '④ 第二件事'}：${t.title}</h3><p>${esc(t.stat)}</p>
      ${t.sources.length ? `<p class="m">這週${t.title}最多的來源：</p><ol class="srcs">${t.sources.map(s => `<li><b>${esc(s.n)}</b>（${s.c} 次，共 ${r0(s.v).toLocaleString()} ${t.kind === 'na' ? 'mg' : 'g'}）${s.swap ? `<br><span class="m">→ ${esc(s.swap)}</span>` : ''}</li>`).join('')}</ol>` : ''}
      ${t.how ? `<p>${esc(t.how)}</p>` : ''}</div>`).join('')}
    ${!V.top.length ? '<div class="wsec"><h3>③ 最該調整的一件事</h3><p>這週沒有明顯的問題，照現在的方式繼續。</p></div>' : ''}
    ${V.pattern.length ? `<div class="wsec"><h3>⑤ 你的飲食時間模式</h3>${V.pattern.map(x => `<p>${esc(x)}</p>`).join('')}</div>` : ''}
    ${V.nextGoals.length ? `<div class="wsec"><h3>⑥ 下週目標</h3>${V.nextGoals.map(gl => `<p>🎯 ${esc(gl.text)}</p>`).join('')}
      <button class="btn${(profile.weekGoals || {})[nextWs] ? ' ghost' : ' primary'}" id="wkGoals">${(profile.weekGoals || {})[nextWs] ? '已設為下週目標 ✓' : '設為下週目標'}</button></div>` : ''}
    ${V.notes.length ? `<div class="wsec"><h3>⑦ 資料提醒</h3>${V.notes.map(x => `<p class="m">${esc(x)}</p>`).join('')}</div>` : ''}`;
  openSheet(`<h2>本週回顧</h2>${nav}${body}
    <div class="wsec journal"><h3>✍️ 本週心得</h3>
      <div class="field">這週維持下來的辛苦程度
        <div class="seg" id="wjHard">${['很輕鬆','還好','有點辛苦','很辛苦','快撐不住'].map((l,i) => `<button type="button" data-v="${i+1}" aria-pressed="${note.hard === i+1}">${l}</button>`).join('')}</div></div>
      <div class="field">這週做到了什麼、有什麼心得<textarea id="wjKeep" rows="3" maxlength="600" placeholder="例如：午餐固定吃雞胸便當，比想像中容易">${esc(note.keep || '')}</textarea></div>
      <div class="field">最難的是什麼<textarea id="wjHardText" rows="2" maxlength="600" placeholder="例如：週末聚餐很難控制">${esc(note.hardText || '')}</textarea></div>
      <div class="field">下週想試試<textarea id="wjNext" rows="2" maxlength="400" placeholder="例如：聚餐前先吃一份蛋白質">${esc(note.next || '')}</textarea></div>
      <div class="btnrow"><button class="btn primary" id="wjSave">儲存心得</button><span class="note" id="wjMsg"></span></div></div>
    <div class="wsec"><h3>🤖 貼給你的 AI 討論</h3>
      <p class="m">把這週的數據、阿鹽的分析和你的心得，整理成 AI 讀得懂的格式。複製後貼到 Claude、ChatGPT 等對話裡就能直接討論。</p>
      <label class="note"><input id="wkBody" type="checkbox" checked> 包含身高、體重、年齡（AI 才能判斷目標是否合理）</label>
      <div class="btnrow"><button class="btn" id="wkCopy">複製給 AI</button><button class="btn ghost" id="wkShare">分享…</button></div>
      <textarea id="wkText" rows="5" readonly hidden></textarea></div>
    <button class="btn primary block" id="wkClose">關閉</button>`, () => {
    $('#wkPrev').onclick = () => openWeek(addDays(ws, -7));
    $('#wkNext').onclick = () => { if (nextWs <= TODAY) openWeek(nextWs); };
    $('#wkClose').onclick = closeSheet;
    $('#wjHard').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      const on = b.getAttribute('aria-pressed') === 'true'; $('#wjHard').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', String(!on)); });
    $('#wjSave').onclick = () => {
      const p = $('#wjHard [aria-pressed=true]');
      profile.weekNotes = profile.weekNotes || {};
      profile.weekNotes[ws] = {hard: p ? +p.dataset.v : 0, keep: $('#wjKeep').value.trim(), hardText: $('#wjHardText').value.trim(), next: $('#wjNext').value.trim(), t: now()};
      saveProfile(); $('#wjMsg').textContent = '已儲存。';
      const h = profile.weekNotes[ws].hard;
      if (h >= 4) toast('辛苦了。撐得很累的話，可以把赤字從 15% 調小到 10%，慢一點但走得久。設定裡就能改。');
    };
    if ($('#wkGoals')) $('#wkGoals').onclick = () => {
      profile.weekGoals = profile.weekGoals || {}; profile.weekGoals[nextWs] = V.nextGoals; saveProfile();
      $('#wkGoals').textContent = '已設為下週目標 ✓'; $('#wkGoals').className = 'btn ghost'; toast('下週回顧會自動檢查這些目標有沒有做到。');
    };
    const text = () => aiText(ws, V, $('#wkBody').checked);
    $('#wkCopy').onclick = async () => {
      const t = text();
      try { await navigator.clipboard.writeText(t); toast('已複製。貼到你的 AI 對話裡就能討論。'); }
      catch { $('#wkText').hidden = false; $('#wkText').value = t; $('#wkText').focus(); $('#wkText').select(); toast('沒辦法自動複製，文字已選取，請按「拷貝」。'); }
    };
    $('#wkShare').onclick = async () => {
      try { if (navigator.share) { await navigator.share({title:'每日食帳週回顧', text:text()}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      $('#wkCopy').click();
    };
  });
}
// 給 AI 的格式：Markdown、單位寫在欄位名、目標和實際並列、標出資料缺口，最後附上可直接用的提問
export function aiText(ws, V, withBody){
  const we = addDays(ws, 6), note = ((profile.weekNotes || {})[ws]) || {}, R0 = V && V.rows[0] ? V.rows[0].R : calc(TODAY);
  const L = [];
  L.push(`# 飲食紀錄週回顧（${ws} 至 ${we}）`, '', '以下資料來自我的飲食紀錄 App「每日食帳」。數值為自行記錄，可能有漏記或估算誤差。', '');
  L.push('## 我的基本設定');
  if (withBody) L.push(`- ${profile.sex === 'm' ? '男' : '女'}性，${profile.age} 歲，身高 ${profile.height} cm，目前體重 ${R0.W} kg${profile.bf ? `，體脂率 ${profile.bf}%` : ''}`);
  L.push(`- 目標：減脂（熱量赤字 ${Math.round(profile.deficit*100)}%），日常活動係數 ${profile.pal}`);
  L.push(`- 每日目標：熱量約 ${r0(R0.target)} kcal（估計 TDEE ${r0(R0.tdee)} kcal、BMR ${r0(R0.bmr)} kcal；運動估算消耗只作參考，不加進目標），蛋白質 ${r0(R0.pT)} g（${profile.pkg} g/kg），脂肪 ${r0(R0.fT)} g（25%），碳水 ${r0(R0.cT)} g`);
  L.push(`- 每日上限：添加糖 ${r0(R0.sT)} g、鈉 2,300 mg；纖維目標 ${r0(R0.fbT)} g`, '');
  if (!V) { L.push('這週沒有飲食紀錄。'); return L.join('\n'); }
  L.push(`- 記錄完整度：${V.logText}（早午晚至少兩餐，或使用者標記「這天就吃這些」才算一天）`, '');
  L.push('## 每日數據', '', '| 日期 | 熱量 kcal | 目標 kcal | 蛋白質 g | 碳水 g | 脂肪 g | 脂肪佔熱量 | 添加糖 g | 纖維 g | 鈉 mg | 飲水 ml | 運動 | App 評分 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  V.rows.forEach(r => { const e = r.e, G = r.G, was = r.L && r.L.score !== G.score ? (r.L.v < GRADE_VER ? `，舊制評分 ${r.L.g}（計分方式更新）` : `，結算時 ${r.L.g}，補登後改變`) : '';
    L.push(`| ${mmdd(r.k)}(${'日一二三四五六'[r.dow]}) | ${r0(e.k)} | ${r0(r.R.target)} | ${r0(e.p)} | ${r0(e.c)} | ${r0(e.f)} | ${e.k ? r0(e.f*9/e.k*100) : 0}% | ${r0(e.s)} | ${r1(e.fb)} | ${r0(e.na)} | ${r.d.water} | ${r.d.ex.length ? r.d.ex.map(x => `${x.name}${x.min}分`).join('、') : '無'} | ${G.g}（${G.score}${was}） |`); });
  L.push('', `週平均：熱量 ${r0(V.avgK)} kcal（估計消耗 ${r0(V.avgT)}，每日赤字約 ${r0(V.deficit)}），蛋白質 ${r0(V.avgP)} g，脂肪 ${r0(V.avgF)} g（佔 ${r0(V.fatPct*100)}%），纖維 ${r1(V.avgFb)} g`, '');
  const W = weekData(ws), topK = W.agg('k').slice(0, 8);
  if (topK.length) { L.push('## 這週熱量貢獻最多的品項', ''); topK.forEach(x => L.push(`- ${x.n}：${x.c} 次，共 ${r0(x.v)} kcal`)); L.push(''); }
  const sl = W.rows.flatMap(r => (r.d.supps || []).map(x => x.name)), ml = W.rows.flatMap(r => (r.d.meds || []).map(x => x.name));
  if (sl.length) L.push(`補給品：${[...new Set(sl)].join('、')}`);
  if (ml.length) L.push(`用藥：${[...new Set(ml)].join('、')}（僅記錄，請勿依此調整藥物）`);
  if (sl.length || ml.length) L.push('');
  L.push('## App 的自動分析', '', `- 結論：${V.verdict}`);
  V.good.forEach(x => L.push(`- 做得好：${x}`));
  V.top.forEach(t => L.push(`- 待調整（${t.title}）：${t.stat}${t.sources.length ? ' 主要來源：' + t.sources.map(s => `${s.n}（${r0(s.v)}）`).join('、') : ''}`));
  V.pattern.forEach(x => L.push(`- 時間模式：${x}`));
  V.goalCheck.forEach(gl => L.push(`- 上週目標「${gl.text}」：達成 ${gl.ok}/${gl.n} 天`));
  V.notes.forEach(x => L.push(`- 資料缺口：${x}`));
  L.push('');
  if (note.hard || note.keep || note.hardText || note.next) {
    L.push('## 我的心得', '');
    if (note.hard) L.push(`- 辛苦程度：${['很輕鬆','還好','有點辛苦','很辛苦','快撐不住'][note.hard-1]}（${note.hard}/5）`);
    if (note.keep) L.push(`- 做到的事與心得：${note.keep}`);
    if (note.hardText) L.push(`- 最難的地方：${note.hardText}`);
    if (note.next) L.push(`- 下週想試試：${note.next}`);
    L.push('');
  }
  L.push('## 想請你幫忙', '', '請根據以上資料：', '1. 指出這週最值得調整的 1–2 個地方，並說明理由。', '2. 依照我實際吃的品項，給具體可行的替換或調整方式（外食為主）。',
    '3. 參考我的心得，評估目前的目標是否太嚴或太鬆，是否需要調整。', '4. 如果資料有缺口導致無法判斷，請直接說明需要我補什麼。');
  return L.join('\n');
}
export function renderWeekCard(){
  const ws = weekStart(sel), W = weekData(ws), n = W.rows.length;
  $('#weekSum').textContent = `${mmdd(ws)}–${mmdd(addDays(ws,6))} · ${logLine(W, ws === weekStart(TODAY) ? '本週' : '這週')}` + (n ? ` · 平均 ${r0(W.avg(r => r.e.k)).toLocaleString()} kcal` : '');
  const has = ((profile.weekNotes || {})[ws] || {}).t;
  $('#weekBtn').textContent = has ? '看回顧' : '看回顧・寫心得';
}

/* ---------- 綁定按鈕與事件（原本在頂層直接執行；入口在全部模組載入後依序呼叫）---------- */
export function bindReview(){
  $('#weekBtn').onclick = () => openWeek();
}
