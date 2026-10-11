/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 伺服器排程（Firebase Cloud Functions）
   每天台灣時間 00:00：過期的代碼鎖從 codes/ 搬到 archivedCode/{領取日}/codes/
   欄位說明在 dbContent.md；手機端完全不會碰到 archivedCode（firestore.rules）。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

/* 一次同時搬幾組（每組是一批 3 筆寫入）；第一次執行可能有上千組 */
const PARALLEL = 50;
/* gRPC FAILED_PRECONDITION：鎖在查詢之後被改過 */
const FAILED_PRECONDITION = 9;

/* 台灣時間（UTC+8，沒有夏令時間）的日期，YYYYMMDD；和 games/draw-circle/circle.js 的 dayKey 相同 */
function dayKey(ms) {
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
}

/* 封存的位置：領取那天／代碼-領取時間（毫秒），和 staffFeedback 的文件 id 相同，兩邊對得起來 */
function archiveRef(code, claimMs) {
  return db.collection('archivedCode').doc(dayKey(claimMs))
    .collection('codes').doc(code + '-' + claimMs);
}

/* 一組過期的鎖：封存、刪鎖、刪掉沒被醫檢師刪的個人資料，同一批寫入。
   個人資料不封存：它本來就只活到送出回饋或過期為止（TTL 也會刪）。
   刪鎖帶 lastUpdateTime 前提：查詢之後若剛好有新家庭領走這組號碼，整批都不寫，
   新家庭的鎖和個人資料不動，只把舊的這一份補進封存。 */
async function archiveOne(snap) {
  const lock = snap.data();
  const ref = archiveRef(snap.id, lock.createdAt.toMillis());
  const data = { ...lock, archivedAt: FieldValue.serverTimestamp() };
  const batch = db.batch();
  batch.set(ref, data);
  batch.delete(snap.ref, { lastUpdateTime: snap.updateTime });
  batch.delete(snap.ref.collection('private').doc('profile'));
  try {
    await batch.commit();
    return 'moved';
  } catch (err) {
    if (err.code !== FAILED_PRECONDITION) throw err;
    await ref.set(data);
    return 'reclaimed';
  }
}

/* 搬走 now 之前過期的所有代碼，回傳各種結果的數量。失敗的組留在 codes/，下次再搬 */
async function archiveExpiredCodes(now) {
  const expired = await db.collection('codes').where('expiresAt', '<', now).get();
  const counts = { moved: 0, reclaimed: 0, failed: 0 };
  for (let i = 0; i < expired.docs.length; i += PARALLEL) {
    const chunk = expired.docs.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(chunk.map(archiveOne));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        counts[r.value]++;
      } else {
        counts.failed++;
        logger.error('封存失敗', { code: chunk[j].id, error: String(r.reason) });
      }
    });
  }
  return counts;
}

exports.archiveExpiredCodes = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'Asia/Taipei',
  timeoutSeconds: 540,
  retryCount: 3
}, async () => {
  const counts = await archiveExpiredCodes(Timestamp.now());
  logger.info('過期代碼封存完成', counts);
  /* 丟出錯誤 Cloud Scheduler 才會重試；已經搬走的查不到了，重跑只會處理剩下的 */
  if (counts.failed) throw new Error(counts.failed + ' 組代碼封存失敗');
});
