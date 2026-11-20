/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 手動腳本共用：用服務帳戶金鑰（或模擬器）連上 Firestore
   金鑰：Firebase Console → 專案設定 → 服務帳戶 → 產生新的私密金鑰。
   它有整個資料庫的管理權限：放在 repo 外面，不要 commit、不要傳給別人。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

/* args 裡第一個不是 -- 開頭的就是金鑰路徑。回傳 { db, projectId, emulator } */
function openDb(args, usage) {
  const keyPath = args.find((a) => !a.startsWith('--') && /\.json$/i.test(a));
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (!keyPath && !emulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('用法：' + usage);
    process.exit(2);
  }
  /* 有金鑰用金鑰（專案由金鑰決定）；沒有就用 GOOGLE_APPLICATION_CREDENTIALS 或模擬器 */
  const key = keyPath ? require(path.resolve(keyPath)) : null;
  const projectId = key ? key.project_id : process.env.GCLOUD_PROJECT || 'dftt-48e02';
  const db = getFirestore(initializeApp(key ? { credential: cert(key), projectId } : { projectId }));
  console.log('專案：' + projectId + (emulator ? '（模擬器 ' + emulator + '）' : ''));
  return { db, projectId, emulator };
}

/* 一天的整理摘要，一行 */
function organizedLine(r) {
  const p = r.profiles;
  const parts = [p.profile + ' 份完整'];
  if (p.kept) parts.push(p.kept + ' 份沿用之前整理的');
  if (p.staffFeedback) parts.push(p.staffFeedback + ' 份只剩醫檢師回饋裡的幾欄');
  if (p.none) parts.push(p.none + ' 份找不到');
  return '  整理/' + r.day + '：' + r.families + ' 位家屬、' + r.claims + ' 次領號（個資 ' + parts.join('、')
    + '）、醫檢師完成 ' + r.staffDone + '、回饋 ' + r.feedbacks
    + (r.feedbackUnplaced ? '（另有 ' + r.feedbackUnplaced + ' 份沒有 uid，放不進家屬）' : '')
    + '、遊戲紀錄 ' + r.playRows + ' 段，' + r.writes + ' 筆寫入';
}

module.exports = { openDb, organizedLine };
