/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 每晚的工作：先整理（organize.js），再封存過期代碼（archive.js）
   排程（index.js，每天 00:00）和手動（archive-now.js）共用這一份。

   順序不能反：封存會刪掉 codes/{code}/private/profile，那是個資唯一的完整來源。
   所以要整理的日子 = 昨天 ＋ 這次要封存的每一組代碼的領取日（重整一次，補上
   半夜才完成的醫檢師回饋、跨過午夜的遊戲時間）。任何一天整理失敗，就整個不封存，
   個資留著等下次。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { dayKey, findExpired, archiveExpiredCodes } = require('./archive');
const { previousDay, organizeDay } = require('./organize');

async function daysToOrganize(db, now) {
  const expired = await findExpired(db, now);
  const days = new Set([previousDay(now.toMillis())]);
  expired.forEach((s) => days.add(dayKey(s.get('createdAt').toMillis())));
  return { days: [...days].sort(), expired };
}

/* 回傳 { organized: [每天的摘要], expired: 過期的鎖, archived: archiveExpiredCodes 的結果 | null } */
async function nightly(db, now, { dryRun = false } = {}) {
  const { days, expired } = await daysToOrganize(db, now);
  const organized = [];
  for (const day of days) organized.push(await organizeDay(db, day, { dryRun }));
  const archived = dryRun ? null : await archiveExpiredCodes(db, now);
  return { organized, expired, archived };
}

module.exports = { daysToOrganize, nightly };
