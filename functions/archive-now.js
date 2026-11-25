/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 手動跑每晚的工作（不需要 Blaze 方案）：先整理、再封存過期代碼
   和每天 00:00 的排程做一樣的事（nightly.js）。請每天跑一次，organized/ 才會是最新的。
   漏跑幾天也不會丟資料：號碼要等整理、封存之後才會再發出去，在那之前過期的鎖只是佔著號碼。
   （資料庫沒有 TTL 政策，除了封存之外沒有別的東西會刪個資。）

     node functions/archive-now.js <金鑰.json> --dry-run   只列出會整理、搬走哪些，不寫入
     node functions/archive-now.js <金鑰.json>             真的整理＋搬：昨天以前、已經過期的

     node functions/archive-now.js <金鑰.json> --all --dry-run
     node functions/archive-now.js <金鑰.json> --all       今天也算：整理到今天，codes/ 全部搬走

   --all：整理昨天＋今天＋每一組代碼的領取日，再把 codes/ 裡每一組都封存，
   包括今天領的、還沒過期的。封存之後醫檢師端查不到那組號碼（查無），
   號碼也可以再發給別的家庭：等今天最後一個家庭離開再跑。
   之後才進來的遊戲紀錄、回饋不會丟：明天照常跑（不加 --all）會再整理今天一次。

   只想重新整理某幾天（不封存），用 organize-now.js。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { Timestamp } = require('firebase-admin/firestore');
const { dayKey } = require('./archive');
const { nightly } = require('./nightly');
const { openDb, organizedLine } = require('./admin-db');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const { db } = openDb(args, 'node functions/archive-now.js <金鑰.json> [--all] [--dry-run]');

(async () => {
  const now = Timestamp.now();
  const r = await nightly(db, now, { dryRun, all });
  r.organized.forEach((o) => console.log(organizedLine(o)));

  const live = r.locks.filter((s) => s.get('expiresAt').toMillis() >= now.toMillis()).length;
  const what = all ? (live ? '（其中 ' + live + ' 組還沒過期）' : '') : '過期';

  if (dryRun) {
    const byDay = {};
    r.locks.forEach((s) => {
      const d = dayKey(s.get('createdAt').toMillis());
      byDay[d] = (byDay[d] || 0) + 1;
    });
    Object.keys(byDay).sort().forEach((d) => console.log('  archivedCode/' + d + '：' + byDay[d] + ' 組'));
  }
  console.log('共 ' + r.locks.length + ' 組' + what + (dryRun ? '（--dry-run：沒有寫入）' : ''));
  if (dryRun) return;

  const a = r.archived;
  a.failed.forEach((f) => console.error('  失敗 ' + f.code + '：' + f.error));
  console.log('搬走 ' + a.moved + ' 組'
    + (a.reclaimed ? '，' + a.reclaimed + ' 組在整理途中被改過（例如醫檢師剛按完成），只先封存舊的一份，鎖留在 codes/' : '')
    + (a.failed.length ? '，' + a.failed.length + ' 組失敗（留在 codes/）' : '')
    + (a.reclaimed || a.failed.length ? '：再跑一次即可' : ''));
  if (a.failed.length) process.exitCode = 1;
})().catch((err) => {
  console.error(err);
  console.error('沒有封存任何代碼（整理沒完成就不封存，個資還在）。');
  process.exitCode = 1;
});
