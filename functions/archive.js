/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 過期代碼封存：codes/ → archivedCode/{領取日}/codes/
   排程（index.js，每天 00:00）和手動（archive-now.js）共用這一份。
   欄位說明在 dbContent.md；手機端完全不會碰到 archivedCode（firestore.rules）。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { FieldValue } = require('firebase-admin/firestore');

/* 一次同時搬幾組（每組是一批 3 筆寫入）；第一次執行可能有上千組 */
const PARALLEL = 50;
/* gRPC FAILED_PRECONDITION：鎖在查詢之後被改過 */
const FAILED_PRECONDITION = 9;

/* 台灣時間（UTC+8，沒有夏令時間）的日期，YYYYMMDD；和 games/draw-circle/circle.js 的 dayKey 相同 */
function dayKey(ms) {
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
}

/* 封存的位置：領取那天／代碼-領取時間（毫秒），和 staffFeedback 的文件 id 相同，兩邊對得起來 */
function archiveRef(db, code, claimMs) {
  return db.collection('archivedCode').doc(dayKey(claimMs))
    .collection('codes').doc(code + '-' + claimMs);
}

/* 一組過期的鎖：封存、刪鎖、刪掉個人資料，同一批寫入。
   個人資料不放進 archivedCode：每晚的整理（organize.js）已經先把它複製到 organized/，
   這裡刪的是 codes/ 裡的原始那份。nightly.js 保證整理一定在封存之前。
   刪鎖帶 lastUpdateTime 前提：查詢之後鎖若被改過，整批都不寫，只把舊的這一份補進封存。
   （規則現在只允許新建鎖，過期的鎖不會被新家庭重領；這只是保險。） */
async function archiveOne(db, snap) {
  const lock = snap.data();
  const ref = archiveRef(db, snap.id, lock.createdAt.toMillis());
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

/* now 之前過期的所有鎖 */
async function findExpired(db, now) {
  return (await db.collection('codes').where('expiresAt', '<', now).get()).docs;
}

/* 搬走 now 之前過期的所有代碼。失敗的組留在 codes/，下次再搬。
   回傳 { moved, reclaimed, failed: [{ code, error }] } */
async function archiveExpiredCodes(db, now) {
  const expired = await findExpired(db, now);
  const result = { moved: 0, reclaimed: 0, failed: [] };
  for (let i = 0; i < expired.length; i += PARALLEL) {
    const chunk = expired.slice(i, i + PARALLEL);
    const settled = await Promise.allSettled(chunk.map((snap) => archiveOne(db, snap)));
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') result[r.value]++;
      else result.failed.push({ code: chunk[j].id, error: String(r.reason) });
    });
  }
  return result;
}

module.exports = { dayKey, findExpired, archiveExpiredCodes };
