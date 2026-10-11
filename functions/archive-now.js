/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 手動封存過期代碼（不需要 Blaze 方案）
   和每天 00:00 的排程做一樣的事（archive.js），什麼時候跑、隔幾天跑都可以：
   封存資料夾是「領取日」，不是執行日。

     node functions/archive-now.js <金鑰.json> --dry-run   只列出會搬哪些，不寫入
     node functions/archive-now.js <金鑰.json>             真的搬

   金鑰：Firebase Console → 專案設定 → 服務帳戶 → 產生新的私密金鑰。
   它有整個資料庫的管理權限：放在 repo 外面，不要 commit、不要傳給別人。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { dayKey, findExpired, archiveExpiredCodes } = require('./archive');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keyPath = args.find((a) => !a.startsWith('--'));

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!keyPath && !emulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('用法：node functions/archive-now.js <金鑰.json> [--dry-run]');
  process.exit(2);
}

/* 有金鑰用金鑰（專案由金鑰決定）；沒有就用 GOOGLE_APPLICATION_CREDENTIALS 或模擬器 */
const key = keyPath ? require(path.resolve(keyPath)) : null;
const projectId = key ? key.project_id : process.env.GCLOUD_PROJECT || 'dftt-48e02';
const db = getFirestore(initializeApp(key ? { credential: cert(key), projectId } : { projectId }));

(async () => {
  const now = Timestamp.now();
  console.log('專案：' + projectId + (emulator ? '（模擬器 ' + emulator + '）' : ''));

  if (dryRun) {
    const expired = await findExpired(db, now);
    const byDay = {};
    expired.forEach((s) => {
      const d = dayKey(s.get('createdAt').toMillis());
      byDay[d] = (byDay[d] || 0) + 1;
    });
    Object.keys(byDay).sort().forEach((d) => console.log('  archivedCode/' + d + '：' + byDay[d] + ' 組'));
    console.log('共 ' + expired.length + ' 組過期（--dry-run：沒有寫入）');
    return;
  }

  const r = await archiveExpiredCodes(db, now);
  r.failed.forEach((f) => console.error('  失敗 ' + f.code + '：' + f.error));
  console.log('搬走 ' + r.moved + ' 組' + (r.reclaimed ? '，' + r.reclaimed + ' 組剛好被新家庭領走（只封存舊的）' : '')
    + (r.failed.length ? '，' + r.failed.length + ' 組失敗（留在 codes/，再跑一次即可）' : ''));
  if (r.failed.length) process.exitCode = 1;
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
