/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 遊戲時間（window.AnxinPlay）
   每個遊戲的每一關記一筆「開始、結束時間」；遊戲的首頁（選關、封面）也算一關：home。
   資料庫：playtime/{隨機 id}（規則在 firestore.rules）
     game · level · startAt · endAt（手機的時間）· ended（有沒有看到結束）
     age（沒有暱稱、沒有代碼）· uid（匿名登入，只用來確認是自己的紀錄）· updatedAt（伺服器時間）
   怎麼算一筆：
     - 進到一關 → 開一筆；換關、回首頁 → 這筆結束、開下一筆；同一關重來、死掉重生不算新的一筆
     - 鎖螢幕、切到別的 App、離開頁面 → 這筆結束；回來再開新的一筆（放著沒玩的時間不算）
   送不出去也不會丟：
     - 每一筆先記在本機（localStorage），伺服器確認收到才刪
     - 玩的時候每 5 秒在本機更新結束時間、每 30 秒同步一次；頁面被直接關掉時，
       下次打開任何遊戲會補送（差不到 5 秒），再也沒回來就停在最後一次同步（差不到 30 秒）
   一般 <script> 載入（非 module）；邏輯在 createTracker（可在 node 測試）。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var KEY = 'anxin.playtime.v1';
  var TICK_MS = 5000;          /* 本機更新結束時間 */
  var SYNC_MS = 30000;         /* 還在玩的那一筆，多久同步一次 */
  var STALE_MS = 20000;        /* 別的頁面的紀錄這麼久沒更新 = 那個頁面已經關了 */
  var MAX_AGE_MS = 2 * 864e5;  /* 太舊的不送（伺服器也不收） */
  var MAX_ROWS = 200;

  /* 必須和 firestore.rules 的 validPlay 一致 */
  var GAMES = ['dash', 'golf', 'draw-circle', 'whack-a-mole', 'whack-a-mole-duo', 'whack-a-mole-remote'];
  var LEVEL = /^(home|play|inf|[0-9]{1,3})$/;
  var ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  function newId(rand) {
    var s = '';
    for (var i = 0; i < 20; i++) s += ID_CHARS.charAt(Math.floor(rand() * ID_CHARS.length));
    return s;
  }

  /* env: { now, rand, read() → 陣列, write(陣列), send(row) → Promise, age, hidden } */
  function createTracker(env) {
    var page = newId(env.rand);
    var age = typeof env.age === 'number' ? env.age : null;
    var curId = null, want = null, hidden = !!env.hidden, sending = false;

    function rows() {
      var v = env.read();
      return Array.isArray(v) ? v : [];
    }

    /* fn 回傳 null = 刪掉這筆 */
    function edit(id, fn) {
      var list = rows(), out = [];
      list.forEach(function (r) {
        if (r.id !== id) { out.push(r); return; }
        var n = fn(r);
        if (n) out.push(n);
      });
      env.write(out);
    }

    function open(game, level, t) {
      var row = { id: newId(env.rand), page: page, game: game, level: level, age: age,
        startAt: t, endAt: t, ended: false, sent: null, sentAt: 0 };
      var list = rows();
      list.push(row);
      if (list.length > MAX_ROWS) list = list.slice(list.length - MAX_ROWS);
      env.write(list);
      curId = row.id;
    }

    function close(t) {
      if (!curId) return;
      edit(curId, function (r) { r.endAt = Math.max(r.endAt, t); r.ended = true; return r; });
      curId = null;
    }

    /* 另一個還開著的頁面的紀錄：交給它自己送 */
    function othersLive(r, t) {
      return r.page !== page && !r.ended && t - r.endAt < STALE_MS;
    }

    function due(r, t) {
      if (othersLive(r, t)) return false;
      if (r.sent && r.sent.endAt === r.endAt && r.sent.ended === r.ended) return false;
      if (r.id === curId && r.sent) return t - r.sentAt >= SYNC_MS;
      return true;
    }

    /* 送出後可以從本機刪掉：已經結束的，或已經關掉的頁面留下的 */
    function settled(r) {
      return r.ended || r.page !== page;
    }

    function flush() {
      if (sending) return;
      var t = env.now();
      var list = rows();
      var fresh = list.filter(function (r) { return t - r.startAt < MAX_AGE_MS; });
      if (fresh.length !== list.length) env.write(fresh);
      var row = fresh.filter(function (r) { return due(r, t); })[0];
      if (!row) return;
      var snap = { endAt: row.endAt, ended: row.ended };
      sending = true;
      var done = function () { sending = false; flush(); };
      var p;
      try { p = Promise.resolve(env.send(row)); } catch (e) { p = Promise.reject(e); }
      p.then(function () {
        var at = env.now();
        edit(row.id, function (r) {
          if (settled(r) && r.endAt === snap.endAt && r.ended === snap.ended) return null;
          r.sent = snap;
          r.sentAt = at;
          return r;
        });
        done();
      }, function (err) {
        /* 規則不收（已經結束的筆、規則還沒發布）：重送也沒用，刪掉。
           其他（離線、Firebase 載不到）：留著，下一次 tick 再試 */
        if (err && err.code === 'permission-denied') { edit(row.id, function () { return null; }); done(); }
        else sending = false;
      });
    }

    function at(game, level) {
      level = String(level);
      if (GAMES.indexOf(game) < 0 || !LEVEL.test(level)) return false;
      if (want && want.game === game && want.level === level && (curId || hidden)) return true;
      want = { game: game, level: level };
      if (hidden) return true;
      var t = env.now(); /* 同一個時間點：上一筆的結束 = 這一筆的開始 */
      close(t);
      open(game, level, t);
      flush();
      return true;
    }

    function leave() {
      want = null;
      close(env.now());
      flush();
    }

    function hide() {
      if (hidden) return;
      hidden = true;
      close(env.now());
      flush();
    }

    function show() {
      if (!hidden) return;
      hidden = false;
      if (want) open(want.game, want.level, env.now());
      flush();
    }

    function tick() {
      if (curId) {
        var t = env.now();
        edit(curId, function (r) { r.endAt = Math.max(r.endAt, t); return r; });
      }
      flush();
    }

    function setAge(n) {
      age = typeof n === 'number' ? n : null;
      if (curId) edit(curId, function (r) { r.age = age; return r; });
    }

    return {
      at: at, leave: leave, hide: hide, show: show, tick: tick, flush: flush, setAge: setAge,
      current: function () { return curId; }
    };
  }

  var api = { createTracker: createTracker, KEY: KEY, GAMES: GAMES, LEVEL: LEVEL,
    TICK_MS: TICK_MS, SYNC_MS: SYNC_MS, STALE_MS: STALE_MS, MAX_AGE_MS: MAX_AGE_MS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined' || !root.Anxin) return;

  /* ─────────────────────────────────────────────────────────────
     頁面：本機儲存、Firebase、可見度
     ───────────────────────────────────────────────────────────── */

  /* 無痕模式、封鎖儲存：退回記憶體（這一頁照樣會送，只是關掉就沒有補送） */
  var store = (function () {
    var mem = [];
    var ls = null;
    try {
      ls = root.localStorage;
      ls.setItem(KEY + '.probe', '1');
      ls.removeItem(KEY + '.probe');
    } catch (e) { ls = null; }
    return {
      read: function () {
        if (!ls) return mem;
        try { return JSON.parse(ls.getItem(KEY) || '[]'); } catch (e) { return []; }
      },
      write: function (list) {
        if (!ls) { mem = list; return; }
        try { ls.setItem(KEY, JSON.stringify(list)); } catch (e) { mem = list; }
      }
    };
  })();

  /* 沒有載入 Firebase 的頁面（單機遊戲）：等頁面載完再載，不和遊戲搶頻寬 */
  function loadFirebase() {
    if (root.AnxinFirebase || document.querySelector('script[src="/shared/firebase.js"]')) return;
    var mod = document.createElement('script');
    mod.type = 'module';
    mod.src = '/shared/firebase.js';
    document.head.appendChild(mod);
  }
  if (document.readyState === 'complete') loadFirebase();
  else root.addEventListener('load', loadFirebase);

  var profile = root.Anxin.profile && root.Anxin.profile.load();

  var tracker = createTracker({
    now: Date.now,
    rand: Math.random,
    read: store.read,
    write: store.write,
    age: profile ? profile.age : null,
    hidden: document.visibilityState === 'hidden',
    send: function (row) {
      return root.Anxin.whenFirebase(20000).then(function (fb) { return fb.playtime.save(row); });
    }
  });

  /* 離開頁面時瀏覽器先發 pagehide、再發 visibilitychange：離開之後的任何「看得見了」都不算，
     要等真的回到這一頁（pageshow，從上一頁快取還原）才重新開始 */
  var gone = false;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') tracker.hide();
    else if (!gone) tracker.show();
  });
  root.addEventListener('pagehide', function () { gone = true; tracker.hide(); });
  root.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    gone = false;
    if (document.visibilityState !== 'hidden') tracker.show();
  });
  root.addEventListener('online', tracker.flush);
  root.setInterval(tracker.tick, TICK_MS);
  tracker.flush(); /* 上一頁沒送完的 */

  root.AnxinPlay = { at: tracker.at, leave: tracker.leave, setAge: tracker.setAge, flush: tracker.flush };
})(typeof window !== 'undefined' ? window : globalThis);
