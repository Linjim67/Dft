/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 每晚的工作：先整理（organize.js），再封存過期代碼（archive.js）
   排程（index.js，每天 00:00）和手動（archive-now.js）共用這一份。

   順序不能反：封存會刪掉 codes/{code}/private/profile，那是個資唯一的完整來源。
   所以要整理的日子 = 昨天 ＋ 這次要封存的每一組代碼的領取日（重整一次，補上
   半夜才完成的醫檢師回饋、跨過午夜的遊戲時間）。任何一天整理失敗，就整個不封存，
   個資留著等下次。封存的只有開頭查到、整理過的那幾組。

   all: true（archive-now.js --all）：今天也算。整理昨天＋今天＋每一組的領取日，
   再把 codes/ 裡每一組都封存，包括今天領的、還沒過期的。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { dayKey, findExpired, findAll, archiveCodes } = require('./archive');
const { previousDay, organizeDay } = require('./organize');

async function daysToOrganize(db, now, { all = false } = {}) {
  const locks = all ? await findAll(db) : await findExpired(db, now);
  const nowMs = now.toMillis();
  const days = new Set([previousDay(nowMs)]);
  if (all) days.add(dayKey(nowMs));
  locks.forEach((s) => days.add(dayKey(s.get('createdAt').toMillis())));
  return { days: [...days].sort(), locks };
}

/* 回傳 { organized: [每天的摘要], locks: 要封存的鎖, archived: archiveCodes 的結果 | null } */
async function nightly(db, now, { dryRun = false, all = false } = {}) {
  const { days, locks } = await daysToOrganize(db, now, { all });
  const organized = [];
  for (const day of days) organized.push(await organizeDay(db, day, { dryRun }));
  const archived = dryRun ? null : await archiveCodes(db, locks);
  return { organized, locks, archived };
}

module.exports = { daysToOrganize, nightly };
