/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 打地鼠（單機）遊戲引擎
   純邏輯、不碰 DOM：出現頻率、角色權重、收藏階級、鍍層、升級、題庫挑選、存檔。
   所有可調整的數字都集中在 CONFIG。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var CHARACTERS = [
    /* from：第幾回合開始出現。酒精棉片第 3 回合登場 */
    { id: 'tourniquet', name: '止血帶', points: 100, from: 1 },
    { id: 'swab', name: '酒精棉片', points: 100, from: 3 },
    { id: 'syringe', name: '針筒', points: 100, from: 1 },
    /* 病毒不會混在一般角色裡：只在「病毒入侵」的 7 秒出現（第 3 回合起），要按住消毒 */
    { id: 'virus', name: '病毒', points: 200, wipe: true, from: 3 }
  ];

  var CONFIG = {
    ROUND_MS: 30000,
    ROUNDS: 6,              /* 六回合之後進入無限模式 */
    ROUND_CAP: 10,          /* 無限模式的難度到第 10 回合就不再上升 */

    /* 出現頻率的下限：I(t) 在每回合開頭是 0，沒有下限會空等好幾秒 */
    MIN_RATE: 0.6,          /* 每秒至少 0.6 次（年齡係數之前，最長間隔約 1.7 秒） */
    MIN_INTERVAL_MS: 250,

    /* 出現週期再乘上年齡係數 K / (1 + age^1.5)：年紀越小越慢 */
    SPAWN_AGE_K: 27,

    HOLES_TOTAL: 6,
    HOLES_START: 4,         /* 另外兩個「維修中」，靠分數升級打開 */

    /* 停留時間（秒）= STAY_BASE_S / age × (1 + level) ÷ 鍍層除數；病毒 ×2
       age < 1 以 1 計（6 / 0 會除以零）。
       原本是 3 / age：比小朋友「看到→點」的時間還短，只抓得到病毒、其他角色永遠升不了級。
       模擬 6 回合：3/age 命中 0–44%，6/age 命中約 70–79%，四個角色都能升級。 */
    STAY_BASE_S: 6,
    STAY_MIN_AGE: 1,
    VIRUS_STAY_FACTOR: 2,
    /* 下限：6/age 在 11 歲以上會短於「看到→點下去」的時間。
       模擬顯示 350ms 時 14、18 歲在第 1–2 回合命中率是 0%（一隻都點不到），
       要等到「停留更久」解鎖才有得玩；550ms 讓他們回到 65–78%，年紀小的完全不受影響。 */
    MIN_UP_MS: 550,
    /* 暖身：前兩回合停留久一點，讓小朋友一開始就有成功的感覺 */
    WARMUP_STAY: [1.3, 1.15],

    /* 收藏：點擊次數達到門檻 → 可以挑戰小知識；答對才真的升級 */
    TIERS: [10, 50, 100],
    MAX_LEVEL: 3,

    /* 出現權重 ∝ max(100 − C_x, 10)，每升級一次再 +5% */
    WEIGHT_CEIL: 100,
    WEIGHT_FLOOR: 10,
    UPGRADE_WEIGHT_BONUS: 0.05,

    /* 鍍層：div 是停留時間的除數（一般 1、銀 2）。
       鐵甲不在公式裡，沿用原規格「停留較久」：除以 0.625 = ×1.6，要打 3 下。
       金色大魔王也不在公式裡：要連點很多下，停留時間固定（見 BOSS_*）。
       病毒只在入侵時出現，入侵期間不會有大魔王（見 bossAllowed）。 */
    VARIANTS: {
      normal: { points: 1, div: 1, hp: 1 },
      silver: { points: 1.5, div: 2, hp: 1 },
      boss: { points: 5, boss: true },
      iron: { points: 2, div: 0.625, hp: 3 }
    },
    /* 依收藏等級解鎖：Lv1 銀、Lv2 大魔王、Lv3 鐵（沒抽中就是一般） */
    VARIANT_ODDS: [
      {},
      { silver: 0.3 },
      { silver: 0.2, boss: 0.2 },
      { silver: 0.15, boss: 0.15, iron: 0.2 }
    ],

    /* 金色大魔王：出現時其他角色先躲起來、暫停冒出新的，畫面上只剩它和血條。
       血量依年齡：原本 8／12／16／20，×1.6 → 13／19／26／32（太快打完不夠有魔王的感覺）。
       各年齡層最快連點約 2–3／4／5／6–7 下每秒，都是 5 秒左右打得完，還在 8 秒的停留時間內。
       停留 8 秒、不受年齡和等級影響（套 6/age ÷ 3 會短到點不完）；「停留更久」仍然有效。
       每回合最多一隻；剩下的時間、離病毒入侵的時間都要夠它整整停留，三者不會撞在一起。 */
    BOSS_HP: { little: 13, kid: 19, junior: 26, teen: 32 },
    BOSS_STAY_MS: 8000,
    BOSS_PER_ROUND: 1,
    BOSS_REST_MS: 700,      /* 大魔王跑掉後，等一下下才繼續冒出角色 */
    BOSS_DEFEAT_MS: 1000,   /* 打倒大魔王的動畫（閃光、暈頭轉向、轉圈縮小＋星星）；播完才繼續冒出角色 */

    /* 分數獎勵：累積總分達到門檻就自動解鎖（與收藏「達門檻」的規則相同）。
       門檻依模擬調整：全打中的玩家大約「每回合解鎖一項」，到第 6 回合全部解鎖；
       一般小朋友打不到全部，會延續到無限模式。 */
    UNLOCKS: {
      stay: { label: '停留更久', start: 1, stages: [{ at: 1500, value: 1.2 }, { at: 10000, value: 1.4 }, { at: 24000, value: 1.6 }] },
      holes: { label: '更多洞', start: 4, stages: [{ at: 4000, value: 5 }, { at: 16000, value: 6 }] },
      hammer: { label: '更強的槌子', start: 1, stages: [{ at: 14000, value: 2 }, { at: 32000, value: 3 }] }
    },

    /* 按住消毒：棉片要在病毒身上「擦滿」一段時間才會消失（累計，手指離開再回來會接著算）。
       一般 0.2 秒、銀色 0.375 秒、鐵甲 0.6 秒（原本 0.4／0.75／1.2 秒，減半：7 秒內要擦很多隻）。
       被擦的病毒不會跑掉（擦到一半逃走太挫折）。
       鍵盤：按住數字鍵＝按住手指；Enter／空白鍵（沒辦法按住）一次算擦 0.25 秒
       → 一般 1 下、銀色 2 下、鐵甲 3 下。 */
    WIPE_MS: { normal: 200, silver: 375, iron: 600 },
    WIPE_TAP_MS: 250,

    /* 病毒入侵：第 3 回合起，每回合在隨機時間（第 6–20 秒之間開始）突然入侵 7 秒，
       這 7 秒只出現病毒，冒出來的速度是平常的 2 倍；其他角色先躲起來。
       每一局第一次入侵先跳出教學（時間停住），之後就直接開始。
       入侵期間病毒跑掉不會中斷連擊（病毒很多、是加分時間）。
       最後 INVASION_LAST_MS 不再冒新病毒（家長也不能再放），場上的病毒也不會跑掉：
       全部消滅了，入侵才結束（回合時間到才會直接收掉）。 */
    INVASION_FROM_ROUND: 3,
    INVASION_MS: 7000,
    INVASION_LAST_MS: 2000,
    INVASION_START: [6000, 20000],
    INVASION_SPAWN_FACTOR: 0.5,
    INVASION_FIRST_MS: 300, /* 入侵開始後第一隻病毒多快出現 */
    INVASION_REST_MS: 600,  /* 入侵結束後，等一下下才繼續出現一般角色 */

    /* 雙機：家長遙控器的事件（遊戲時間，暫停就停）。
       地震：棋盤搖 4 秒；泡泡：3 個洞被泡泡蓋住 6 秒（先戳破才打得到）；雙倍：6 秒分數 ×2 */
    QUAKE_MS: 4000,
    BUBBLE_MS: 6000,
    BUBBLE_COUNT: 3,
    DOUBLE_MS: 6000,

    /* 連續抓到（沒有角色逃走）→ 分數加成；有角色逃走就歸零。倍率顯示在分數旁邊 */
    STREAK_TIERS: [{ at: 5, mult: 1.5 }, { at: 10, mult: 2 }],

    /* 回合獎牌：這一回合「抓到 ÷ 出現」的比例；出現太少（<3）不頒獎 */
    MEDALS: [
      { id: 'gold', name: '金牌', min: 0.8, bonus: 500 },
      { id: 'silver', name: '銀牌', min: 0.6, bonus: 300 },
      { id: 'bronze', name: '銅牌', min: 0.4, bonus: 100 }
    ],
    MEDAL_MIN_APPEARED: 3
  };

  /* 貼紙簿：拿到就一直留著（跟著暫時代碼） */
  var STICKERS = [
    { id: 'first', name: '第一次敲到', hint: '敲到任何一個角色', art: 'ch-tourniquet' },
    { id: 'virus', name: '病毒清潔員', hint: '用酒精棉片擦掉病毒', art: 'ch-virus' },
    { id: 'boss', name: '大魔王剋星', hint: '打倒一隻金色大魔王', art: 'icon-crown' },
    { id: 'streak10', name: '10 連擊', hint: '連續抓到 10 個都沒漏掉', art: 'icon-star' },
    { id: 'iron', name: '鐵甲剋星', hint: '打倒鐵甲角色', art: 'ch-syringe' },
    { id: 'quiz', name: '小博士', hint: '答對一題小知識', art: 'icon-bulb' },
    { id: 'gold', name: '金牌選手', hint: '一回合拿到金牌', art: 'icon-medal' },
    { id: 'round6', name: '六回合完成', hint: '玩完 6 個回合', art: 'icon-flag' }
  ];

  var BY_ID = {};
  CHARACTERS.forEach(function (c) { BY_ID[c.id] = c; });

  /* ─────────────────────────────────────────────────────────────
     出現頻率
     規格：I(t) = 1 − ((t − 10) / 20)²，t = 倒數剩餘秒數
           (1 + #round / 4) · I(t)
     照字面當成「週期」會在每回合開頭變成 0（每一幀都冒出角色），
     而且回合越後面越慢，和「倒數越快」相反。
     所以這裡把它當成「頻率」（每秒出現次數），週期 = 1 / 頻率。
     ───────────────────────────────────────────────────────────── */

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function intensity(tLeftSec) {
    var x = (clamp(tLeftSec, 0, CONFIG.ROUND_MS / 1000) - 10) / 20;
    return 1 - x * x;
  }

  function spawnRate(tLeftSec, round) {
    var r = clamp(round, 1, CONFIG.ROUND_CAP);
    return (1 + r / 4) * intensity(tLeftSec);
  }

  function ageFactor(age) {
    return CONFIG.SPAWN_AGE_K / (1 + Math.pow(Math.max(Number(age) || 0, 0), 1.5));
  }

  function spawnIntervalMs(tLeftSec, round, age) {
    var rate = Math.max(spawnRate(tLeftSec, round), CONFIG.MIN_RATE);
    return Math.max(CONFIG.MIN_INTERVAL_MS, 1000 / rate * ageFactor(age));
  }

  /* ─────────────────────────────────────────────────────────────
     收藏與權重
     ───────────────────────────────────────────────────────────── */

  function tierOf(clicks) {
    var n = 0;
    CONFIG.TIERS.forEach(function (t) { if (clicks >= t) n++; });
    return n;
  }

  /* 收藏只放打完過「它登場的那一回合」的角色：止血帶、針筒一開始就有；
     酒精棉片、病毒第 3 回合登場，第 3 回合打完（bestRound ≥ 3）才放進收藏 */
  function inCollection(progress, charId) {
    var from = BY_ID[charId].from || 1;
    return from <= 1 || (Number(progress.bestRound) || 0) >= from;
  }

  function weightOf(clicks, level) {
    return Math.max(CONFIG.WEIGHT_CEIL - clicks, CONFIG.WEIGHT_FLOOR) *
      (1 + CONFIG.UPGRADE_WEIGHT_BONUS * level);
  }

  /* 這一回合已經登場的角色 */
  function availableAt(round) {
    return CHARACTERS.filter(function (c) { return (c.from || 1) <= round; });
  }

  /* 平常冒出來的角色：已登場、而且不是病毒（病毒只在入侵時出現） */
  function pickCharacter(progress, rng, round) {
    var pool = availableAt(round || Infinity).filter(function (c) { return !c.wipe; });
    var ws = pool.map(function (c) {
      return weightOf(progress.clicks[c.id] || 0, progress.level[c.id] || 0);
    });
    var total = ws.reduce(function (a, b) { return a + b; }, 0);
    var r = rng() * total;
    for (var i = 0; i < ws.length; i++) {
      r -= ws[i];
      if (r < 0) return pool[i].id;
    }
    return pool[pool.length - 1].id;
  }

  function pickVariant(level, rng) {
    var odds = CONFIG.VARIANT_ODDS[clamp(level, 0, CONFIG.MAX_LEVEL)];
    var r = rng();
    var acc = 0;
    var order = ['silver', 'boss', 'iron'];
    for (var i = 0; i < order.length; i++) {
      acc += odds[order[i]] || 0;
      if (r < acc) return order[i];
    }
    return 'normal';
  }

  /* 已達門檻但還沒透過小知識升級的角色 */
  function eligible(progress) {
    return CHARACTERS.filter(function (c) {
      var lv = progress.level[c.id] || 0;
      return lv < CONFIG.MAX_LEVEL && tierOf(progress.clicks[c.id] || 0) > lv;
    }).map(function (c) { return c.id; });
  }

  /* ─────────────────────────────────────────────────────────────
     單次出現的參數
     ───────────────────────────────────────────────────────────── */

  /* 6 / age × (1 + level) ÷ 鍍層除數；病毒 ×2；再乘分數獎勵「停留更久」與前兩回合的暖身。
     大魔王固定 BOSS_STAY_MS × 停留更久 */
  function upMs(charId, variant, level, age, stayFactor, round) {
    if (CONFIG.VARIANTS[variant].boss) return Math.round(CONFIG.BOSS_STAY_MS * (stayFactor || 1));
    var a = Math.max(Number(age) || 0, CONFIG.STAY_MIN_AGE);
    var ms = 1000 * CONFIG.STAY_BASE_S / a * (1 + clamp(level || 0, 0, CONFIG.MAX_LEVEL)) /
      CONFIG.VARIANTS[variant].div;
    if (BY_ID[charId].wipe) ms *= CONFIG.VIRUS_STAY_FACTOR;
    ms *= stayFactor || 1;
    ms *= CONFIG.WARMUP_STAY[(round || 99) - 1] || 1;
    return Math.round(Math.max(CONFIG.MIN_UP_MS, ms));
  }

  function pointsFor(charId, variant) {
    return Math.round(BY_ID[charId].points * CONFIG.VARIANTS[variant].points);
  }

  /* 大魔王的血量依年齡 */
  function maxHp(variant, age) {
    if (!CONFIG.VARIANTS[variant].boss) return CONFIG.VARIANTS[variant].hp;
    return CONFIG.BOSS_HP[ageBand(Number(age) || 0)];
  }

  /* 這一回合還能不能放大魔王：每回合一隻，剩下的時間、離病毒入侵的時間都要夠它整整停留
     （msToInvasion：入侵中傳 0，這回合沒有或已經入侵過傳 Infinity） */
  function bossAllowed(bossesThisRound, msLeft, stayFactor, msToInvasion) {
    var stay = CONFIG.BOSS_STAY_MS * (stayFactor || 1);
    var gap = msToInvasion === undefined ? Infinity : msToInvasion;
    return bossesThisRound < CONFIG.BOSS_PER_ROUND && msLeft >= stay && gap >= stay;
  }

  /* ─────────────────────────────────────────────────────────────
     病毒入侵
     ───────────────────────────────────────────────────────────── */

  /* 這一回合幾毫秒時入侵；第 3 回合以前沒有（回傳 null） */
  function invasionAt(round, rng) {
    if (round < CONFIG.INVASION_FROM_ROUND) return null;
    var lo = CONFIG.INVASION_START[0];
    var hi = CONFIG.INVASION_START[1];
    return Math.round(lo + rng() * (hi - lo));
  }

  /* 入侵時病毒冒出來的間隔：平常的一半（仍有 MIN_INTERVAL_MS 下限） */
  function invasionSpawnMs(tLeftSec, round, age) {
    return Math.max(CONFIG.MIN_INTERVAL_MS, spawnIntervalMs(tLeftSec, round, age) * CONFIG.INVASION_SPAWN_FACTOR);
  }

  /* ─────────────────────────────────────────────────────────────
     分數獎勵
     ───────────────────────────────────────────────────────────── */

  function unlocks(totalPoints) {
    var out = {};
    Object.keys(CONFIG.UNLOCKS).forEach(function (k) {
      var u = CONFIG.UNLOCKS[k];
      var value = u.start;
      var stage = 0;
      u.stages.forEach(function (s, i) {
        if (totalPoints >= s.at) { value = s.value; stage = i + 1; }
      });
      out[k] = { value: value, stage: stage, maxStage: u.stages.length };
    });
    return out;
  }

  /* 這回合新解鎖的獎勵（回合前後比較） */
  function newlyUnlocked(beforeTotal, afterTotal) {
    var a = unlocks(beforeTotal);
    var b = unlocks(afterTotal);
    var list = [];
    Object.keys(b).forEach(function (k) {
      for (var s = a[k].stage + 1; s <= b[k].stage; s++) {
        list.push({ track: k, stage: s, value: CONFIG.UNLOCKS[k].stages[s - 1].value, label: CONFIG.UNLOCKS[k].label });
      }
    });
    return list;
  }

  /* 下一個獎勵還差多少分（全部解鎖則回傳 null） */
  function nextUnlock(totalPoints) {
    var best = null;
    Object.keys(CONFIG.UNLOCKS).forEach(function (k) {
      CONFIG.UNLOCKS[k].stages.forEach(function (s) {
        if (s.at > totalPoints && (!best || s.at < best.at)) {
          best = { track: k, at: s.at, label: CONFIG.UNLOCKS[k].label };
        }
      });
    });
    return best;
  }

  /* ─────────────────────────────────────────────────────────────
     小知識：難度依年齡分級；同一角色的第 L 次升級用該級的第 L 題
     答錯時保留同一題（pending），下一回合結束再挑戰
     ───────────────────────────────────────────────────────────── */

  function ageBand(age) {
    if (age < 6) return 'little';
    if (age < 9) return 'kid';
    if (age < 13) return 'junior';
    return 'teen';
  }

  function streakMult(streak) {
    var m = 1;
    CONFIG.STREAK_TIERS.forEach(function (t) { if (streak >= t.at) m = t.mult; });
    return m;
  }

  /* 病毒要擦滿幾毫秒才會消失 */
  function wipeMs(variant) {
    return CONFIG.WIPE_MS[variant] || CONFIG.WIPE_MS.normal;
  }

  function medalFor(caught, appeared) {
    if (appeared < CONFIG.MEDAL_MIN_APPEARED) return null;
    var rate = caught / appeared;
    for (var i = 0; i < CONFIG.MEDALS.length; i++) {
      if (rate >= CONFIG.MEDALS[i].min) return CONFIG.MEDALS[i];
    }
    return null;
  }

  /* 第一次拿到才回傳 true（介面用來顯示「新貼紙！」） */
  function earnSticker(progress, id) {
    if (!progress.stickers) progress.stickers = {};
    if (progress.stickers[id]) return false;
    progress.stickers[id] = Date.now();
    return true;
  }

  function questionsFor(bank, charId, band) {
    return bank.questions.filter(function (q) {
      return q.character === charId && q.band === band;
    });
  }

  function questionById(bank, id) {
    for (var i = 0; i < bank.questions.length; i++) {
      if (bank.questions[i].id === id) return bank.questions[i];
    }
    return null;
  }

  /* 答錯的角色要等「下一回合結束」才能再挑戰同一題：
     記下答錯當時已完成的回合數，roundsPlayed 超過它才解鎖 */
  function isLocked(progress, charId) {
    var f = progress.pending && progress.pending[charId];
    return !!f && progress.roundsPlayed <= f.round;
  }

  function canChallenge(progress, charId) {
    return eligible(progress).indexOf(charId) !== -1 && !isLocked(progress, charId);
  }

  function challengeFor(progress, bank, band, charId) {
    var f = progress.pending && progress.pending[charId];
    if (f) {
      var same = questionById(bank, f.qid);
      if (same) return { character: charId, question: same };
    }
    var pool = questionsFor(bank, charId, band);
    if (!pool.length) return null;
    var target = (progress.level[charId] || 0) + 1;
    return { character: charId, question: pool[Math.min(target, pool.length) - 1] };
  }

  function recordAnswer(progress, charId, qid, correct) {
    if (!progress.pending) progress.pending = {};
    if (correct) {
      progress.level[charId] = Math.min(CONFIG.MAX_LEVEL, (progress.level[charId] || 0) + 1);
      delete progress.pending[charId];
    } else {
      progress.pending[charId] = { qid: qid, round: progress.roundsPlayed };
    }
  }

  function isCorrect(question, choice) {
    return question.type === 'tf' ? choice === question.answer : Number(choice) === question.answer;
  }

  /* ─────────────────────────────────────────────────────────────
     存檔：跟著個人資料的暫時代碼走，換一位小朋友就從頭開始
     ───────────────────────────────────────────────────────────── */

  var STORE_KEY = 'anxin.wam.v1';

  function zeroMap() {
    var m = {};
    CHARACTERS.forEach(function (c) { m[c.id] = 0; });
    return m;
  }

  function newProgress(code) {
    return {
      v: 2, code: code, clicks: zeroMap(), level: zeroMap(),
      pending: {}, roundsPlayed: 0, stickers: {}, bestStreak: 0,
      totalPoints: 0, bestScore: 0, bestRound: 0
    };
  }

  function loadProgress(storage, code) {
    try {
      var p = JSON.parse(storage.getItem(STORE_KEY) || 'null');
      var ok = p && (p.v === 1 || p.v === 2) && p.code === code && p.clicks && p.level &&
        typeof p.totalPoints === 'number';
      if (!ok) return newProgress(code);
      if (p.v === 1) {
        /* v1 只有一筆 pending，而且答錯後隔一回合就能重考 → 直接開放 */
        var old = p.pending;
        p.pending = {};
        if (old && old.character && old.qid) p.pending[old.character] = { qid: old.qid, round: -1 };
        p.v = 2;
      }
      if (!p.pending || typeof p.pending !== 'object') p.pending = {};
      p.roundsPlayed = Math.max(0, Number(p.roundsPlayed) || 0);
      if (!p.stickers || typeof p.stickers !== 'object') p.stickers = {};
      p.bestStreak = Math.max(0, Number(p.bestStreak) || 0);
      CHARACTERS.forEach(function (c) {
        p.clicks[c.id] = Math.max(0, Number(p.clicks[c.id]) || 0);
        p.level[c.id] = clamp(Number(p.level[c.id]) || 0, 0, CONFIG.MAX_LEVEL);
      });
      return p;
    } catch (e) {
      return newProgress(code);
    }
  }

  function saveProgress(storage, progress) {
    try { storage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* 無痕模式：只是不會記住 */ }
  }

  var WhackEngine = {
    CHARACTERS: CHARACTERS,
    BY_ID: BY_ID,
    CONFIG: CONFIG,
    STORE_KEY: STORE_KEY,
    intensity: intensity,
    spawnRate: spawnRate,
    spawnIntervalMs: spawnIntervalMs,
    tierOf: tierOf,
    weightOf: weightOf,
    pickCharacter: pickCharacter,
    availableAt: availableAt,
    inCollection: inCollection,
    pickVariant: pickVariant,
    eligible: eligible,
    upMs: upMs,
    pointsFor: pointsFor,
    maxHp: maxHp,
    bossAllowed: bossAllowed,
    invasionAt: invasionAt,
    invasionSpawnMs: invasionSpawnMs,
    unlocks: unlocks,
    newlyUnlocked: newlyUnlocked,
    nextUnlock: nextUnlock,
    ageBand: ageBand,
    questionsFor: questionsFor,
    questionById: questionById,
    ageFactor: ageFactor,
    STICKERS: STICKERS,
    streakMult: streakMult,
    wipeMs: wipeMs,
    medalFor: medalFor,
    earnSticker: earnSticker,
    isLocked: isLocked,
    canChallenge: canChallenge,
    challengeFor: challengeFor,
    recordAnswer: recordAnswer,
    isCorrect: isCorrect,
    newProgress: newProgress,
    loadProgress: loadProgress,
    saveProgress: saveProgress
  };

  root.WhackEngine = WhackEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = WhackEngine;
})(typeof window !== 'undefined' ? window : globalThis);
