/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 每日整理：把某一天散在各集合的資料，依家屬（手機的匿名 uid）收成一包
   排程（nightly.js，每天 00:00）和手動（organize-now.js、archive-now.js）共用這一份。
   欄位說明在 dbContent.md；手機端完全不會碰到 organized/（firestore.rules 沒有開放）。
   路徑一律英文；子集合名稱刻意和原始集合（staffFeedback、feedback、playtime）不同，
   collectionGroup 查詢才不會把副本和原始資料混在一起。

     organized/{YYYYMMDD}                          這一天的摘要
       └─ families/{uid}                           一支家長手機（雙機時孩子的手機也併進來）
            ├─ profiles/{代碼-領取毫秒}             個資：那次領號填的資料
            ├─ staffReviews/{代碼-領取毫秒}         醫檢師回饋；done: false = 醫檢師還沒完成
            ├─ parentFeedback/{feedback id}        家長填的 03 回饋（有 uid 的才放得進來）
            └─ games/{遊戲 id}                      遊戲進程：這個遊戲當天的總時間、各關時間
                 └─ sessions/{playtime id}         每一段（playtime 原始資料）

   日期一律是台灣時間：領號以「領取日」、遊戲以「開始那一刻」、回饋以「送出那一刻」歸到哪一天。
   原始資料不搬也不刪（個資除外：之後由封存刪掉），所以整理可以重跑，結果相同。
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { dayKey } = require('./archive');

const ROOT = 'organized';
const FAMILY = 'families';
const PROFILE = 'profiles';
const STAFF = 'staffReviews';
const FEEDBACK = 'parentFeedback';
const GAMES = 'games';
const ROWS = 'sessions';

const DAY_MS = 24 * 3600 * 1000;
const TAIPEI_MS = 8 * 3600 * 1000;

/* 台灣時間某一天的 [開始, 結束) 毫秒 */
function dayRange(day) {
  if (!/^\d{8}$/.test(day)) throw new Error('日期要寫成 YYYYMMDD：' + day);
  const start = Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)) - TAIPEI_MS;
  if (dayKey(start) !== day) throw new Error('沒有這一天：' + day);
  return { start, end: start + DAY_MS };
}

function previousDay(nowMs) {
  return dayKey(nowMs - DAY_MS);
}

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);

/* ── 讀：這一天相關的原始資料 ─────────────────────────────────── */

async function getAll(db, refs) {
  return refs.length ? db.getAll(...refs) : [];
}

async function collectDay(db, day) {
  const { start, end } = dayRange(day);
  const from = Timestamp.fromMillis(start);
  const to = Timestamp.fromMillis(end);

  /* 這天領的號碼：還在 codes/ 的（個資還在）＋ 已經封存的（個資已刪） */
  const [live, archived, rows, circle, feedback] = await Promise.all([
    db.collection('codes').where('createdAt', '>=', from).where('createdAt', '<', to).get(),
    db.collection('archivedCode').doc(day).collection('codes').get(),
    db.collection('playtime').where('startAt', '>=', from).where('startAt', '<', to).get(),
    db.collection('circleDays').doc(day).collection('scores').get(),
    db.collection('feedback').where('createdAt', '>=', from).where('createdAt', '<', to).get()
  ]);

  const claims = new Map();
  archived.docs.forEach((s) => {
    const l = s.data();
    claims.set(s.id, { id: s.id, lock: l, profile: null, archived: true });
  });
  const profiles = await getAll(db, live.docs.map((s) => s.ref.collection('private').doc('profile')));
  live.docs.forEach((s, i) => {
    const l = s.data();
    const id = s.id + '-' + l.createdAt.toMillis();
    claims.set(id, { id, lock: l, profile: profiles[i].exists ? profiles[i].data() : null, archived: false });
  });

  const list = [...claims.values()];
  const [staff, rooms] = await Promise.all([
    getAll(db, list.map((c) => db.collection('staffFeedback').doc(c.id))),
    getAll(db, list.map((c) => db.collection('rooms').doc(c.lock.code)))
  ]);
  list.forEach((c, i) => {
    c.staff = staff[i].exists ? staff[i].data() : null;
    c.room = rooms[i].exists ? rooms[i].data() : null;
  });

  return {
    day,
    claims: list,
    rows: rows.docs.map((s) => ({ id: s.id, ...s.data() })),
    feedback: feedback.docs.map((s) => ({ id: s.id, ...s.data() })),
    circle: new Map(circle.docs.map((s) => [s.id, s.get('score')]))
  };
}

/* ── 整理：純計算，不碰資料庫（方便測試） ─────────────────────── */

/* 雙機的孩子手機 → 家長手機。房間要是這次領號之後、由同一支家長手機開的
   （同一組號碼過期後可能被別的家庭重開）；家長按過「解除配對」就對不回來了。 */
function childLinks(claims) {
  const parentOf = new Map();
  claims.forEach((c) => {
    const r = c.room;
    const claimMs = ms(c.lock.createdAt);
    if (!r || !r.childUid || r.parentUid !== c.lock.holderUid) return;
    if (ms(r.createdAt) < claimMs || ms(r.createdAt) > ms(c.lock.expiresAt)) return;
    parentOf.set(r.childUid, c.lock.holderUid);
  });
  return parentOf;
}

/* 個資：優先用 codes/{code}/private/profile（完整）；已經被刪的，退而用醫檢師回饋裡
   那幾欄（年齡、性別、家長擔心程度、家長填的害怕程度）。expiresAt 只是期限，不放。 */
function profileDoc(c) {
  const base = { code: c.lock.code, claimedAt: c.lock.createdAt };
  if (c.profile) {
    const { expiresAt, ...p } = c.profile;
    return { ...base, source: 'profile', ...p };
  }
  if (c.staff && c.staff.profile) {
    return { ...base, source: 'staffFeedback', ...c.staff.profile, fearLevel: c.staff.parentFear };
  }
  return { ...base, source: 'none' };
}

/* 醫檢師回饋：沒完成就只有 done: false（「空白」） */
function staffDoc(c) {
  const base = { code: c.lock.code, claimedAt: c.lock.createdAt };
  const done = c.lock.status === 'done' || !!c.staff;
  if (!done) return { ...base, done: false };
  return { ...base, done: true, doneAt: c.lock.doneAt || null, ...(c.staff || {}) };
}

function gameSummary(game, rows) {
  const levels = {};
  let totalMs = 0;
  let first = null;
  let last = null;
  rows.forEach((r) => {
    const lv = levels[r.level] || (levels[r.level] = { ms: 0, rows: 0 });
    lv.ms += r.ms;
    lv.rows += 1;
    totalMs += r.ms;
    if (!first || ms(r.startAt) < ms(first)) first = r.startAt;
    if (!last || ms(r.endAt) > ms(last)) last = r.endAt;
  });
  return {
    game,
    totalMs,
    rows: rows.length,
    unfinished: rows.filter((r) => !r.ended).length,
    firstAt: first,
    lastAt: last,
    levels
  };
}

/* 回傳 { dayDoc, families: [{ uid, doc, profiles, staff, feedback, games: [{ game, doc, rows }] }] }
   每個 profiles／staff／feedback／rows 項目是 { id, data } */
function buildDay(src) {
  const parentOf = childLinks(src.claims);
  const families = new Map();
  const family = (uid) => {
    if (!families.has(uid)) {
      families.set(uid, { uid, claims: [], children: new Set(), phones: new Set([uid]), rows: [], feedback: [] });
    }
    return families.get(uid);
  };

  src.claims
    .slice()
    .sort((a, b) => ms(a.lock.createdAt) - ms(b.lock.createdAt))
    .forEach((c) => family(c.lock.holderUid).claims.push(c));

  src.rows.forEach((r) => {
    const owner = parentOf.get(r.uid) || r.uid;
    const f = family(owner);
    if (owner !== r.uid) { f.children.add(r.uid); f.phones.add(r.uid); }
    f.rows.push(r);
  });
  /* 回饋：2026-11-20 以前送出的沒有 uid，放不進任何家屬，只計數 */
  let unplaced = 0;
  (src.feedback || []).forEach((fb) => {
    if (!fb.uid) { unplaced += 1; return; }
    const { id, ...data } = fb;
    family(parentOf.get(fb.uid) || fb.uid).feedback.push({ id, data });
  });
  parentOf.forEach((parent, child) => {
    if (families.has(parent)) { families.get(parent).children.add(child); families.get(parent).phones.add(child); }
  });

  const out = [];
  let staffDone = 0;
  [...families.values()].sort((a, b) => (a.uid < b.uid ? -1 : 1)).forEach((f) => {
    const profiles = f.claims.map((c) => ({ id: c.id, data: profileDoc(c) }));
    const staff = f.claims.map((c) => ({ id: c.id, data: staffDoc(c) }));
    const done = staff.filter((s) => s.data.done).length;
    staffDone += done;

    const byGame = new Map();
    f.rows.forEach((r) => {
      const row = {
        level: r.level,
        startAt: r.startAt,
        endAt: r.endAt,
        ms: Math.max(0, (ms(r.endAt) || 0) - (ms(r.startAt) || 0)),
        ended: !!r.ended,
        uid: r.uid,
        age: r.age === undefined ? null : r.age
      };
      if (!byGame.has(r.game)) byGame.set(r.game, []);
      byGame.get(r.game).push({ id: r.id, data: row });
    });

    /* 畫圓圈：每支手機當天的最高分（排行榜那一筆） */
    let best = null;
    f.phones.forEach((uid) => {
      const s = src.circle.get(uid);
      if (typeof s === 'number' && (best === null || s > best)) best = s;
    });
    if (best !== null && !byGame.has('draw-circle')) byGame.set('draw-circle', []);

    const games = [...byGame.keys()].sort().map((game) => {
      const rows = byGame.get(game).sort((a, b) => ms(a.data.startAt) - ms(b.data.startAt));
      const doc = gameSummary(game, rows.map((r) => r.data));
      if (game === 'draw-circle') doc.bestScore = best;
      return { game, doc, rows };
    });

    const withProfile = profiles.filter((p) => p.data.source !== 'none');
    const latest = withProfile[withProfile.length - 1];
    const rowAge = f.rows.find((r) => typeof r.age === 'number');
    const feedback = f.feedback.sort((a, b) => ms(a.data.createdAt) - ms(b.data.createdAt));
    out.push({
      uid: f.uid,
      profiles,
      staff,
      feedback,
      games,
      doc: {
        uid: f.uid,
        day: src.day,
        codes: f.claims.map((c) => c.lock.code),
        childUids: [...f.children].sort(),
        age: latest && typeof latest.data.age === 'number' ? latest.data.age : rowAge ? rowAge.age : null,
        hasProfile: withProfile.length > 0,
        staffDone: done,
        feedbacks: feedback.length,
        games: games.map((g) => g.game),
        playMs: games.reduce((sum, g) => sum + g.doc.totalMs, 0)
      }
    });
  });

  return {
    dayDoc: {
      day: src.day,
      families: out.length,
      claims: src.claims.length,
      staffDone,
      playRows: src.rows.length,
      feedbacks: (src.feedback || []).length - unplaced,
      feedbackUnplaced: unplaced
    },
    families: out
  };
}

/* ── 寫：organized/{day}/… ───────────────────────────────────────── */

function dayRef(db, day) {
  return db.collection(ROOT).doc(day);
}

/* 重跑時個資可能已經被封存刪掉：之前存到的完整版（source: 'profile'）不要被較少的蓋掉 */
async function keptProfiles(db, day, built) {
  const weaker = [];
  built.families.forEach((f) => f.profiles.forEach((p) => {
    if (p.data.source !== 'profile') weaker.push({ uid: f.uid, id: p.id });
  }));
  const refs = weaker.map((w) => dayRef(db, day).collection(FAMILY).doc(w.uid).collection(PROFILE).doc(w.id));
  const snaps = await getAll(db, refs);
  const keep = new Set();
  snaps.forEach((s, i) => {
    if (s.exists && s.get('source') === 'profile') keep.add(weaker[i].uid + '/' + weaker[i].id);
  });
  return keep;
}

/* 整理一天。dryRun 只讀不寫。回傳摘要；有任何一筆寫入失敗就丟錯誤。 */
async function organizeDay(db, day, { dryRun = false } = {}) {
  const src = await collectDay(db, day);
  const built = buildDay(src);
  const sources = { profile: 0, staffFeedback: 0, none: 0, kept: 0 };
  const keep = await keptProfiles(db, day, built);

  let writes = 0;
  const writer = dryRun ? null : db.bulkWriter();
  const pending = [];
  const put = (ref, data) => {
    writes += 1;
    if (writer) pending.push(writer.set(ref, data).then(() => null, (err) => ({ path: ref.path, err })));
  };
  if (writer) writer.onWriteError((err) => err.failedAttempts < 5);

  const at = FieldValue.serverTimestamp();
  const root = dayRef(db, day);
  put(root, { ...built.dayDoc, organizedAt: at });
  built.families.forEach((f) => {
    const fam = root.collection(FAMILY).doc(f.uid);
    put(fam, { ...f.doc, organizedAt: at });
    f.profiles.forEach((p) => {
      if (keep.has(f.uid + '/' + p.id)) { sources.kept += 1; return; }
      sources[p.data.source] += 1;
      put(fam.collection(PROFILE).doc(p.id), p.data);
    });
    f.staff.forEach((s) => put(fam.collection(STAFF).doc(s.id), s.data));
    f.feedback.forEach((fb) => put(fam.collection(FEEDBACK).doc(fb.id), fb.data));
    f.games.forEach((g) => {
      const gameRef = fam.collection(GAMES).doc(g.game);
      put(gameRef, g.doc);
      g.rows.forEach((r) => put(gameRef.collection(ROWS).doc(r.id), r.data));
    });
  });

  if (writer) {
    await writer.close();
    const failed = (await Promise.all(pending)).filter(Boolean);
    if (failed.length) {
      throw new Error(day + ' 整理有 ' + failed.length + ' 筆寫入失敗，例如 ' + failed[0].path + '：' + failed[0].err);
    }
  }

  return { day, ...built.dayDoc, profiles: sources, writes };
}

module.exports = {
  ROOT, FAMILY, PROFILE, STAFF, FEEDBACK, GAMES, ROWS,
  dayRange, previousDay, collectDay, buildDay, organizeDay
};
