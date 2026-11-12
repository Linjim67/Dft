/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 機器人農場（單機）
   規則在 engine.js（FarmEngine），像素圖在 art.js（FarmArt）；這裡是畫面、手指、按鈕和存檔。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var E = window.FarmEngine, ART = window.FarmArt;
  var CFG = E.CONFIG, N = E.N;
  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var fmt = E.fmt;
  var live = $('liveRegion');

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function still() { return !!(mq && mq.matches); }

  /* ─────────────────────────────────────────────────────────────
     存檔：跟著個人資料的暫時代碼走（換一位小朋友就是新的農場）
     ───────────────────────────────────────────────────────────── */

  var STORE_KEY = 'anxin.farm.v1';
  var storage = (function () {
    try { if (window.localStorage) return window.localStorage; } catch (e) { /* 忽略 */ }
    var m = {};
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  })();

  function loadGame() {
    try {
      var d = JSON.parse(storage.getItem(STORE_KEY) || 'null');
      if (d && d.v === 1 && d.code === p.code) return E.load(d.s);
    } catch (e) { /* 壞掉的存檔：重新開始 */ }
    return null;
  }

  function saveGame() {
    try { storage.setItem(STORE_KEY, JSON.stringify({ v: 1, code: p.code, s: E.save(S) })); } catch (e) { /* 忽略 */ }
  }

  var S = loadGame();
  var hadSave = !!S;
  if (!S) S = E.newState();

  /* ─────────────────────────────────────────────────────────────
     名字、說明
     ───────────────────────────────────────────────────────────── */

  var NAME = {
    hand: '收成', carrot: '蘿蔔', corn: '玉米', tomato: '番茄', robot: '機器人', lighthouse: '燈塔',
    quarry: '採石場', pot: '湯鍋', barn: '倉庫', bank: '小豬銀行', forge: '鍛造爐', altar: '月光祭壇'
  };
  var SHORT = { bank: '銀行', altar: '祭壇' };
  var TOOLS = ['hand', 'carrot', 'corn', 'tomato', 'robot', 'lighthouse', 'quarry', 'pot', 'barn', 'bank', 'forge', 'altar'];
  var HINT = {
    hand: '點熟的菜、推車、湯碗收起來；點房子看看裡面',
    carrot: '蘿蔔長得最快。點草地種下去，也可以用手指一路拖過去',
    corn: '玉米比蘿蔔慢，可是一根值 8 金幣',
    tomato: '番茄最慢、最值錢，湯鍋也要用到它',
    lighthouse: '燈塔照到旁邊 8 格：菜和採石場收成變 2 倍',
    quarry: '採石場要蓋在大石頭旁邊，石頭越多挖越快',
    pot: '湯鍋旁邊要有蘿蔔、玉米、番茄，會煮成彩虹湯',
    barn: '多一間倉庫，機器人可以送到比較近的地方',
    bank: '小豬銀行：金幣放著，每 5 秒會自己變多',
    forge: '鍛造爐要蓋在岩漿旁邊，用金礦打造寶物',
    altar: '月光祭壇把多的石頭和金礦變成精靈寶珠'
  };
  var SPRITE_OF = {
    carrot: 'carrot2', corn: 'corn2', tomato: 'tomato2', robot: 'robot', lighthouse: 'lighthouse',
    quarry: 'quarry', pot: 'potSoup', barn: 'barn', bank: 'bank', forge: 'forge', altar: 'altar'
  };
  var REGION_TEXT = {
    river: '小河從中間流過。河邊的田長得快 1.5 倍，還可以種玉米！',
    mountain: '有很多大石頭。在旁邊蓋採石場，挖石頭和金礦。還可以種番茄、蓋湯鍋和小豬銀行！',
    volcano: '岩漿熱呼呼。在岩漿旁邊蓋鍛造爐，打造寶物；還可以蓋月光祭壇。'
  };
  var RECIPE_ICON = { boots: 'boots', basket: 'basket', shovel: 'shovel', hoe: 'hoe' };

  function why(reason, kind) {
    var c = CFG.builds[kind];
    switch (reason) {
      case 'locked': return '這裡還沒打開，點雲朵看看';
      case 'busy': return '這裡已經有東西了';
      case 'floor':
        if (CFG.crops[kind]) return '菜要種在草地上';
        if (kind === 'quarry') return '採石場要蓋在礦山的碎石地上';
        if (kind === 'forge') return '鍛造爐要蓋在火山的黑色石頭地上';
        if (kind === 'pot') return '湯鍋要放在草地上';
        return '這裡不能蓋';
      case 'rock': return '採石場的旁邊要有大石頭';
      case 'lava': return '鍛造爐的旁邊要有岩漿';
      case 'max': return (c ? c.name : NAME[kind]) + '最多 ' + (c ? c.max : CFG.robot.max) + ' 個';
      case 'lastBarn': return '最後一間倉庫不能拆，機器人要有地方放東西';
      case 'forging': return '正在打造，等一下再拆';
      default: return '這裡不能蓋';
    }
  }

  /* 錢不夠：說還差多少 */
  function short(cost) {
    if (!cost) return '';
    var out = [];
    if ((cost.coins || 0) > S.coins) out.push((cost.coins - S.coins) + ' 金幣');
    if ((cost.stone || 0) > S.stone) out.push((cost.stone - S.stone) + ' 石頭');
    if ((cost.ore || 0) > S.ore) out.push((cost.ore - S.ore) + ' 金礦');
    if ((cost.orbs || 0) > S.orbs) out.push((cost.orbs - S.orbs) + ' 精靈寶珠');
    return out.length ? '還差 ' + out.join('、') : '';
  }

  function img(name, big, cls) {
    return '<img class="' + (cls || 'px') + '" src="' + ART.iconUrl(name, big) + '" alt="">';
  }

  /* 價錢：小圖示 + 數字；買不起的那一項是深紅色，並且前面多一個「缺」字給報讀 */
  function costHtml(cost) {
    if (!cost) return '';
    var parts = [];
    [['coins', 'coin', '金幣', S.coins], ['stone', 'stone', '石頭', S.stone], ['ore', 'ore', '金礦', S.ore],
      ['orbs', 'orb', '精靈寶珠', S.orbs]].forEach(function (k) {
      var n = cost[k[0]] || 0;
      if (!n) return;
      var lack = n > k[3];
      parts.push('<span class="cost-item' + (lack ? ' is-lack' : '') + '">' + img(k[1]) +
        '<span class="sr-only">' + k[2] + (lack ? '（不夠）' : '') + '</span>' + fmt(n) + '</span>');
    });
    return '<span class="cost">' + parts.join('') + '</span>';
  }

  /* ─────────────────────────────────────────────────────────────
     畫面元素
     ───────────────────────────────────────────────────────────── */

  var views = { cover: $('coverView'), play: $('playView') };
  var board = $('board'), bctx = board.getContext('2d');
  var boardWrap = $('boardWrap');
  var toolsEl = $('tools');
  var sheet = $('sheet'), sheetBody = $('sheetBody');
  var menuDlg = $('menuDlg'), achDlg = $('achDlg'), resetDlg = $('resetDlg');

  var UI = {
    tool: 'hand',
    moveFrom: -1,
    sheetTile: -1,
    sheetRegion: null,
    cursor: E.at(2, 5),
    keyboard: false,
    pops: {},          /* 剛蓋好：格子 → 時間 */
    floats: [],        /* 「+12」 */
    parts: [],         /* 小粒子 */
    shots: [],         /* 菜跳進湯鍋 */
    clouds: {},        /* 剛打開的地區：雲散開 */
    newTools: {},
    seenTools: {},
    paused: true,
    playing: false
  };

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    document.body.classList.toggle('is-playing', name === 'play');
    window.scrollTo(0, 0);
  }

  function say(text) {
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

  /* 遊戲時間（shared/playtime.js）：封面 = home，農場 = play */
  function track(level) {
    if (window.AnxinPlay) window.AnxinPlay.at('farm', level);
  }

  /* ─────────────────────────────────────────────────────────────
     封面
     ───────────────────────────────────────────────────────────── */

  function renderCover() {
    var got = Object.keys(S.ach).length;
    var line = $('coverSave');
    if (hadSave) {
      line.hidden = false;
      line.innerHTML = img('coin') + '<span>' + fmt(S.coins) + ' 金幣</span><span class="dot" aria-hidden="true">・</span>' +
        '<span>機器人 ' + S.robots.length + ' 個</span><span class="dot" aria-hidden="true">・</span><span>稱號 ' + got + ' / ' + E.ACH.length + '</span>';
      $('playBtn').textContent = '繼續玩';
    } else {
      line.hidden = true;
      $('playBtn').textContent = '開始玩';
    }
    var cc = $('coverCanvas');
    var size = Math.round(Math.min(cc.parentNode.clientWidth || 280, 320) * (window.devicePixelRatio || 1));
    cc.width = cc.height = size;
    var ctx = cc.getContext('2d');
    drawScene(ctx, size / 128, 0, false);
  }

  function startPlay() {
    UI.playing = true;
    UI.paused = false;
    show('play');
    track('play');
    fitBoard();
    renderTools();
    renderHud(true);
    renderGoal(true);
    if (!hadSave && S.stats.harvests === 0) hint('點熟的蘿蔔收成！也可以用手指一路滑過去', 4200);
    lastFrame = 0;
  }

  $('playBtn').addEventListener('click', startPlay);

  /* ─────────────────────────────────────────────────────────────
     頂列：金幣、每分鐘收入、材料
     ───────────────────────────────────────────────────────────── */

  var hud = {};
  var lastRate = -1, rateAt = 0;

  function renderHud(force) {
    setText('coinNum', fmt(S.coins), force);
    var now = performance.now();
    if (force || now - rateAt > 1000) {
      rateAt = now;
      var r = Math.round(E.rate(S));
      if (r !== lastRate) {
        lastRate = r;
        $('coinRate').textContent = r > 0 ? '+' + fmt(r) + '/分' : '';
      }
    }
    [['resStone', S.stone, S.regions.mountain || S.stone > 0],
      ['resOre', S.ore, S.regions.mountain || S.ore > 0],
      ['resOrb', S.orbs, S.orbs > 0 || E.findOne(S, 'altar') >= 0]].forEach(function (r) {
      var el = $(r[0]);
      if (el.hidden === !!r[2]) el.hidden = !r[2];
      setText(r[0] + 'Num', fmt(r[1]), force);
    });
  }

  function setText(id, text, force) {
    if (!force && hud[id] === text) return;
    hud[id] = text;
    $(id).textContent = text;
  }

  function bump(el) {
    if (!el || still() || !el.animate) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'cubic-bezier(.22,.78,.35,1)' });
  }

  function shake(el) {
    if (!el || !el.animate) return;
    if (still()) return;
    el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 320 });
  }

  /* ─────────────────────────────────────────────────────────────
     目標列（還要多久、下一步做什麼）；選了工具時改成工具說明
     ───────────────────────────────────────────────────────────── */

  var goalSig = '', goalDoneUntil = 0;

  function renderGoal(force) {
    var el = $('goalBar');
    var now = performance.now();
    if (now < goalDoneUntil && !force) return;
    var sig, html;
    if (UI.moveFrom >= 0) {
      sig = 'move';
      html = '<span class="goal-chip is-tool">搬家</span><span class="goal-text">點一格空地，把' +
        esc(NAME[S.tiles[UI.moveFrom] ? S.tiles[UI.moveFrom].k : 'barn']) + '搬過去</span>' +
        '<button class="goal-x" type="button" data-act="cancelMove">取消</button>';
    } else if (UI.tool !== 'hand') {
      sig = 'tool:' + UI.tool;
      html = '<span class="goal-chip is-tool">' + esc(NAME[UI.tool]) + '</span><span class="goal-text">' + esc(HINT[UI.tool]) + '</span>' +
        '<button class="goal-x" type="button" data-act="hand">好了</button>';
    } else {
      var G = E.goalOf(S);
      var pct = Math.max(0, Math.min(1, G.cur / G.max));
      var ready = G.buy && G.cur >= G.max;
      sig = 'goal:' + G.id + ':' + Math.round(pct * 100) + ':' + ready;
      html = '<span class="goal-chip">目標</span><span class="goal-text">' + esc(G.text) +
        (ready ? '<b class="goal-ready">可以買了！</b>' : '') + '</span>' +
        '<span class="goal-meter" role="progressbar" aria-label="目標進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        Math.round(pct * 100) + '"><span class="goal-fill" style="transform:scaleX(' + pct.toFixed(3) + ')"></span></span>';
    }
    if (!force && sig === goalSig) return;
    goalSig = sig;
    el.innerHTML = html;
    el.classList.toggle('is-tool', sig.indexOf('goal:') !== 0);
    el.classList.remove('is-done');
  }

  function goalDone(text) {
    var el = $('goalBar');
    goalDoneUntil = performance.now() + 1400;
    goalSig = '';
    el.classList.add('is-done');
    el.classList.remove('is-tool');
    el.innerHTML = '<span class="goal-chip is-done"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>完成</span>' +
      '<span class="goal-text">' + esc(text) + '</span>';
    say('目標完成：' + text);
  }

  $('goalBar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.getAttribute('data-act') === 'hand') setTool('hand');
    if (b.getAttribute('data-act') === 'cancelMove') { UI.moveFrom = -1; renderGoal(true); }
  });

  /* ─────────────────────────────────────────────────────────────
     工具列
     ───────────────────────────────────────────────────────────── */

  function toolVisible(k) {
    if (k === 'hand' || k === 'carrot' || k === 'robot') return true;
    if (k === 'lighthouse') return S.robots.length > 0 || S.stats.earned >= 30;
    return E.kindReady(S, k);
  }

  function toolPrice(k) {
    if (k === 'hand') return null;
    return E.price(S, k);
  }

  var toolSig = '';

  function renderTools(force) {
    var sigParts = [UI.tool];
    TOOLS.forEach(function (k) {
      if (!toolVisible(k)) return;
      var c = toolPrice(k);
      var full = k === 'robot' ? S.robots.length >= CFG.robot.max :
        CFG.builds[k] ? E.count(S, k) >= CFG.builds[k].max : false;
      sigParts.push(k + (c ? c.coins + '/' + c.stone + (E.afford(S, c) ? 'y' : 'n') : '') + (full ? 'F' : '') + (UI.newTools[k] ? 'N' : ''));
    });
    var sig = sigParts.join('|') + '|' + S.robots.length;
    if (!force && sig === toolSig) return;
    toolSig = sig;
    var focusKey = document.activeElement && document.activeElement.getAttribute('data-tool');
    var html = '';
    TOOLS.forEach(function (k) {
      if (!toolVisible(k)) return;
      if (!UI.seenTools[k]) { UI.seenTools[k] = true; if (UI.playing && k !== 'hand') UI.newTools[k] = true; }
      var c = toolPrice(k);
      var isRobot = k === 'robot';
      var full = isRobot ? S.robots.length >= CFG.robot.max : CFG.builds[k] ? E.count(S, k) >= CFG.builds[k].max : false;
      var can = !c || E.afford(S, c);
      var icon = k === 'hand' ? img('hand', false, 'tool-img') : img(SPRITE_OF[k], true, 'tool-img');
      var priceHtml = '';
      if (isRobot) priceHtml = full ? '<span class="tool-note">滿了</span>' : costHtml(c);
      else if (full) priceHtml = '<span class="tool-note">蓋滿了</span>';
      else if (c) priceHtml = costHtml(c);
      else priceHtml = '<span class="tool-note">點點看</span>';
      var label = SHORT[k] || NAME[k];
      html += '<button class="tool' + (k === UI.tool ? ' is-on' : '') + (!can || full ? ' is-poor' : '') +
        (isRobot ? ' is-buy' : '') + '" type="button" data-tool="' + k + '"' +
        (isRobot ? ' aria-label="買機器人，現在有 ' + S.robots.length + ' 個"' : ' aria-pressed="' + (k === UI.tool) + '"') + '>' +
        (UI.newTools[k] ? '<span class="tool-new">新</span>' : '') +
        (isRobot ? '<span class="tool-count">' + S.robots.length + '</span>' : '') +
        '<span class="tool-pic">' + icon + '</span>' +
        '<span class="tool-name">' + esc(label) + '</span>' +
        '<span class="tool-price">' + priceHtml + '</span>' +
        (k === UI.tool ? '<span class="tool-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>' : '') +
        '</button>';
    });
    toolsEl.innerHTML = html;
    if (focusKey) {
      var f = toolsEl.querySelector('[data-tool="' + focusKey + '"]');
      if (f) f.focus();
    }
  }

  toolsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tool]');
    if (!b) return;
    var k = b.getAttribute('data-tool');
    if (UI.newTools[k]) { delete UI.newTools[k]; toolSig = ''; }
    if (k === 'robot') { buyRobot(b); return; }
    setTool(UI.tool === k && k !== 'hand' ? 'hand' : k);
  });

  function setTool(k) {
    UI.tool = k;
    UI.moveFrom = -1;
    renderTools(true);
    renderGoal(true);
    var b = toolsEl.querySelector('[data-tool="' + k + '"]');
    if (b && b.scrollIntoView && k !== 'hand') b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still() ? 'auto' : 'smooth' });
    say(k === 'hand' ? '收成模式' : '選了' + NAME[k] + '：' + HINT[k]);
  }

  function buyRobot(btn) {
    var ev = [];
    var r = E.buyRobot(S, ev);
    if (r === 'money') { hint(short(E.price(S, 'robot')), 1800); shake(btn); return; }
    if (r === 'max') { hint('機器人最多 ' + CFG.robot.max + ' 個', 1800); return; }
    handle(ev);
    renderTools(true);
    say('買了一個機器人，現在有 ' + S.robots.length + ' 個');
  }

  /* ─────────────────────────────────────────────────────────────
     提示（工具列上面的小泡泡）、稱號通知（上面的大卡片）
     ───────────────────────────────────────────────────────────── */

  var hintTimer = 0;
  function hint(text, ms) {
    if (!text) return;
    var el = $('hint');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('is-out');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(function () {
      el.classList.add('is-out');
      hintTimer = window.setTimeout(function () { el.hidden = true; }, 220);
    }, ms || 1800);
    say(text);
  }

  var toastQ = [], toastOn = false;
  function toast(kind, title, sub, icon) {
    toastQ.push({ kind: kind, title: title, sub: sub, icon: icon });
    if (!toastOn) nextToast();
  }

  function nextToast() {
    var t = toastQ.shift();
    var el = $('toast');
    if (!t) { toastOn = false; el.hidden = true; return; }
    toastOn = true;
    var pic = t.icon ? img(t.icon, t.kind === 'unlock' ? false : false, 'toast-img') :
      '<svg viewBox="0 0 48 48" class="toast-medal" aria-hidden="true"><path class="tm-ribbon" d="M16 4h7l-4 14h-7zM32 4h-7l4 14h7z"/><circle class="tm-disc" cx="24" cy="29" r="13"/><path class="tm-star" d="m24 21.5 2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8Z"/></svg>';
    el.innerHTML = '<span class="toast-pic">' + pic + '</span><span class="toast-text"><span class="toast-kind">' +
      esc(t.kind === 'ach' ? '得到新稱號' : t.kind === 'unlock' ? '打開新地方' : '打造好了') +
      '</span><strong class="toast-title">' + esc(t.title) + '</strong>' +
      (t.sub ? '<span class="toast-sub">' + esc(t.sub) + '</span>' : '') + '</span>';
    el.hidden = false;
    el.classList.remove('is-out');
    say((t.kind === 'ach' ? '得到新稱號：' : '') + t.title + (t.sub ? '。' + t.sub : ''));
    window.setTimeout(function () {
      el.classList.add('is-out');
      window.setTimeout(nextToast, 260);
    }, 3200);
  }

  /* ─────────────────────────────────────────────────────────────
     飛到頂列的金幣、石頭
     ───────────────────────────────────────────────────────────── */

  var flyLayer = $('flyLayer');
  var flying = 0;

  function tileScreen(i) {
    var r = board.getBoundingClientRect();
    var s = r.width / N;
    return { x: r.left + (E.col(i) + 0.5) * s, y: r.top + (E.row(i) + 0.5) * s, s: s };
  }

  function fly(icon, i, targetId, n) {
    var target = $(targetId);
    if (!target) return;
    if (still() || !document.body.animate || target.offsetParent === null) { bump(target); return; }
    n = Math.min(n || 1, 4);
    var from = tileScreen(i);
    var tr = target.getBoundingClientRect();
    for (var k = 0; k < n; k++) {
      if (flying >= 20) { bump(target); return; }
      flying++;
      var el = document.createElement('img');
      el.className = 'flyer';
      el.src = ART.iconUrl(icon);
      el.alt = '';
      flyLayer.appendChild(el);
      var sx = from.x - 12 + (k - (n - 1) / 2) * 9, sy = from.y - 12 - k * 4;
      var ex = tr.left + tr.width / 2 - 12, ey = tr.top + tr.height / 2 - 12;
      var midX = (sx + ex) / 2 + (k % 2 ? 30 : -30), midY = Math.min(sy, ey) - 40;
      var a = el.animate([
        { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.6)', opacity: 0 },
        { transform: 'translate(' + sx + 'px,' + (sy - 10) + 'px) scale(1.05)', opacity: 1, offset: 0.15 },
        { transform: 'translate(' + midX + 'px,' + midY + 'px) scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(.7)', opacity: 0.9 }
      ], { duration: 640 + k * 70, easing: 'cubic-bezier(.45,0,.55,1)', delay: k * 50, fill: 'both' });
      a.onfinish = (function (node) {
        return function () { node.remove(); flying--; bump(target); };
      })(el);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     事件 → 畫面效果
     ───────────────────────────────────────────────────────────── */

  function floatText(i, text, color, dy) {
    UI.floats.push({ x: E.col(i) * 16 + 8, y: E.row(i) * 16 + 2 + (dy || 0), text: text, color: color || '#FFF0A8', t: 0 });
    if (UI.floats.length > 24) UI.floats.shift();
  }

  function burst(i, colors, n, up) {
    if (still()) return;
    var x0 = E.col(i) * 16 + 8, y0 = E.row(i) * 16 + 9;
    for (var k = 0; k < n; k++) {
      var a = Math.random() * Math.PI * 2, v = 10 + Math.random() * 22;
      UI.parts.push({ x: x0 + Math.cos(a) * 3, y: y0 + Math.sin(a) * 3, vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (up ? 26 : 8), g: up ? 40 : 30, life: 0.5 + Math.random() * 0.35, t: 0,
        c: colors[k % colors.length] });
    }
    if (UI.parts.length > 220) UI.parts.splice(0, UI.parts.length - 220);
  }

  var GOLD = ['#FFD84A', '#F7C531', '#FFF0A8'];
  var DUST = ['#D6C3A0', '#BFA982', '#FFF4E0'];

  function handle(ev) {
    ev.forEach(function (e) {
      switch (e.t) {
        case 'collect':
          if (e.coins) { floatText(e.i, '+' + fmt(e.coins)); fly('coin', e.i, 'hudCoinIcon', e.coins >= 20 ? 3 : e.coins >= 6 ? 2 : 1); }
          if (e.stone) { floatText(e.i, '+' + e.stone, '#EDE7DF', e.coins ? -6 : 0); fly('stone', e.i, 'resStoneImg', Math.min(3, e.stone)); }
          if (e.ore) { floatText(e.i, '+' + e.ore, '#FFD84A', -7); fly('ore', e.i, 'resOreImg', Math.min(2, e.ore)); }
          burst(e.i, e.icon === 'stone' || e.icon === 'ore' ? DUST : GOLD, 6, true);
          break;
        case 'deposit':
          if (e.coins) { floatText(e.i, '+' + fmt(e.coins)); fly('coin', e.i, 'hudCoinIcon', e.coins >= 40 ? 2 : 1); }
          if (e.stone) fly('stone', e.i, 'resStoneImg', 1);
          if (e.ore) fly('ore', e.i, 'resOreImg', 1);
          break;
        case 'pick':
          burst(e.i, e.icon === 'stone' || e.icon === 'ore' ? DUST : ['#95D163', '#6DB54B'], 3, true);
          break;
        case 'pull':
          UI.shots.push({ from: e.from, to: e.i, icon: e.icon, t: 0 });
          break;
        case 'soup':
          burst(e.i, ['#F98B2A', '#FFD84A', '#EF5350', '#6DB54B'], 8, true);
          break;
        case 'dig':
          if (Math.random() < 0.6) burst(e.i, DUST, 2, true);
          break;
        case 'interest':
          floatText(e.i, '+' + fmt(e.coins));
          fly('coin', e.i, 'hudCoinIcon', e.coins >= 100 ? 3 : 2);
          burst(e.i, GOLD, 6, true);
          break;
        case 'place':
          UI.pops[e.i] = UI.clock;
          burst(e.i, CFG.crops[e.kind] ? ['#9A6640', '#B9825A'] : DUST, CFG.crops[e.kind] ? 3 : 8, false);
          terrainDirty = true;
          break;
        case 'remove':
        case 'move':
          if (e.from !== undefined) burst(e.from, DUST, 6, false);
          UI.pops[e.i] = UI.clock;
          burst(e.i, DUST, 6, false);
          terrainDirty = true;
          break;
        case 'robot':
          UI.pops['r' + e.id] = UI.clock;
          floatText(e.i, '新朋友！', '#FFFFFF');
          break;
        case 'unlock':
          UI.clouds[e.region] = UI.clock;
          terrainDirty = true;
          toast('unlock', '打開了' + CFG.regions[e.region].name + '！', REGION_TEXT[e.region], 'lock');
          renderTools(true);
          break;
        case 'forgeStart':
          burst(e.i, ['#FFD54A', '#FF8C1A'], 8, true);
          break;
        case 'forged':
          burst(e.i, ['#FFD54A', '#FF8C1A', '#FFFFFF'], 14, true);
          toast('forge', CFG.recipes[e.id].name, CFG.recipes[e.id].desc, RECIPE_ICON[e.id]);
          break;
        case 'orb':
          burst(e.i, ['#D9B8FF', '#9C6BE0', '#8FF0E8'], 12, true);
          floatText(e.i, '寶珠 +1', '#D9B8FF');
          fly('orb', e.i, 'resOrbImg', 1);
          break;
        case 'bankUp':
          burst(e.i, GOLD, 12, true);
          break;
        case 'ach':
          var a = E.ACH.filter(function (x) { return x.id === e.id; })[0];
          if (a) toast('ach', a.name, a.how);
          break;
        case 'goal':
          goalDone(e.text);
          break;
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     畫農場
     ───────────────────────────────────────────────────────────── */

  var art = ART.build();
  var SP = art.sprites;
  var terrain = document.createElement('canvas');
  terrain.width = terrain.height = 128;
  var terrainDirty = true;
  var animCache = {};

  function buildTerrain() {
    var ctx = terrain.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    for (var i = 0; i < N * N; i++) {
      var f = E.floorOf(i), b = S.tiles[i];
      if (f === 'W' || f === 'L') continue;
      var x = E.col(i) * 16, y = E.row(i) * 16;
      ctx.drawImage(ART.ground(f, i * 7 + 1, b && b.k === 'crop', E.WET[i]), x, y);
      if (f === 'R') ctx.drawImage(ART.hash(i * 3) < 0.5 ? SP.boulder : SP.boulderFlip, x, y);
    }
    terrainDirty = false;
  }

  function animTile(i, frame) {
    var key = i + ':' + frame;
    if (!animCache[key]) {
      if (E.floorOf(i) === 'W') {
        var c = E.col(i), r = E.row(i);
        var left = c > 0 && E.floorOf(E.at(c - 1, r)) === 'W', right = c < N - 1 && E.floorOf(E.at(c + 1, r)) === 'W';
        animCache[key] = ART.water(i, frame, !left, !right);
      } else animCache[key] = ART.lava(i, frame);
    }
    return animCache[key];
  }

  /* 一個邏輯像素 = P 個裝置像素；四捨五入對齊，格子之間才不會有縫 */
  var P = 1, ctxNow = null;
  function R(v) { return Math.round(v * P); }
  function blit(im, lx, ly, lw, lh) {
    var x = R(lx), y = R(ly);
    ctxNow.drawImage(im, x, y, R(lx + (lw || im.width)) - x, R(ly + (lh || im.height)) - y);
  }
  function rect(lx, ly, lw, lh, color) {
    var x = R(lx), y = R(ly);
    ctxNow.fillStyle = color;
    ctxNow.fillRect(x, y, R(lx + lw) - x, R(ly + lh) - y);
  }

  var REGION_BOX = {
    river: [5, 4, 3, 4], mountain: [0, 0, 4, 4], volcano: [4, 0, 4, 4]
  };

  function drawScene(ctx, scale, t, interactive) {
    ctxNow = ctx;
    P = scale;
    ctx.imageSmoothingEnabled = false;
    if (terrainDirty) buildTerrain();
    ctx.drawImage(terrain, 0, 0, R(128), R(128));
    var frame = still() ? 0 : Math.floor(t / 0.45) % 3;
    var i, x, y, b;

    for (i = 0; i < N * N; i++) {
      var f = E.floorOf(i);
      if (f === 'W' || f === 'L') blit(animTile(i, frame), E.col(i) * 16, E.row(i) * 16);
    }

    /* 選了燈塔：每一格被照到幾次（越亮越多） */
    if (interactive && UI.tool === 'lighthouse') {
      for (i = 0; i < N * N; i++) {
        if (S.mult[i] > 1 && S.regions[E.regionOf(i)]) rect(E.col(i) * 16, E.row(i) * 16, 16, 16, 'rgba(255,224,102,' + Math.min(0.5, 0.18 * (S.mult[i] - 1)) + ')');
      }
    }
    if (interactive && UI.sheetTile >= 0 && S.tiles[UI.sheetTile] && S.tiles[UI.sheetTile].k === 'lighthouse') {
      E.N8[UI.sheetTile].forEach(function (j) { rect(E.col(j) * 16, E.row(j) * 16, 16, 16, 'rgba(255,224,102,.42)'); });
    }

    for (i = 0; i < N * N; i++) {
      b = S.tiles[i];
      if (!b) continue;
      x = E.col(i) * 16;
      y = E.row(i) * 16;
      var pop = UI.pops[i] !== undefined ? (t - UI.pops[i]) : 9;
      var sc = 1;
      if (pop < 0.28 && !still()) sc = pop < 0.16 ? 0.6 + pop / 0.16 * 0.5 : 1.1 - (pop - 0.16) / 0.12 * 0.1;
      drawTile(i, b, x, y, sc, t);
    }

    /* 收成倍數：右上角的「x2」 */
    for (i = 0; i < N * N; i++) {
      b = S.tiles[i];
      if (!b || (b.k !== 'crop' && b.k !== 'quarry') || S.mult[i] < 2) continue;
      badge(E.col(i) * 16 + 16, E.row(i) * 16, '×' + S.mult[i]);
    }

    drawShots(t);
    drawRobots(t);
    drawParts();
    if (interactive) drawHighlights();
    drawLocked(t, interactive);
    drawFloats();
    if (interactive && UI.keyboard && document.activeElement === board) {
      var cxp = E.col(UI.cursor) * 16, cyp = E.row(UI.cursor) * 16;
      rect(cxp, cyp, 16, 1, '#FFFFFF'); rect(cxp, cyp + 15, 16, 1, '#FFFFFF');
      rect(cxp, cyp, 1, 16, '#FFFFFF'); rect(cxp + 15, cyp, 1, 16, '#FFFFFF');
      rect(cxp + 1, cyp + 1, 14, 1, '#C2410C'); rect(cxp + 1, cyp + 14, 14, 1, '#C2410C');
      rect(cxp + 1, cyp + 1, 1, 14, '#C2410C'); rect(cxp + 14, cyp + 1, 1, 14, '#C2410C');
    }
  }

  /* 小小的深色膠囊、黃字：只佔格子右上角，不蓋住菜 */
  function badge(rx, ty, text) {
    var ctx = ctxNow;
    var fs = Math.max(9, R(4.1));
    ctx.save();
    ctx.font = '800 ' + fs + 'px ' + NUM_FONT;
    var h = Math.round(fs * 1.2), w = Math.round(ctx.measureText(text).width + fs * 0.6);
    var x = R(rx) - w - R(0.6), y = R(ty) + R(0.6);
    ctx.fillStyle = 'rgba(43,27,23,.8)';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#FFE066';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + fs * 0.05);
    ctx.restore();
  }

  function drawScaled(im, x, y, sc) {
    if (sc === 1) { blit(im, x, y); return; }
    var w = 16 * sc;
    blit(im, x + (16 - w) / 2, y + 16 - w, w, w);
  }

  function drawTile(i, b, x, y, sc, t) {
    var bob = still() ? 0 : Math.round(Math.sin(t * 2.4 + i) * 0.6);
    switch (b.k) {
      case 'crop':
        var stage = b.ready ? 2 : b.g < 0.34 ? 0 : 1;
        var im = stage === 0 ? SP.sprout : SP[b.crop + stage];
        drawScaled(im, x, y + (b.ready ? Math.min(0, bob) : 0), sc);
        if (b.ready && !still()) {
          var ph = (t * 0.8 + ART.hash(i) * 7) % 1;
          if (ph < 0.18) {
            var sx = x + 3 + Math.floor(ART.hash(i * 5 + Math.floor(t * 0.8)) * 10), sy = y + 2 + Math.floor(ART.hash(i * 9 + Math.floor(t * 0.8)) * 6);
            rect(sx, sy - 1, 1, 3, '#FFFFFF');
            rect(sx - 1, sy, 3, 1, '#FFFFFF');
          }
        }
        if (S.tools.hoe && b.ready) rect(x + 1, y + 15, 14, 1, 'rgba(255,216,74,.9)');
        break;
      case 'lighthouse':
        var glow = still() ? 0.5 : 0.4 + 0.25 * Math.sin(t * 2.2 + i);
        var gx = R(x + 8), gy = R(y + 4.5);
        var grd = ctxNow.createRadialGradient(gx, gy, 0, gx, gy, R(9));
        grd.addColorStop(0, 'rgba(255,240,168,' + glow + ')');
        grd.addColorStop(1, 'rgba(255,240,168,0)');
        ctxNow.fillStyle = grd;
        ctxNow.fillRect(gx - R(9), gy - R(9), R(18), R(18));
        drawScaled(SP.lighthouse, x, y, sc);
        break;
      case 'quarry':
        drawScaled(SP.quarry, x, y, sc);
        var spots = [[3, 6], [6, 6], [9, 6], [11, 6], [4, 5], [7, 5], [10, 5], [5, 4], [8, 4], [6, 3], [9, 3], [7, 2]];
        for (var k = 0; k < b.items.length && k < spots.length; k++) {
          blit(art.pebbles[b.items[k]], x + spots[k][0], y + spots[k][1]);
        }
        if (b.items.length >= CFG.quarry.cap) badgeFull(x, y);
        break;
      case 'pot':
        var cooking = b.cook >= 0;
        if (cooking && !still()) blit(SP.fire, x, y + (frame3(t) ? 0 : 0));
        drawScaled(cooking ? SP.potCook : SP.pot, x, y, sc);
        if (cooking) {
          if (!still() && Math.random() < 0.08) UI.parts.push({ x: x + 5 + Math.random() * 6, y: y + 4, vx: 0, vy: -9, g: 0, life: 0.9, t: 0, c: 'rgba(255,255,255,.8)' });
          rect(x + 2, y + 1, 12 * Math.min(1, b.cook / CFG.pot.cook), 1, '#FFD84A');
        }
        /* 鍋子上面三個小方塊：蘿蔔、玉米、番茄，拿到的會亮 */
        var colors = { carrot: '#F98B2A', corn: '#FFD84A', tomato: '#EF5350' };
        E.CROP_ORDER.forEach(function (c, n) {
          var px = x + 3 + n * 4;
          rect(px - 0.5, y + 2.5 - 0.5, 4, 4, '#2B1B17');
          rect(px, y + 2.5, 3, 3, b.has[c] ? colors[c] : '#8D867B');
        });
        for (var w = 0; w < b.bowls.length; w++) blit(art.bowl, x + 11, y + 13 - w * 3);
        break;
      case 'barn':
        drawScaled(SP.barn, x, y, sc);
        break;
      case 'forge':
        drawScaled(b.job ? SP.forge : SP.forgeIdle, x, y, sc);
        if (b.job) {
          var pct = Math.min(1, b.t / CFG.recipes[b.job].time);
          rect(x + 2, y + 14, 12, 2, '#2B1B17');
          rect(x + 2, y + 14, 12 * pct, 2, '#FFD54A');
          if (!still() && Math.random() < 0.12) UI.parts.push({ x: x + 7 + Math.random() * 2, y: y + 9, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 15, g: 50, life: 0.5, t: 0, c: '#FFD54A' });
        }
        break;
      case 'altar':
        blit(SP.altar, x, y + (still() ? 0 : Math.round(Math.sin(t * 1.6) * 0.8)), 16, 8);
        ctxNow.drawImage(SP.altar, 0, 8, 16, 8, R(x), R(y + 8), R(x + 16) - R(x), R(y + 16) - R(y + 8));
        break;
      case 'bank':
        drawScaled(SP.bank, x, y + Math.max(0, bob), sc);
        rect(x + 3, y + 14, 10, 1, 'rgba(43,27,23,.25)');
        break;
    }
  }

  function frame3(t) { return Math.floor(t / 0.15) % 2; }

  /* 推車滿了：小小的「滿」，提醒用手收或多買機器人 */
  function badgeFull(x, y) {
    rect(x, y, 6, 6, 'rgba(185,28,28,.92)');
    rect(x + 2, y + 1, 2, 3, '#FFFFFF');
    rect(x + 2, y + 5 - 0.001, 2, 0, '#FFFFFF');
    rect(x + 2, y + 4.4, 2, 0.9, '#FFFFFF');
  }

  function drawShots(t) {
    UI.shots = UI.shots.filter(function (s) { return s.t < 0.42; });
    UI.shots.forEach(function (s) {
      var k = Math.min(1, s.t / 0.42);
      var x0 = E.col(s.from) * 16 + 4, y0 = E.row(s.from) * 16 + 4;
      var x1 = E.col(s.to) * 16 + 4, y1 = E.row(s.to) * 16 + 2;
      var xx = x0 + (x1 - x0) * k, yy = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 10;
      blit(art.icons[s.icon], Math.round(xx), Math.round(yy));
    });
  }

  function drawRobots(t) {
    var list = S.robots.slice().sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (Rb) {
      var x = Math.round(Rb.x * 16 - 8), y = Math.round(Rb.y * 16 - 11);
      var bob = still() ? 0 : Math.round(Math.sin(t * 6 + Rb.id) * 0.7);
      rect(x + 5, Math.round(Rb.y * 16 + 4), 6, 1, 'rgba(43,27,23,.28)');
      var popT = UI.pops['r' + Rb.id] !== undefined ? t - UI.pops['r' + Rb.id] : 9;
      var im = !still() && frame3(t + Rb.id * 0.07) ? SP.robot2 : SP.robot;
      if (popT < 0.3 && !still()) {
        var sc = 0.4 + popT / 0.3 * 0.6;
        blit(im, x + 8 - 8 * sc, y + 16 - 16 * sc + bob, 16 * sc, 16 * sc);
      } else blit(im, x, y + bob);
      if (Rb.carry && Rb.carry.n && Rb.carry.icon) blit(art.icons[Rb.carry.icon], x + 4, y - 7 + bob);
    });
  }

  function drawParts() {
    UI.parts.forEach(function (q) {
      if (q.t >= q.life) return;
      rect(Math.round(q.x), Math.round(q.y), 1, 1, q.c);
    });
  }

  function drawFloats() {
    var ctx = ctxNow;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var size = Math.max(11, R(5.2));
    ctx.font = '800 ' + size + 'px ' + NUM_FONT;
    UI.floats.forEach(function (f) {
      if (f.t > 1.1) return;
      var k = f.t / 1.1;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      var yy = R(f.y - (still() ? 0 : k * 10));
      ctx.lineWidth = Math.max(3, size * 0.28);
      ctx.strokeStyle = 'rgba(43,27,23,.9)';
      ctx.strokeText(f.text, R(f.x), yy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, R(f.x), yy);
    });
    ctx.restore();
  }

  var NUM_FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "PingFang TC", "Noto Sans TC", system-ui, sans-serif';

  /* 選了工具：可以蓋的格子框綠框，不行的暗一點 */
  function drawHighlights() {
    var mode = UI.moveFrom >= 0 ? 'move' : UI.tool !== 'hand' ? 'tool' : null;
    if (!mode) return;
    for (var i = 0; i < N * N; i++) {
      if (!S.regions[E.regionOf(i)]) continue;
      var ok = mode === 'move' ? (i === UI.moveFrom || !E.canMove(S, UI.moveFrom, i)) : !E.canPlace(S, UI.tool, i, true);
      var x = E.col(i) * 16, y = E.row(i) * 16;
      if (!ok) { rect(x, y, 16, 16, 'rgba(43,27,23,.34)'); continue; }
      if (mode === 'move' && i === UI.moveFrom) {
        rect(x, y, 16, 16, 'rgba(255,255,255,.25)');
        continue;
      }
      var c = '#B7F07A';
      rect(x + 1, y + 1, 14, 1, c); rect(x + 1, y + 14, 14, 1, c);
      rect(x + 1, y + 1, 1, 14, c); rect(x + 14, y + 1, 1, 14, c);
    }
    if (mode === 'move') {
      var mx = E.col(UI.moveFrom) * 16, my = E.row(UI.moveFrom) * 16;
      rect(mx, my, 16, 1, '#FFD84A'); rect(mx, my + 15, 16, 1, '#FFD84A');
      rect(mx, my, 1, 16, '#FFD84A'); rect(mx + 15, my, 1, 16, '#FFD84A');
    }
  }

  /* 還沒打開的地區：一層奶油色的霧、幾朵雲、鎖頭和價錢。剛打開時雲往兩邊散開 */
  function drawLocked(t, interactive) {
    Object.keys(REGION_BOX).forEach(function (id) {
      var bx = REGION_BOX[id], x = bx[0] * 16, y = bx[1] * 16, w = bx[2] * 16, h = bx[3] * 16;
      var open = S.regions[id];
      var since = UI.clouds[id] !== undefined ? t - UI.clouds[id] : 9;
      if (open && (since > 1.2 || still())) return;
      var k = open ? Math.min(1, since / 1.2) : 0;
      ctxNow.save();
      ctxNow.globalAlpha = 1 - k;
      rect(x, y, w, h, 'rgba(255,244,224,.8)');
      for (var n = 0; n < 5; n++) {
        var hx = ART.hash(n * 13 + id.length * 7), hy = ART.hash(n * 29 + id.length * 3);
        var dir = hx < 0.5 ? -1 : 1;
        var cx = x + hx * (w - 16) + (still() ? 0 : Math.sin(t * 0.35 + n) * 2) + dir * k * 40;
        var cy = y + 2 + hy * (h - 12);
        blit(SP.cloud, Math.round(cx), Math.round(cy));
      }
      ctxNow.restore();
      if (open) return;
      /* 價錢牌 */
      var cost = CFG.regions[id].cost;
      var can = E.afford(S, cost);
      var ctx = ctxNow;
      var cxm = R(x + w / 2), cym = R(y + h / 2);
      var fs = Math.max(12, R(5.6));
      ctx.save();
      ctx.font = '800 ' + fs + 'px ' + NUM_FONT;
      var name = CFG.regions[id].name;
      var priceText = fmt(cost.coins) + (cost.stone ? '  ' + fmt(cost.stone) : '');
      var tw = Math.max(ctx.measureText(name).width, ctx.measureText(priceText).width + fs * 1.3 * (cost.stone ? 2 : 1));
      var bw = tw + fs * 1.6, bh = fs * 3.3;
      var bxp = cxm - bw / 2, byp = cym - bh / 2;
      ctx.fillStyle = can ? '#FFEDD5' : '#FFFFFF';
      ctx.strokeStyle = can ? '#C2410C' : '#9C8578';
      ctx.lineWidth = Math.max(2, fs * 0.14);
      roundRect(ctx, bxp, byp, bw, bh, fs * 0.6);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#7C2D12';
      ctx.fillText(name, cxm, byp + fs * 1.05);
      var iconS = fs * 1.05;
      var lineY = byp + fs * 2.3;
      ctx.imageSmoothingEnabled = false;
      var startX = cxm - (ctx.measureText(priceText).width + iconS * (cost.stone ? 2 : 1) + 4) / 2;
      ctx.drawImage(art.icons.coin, startX, lineY - iconS / 2, iconS, iconS);
      ctx.textAlign = 'left';
      ctx.fillStyle = can ? '#C2410C' : '#57534E';
      var coinsText = fmt(cost.coins);
      ctx.fillText(coinsText, startX + iconS + 3, lineY + 1);
      if (cost.stone) {
        var sx = startX + iconS + 3 + ctx.measureText(coinsText + '  ').width;
        ctx.drawImage(art.icons.stone, sx, lineY - iconS / 2, iconS, iconS);
        ctx.fillText(fmt(cost.stone), sx + iconS + 3, lineY + 1);
      }
      ctx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ─────────────────────────────────────────────────────────────
     大小：整個農場是正方形，塞滿頂列和工具列中間的空間
     ───────────────────────────────────────────────────────────── */

  function fitBoard() {
    var w = boardWrap.clientWidth, h = boardWrap.clientHeight;
    if (!w || !h) return;
    var size = Math.floor(Math.min(w, h));
    board.style.width = size + 'px';
    board.style.height = size + 'px';
    var dpr = window.devicePixelRatio || 1;
    var px = Math.round(size * dpr);
    if (board.width !== px) { board.width = px; board.height = px; }
  }

  if (window.ResizeObserver) new ResizeObserver(function () { if (UI.playing) fitBoard(); }).observe(boardWrap);
  window.addEventListener('resize', function () { if (UI.playing) fitBoard(); });

  /* ─────────────────────────────────────────────────────────────
     手指：點一下 = 收成／蓋／看看；拖過去 = 一路收成或一路種
     ───────────────────────────────────────────────────────────── */

  var drag = null;

  function tileAt(ev) {
    var r = board.getBoundingClientRect();
    var c = Math.floor((ev.clientX - r.left) / r.width * N), rr = Math.floor((ev.clientY - r.top) / r.height * N);
    if (c < 0 || c >= N || rr < 0 || rr >= N) return -1;
    return E.at(c, rr);
  }

  board.addEventListener('pointerdown', function (ev) {
    if (drag || ev.button > 0) return;
    var i = tileAt(ev);
    if (i < 0) return;
    ev.preventDefault();
    UI.keyboard = false;
    try { board.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
    drag = { id: ev.pointerId, start: i, last: i, swept: false, done: {} };
  });

  board.addEventListener('pointermove', function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var i = tileAt(ev);
    if (i < 0 || i === drag.last) return;
    /* 第一次離開起點：起點也算進去 */
    if (!drag.swept) { drag.swept = true; sweep(drag.start); }
    drag.last = i;
    sweep(i);
  });

  function endDrag(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (ev.type === 'pointercancel') return;
    if (!d.swept) tap(d.start);
  }
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);

  /* 拖過去：手 → 收成；菜 → 種；房子不拖（一次只蓋一個，避免蓋錯） */
  function sweep(i) {
    if (!drag || drag.done[i]) return;
    drag.done[i] = true;
    if (UI.moveFrom >= 0) return;
    if (UI.tool === 'hand') {
      if (E.available(S, i, true) > 0) { var ev = []; E.collect(S, i, ev); handle(ev); }
    } else if (CFG.crops[UI.tool]) {
      if (!S.tiles[i] || (S.tiles[i].k === 'crop' && S.tiles[i].crop !== UI.tool)) placeAt(i, true);
    }
  }

  function tap(i) {
    UI.cursor = i;
    if (UI.moveFrom >= 0) {
      if (i === UI.moveFrom) { UI.moveFrom = -1; renderGoal(true); return; }
      var ev = [];
      var r = E.move(S, UI.moveFrom, i, ev);
      if (r) { hint(r === 'busy' ? '要搬到空地上' : why(r, S.tiles[UI.moveFrom].k), 1800); return; }
      UI.moveFrom = -1;
      handle(ev);
      renderGoal(true);
      return;
    }
    var region = E.regionOf(i);
    if (!S.regions[region]) { openRegion(region); return; }
    if (UI.tool === 'hand') {
      if (E.available(S, i, true) > 0) { var ev2 = []; E.collect(S, i, ev2); handle(ev2); return; }
      if (S.tiles[i]) { openSheet(i); return; }
      var f = E.floorOf(i);
      if (f === 'R') hint('大石頭：在旁邊蓋採石場，就會開始挖', 2200);
      else if (f === 'L') hint('岩漿好燙！在旁邊蓋鍛造爐', 2200);
      else if (f === 'W') hint('小河：河邊的菜長得比較快', 2200);
      else hint('選下面的工具，在這裡種菜或蓋東西', 2000);
      return;
    }
    placeAt(i, false);
  }

  function placeAt(i, quiet) {
    var ev = [];
    var r = E.place(S, UI.tool, i, ev);
    if (!r) { handle(ev); renderTools(); return; }
    if (quiet && r !== 'money') return;
    if (r === 'money') {
      var c = E.price(S, UI.tool);
      hint(short(c) || '金幣不夠', 1800);
      shake($('hudCoins'));
      return;
    }
    if (r === 'busy' && S.tiles[i]) {
      if (UI.tool === 'hand') return;
      hint('這裡已經有' + NAME[S.tiles[i].k === 'crop' ? S.tiles[i].crop : S.tiles[i].k] + '了', 1600);
      return;
    }
    hint(why(r, UI.tool), 2000);
  }

  /* 鍵盤：方向鍵移動框框、Enter／空白鍵 = 點一下、Esc = 換回收成 */
  board.addEventListener('keydown', function (ev) {
    var c = E.col(UI.cursor), r = E.row(UI.cursor);
    var moved = true;
    if (ev.key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (ev.key === 'ArrowRight') c = Math.min(N - 1, c + 1);
    else if (ev.key === 'ArrowUp') r = Math.max(0, r - 1);
    else if (ev.key === 'ArrowDown') r = Math.min(N - 1, r + 1);
    else moved = false;
    if (moved) {
      ev.preventDefault();
      UI.keyboard = true;
      UI.cursor = E.at(c, r);
      say(describe(UI.cursor));
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      UI.keyboard = true;
      tap(UI.cursor);
    } else if (ev.key === 'Escape') {
      if (UI.moveFrom >= 0) { UI.moveFrom = -1; renderGoal(true); } else if (UI.tool !== 'hand') setTool('hand');
    }
  });
  board.addEventListener('focus', function () { if (UI.keyboard) say(describe(UI.cursor)); });

  function describe(i) {
    var pos = '第 ' + (E.row(i) + 1) + ' 排第 ' + (E.col(i) + 1) + ' 格，';
    var reg = E.regionOf(i);
    if (!S.regions[reg]) return pos + CFG.regions[reg].name + '，還沒打開';
    var b = S.tiles[i];
    var f = E.floorOf(i);
    if (!b) return pos + ({ G: '草地', S: '碎石地', B: '火山岩地', R: '大石頭', W: '小河', L: '岩漿' })[f];
    if (b.k === 'crop') return pos + CFG.crops[b.crop].name + (b.ready ? '，熟了' : '，還在長') + (S.mult[i] > 1 ? '，' + S.mult[i] + ' 倍' : '');
    var n = E.available(S, i, true);
    return pos + NAME[b.k] + (n ? '，有 ' + n + ' 個可以收' : '');
  }

  /* ─────────────────────────────────────────────────────────────
     小視窗：點房子、點雲朵
     ───────────────────────────────────────────────────────────── */

  var sheetHtml = '';

  function openSheet(i) {
    UI.sheetTile = i;
    UI.sheetRegion = null;
    sheetHtml = '';
    refreshSheet();
    showSheet();
  }

  /* 打開時焦點放在標題（不是關閉鈕）：報讀先念名字，手指點開也不會出現焦點框 */
  var sheetOpenedAt = 0;
  function showSheet() {
    if (!sheet.open) { sheet.showModal(); sheetOpenedAt = performance.now(); }
    var t = $('sheetTitle');
    if (t) t.focus({ preventScroll: true });
  }

  function openRegion(id) {
    UI.sheetTile = -1;
    UI.sheetRegion = id;
    sheetHtml = '';
    refreshSheet();
    showSheet();
  }

  function row(label, value) {
    return '<div class="sh-row"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function perMin(x) { return '每分鐘大約 ' + fmt(Math.round(x)); }

  function sheetSpec() {
    var head, body = '', acts = '';
    if (UI.sheetRegion) {
      var id = UI.sheetRegion, cost = CFG.regions[id].cost;
      var can = !E.canUnlock(S, id);
      head = { title: '打開' + CFG.regions[id].name, icon: img('lock', false, 'sh-icon') };
      body = '<p class="sh-lede">' + esc(REGION_TEXT[id]) + '</p>';
      acts = '<button class="btn btn-primary" type="button" data-act="unlock"' + (can ? '' : ' aria-disabled="true"') + '>' +
        '<span>打開</span>' + costHtml(cost) + '</button>' +
        (can ? '' : '<p class="sh-short">' + esc(short(cost)) + '</p>');
      return { head: head, body: body, acts: acts };
    }
    var i = UI.sheetTile, b = S.tiles[i];
    if (!b) return null;
    var name = b.k === 'crop' ? CFG.crops[b.crop].name : NAME[b.k];
    head = { title: name, icon: img(b.k === 'crop' ? b.crop + '2' : SPRITE_OF[b.k], true, 'sh-icon') };
    var info = '';
    var canMove = b.k !== 'crop';
    var refund = b.paid && (b.paid.coins || b.paid.stone) ? '退回 ' + [b.paid.coins ? fmt(b.paid.coins) + ' 金幣' : '', b.paid.stone ? fmt(b.paid.stone) + ' 石頭' : ''].filter(Boolean).join('、') : '';

    if (b.k === 'crop') {
      var ct = E.cropTime(S, i);
      info += row('多久收一次', ct.toFixed(1) + ' 秒' + (E.WET[i] ? '（河邊，快 1.5 倍）' : ''));
      info += row('一次幾個金幣', fmt(E.cropValue(S, i)) + (S.mult[i] > 1 ? '（燈塔 ' + S.mult[i] + ' 倍）' : ''));
      info += row('產量', perMin(E.cropValue(S, i) * 60 / ct));
      info += row('現在', b.ready ? '熟了！' : '長了 ' + Math.floor(b.g * 100) + '%');
    } else if (b.k === 'lighthouse') {
      var lit = E.N8[i].filter(function (j) { return S.tiles[j] && (S.tiles[j].k === 'crop' || S.tiles[j].k === 'quarry'); }).length;
      body += '<p class="sh-lede">照到旁邊 8 格（黃色的格子）：菜和採石場的收成多 1 倍。兩座燈塔一起照，就是 3 倍！</p>';
      info += row('現在照到', lit + ' 塊田或採石場');
    } else if (b.k === 'barn') {
      body += '<p class="sh-lede">機器人把收成送來這裡：菜和湯換成金幣，石頭和金礦收起來。</p>';
      info += row('機器人', S.robots.length + ' / ' + CFG.robot.max + ' 個');
      info += row('每個機器人一次拿', E.robotCap(S) + ' 個');
      var rc = E.price(S, 'robot');
      if (S.robots.length < CFG.robot.max) {
        acts += '<button class="btn btn-primary" type="button" data-act="robot"' + (E.afford(S, rc) ? '' : ' aria-disabled="true"') + '><span>買機器人</span>' + costHtml(rc) + '</button>';
      }
    } else if (b.k === 'quarry') {
      var qt = E.quarryTime(S, i);
      info += row('旁邊的大石頭', E.ROCKS[i] + ' 顆');
      info += row('挖一次', qt.toFixed(1) + ' 秒，' + E.quarryYield(S, i) + ' 個' + (S.mult[i] > 1 ? '（燈塔 ' + S.mult[i] + ' 倍）' : ''));
      info += row('推車', b.items.length + ' / ' + CFG.quarry.cap + (b.items.length >= CFG.quarry.cap ? '，滿了！' : ''));
      body += '<p class="sh-note">每 10 個大約有 1 個是金礦。</p>';
      if (b.items.length) acts += '<button class="btn btn-primary" type="button" data-act="collect">收起來（' + b.items.length + ' 個）</button>';
    } else if (b.k === 'pot') {
      var need = E.CROP_ORDER.filter(function (c) { return !b.has[c]; });
      var near = {};
      E.N8[i].forEach(function (j) { var t = S.tiles[j]; if (t && t.k === 'crop') near[t.crop] = true; });
      var miss = E.CROP_ORDER.filter(function (c) { return !near[c]; });
      body += '<p class="sh-lede">旁邊的蘿蔔、玉米、番茄熟了會自己跳進鍋子。三種都到齊，就煮成彩虹湯，值 2 倍！</p>';
      body += '<ul class="sh-need">' + E.CROP_ORDER.map(function (c) {
        return '<li class="' + (b.has[c] ? 'is-have' : '') + '">' + img(c) + '<span>' + CFG.crops[c].name + '</span><span class="sh-mark">' +
          (b.has[c] ? '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>到了' : '等一下') + '</span></li>';
      }).join('') + '</ul>';
      if (miss.length) body += '<p class="sh-warn">旁邊沒有' + miss.map(function (c) { return CFG.crops[c].name; }).join('、') + '的田，煮不了湯</p>';
      info += row('現在', b.cook >= 0 ? '煮湯中 ' + Math.floor(b.cook / CFG.pot.cook * 100) + '%' : need.length ? '還差 ' + need.length + ' 種菜' : '湯碗滿了，等機器人來拿');
      info += row('湯碗', b.bowls.length + ' / ' + CFG.pot.cap);
      if (b.bowls.length) acts += '<button class="btn btn-primary" type="button" data-act="collect">收起來（' + b.bowls.length + ' 碗）</button>';
    } else if (b.k === 'forge') {
      body += '<p class="sh-lede">旁邊有 ' + E.LAVA[i] + ' 格岩漿，打造快 ' + E.LAVA[i] + ' 倍。一次打造一件，打好就一直有效。</p>';
      if (b.job) {
        var rem = Math.max(0, (CFG.recipes[b.job].time - b.t) / (E.LAVA[i] * E.speed(S)));
        info += row('正在打造', esc(CFG.recipes[b.job].name) + '，還要 ' + Math.ceil(rem) + ' 秒');
      }
      body += '<ul class="sh-recipes">' + CFG.recipeOrder.map(function (id) {
        var r = CFG.recipes[id];
        var st = E.canForge(S, id);
        var right;
        if (S.tools[id]) right = '<span class="sh-done"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>有了</span>';
        else if (b.job === id) right = '<span class="sh-done">打造中</span>';
        else if (st === 'needs') right = '<span class="sh-note">先打造上面三件</span>';
        else right = '<button class="btn btn-primary btn-sm" type="button" data-act="forge" data-id="' + id + '"' +
          (st ? ' aria-disabled="true"' : '') + '>打造</button>';
        return '<li class="recipe">' + img(RECIPE_ICON[id], false, 'recipe-img') + '<span class="recipe-text"><strong>' + esc(r.name) + '</strong>' +
          '<span>' + esc(r.desc) + '</span>' + (S.tools[id] ? '' : costHtml(r.cost)) + '</span>' + right + '</li>';
      }).join('') + '</ul>';
    } else if (b.k === 'altar') {
      var op = E.orbPrice(S);
      body += '<p class="sh-lede">把多的石頭和金礦放上去，換成精靈寶珠。每一顆寶珠讓整個農場（菜、採石場、機器人、鍛造爐）快 10%，一直有效。</p>';
      info += row('精靈寶珠', S.orbs + ' 顆');
      info += row('農場速度', Math.round(E.speed(S) * 100) + '%');
      if (S.orbs < CFG.altar.max) {
        acts += '<button class="btn btn-primary" type="button" data-act="offer"' + (E.canOffer(S) ? ' aria-disabled="true"' : '') + '><span>換一顆</span>' + costHtml(op) + '</button>';
      }
    } else if (b.k === 'bank') {
      var L = CFG.bank.levels[b.level - 1];
      body += '<p class="sh-lede">每 5 秒，小豬會把你的金幣多給 ' + Math.round(L.rate * 100) + '%（一次最多 ' + fmt(L.cap) + '）。金幣越多，長得越快！</p>';
      info += row('等級', b.level + ' / ' + CFG.bank.levels.length);
      info += row('下一次利息', '+' + fmt(Math.min(L.cap, Math.floor(S.coins * L.rate))) + '（' + Math.ceil(CFG.bank.every - b.t) + ' 秒後）');
      info += row('總共給了', fmt(S.stats.interest) + ' 金幣');
      var up = E.bankUpPrice(S);
      if (up) {
        var nl = CFG.bank.levels[b.level];
        acts += '<button class="btn btn-primary" type="button" data-act="bankUp"' + (E.afford(S, up) ? '' : ' aria-disabled="true"') + '>' +
          '<span>升級：' + Math.round(nl.rate * 100) + '%，最多 ' + fmt(nl.cap) + '</span>' + costHtml(up) + '</button>';
      }
    }

    if (info) body += '<dl class="sh-info">' + info + '</dl>';
    var tail = '';
    if (canMove) tail += '<button class="btn btn-quiet" type="button" data-act="move">搬家</button>';
    var rm = E.canRemove(S, i);
    if (!rm) tail += '<button class="btn btn-quiet btn-two" type="button" data-act="remove"><span>拆掉</span>' +
      (refund ? '<small>' + esc(refund) + '</small>' : '') + '</button>';
    else if (rm === 'lastBarn') tail += '<p class="sh-note">最後一間倉庫不能拆，但可以搬家。</p>';
    acts += tail ? '<div class="sh-tail">' + tail + '</div>' : '';
    return { head: head, body: body, acts: acts };
  }

  function refreshSheet() {
    if (!sheet.open && sheetHtml) return;
    var spec = sheetSpec();
    if (!spec) { closeSheet(); return; }
    var html = '<div class="sh-head">' + spec.head.icon + '<h2 class="dlg-title" id="sheetTitle" tabindex="-1">' + esc(spec.head.title) + '</h2>' +
      '<button class="sh-close" type="button" data-act="close" aria-label="關閉"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>' +
      '<div class="sh-body">' + spec.body + '</div>' + (spec.acts ? '<div class="sh-acts">' + spec.acts + '</div>' : '');
    if (html === sheetHtml) return;
    var fk = document.activeElement && sheet.contains(document.activeElement) ?
      (document.activeElement.getAttribute('data-act') || '') + ':' + (document.activeElement.getAttribute('data-id') || '') : null;
    sheetHtml = html;
    sheetBody.innerHTML = html;
    if (fk) {
      var parts = fk.split(':');
      var sel = '[data-act="' + parts[0] + '"]' + (parts[1] ? '[data-id="' + parts[1] + '"]' : '');
      var el = sheetBody.querySelector(sel);
      if (el) el.focus();
    }
  }

  function closeSheet() {
    if (sheet.open) sheet.close();
  }

  sheet.addEventListener('close', function () {
    UI.sheetTile = -1;
    UI.sheetRegion = null;
    sheetHtml = '';
    if (UI.keyboard) board.focus();
  });

  /* 點背景關掉。手機放開手指時先開視窗、接著瀏覽器才補送 click：
     那個 click 會落在背景上，所以剛打開的半秒內不算（不然點上半部的房子，視窗會一開就關） */
  sheet.addEventListener('click', function (e) {
    if (e.target === sheet) { if (performance.now() - sheetOpenedAt > 500) closeSheet(); return; }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    var i = UI.sheetTile;
    var ev = [], r = null;
    if (act === 'close') { closeSheet(); return; }
    if (act === 'unlock') {
      r = E.unlock(S, UI.sheetRegion, ev);
      if (r === 'money') { hint(short(CFG.regions[UI.sheetRegion].cost), 1800); shake(b); return; }
      closeSheet();
    } else if (act === 'robot') {
      r = E.buyRobot(S, ev);
      if (r === 'money') { hint(short(E.price(S, 'robot')), 1800); shake(b); return; }
    } else if (act === 'collect') {
      E.collect(S, i, ev);
    } else if (act === 'forge') {
      var id = b.getAttribute('data-id');
      r = E.forge(S, id, ev);
      if (r === 'money') { hint(short(CFG.recipes[id].cost), 2000); shake(b); return; }
    } else if (act === 'offer') {
      r = E.offer(S, ev);
      if (r === 'money') { hint(short(E.orbPrice(S)), 2000); shake(b); return; }
    } else if (act === 'bankUp') {
      r = E.upgradeBank(S, ev);
      if (r === 'money') { hint(short(E.bankUpPrice(S)), 2000); shake(b); return; }
    } else if (act === 'move') {
      UI.moveFrom = i;
      UI.tool = 'hand';
      closeSheet();
      renderTools(true);
      renderGoal(true);
      say('搬家：點一格空地');
      return;
    } else if (act === 'remove') {
      r = E.remove(S, i, ev);
      if (r) { hint(why(r), 2000); return; }
      closeSheet();
    }
    handle(ev);
    renderHud(true);
    renderTools(true);
    sheetHtml = '';
    refreshSheet();
  });

  /* ─────────────────────────────────────────────────────────────
     選單（暫停）、稱號、重新開始
     ───────────────────────────────────────────────────────────── */

  $('menuBtn').addEventListener('click', function () {
    UI.paused = true;
    $('menuBadges').textContent = Object.keys(S.ach).length + ' / ' + E.ACH.length;
    menuDlg.showModal();
  });
  menuDlg.addEventListener('close', function () {
    if (!achDlg.open && !resetDlg.open) UI.paused = false;
  });
  menuDlg.addEventListener('click', function (e) {
    if (e.target === menuDlg || e.target.closest('[data-close]')) menuDlg.close();
  });

  $('achBtn').addEventListener('click', function () {
    renderAch();
    menuDlg.close();
    UI.paused = true;
    achDlg.showModal();
  });
  achDlg.addEventListener('close', function () { UI.paused = false; });
  achDlg.addEventListener('click', function (e) {
    if (e.target === achDlg || e.target.closest('[data-close]')) achDlg.close();
  });

  function renderAch() {
    $('achList').innerHTML = E.ACH.map(function (a) {
      var got = S.ach[a.id] !== undefined;
      return '<li class="ach' + (got ? ' is-got' : '') + '">' +
        '<svg viewBox="0 0 48 48" class="ach-medal" aria-hidden="true"><path class="tm-ribbon" d="M16 4h7l-4 14h-7zM32 4h-7l4 14h7z"/><circle class="tm-disc" cx="24" cy="29" r="13"/><path class="tm-star" d="m24 21.5 2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8Z"/></svg>' +
        '<span class="ach-text"><strong>' + esc(a.name) + '</strong><span>' + esc(a.how) + '</span></span>' +
        '<span class="ach-state">' + (got ? '已獲得' : '還沒有') + '</span></li>';
    }).join('');
    $('achCount').textContent = Object.keys(S.ach).length + ' / ' + E.ACH.length;
  }

  $('resetBtn').addEventListener('click', function () {
    menuDlg.close();
    UI.paused = true;
    resetDlg.showModal();
  });
  resetDlg.addEventListener('close', function () {
    if (resetDlg.returnValue === 'yes') {
      S = E.newState();
      hadSave = false;
      UI.tool = 'hand';
      UI.moveFrom = -1;
      UI.pops = {};
      UI.floats = [];
      UI.parts = [];
      UI.newTools = {};
      UI.seenTools = {};
      terrainDirty = true;
      saveGame();
      renderTools(true);
      renderHud(true);
      renderGoal(true);
      say('農場重新開始了');
    }
    UI.paused = false;
  });

  /* ─────────────────────────────────────────────────────────────
     主迴圈
     ───────────────────────────────────────────────────────────── */

  var lastFrame = 0, saveAt = 0, sheetAt = 0;
  UI.clock = 0;

  function loop(now) {
    window.requestAnimationFrame(loop);
    if (!UI.playing) return;
    var dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (document.visibilityState === 'hidden') return;
    UI.clock += dt;
    if (!UI.paused) {
      var ev = [];
      var left = dt;
      while (left > 0) {
        var st = Math.min(0.05, left);
        E.step(S, st, ev);
        left -= st;
      }
      if (ev.length) handle(ev);
    }
    /* 動畫時間（暫停時也繼續，畫面才不會僵住） */
    UI.floats.forEach(function (f) { f.t += dt; });
    UI.floats = UI.floats.filter(function (f) { return f.t <= 1.1; });
    UI.parts.forEach(function (q) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; });
    UI.parts = UI.parts.filter(function (q) { return q.t < q.life; });
    UI.shots.forEach(function (s) { s.t += dt; });

    drawScene(bctx, board.width / 128, UI.clock, true);
    renderHud(false);
    renderGoal(false);
    renderTools(false);
    if (now - sheetAt > 300) { sheetAt = now; if (sheet.open) refreshSheet(); }
    if (now - saveAt > 4000) { saveAt = now; saveGame(); }
  }
  window.requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveGame();
    lastFrame = 0;
  });
  window.addEventListener('pagehide', saveGame);

  /* ─────────────────────────────────────────────────────────────
     開始
     ───────────────────────────────────────────────────────────── */

  /* 像素圖示：HTML 裡只放空的 <span data-icon>，這裡放進畫好的圖（沒有 JS 時不會出現破圖） */
  document.querySelectorAll('[data-icon]').forEach(function (el) {
    el.innerHTML = '<img class="px" src="' + ART.iconUrl(el.getAttribute('data-icon'), el.hasAttribute('data-big')) +
      '" alt="' + esc(el.getAttribute('data-alt') || '') + '">';
  });
  TOOLS.forEach(function (k) { if (toolVisible(k)) UI.seenTools[k] = true; });
  renderCover();
  show('cover');
  track('home');
})();
