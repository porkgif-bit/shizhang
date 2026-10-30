// 更新 index.html 裡的版本號：importmap 每個模組、style.css 的網址都帶 ?v=內容雜湊前 10 碼。
// 只有內容改過的檔案會換號，瀏覽器才會重新下載它；沒改的繼續用快取。
// npm test 會先跑這支；有改動會印出提醒，記得把 index.html 一起 commit。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.env.APP_DIR || fileURLToPath(new URL('..', import.meta.url)));
export const hashOf = file => createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex').slice(0, 10);
// 抓出 index.html 裡所有「檔名?v=雜湊」的引用（importmap 的值與 style.css 連結）
export const REF = /(["'])\.?\/?([\w-]+\.(?:js|css))\?v=([0-9a-f]*)\1/g;

export function stamp(html) {
  return html.replace(REF, (all, q, file) => existsSync(join(ROOT, file)) ? `${q}${all.slice(1, -1).replace(/\?v=[0-9a-f]*$/, '?v=' + hashOf(file))}${q}` : all);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const p = join(ROOT, 'index.html'), html = readFileSync(p, 'utf8');
  if (!html.includes('type="importmap"')) { console.log('stamp：index.html 沒有 importmap（單檔版本），略過。'); process.exit(0); }
  const out = stamp(html);
  if (out !== html) { writeFileSync(p, out); console.log('stamp：已更新 index.html 的版本號，請把 index.html 一起 commit。'); }
  else console.log('stamp：版本號都是最新的。');
}
