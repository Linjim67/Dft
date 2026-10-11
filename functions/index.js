/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 伺服器排程（Firebase Cloud Functions，要 Blaze 方案）
   每天台灣時間 00:00 封存過期代碼；做法在 archive.js。
   沒有 Blaze 方案時，改用 archive-now.js 手動跑，結果一樣。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { archiveExpiredCodes } = require('./archive');

initializeApp();
const db = getFirestore();

exports.archiveExpiredCodes = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'Asia/Taipei',
  timeoutSeconds: 540,
  retryCount: 3
}, async () => {
  const r = await archiveExpiredCodes(db, Timestamp.now());
  r.failed.forEach((f) => logger.error('封存失敗', f));
  logger.info('過期代碼封存完成', { moved: r.moved, reclaimed: r.reclaimed, failed: r.failed.length });
  /* 丟出錯誤 Cloud Scheduler 才會重試；已經搬走的查不到了，重跑只會處理剩下的 */
  if (r.failed.length) throw new Error(r.failed.length + ' 組代碼封存失敗');
});
