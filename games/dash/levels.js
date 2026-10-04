/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 膠囊衝衝衝：關卡
   關卡由一小段一小段「圖樣」組成，圖樣用文字畫（最下面一行是地板上那一格）：
     #  藥盒（方塊）     ^  針（朝上）     v  針（朝下，掛在天花板）
     o  彈簧墊           *  星星的位置（只有被選中的圖樣才真的放星星）
   固定關卡 = 固定種子 + 固定的段落表；無限挑戰 = 玩家的種子。
   測試裡的機器人會把每一個圖樣、每一關都實際跑過一遍。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var E = root.DashEngine;

  /* [id, 難度 1–3, 圖樣, 雙胞胎上半部的圖樣（省略 = 一模一樣）] */
  var RAW = {
    cube: [
      ['n1', 1, ['...*...', '.......', '...^...']],
      ['box', 1, ['...*...', '..###..']],
      ['n1n1', 1, ['..^....^...']],
      ['n1box', 1, ['..^....##...']],
      ['n2', 2, ['...*....', '........', '...^^...']],
      ['boxn', 2, ['..###..^...']],
      ['pit', 2, ['..##^^##...']],
      ['stairs', 2, ['....##....', '..####....']],
      ['pad3', 2, ['....*......', '...........', '...........', '...........', '..o^^^.....']],
      ['roof', 2, ['..######..', '..vvvvvv..', '..........', '..........']],
      ['n3', 3, ['....*.....', '..........', '...^^^....']],
      ['pit3', 3, ['..#^^^#....']],
      ['n2n2', 3, ['..^^....^^...']],
      ['padwall', 3, ['.....###...', '.....###...', '..o..###...']],
      ['tower', 3, ['......#*...', '....###....', '..#####....']]
    ],
    ship: [
      ['gm', 1, ['....#....', '....#....', '.........', '....*....', '.........', '....#....', '....#....']],
      ['gl', 1, ['....#....', '....#....', '....#....', '....#....', '.........', '....*....', '.........']],
      ['gh', 1, ['.........', '....*....', '.........', '....#....', '....#....', '....#....', '....#....']],
      ['beds', 1, ['..vvvvvv..', '..........', '..........', '..........', '..........', '..........', '..^^^^^^..']],
      ['slalom', 2, ['...#.........', '...#.........', '...#.........', '...#......#..', '..........#..', '..........#..', '..........#..']],
      ['tunnel', 2, ['..######..', '..######..', '..........', '.....*....', '..........', '..######..', '..######..']],
      ['zig', 3, ['...#.....#..', '...#........', '...#........', '...#.....#..', '.........#..', '.........#..', '...#.....#..']]
    ],
    ufo: [
      ['pm', 1, ['....#.....', '....#.....', '..........', '....*.....', '..........', '..........', '.^^^#^^^..']],
      ['pl', 1, ['....#.....', '....#.....', '....#.....', '..........', '....*.....', '..........', '.^^^.^^^..']],
      ['ph', 1, ['..........', '....*.....', '..........', '..........', '....#.....', '....#.....', '.^^^#^^^..']],
      ['bed', 2, ['..........', '..........', '..........', '.....*....', '..........', '..........', '.^^^^^^^^.']],
      ['pp', 2, ['....#.......', '....#....#..', '.........#..', '.........#..', '............', '............', '.^^^#^^^^#^.']],
      ['caves', 3, ['.vvvvvvvvv..', '............', '....#.......', '....#....*..', '............', '.........#..', '.^^^#^^^^#^.']]
    ],
    /* 雙胞胎：上下兩個世界大部分一樣，不一樣的東西會換顏色、加虛線框 */
    duo: [
      ['dn1', 1, ['...*...', '.......', '...^...']],
      ['dshift', 1, ['...^....'], ['....^...']],
      ['dbox', 1, ['..##...']],
      ['dsplit', 1, ['..^.......'], ['......^...']],
      ['dn2', 2, ['...*....', '........', '...^^...']],
      ['dextra', 2, ['...^....'], ['...^^...']],
      ['dboxn', 2, ['..##....'], ['..^.....']],
      ['dn1n1', 2, ['..^....^...'], ['..^...^....']],
      ['dmiss', 2, ['...^^...'], ['....^...']]
    ]
  };

  var KIND = { '#': 'block', '^': 'needle', v: 'needle', o: 'pad', '*': 'star' };

  function cells(art) {
    var m = {}, w = 0;
    art.forEach(function (row, r) {
      w = Math.max(w, row.length);
      for (var c = 0; c < row.length; c++) {
        if (row[c] !== '.') m[c + ',' + (art.length - 1 - r)] = row[c];
      }
    });
    return { m: m, w: w };
  }

  function toObjs(m, other) {
    return Object.keys(m).map(function (key) {
      var xy = key.split(','), ch = m[key];
      var o = { k: KIND[ch], x: +xy[0], y: +xy[1] };
      if (ch === '^') o.dir = 1;
      if (ch === 'v') o.dir = -1;
      if (other && ch !== '*' && other[key] !== ch) o.diff = true;
      return o;
    });
  }

  function parse(mode, row) {
    var a = cells(row[2]);
    var pat = { id: row[0], mode: mode, d: row[1], w: a.w, star: false, objs: null, top: null };
    if (mode === 'duo') {
      var bottom = {}, k;
      for (k in a.m) if (a.m[k] !== '*') bottom[k] = a.m[k];
      var t = row[3] ? cells(row[3]).m : bottom;
      pat.objs = toObjs(a.m, t);
      pat.top = toObjs(t, bottom);
    } else {
      pat.objs = toObjs(a.m, null);
    }
    pat.star = pat.objs.some(function (o) { return o.k === 'star'; });
    return pat;
  }

  var PATTERNS = {};
  Object.keys(RAW).forEach(function (mode) {
    PATTERNS[mode] = RAW[mode].map(function (row) { return parse(mode, row); });
  });

  function poolFor(mode) { return PATTERNS[mode === 'rot' ? 'cube' : mode]; }

  /* ─────────────────────────────────────────────────────────────
     一個段落：開頭留一段空地（換模式的傳送門後面），然後一個接一個放圖樣；
     難度從段落開頭的 d[0] 慢慢升到結尾的 d[1]。
     ───────────────────────────────────────────────────────────── */

  var RUNWAY = { cube: 6, rot: 6, ship: 6, ufo: 6, duo: 8 };
  var CP_EVERY = 45;        /* 段落裡每隔約 45 格插一支旗子（重來的地方） */
  var CP_RUNWAY = 3;        /* 旗子後面至少再空 3 格，重來時不會一出現就撞到 */

  function planSection(r, sec, x0, withCps) {
    var pool = poolFor(sec.mode), items = [], cps = [];
    var x = x0 + RUNWAY[sec.mode], end = x0 + sec.len, lastId = null, lastCp = x0;
    for (;;) {
      if (withCps && x - lastCp >= CP_EVERY) {
        cps.push(x);
        lastCp = x;
        x += CP_RUNWAY;
      }
      var prog = Math.min(1, (x - x0) / sec.len);
      var target = Math.round(sec.d[0] + (sec.d[1] - sec.d[0]) * prog);
      var cands = pool.filter(function (p) { return p.d <= target && p.id !== lastId; });
      var best = cands.filter(function (p) { return p.d === target; });
      var from = best.length && r() < 0.7 ? best : cands;
      var pick = from[Math.floor(r() * from.length)];
      if (x + pick.w > end && items.length) break;
      items.push({ pat: pick, x: x, star: false });
      x += pick.w + Math.floor(r() * 3);
      lastId = pick.id;
    }
    return { items: items, cps: cps, end: x };
  }

  function emitItem(world, it) {
    it.pat.objs.forEach(function (o) {
      if (o.k === 'star' && !it.star) return;
      E.addObject(world, { k: o.k, x: it.x + o.x, y: o.y, dir: o.dir, diff: o.diff });
    });
    if (it.pat.top) {
      it.pat.top.forEach(function (o) {
        E.addObject(world, { k: o.k, x: it.x + o.x, y: o.y, dir: o.dir, diff: o.diff }, true);
      });
    }
  }

  /* 三顆星星：放在關卡約 20%、50%、80% 附近、有星星位置的圖樣上 */
  function pickStars(items, length) {
    var used = [];
    [0.2, 0.5, 0.8].forEach(function (f) {
      var best = null, bd = Infinity;
      items.forEach(function (it) {
        if (!it.pat.star || used.indexOf(it) >= 0) return;
        var d = Math.abs(it.x - f * length);
        if (d < bd) { bd = d; best = it; }
      });
      if (best) { best.star = true; used.push(best); }
    });
    return used.length;
  }

  /* 大魔王關的星星放在打鬥裡：兩發水柱中間比較長的空檔，要跳起來才拿得到。
     空檔至少 1.8 秒，星星在正中間，跳起來的那 0.56 秒不會撞上水柱。 */
  function bossStars(w, portalX, shots, seed) {
    var B = E.CONFIG.BOSS, S = E.CONFIG.SPEED;
    var sched = E.bossSchedule(shots, seed);
    var reach = (B.DX - B.TIP - B.LEN / 2) / (S + B.SHOT_V);
    var arrive = sched.list.map(function (q) { return q.at + reach; });
    var gaps = [];
    for (var i = 0; i + 1 < arrive.length; i++) {
      if (arrive[i + 1] - arrive[i] >= 1.8) gaps.push((arrive[i] + arrive[i + 1]) / 2);
    }
    var n = 0;
    [0.15, 0.5, 0.85].forEach(function (f) {
      var t = gaps[Math.min(gaps.length - 1, Math.round(f * (gaps.length - 1)))];
      if (t == null || (n && w._lastStarT === t)) return;
      w._lastStarT = t;
      E.addObject(w, { k: 'star', x: Math.floor(portalX + S * t), y: 2 });
      n++;
    });
    delete w._lastStarT;
    return n;
  }

  /* ─────────────────────────────────────────────────────────────
     六個固定關卡（規格 a–f）
     ───────────────────────────────────────────────────────────── */

  var LEVELS = [
    {
      id: 1, name: '出發囉', sub: '跳跳＋體溫計火箭', theme: 'orange', seed: 1101,
      sections: [
        { mode: 'cube', len: 130, d: [1, 2] },
        { mode: 'ship', len: 70, d: [1, 1] },
        { mode: 'cube', len: 90, d: [1, 2] }
      ]
    },
    {
      id: 2, name: '快快跑', sub: '越跑越快', theme: 'yellow', seed: 2203,
      sections: [
        { mode: 'cube', len: 100, d: [1, 2] },
        { mode: 'cube', len: 90, d: [2, 2], speed: 1.2 },
        { mode: 'ship', len: 60, d: [1, 2] },
        { mode: 'cube', len: 80, d: [2, 3], speed: 1.35 }
      ]
    },
    {
      id: 3, name: '藥杯飛碟', sub: '點一下飛高一點', theme: 'sky', seed: 3307,
      sections: [
        { mode: 'cube', len: 30, d: [1, 1] },
        { mode: 'ufo', len: 200, d: [1, 2] },
        { mode: 'cube', len: 40, d: [1, 2] }
      ]
    },
    {
      id: 4, name: '雙胞胎', sub: '上下兩個一起跳', theme: 'mint', seed: 4409,
      sections: [
        { mode: 'cube', len: 25, d: [1, 1] },
        { mode: 'duo', len: 220, d: [1, 2] },
        { mode: 'cube', len: 30, d: [1, 1] }
      ]
    },
    {
      id: 5, name: '轉轉', sub: '畫面會轉來轉去', theme: 'pink', seed: 5503,
      sections: [
        { mode: 'rot', len: 260, d: [1, 2] }
      ]
    },
    {
      id: 6, name: '醫生的水槍', sub: '大魔王', theme: 'dusk', seed: 6607,
      sections: [
        { mode: 'cube', len: 60, d: [1, 1] },
        { mode: 'boss', shots: 12 }
      ]
    }
  ];

  function buildLevel(id) {
    var L = LEVELS[id - 1];
    if (!L) return null;
    var r = E.rng(L.seed), w = E.createWorld(), x = 0, items = [];
    w.level = L;
    w.theme = L.theme;
    L.sections.forEach(function (sec, i) {
      var x0 = x;
      if (sec.mode === 'boss') {
        E.addSection(w, { mode: 'boss', x0: x0, x1: Infinity });
        E.addTrigger(w, { k: 'portal', x: x0 + 1, mode: 'boss', shots: sec.shots, seed: L.seed });
        x = Infinity;
        return;
      }
      var s = E.addSection(w, { mode: sec.mode, x0: x0, x1: x0 });
      if (i > 0) {
        E.addTrigger(w, { k: 'portal', x: x0 + 1, mode: sec.mode });
        E.addTrigger(w, { k: 'check', x: x0 + 2 });
      }
      if (sec.speed) E.addTrigger(w, { k: 'speed', x: x0 + 1.5, mul: sec.speed });
      var plan = planSection(r, sec, x0, true);
      plan.cps.forEach(function (cx) { E.addTrigger(w, { k: 'check', x: cx }); });
      items = items.concat(plan.items);
      x = plan.end + 2;
      s.x1 = x;
    });
    if (isFinite(x)) pickStars(items, x);
    items.forEach(function (it) { emitItem(w, it); });
    /* 大魔王關：三顆星星都在打鬥裡 */
    if (!isFinite(x)) {
      var boss = L.sections[L.sections.length - 1];
      bossStars(w, w.bossAt, boss.shots, L.seed);
    }
    if (isFinite(x)) E.addTrigger(w, { k: 'goal', x: x + 4 });
    return w;
  }

  /* ─────────────────────────────────────────────────────────────
     無限挑戰（規格 g）：五種玩法 [跳跳, 火箭, 飛碟, 雙胞胎, 轉轉] 用種子洗牌，
     依序穿過傳送門；五種都玩完 → 大魔王 → 下一輪（再洗一次牌，更快一點）。
     ───────────────────────────────────────────────────────────── */

  var INF_MODES = ['cube', 'ship', 'ufo', 'duo', 'rot'];
  var INF = { LEN: 55, STAR_CHANCE: 0.35, SPEED_STEP: 0.06, SPEED_CAP: 1.3, SHOTS_BASE: 5, SHOTS_CAP: 12 };

  function addRound(w, st) {
    st.round++;
    var R = st.round;
    var d = R === 1 ? [1, 2] : R === 2 ? [2, 2] : [2, 3];
    var order = E.shuffle(INF_MODES, st.r);
    st.orders.push(order);
    E.addTrigger(w, { k: 'speed', x: st.x + 0.5, mul: Math.min(1 + INF.SPEED_STEP * (R - 1), INF.SPEED_CAP), round: R });
    order.forEach(function (mode) {
      var x0 = st.x;
      var s = E.addSection(w, { mode: mode, x0: x0, x1: x0, round: R });
      E.addTrigger(w, { k: 'portal', x: x0 + 1, mode: mode });
      var plan = planSection(st.r, { mode: mode, len: INF.LEN, d: d }, x0, false);
      plan.items.forEach(function (it) {
        it.star = it.pat.star && st.r() < INF.STAR_CHANCE;
        emitItem(w, it);
      });
      st.x = plan.end + 2;
      s.x1 = st.x;
    });
    E.addSection(w, { mode: 'boss', x0: st.x, x1: Infinity, round: R });
    E.addTrigger(w, {
      k: 'portal', x: st.x + 1, mode: 'boss', round: R,
      shots: Math.min(INF.SHOTS_BASE + R, INF.SHOTS_CAP), seed: (st.seed + R * 7919) >>> 0
    });
  }

  function buildInfinity(seed) {
    var w = E.createWorld();
    w.endless = true;
    w.theme = 'orange';
    var st = { seed: seed >>> 0, r: E.rng(seed), round: 0, x: 10, orders: [] };
    w.inf = st;
    E.addSection(w, { mode: 'cube', x0: 0, x1: 10, round: 0 });
    addRound(w, st);
    /* 打完醫生 → 接上下一輪。機器人的分身共用同一個世界，同一輪只接一次 */
    w.onBossDone = function (run) {
      if (!run.boss || run.boss.round < st.round) return;
      var bossSec = w.sections[w.sections.length - 1];
      st.x = Math.ceil(run.x) + 10;
      bossSec.x1 = st.x;
      addRound(w, st);
    };
    return w;
  }

  function newSeed() { return 10000 + Math.floor(Math.random() * 90000); }

  var DashLevels = {
    PATTERNS: PATTERNS,
    LEVELS: LEVELS,
    INF_MODES: INF_MODES,
    INF: INF,
    RUNWAY: RUNWAY,
    parse: parse,
    planSection: planSection,
    buildLevel: buildLevel,
    buildInfinity: buildInfinity,
    newSeed: newSeed
  };

  root.DashLevels = DashLevels;
  if (typeof module !== 'undefined' && module.exports) module.exports = DashLevels;
})(typeof window !== 'undefined' ? window : globalThis);
