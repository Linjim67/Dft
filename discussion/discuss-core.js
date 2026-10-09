/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 04 討論區：資料規則（純函式，window.AnxinDiscuss）
   發文／回覆怎麼組、搜尋怎麼比對、「推薦」怎麼排，全部在這裡，可以直接在 node 測試。
   畫面在 discussion.js，資料進出在 /shared/firebase.js 的 discuss。
   欄位必須與 firestore.rules 的 validThread／validReply 完全一致。
   需要先載入 /shared/app.js（年紀文字、暱稱替換）。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var ROLES = ['家長', '醫師', '護士', '醫檢師', '其他'];
  /* 醫護人員分享的是「一群孩子」的經驗：年紀用範圍（例如 3–6 歲） */
  var PRO_ROLES = ['醫師', '護士', '醫檢師'];
  var GENDERS = ['男', '女', '不限'];
  var KID = { '男': '男孩', '女': '女孩', '不限': '孩子' };

  var MAX = { author: 20, content: 2000, reply: 1000, tag: 20, tags: 5 };
  /* 兩次發言（發文或回覆）至少隔 15 秒；伺服器規則也擋（cooldowns/{uid}） */
  var COOLDOWN_MS = 15000;
  /* 停留時間：一次最多算 5 分鐘，手機開著放旁邊不會灌水（規則也是 5 分鐘） */
  var DWELL_CAP_MS = 5 * 60 * 1000;

  function anxin() { return root.Anxin; }

  function isPro(role) { return PRO_ROLES.indexOf(role) !== -1; }

  /* ─────────────────────────────────────────────────────────────
     年紀滑桿：0–36 格，每格固定 0.5 歲（滑桿才是線性的）
     規格：5 歲以下 0.5 歲一階，5 歲以上 1 歲一階 → 10 格以上只有偶數格可停
     ───────────────────────────────────────────────────────────── */

  var AGE_MAX_IDX = 36;
  var HALF_STEP_BELOW = 10;

  function indexToAge(i) { return i * 0.5; }
  function ageToIndex(a) { return Math.max(0, Math.min(AGE_MAX_IDX, Math.round(Number(a) * 2))); }
  function isSelectable(i) { return i < HALF_STEP_BELOW || i % 2 === 0; }

  /* 奇數格依移動方向吸附到相鄰的偶數格 */
  function snapIndex(raw, prev) {
    if (isSelectable(raw)) return raw;
    var out = raw > prev ? raw + 1 : raw - 1;
    return Math.min(AGE_MAX_IDX, Math.max(0, out));
  }

  /* ─────────────────────────────────────────────────────────────
     Hashtag：去掉 #、空白與標點，只留文字、數字、底線；英文轉小寫
     ───────────────────────────────────────────────────────────── */

  var TAG_SPLIT = /[\s,，、;；#＃]+/;

  function normTag(s) {
    return String(s == null ? '' : s).replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase().slice(0, MAX.tag);
  }

  /* 把輸入框的文字（可以一次好幾個）加進清單：不重複、最多 5 個 */
  function addTags(list, raw) {
    var out = (list || []).slice();
    String(raw == null ? '' : raw).split(TAG_SPLIT).forEach(function (part) {
      var t = normTag(part);
      if (t && out.length < MAX.tags && out.indexOf(t) === -1) out.push(t);
    });
    return out;
  }

  /* ─────────────────────────────────────────────────────────────
     發文、回覆的內容：白名單欄位
     家長版（source 'clinic'）：身分固定「家長」、孩子是 #01 填的那一位；稱呼選填（不填 = 匿名）。
     孩子的暱稱絕不上傳：稱呼、內文、標籤裡提到的暱稱都換成「孩子」（Anxin.scrubNickname）。
     ───────────────────────────────────────────────────────────── */

  function text(s, nickname, max) {
    var t = String(s == null ? '' : s).trim();
    if (nickname) t = anxin().scrubNickname(t, nickname);
    return t.slice(0, max);
  }

  function cleanMember(m) {
    var lo = Number(m && m.ageMin);
    var hi = Number(m && m.ageMax);
    if (!(lo >= 0 && lo <= hi && hi <= 18)) throw new Error('invalid member age');
    if (GENDERS.indexOf(m.gender) === -1) throw new Error('invalid member gender');
    return { ageMin: lo, ageMax: hi, gender: m.gender };
  }

  function cleanTags(list, nickname) {
    var out = [];
    (list || []).forEach(function (t) {
      out = addTags(out, nickname ? anxin().scrubNickname(String(t), nickname) : t);
    });
    return out;
  }

  function sourceOf(opts) { return opts && opts.source === 'clinic' ? 'clinic' : 'public'; }

  function roleOf(f, source) {
    var role = source === 'clinic' ? '家長' : f.role;
    if (ROLES.indexOf(role) === -1) throw new Error('invalid role: ' + role);
    return role;
  }

  /* 稱呼：選填，'' = 匿名。家長很自然會寫「小恩媽媽」→ 存成「孩子媽媽」 */
  function authorName(raw, nickname) {
    return text(raw, nickname, MAX.author);
  }

  /* f: { role, author, content, members: [{ ageMin, ageMax, gender }], hashtags }
     opts: { source: 'public' | 'clinic', nickname }
     一篇只寫一個孩子：members 只留第一位（舊文章可能有好幾位，讀的時候照樣顯示） */
  function buildThread(f, opts) {
    var source = sourceOf(opts);
    var nickname = opts && opts.nickname;
    var content = text(f.content, nickname, MAX.content);
    if (!content) throw new Error('empty content');
    var members = (f.members || []).slice(0, 1).map(cleanMember);
    if (!members.length) throw new Error('no members');
    return {
      v: 1,
      role: roleOf(f, source),
      author: authorName(f.author, nickname),
      content: content,
      members: members,
      hashtags: cleanTags(f.hashtags, nickname),
      source: source
    };
  }

  function buildReply(f, opts) {
    var source = sourceOf(opts);
    var nickname = opts && opts.nickname;
    var content = text(f.content, nickname, MAX.reply);
    if (!content) throw new Error('empty content');
    return { v: 1, role: roleOf(f, source), author: authorName(f.author, nickname), content: content, source: source };
  }

  /* ─────────────────────────────────────────────────────────────
     讀進來的討論串：補齊欄位。早期原型的舊文件照樣顯示，v = 0：
       2026 年 8 月：childAge／childGender（'男' | '女' | '不指定'），沒有計數
       2026 年 9 月：members 是 { gender: '男孩' | '女孩' | '不指定', kind: 'single', age }
                     或 { gender, kind: 'range', ageMin, ageMax }，沒有 helpful
     缺的計數當 0；規則也一樣（counter()），所以舊文章一樣能按讚、回覆。
     ───────────────────────────────────────────────────────────── */

  var OLD_GENDER = { '男': '男', '男孩': '男', '女': '女', '女孩': '女' };

  /* 9 月原型的一位孩子 → 現在的格式；看不懂就略過 */
  function oldMember(m) {
    if (!m || typeof m !== 'object') return null;
    var single = m.kind === 'single';
    var lo = single ? m.age : m.ageMin;
    var hi = single ? m.age : m.ageMax;
    if (typeof lo !== 'number' || typeof hi !== 'number' || lo > hi) return null;
    return { ageMin: lo, ageMax: hi, gender: OLD_GENDER[m.gender] || '不限' };
  }

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  function okMember(m) {
    return m && typeof m.ageMin === 'number' && typeof m.ageMax === 'number' && m.ageMin <= m.ageMax &&
      GENDERS.indexOf(m.gender) !== -1;
  }

  function normalizeThread(d) {
    var members = Array.isArray(d.members)
      ? d.members.map(function (m) { return okMember(m) ? m : oldMember(m); }).filter(Boolean)
      : [];
    if (!members.length && typeof d.childAge === 'number') {
      members = [{
        ageMin: d.childAge,
        ageMax: d.childAge,
        gender: d.childGender === '男' || d.childGender === '女' ? d.childGender : '不限'
      }];
    }
    return {
      id: d.id,
      v: d.v === 1 ? 1 : 0,
      role: ROLES.indexOf(d.role) === -1 ? '其他' : d.role,
      author: typeof d.author === 'string' ? d.author : '',
      content: typeof d.content === 'string' ? d.content : '',
      members: members,
      hashtags: Array.isArray(d.hashtags) ? d.hashtags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      source: d.source === 'clinic' ? 'clinic' : 'public',
      clicks: num(d.clicks),
      dwellMs: num(d.dwellMs),
      helpful: num(d.helpful),
      replyCount: num(d.replyCount),
      createdAt: num(d.createdAt),
      lastActivityAt: num(d.lastActivityAt) || num(d.createdAt)
    };
  }

  /* ─────────────────────────────────────────────────────────────
     顯示用文字
     ───────────────────────────────────────────────────────────── */

  function ageNum(a) { return a % 1 ? a.toFixed(1) : String(a); }

  /* 「3 歲半」「3–6 歲」 */
  function ageRangeLabel(lo, hi) {
    if (lo === hi) return anxin().ageLabel(lo);
    return ageNum(lo) + '–' + ageNum(hi) + ' 歲';
  }

  /* 「3 歲半女孩」「3–6 歲」「各年齡的男孩」 */
  function memberLabel(m) {
    if (m.ageMin === m.ageMax) return anxin().ageLabel(m.ageMin) + KID[m.gender];
    if (m.ageMin === 0 && m.ageMax === 18) return '各年齡的' + KID[m.gender];
    return ageRangeLabel(m.ageMin, m.ageMax) + (m.gender === '不限' ? '' : KID[m.gender]);
  }

  function membersLabel(ms) {
    return (ms || []).map(memberLabel).join('、');
  }

  function timeAgo(ms, now) {
    if (!ms) return '剛剛';
    var s = Math.max(0, now - ms) / 1000;
    if (s < 60) return '剛剛';
    if (s < 3600) return Math.floor(s / 60) + ' 分鐘前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小時前';
    if (s < 7 * 86400) return Math.floor(s / 86400) + ' 天前';
    var d = new Date(ms);
    var n = new Date(now);
    return (d.getFullYear() === n.getFullYear() ? '' : d.getFullYear() + ' 年 ') +
      (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  /* ─────────────────────────────────────────────────────────────
     搜尋：全部在手機上比對（Firestore 沒有全文搜尋；最新 300 篇一次載入）
     關鍵字以空白分開、全部都要符合；「#」開頭的只比對標籤。
     年紀範圍：任何一位孩子（或年齡層）和篩選範圍有重疊就算。
     性別：「不限」的年齡層男孩女孩都算。
     ───────────────────────────────────────────────────────────── */

  function parseQuery(q) {
    var terms = [];
    var tags = [];
    String(q == null ? '' : q).trim().split(/\s+/).forEach(function (w) {
      if (!w) return;
      if (/^[#＃]/.test(w)) {
        var t = normTag(w);
        if (t) tags.push(t);
      } else {
        terms.push(w.toLowerCase());
      }
    });
    return { terms: terms, tags: tags };
  }

  function haystack(t) {
    return [t.content, t.author, t.role, t.hashtags.map(function (h) { return '#' + h; }).join(' '),
      membersLabel(t.members)].join('\n').toLowerCase();
  }

  function overlaps(m, lo, hi) { return m.ageMin <= hi && m.ageMax >= lo; }

  /* f: { query, roles: [], ageMin, ageMax (null = 不限), gender (null = 不限) }
     年紀和性別要是「同一位」孩子：3 歲男孩＋8 歲女孩的文章，不算「3–6 歲的女孩」 */
  function matches(t, f) {
    f = f || {};
    if (f.roles && f.roles.length && f.roles.indexOf(t.role) === -1) return false;
    var aged = f.ageMin != null || f.ageMax != null;
    if (aged || f.gender) {
      var lo = f.ageMin == null ? 0 : f.ageMin;
      var hi = f.ageMax == null ? 18 : f.ageMax;
      if (!t.members.some(function (m) {
        return (!aged || overlaps(m, lo, hi)) && (!f.gender || m.gender === f.gender || m.gender === '不限');
      })) return false;
    }
    var q = parseQuery(f.query);
    if (q.tags.length && !q.tags.every(function (tag) {
      return t.hashtags.some(function (h) { return normTag(h).indexOf(tag) !== -1; });
    })) return false;
    if (q.terms.length) {
      var hay = haystack(t);
      if (!q.terms.every(function (w) { return hay.indexOf(w) !== -1; })) return false;
    }
    return true;
  }

  /* ─────────────────────────────────────────────────────────────
     「推薦」排序
     只看點閱或停留時間會有幾個問題：排在前面的被點得更多（越前越前）、
     新文章永遠浮不上來、手機開著放旁邊就灌了停留時間、一個人狂點就能洗榜。所以：
       1. 明確的訊號比被動的重：有幫助 ×5、回覆 ×3、點開 ×1、讀完 ×2
          點開：每支手機每篇只算一次；自己的文章不算。
          讀完：停留時間換算成「讀完幾次」（依字數，約每分鐘 400 字），不超過點開次數；
                每次停留最多算 5 分鐘。
       2. 取對數：100 次點閱不會是 10 次的 10 倍，熱門文不會永遠霸榜
       3. 新文章加分，半衰期 7 天：剛發 ×3、一週 ×2、一個月約 ×1.1
          （安撫方法不太會過時，所以加分慢慢退，不是直接沉下去）
       4. 家長版知道孩子幾歲：和孩子年紀相差 1 歲內的文章 ×1.5、3 歲內 ×1.2
     ───────────────────────────────────────────────────────────── */

  var WEIGHT = { helpful: 5, reply: 3, open: 1, read: 2 };
  var FRESH_BOOST = 2;
  var FRESH_HALF_LIFE_DAYS = 7;
  var READ_MS_PER_CHAR = 150;

  function readMs(content) {
    return Math.max(3000, String(content || '').length * READ_MS_PER_CHAR);
  }

  function fullReads(t) {
    return t.clicks ? Math.min(t.clicks, t.dwellMs / readMs(t.content)) : 0;
  }

  function ageDistance(m, age) {
    if (age < m.ageMin) return m.ageMin - age;
    if (age > m.ageMax) return age - m.ageMax;
    return 0;
  }

  function ageMatch(t, age) {
    if (typeof age !== 'number') return 1;
    var best = Infinity;
    t.members.forEach(function (m) { best = Math.min(best, ageDistance(m, age)); });
    if (best <= 1) return 1.5;
    if (best <= 3) return 1.2;
    return 1;
  }

  function score(t, now, viewerAge) {
    var days = Math.max(0, (now - t.createdAt) / 864e5);
    var e = WEIGHT.helpful * t.helpful + WEIGHT.reply * t.replyCount +
      WEIGHT.open * t.clicks + WEIGHT.read * fullReads(t);
    var fresh = 1 + FRESH_BOOST * Math.pow(0.5, days / FRESH_HALF_LIFE_DAYS);
    return (1 + Math.log2(1 + e)) * fresh * ageMatch(t, viewerAge);
  }

  /* mode: 'recommend' | 'latest'。不改原陣列 */
  function sortThreads(list, mode, now, viewerAge) {
    var newest = function (a, b) { return b.createdAt - a.createdAt; };
    if (mode === 'latest') return list.slice().sort(newest);
    var s = {};
    list.forEach(function (t) { s[t.id] = score(t, now, viewerAge); });
    return list.slice().sort(function (a, b) { return (s[b.id] - s[a.id]) || newest(a, b); });
  }

  /* 上次發言時間 → 還要等幾毫秒（時鐘被調回去也最多等 15 秒） */
  function cooldownLeft(last, now) {
    if (!last) return 0;
    return Math.max(0, Math.min(COOLDOWN_MS, COOLDOWN_MS - (now - last)));
  }

  var AnxinDiscuss = {
    ROLES: ROLES,
    PRO_ROLES: PRO_ROLES,
    GENDERS: GENDERS,
    KID: KID,
    MAX: MAX,
    COOLDOWN_MS: COOLDOWN_MS,
    DWELL_CAP_MS: DWELL_CAP_MS,
    AGE_MAX_IDX: AGE_MAX_IDX,
    WEIGHT: WEIGHT,
    isPro: isPro,
    indexToAge: indexToAge,
    ageToIndex: ageToIndex,
    isSelectable: isSelectable,
    snapIndex: snapIndex,
    normTag: normTag,
    addTags: addTags,
    authorName: authorName,
    buildThread: buildThread,
    buildReply: buildReply,
    normalizeThread: normalizeThread,
    ageRangeLabel: ageRangeLabel,
    memberLabel: memberLabel,
    membersLabel: membersLabel,
    timeAgo: timeAgo,
    parseQuery: parseQuery,
    matches: matches,
    readMs: readMs,
    ageMatch: ageMatch,
    score: score,
    sortThreads: sortThreads,
    cooldownLeft: cooldownLeft
  };

  root.AnxinDiscuss = AnxinDiscuss;
  if (typeof module !== 'undefined' && module.exports) module.exports = AnxinDiscuss;
})(typeof window !== 'undefined' ? window : globalThis);
