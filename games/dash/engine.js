/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 膠囊衝衝衝：遊戲引擎（純邏輯，不碰 DOM）
   世界以「格」為單位：x 往右、y 往上，地板頂面 y = 0。
   物理用固定步長（遊戲時間 1/120 秒）：同樣的輸入永遠得到同樣的結果，
   測試裡的機器人才證明得了每一關都過得去。
   年紀小 → 整個遊戲放慢（timeScale），跳躍的弧線以「格」來算完全不變，
   所以同一張地圖對每個年紀都一樣能過，只是反應時間比較多。
   所有可調整的數字都集中在 CONFIG。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var CONFIG = {
    DT: 1 / 120,
    MAX_REAL_DT: 0.1,         /* 切回分頁時不會一口氣跑好幾秒 */
    SPEED: 7.8,               /* 格／遊戲秒 */

    HALF: 0.43,               /* 碰方塊用的半徑（和畫出來的大小一樣） */
    HAZ: 0.30,                /* 碰針、水柱用的半徑：比看起來小，擦邊不算 */
    HAZ_PAD: 0,               /* 測試用：把危險物放大，證明每一關都有餘裕 */
    STEP_TOL: 0.22,           /* 撞到方塊邊緣時差一點點就自動踩上去 */
    EPS: 0.02,

    /* 小膠囊（跳跳）：往上的重力比較輕、往下的重力重 1.4 倍（像 Geometry Dash 一樣「咚」一下落地）。
       跳約 2.25 格高，平地上 0.49 秒落地 ≈ 3.8 格遠 */
    JUMP_V: 16.52,
    GRAVITY: 62,              /* 往上飛的時候 */
    FALL_GRAVITY: 86,         /* 往下掉的時候 */
    MAX_FALL: 26,
    COYOTE_S: 0.07,           /* 走出方塊邊緣後一小段時間還可以跳 */
    BUFFER_S: 0.12,           /* 落地前一點點按下去也算 */
    PAD_V: 22.55,             /* 彈簧墊：跳約 4.1 格高 */

    /* 體溫計火箭：按住往上、放開往下 */
    SHIP_UP: 46,
    SHIP_G: 40,
    SHIP_VMAX: 7.5,

    /* 藥杯飛碟：點一下往上跳一小段（像 Flappy Bird） */
    UFO_FLAP: 11.6,
    UFO_G: 46,
    UFO_VMAX: 13,

    CEIL: 7,                  /* 火箭、飛碟關的天花板 */

    /* 傳送門前後的「漏斗」：地板往上斜、天花板往下斜，只留門口那一段（2 格高）可以過。
       IN：門前斜坡長度；OUT：門後回到原本高度的長度；FLOOR：門口地板高度；GAP：門口高度；
       CUBE_CEIL：跳跳段落本來沒有天花板，漏斗的天花板從這個高度開始往下斜 */
    FUNNEL: { IN: 5, OUT: 4, NECK: 0.5, FLOOR: 1, GAP: 2, CUBE_CEIL: 5 },
    RESPAWN_Y: 3.5,           /* 火箭、飛碟從旗子重來時的高度 */

    /* 針：看起來的針尖在 0.8 格，真正會撞到的只到 0.5 格 */
    NEEDLE: { half: 0.12, base: 0.05, tip: 0.5 },
    PAD: { half: 0.3, h: 0.3 },
    STAR_R: 0.55,

    /* 轉轉關：每跳一次、每越過一根針，畫面轉 3 度；轉到 15 度就往回轉 */
    ROT_STEP: 3,
    ROT_MAX: 15,
    /* 轉轉關的坡度：畫面順時針轉（往右下）= 下坡變快、逆時針（往右上）= 上坡變慢。
       速度 × (1 + 角度 / 40)，限制在 0.8–1.4 之間；角度跟著畫面慢慢轉過去（每秒 40°） */
    ROT_SPEED_DIV: 40,
    ROT_SPEED_MIN: 0.8,
    ROT_SPEED_MAX: 1.4,
    ROT_EASE: 40,

    /* 年紀 < 門檻 → 速度倍率 */
    AGE_SPEED: [[6, 0.7], [8, 0.8], [10, 0.9], [13, 1], [99, 1.1]],
    /* 年紀越大越快：再乘上 √(年紀) ÷ 2（4 歲 ×1、9 歲 ×1.5、16 歲 ×2）；未滿 1 歲以 1 歲計，速度不會變成 0 */
    AGE_ACCEL_REF: 4,
    AGE_ACCEL_MIN_AGE: 1,

    /* 大魔王：醫生的水槍 */
    BOSS: {
      DX: 7.3,                /* 醫生在玩家前方幾格（直式手機也看得到） */
      TIP: 1.9,               /* 針筒尖端在醫生左邊幾格：水從這裡射出來 */
      SHOT_V: 4,              /* 水柱往左的速度（加上捲動，迎面約每秒 11 格） */
      LEN: 1.3,
      LOW: [0.05, 0.75],      /* 低的水柱：要跳 */
      HIGH: [1.1, 1.9],       /* 高的水柱：不要跳 */
      TELL_S: 1.0,            /* 先預告 1 秒才發射 */
      INTRO_S: 2.2,
      GAP: [1.6, 1.25],       /* 一招打完到下一招開始預告（第一階段、第二階段） */
      PAIR: { 'low,low': 0.8, 'low,high': 0.75, 'high,low': 0.62 },
      FIRST: ['low', 'low', 'high'],   /* 開場三發固定：先學會跳，再學會不要跳 */
      SHOTS: 12,
      OUTRO: 14,              /* 打完之後，終點在幾格外（醫生先舉白旗、滾走） */
      /* 打鬥的場地是起伏的小山丘：高 1.2 格、一個起伏 18 格（最陡約 12°）。
         瞄準的雷射和水柱都「貼著地面、離地固定高度」前進（低的在腳邊、高的在頭的高度），
         所以不管地形怎麼起伏，雷射不會插進山丘裡，要跳／不要跳的時機也和平地一樣。 */
      HILLS: { AMP: 1.2, WAVE: 18 }
    }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function overlap(a0, a1, b0, b1) { return a0 < b1 && b0 < a1; }
  function copy(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k]; return c; }

  /* 種子亂數（mulberry32）：同一個種子 → 同一張地圖 */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, r) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function ageBand(a) {
    var bands = CONFIG.AGE_SPEED;
    for (var i = 0; i < bands.length; i++) if (a < bands[i][0]) return bands[i][1];
    return 1;
  }

  function ageScale(age) {
    var a = Number(age);
    if (!isFinite(a)) a = 8;
    return ageBand(a) * Math.sqrt(Math.max(a, CONFIG.AGE_ACCEL_MIN_AGE) / CONFIG.AGE_ACCEL_REF);
  }

  /* 轉轉關：下坡快、上坡慢（用畫面實際轉到的角度） */
  function tiltScale(run) {
    if (run.mode !== 'rot') return 1;
    var C = CONFIG;
    return clamp(1 + run.rot.view / C.ROT_SPEED_DIV, C.ROT_SPEED_MIN, C.ROT_SPEED_MAX);
  }

  /* 跳跳、雙胞胎、轉轉、大魔王都是「跳跳」的物理 */
  function physMode(mode) { return mode === 'ship' || mode === 'ufo' ? mode : 'cube'; }

  /* ─────────────────────────────────────────────────────────────
     世界：物件依「第幾格」分欄放，碰撞只查附近幾欄
     雙胞胎關的上半部是另一個世界（topCols），畫的時候上下顛倒
     ───────────────────────────────────────────────────────────── */

  function createWorld() {
    return {
      sections: [], cols: {}, topCols: {}, triggers: [], funnels: [],
      starCount: 0, goalX: null, bossAt: null, endless: false, onBossDone: null
    };
  }

  function addSection(world, s) { world.sections.push(s); return s; }

  function addObject(world, o, top) {
    var cols = top ? world.topCols : world.cols;
    var c = Math.floor(o.x);
    (cols[c] || (cols[c] = [])).push(o);
    if (o.k === 'star' && o.id == null) o.id = world.starCount++;
    return o;
  }

  function addTrigger(world, g) {
    var tr = world.triggers, i = tr.length;
    while (i > 0 && tr[i - 1].x > g.x) i--;
    tr.splice(i, 0, g);
    if (g.k === 'goal') world.goalX = g.x;
    if (g.k === 'portal' && g.mode === 'boss' && world.bossAt == null && !world.endless) world.bossAt = g.x;
    return g;
  }

  /* 傳送門的漏斗：from / to 是前後兩段的玩法，決定斜坡從多高開始 */
  function addFunnel(world, px, from, to) {
    var F = CONFIG.FUNNEL;
    var high = function (m) { return physMode(m) === 'cube' ? F.CUBE_CEIL : CONFIG.CEIL; };
    var f = { px: px, x0: px - F.IN, x1: px + F.OUT, cIn: high(from), cOut: high(to) };
    world.funnels.push(f);
    world.funnels.sort(function (a, b) { return a.px - b.px; });
    return f;
  }

  function funnelAt(world, x) {
    var fs = world.funnels;
    for (var i = 0; i < fs.length; i++) {
      if (x < fs[i].x0) return null;
      if (x <= fs[i].x1) return fs[i];
    }
    return null;
  }

  /* 斜坡往門口靠近：0 → 1 */
  function funnelT(f, x) {
    var n = CONFIG.FUNNEL.NECK;
    if (x < f.px - n) return (x - f.x0) / (f.px - n - f.x0);
    if (x <= f.px + n) return 1;
    return (f.x1 - x) / (f.x1 - f.px - n);
  }

  /* 大魔王場地的山丘：從 x0 開始、在 x1 結束（都剛好在山谷，高度 0，接得起來） */
  function addHills(world, x0) {
    var h = { x0: x0, x1: Infinity };
    (world.hills || (world.hills = [])).push(h);
    return h;
  }

  /* 打完了：山丘在下一個山谷收尾，回傳收尾的位置 */
  function endHills(world, x) {
    var hs = world.hills || [], W = CONFIG.BOSS.HILLS.WAVE;
    var h = hs[hs.length - 1];
    if (!h || h.x1 !== Infinity) return x;
    h.x1 = h.x0 + Math.ceil(Math.max(0, x - h.x0) / W) * W;
    return h.x1;
  }

  function hillAt(world, x) {
    var hs = world.hills;
    if (!hs) return 0;
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (x >= h.x0 && x < h.x1) {
        var H = CONFIG.BOSS.HILLS;
        return H.AMP * (1 - Math.cos(2 * Math.PI * (x - h.x0) / H.WAVE)) / 2;
      }
    }
    return 0;
  }

  function floorAt(world, x) {
    var f = funnelAt(world, x);
    return f ? CONFIG.FUNNEL.FLOOR * clamp(funnelT(f, x), 0, 1) : hillAt(world, x);
  }

  function ceilAt(world, x) {
    var f = funnelAt(world, x), F = CONFIG.FUNNEL;
    if (!f) return Infinity;
    var far = x < f.px ? f.cIn : f.cOut;
    return far + (F.FLOOR + F.GAP - far) * clamp(funnelT(f, x), 0, 1);
  }

  /* 一個方框底下最高的地板、頭上最低的天花板（斜坡的轉角也要算） */
  function terrainUnder(world, x, H) {
    var hi = Math.max(floorAt(world, x - H), floorAt(world, x), floorAt(world, x + H));
    var lo = Math.min(ceilAt(world, x - H), ceilAt(world, x), ceilAt(world, x + H));
    var f = funnelAt(world, x - H) || funnelAt(world, x + H), n = CONFIG.FUNNEL.NECK;
    if (f) {
      [f.px - n, f.px + n].forEach(function (k) {
        if (k > x - H && k < x + H) { hi = Math.max(hi, floorAt(world, k)); lo = Math.min(lo, ceilAt(world, k)); }
      });
    }
    return { floor: hi, ceil: lo };
  }

  function sectionAt(world, x) {
    var s = world.sections;
    for (var i = s.length - 1; i >= 0; i--) if (x >= s[i].x0) return s[i];
    return s[0] || null;
  }

  function near(cols, x, r) {
    var out = [], c1 = Math.floor(x + r);
    for (var c = Math.floor(x - r); c <= c1; c++) {
      var l = cols[c];
      if (l) for (var i = 0; i < l.length; i++) out.push(l[i]);
    }
    return out;
  }

  /* ─────────────────────────────────────────────────────────────
     一局
     ───────────────────────────────────────────────────────────── */

  function newPlayer(y, grounded) {
    var h = y == null ? CONFIG.HALF : y;
    return { y: h, py: h, vy: 0, grounded: grounded !== false, coyote: 0, buffer: 0 };
  }

  function newRun(world, opt) {
    opt = opt || {};
    var first = world.sections[0];
    var run = {
      world: world, t: 0, x: 0, prevX: 0, mode: first ? first.mode : 'cube',
      p: newPlayer(), p2: null, ti: 0, speedMul: 1,
      baseScale: opt.timeScale || 1, acc: 0,
      dead: false, done: false, deaths: 0, got: {}, gotN: 0,
      rot: { angle: 0, dir: 1, view: 0 }, boss: null,
      checkpoints: opt.checkpoints !== false, cp: null,
      passCol: Math.floor(-1.5), ev: []
    };
    if (run.mode === 'duo') run.p2 = newPlayer();
    run.cp = snapshot(run, 0);
    return run;
  }

  function snapshot(run, x) {
    var b = run.boss;
    return {
      x: x, mode: run.mode, ti: run.ti, speedMul: run.speedMul,
      boss: b ? { bt: b.bt, tank: b.tank, next: b.next, cp2: b.cp2 } : null
    };
  }

  function cloneRun(r) {
    var c = copy(r);
    c.p = copy(r.p);
    c.p2 = r.p2 ? copy(r.p2) : null;
    c.got = copy(r.got);
    c.rot = copy(r.rot);
    if (r.boss) {
      c.boss = copy(r.boss);
      c.boss.shots = r.boss.shots.map(copy);
    }
    c.ev = [];
    return c;
  }

  function emit(run, type, data) {
    var e = data || {};
    e.type = type;
    run.ev.push(e);
    /* 轉轉關：跳一次、越過一根針 → 畫面轉 3 度 */
    if (run.mode === 'rot' && (type === 'jump' || type === 'pass')) {
      var R = run.rot, max = CONFIG.ROT_MAX;
      R.angle += CONFIG.ROT_STEP * R.dir;
      if (Math.abs(R.angle) >= max) { R.angle = clamp(R.angle, -max, max); R.dir = -R.dir; }
    }
  }

  function crash(run, why) {
    run.dead = true;
    emit(run, 'crash', { why: why, x: run.x, y: run.p.y });
    return false;
  }

  function setMode(run, mode) {
    var from = run.mode, P = run.p;
    run.mode = mode;
    if (physMode(mode) !== 'cube') { P.grounded = false; P.coyote = 0; P.vy *= 0.4; }
    if (mode === 'duo') {
      if (!run.p2) run.p2 = { y: P.y, py: P.y, vy: P.vy, grounded: P.grounded, coyote: 0, buffer: 0 };
    } else {
      run.p2 = null;
    }
    if (mode !== 'rot') { run.rot.angle = 0; run.rot.dir = 1; }
    if (mode !== 'boss') run.boss = null;
    emit(run, 'mode', { mode: mode, from: from });
  }

  function fireTriggers(run) {
    var tr = run.world.triggers;
    while (run.ti < tr.length && tr[run.ti].x <= run.x) {
      var g = tr[run.ti++];
      if (g.k === 'portal') {
        setMode(run, g.mode);
        if (g.mode === 'boss') startBoss(run, g);
      } else if (g.k === 'speed') {
        run.speedMul = g.mul;
        emit(run, 'speed', { mul: g.mul, round: g.round });
      } else if (g.k === 'check') {
        if (run.checkpoints) run.cp = snapshot(run, g.x);
        emit(run, 'check', { x: g.x });
      } else if (g.k === 'goal') {
        run.done = true;
        emit(run, 'goal', { x: g.x });
        return;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     移動與碰撞（一個玩家；雙胞胎關兩個玩家吃同一個輸入）
     ───────────────────────────────────────────────────────────── */

  function movePlayer(run, P, cols, held, press, main) {
    var C = CONFIG, dt = C.DT, H = C.HALF, x = run.x, m = physMode(run.mode);
    var i, b, objs;
    P.py = P.y;

    if (m === 'cube') {
      if (press) P.buffer = C.BUFFER_S;
      if ((P.grounded || P.coyote > 0) && (P.buffer > 0 || held)) {
        P.vy = C.JUMP_V;
        P.grounded = false;
        P.coyote = 0;
        P.buffer = 0;
        if (main) emit(run, 'jump');
      } else if (!P.grounded) {
        P.vy = Math.max(P.vy - (P.vy > 0 ? C.GRAVITY : C.FALL_GRAVITY) * dt, -C.MAX_FALL);
      }
      P.buffer = Math.max(0, P.buffer - dt);
      P.coyote = Math.max(0, P.coyote - dt);
    } else if (m === 'ship') {
      P.vy = clamp(P.vy + (held ? C.SHIP_UP : -C.SHIP_G) * dt, -C.SHIP_VMAX, C.SHIP_VMAX);
    } else {
      if (press) {
        P.vy = C.UFO_FLAP;
        if (main) emit(run, 'flap');
      } else {
        P.vy = Math.max(P.vy - C.UFO_G * dt, -C.UFO_VMAX);
      }
    }

    objs = near(cols, x, 1.5);

    /* 1. 往前走一步之後，有沒有卡進方塊裡（側面撞到 → 撞到了） */
    for (var pass = 0; pass < 2; pass++) {
      var moved = false;
      for (i = 0; i < objs.length; i++) {
        b = objs[i];
        if (b.k !== 'block') continue;
        if (!overlap(x - H, x + H, b.x, b.x + 1) || !overlap(P.y - H + C.EPS, P.y + H - C.EPS, b.y, b.y + 1)) continue;
        if (pass === 0 && P.y - H >= b.y + 1 - C.STEP_TOL) {
          P.y = b.y + 1 + H;
          if (P.vy < 0) P.vy = 0;
          moved = true;
        } else if (pass === 0 && P.y + H <= b.y + C.STEP_TOL) {
          P.y = b.y - H;
          if (P.vy > 0) P.vy = 0;
          moved = true;
        } else {
          return crash(run, 'block');
        }
      }
      if (!moved) break;
    }

    /* 2. 上下移動：落在方塊上、頭頂到方塊、地板、天花板（傳送門的漏斗是斜的） */
    var ter = terrainUnder(run.world, x, H);
    var fl = ter.floor, cl = m === 'cube' ? ter.ceil : Math.min(ter.ceil, C.CEIL);
    if (cl - fl < 2 * H) return crash(run, 'squeeze');
    var oy = P.y, ground = false;
    P.y += P.vy * dt;
    if (P.y - H <= fl) {
      P.y = fl + H;
      if (P.vy < 0) P.vy = 0;
      ground = true;
    }
    if (P.y + H >= cl) {
      P.y = cl - H;
      if (P.vy > 0) P.vy = 0;
    }
    for (i = 0; i < objs.length; i++) {
      b = objs[i];
      if (b.k !== 'block') continue;
      if (!overlap(x - H, x + H, b.x, b.x + 1) || !overlap(P.y - H + 1e-9, P.y + H - 1e-9, b.y, b.y + 1)) continue;
      if (oy - H >= b.y + 1 - C.EPS) {
        P.y = b.y + 1 + H;
        if (P.vy < 0) P.vy = 0;
        ground = true;
      } else if (oy + H <= b.y + C.EPS) {
        P.y = b.y - H;
        if (P.vy > 0) P.vy = 0;
      } else {
        return crash(run, 'block');
      }
    }

    /* 3. 跳跳：腳下有沒有東西（走出方塊邊緣就開始掉） */
    if (m === 'cube') {
      if (!ground && P.vy <= 0) {
        /* 下坡：本來站在地上、地板只低了一點點 → 貼著斜坡走，不會一直「掉下去」 */
        if (P.y - H - fl <= (P.grounded ? 0.08 : 1e-6)) { P.y = fl + H; P.vy = 0; ground = true; }
        else {
          for (i = 0; i < objs.length; i++) {
            b = objs[i];
            if (b.k === 'block' && overlap(x - H, x + H, b.x, b.x + 1) && Math.abs(P.y - H - (b.y + 1)) < 1e-6) { ground = true; break; }
          }
        }
      }
      if (ground && !P.grounded && main) emit(run, 'land');
      if (!ground && P.grounded) P.coyote = C.COYOTE_S;
      P.grounded = ground;
    } else {
      P.grounded = false;
    }

    /* 4. 針、彈簧墊、星星 */
    var hz = C.HAZ, pad = C.HAZ_PAD, N = C.NEEDLE;
    for (i = 0; i < objs.length; i++) {
      b = objs[i];
      if (b.k === 'needle') {
        var cx = b.x + 0.5, y0, y1;
        if (b.dir < 0) { y0 = b.y + 1 - N.tip; y1 = b.y + 1 - N.base; }
        else { y0 = b.y + N.base; y1 = b.y + N.tip; }
        if (overlap(x - hz, x + hz, cx - N.half - pad, cx + N.half + pad) &&
          overlap(P.y - hz, P.y + hz, y0 - pad, y1 + pad)) return crash(run, 'needle');
      } else if (b.k === 'pad') {
        if (m === 'cube' && P.vy <= 0 &&
          overlap(x - H, x + H, b.x + 0.5 - C.PAD.half, b.x + 0.5 + C.PAD.half) &&
          overlap(P.y - H - 1e-6, P.y + H, b.y, b.y + C.PAD.h)) {
          P.vy = C.PAD_V;
          P.grounded = false;
          P.coyote = 0;
          if (main) emit(run, 'pad');
        }
      } else if (b.k === 'star' && main && !run.got[b.id]) {
        var dx = x - (b.x + 0.5), dy = P.y - (b.y + 0.5), R = C.STAR_R + hz;
        if (dx * dx + dy * dy < R * R) {
          run.got[b.id] = true;
          run.gotN++;
          emit(run, 'star', { id: b.id });
        }
      }
    }
    return true;
  }

  /* 轉轉關要知道「越過了一根針」 */
  function passNeedles(run) {
    var col = Math.floor(run.x - 1.5);
    for (var c = run.passCol + 1; c <= col; c++) {
      var l = run.world.cols[c];
      if (!l) continue;
      for (var i = 0; i < l.length; i++) {
        if (l[i].k === 'needle') { emit(run, 'pass', { col: c }); break; }
      }
    }
    run.passCol = col;
  }

  /* ─────────────────────────────────────────────────────────────
     大魔王：醫生的水槍
     每一發都先預告（TELL_S），醫生把針筒對準那一排，再射出水柱。
     水槍裡的水 = 血條；射完了就過關。死掉會回到這一階段的開頭。
     ───────────────────────────────────────────────────────────── */

  function sameRun(list, pat) {
    var seq = list.map(function (q) { return q.lane; }).concat(pat), run = 1, best = 1;
    for (var i = 1; i < seq.length; i++) { run = seq[i] === seq[i - 1] ? run + 1 : 1; if (run > best) best = run; }
    return best;
  }

  function bossSchedule(total, seed) {
    var B = CONFIG.BOSS, r = rng(seed || 1);
    var half = Math.ceil(total / 2), list = [], t = B.INTRO_S, n = 0, phase2At = null;
    var singles = [['low'], ['high']];
    var combos = [['low', 'low'], ['low', 'high'], ['high', 'low'], ['low'], ['high']];
    while (n < total) {
      var ph = n < half ? 1 : 2;
      if (ph === 2 && phase2At === null) phase2At = t;
      var pat, pool = ph === 1 ? singles : combos, tries = 0;
      if (n < B.FIRST.length) pat = [B.FIRST[n]];
      else {
        /* 同一排最多連續兩發：不然小朋友只學到一招 */
        do { pat = pool[Math.floor(r() * pool.length)]; }
        while (tries++ < 20 && sameRun(list, pat) > 2);
      }
      if (ph === 1 && n + pat.length > half) pat = pat.slice(0, half - n);
      if (n + pat.length > total) pat = pat.slice(0, total - n);
      var at = t + B.TELL_S;
      for (var k = 0; k < pat.length; k++) {
        if (k > 0) at += B.PAIR[pat[k - 1] + ',' + pat[k]];
        list.push({ lane: pat[k], at: at, phase: ph });
        n++;
      }
      t = at + B.GAP[ph - 1];
    }
    var last = list[list.length - 1].at;
    var travel = (B.DX - B.TIP + B.LEN) / (CONFIG.SPEED + B.SHOT_V);
    return { list: list, phase2At: phase2At == null ? Infinity : phase2At, end: last + travel + 0.4 };
  }

  function startBoss(run, g) {
    var total = g.shots || CONFIG.BOSS.SHOTS;
    var s = bossSchedule(total, g.seed);
    run.boss = {
      total: total, tank: total, list: s.list, next: 0, bt: 0, shots: [],
      phase2At: s.phase2At, end: s.end, cp2: false, state: 'fight', round: g.round || 0
    };
    if (run.checkpoints) run.cp = snapshot(run, g.x);
    emit(run, 'bossStart', { shots: total });
  }

  function laneMid(lane) { var l = lane === 'low' ? CONFIG.BOSS.LOW : CONFIG.BOSS.HIGH; return (l[0] + l[1]) / 2; }
  function laneHalf(lane) { var l = lane === 'low' ? CONFIG.BOSS.LOW : CONFIG.BOSS.HIGH; return (l[1] - l[0]) / 2; }

  /* 正在預告的那幾發（蓄力中）：frac = 針筒裡的水滿了多少 */
  function bossTells(b) {
    var out = [], T = CONFIG.BOSS.TELL_S;
    if (!b || b.state !== 'fight') return out;
    for (var i = b.next; i < b.list.length; i++) {
      var s = b.list[i];
      if (s.at - T > b.bt) break;
      out.push({ lane: s.lane, left: s.at - b.bt, frac: clamp(1 - (s.at - b.bt) / T, 0, 1) });
    }
    return out;
  }

  /* 點滴袋還剩多少（0–1）：每一發蓄力時，水從點滴袋慢慢流進針筒 */
  function bossBag(b) {
    if (!b) return 1;
    var T = CONFIG.BOSS.TELL_S, used = 0;
    for (var i = 0; i < b.list.length; i++) used += clamp((b.bt - (b.list[i].at - T)) / T, 0, 1);
    return clamp(1 - used / b.total, 0, 1);
  }

  /* 水柱（和雷射）的中心高度：那個位置的地面 + 這一排的高度 */
  function shotY(world, x, lane) {
    return floorAt(world, x) + laneMid(lane);
  }

  function stepBoss(run) {
    var b = run.boss, B = CONFIG.BOSS, C = CONFIG;
    if (b.state !== 'fight') return;
    b.bt += C.DT;
    if (!b.cp2 && b.bt >= b.phase2At) {
      b.cp2 = true;
      if (run.checkpoints) run.cp = snapshot(run, run.x);
      emit(run, 'bossPhase', { phase: 2 });
    }
    while (b.next < b.list.length && b.list[b.next].at <= b.bt) {
      var s = b.list[b.next++];
      b.shots.push({ lane: s.lane, x: run.x + B.DX - B.TIP - B.LEN / 2 });
      b.tank--;
      emit(run, 'shot', { lane: s.lane });
    }
    var P = run.p, hz = C.HAZ, pad = C.HAZ_PAD;
    for (var i = b.shots.length - 1; i >= 0; i--) {
      var w = b.shots[i];
      w.x -= B.SHOT_V * C.DT;
      if (w.x < run.x - 8) { b.shots.splice(i, 1); continue; }
      var yc = shotY(run.world, w.x, w.lane), hh = laneHalf(w.lane);
      if (overlap(run.x - hz, run.x + hz, w.x - B.LEN / 2 - pad, w.x + B.LEN / 2 + pad) &&
        overlap(P.y - hz, P.y + hz, yc - hh - pad, yc + hh + pad)) {
        crash(run, 'water');
        return;
      }
    }
    if (b.bt >= b.end) {
      b.state = 'done';
      b.doneX = run.x;
      emit(run, 'bossDone');
      if (run.world.onBossDone) run.world.onBossDone(run);
      else addTrigger(run.world, { k: 'goal', x: run.x + B.OUTRO });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     時間
     ───────────────────────────────────────────────────────────── */

  function step(run, held, press) {
    var R = run.rot, d = R.angle - R.view, e = CONFIG.ROT_EASE * CONFIG.DT;
    R.view = Math.abs(d) <= e ? R.angle : R.view + (d > 0 ? e : -e);
    var C = CONFIG;
    run.t += C.DT;
    run.prevX = run.x;
    run.x += C.SPEED * C.DT;
    fireTriggers(run);
    if (run.done) { run.p.py = run.p.y; return; }
    if (!movePlayer(run, run.p, run.world.cols, held, press, true)) return;
    if (run.p2 && !movePlayer(run, run.p2, run.world.topCols, held, press, false)) return;
    passNeedles(run);
    if (run.boss) stepBoss(run);
  }

  /* input = { held: 按住中, presses: 這一幀按了幾下 }；按下去只交給第一個步長 */
  function advance(run, realDt, input) {
    var C = CONFIG;
    run.ev = [];
    if (run.dead || run.done) return run.ev;
    run.acc += clamp(realDt, 0, C.MAX_REAL_DT) * run.baseScale * run.speedMul * tiltScale(run);
    var press = input.presses > 0;
    while (run.acc >= C.DT && !run.dead && !run.done) {
      step(run, !!input.held, press);
      if (press) { input.presses = 0; press = false; }
      run.acc -= C.DT;
    }
    return run.ev;
  }

  function respawn(run) {
    var cp = run.cp, C = CONFIG;
    var cube = physMode(cp.mode) === 'cube';
    run.x = run.prevX = cp.x;
    run.mode = cp.mode;
    run.ti = cp.ti;
    run.speedMul = cp.speedMul;
    var fy = floorAt(run.world, cp.x) + C.HALF;
    run.p = newPlayer(cube ? fy : C.RESPAWN_Y, cube);
    run.p2 = cp.mode === 'duo' ? newPlayer(fy) : null;
    run.rot = { angle: 0, dir: 1, view: 0 };
    if (cp.boss && run.boss) {
      run.boss.bt = cp.boss.bt;
      run.boss.tank = cp.boss.tank;
      run.boss.next = cp.boss.next;
      run.boss.cp2 = cp.boss.cp2;
      run.boss.shots = [];
      run.boss.state = 'fight';
    } else if (!cp.boss) {
      run.boss = null;
    }
    run.passCol = Math.floor(run.x - 1.5);
    run.acc = 0;
    run.dead = false;
    run.deaths++;
  }

  /* 進度 0–1；無限挑戰沒有終點 → null */
  function progress(run) {
    var w = run.world;
    if (w.endless) return null;
    if (run.done) return 1;
    if (w.bossAt != null) {
      var b = run.boss;
      if (b && b.state === 'done') return 0.98;
      if (b) return 0.4 + 0.58 * (1 - b.tank / b.total);
      return 0.4 * clamp(run.x / w.bossAt, 0, 1);
    }
    return w.goalX ? clamp(run.x / w.goalX, 0, 1) : 0;
  }

  /* ─────────────────────────────────────────────────────────────
     紀錄（跟著個人資料的暫時代碼走）
     ───────────────────────────────────────────────────────────── */

  var STORE_KEY = 'anxin.dash.v1';

  function emptyRecord(code) {
    return { v: 1, code: code, levels: {}, inf: { best: 0, round: 0, seed: null } };
  }

  function cleanLevel(l) {
    if (!l || typeof l !== 'object') return null;
    var stars = Array.isArray(l.stars) ? l.stars.slice(0, 3).map(Boolean) : [];
    while (stars.length < 3) stars.push(false);
    return {
      done: !!l.done, stars: stars,
      best: clamp(Number(l.best) || 0, 0, 1),
      tries: Math.max(0, Math.floor(Number(l.tries) || 0))
    };
  }

  function loadRecord(storage, code) {
    try {
      var d = JSON.parse(storage.getItem(STORE_KEY) || 'null');
      if (d && d.v === 1 && d.code === code && d.levels && typeof d.levels === 'object') {
        var r = emptyRecord(code);
        Object.keys(d.levels).forEach(function (k) {
          var l = cleanLevel(d.levels[k]);
          if (l && /^[1-9]$/.test(k)) r.levels[k] = l;
        });
        if (d.inf && typeof d.inf === 'object') {
          r.inf.best = Math.max(0, Math.floor(Number(d.inf.best) || 0));
          r.inf.round = Math.max(0, Math.floor(Number(d.inf.round) || 0));
          r.inf.seed = typeof d.inf.seed === 'number' ? d.inf.seed : null;
        }
        return r;
      }
    } catch (e) { /* 壞掉的紀錄 → 重新開始 */ }
    return emptyRecord(code);
  }

  function saveRecord(storage, rec) {
    try { storage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) { /* 忽略 */ }
  }

  /* res = { done, stars: [bool×3], progress, deaths } */
  function mergeLevel(rec, id, res) {
    var key = String(id);
    var l = rec.levels[key] || cleanLevel({});
    l.done = l.done || !!res.done;
    for (var i = 0; i < 3; i++) l.stars[i] = l.stars[i] || !!(res.stars && res.stars[i] && res.done);
    l.best = Math.max(l.best, clamp(res.progress || 0, 0, 1));
    l.tries += 1 + (res.deaths || 0);
    rec.levels[key] = l;
    return l;
  }

  function mergeInf(rec, res) {
    var better = res.dist > rec.inf.best;
    if (better) {
      rec.inf.best = res.dist;
      rec.inf.round = res.round;
      rec.inf.seed = res.seed;
    }
    return better;
  }

  var DashEngine = {
    CONFIG: CONFIG,
    STORE_KEY: STORE_KEY,
    rng: rng,
    shuffle: shuffle,
    ageScale: ageScale,
    tiltScale: tiltScale,
    physMode: physMode,
    createWorld: createWorld,
    addSection: addSection,
    addObject: addObject,
    addTrigger: addTrigger,
    sectionAt: sectionAt,
    addFunnel: addFunnel,
    funnelAt: funnelAt,
    floorAt: floorAt,
    ceilAt: ceilAt,
    newRun: newRun,
    cloneRun: cloneRun,
    step: step,
    advance: advance,
    respawn: respawn,
    progress: progress,
    bossSchedule: bossSchedule,
    bossTells: bossTells,
    bossBag: bossBag,
    shotY: shotY,
    laneMid: laneMid,
    addHills: addHills,
    endHills: endHills,
    emptyRecord: emptyRecord,
    loadRecord: loadRecord,
    saveRecord: saveRecord,
    mergeLevel: mergeLevel,
    mergeInf: mergeInf
  };

  root.DashEngine = DashEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = DashEngine;
})(typeof window !== 'undefined' ? window : globalThis);
