/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 手動跑每晚的工作（不需要 Blaze 方案）：先整理、再封存過期代碼
   和每天 00:00 的排程做一樣的事（nightly.js），什麼時候跑都可以，但至少每天一次：
   個資只活到封存為止，Console 的 TTL 也會在過期約一天後刪掉它，
   隔太久才跑，有些家屬的個資就只剩醫檢師回饋裡的幾欄。

     node functions/archive-now.js <金鑰.json> --dry-run   只列出會整理、搬走哪些，不寫入
     node functions/archive-now.js <金鑰.json>             真的整理＋搬

   只想重新整理某幾天（不封存），用 organize-now.js。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { Timestamp } = require('firebase-admin/firestore');
const { dayKey } = require('./archive');
const { nightly } = require('./nightly');
const { openDb, organizedLine } = require('./admin-db');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const { db } = openDb(args, 'node functions/archive-now.js <金鑰.json> [--dry-run]');

(async () => {
  const r = await nightly(db, Timestamp.now(), { dryRun });
  r.organized.forEach((o) => console.log(organizedLine(o)));

  if (dryRun) {
    const byDay = {};
    r.expired.forEach((s) => {
      const d = dayKey(s.get('createdAt').toMillis());
      byDay[d] = (byDay[d] || 0) + 1;
    });
    Object.keys(byDay).sort().forEach((d) => console.log('  archivedCode/' + d + '：' + byDay[d] + ' 組'));
    console.log('共 ' + r.expired.length + ' 組過期（--dry-run：沒有寫入）');
    return;
  }

  const a = r.archived;
  a.failed.forEach((f) => console.error('  失敗 ' + f.code + '：' + f.error));
  console.log('搬走 ' + a.moved + ' 組' + (a.reclaimed ? '，' + a.reclaimed + ' 組剛好被新家庭領走（只封存舊的）' : '')
    + (a.failed.length ? '，' + a.failed.length + ' 組失敗（留在 codes/，再跑一次即可）' : ''));
  if (a.failed.length) process.exitCode = 1;
})().catch((err) => {
  console.error(err);
  console.error('沒有封存任何代碼（整理沒完成就不封存，個資還在）。');
  process.exitCode = 1;
});
