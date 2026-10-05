/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 雙機共用（純函式：不碰 Firebase、不碰畫面）
   家長的手機 = 遙控器（parent portal），孩子的手機 = 遊戲機（children portal）。
   兩支手機透過 Firestore 的 rooms/{代碼} 連線；代碼就是個人資料的 4 位數暫時代碼。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* 孩子可以選的遊戲（ready = 雙機版做好了） */
  var GAMES = [
    { id: 'whack-a-mole', name: '打地鼠', desc: '爸爸媽媽放角色，你來敲！', ready: true },
    { id: 'draw-circle', name: '畫圓圈', desc: '比比看誰畫得比較圓', ready: false },
    { id: 'jump', name: '跳跳冒險', desc: '跳過障礙，往終點前進', ready: false }
  ];

  /* 家長可以放的角色與鍍層（大魔王用事件按鈕叫出來） */
  var PLACEABLE = ['tourniquet', 'swab', 'syringe', 'virus'];
  var COATS = ['normal', 'silver', 'iron'];
  /* 家長的手機不載入遊戲引擎，名字放這裡（要和 engine.js 的 CHARACTERS 一致） */
  var CHAR_NAMES = { tourniquet: '止血帶', swab: '酒精棉片', syringe: '針筒', virus: '病毒' };
  var COAT_NAMES = { normal: '一般', silver: '銀色', iron: '鐵甲', boss: '大魔王' };

  /* 第幾回合開始出現（要和 engine.js 的 CHARACTERS.from 一致）：酒精棉片、病毒都是第 3 回合登場 */
  var CHAR_FROM = { tourniquet: 1, swab: 3, syringe: 1, virus: 3 };

  /* ── 家長的排隊：點一個洞，就放隊伍最前面那一個 ──
     一般角色一袋一袋洗牌後排進來（同一袋裡不會重複，不會連來好幾個一樣的）；
     回合越後面越常帶鍍層。病毒不排隊：入侵時整條隊伍換成病毒。 */
  var LINE_LEN = 4; /* 畫面上看得到的：現在這一個 + 後面三個 */

  function coatChance(round) {
    return Math.min(0.4, 0.08 * Math.max(0, (round || 1) - 1));
  }

  function lineItem(c, round, rand) {
    var r = rand();
    var p = coatChance(round);
    return { c: c, v: r < p / 2 ? 'silver' : (r < p ? 'iron' : 'normal') };
  }

  /* 回傳補滿之後的新隊伍（不改原本的陣列） */
  function refillLine(line, round, rand) {
    rand = rand || Math.random;
    var out = line.slice();
    var pool = PLACEABLE.filter(function (c) { return c !== 'virus' && CHAR_FROM[c] <= (round || 1); });
    while (out.length < LINE_LEN) {
      var bag = pool.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      /* 新的一袋第一個不要和隊伍最後一個一樣 */
      if (out.length && bag.length > 1 && bag[0] === out[out.length - 1].c) bag.push(bag.shift());
      bag.forEach(function (c) { out.push(lineItem(c, round, rand)); });
    }
    return out;
  }

  /* 家長的事件按鈕：trick = 搗蛋，help = 幫忙，virus = 排隊區旁邊的「開始病毒入侵」。
     cooldownMs：家長按了之後多久才能再按 */
  var EVENTS = {
    invasion: { name: '病毒入侵', kind: 'virus', cooldownMs: 15000, hint: '7 秒只出現病毒' },
    boss: { name: '大魔王', kind: 'trick', cooldownMs: 15000, hint: '要連點很多下' },
    quake: { name: '地震', kind: 'trick', cooldownMs: 12000, hint: '棋盤搖 4 秒' },
    bubbles: { name: '泡泡', kind: 'trick', cooldownMs: 12000, hint: '先戳破才打得到' },
    double: { name: '雙倍分數', kind: 'help', cooldownMs: 20000, hint: '6 秒分數 ×2' }
  };

  var MODES = ['manual', 'auto'];

  /* 病毒入侵最後幾秒不再有新病毒、要全部消滅才結束（要和 engine.js 的 INVASION_LAST_MS 一致）。
     孩子的手機回報的 inv 在入侵中至少是 1，所以 inv ≤ 這個數 = 最後階段 */
  var INVASION_LAST_S = 2;
  function invasionEnding(state) {
    return !!(state && state.inv && state.inv <= INVASION_LAST_S);
  }

  /* 孩子的手機收到不能做的指令時回的原因 → 家長看到的話 */
  var REASONS = {
    'not-playing': '孩子現在不在遊戲中',
    busy: '那個洞已經有角色了',
    locked: '那個洞還在維修中',
    boss: '大魔王在場，等它離開再放',
    invasion: '病毒入侵中，只能放病毒',
    'inv-ending': '病毒入侵快結束了，不能再放',
    'no-invasion': '病毒只能在「病毒入侵」時放',
    active: '這個事件正在進行中',
    'too-late': '這回合剩下的時間不夠了',
    auto: '現在是自動模式，切到「我來放」才能放',
    bad: '沒辦法執行'
  };

  /* 網址裡的代碼：/games/1234/…（Vercel 改寫到真正的頁面）；本機開發可用 ?code=1234 */
  function codeFromLocation(loc) {
    var m = /^\/games\/(\d{4})(?:\/|$)/.exec(loc.pathname || '');
    if (m) return m[1];
    var q = /[?&]code=(\d{4})(?:&|$)/.exec(loc.search || '');
    return q ? q[1] : null;
  }

  function joinPath(code) { return '/games/' + code + '/'; }
  function gamePath(code, game) { return '/games/' + code + '/' + game + '/'; }

  /* 家長建立房間：只放遊戲需要的年齡（決定速度），不放暱稱等個人資料 */
  function newRoom(profile, uid) {
    return {
      v: 1,
      code: String(profile.code),
      age: Math.min(18, Math.max(0, Number(profile.age) || 0)),
      parentUid: uid,
      childUid: null,
      mode: 'manual',
      game: null,
      request: null,
      expiresAt: Number(profile.expiresAt)
    };
  }

  function roomUsable(room, now) {
    return !!room && Number(room.expiresAt) > (now === undefined ? Date.now() : now);
  }

  /* 這支手機在房間裡的身分 */
  function roleOf(room, uid) {
    if (!room) return 'none';
    if (room.parentUid === uid) return 'parent';
    if (room.childUid === uid) return 'child';
    return room.childUid ? 'taken' : 'free';
  }

  function gameById(id) {
    for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i];
    return null;
  }

  /* 指令的形狀（孩子的手機執行前再檢查一次；伺服器規則也會檢查） */
  function validCmd(c) {
    if (!c || typeof c !== 'object') return false;
    if (c.t === 'place') {
      return c.h === Math.floor(c.h) && c.h >= 0 && c.h <= 5 &&
        PLACEABLE.indexOf(c.c) !== -1 && COATS.indexOf(c.v) !== -1;
    }
    if (c.t === 'event') return Object.prototype.hasOwnProperty.call(EVENTS, c.e);
    return false;
  }

  function reasonText(why) { return REASONS[why] || REASONS.bad; }

  /* 連線失敗的原因：伺服器拒絕（規則沒發布、匿名登入沒開）不是家長的網路問題，
     不能叫他們去檢查 wifi；其餘（離線、gstatic 載不到）才是網路 */
  var SETUP_CODES = ['permission-denied', 'auth/operation-not-allowed',
    'auth/admin-restricted-operation', 'auth/configuration-not-found'];

  function failureText(err) {
    if (err && SETUP_CODES.indexOf(err.code) !== -1) {
      return { kind: 'setup', title: '雙機暫時不能用',
        body: '不是手機網路的問題，是網站這邊的設定。請先玩單機遊戲，我們會盡快修好。' };
    }
    return { kind: 'offline', title: '連不上網路', body: '請確認手機有網路，再重新整理這一頁。' };
  }

  /* Firestore 的監聽一出錯就停了（斷網時它會自己重連，不會走到這裡） */
  var LISTEN_LOST = '連線中斷了，請重新整理這一頁';

  /* 家長看到的一句話：孩子現在在做什麼 */
  function childStatus(state, stale) {
    if (!state) return { tone: 'wait', text: '等孩子打開打地鼠…' };
    if (stale) return { tone: 'warn', text: '孩子的手機好像斷線了，請確認它還開著遊戲' };
    if (state.view === 'intro') return { tone: 'wait', text: '孩子在開始畫面，請他按「開始遊戲」' };
    if (state.view === 'quiz') return { tone: 'wait', text: '孩子正在挑戰小知識' };
    if (state.view === 'summary') return { tone: 'wait', text: '第 ' + state.round + ' 回合結束，孩子正在看成績' };
    if (state.teach) return { tone: 'wait', text: '孩子正在看「病毒入侵」的教學' };
    if (!state.running) return { tone: 'wait', text: '孩子按了暫停' };
    return { tone: 'live', text: '遊戲中' };
  }

  var AnxinDuo = {
    GAMES: GAMES,
    PLACEABLE: PLACEABLE,
    COATS: COATS,
    CHAR_NAMES: CHAR_NAMES,
    COAT_NAMES: COAT_NAMES,
    CHAR_FROM: CHAR_FROM,
    LINE_LEN: LINE_LEN,
    coatChance: coatChance,
    refillLine: refillLine,
    EVENTS: EVENTS,
    MODES: MODES,
    INVASION_LAST_S: INVASION_LAST_S,
    invasionEnding: invasionEnding,
    REASONS: REASONS,
    STALE_MS: 12000,       /* 這麼久沒收到孩子手機的狀態，就提醒家長可能斷線 */
    HEARTBEAT_MS: 5000,    /* 孩子的手機至少這麼常回報一次（就算畫面沒變） */
    STATE_THROTTLE_MS: 600, /* 狀態寫入的最短間隔（Firestore 單一文件每秒約 1 次寫入） */
    codeFromLocation: codeFromLocation,
    joinPath: joinPath,
    gamePath: gamePath,
    newRoom: newRoom,
    roomUsable: roomUsable,
    roleOf: roleOf,
    gameById: gameById,
    validCmd: validCmd,
    reasonText: reasonText,
    failureText: failureText,
    LISTEN_LOST: LISTEN_LOST,
    childStatus: childStatus
  };

  root.AnxinDuo = AnxinDuo;
  if (typeof module !== 'undefined' && module.exports) module.exports = AnxinDuo;
})(typeof window !== 'undefined' ? window : globalThis);
