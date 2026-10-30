/* 每日食帳 · core.js — 共用：工具函式、共用資料（profile／days／items／sel）、儲存與同步、Google 授權、底部面板與提示、備份 */

export const $ = s => document.querySelector(s);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const r0 = n => Math.round(n), r1 = n => Math.round(n*10)/10;
export const ymd = d => { const z = n => String(n).padStart(2,'0'); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); };
export const parseYmd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate()+n); return ymd(d); };
export const TODAY = ymd(new Date());
export const N0 = x => (typeof x === 'number' && isFinite(x)) ? x : 0;
export const MEALS = [['b','早餐'],['l','午餐'],['d','晚餐'],['s','點心']];

/* ---------- storage：本機快取 + 各自的 Google 雲端（App 專用隱藏資料夾）---------- */
// Google Cloud「用戶端 ID」，不是密鑰，可以公開
export const CLIENT_ID = '955060224473-vjj3ut7ku0u02k39fbsg7kc138htk9sn.apps.googleusercontent.com';
export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const FILE_NAME = 'shizhang-data.json';
export let profile = null; export const days = {};
export let items = []; // 物品清單：每件各自有 id 和 _t，刪除時留 del 標記，兩台裝置才合併得起來
export let budgets = []; // 預算（5.2-J）：每筆 {id, cat, amount, from, essential, fixed, _t, del}，合併方式同物品
export const LS = 'shizhang.v1', LS_TOK = 'shizhang.tok', LS_META = 'shizhang.meta';
export function lsGet(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
export function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
export function lsSave(){ lsSet(LS, {profile, days, items, budgets}); }
export let meta = lsGet(LS_META) || {linked:false, fileId:null, dirty:false};
export function saveMeta(){ lsSet(LS_META, meta); }
export const now = () => Date.now();
export function setState(t){ $('#saveState').textContent = t; }
export function saveProfile(){ if (profile) profile._t = now(); lsSave(); markDirty(); }
export function saveDay(date){ if (days[date]) days[date]._t = now(); lsSave(); markDirty(); }
export function saveItem(it){ it._t = now(); const i = items.findIndex(x => x.id === it.id); if (i >= 0) items[i] = it; else items.push(it); lsSave(); markDirty(); }
// 每件物品（每筆預算）各自比時間，新的贏
function mergeList(arr, list){
  let changed = false;
  (Array.isArray(list) ? list : []).forEach(it => {
    if (!it || typeof it.id !== 'string') return;
    const i = arr.findIndex(x => x.id === it.id);
    if (i < 0) { arr.push(it); changed = true; }
    else if (N0(it._t) > N0(arr[i]._t)) { arr[i] = it; changed = true; }
  });
  return changed;
}
export const mergeItems = list => mergeList(items, list);
export const mergeBudgets = list => mergeList(budgets, list);
export function saveBudget(b){ b._t = now(); const i = budgets.findIndex(x => x.id === b.id); if (i >= 0) budgets[i] = b; else budgets.push(b); lsSave(); markDirty(); }
// 某分類某月的有效預算：from ≤ 該月中最新的一筆；amount 0 代表從那個月起不設預算 → 回傳 null
export function effBudget(cat, ym){
  let best = null;
  budgets.forEach(b => { if (b && !b.del && b.cat === cat && b.from <= ym && (!best || b.from > best.from || (b.from === best.from && N0(b._t) > N0(best._t)))) best = b; });
  return best && best.amount > 0 ? best : null;
}
export let syncTimer = null;
export function markDirty(){ meta.dirty = true; saveMeta(); updateSyncUI(); clearTimeout(syncTimer); syncTimer = setTimeout(sync, 2000); }

/* Google 授權：整頁跳轉（iPhone 加到主畫面後，彈出視窗常常回不來，所以不用 popup） */
export const configured = () => !CLIENT_ID.startsWith('PASTE');
export function getToken(){ const t = lsGet(LS_TOK); return t && t.exp > now() + 60000 ? t.v : null; }
export function startAuth(silent){
  if (!configured()) { toast('還沒設定 Google 用戶端 ID，雲端同步暫時不能用，紀錄會先存在這支手機。'); return; }
  const st = Math.random().toString(36).slice(2) + now().toString(36);
  try { sessionStorage.setItem('shizhang.state', st); sessionStorage.setItem('shizhang.silent', silent ? '1' : ''); } catch {}
  const p = {client_id:CLIENT_ID, redirect_uri:location.origin + location.pathname, response_type:'token',
    scope:SCOPE, include_granted_scopes:'true', state:st};
  if (silent) p.prompt = 'none';
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(p));
}
export function readAuthReturn(){
  if (!location.hash || location.hash.length < 2) return null;
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.get('access_token') && !h.get('error')) return null;
  history.replaceState(null, '', location.pathname + location.search);
  let st = null; try { st = sessionStorage.getItem('shizhang.state'); sessionStorage.removeItem('shizhang.state'); } catch {}
  if (!st || h.get('state') !== st) return {error:'state'};
  if (h.get('error')) return {error:h.get('error')};
  lsSet(LS_TOK, {v:h.get('access_token'), exp: now() + (+h.get('expires_in') || 3600) * 1000});
  return {ok:true};
}

/* Google Drive：整份資料存成一個 JSON，放在 appDataFolder（使用者看不到、別的 App 也讀不到） */
export async function gfetch(url, opt = {}){
  const tok = getToken(); if (!tok) throw {code:'auth'};
  const r = await fetch(url, {...opt, headers:{...(opt.headers || {}), Authorization:'Bearer ' + tok}});
  if (r.status === 401) { try { localStorage.removeItem(LS_TOK); } catch {} throw {code:'auth'}; }
  if (!r.ok) throw {code:'http', status:r.status};
  return r;
}
export async function findFile(){
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await gfetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=10`);
  const j = await r.json(); return j.files && j.files[0] ? j.files[0].id : null;
}
export async function download(id){ return (await gfetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json(); }
export async function upload(id, body){
  const data = JSON.stringify(body);
  if (id) {
    await gfetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:data});
    return id;
  }
  const bd = 'shizhang' + now();
  const mp = `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:FILE_NAME, parents:['appDataFolder']})}\r\n--${bd}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${bd}--`;
  const r = await gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {method:'POST', headers:{'Content-Type':'multipart/related; boundary=' + bd}, body:mp});
  return (await r.json()).id;
}
// 兩台裝置都改過時：每一天各自比時間，新的贏；「吃過的」清單取聯集
export function merge(remote){
  let changed = false;
  if (remote && remote.profile) {
    const rp = remote.profile;
    if (!profile || N0(rp._t) > N0(profile._t)) {
      const mine = (profile && profile.history) || [];
      profile = {...rp}; changed = true;
      const hist = [...(rp.history || [])];
      mine.forEach(h => { if (h && h.n && !hist.some(x => x.n === h.n)) hist.push(h); });
      profile.history = hist.slice(0, 300);
    }
  }
  const rd = (remote && remote.days) || {};
  for (const k of Object.keys(rd)) {
    if (!days[k] || N0(rd[k]._t) > N0(days[k]._t)) { days[k] = rd[k]; changed = true; }
  }
  if (remote && mergeItems(remote.items)) changed = true;
  if (remote && mergeBudgets(remote.budgets)) changed = true;
  return changed;
}
export let syncing = false, syncAgain = false;
export async function sync(){
  if (!meta.linked || !getToken()) { updateSyncUI(); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; setState('同步中…');
  try {
    if (!meta.fileId) meta.fileId = await findFile();
    let remote = null;
    if (meta.fileId) {
      try { remote = await download(meta.fileId); }
      catch (e) { if (e && e.status === 404) meta.fileId = await findFile(); else throw e;
        if (meta.fileId) remote = await download(meta.fileId); }
    }
    const changed = merge(remote);
    lsSave();
    meta.fileId = await upload(meta.fileId, {app:'每日食帳', version:2, profile, days, items, budgets});
    meta.dirty = false; meta.lastSync = now(); saveMeta();
    if (changed) { ui.render(); if (profile) closeWelcome(); }
  } catch (e) {
    console.warn(e);
    if (!(e && e.code === 'auth')) toast('同步失敗，紀錄已存在這支手機，等一下會再試。');
  }
  syncing = false; updateSyncUI();
  if (syncAgain) { syncAgain = false; sync(); }
}
export function updateSyncUI(){
  const b = $('#syncBtn');
  if (!meta.linked) { setState('只存在這支手機'); b.textContent = '連結 Google 雲端'; b.hidden = !configured(); return; }
  if (!getToken()) { setState(meta.dirty ? '有變更還沒同步' : '已存在這支手機'); b.textContent = '重新連線 Google'; b.hidden = false; return; }
  b.hidden = true;
  if (!syncing) setState(meta.dirty ? '等待同步…' : '已同步到 Google 雲端');
}

export let welcomeOpen = false;
export function closeWelcome(){ if (welcomeOpen) { welcomeOpen = false; closeSheet(); } }
export function openWelcome(){
  welcomeOpen = true;
  openSheet(`
    <h2>歡迎使用每日食帳</h2>
    <div class="note">用 Google 帳號登入，紀錄會存在<b>你自己的</b> Google 雲端裡一個 App 專用的隱藏資料夾。這個 App 看不到你雲端的其他檔案，別人也看不到你的紀錄。換手機登入同一個帳號，資料就回來了。</div>
    <button class="btn primary block" id="wGoogle">用 Google 帳號登入</button>
    <button class="btn block" id="wLocal">先不登入，只存在這支手機</button>
    <button class="btn ghost block" id="wImport">我有備份檔，從備份匯入</button>
    <div class="note">從 LINE、FB 打開連結的話，Google 會擋登入，請改用 Safari 或 Chrome 打開。</div>
  `, () => {
    $('#wGoogle').onclick = () => startAuth(false);
    $('#wLocal').onclick = () => { welcomeOpen = false; closeSheet(); ui.openSettings(true); };
    $('#wImport').onclick = () => { welcomeOpen = false; closeSheet(); $('#bkFile').value = ''; $('#bkFile').click(); };
    if (!configured()) { $('#wGoogle').disabled = true; $('#wGoogle').textContent = 'Google 登入設定中，暫時不能用'; }
  });
}

export async function init(){
  const o = lsGet(LS) || {}; profile = o.profile || null; Object.assign(days, o.days || {});
  items = Array.isArray(o.items) ? o.items : [];
  budgets = Array.isArray(o.budgets) ? o.budgets : [];
  const ret = readAuthReturn();
  let silentWas = false; try { silentWas = sessionStorage.getItem('shizhang.silent') === '1'; sessionStorage.removeItem('shizhang.silent'); } catch {}
  if (ret && ret.ok) { meta.linked = true; saveMeta(); }
  else if (ret && ret.error === 'access_denied') toast('你取消了 Google 授權，紀錄先存在這支手機。');
  else if (ret && ret.error && !silentWas) toast('Google 連線沒有成功，請再按一次「連結 Google 雲端」。');
  ui.render(); updateSyncUI();
  if (meta.linked && !getToken() && !ret) { startAuth(true); return; } // 授權過期：悄悄跳一下 Google 再回來
  if (meta.linked && getToken()) await sync();
  if (!profile) { if (meta.linked) ui.openSettings(true); else openWelcome(); }
}

/* ---------- math ---------- */
export let sel = TODAY;
export function dayOf(date){ return days[date] || (days[date] = {food:[], water:0, ex:[], weight:null}); }
// 記錄日：早午晚至少記到兩餐；只有 0–1 餐的日子，使用者按「這天就吃這些」（full）才算（5.1）
export function mainsOf(d){ return ['b','l','d'].filter(m => d.food.some(f => f.meal === m)).length; }
export function isLogged(date){ const d = days[date]; return !!(d && d.food.length && (mainsOf(d) >= 2 || d.full)); }
export function hasData(date){ const d = days[date]; return d && (d.food.length || d.water || d.ex.length || d.weight); }

/* ---------- sheets ---------- */
export function openSheet(html, onMount){
  const host = $('#sheetHost');
  host.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim' && profile) closeSheet(); });
  onMount && onMount(host);
}
export function closeSheet(){ $('#sheetHost').innerHTML = ''; }

/* ---------- 阿鹽評語 ---------- */
export const pickOne = a => a[Math.floor(Math.random()*a.length)];
export const n0na = x => r0(x).toLocaleString();
export const who = () => (profile && profile.nick) || '搭檔';
export let toastTimer = null;
export function toast(msg){
  if (!msg) return;
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role','status'); document.body.appendChild(el); }
  el.innerHTML = '<b>阿鹽說</b>' + esc(msg);
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const newId = () => Math.random().toString(36).slice(2, 9);
export const hm = t => { const d = new Date(t), z = n => String(n).padStart(2,'0'); return z(d.getHours()) + ':' + z(d.getMinutes()); };
export const dur = ms => { const m = Math.ceil(ms/60000), h = Math.floor(m/60); return h ? `${h} 小時${m%60 ? ` ${m%60} 分` : ''}` : `${m} 分`; };

/* ---------- 本週回顧＋每週心得 ---------- */
export const weekStart = k => { const d = parseYmd(k); return addDays(k, -((d.getDay() + 6) % 7)); };
export const mmdd = k => k.slice(5).replace('-', '/');

/* ---------- 花費：物品清單、30 天回顧、每日成本、回購週期 ---------- */
export const ITEM_TYPES = [['big','大件'],['cons','消耗品'],['gen','一般']];
export const ITEM_CATS = ['衣','住','行','育','樂','3C','保養美妝','居家民生','寵物','其他'];
// 統一支出分類（5.2-J）：飲食、物品、收支規則、預算共用。現行物品分類與其中十個同名，舊資料不必轉換；飲食金額一律歸「食」
export const SPEND_CATS = ['食','住','水電電信','行','衣','育','樂','3C','保養美妝','居家民生','寵物','保險','訂閱','孝親','分期','利息','其他'];
export const SPEND_ORDER = c => { const i = SPEND_CATS.indexOf(c); return i < 0 ? 99 : i; };
export const REVIEWS = [['good','值得'],['meh','普通'],['regret','後悔']];
export const typeName = t => (ITEM_TYPES.find(x => x[0] === t) || ITEM_TYPES[2])[1];
export const reviewName = v => (REVIEWS.find(x => x[0] === v) || ['',''])[1];
export const money = n => 'NT$' + r0(n).toLocaleString();
export const moneyShort = n => n >= 10000 ? r1(n/10000) + ' 萬' : r0(n).toLocaleString();
export const daysBetween = (a, b) => r0((parseYmd(b) - parseYmd(a)) / 864e5);
export const liveItems = () => items.filter(x => x && !x.del);
export const addMonths = (ym, n) => { const [y,m] = ym.split('-').map(Number); const d = new Date(y, m-1+n, 1); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); };
export const useLabel = d => d < 60 ? d + ' 天' : d < 365 ? r0(d/30) + ' 個月' : r1(d/365) + ' 年';
export const fullDate = k => k.slice(0,4) === TODAY.slice(0,4) ? mmdd(k) : k.replace(/-/g, '/');

// 匯入的物品只留認得的欄位
export function cleanItem(x){
  if (!x || typeof x.id !== 'string' || typeof x.name !== 'string') return null;
  const out = {id:x.id.slice(0,20), name:x.name.slice(0,60), price:Math.max(0, r0(N0(x.price))),
    date:/^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : TODAY,
    type:['big','cons','gen'].includes(x.type) ? x.type : 'gen', cat:ITEM_CATS.includes(x.cat) ? x.cat : '其他', _t:N0(x._t)};
  if (out.type === 'big') out.years = Math.min(30, Math.max(1, r0(N0(x.years)) || 3));
  if (out.type === 'cons') { // 包數（v1.8，選填）：數量為 1–9999 的整數，單位最多 6 字；不合理的值丟掉，視為 1
    if (Number.isInteger(x.qty) && x.qty >= 1 && x.qty <= 9999) out.qty = x.qty;
    if (typeof x.unit === 'string' && x.unit.trim()) out.unit = x.unit.trim().slice(0,6);
  }
  if (x.ask) out.ask = true;
  if (x.review && REVIEWS.some(([k]) => k === x.review.v))
    out.review = {v:x.review.v, note:String(x.review.note || '').slice(0,200), at:/^\d{4}-\d{2}-\d{2}$/.test(x.review.at) ? x.review.at : TODAY};
  if (x.del) out.del = true;
  return out;
}

// 匯入的預算只留合理值：分類須是統一支出分類（含之後才開放的，避免這版把未來的資料丟掉）、金額 0–9,999,999 整數、from 為 YYYY-MM
export function cleanBudget(x){
  if (!x || typeof x.id !== 'string' || !x.id || !SPEND_CATS.includes(x.cat)) return null;
  if (!(Number.isInteger(x.amount) && x.amount >= 0 && x.amount <= 9999999)) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.from)) return null;
  const out = {id:x.id.slice(0,40), cat:x.cat, amount:x.amount, from:x.from, _t:N0(x._t)};
  if (x.essential) out.essential = true;
  if (x.fixed) out.fixed = true;
  if (x.del) out.del = true;
  return out;
}

/* ---------- 備份 ---------- */
export const stamp = () => TODAY.replace(/-/g,'');
export function bkMsg(t, warn){ $('#bkNote').className = warn ? 'note warn' : 'note'; $('#bkNote').textContent = t; }
// iPhone 用分享選單（可以直接存到 Google 雲端硬碟），其他裝置直接下載
export async function saveFile(filename, data, type){
  const blob = new Blob([data], {type});
  try {
    const file = new File([blob], filename, {type});
    if (navigator.canShare && navigator.canShare({files:[file]})) {
      await navigator.share({files:[file], title:filename});
      bkMsg(`已匯出 ${filename}。`); return;
    }
  } catch (e) { if (e && e.name === 'AbortError') { bkMsg('已取消匯出。'); return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  bkMsg(`已下載 ${filename}。`);
}
// 匯入：檔案裡有的日期會覆蓋，沒有的日期保留
export let pendingImport = null;
// 匯入時保留飲水連結碼與鎖定分數（P4）：wid 連結飲料和飲水；grade 含版本 v，舊制分數不能被重算蓋掉
const okId = x => typeof x === 'string' && /^[\w-]{1,20}$/.test(x);
const okGrade = x => !!x && typeof x === 'object' && /^[A-F]$/.test(x.g) && typeof x.score === 'number' && x.score >= 0 && x.score <= 100 && typeof x.v === 'number';
export function applyImport({o, ks}){
  ks.forEach(k => { const d = o.days[k];
    days[k] = {food: d.food.filter(f => f && typeof f.name === 'string').map(f => ({name:f.name.slice(0,120), k:N0(f.k), p:N0(f.p), c:N0(f.c), f:N0(f.f), s:N0(f.s), fb:N0(f.fb), na:N0(f.na), meal:['b','l','d','s'].includes(f.meal)?f.meal:'s', ...(N0(f.cost)>0?{cost:r0(N0(f.cost))}:{}), ...(f.snack?{snack:true}:{}), ...(okId(f.wid)?{wid:f.wid}:{})})),
      water:N0(d.water), waterLog:Array.isArray(d.waterLog)?d.waterLog.filter(x=>x&&N0(x.ml)>0).map(x=>({ml:N0(x.ml), t:N0(x.t), ...(x.old?{old:true}:{}), ...(typeof x.from==='string'?{from:x.from.slice(0,120)}:{}), ...(okId(x.wid)?{wid:x.wid}:{})})):undefined, ex:Array.isArray(d.ex)?d.ex.filter(x=>x&&typeof x.name==='string').map(x=>({name:x.name, met:N0(x.met), min:N0(x.min)})):[], weight:N0(d.weight)||null,
      supps:Array.isArray(d.supps)?d.supps.filter(x=>x&&x.id&&typeof x.name==='string'):undefined, meds:Array.isArray(d.meds)?d.meds.filter(x=>x&&x.id&&typeof x.name==='string'):undefined, ...(d.full?{full:true}:{}), ...(okGrade(d.grade)?{grade:{v:N0(d.grade.v), g:d.grade.g, score:r0(d.grade.score)}}:{})};
    saveDay(k); });
  if (Array.isArray(o.items)) { mergeItems(o.items.map(cleanItem).filter(Boolean)); lsSave(); markDirty(); }
  if (Array.isArray(o.budgets)) { mergeBudgets(o.budgets.map(cleanBudget).filter(Boolean)); lsSave(); markDirty(); }
  if (o.profile && typeof o.profile === 'object') {
    const keep = profile || {};
    profile = {...o.profile, nick: keep.nick || o.profile.nick || ''};
    const merged = [...(keep.history||[])];
    (o.profile.history||[]).forEach(h => { if (h && h.n && !merged.some(m => m.n === h.n)) merged.push(h); });
    profile.history = merged.slice(0,300);
    saveProfile();
  }
  $('#bkImportBtn').textContent = '匯入備份';
  bkMsg(`已匯入 ${ks.length} 天紀錄。`);
  ui.render();
  if (!profile) ui.openSettings(true);
}

/* ---------- 模組化（D11）新增 ----------
   ES 模組匯入的變數是唯讀的，跨模組要換掉整個 profile 或選取日時，改呼叫這兩個函式。
   core 是最底層，不 import 上層模組；需要重畫畫面時呼叫 ui.render()，由 index.html 入口把函式掛上來。 */
export function setProfile(v){ profile = v; }
export function setSel(v){ sel = v; }
export const ui = {};

/* ---------- 綁定按鈕與事件（原本在頂層直接執行；入口在全部模組載入後依序呼叫）---------- */
export function bindCore(){
  $('#syncBtn').onclick = () => startAuth(false);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && meta.linked && getToken()) sync(); });
  $('#bkJson').onclick = () => {
    if (!profile) return;
    const out = {app:'每日食帳', version:1, exportedAt:new Date().toISOString(), profile, days:{}};
    Object.keys(days).sort().forEach(k => { if (hasData(k)) out.days[k] = days[k]; });
    out.items = items;
    out.budgets = budgets;
    saveFile(`每日食帳備份-${stamp()}.json`, JSON.stringify(out, null, 1), 'application/json');
  };
  $('#bkItemsCsv').onclick = () => {
    const q = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g,'""') + '"' : t; };
    const live = liveItems().sort((a,b) => a.date.localeCompare(b.date));
    if (!live.length) { bkMsg('還沒有物品可以匯出。', true); return; }
    // 數量、單位加在最後，原本欄位順序不變
    const rows = [['購買日期','品名','價格 元','類型','分類','預計年限','回顧','回顧備註','數量','單位']].concat(
      live.map(x => [x.date, x.name, x.price, typeName(x.type), x.cat, x.years || '', x.review ? reviewName(x.review.v) : '', x.review ? x.review.note : '', x.qty || '', x.unit || '']));
    saveFile(`物品清單-${stamp()}.csv`, '\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
  };
  $('#bkImportBtn').onclick = () => {
    if (pendingImport) { applyImport(pendingImport); pendingImport = null; return; }
    $('#bkFile').value = ''; $('#bkFile').click();
  };
  $('#bkFile').onchange = () => {
    const file = $('#bkFile').files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || o.app !== '每日食帳' || typeof o.days !== 'object') throw 0;
        const ks = Object.keys(o.days).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && o.days[k] && Array.isArray(o.days[k].food));
        const clash = ks.filter(k => hasData(k)).length;
        const nItems = Array.isArray(o.items) ? o.items.filter(x => x && !x.del).length : 0;
        // 全新裝置、還沒有任何資料：不必再確認，直接匯入
        if (!profile && !Object.keys(days).some(hasData)) { pendingImport = null; applyImport({o, ks}); return; }
        pendingImport = {o, ks};
        $('#bkImportBtn').textContent = `確認匯入 ${ks.length} 天`;
        $('#backupCard').scrollIntoView({behavior:'smooth', block:'center'});
        bkMsg(`檔案有 ${ks.length} 天紀錄${nItems ? `、${nItems} 件物品` : ''}${clash ? `，其中 ${clash} 天和現有紀錄重疊，會以檔案為準` : ''}。再按一次「確認匯入」才會寫入。`, !!clash);
      } catch { pendingImport = null; bkMsg('這不是每日食帳的備份檔，請選「匯出備份」產生的 .json 檔。', true); }
    };
    rd.readAsText(file);
  };
}
