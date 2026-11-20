/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 伺服器排程（Firebase Cloud Functions，要 Blaze 方案）
   每天台灣時間 00:00：先整理昨天的資料（organize.js），再封存過期代碼（archive.js）；
   順序和原因在 nightly.js。
   沒有 Blaze 方案時，改用 archive-now.js 手動跑，結果一樣。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { nightly } = require('./nightly');

initializeApp();
const db = getFirestore();

exports.nightly = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'Asia/Taipei',
  timeoutSeconds: 540,
  retryCount: 3
}, async () => {
  /* 整理失敗會直接丟錯誤（不封存），Cloud Scheduler 會重試；整理可以重跑 */
  const r = await nightly(db, Timestamp.now());
  r.organized.forEach((o) => logger.info('整理完成', o));
  const a = r.archived;
  a.failed.forEach((f) => logger.error('封存失敗', f));
  logger.info('過期代碼封存完成', { moved: a.moved, reclaimed: a.reclaimed, failed: a.failed.length });
  /* 丟出錯誤 Cloud Scheduler 才會重試；已經搬走的查不到了，重跑只會處理剩下的 */
  if (a.failed.length) throw new Error(a.failed.length + ' 組代碼封存失敗');
});
