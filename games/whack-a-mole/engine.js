/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 打地鼠（單機）遊戲引擎
   純邏輯、不碰 DOM：出現頻率、角色權重、收藏階級、鍍層、升級、題庫挑選、存檔。
   所有可調整的數字都集中在 CONFIG。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var CHARACTERS = [
    { id: 'tourniquet', name: '止血帶', points: 100 },
    { id: 'swab', name: '酒精棉片', points: 100 },
    { id: 'syringe', name: '針筒', points: 100 },
    /* 病毒要用酒精棉片擦掉，不能直接點 */
    { id: 'virus', name: '病毒', points: 200, wipe: true }
  ];

  var CONFIG = {
    ROUND_MS: 30000,
    ROUNDS: 6,              /* 六回合之後進入無限模式 */
    ROUND_CAP: 10,          /* 無限模式的難度到第 10 回合就不再上升 */

    /* 出現頻率的下限：I(t) 在每回合開頭是 0，沒有下限會空等好幾秒 */
    MIN_RATE: 0.6,          /* 每秒至少 0.6 次（最長間隔約 1.7 秒） */
    MIN_INTERVAL_MS: 250,

    HOLES_TOTAL: 6,
    HOLES_START: 4,         /* 另外兩個「維修中」，靠分數升級打開 */

    /* 角色停留在洞外的時間 */
    UP_MS_BASE: 1400,
    UP_MS_PER_ROUND: 60,    /* 每回合縮短 60ms */
    UP_MS_MIN: 800,
    VIRUS_UP_FACTOR: 1.7,   /* 病毒要拖曳，給久一點 */

    /* 收藏：點擊次數達到門檻 → 可以挑戰小知識；答對才真的升級 */
    TIERS: [10, 50, 100],
    MAX_LEVEL: 3,

    /* 出現權重 ∝ max(100 − C_x, 10)，每升級一次再 +5% */
    WEIGHT_CEIL: 100,
    WEIGHT_FLOOR: 10,
    UPGRADE_WEIGHT_BONUS: 0.05,

    /* 鍍層：銀／金 分數高但停留短；鐵 停留長但要打好幾下 */
    VARIANTS: {
      normal: { points: 1, up: 1, hp: 1 },
      silver: { points: 1.5, up: 0.75, hp: 1 },
      gold: { points: 2, up: 0.6, hp: 1 },
      iron: { points: 2, up: 1.6, hp: 3 }
    },
    /* 依收藏等級解鎖：Lv1 銀、Lv2 金、Lv3 鐵（沒抽中就是一般） */
    VARIANT_ODDS: [
      {},
      { silver: 0.3 },
      { silver: 0.2, gold: 0.2 },
      { silver: 0.15, gold: 0.15, iron: 0.2 }
    ],

    /* 分數獎勵：累積總分達到門檻就自動解鎖（與收藏「達門檻」的規則相同）。
       門檻依模擬調整：全打中的玩家大約「每回合解鎖一項」，到第 6 回合全部解鎖；
       一般小朋友打不到全部，會延續到無限模式。 */
    UNLOCKS: {
      stay: { label: '停留更久', start: 1, stages: [{ at: 1500, value: 1.2 }, { at: 10000, value: 1.4 }, { at: 24000, value: 1.6 }] },
      holes: { label: '更多洞', start: 4, stages: [{ at: 4000, value: 5 }, { at: 16000, value: 6 }] },
      hammer: { label: '更強的槌子', start: 1, stages: [{ at: 14000, value: 2 }, { at: 32000, value: 3 }] }
    },

    WIPE_COOLDOWN_MS: 250   /* 同一隻病毒連續擦拭的最短間隔 */
  };

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

  function spawnIntervalMs(tLeftSec, round) {
    var rate = Math.max(spawnRate(tLeftSec, round), CONFIG.MIN_RATE);
    return Math.max(CONFIG.MIN_INTERVAL_MS, 1000 / rate);
  }

  /* ─────────────────────────────────────────────────────────────
     收藏與權重
     ───────────────────────────────────────────────────────────── */

  function tierOf(clicks) {
    var n = 0;
    CONFIG.TIERS.forEach(function (t) { if (clicks >= t) n++; });
    return n;
  }

  function weightOf(clicks, level) {
    return Math.max(CONFIG.WEIGHT_CEIL - clicks, CONFIG.WEIGHT_FLOOR) *
      (1 + CONFIG.UPGRADE_WEIGHT_BONUS * level);
  }

  function pickCharacter(progress, rng) {
    var ws = CHARACTERS.map(function (c) {
      return weightOf(progress.clicks[c.id] || 0, progress.level[c.id] || 0);
    });
    var total = ws.reduce(function (a, b) { return a + b; }, 0);
    var r = rng() * total;
    for (var i = 0; i < ws.length; i++) {
      r -= ws[i];
      if (r < 0) return CHARACTERS[i].id;
    }
    return CHARACTERS[CHARACTERS.length - 1].id;
  }

  function pickVariant(level, rng) {
    var odds = CONFIG.VARIANT_ODDS[clamp(level, 0, CONFIG.MAX_LEVEL)];
    var r = rng();
    var acc = 0;
    var order = ['silver', 'gold', 'iron'];
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

  function upMs(charId, variant, round, stayFactor) {
    var r = clamp(round, 1, CONFIG.ROUND_CAP);
    var base = Math.max(CONFIG.UP_MS_MIN, CONFIG.UP_MS_BASE - CONFIG.UP_MS_PER_ROUND * (r - 1));
    if (BY_ID[charId].wipe) base *= CONFIG.VIRUS_UP_FACTOR;
    return Math.round(base * CONFIG.VARIANTS[variant].up * (stayFactor || 1));
  }

  function pointsFor(charId, variant) {
    return Math.round(BY_ID[charId].points * CONFIG.VARIANTS[variant].points);
  }

  function maxHp(variant) {
    return CONFIG.VARIANTS[variant].hp;
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

  function nextQuiz(progress, bank, band) {
    if (progress.pending) {
      var q = questionById(bank, progress.pending.qid);
      if (q) return { character: progress.pending.character, question: q };
    }
    var list = eligible(progress);
    if (!list.length) return null;
    var charId = list[0];
    var pool = questionsFor(bank, charId, band);
    if (!pool.length) return null;
    var target = (progress.level[charId] || 0) + 1;
    return { character: charId, question: pool[Math.min(target, pool.length) - 1] };
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
      v: 1, code: code, clicks: zeroMap(), level: zeroMap(),
      pending: null, totalPoints: 0, bestScore: 0, bestRound: 0
    };
  }

  function loadProgress(storage, code) {
    try {
      var p = JSON.parse(storage.getItem(STORE_KEY) || 'null');
      var ok = p && p.v === 1 && p.code === code && p.clicks && p.level &&
        typeof p.totalPoints === 'number';
      if (!ok) return newProgress(code);
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
    pickVariant: pickVariant,
    eligible: eligible,
    upMs: upMs,
    pointsFor: pointsFor,
    maxHp: maxHp,
    unlocks: unlocks,
    newlyUnlocked: newlyUnlocked,
    nextUnlock: nextUnlock,
    ageBand: ageBand,
    questionsFor: questionsFor,
    questionById: questionById,
    nextQuiz: nextQuiz,
    isCorrect: isCorrect,
    newProgress: newProgress,
    loadProgress: loadProgress,
    saveProgress: saveProgress
  };

  root.WhackEngine = WhackEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = WhackEngine;
})(typeof window !== 'undefined' ? window : globalThis);
