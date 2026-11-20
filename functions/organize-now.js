/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 手動重新整理某幾天（只整理，不封存）
   整理可以重跑：原始資料不動，結果蓋掉同一天之前的整理；
   之前存到的完整個資不會被較少的蓋掉。

     node functions/organize-now.js <金鑰.json>                                 整理昨天
     node functions/organize-now.js <金鑰.json> --day 20261119                  整理某一天
     node functions/organize-now.js <金鑰.json> --day 20261101..20261119        整理一段日子
     加上 --dry-run：只列出會寫入多少，不寫入

   早於這個功能上線的日子也能整理，但那時醫檢師完成就會刪個資，
   所以多半只剩醫檢師回饋裡的幾欄（年齡、性別、擔心、害怕程度）。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { dayKey } = require('./archive');
const { dayRange, previousDay, organizeDay } = require('./organize');
const { openDb, organizedLine } = require('./admin-db');

const USAGE = 'node functions/organize-now.js <金鑰.json> [--day YYYYMMDD[..YYYYMMDD]] [--dry-run]';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function daysFrom(spec) {
  if (!spec) return [previousDay(Date.now())];
  const [a, b = a] = spec.split('..');
  const end = dayRange(b).start;
  const days = [];
  for (let t = dayRange(a).start; t <= end; t += 24 * 3600 * 1000) days.push(dayKey(t));
  if (!days.length) throw new Error('開始日在結束日之後：' + spec);
  return days;
}

let days;
try {
  const i = args.indexOf('--day');
  days = daysFrom(i >= 0 ? args[i + 1] : null);
} catch (err) {
  console.error(err.message + '\n用法：' + USAGE);
  process.exit(2);
}

const { db } = openDb(args, USAGE);

(async () => {
  for (const day of days) console.log(organizedLine(await organizeDay(db, day, { dryRun })));
  if (dryRun) console.log('（--dry-run：沒有寫入）');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
