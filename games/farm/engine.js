/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 機器人農場：規則（window.FarmEngine）
   沒有 DOM，可以在 node 測試。所有可以調的數字都在 CONFIG。
   座標：8×8 格，i = 列 × 8 + 行；機器人的位置以「格」為單位，格子中心 = (行 + .5, 列 + .5)。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var N = 8;

  /* 地形：G 草地、W 小河、R 大石頭、S 碎石地、L 岩漿、B 火山岩地
     地區：F 草原（一開始就有）、R 小河邊、M 礦山、V 火山 */
  var MAP = [
    'RRSRLLBL',
    'SSSSBBLL',
    'RSRSBLBB',
    'SSRSBBBL',
    'GGGGGGWG',
    'GGGGGGWG',
    'GGGGGGWG',
    'GGGGGGWG'
  ];
  var REGION_MAP = [
    'MMMMVVVV',
    'MMMMVVVV',
    'MMMMVVVV',
    'MMMMVVVV',
    'FFFFFRRR',
    'FFFFFRRR',
    'FFFFFRRR',
    'FFFFFRRR'
  ];
  var REGION_KEY = { F: 'meadow', R: 'river', M: 'mountain', V: 'volcano' };
  var REGION_ORDER = ['meadow', 'river', 'mountain', 'volcano'];

  var CONFIG = {
    startCoins: 6,
    regions: {
      meadow:   { name: '草原', cost: null },
      river:    { name: '小河邊', cost: { coins: 150 } },
      mountain: { name: '礦山', cost: { coins: 600 } },
      volcano:  { name: '火山', cost: { coins: 3000, stone: 40 } }
    },
    /* grow 秒；value 每次收成的金幣；plant 種一格的錢（拆掉全退） */
    crops: {
      carrot: { name: '蘿蔔', grow: 5, value: 3, plant: 2, needs: null },
      corn:   { name: '玉米', grow: 9, value: 8, plant: 10, needs: 'river' },
      tomato: { name: '番茄', grow: 14, value: 15, plant: 30, needs: 'mountain' }
    },
    wetSpeed: 1.5,          /* 河邊（上下左右有水）的菜長得快 1.5 倍 */
    /* 建築：價錢 = base × grow^已經有的數量；floors 可以蓋的地形 */
    builds: {
      lighthouse: { name: '燈塔', coins: 50, stone: 0, grow: 1.45, max: 10, floors: 'GSB', needs: null },
      quarry:     { name: '採石場', coins: 250, stone: 0, grow: 1.5, max: 6, floors: 'S', needs: 'mountain' },
      pot:        { name: '湯鍋', coins: 400, stone: 20, grow: 1.6, max: 3, floors: 'G', needs: 'mountain' },
      barn:       { name: '倉庫', coins: 200, stone: 15, grow: 1.8, max: 4, floors: 'GSB', needs: 'mountain' },
      bank:       { name: '小豬銀行', coins: 1000, stone: 50, grow: 1, max: 1, floors: 'GSB', needs: 'mountain' },
      forge:      { name: '鍛造爐', coins: 1500, stone: 60, grow: 1, max: 1, floors: 'B', needs: 'volcano' },
      altar:      { name: '月光祭壇', coins: 1200, stone: 40, grow: 1, max: 1, floors: 'GSB', needs: 'volcano' }
    },
    robot: { coins: 20, grow: 1.55, max: 12, speed: 1.5, cap: 3, wait: 0.2 },
    quarry: { time: 10, cap: 12, oreChance: 0.1 },    /* 每 time ÷ 旁邊的大石頭數 秒挖一次 */
    pot: { cook: 6, cap: 4, bonus: 2 },                /* 湯 = 三種菜的價錢 × bonus */
    bank: {
      every: 5,
      levels: [
        { rate: 0.01, cap: 30, up: null },
        { rate: 0.02, cap: 200, up: { coins: 3000, stone: 100 } },
        { rate: 0.03, cap: 1500, up: { coins: 15000, stone: 300 } },
        { rate: 0.04, cap: 10000, up: { coins: 80000, stone: 800 } },
        { rate: 0.05, cap: 80000, up: { coins: 400000, stone: 2000 } }
      ]
    },
    altar: { stone: 30, ore: 3, grow: 1.6, max: 20, speed: 0.1 },  /* 每顆精靈寶珠：全部快 10%；過剩的石頭和金礦換 */
    /* 鍛造：time 是一格岩漿的秒數；旁邊每多一格岩漿就快一倍 */
    recipes: {
      boots:  { name: '火箭鞋', desc: '機器人跑快 1.5 倍', cost: { coins: 800, ore: 6 }, time: 40 },
      basket: { name: '大籃子', desc: '機器人一次拿 2 倍', cost: { coins: 1500, ore: 10 }, time: 60 },
      shovel: { name: '金鏟子', desc: '採石場挖 2 倍', cost: { coins: 2500, ore: 15 }, time: 80 },
      hoe:    { name: '彩虹神鋤', desc: '所有的菜和湯值 3 倍', cost: { coins: 20000, ore: 40, orbs: 3 }, time: 160,
                needs: ['boots', 'basket', 'shovel'] }
    },
    recipeOrder: ['boots', 'basket', 'shovel', 'hoe'],
    richGoals: [50000, 100000, 500000, 1e6, 5e6, 1e7, 5e7, 1e8]
  };

  var CROP_ORDER = ['carrot', 'corn', 'tomato'];

  /* ─────────────────────────────────────────────────────────────
     格子
     ───────────────────────────────────────────────────────────── */

  function col(i) { return i % N; }
  function row(i) { return (i / N) | 0; }
  function at(c, r) { return r * N + c; }
  function floorOf(i) { return MAP[row(i)].charAt(col(i)); }
  function regionOf(i) { return REGION_KEY[REGION_MAP[row(i)].charAt(col(i))]; }

  function around(i, diag) {
    var out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (!diag && dr && dc) continue;
        var c = col(i) + dc, r = row(i) + dr;
        if (c >= 0 && c < N && r >= 0 && r < N) out.push(at(c, r));
      }
    }
    return out;
  }

  var N8 = [], N4 = [], ROCKS = [], LAVA = [], WET = [];
  for (var t = 0; t < N * N; t++) {
    N8.push(around(t, true));
    N4.push(around(t, false));
  }
  for (t = 0; t < N * N; t++) {
    ROCKS.push(N8[t].filter(function (j) { return floorOf(j) === 'R'; }).length);
    LAVA.push(N8[t].filter(function (j) { return floorOf(j) === 'L'; }).length);
    WET.push(N4[t].some(function (j) { return floorOf(j) === 'W'; }));
  }

  function buildable(i) { return 'GSB'.indexOf(floorOf(i)) >= 0; }

  /* ─────────────────────────────────────────────────────────────
     狀態
     ───────────────────────────────────────────────────────────── */

  function newState() {
    var S = {
      v: 1,
      time: 0,
      seed: 20261112,
      coins: CONFIG.startCoins, stone: 0, ore: 0, orbs: 0,
      regions: { meadow: true, river: false, mountain: false, volcano: false },
      tiles: [],
      robots: [],
      tools: { boots: false, basket: false, shovel: false, hoe: false },
      stats: { earned: 0, harvests: 0, soups: 0, interest: 0, forged: 0 },
      ach: {},
      goal: 0,
      nextId: 1
    };
    for (var i = 0; i < N * N; i++) S.tiles.push(null);
    /* 一開始：倉庫在草原中間，旁邊四塊蘿蔔田 */
    S.tiles[at(2, 6)] = { k: 'barn', paid: null };
    [at(2, 5), at(1, 6), at(3, 6), at(2, 7)].forEach(function (j) {
      S.tiles[j] = { k: 'crop', crop: 'carrot', g: 0.35 + 0.15 * (j % 3), ready: 0, paid: { coins: 2 } };
    });
    prepare(S);
    return S;
  }

  /* 不存檔的部分：燈塔倍數、機器人預約、每秒收入 */
  function prepare(S) {
    S.claim = [];
    for (var i = 0; i < N * N; i++) S.claim.push(0);
    S.log = { sec: Math.floor(S.time), buckets: [] };
    for (i = 0; i < 30; i++) S.log.buckets.push(0);
    S.robots.forEach(function (R) { resetRobot(S, R); });
    layoutChanged(S);
  }

  function rand(S) {
    S.seed = (S.seed * 1103515245 + 12345) % 2147483648;
    return S.seed / 2147483648;
  }

  function count(S, k) {
    var n = 0;
    for (var i = 0; i < N * N; i++) if (S.tiles[i] && S.tiles[i].k === k) n++;
    return n;
  }

  function cropCount(S, crop) {
    var n = 0;
    for (var i = 0; i < N * N; i++) {
      var b = S.tiles[i];
      if (b && b.k === 'crop' && (!crop || b.crop === crop)) n++;
    }
    return n;
  }

  /* 燈塔：旁邊 8 格的菜和採石場，每一座燈塔 +1 倍 */
  function layoutChanged(S) {
    S.mult = [];
    for (var i = 0; i < N * N; i++) {
      var m = 1;
      N8[i].forEach(function (j) { if (S.tiles[j] && S.tiles[j].k === 'lighthouse') m++; });
      S.mult.push(m);
    }
    S.robots.forEach(function (R) {
      if (R.state === 'go' && !available(S, R.tgt, true)) retarget(S, R);
    });
  }

  function speed(S) { return 1 + CONFIG.altar.speed * S.orbs; }
  function robotCap(S) { return CONFIG.robot.cap * (S.tools.basket ? 2 : 1); }
  function robotSpeed(S) { return CONFIG.robot.speed * speed(S) * (S.tools.boots ? 1.5 : 1); }

  function cropValue(S, i) {
    var b = S.tiles[i];
    return CONFIG.crops[b.crop].value * S.mult[i] * (S.tools.hoe ? 3 : 1);
  }

  /* 每次收成多久：秒 */
  function cropTime(S, i) {
    var b = S.tiles[i];
    return CONFIG.crops[b.crop].grow / (speed(S) * (WET[i] ? CONFIG.wetSpeed : 1));
  }

  function quarryTime(S, i) {
    return CONFIG.quarry.time / (Math.max(1, ROCKS[i]) * speed(S));
  }

  function quarryYield(S, i) {
    return S.mult[i] * (S.tools.shovel ? 2 : 1);
  }

  /* ─────────────────────────────────────────────────────────────
     價錢
     ───────────────────────────────────────────────────────────── */

  function price(S, kind) {
    if (CONFIG.crops[kind]) return { coins: CONFIG.crops[kind].plant, stone: 0 };
    if (kind === 'robot') {
      var r = CONFIG.robot;
      return { coins: Math.round(r.coins * Math.pow(r.grow, S.robots.length)), stone: 0 };
    }
    var c = CONFIG.builds[kind];
    var f = Math.pow(c.grow, count(S, kind));
    return { coins: Math.round(c.coins * f), stone: Math.round(c.stone * f) };
  }

  function orbPrice(S) {
    var a = CONFIG.altar;
    var f = Math.pow(a.grow, S.orbs);
    return { stone: Math.round(a.stone * f), ore: Math.round(a.ore * f) };
  }

  function bankUpPrice(S) {
    var b = findOne(S, 'bank');
    if (b < 0) return null;
    var next = CONFIG.bank.levels[S.tiles[b].level];
    return next ? next.up : null;
  }

  function afford(S, cost) {
    if (!cost) return true;
    return (S.coins >= (cost.coins || 0)) && (S.stone >= (cost.stone || 0)) &&
      (S.ore >= (cost.ore || 0)) && (S.orbs >= (cost.orbs || 0));
  }

  function pay(S, cost) {
    if (!cost) return;
    S.coins -= cost.coins || 0;
    S.stone -= cost.stone || 0;
    S.ore -= cost.ore || 0;
    S.orbs -= cost.orbs || 0;
  }

  function refund(S, cost) {
    if (!cost) return;
    S.coins += cost.coins || 0;
    S.stone += cost.stone || 0;
  }

  function addCoins(S, n) {
    if (!(n > 0)) return;
    S.coins += n;
    S.stats.earned += n;
    logTick(S);
    S.log.buckets[S.log.sec % 30] += n;
  }

  /* 最近 30 秒的收入 → 每分鐘 */
  function logTick(S) {
    var sec = Math.floor(S.time);
    while (S.log.sec < sec) {
      S.log.sec++;
      S.log.buckets[S.log.sec % 30] = 0;
      if (sec - S.log.sec > 30) S.log.sec = sec - 30;
    }
  }

  function rate(S) {
    logTick(S);
    var sum = 0;
    for (var i = 0; i < 30; i++) if (i !== S.log.sec % 30) sum += S.log.buckets[i];
    return sum * 60 / 29;
  }

  function findOne(S, k) {
    for (var i = 0; i < N * N; i++) if (S.tiles[i] && S.tiles[i].k === k) return i;
    return -1;
  }

  /* ─────────────────────────────────────────────────────────────
     能不能用：工具、地區
     ───────────────────────────────────────────────────────────── */

  function kindReady(S, kind) {
    var c = CONFIG.crops[kind] || CONFIG.builds[kind];
    if (kind === 'robot') return true;
    if (!c) return false;
    return !c.needs || !!S.regions[c.needs];
  }

  /* 田上面可以直接蓋房子、或改種別的菜：原本的菜先收起來、種子錢退回來 */
  function replacing(S, kind, i) {
    var b = S.tiles[i];
    return !!(b && b.k === 'crop' && b.crop !== kind);
  }

  /* why：locked 還沒打開 · busy 已經有東西 · floor 地形不對 · rock 旁邊沒有大石頭 ·
          lava 旁邊沒有岩漿 · max 蓋滿了 · soon 還不能用 · money 錢不夠 */
  function canPlace(S, kind, i, ignoreMoney) {
    if (!kindReady(S, kind)) return 'soon';
    if (!S.regions[regionOf(i)]) return 'locked';
    if (S.tiles[i] && !replacing(S, kind, i)) return 'busy';
    var isCrop = !!CONFIG.crops[kind];
    var floors = isCrop ? 'G' : CONFIG.builds[kind].floors;
    if (floors.indexOf(floorOf(i)) < 0) return 'floor';
    if (kind === 'quarry' && !ROCKS[i]) return 'rock';
    if (kind === 'forge' && !LAVA[i]) return 'lava';
    if (!isCrop && count(S, kind) >= CONFIG.builds[kind].max) return 'max';
    if (!ignoreMoney) {
      var cost = price(S, kind);
      var back = replacing(S, kind, i) ? S.tiles[i].paid : null;
      if (back) cost = { coins: cost.coins - (back.coins || 0), stone: cost.stone - (back.stone || 0) };
      if (!afford(S, cost)) return 'money';
    }
    return null;
  }

  function place(S, kind, i, ev) {
    var why = canPlace(S, kind, i);
    if (why) return why;
    if (S.tiles[i]) remove(S, i, ev);
    var cost = price(S, kind);
    pay(S, cost);
    var b;
    if (CONFIG.crops[kind]) b = { k: 'crop', crop: kind, g: 0, ready: 0 };
    else if (kind === 'quarry') b = { k: 'quarry', t: 0, items: [] };
    else if (kind === 'pot') b = { k: 'pot', has: {}, hv: 0, cook: -1, val: 0, bowls: [] };
    else if (kind === 'forge') b = { k: 'forge', job: null, t: 0 };
    else if (kind === 'bank') b = { k: 'bank', level: 1, t: 0 };
    else b = { k: kind };
    b.paid = cost;
    S.tiles[i] = b;
    S.claim[i] = 0;
    layoutChanged(S);
    if (ev) ev.push({ t: 'place', i: i, kind: kind });
    return null;
  }

  /* 拆掉：先把上面的東西收起來，再全額退錢。最後一間倉庫不能拆（機器人要有地方放） */
  function canRemove(S, i) {
    var b = S.tiles[i];
    if (!b) return 'empty';
    if (b.k === 'barn' && count(S, 'barn') <= 1) return 'lastBarn';
    if (b.k === 'forge' && b.job) return 'forging';
    return null;
  }

  function remove(S, i, ev) {
    var why = canRemove(S, i);
    if (why) return why;
    collect(S, i, ev);
    var b = S.tiles[i];
    refund(S, b.paid);
    S.tiles[i] = null;
    S.claim[i] = 0;
    S.robots.forEach(function (R) {
      if (R.tgt === i) R.res = 0;
      if (R.state === 'home' && R.barn === i) R.barn = -1;
    });
    layoutChanged(S);
    if (ev) ev.push({ t: 'remove', i: i, kind: b.k === 'crop' ? b.crop : b.k });
    return null;
  }

  function canMove(S, from, to) {
    var b = S.tiles[from];
    if (!b || b.k === 'crop') return 'empty';
    if (from === to) return 'same';
    if (!S.regions[regionOf(to)]) return 'locked';
    if (S.tiles[to]) return 'busy';
    if (CONFIG.builds[b.k].floors.indexOf(floorOf(to)) < 0) return 'floor';
    if (b.k === 'quarry' && !ROCKS[to]) return 'rock';
    if (b.k === 'forge' && !LAVA[to]) return 'lava';
    return null;
  }

  function move(S, from, to, ev) {
    var why = canMove(S, from, to);
    if (why) return why;
    S.tiles[to] = S.tiles[from];
    S.tiles[from] = null;
    S.claim[from] = 0;
    S.claim[to] = 0;
    S.robots.forEach(function (R) {
      if (R.tgt === from) { R.res = 0; R.tgt = -1; if (R.state === 'go') R.state = R.carry.n ? 'home' : 'idle'; }
      if (R.barn === from) R.barn = -1;
    });
    layoutChanged(S);
    if (ev) ev.push({ t: 'move', from: from, i: to, kind: S.tiles[to].k });
    return null;
  }

  function canUnlock(S, id) {
    if (S.regions[id]) return 'done';
    if (!afford(S, CONFIG.regions[id].cost)) return 'money';
    return null;
  }

  function unlock(S, id, ev) {
    var why = canUnlock(S, id);
    if (why) return why;
    pay(S, CONFIG.regions[id].cost);
    S.regions[id] = true;
    if (ev) ev.push({ t: 'unlock', region: id });
    return null;
  }

  function canBuyRobot(S) {
    if (S.robots.length >= CONFIG.robot.max) return 'max';
    if (!afford(S, price(S, 'robot'))) return 'money';
    return null;
  }

  function buyRobot(S, ev) {
    var why = canBuyRobot(S);
    if (why) return why;
    pay(S, price(S, 'robot'));
    var R = spawnRobot(S);
    if (ev) ev.push({ t: 'robot', id: R.id, i: R.barn });
    return null;
  }

  function spawnRobot(S) {
    var R = { id: S.nextId++ };
    S.robots.push(R);
    resetRobot(S, R);
    return R;
  }

  function resetRobot(S, R) {
    var b = findOne(S, 'barn');
    var c = b >= 0 ? b : at(2, 6);
    R.x = col(c) + 0.5;
    R.y = row(c) + 0.5;
    R.state = 'idle';
    R.tgt = -1;
    R.res = 0;
    R.barn = -1;
    R.wait = 0;
    R.carry = { coins: 0, stone: 0, ore: 0, n: 0, icon: null };
  }

  /* 鍛造：一次一件；彩虹神鋤要先有前面三件 */
  function canForge(S, id) {
    var f = findOne(S, 'forge');
    if (f < 0) return 'noForge';
    var r = CONFIG.recipes[id];
    if (S.tools[id]) return 'done';
    if (S.tiles[f].job) return 'busy';
    if (r.needs && !r.needs.every(function (k) { return S.tools[k]; })) return 'needs';
    if (!afford(S, r.cost)) return 'money';
    return null;
  }

  function forge(S, id, ev) {
    var why = canForge(S, id);
    if (why) return why;
    var f = findOne(S, 'forge');
    pay(S, CONFIG.recipes[id].cost);
    S.tiles[f].job = id;
    S.tiles[f].t = 0;
    if (ev) ev.push({ t: 'forgeStart', i: f, id: id });
    return null;
  }

  function forgeTime(S, i) {
    var b = S.tiles[i];
    if (!b || !b.job) return 0;
    return CONFIG.recipes[b.job].time / (Math.max(1, LAVA[i]) * speed(S));
  }

  function canOffer(S) {
    if (findOne(S, 'altar') < 0) return 'noAltar';
    if (S.orbs >= CONFIG.altar.max) return 'max';
    if (!afford(S, orbPrice(S))) return 'money';
    return null;
  }

  function offer(S, ev) {
    var why = canOffer(S);
    if (why) return why;
    pay(S, orbPrice(S));
    S.orbs++;
    if (ev) ev.push({ t: 'orb', i: findOne(S, 'altar') });
    return null;
  }

  function canUpgradeBank(S) {
    var up = bankUpPrice(S);
    if (findOne(S, 'bank') < 0) return 'noBank';
    if (!up) return 'max';
    if (!afford(S, up)) return 'money';
    return null;
  }

  function upgradeBank(S, ev) {
    var why = canUpgradeBank(S);
    if (why) return why;
    var i = findOne(S, 'bank');
    pay(S, bankUpPrice(S));
    S.tiles[i].level++;
    if (ev) ev.push({ t: 'bankUp', i: i, level: S.tiles[i].level });
    return null;
  }

  /* ─────────────────────────────────────────────────────────────
     收成：機器人和手指共用
     ───────────────────────────────────────────────────────────── */

  /* 這格現在有幾個可以拿（扣掉已經有機器人要來拿的）；raw = 不扣 */
  function available(S, i, raw) {
    if (i < 0) return 0;
    var b = S.tiles[i], n = 0;
    if (!b) return 0;
    if (b.k === 'crop') n = b.ready;
    else if (b.k === 'quarry') n = b.items.length;
    else if (b.k === 'pot') n = b.bowls.length;
    return raw ? n : n - S.claim[i];
  }

  function take(S, i, max) {
    var b = S.tiles[i];
    var out = { coins: 0, stone: 0, ore: 0, n: 0, icon: null };
    if (!b) return out;
    if (b.k === 'crop' && b.ready) {
      out.coins = cropValue(S, i);
      out.n = 1;
      out.icon = b.crop;
      b.ready = 0;
      b.g = 0;
      S.stats.harvests++;
    } else if (b.k === 'quarry') {
      while (b.items.length && out.n < max) {
        if (b.items.pop() === 'o') { out.ore++; out.icon = 'ore'; } else out.stone++;
        out.n++;
      }
      if (out.n && !out.icon) out.icon = 'stone';
    } else if (b.k === 'pot') {
      while (b.bowls.length && out.n < max) {
        out.coins += b.bowls.shift();
        out.n++;
      }
      if (out.n) out.icon = 'soup';
    }
    return out;
  }

  /* 手指點一下：全部收起來，直接進口袋 */
  function collect(S, i, ev) {
    var got = take(S, i, Infinity);
    if (!got.n) return got;
    addCoins(S, got.coins);
    S.stone += got.stone;
    S.ore += got.ore;
    if (ev) ev.push({ t: 'collect', i: i, coins: got.coins, stone: got.stone, ore: got.ore, icon: got.icon });
    return got;
  }

  /* ─────────────────────────────────────────────────────────────
     機器人
     ───────────────────────────────────────────────────────────── */

  function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); }
  function cx(i) { return col(i) + 0.5; }
  function cy(i) { return row(i) + 0.5; }

  function barnsOf(S) {
    var out = [];
    for (var i = 0; i < N * N; i++) if (S.tiles[i] && S.tiles[i].k === 'barn') out.push(i);
    return out;
  }

  function nearestBarn(barns, x, y) {
    var best = -1, bd = Infinity;
    barns.forEach(function (b) {
      var d = dist(x, y, cx(b), cy(b));
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }

  function worth(S, i, n) {
    var b = S.tiles[i];
    if (b.k === 'crop') return cropValue(S, i);
    if (b.k === 'pot') {
      var w = 0;
      for (var k = 0; k < n; k++) w += b.bowls[k];
      return w;
    }
    /* 石頭不是錢，但快滿的採石場要先去，不然會停工 */
    return n * 5 * (1 + 2 * b.items.length / CONFIG.quarry.cap);
  }

  /* chain = 手上已經有東西：只去順路的 */
  function pickTarget(S, R, barns, chain) {
    var left = robotCap(S) - R.carry.n;
    var best = -1, bs = 0, home = 0;
    if (chain) {
      var hb = nearestBarn(barns, R.x, R.y);
      home = hb >= 0 ? dist(R.x, R.y, cx(hb), cy(hb)) : 0;
    }
    for (var i = 0; i < N * N; i++) {
      var a = available(S, i);
      if (a <= 0) continue;
      var n = Math.min(a, left);
      var d1 = dist(R.x, R.y, cx(i), cy(i));
      var nb = nearestBarn(barns, cx(i), cy(i));
      var d2 = nb >= 0 ? dist(cx(i), cy(i), cx(nb), cy(nb)) : 0;
      var score;
      if (chain) {
        var extra = d1 + d2 - home;
        if (extra > 2.2) continue;
        score = worth(S, i, n) / (extra + 0.6);
      } else {
        score = worth(S, i, n) / (d1 + d2 + 1);
      }
      if (score > bs) { bs = score; best = i; }
    }
    if (best >= 0) {
      var take = Math.min(available(S, best), left);
      S.claim[best] += take;
      R.tgt = best;
      R.res = take;
      R.state = 'go';
    }
    return best;
  }

  function release(S, R) {
    if (R.tgt >= 0 && R.res) S.claim[R.tgt] = Math.max(0, S.claim[R.tgt] - R.res);
    R.res = 0;
    R.tgt = -1;
  }

  function retarget(S, R) {
    release(S, R);
    R.state = R.carry.n ? 'home' : 'idle';
  }

  /* 往 (x, y) 走 step 格；到了回傳 true */
  function walk(R, x, y, step) {
    var d = dist(R.x, R.y, x, y);
    if (d <= step) { R.x = x; R.y = y; return true; }
    R.x += (x - R.x) / d * step;
    R.y += (y - R.y) / d * step;
    return false;
  }

  function stepRobot(S, R, dt, barns, ev) {
    if (R.wait > 0) { R.wait -= dt; return; }
    var step = robotSpeed(S) * dt;

    if (R.state === 'idle') {
      if (pickTarget(S, R, barns, false) < 0) {
        /* 沒事做：在倉庫旁邊等，每個機器人一個位置 */
        var b = nearestBarn(barns, R.x, R.y);
        if (b >= 0) {
          var a = R.id * 2.4;
          walk(R, cx(b) + Math.cos(a) * 0.34, cy(b) + Math.sin(a) * 0.3 + 0.1, step * 0.5);
        }
        return;
      }
    }

    if (R.state === 'go') {
      if (!walk(R, cx(R.tgt), cy(R.tgt), step)) return;
      var i = R.tgt;
      release(S, R);
      var got = take(S, i, robotCap(S) - R.carry.n);
      if (got.n) {
        R.carry.coins += got.coins;
        R.carry.stone += got.stone;
        R.carry.ore += got.ore;
        R.carry.n += got.n;
        R.carry.icon = got.icon;
        R.wait = CONFIG.robot.wait;
        if (ev) ev.push({ t: 'pick', i: i, id: R.id, icon: got.icon });
      }
      if (R.carry.n < robotCap(S) && pickTarget(S, R, barns, R.carry.n > 0) >= 0) return;
      R.state = R.carry.n ? 'home' : 'idle';
      R.barn = -1;
      return;
    }

    if (R.state === 'home') {
      if (R.barn < 0 || !S.tiles[R.barn] || S.tiles[R.barn].k !== 'barn') R.barn = nearestBarn(barns, R.x, R.y);
      if (R.barn < 0) return;
      if (!walk(R, cx(R.barn), cy(R.barn), step)) return;
      var c = R.carry;
      addCoins(S, c.coins);
      S.stone += c.stone;
      S.ore += c.ore;
      if (ev) ev.push({ t: 'deposit', i: R.barn, id: R.id, coins: c.coins, stone: c.stone, ore: c.ore, icon: c.icon });
      R.carry = { coins: 0, stone: 0, ore: 0, n: 0, icon: null };
      R.state = 'idle';
      R.barn = -1;
      R.wait = CONFIG.robot.wait;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     一步
     ───────────────────────────────────────────────────────────── */

  function step(S, dt, ev) {
    ev = ev || [];
    S.time += dt;
    logTick(S);
    var sp = speed(S);
    var i, b;

    for (i = 0; i < N * N; i++) {
      b = S.tiles[i];
      if (!b) continue;

      if (b.k === 'crop' && !b.ready) {
        b.g += dt / cropTime(S, i);
        if (b.g >= 1) { b.g = 1; b.ready = 1; ev.push({ t: 'ripe', i: i }); }

      } else if (b.k === 'quarry') {
        if (b.items.length >= CONFIG.quarry.cap) { b.t = Math.min(b.t, 1); continue; }
        b.t += dt / quarryTime(S, i);
        while (b.t >= 1 && b.items.length < CONFIG.quarry.cap) {
          b.t -= 1;
          for (var k = quarryYield(S, i); k > 0 && b.items.length < CONFIG.quarry.cap; k--) {
            b.items.push(rand(S) < CONFIG.quarry.oreChance ? 'o' : 's');
          }
          ev.push({ t: 'dig', i: i });
        }

      } else if (b.k === 'forge' && b.job) {
        b.t += dt * sp * Math.max(1, LAVA[i]);
        if (b.t >= CONFIG.recipes[b.job].time) {
          S.tools[b.job] = true;
          S.stats.forged++;
          ev.push({ t: 'forged', i: i, id: b.job });
          b.job = null;
          b.t = 0;
        }

      } else if (b.k === 'bank') {
        b.t += dt;
        if (b.t >= CONFIG.bank.every) {
          b.t -= CONFIG.bank.every;
          var L = CONFIG.bank.levels[b.level - 1];
          var gain = Math.min(L.cap, Math.floor(S.coins * L.rate));
          if (gain > 0) {
            addCoins(S, gain);
            S.stats.interest += gain;
            ev.push({ t: 'interest', i: i, coins: gain });
          }
        }
      }
    }

    /* 湯鍋：在菜熟的同一步就從旁邊拿走（機器人來不及搶），三種都有就開始煮 */
    for (i = 0; i < N * N; i++) {
      b = S.tiles[i];
      if (!b || b.k !== 'pot') continue;
      N8[i].forEach(function (j) {
        var c = S.tiles[j];
        if (c && c.k === 'crop' && c.ready && !b.has[c.crop] && !S.claim[j]) {
          b.has[c.crop] = 1;
          b.hv += cropValue(S, j);
          c.ready = 0;
          c.g = 0;
          S.stats.harvests++;
          ev.push({ t: 'pull', from: j, i: i, icon: c.crop });
        }
      });
      if (b.cook < 0 && b.bowls.length < CONFIG.pot.cap &&
          CROP_ORDER.every(function (k) { return b.has[k]; })) {
        b.cook = 0;
        b.val = b.hv * CONFIG.pot.bonus;
        b.has = {};
        b.hv = 0;
        ev.push({ t: 'cook', i: i });
      }
      if (b.cook >= 0) {
        b.cook += dt * sp;
        if (b.cook >= CONFIG.pot.cook) {
          b.bowls.push(b.val);
          b.cook = -1;
          b.val = 0;
          S.stats.soups++;
          ev.push({ t: 'soup', i: i });
        }
      }
    }

    var barns = barnsOf(S);
    S.robots.forEach(function (R) { stepRobot(S, R, dt, barns, ev); });

    checkAch(S, ev);
    checkGoal(S, ev);
    return ev;
  }

  /* ─────────────────────────────────────────────────────────────
     稱號（成就）
     ───────────────────────────────────────────────────────────── */

  function anyTile(S, fn) {
    for (var i = 0; i < N * N; i++) if (S.tiles[i] && fn(S.tiles[i], i)) return true;
    return false;
  }

  var ACH = [
    { id: 'first', name: '第一次收成', how: '收成第一個菜', test: function (S) { return S.stats.harvests >= 1; } },
    { id: 'robot', name: '機器人朋友', how: '買第一個機器人', test: function (S) { return S.robots.length >= 1; } },
    { id: 'coins1k', name: '硬幣收藏家', how: '總共賺到 1,000 金幣', test: function (S) { return S.stats.earned >= 1000; } },
    { id: 'neighbor', name: '好鄰居', how: '一座燈塔的旁邊 8 格都是菜',
      test: function (S) {
        return anyTile(S, function (b, i) {
          return b.k === 'lighthouse' && N8[i].length === 8 &&
            N8[i].every(function (j) { return S.tiles[j] && S.tiles[j].k === 'crop'; });
        });
      } },
    { id: 'quarry4', name: '礦山高手', how: '採石場的旁邊有 4 顆大石頭',
      test: function (S) { return anyTile(S, function (b, i) { return b.k === 'quarry' && ROCKS[i] >= 4; }); } },
    { id: 'soup', name: '難忘的湯', how: '煮出第一鍋彩虹湯', test: function (S) { return S.stats.soups >= 1; } },
    { id: 'explorer', name: '農場探險家', how: '打開全部 4 個地方',
      test: function (S) { return REGION_ORDER.every(function (k) { return S.regions[k]; }); } },
    { id: 'robots8', name: '機器人大隊', how: '有 8 個機器人', test: function (S) { return S.robots.length >= 8; } },
    { id: 'orb', name: '精靈之友', how: '換到第一顆精靈寶珠', test: function (S) { return S.orbs >= 1 || S.tools.hoe; } },
    { id: 'smith', name: '打鐵師傅', how: '打造第一件寶物', test: function (S) { return S.stats.forged >= 1; } },
    { id: 'piggy', name: '利滾利', how: '小豬銀行給了 1,000 金幣利息', test: function (S) { return S.stats.interest >= 1000; } },
    { id: 'power', name: '無限力量', how: '打造彩虹神鋤', test: function (S) { return !!S.tools.hoe; } },
    { id: 'rich', name: '金幣大富翁', how: '總共賺到 10 萬金幣', test: function (S) { return S.stats.earned >= 100000; } }
  ];

  function checkAch(S, ev) {
    ACH.forEach(function (a) {
      if (!S.ach[a.id] && a.test(S)) {
        S.ach[a.id] = Math.round(S.time);
        ev.push({ t: 'ach', id: a.id });
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     目標：一個接一個，告訴小朋友下一步做什麼、還要等多久。
     prog 回傳 [現在, 目標]；要花錢的目標用「錢存到多少」當進度
     ───────────────────────────────────────────────────────────── */

  /* 第三個值 = 做完了沒；錢夠了還不算，要真的買下去 */
  function money(S, cost, done) {
    if (done) return [1, 1, true];
    var need = cost.coins || 1;
    return [Math.min(S.coins, need), need, false];
  }

  var GOALS = [
    { id: 'tap', text: '點熟的蘿蔔，收成 3 次', prog: function (S) { return [S.stats.harvests, 3]; } },
    { id: 'robot', text: '買一個機器人', prog: function (S) { return money(S, price(S, 'robot'), S.robots.length >= 1); } },
    { id: 'plots', text: '種 8 塊田', prog: function (S) { return [cropCount(S), 8]; } },
    { id: 'light', text: '蓋一座燈塔，旁邊的菜變 2 倍', prog: function (S) { return money(S, price(S, 'lighthouse'), count(S, 'lighthouse') >= 1); } },
    { id: 'river', text: '打開小河邊', prog: function (S) { return money(S, CONFIG.regions.river.cost, S.regions.river); } },
    { id: 'corn', text: '種玉米', prog: function (S) { return [cropCount(S, 'corn'), 1]; } },
    { id: 'robot3', text: '有 3 個機器人', prog: function (S) { return [S.robots.length, 3]; } },
    { id: 'mountain', text: '打開礦山', prog: function (S) { return money(S, CONFIG.regions.mountain.cost, S.regions.mountain); } },
    { id: 'quarry', text: '在大石頭旁邊蓋採石場', prog: function (S) { return money(S, price(S, 'quarry'), count(S, 'quarry') >= 1); } },
    { id: 'tomato', text: '種番茄', prog: function (S) { return [cropCount(S, 'tomato'), 1]; } },
    { id: 'pot', text: '蓋湯鍋，旁邊要有三種菜', prog: function (S) { return money(S, price(S, 'pot'), count(S, 'pot') >= 1); } },
    { id: 'soup', text: '煮出一鍋彩虹湯', prog: function (S) { return [S.stats.soups, 1]; } },
    { id: 'bank', text: '蓋小豬銀行，錢會自己變多', prog: function (S) { return money(S, price(S, 'bank'), count(S, 'bank') >= 1); } },
    { id: 'volcano', text: '打開火山', prog: function (S) { return money(S, CONFIG.regions.volcano.cost, S.regions.volcano); } },
    { id: 'forge', text: '在岩漿旁邊蓋鍛造爐', prog: function (S) { return money(S, price(S, 'forge'), count(S, 'forge') >= 1); } },
    { id: 'tool', text: '打造一件寶物', prog: function (S) { return [S.stats.forged, 1]; } },
    { id: 'altar', text: '蓋月光祭壇', prog: function (S) { return money(S, price(S, 'altar'), count(S, 'altar') >= 1); } },
    { id: 'orb', text: '換一顆精靈寶珠', prog: function (S) { return [S.orbs || (S.tools.hoe ? 1 : 0), 1]; } },
    { id: 'hoe', text: '打造彩虹神鋤', prog: function (S) { return [S.tools.hoe ? 1 : 0, 1]; } }
  ];

  /* 目前的目標：{ id, text, cur, max }；固定的做完以後，接著是「總共賺到 N 金幣」 */
  function goalOf(S, g) {
    if (g === undefined) g = S.goal;
    if (g < GOALS.length) {
      var p = GOALS[g].prog(S);
      return { id: GOALS[g].id, text: GOALS[g].text, cur: Math.min(p[0], p[1]), max: p[1],
        done: p.length > 2 ? p[2] : p[0] >= p[1], buy: p.length > 2 };
    }
    var k = g - GOALS.length;
    var target = k < CONFIG.richGoals.length ? CONFIG.richGoals[k] :
      CONFIG.richGoals[CONFIG.richGoals.length - 1] * Math.pow(10, k - CONFIG.richGoals.length + 1);
    return { id: 'rich' + k, text: '總共賺到 ' + fmt(target) + ' 金幣', cur: Math.min(S.stats.earned, target), max: target,
      done: S.stats.earned >= target, rich: true };
  }

  function checkGoal(S, ev) {
    for (var guard = 0; guard < 40; guard++) {
      var G = goalOf(S);
      if (!G.done) return;
      S.goal++;
      ev.push({ t: 'goal', id: G.id, text: G.text });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     數字：1,234 · 1.2萬 · 3.4億
     ───────────────────────────────────────────────────────────── */

  function fmt(n) {
    n = Math.floor(n);
    if (n < 10000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (n < 1e8) return trim(n / 1e4) + '萬';
    if (n < 1e12) return trim(n / 1e8) + '億';
    return trim(n / 1e12) + '兆';
  }

  function trim(x) {
    var s = x >= 100 ? String(Math.floor(x)) : x >= 10 ? (Math.floor(x * 10) / 10).toFixed(1) : (Math.floor(x * 100) / 100).toFixed(2);
    return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  }

  /* ─────────────────────────────────────────────────────────────
     存檔
     ───────────────────────────────────────────────────────────── */

  function save(S) {
    return {
      v: 1, time: Math.round(S.time * 10) / 10, seed: S.seed,
      coins: S.coins, stone: S.stone, ore: S.ore, orbs: S.orbs,
      regions: S.regions, tiles: S.tiles, robots: S.robots.length,
      tools: S.tools, stats: S.stats, ach: S.ach, goal: S.goal
    };
  }

  function num(x, d) { return typeof x === 'number' && isFinite(x) && x >= 0 ? x : d; }

  function load(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.tiles) || d.tiles.length !== N * N) return null;
    var S = newState();
    S.time = num(d.time, 0);
    S.seed = num(d.seed, S.seed);
    S.coins = num(d.coins, 0);
    S.stone = num(d.stone, 0);
    S.ore = num(d.ore, 0);
    S.orbs = Math.min(CONFIG.altar.max, num(d.orbs, 0));
    REGION_ORDER.forEach(function (k) { S.regions[k] = k === 'meadow' || !!(d.regions && d.regions[k]); });
    Object.keys(S.tools).forEach(function (k) { S.tools[k] = !!(d.tools && d.tools[k]); });
    Object.keys(S.stats).forEach(function (k) { S.stats[k] = num(d.stats && d.stats[k], 0); });
    S.ach = {};
    ACH.forEach(function (a) { if (d.ach && typeof d.ach[a.id] === 'number') S.ach[a.id] = d.ach[a.id]; });
    S.goal = Math.floor(num(d.goal, 0));
    S.tiles = d.tiles.map(function (b, i) { return cleanTile(b, i); });
    if (findOne(S, 'barn') < 0) S.tiles[at(2, 6)] = { k: 'barn', paid: null };
    S.robots = [];
    var n = Math.min(CONFIG.robot.max, Math.floor(num(d.robots, 0)));
    for (var r = 0; r < n; r++) S.robots.push({ id: S.nextId++ });
    prepare(S);
    return S;
  }

  function cost(c) {
    if (!c) return null;
    return { coins: num(c.coins, 0), stone: num(c.stone, 0) };
  }

  /* 只收認得的東西，壞掉的格子當作空地 */
  function cleanTile(b, i) {
    if (!b || typeof b !== 'object') return null;
    var k = b.k;
    if (k === 'crop') {
      if (!CONFIG.crops[b.crop] || floorOf(i) !== 'G') return null;
      return { k: k, crop: b.crop, g: Math.min(1, num(b.g, 0)), ready: b.ready ? 1 : 0, paid: cost(b.paid) };
    }
    if (!CONFIG.builds[k] || CONFIG.builds[k].floors.indexOf(floorOf(i)) < 0) return null;
    var out = { k: k, paid: cost(b.paid) };
    if (k === 'quarry') {
      out.t = Math.min(1, num(b.t, 0));
      out.items = (Array.isArray(b.items) ? b.items : []).filter(function (x) { return x === 's' || x === 'o'; })
        .slice(0, CONFIG.quarry.cap);
    } else if (k === 'pot') {
      out.has = {};
      CROP_ORDER.forEach(function (c) { if (b.has && b.has[c]) out.has[c] = 1; });
      out.hv = num(b.hv, 0);
      out.cook = typeof b.cook === 'number' && b.cook >= 0 ? b.cook : -1;
      out.val = num(b.val, 0);
      out.bowls = (Array.isArray(b.bowls) ? b.bowls : []).filter(function (x) { return num(x, -1) >= 0; })
        .slice(0, CONFIG.pot.cap);
    } else if (k === 'forge') {
      out.job = CONFIG.recipes[b.job] ? b.job : null;
      out.t = num(b.t, 0);
    } else if (k === 'bank') {
      out.level = Math.max(1, Math.min(CONFIG.bank.levels.length, Math.floor(num(b.level, 1))));
      out.t = Math.min(CONFIG.bank.every, num(b.t, 0));
    }
    return out;
  }

  var api = {
    N: N, CONFIG: CONFIG, MAP: MAP, REGION_ORDER: REGION_ORDER, CROP_ORDER: CROP_ORDER,
    ACH: ACH, GOALS: GOALS, ROCKS: ROCKS, LAVA: LAVA, WET: WET, N8: N8,
    col: col, row: row, at: at, floorOf: floorOf, regionOf: regionOf, buildable: buildable,
    newState: newState, step: step, load: load, save: save,
    price: price, orbPrice: orbPrice, bankUpPrice: bankUpPrice, afford: afford,
    canPlace: canPlace, place: place, canRemove: canRemove, remove: remove,
    canMove: canMove, move: move, canUnlock: canUnlock, unlock: unlock,
    canBuyRobot: canBuyRobot, buyRobot: buyRobot, canForge: canForge, forge: forge, forgeTime: forgeTime,
    canOffer: canOffer, offer: offer, canUpgradeBank: canUpgradeBank, upgradeBank: upgradeBank,
    collect: collect, available: available, kindReady: kindReady, count: count, cropCount: cropCount,
    cropValue: cropValue, cropTime: cropTime, quarryTime: quarryTime, quarryYield: quarryYield,
    speed: speed, robotCap: robotCap, robotSpeed: robotSpeed, rate: rate, goalOf: goalOf, fmt: fmt,
    findOne: findOne
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FarmEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
