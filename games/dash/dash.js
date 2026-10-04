/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 膠囊衝衝衝（單機）
   規則在 engine.js、關卡在 levels.js、圖在 art.js；
   這裡只處理畫面（canvas）、輸入（手指／鍵盤）、HUD、對話框和紀錄。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var profile = Anxin.profile.load();
  if (!profile) return; /* <head> 裡的守衛已經導回 / */

  var E = window.DashEngine, LV = window.DashLevels, ART = window.DashArt;
  var C = E.CONFIG, B = C.BOSS;
  var $ = function (id) { return document.getElementById(id); };
  var live = $('liveRegion');

  var PX = 2.8;             /* 小膠囊在畫面上的位置（從左邊數第幾格） */
  var ROWS = 9;             /* 畫面高 9 格 */
  var MIN_COLS = 11;        /* 直式手機至少看得到 11 格（往前約 8 格） */
  var FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
  var ROLL_R = 0.45;        /* 小膠囊滾動的半徑（格）：走 1 格轉 1/0.45 弧度，不打滑 */

  var THEME = {
    orange: { sky: ['#FFF7ED', '#FFE4C4'], ground: '#FDBA74', seam: '#E9A066' },
    yellow: { sky: ['#FEFCE8', '#FEF08A'], ground: '#FCD34D', seam: '#E2B53C' },
    sky: { sky: ['#F0F9FF', '#BAE6FD'], ground: '#7DD3FC', seam: '#56BBE6' },
    mint: { sky: ['#F0FDF4', '#BBF7D0'], ground: '#86EFAC', seam: '#5DD58A' },
    pink: { sky: ['#FDF2F8', '#FBCFE8'], ground: '#F9A8D4', seam: '#E687BD' },
    dusk: { sky: ['#FFF1F2', '#FECDD3'], ground: '#FDA4AF', seam: '#EF8391' }
  };
  /* 無限挑戰：天空的顏色跟著玩法換，一進傳送門就知道換了 */
  var MODE_THEME = { cube: 'orange', rot: 'pink', ship: 'yellow', ufo: 'sky', duo: 'mint', boss: 'dusk' };

  var MODES = {
    cube: { hint: '點一下：跳　按住：一直跳', tap: '點這裡也可以跳', word: '跳' },
    rot: { hint: '畫面會轉來轉去，一樣點一下就跳', tap: '點這裡也可以跳', word: '跳' },
    ship: { hint: '體溫計火箭：按住往上飛，放開往下', tap: '按住這裡往上飛', word: '飛' },
    ufo: { hint: '藥杯飛碟：點一下往上飛一下', tap: '點一下往上飛一下', word: '飛' },
    duo: { hint: '上下兩個一起跳！藍色虛線框是不一樣的地方', tap: '點這裡，兩個一起跳', word: '跳' },
    boss: { hint: '看到「跳！」就跳，看到「別跳！」就不要跳', tap: '點這裡也可以跳', word: '跳' }
  };

  /* 無痕模式下 localStorage 可能丟例外：退回記憶體 */
  var storage = (function () {
    try { if (window.localStorage) return window.localStorage; } catch (e) { /* 忽略 */ }
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } };
  })();

  var rec = E.loadRecord(storage, profile.code);
  var speed = E.ageScale(profile.age);

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduce = !!(mq && mq.matches);
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { reduce = mq.matches; });

  function say(text) {
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ─────────────────────────────────────────────────────────────
     畫面切換
     ───────────────────────────────────────────────────────────── */

  var views = { intro: $('introView'), play: $('playView') };

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    document.body.classList.toggle('is-playing', name === 'play');
    window.scrollTo(0, 0);
  }

  /* ─────────────────────────────────────────────────────────────
     選關卡
     ───────────────────────────────────────────────────────────── */

  function starIcons(on, cls) {
    var s = '';
    for (var i = 0; i < 3; i++) {
      s += '<svg class="star' + (on && on[i] ? ' is-on' : '') + (cls ? ' ' + cls : '') +
        '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"></use></svg>';
    }
    return s;
  }

  var CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CARD_ART = { 1: ['ship'], 2: ['egg'], 3: ['ufo'], 4: ['egg', 'egg'], 5: ['egg'], 6: ['doctor'] };

  function artImgs(names) {
    return names.map(function (n) { return '<img src="' + ART.source(n) + '" alt="">'; }).join('');
  }

  function renderLevels() {
    var html = LV.LEVELS.map(function (L) {
      var r = rec.levels[L.id] || null;
      var got = r ? r.stars.filter(Boolean).length : 0;
      var badge = '';
      if (r && r.done) badge = '<span class="lv-badge is-done">' + CHECK + ' 完成</span>';
      else if (r && r.best > 0) badge = '<span class="lv-badge">最遠 ' + Math.round(r.best * 100) + '%</span>';
      var label = '第 ' + L.id + ' 關 ' + L.name + '：' + L.sub + '。' +
        (r && r.done ? '已完成，' : '') + '星星 ' + got + ' / 3。';
      return '<li><button type="button" class="lv-card" data-level="' + L.id + '" aria-label="' + label + '">' +
        '<span class="lv-art" style="--lv-bg:' + THEME[L.theme].sky[1] + '"><span class="lv-num">' + L.id + '</span>' +
        artImgs(CARD_ART[L.id]) + '</span>' +
        '<span class="lv-text"><span class="lv-name">' + L.name + '</span><span class="lv-sub">' + L.sub + '</span></span>' +
        '<span class="lv-side"><span class="lv-stars">' + starIcons(r && r.stars) + '</span>' + badge + '</span>' +
        '</button></li>';
    }).join('');
    var best = rec.inf.best;
    html += '<li><button type="button" class="lv-card is-inf" data-level="inf" aria-label="無限挑戰：五種玩法隨機出現，打贏醫生再來一輪。' +
      (best ? '最遠 ' + best + ' 公尺。' : '') + '">' +
      '<span class="lv-art" style="--lv-bg:#FFEDD5"><span class="lv-num">∞</span>' + artImgs(['star']) + '</span>' +
      '<span class="lv-text"><span class="lv-name">無限挑戰</span><span class="lv-sub">五種玩法隨機出現，打贏醫生再來一輪</span></span>' +
      '<span class="lv-side">' + (best ? '<span class="lv-badge">最遠 ' + best + ' 公尺</span>' : '') + '</span>' +
      '</button></li>';
    $('levelList').innerHTML = html;
  }

  $('levelList').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-level]');
    if (!b) return;
    var v = b.getAttribute('data-level');
    start(v === 'inf' ? 'inf' : Number(v));
  });

  /* ─────────────────────────────────────────────────────────────
     一局
     phase: ready（等第一下）→ play → crash（撞到，0.7 秒）→ respawn（從旗子重來，閃 0.65 秒）→ play …
            → over（過關或無限挑戰結束）；paused 時記得原本的 phase
     ───────────────────────────────────────────────────────────── */

  var G = {
    run: null, level: null, seed: null, phase: 'idle', resume: null,
    input: { held: false, presses: 0 }, pointers: {}, nPointers: 0, keyHeld: false, suppress: false,
    seen: {}, parts: [], angle: 0, aimY: 0.9, lastLane: null,
    squashAt: 0, squashKind: '', recoilAt: 0, crashUntil: 0, holdUntil: 0, doneAt: 0,
    saved: false, started: false, raf: 0, last: 0, hintTimer: 0, round: 1, dlgAction: null, hud: {}
  };

  function title() {
    if (G.level === 'inf') return '無限挑戰・第 ' + G.round + ' 輪';
    var L = LV.LEVELS[G.level - 1];
    return '第 ' + L.id + ' 關・' + L.name;
  }

  function resetInput() {
    G.input.held = false;
    G.input.presses = 0;
    G.pointers = {};
    G.nPointers = 0;
    G.keyHeld = false;
    G.suppress = false;
  }

  function start(level, seed) {
    var world;
    if (level === 'inf') {
      G.seed = seed || LV.newSeed();
      world = LV.buildInfinity(G.seed);
    } else {
      world = LV.buildLevel(level);
    }
    G.level = level;
    G.round = 1;
    G.run = E.newRun(world, { timeScale: speed, checkpoints: level !== 'inf' });
    G.phase = 'ready';
    G.saved = false;
    G.started = false;
    G.seen = {};
    G.parts = [];
    G.angle = 0;
    G.aimY = 0.9;
    G.lastLane = null;
    G.doneAt = 0;
    G.hud = {};
    G.roll = 0;
    G.rollX = 0;
    resetInput();

    $('hudTitle').textContent = title();
    $('readyName').textContent = title();
    $('readySub').textContent = MODES[G.run.mode].hint;
    setMode(G.run.mode);
    $('readyBox').hidden = false;
    $('modeHint').hidden = true;
    $('bossBar').hidden = true;
    $('hudProgress').hidden = false;
    $('hudProgress').classList.toggle('is-endless', level === 'inf');
    show('play');
    fit(true);
    updateHud();
    $('goBtn').focus({ preventScroll: true });
    startLoop();
  }

  /* fromKey：用鍵盤開始的才把焦點移到畫面上（手指點的不要出現焦點框） */
  function begin(fromKey) {
    if (G.phase !== 'ready') return;
    G.phase = 'play';
    G.started = true;
    $('readyBox').hidden = true;
    G.input.presses = 0;
    /* 開始的那一下（和一直按著）不算跳 */
    G.suppress = G.nPointers > 0 || G.keyHeld;
    syncHeld();
    G.last = now();
    hint(G.run.mode);
    var ae = document.activeElement;
    if (fromKey) {
      try { $('stageCanvas').focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
    } else if (ae && ae !== document.body && ae.blur) {
      ae.blur();
    }
  }

  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }

  /* ─────────────────────────────────────────────────────────────
     輸入：整個舞台（畫面＋下面的空白）都可以點；鍵盤 空白鍵／↑／W
     手指點下去的那一刻就算（pointerdown），不等放開
     ───────────────────────────────────────────────────────────── */

  var stage = $('stage');

  function syncHeld() {
    G.input.held = (G.nPointers > 0 || G.keyHeld) && !G.suppress;
    $('tapZone').classList.toggle('is-down', G.nPointers > 0 || G.keyHeld);
  }

  function press(fromKey) {
    if (G.phase === 'ready') { begin(fromKey); G.suppress = true; }
    else if (G.phase === 'play') G.input.presses++;
    syncHeld();
  }

  function release() {
    if (!G.nPointers && !G.keyHeld) G.suppress = false;
    syncHeld();
  }

  stage.addEventListener('pointerdown', function (ev) {
    if (!G.run || ev.button > 0) return;
    ev.preventDefault();
    if (!G.pointers[ev.pointerId]) { G.pointers[ev.pointerId] = true; G.nPointers++; }
    try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
    press();
  });

  function pointerUp(ev) {
    if (G.pointers[ev.pointerId]) { delete G.pointers[ev.pointerId]; G.nPointers--; }
    release();
  }
  stage.addEventListener('pointerup', pointerUp);
  stage.addEventListener('pointercancel', pointerUp);
  stage.addEventListener('lostpointercapture', pointerUp);
  stage.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  /* 鍵盤點「點一下開始」按鈕 → 一樣開始 */
  $('goBtn').addEventListener('click', function (ev) { begin(ev.detail === 0); });

  var JUMP_KEYS = { ' ': 1, Spacebar: 1, ArrowUp: 1, w: 1, W: 1 };

  function dialogOpen() {
    return ['pauseDlg', 'winDlg', 'overDlg'].some(function (id) { return $(id).hasAttribute('open'); });
  }

  document.addEventListener('keydown', function (ev) {
    if (views.play.hidden || dialogOpen() || !G.run) return;
    if (ev.key === 'Escape' || ev.key === 'p' || ev.key === 'P') {
      ev.preventDefault();
      pause();
      return;
    }
    if (!JUMP_KEYS[ev.key]) return;
    /* 焦點在按鈕上時（暫停、開始），空白鍵交給按鈕 */
    if (ev.target && ev.target.closest && ev.target.closest('button, a')) return;
    ev.preventDefault();
    if (ev.repeat) return;
    G.keyHeld = true;
    press(true);
  });

  document.addEventListener('keyup', function (ev) {
    if (!JUMP_KEYS[ev.key] || !G.keyHeld) return;
    G.keyHeld = false;
    release();
  });

  /* ─────────────────────────────────────────────────────────────
     暫停、離開、存檔
     ───────────────────────────────────────────────────────────── */

  var pauseDlg = Anxin.wireDialog($('pauseDlg'));
  var winDlg = Anxin.wireDialog($('winDlg'));
  var overDlg = Anxin.wireDialog($('overDlg'));

  function pause() {
    if (['ready', 'play', 'crash', 'respawn'].indexOf(G.phase) < 0) return;
    G.resume = G.phase;
    G.phase = 'paused';
    resetInput();
    pauseDlg.open();
  }

  $('pauseBtn').addEventListener('click', pause);

  $('pauseDlg').addEventListener('close', function () {
    if (G.phase !== 'paused') return;
    G.phase = G.resume || 'play';
    G.last = now();
    if (G.phase === 'respawn') G.holdUntil = now() + 650;
    if (G.phase === 'crash') G.crashUntil = now() + 300;
    var f = G.phase === 'ready' ? $('goBtn') : $('stageCanvas');
    try { f.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
  });

  /* 沒過關就離開：記下最遠到哪裡、試了幾次 */
  function saveExit() {
    var run = G.run;
    if (!run || G.saved || !G.started) return;
    if (G.level === 'inf') {
      if (run.x > 1) E.mergeInf(rec, { dist: Math.floor(run.x), round: G.round, seed: G.seed });
    } else {
      E.mergeLevel(rec, G.level, { done: false, stars: [], progress: E.progress(run), deaths: run.deaths });
    }
    E.saveRecord(storage, rec);
    G.saved = true;
  }

  function toLevels() {
    saveExit();
    stopLoop();
    G.phase = 'idle';
    var lv = G.level;
    renderLevels();
    show('intro');
    var card = document.querySelector('.lv-card[data-level="' + lv + '"]');
    try { (card || $('introTitle')).focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
  }

  function restart() {
    saveExit();
    start(G.level, G.level === 'inf' ? G.seed : undefined);
  }

  $('restartBtn').addEventListener('click', function () {
    G.phase = 'idle';
    $('pauseDlg').close();
    restart();
  });

  $('toLevelsBtn').addEventListener('click', function () {
    G.phase = 'idle';
    $('pauseDlg').close();
    toLevels();
  });

  function dlgAction(dlg, fn) {
    return function () {
      G.dlgAction = fn;
      dlg.close();
    };
  }

  /* 過關、無限挑戰結束的對話框：按 Esc 關掉 = 回選關卡 */
  ['winDlg', 'overDlg'].forEach(function (id) {
    $(id).addEventListener('close', function () {
      var fn = G.dlgAction || toLevels;
      G.dlgAction = null;
      fn();
    });
  });

  $('nextBtn').addEventListener('click', dlgAction($('winDlg'), function () {
    start(G.level < LV.LEVELS.length ? G.level + 1 : 'inf');
  }));
  $('againBtn').addEventListener('click', dlgAction($('winDlg'), function () { start(G.level); }));
  $('winLevelsBtn').addEventListener('click', dlgAction($('winDlg'), toLevels));
  $('sameSeedBtn').addEventListener('click', dlgAction($('overDlg'), function () { start('inf', G.seed); }));
  $('newSeedBtn').addEventListener('click', dlgAction($('overDlg'), function () { start('inf'); }));
  $('overLevelsBtn').addEventListener('click', dlgAction($('overDlg'), toLevels));

  /* 家長接電話、切到別的 App：自動暫停 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
  });
  window.addEventListener('pagehide', saveExit);

  /* ─────────────────────────────────────────────────────────────
     遊戲迴圈
     ───────────────────────────────────────────────────────────── */

  function startLoop() {
    G.last = now();
    if (!G.raf && window.requestAnimationFrame) G.raf = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (G.raf && window.cancelAnimationFrame) window.cancelAnimationFrame(G.raf);
    G.raf = 0;
  }

  function frame(t) {
    G.raf = window.requestAnimationFrame(frame);
    tick(t);
  }

  function tick(t) {
    var run = G.run;
    if (!run) return;
    var dt = clamp((t - G.last) / 1000, 0, 0.1);
    G.last = t;
    if (G.phase === 'play') {
      var evs = E.advance(run, dt, G.input);
      if (evs.length) handle(evs, t);
    } else if (G.phase === 'crash' && t >= G.crashUntil) {
      afterCrash(t);
    } else if (G.phase === 'respawn' && t >= G.holdUntil) {
      G.phase = 'play';
      G.input.presses = 0;
    }
    var target = run.mode === 'rot' ? run.rot.angle : 0;
    G.angle = reduce ? target : G.angle + (target - G.angle) * Math.min(1, dt * 9);
    /* 滾著前進：轉多少 = 走多遠 ÷ 半徑 */
    var moved = run.x - G.rollX;
    if (moved > 0 && moved < 2) G.roll = (G.roll + moved / ROLL_R) % (Math.PI * 2);
    G.rollX = run.x;
    if (Math.abs(G.angle - target) < 0.01) G.angle = target;
    stepParticles(dt);
    updateHud();
    render(t);
  }

  function handle(evs, t) {
    var run = G.run;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      switch (e.type) {
        case 'jump':
          G.squashAt = t; G.squashKind = 'jump';
          puff(run.x - 0.2, run.p.y - 0.4, 3, '#FFFFFF');
          break;
        case 'land':
          G.squashAt = t; G.squashKind = 'land';
          puff(run.x - 0.2, run.p.y - 0.4, 3, '#FFFFFF');
          break;
        case 'flap':
          puff(run.x - 0.3, run.p.y - 0.5, 2, '#E0F2FE');
          break;
        case 'pad':
          puff(run.x, run.p.y - 0.4, 6, '#FDE047');
          break;
        case 'star':
          puff(run.x + 0.2, run.p.y, 8, '#FACC15');
          say(G.level === 'inf' ? '拿到星星！' : '拿到星星！' + run.gotN + ' / 3');
          break;
        case 'mode':
          hint(e.mode);
          $('bossBar').hidden = true;
          $('hudProgress').hidden = false;
          break;
        case 'speed':
          if (e.round > 1) {
            G.round = e.round;
            $('hudTitle').textContent = title();
            showHint('第 ' + e.round + ' 輪！再快一點點');
          } else if (e.mul > 1) {
            showHint('加速囉！');
          }
          break;
        case 'bossStart':
          $('bossBar').hidden = false;
          $('hudProgress').hidden = true;
          G.doneAt = 0;
          break;
        case 'bossPhase':
          showHint('醫生要一次射兩發了，看清楚！');
          break;
        case 'shot':
          G.recoilAt = t;
          G.lastLane = e.lane;
          break;
        case 'bossDone':
          G.doneAt = t;
          showHint('醫生：「你好勇敢！」');
          break;
        case 'crash':
          crashed(t);
          break;
        case 'goal':
          won(t);
          break;
      }
    }
  }

  /* 下面那顆大按鈕上的字和說明跟著玩法換 */
  function setMode(mode) {
    var m = MODES[mode] || MODES.cube;
    $('tapWord').textContent = m.word;
    if (!$('tapHint').classList.contains('is-new')) $('tapHint').textContent = m.tap;
  }

  /* 每一種玩法第一次出現時跳一行說明（不擋畫面、不用按）：
     直式寫在大按鈕下面；橫式（沒有大按鈕）疊在畫面最下面的地板上 */
  function hint(mode) {
    setMode(mode);
    if (G.seen[mode]) return;
    G.seen[mode] = true;
    showHint((MODES[mode] || MODES.cube).hint);
  }

  function showHint(text) {
    var tight = $('tapZone').classList.contains('is-tight');
    var el = tight ? $('modeHint') : $('tapHint');
    window.clearTimeout(G.hintTimer);
    $('modeHint').hidden = true;
    $('tapHint').classList.remove('is-new');
    el.textContent = text;
    if (tight) el.hidden = false;
    else el.classList.add('is-new');
    G.hintTimer = window.setTimeout(function () {
      $('modeHint').hidden = true;
      $('tapHint').classList.remove('is-new');
      if (G.run) setMode(G.run.mode);
    }, 3200);
    say(text);
  }

  function crashed(t) {
    var run = G.run;
    G.phase = 'crash';
    G.crashUntil = t + (run.world.endless ? 900 : 700);
    G.input.presses = 0;
    burst(run.x, run.p.y);
    if (!run.world.endless) say('撞到了，沒關係，從旗子那裡再來一次');
  }

  function afterCrash(t) {
    if (G.run.world.endless) { infOver(); return; }
    E.respawn(G.run);
    G.rollX = G.run.x;
    G.roll = 0;
    G.phase = 'respawn';
    G.holdUntil = t + 650;
    G.angle = 0;
    G.parts = [];
    if (G.run.boss) {
      $('bossBar').hidden = false;
      $('hudProgress').hidden = true;
    } else {
      $('bossBar').hidden = true;
      $('hudProgress').hidden = false;
    }
  }

  function won(t) {
    var run = G.run;
    G.phase = 'over';
    var got = [0, 1, 2].map(function (i) { return !!run.got[i]; });
    E.mergeLevel(rec, G.level, { done: true, stars: got, progress: 1, deaths: run.deaths });
    E.saveRecord(storage, rec);
    G.saved = true;
    confetti(run.x, run.p.y);
    window.setTimeout(function () { openWin(got); }, reduce ? 250 : 900);
  }

  function openWin(got) {
    var run = G.run, n = got.filter(Boolean).length;
    var last = G.level >= LV.LEVELS.length;
    $('winKicker').textContent = title();
    $('winTitle').textContent = last ? '打贏醫生了！' : '過關了！';
    $('winStars').innerHTML = starIcons(got);
    $('winStars').setAttribute('aria-label', '拿到 ' + n + ' / 3 顆星星');
    $('winStars').setAttribute('role', 'img');
    var line = n === 3 ? '三顆星星全部拿到了！' : n ? '拿到 ' + n + ' 顆星星。' : '這次沒拿到星星，下次跳高一點看看！';
    line += run.deaths ? '試了 ' + (run.deaths + 1) + ' 次，好有耐心！' : '一次就成功！';
    if (last) line = '醫生說：「你好勇敢！」' + line;
    $('winLine').textContent = line;
    $('nextBtn').textContent = last ? '挑戰無限模式' : '下一關：' + LV.LEVELS[G.level].name;
    winDlg.open();
  }

  function infOver() {
    var run = G.run;
    G.phase = 'over';
    var dist = Math.floor(run.x);
    var better = E.mergeInf(rec, { dist: dist, round: G.round, seed: G.seed });
    E.saveRecord(storage, rec);
    G.saved = true;
    $('overTitle').textContent = '跑了 ' + dist + ' 公尺！';
    $('overLine').textContent = '到了第 ' + G.round + ' 輪' + (run.gotN ? '，拿到 ' + run.gotN + ' 顆星星' : '') + '。' +
      (better ? '這是新紀錄！' : '最遠紀錄是 ' + rec.inf.best + ' 公尺。');
    $('overSeed').textContent = '地圖編號 ' + G.seed + '（同一個編號＝同一張地圖）';
    overDlg.open();
  }

  /* ─────────────────────────────────────────────────────────────
     HUD（只在數字變了的時候才改 DOM）
     ───────────────────────────────────────────────────────────── */

  function setText(id, v) {
    if (G.hud[id] === v) return;
    G.hud[id] = v;
    $(id).textContent = v;
  }

  function updateHud() {
    var run = G.run;
    if (!run) return;
    if (G.level === 'inf') {
      setText('hudPct', Math.floor(run.x) + ' 公尺');
      if (G.hud.stars !== run.gotN) {
        G.hud.stars = run.gotN;
        $('hudStars').innerHTML = '<svg class="star is-on" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"></use></svg>' + run.gotN;
        $('hudStars').setAttribute('aria-label', '星星 ' + run.gotN + ' 顆');
      }
    } else {
      var pc = Math.floor(E.progress(run) * 100);
      if (G.hud.pc !== pc) {
        G.hud.pc = pc;
        $('hudPct').textContent = pc + '%';
        $('hudFill').style.width = pc + '%';
      }
      if (G.hud.stars !== run.gotN) {
        G.hud.stars = run.gotN;
        $('hudStars').innerHTML = starIcons([0, 1, 2].map(function (i) { return run.got[i]; }));
        $('hudStars').setAttribute('aria-label', '星星 ' + run.gotN + ' / 3');
      }
    }
    setText('hudTry', '第 ' + (run.deaths + 1) + ' 次');
    var b = run.boss;
    if (b) {
      var left = Math.max(0, b.tank);
      if (G.hud.tank !== left) {
        G.hud.tank = left;
        $('bossFill').style.transform = 'scaleX(' + (left / b.total) + ')';
        $('bossLeft').textContent = '剩 ' + left + ' 發';
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     畫布尺寸：一格 = min(高 / 9, 寬 / 12)；直式手機下面多出來的空白當作「點這裡」
     ───────────────────────────────────────────────────────────── */

  var cv = $('stageCanvas');
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  var V = { w: 0, h: 0, T: 0, dpr: 1 };
  var IMG = ART.images();
  var cache = {};

  function fit(force) {
    if (views.play.hidden) return;
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    var T = Math.max(8, Math.min(h / ROWS, w / MIN_COLS));
    var H = Math.floor(T * ROWS);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!force && T === V.T && w === V.w && dpr === V.dpr) return;
    V.T = T; V.w = w; V.h = H; V.dpr = dpr;
    cache = {};
    cv.style.height = H + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(H * dpr);
    $('readyBox').style.height = H + 'px';
    stage.style.setProperty('--canvas-h', H + 'px');
    $('tapZone').classList.toggle('is-tight', h - H - 12 < 72);
    if (G.run) render(now());
  }

  window.addEventListener('resize', function () { fit(); });
  window.addEventListener('orientationchange', function () { window.setTimeout(fit, 250); });
  if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(stage);

  /* 圖片轉成符合格子大小的點陣圖，快取起來（每幀只做 drawImage） */
  function sprite(name, wT, hT) {
    var key = name + '|' + wT + '|' + hT;
    var c = cache[key];
    if (c) return c;
    var img = IMG[name];
    if (!img || !img.complete || !img.naturalWidth) return null;
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(wT * V.T * V.dpr));
    c.height = Math.max(1, Math.round(hT * V.T * V.dpr));
    var g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(img, 0, 0, c.width, c.height);
    cache[key] = c;
    return c;
  }

  function blit(name, x, y, wT, hT) {
    var s = sprite(name, wT, hT);
    if (s) ctx.drawImage(s, x, y, wT * V.T, hT * V.T);
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hash(k) {
    var s = Math.sin(k * 127.1 + 31.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ─────────────────────────────────────────────────────────────
     畫一幀
     ───────────────────────────────────────────────────────────── */

  function themeName(run) {
    if (!run.world.endless) return run.world.theme;
    var s = E.sectionAt(run.world, run.x);
    return MODE_THEME[s ? s.mode : 'cube'] || 'orange';
  }

  function render(t) {
    if (!ctx || !V.T || !G.run) return;
    var run = G.run, T = V.T, W = V.w, H = V.h;
    var a = G.phase === 'play' ? clamp(run.acc / C.DT, 0, 1) : 1;
    var x = run.prevX + (run.x - run.prevX) * a;
    var camX = x - PX;
    var tn = themeName(run), th = THEME[tn] || THEME.orange;

    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    var gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, th.sky[0]);
    gr.addColorStop(1, th.sky[1]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (G.angle) {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(G.angle * Math.PI / 180);
      ctx.translate(-W / 2, -H / 2);
    }
    if (run.mode === 'duo') {
      /* 雙胞胎：下半是原本的世界；上半是另一個世界，上下顛倒畫 */
      ctx.save();
      ctx.beginPath(); ctx.rect(-W, H / 2, 3 * W, H); ctx.clip();
      scene(camX, H - 0.5 * T, run.world.cols, run.p, a, th, tn, t, false);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(-W, -H, 3 * W, 1.5 * H); ctx.clip();
      ctx.translate(0, H); ctx.scale(1, -1);
      ctx.fillStyle = gr; ctx.fillRect(-W, 0, 3 * W, H);
      scene(camX, H - 0.5 * T, run.world.topCols, run.p2, a, th, tn, t, true);
      ctx.restore();
      ctx.fillStyle = 'rgba(124,45,18,.6)';
      ctx.fillRect(-W, H / 2 - 2, 3 * W, 4);
    } else {
      scene(camX, H - T, run.world.cols, run.p, a, th, tn, t, false);
    }
    if (run.boss) drawBoss(camX, H - T, run.boss, t);
    drawParticles(camX, run.mode === 'duo' ? H - 0.5 * T : H - T);
    ctx.restore();
  }

  function scene(camX, gY, cols, P, a, th, tn, t, top) {
    var T = V.T, W = V.w, run = G.run;
    var extra = Math.abs(G.angle) > 0.05 ? 4 : 1;
    var c0 = Math.floor(camX) - extra, c1 = Math.ceil(camX + W / T) + extra;
    var left = -extra * T, right = W + extra * T;

    clouds(camX, gY, left, right);
    if (!top) speedLines(camX, t);

    /* 火箭、飛碟段落的天花板 */
    run.world.sections.forEach(function (s) {
      if ((s.mode !== 'ship' && s.mode !== 'ufo') || s.x1 < c0 || s.x0 > c1 + 1) return;
      var x0 = (Math.max(s.x0, c0) - camX) * T, x1 = (Math.min(s.x1, c1 + 1) - camX) * T;
      var y = gY - C.CEIL * T;
      ctx.fillStyle = th.ground;
      ctx.fillRect(x0, y - 4 * T, x1 - x0, 4 * T);
      ctx.fillStyle = 'rgba(124,45,18,.6)';
      ctx.fillRect(x0, y - 1, x1 - x0, 3);
    });

    /* 地板：醫院的地磚 */
    ctx.fillStyle = th.ground;
    ctx.fillRect(left, gY, right - left, 4 * T);
    ctx.fillStyle = th.seam;
    for (var c = c0; c <= c1; c++) ctx.fillRect((c - camX) * T, gY + 0.2 * T, Math.max(1, T * 0.05), 4 * T);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillRect(left, gY + 2, right - left, Math.max(2, 0.1 * T));
    ctx.fillStyle = 'rgba(124,45,18,.6)';
    ctx.fillRect(left, gY - 1, right - left, 3);

    drawFunnels(camX, gY, c0, c1, th);

    /* 傳送門、加速、旗子、終點 */
    var tr = run.world.triggers;
    for (var i = 0; i < tr.length; i++) {
      var g = tr[i];
      if (g.x < c0 - 2 || g.x > c1 + 2) continue;
      if (top && g.k !== 'portal') continue;
      drawTrigger(g, camX, gY);
    }

    /* 障礙物、星星 */
    for (c = c0; c <= c1; c++) {
      var l = cols[c];
      if (!l) continue;
      for (var j = 0; j < l.length; j++) drawObj(l[j], camX, gY, tn, t);
    }

    drawPlayer(P, a, gY, t);
  }

  /* 傳送門前的漏斗：地板往上斜、天花板往下斜，只有門口過得去 */
  function drawFunnels(camX, gY, c0, c1, th) {
    var T = V.T, F = C.FUNNEL, top = F.FLOOR + F.GAP, sky = 14;
    var X = function (wx) { return (wx - camX) * T; };
    var Y = function (wy) { return gY - wy * T; };
    G.run.world.funnels.forEach(function (f) {
      if (f.x1 < c0 - 1 || f.x0 > c1 + 1) return;
      var a = f.px - F.NECK, b = f.px + F.NECK;
      ctx.save();
      ctx.fillStyle = th.ground;
      ctx.beginPath();
      ctx.moveTo(X(f.x0), Y(-0.02)); ctx.lineTo(X(a), Y(F.FLOOR)); ctx.lineTo(X(b), Y(F.FLOOR)); ctx.lineTo(X(f.x1), Y(-0.02));
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(X(f.x0), Y(sky)); ctx.lineTo(X(f.x0), Y(f.cIn)); ctx.lineTo(X(a), Y(top));
      ctx.lineTo(X(b), Y(top)); ctx.lineTo(X(f.x1), Y(f.cOut)); ctx.lineTo(X(f.x1), Y(sky));
      ctx.closePath(); ctx.fill();
      /* 斜坡的紋路（和地磚同色），一眼看得出是斜的 */
      ctx.strokeStyle = th.seam;
      ctx.lineWidth = Math.max(1, T * 0.05);
      ctx.beginPath();
      for (var k = 1; k < 4; k++) {
        var d = k * 0.28;
        ctx.moveTo(X(f.x0 + 0.6), Y(Math.max(0, d * 0.25 - 0.05)));
        ctx.lineTo(X(a), Y(F.FLOOR - d)); ctx.lineTo(X(b), Y(F.FLOOR - d));
        ctx.lineTo(X(f.x1 - 0.6), Y(Math.max(0, d * 0.25 - 0.05)));
        ctx.moveTo(X(f.x0 + 0.3), Y(f.cIn + d)); ctx.lineTo(X(a), Y(top + d)); ctx.lineTo(X(b), Y(top + d)); ctx.lineTo(X(f.x1 - 0.3), Y(f.cOut + d));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(124,45,18,.6)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(X(f.x0), Y(0)); ctx.lineTo(X(a), Y(F.FLOOR)); ctx.lineTo(X(b), Y(F.FLOOR)); ctx.lineTo(X(f.x1), Y(0));
      ctx.moveTo(X(f.x0), Y(sky)); ctx.lineTo(X(f.x0), Y(f.cIn)); ctx.lineTo(X(a), Y(top));
      ctx.lineTo(X(b), Y(top)); ctx.lineTo(X(f.x1), Y(f.cOut)); ctx.lineTo(X(f.x1), Y(sky));
      ctx.stroke();
      ctx.restore();
    });
  }

  /* 速度線：比場景跑得更快的橫線，越快越明顯（減少動態時不畫） */
  function speedLines(camX, t) {
    if (reduce) return;
    var T = V.T, W = V.w, run = G.run, par = 1.8, span = 2.6;
    var base = camX * par;
    var k = clamp((run.baseScale * run.speedMul - 0.55) / 0.75, 0.3, 1);
    var i0 = Math.floor(base / span) - 2, i1 = Math.ceil((base + W / T) / span) + 1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, 0.055 * T);
    for (var i = i0; i <= i1; i++) {
      var h1 = hash(i * 3.17), h2 = hash(i * 7.73 + 1), h3 = hash(i * 1.31 + 5);
      if (h3 > 0.45 + 0.5 * k) continue;
      var x = (i * span + h1 * span - base) * T;
      var y = (0.5 + h2 * 6.6) * T;
      var len = (1.2 + h3 * 2.4) * T;
      var w = Math.max(2, 0.07 * T);
      /* 淺色天空上白線看不到：用暖棕色的半透明線，上緣一條細白光 */
      ctx.lineWidth = w;
      ctx.strokeStyle = 'rgba(124,45,18,' + (0.14 + 0.16 * k).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      ctx.lineWidth = Math.max(1, w * 0.4);
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.moveTo(x + w, y - w * 0.6); ctx.lineTo(x + len * 0.75, y - w * 0.6); ctx.stroke();
    }
    ctx.restore();
  }

  function clouds(camX, gY, left, right) {
    var T = V.T, par = 0.3, span = 8;
    var base = camX * par;
    var k0 = Math.floor((base + left / T) / span) - 1, k1 = Math.ceil((base + right / T) / span) + 1;
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (var k = k0; k <= k1; k++) {
      var h = hash(k), h2 = hash(k + 99);
      var w = (1.6 + h * 1.4) * T, ht = 0.6 * T;
      var x = (k * span + h * 4 - base) * T, y = gY - (5.4 + h2 * 2.2) * T;
      rrect(x, y, w, ht, ht / 2);
      ctx.fill();
    }
  }

  function drawObj(o, camX, gY, tn, t) {
    var T = V.T, sx = (o.x - camX) * T, sy = gY - (o.y + 1) * T;
    if (o.k === 'block') blit(o.diff ? 'blockDiff' : 'block_' + tn, sx, sy, 1, 1);
    else if (o.k === 'needle') blit((o.dir < 0 ? 'needleDown' : 'needle') + (o.diff ? 'Diff' : ''), sx, sy, 1, 1);
    else if (o.k === 'pad') blit('pad', sx, sy + 0.6 * T, 1, 0.4);
    else if (o.k === 'star') {
      if (G.run.got[o.id]) return;
      var bob = reduce ? 0 : Math.sin(t / 260 + o.x) * 0.06 * T;
      blit('star', sx + 0.08 * T, sy + 0.08 * T + bob, 0.84, 0.84);
    }
    /* 雙胞胎：不一樣的東西＝藍色＋虛線框（不只靠顏色） */
    if (o.diff) {
      ctx.save();
      ctx.strokeStyle = '#0369A1';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      rrect(sx + 1, sy + 1, T - 2, T - 2, 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  var PORTAL_ICON = { cube: 'egg', rot: 'egg', duo: 'egg', ship: 'ship', ufo: 'ufo', boss: 'doctor' };

  function drawTrigger(g, camX, gY) {
    var T = V.T, sx = (g.x - camX) * T, run = G.run;
    if (g.k === 'portal') {
      /* 小小的門，剛好卡在漏斗最窄的地方 */
      var F = C.FUNNEL, h = F.GAP + 0.2, yb = F.FLOOR - 0.1;
      blit('portal_' + g.mode, sx - 0.4 * T, gY - (yb + h) * T, 0.8, h);
      var icon = PORTAL_ICON[g.mode] || 'egg';
      var iw = icon === 'doctor' ? 0.42 : icon === 'egg' ? 0.5 : 0.62;
      var ih = icon === 'doctor' ? 0.7 : icon === 'egg' ? 0.5 : 0.42;
      blit(icon, sx - iw / 2 * T, gY - (yb + h / 2 + ih / 2) * T, iw, ih);
    } else if (g.k === 'speed') {
      ctx.save();
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = Math.max(3, 0.12 * T);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var k = 0; k < 3; k++) {
        var cx = sx + (k - 1) * 0.32 * T;
        ctx.beginPath();
        ctx.moveTo(cx - 0.15 * T, gY - 2.4 * T);
        ctx.lineTo(cx + 0.15 * T, gY - 1.6 * T);
        ctx.lineTo(cx - 0.15 * T, gY - 0.8 * T);
        ctx.stroke();
      }
      ctx.restore();
    } else if (g.k === 'check') {
      blit(run.cp && run.cp.x >= g.x ? 'flagOn' : 'flagOff', sx - 0.12 * T, gY - 1.2 * T, 0.6, 1.2);
    } else if (g.k === 'goal') {
      drawGoal(sx, gY);
    }
  }

  function drawGoal(sx, gY) {
    var T = V.T;
    ctx.save();
    ctx.fillStyle = '#7C2D12';
    rrect(sx, gY - 4 * T, 0.22 * T, 4 * T, 0.1 * T); ctx.fill();
    rrect(sx + 1.8 * T, gY - 4 * T, 0.22 * T, 4 * T, 0.1 * T); ctx.fill();
    ctx.fillStyle = '#15803D';
    rrect(sx - 0.25 * T, gY - 4.6 * T, 2.5 * T, 0.95 * T, 0.3 * T); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 ' + Math.round(0.5 * T) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('終點', sx + 1 * T, gY - 4.12 * T);
    /* 格子旗 */
    var q = 0.25 * T;
    for (var i = 0; i < 7; i++) {
      for (var j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#1C1917' : '#FFFFFF';
        ctx.fillRect(sx + 0.22 * T + i * q, gY - 3.6 * T + j * q, q, q);
      }
    }
    ctx.restore();
  }

  /* 跑起來時，小膠囊後面拖三條短短的線 */
  function streaks(pm, t) {
    if (reduce || G.phase !== 'play') return;
    var T = V.T, back = pm === 'cube' ? 0.5 : 0.8;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, 0.06 * T);
    ctx.strokeStyle = 'rgba(124,45,18,.28)';
    for (var i = 0; i < 3; i++) {
      var len = (0.45 + 0.25 * Math.sin(t / 70 + i * 2.1) + 0.2 * i % 0.4) * T;
      var y = (i - 1) * 0.24 * T;
      ctx.beginPath();
      ctx.moveTo(-back * T - 0.12 * T, y);
      ctx.lineTo(-back * T - 0.12 * T - len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(P, a, gY, t) {
    if (!P) return;
    var run = G.run, T = V.T, pm = E.physMode(run.mode);
    var y = G.phase === 'play' ? P.py + (P.y - P.py) * a : P.y;
    var dead = run.dead;
    ctx.save();
    if (G.phase === 'respawn' && Math.floor(t / 220) % 2) ctx.globalAlpha = 0.35;
    ctx.translate(PX * T, gY - y * T);
    streaks(pm, t);
    if (pm === 'cube') {
      var tilt = P.grounded ? 0 : clamp(-P.vy / C.JUMP_V, -1, 1) * 14;
      /* 滾著前進（畫面插值到這一幀的位置）；撞到時轉正，看得到暈暈的臉；減少動態時只微微傾斜 */
      var xr = G.phase === 'play' ? run.prevX + (run.x - run.prevX) * a : run.x;
      var spin = dead ? 0 : reduce ? tilt * Math.PI / 180 : G.roll - (run.x - xr) / ROLL_R;
      var sxs = 1, sys = 1;
      if (!reduce && G.squashAt && !dead) {
        var k = (t - G.squashAt) / 130;
        if (k >= 0 && k < 1) {
          var amt = (1 - k) * 0.15;
          if (G.squashKind === 'land') { sxs = 1 + amt; sys = 1 - amt; } else { sxs = 1 - amt * 0.6; sys = 1 + amt; }
        }
      }
      ctx.translate(0, 0.45 * T);
      ctx.scale(sxs, sys);
      ctx.translate(0, -0.45 * T);
      ctx.rotate(spin);
      blit(dead ? 'eggDizzy' : 'egg', -0.5 * T, -0.52 * T, 1, 1);
    } else if (pm === 'ship') {
      ctx.rotate(clamp(-P.vy / C.SHIP_VMAX, -1, 1) * 20 * Math.PI / 180);
      blit('ship', -0.72 * T, -0.55 * T, 1.44, 0.9);
    } else {
      ctx.rotate(clamp(-P.vy / C.UFO_VMAX, -1, 1) * 8 * Math.PI / 180);
      blit('ufo', -0.66 * T, -0.52 * T, 1.32, 0.94);
    }
    ctx.restore();
  }

  /* ── 大魔王：醫生、針筒（裝水的水槍）、預告、水柱 ── */

  function laneY(lane) {
    var l = lane === 'low' ? B.LOW : B.HIGH;
    return (l[0] + l[1]) / 2;
  }

  function drawBoss(camX, gY, b, t) {
    var T = V.T;
    var off = 0;
    if (b.bt < 1.2) off = Math.pow(1 - b.bt / 1.2, 2) * 7 * T;
    if (b.state === 'done' && G.doneAt) off = Math.max(0, (t - G.doneAt - 1400) / 1000) * 6 * T;
    var docX = (PX + B.DX) * T + off;
    var tipX = docX - B.TIP * T;

    var tells = E.bossTells(b);
    for (var i = 0; i < tells.length; i++) telegraph(tells[i], tipX, gY);

    blit(b.state === 'done' ? 'doctorHappy' : 'doctor', docX - 0.9 * T, gY - 3 * T, 1.8, 3);

    var target = tells.length ? laneY(tells[0].lane) : G.lastLane ? laneY(G.lastLane) : 0.9;
    G.aimY += (target - G.aimY) * (reduce ? 1 : 0.18);
    if (b.state !== 'done') syringe(tipX, gY - G.aimY * T, b.tank / b.total, t);

    for (i = 0; i < b.shots.length; i++) water((b.shots[i].x - camX) * T, gY, b.shots[i].lane);

    if (b.bt < B.INTRO_S && b.state === 'fight') bubble(docX, gY - 3.15 * T, '來玩水槍大戰！');
    else if (b.state === 'done') bubble(docX, gY - 3.15 * T, '你好勇敢！');
    else if (tells.length) exclaim(docX + 0.55 * T, gY - 3.25 * T);
  }

  function telegraph(tl, tipX, gY) {
    var T = V.T, lane = tl.lane === 'low' ? B.LOW : B.HIGH;
    var y0 = gY - lane[1] * T, h = (lane[1] - lane[0]) * T;
    var x0 = -2 * T, x1 = tipX;
    ctx.save();
    ctx.fillStyle = 'rgba(220,38,38,.12)';
    ctx.fillRect(x0, y0, x1 - x0, h);
    /* 越接近發射，紅色越往小膠囊這邊長過來 */
    var fx = x1 - (x1 - PX * T) * tl.frac;
    ctx.fillStyle = 'rgba(220,38,38,.2)';
    ctx.fillRect(fx, y0, x1 - fx, h);
    ctx.strokeStyle = '#B91C1C';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y0);
    ctx.moveTo(x0, y0 + h); ctx.lineTo(x1, y0 + h);
    ctx.stroke();
    ctx.setLineDash([]);
    /* 文字：跳！／別跳！（不只靠顏色） */
    var text = tl.lane === 'low' ? '跳！' : '別跳！';
    ctx.font = '700 ' + Math.round(0.44 * T) + 'px ' + FONT;
    var tw = ctx.measureText(text).width, ph = 0.62 * T, pw = tw + 0.4 * T;
    var lx = Math.max(4, (PX - 0.6) * T - pw), ly = y0 + h / 2 - ph / 2;
    ctx.fillStyle = tl.lane === 'low' ? '#B91C1C' : '#1E3A8A';
    rrect(lx, ly, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, lx + pw / 2, ly + ph / 2 + 1);
    ctx.restore();
  }

  function syringe(tipX, y, fill, t) {
    var T = V.T;
    var rk = G.recoilAt ? (t - G.recoilAt) / 160 : 1;
    var recoil = !reduce && rk >= 0 && rk < 1 ? (1 - rk) * 0.2 * T : 0;
    ctx.save();
    ctx.translate(tipX + recoil, y);
    ctx.lineCap = 'round';
    /* 針（短短的，水從這裡出來） */
    ctx.strokeStyle = '#44403C';
    ctx.lineWidth = Math.max(2.5, 0.08 * T);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.38 * T, 0); ctx.stroke();
    ctx.strokeStyle = '#F5F5F4';
    ctx.lineWidth = Math.max(1, 0.03 * T);
    ctx.beginPath(); ctx.moveTo(0.04 * T, 0); ctx.lineTo(0.36 * T, 0); ctx.stroke();
    /* 針座 */
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#0C4A6E';
    ctx.lineWidth = 2;
    rrect(0.36 * T, -0.13 * T, 0.16 * T, 0.26 * T, 3); ctx.fill(); ctx.stroke();
    /* 針筒：水量 = 醫生還剩幾發 */
    var bx = 0.5 * T, bw = 1.15 * T, bh = 0.5 * T;
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth = Math.max(2, 0.05 * T);
    rrect(bx, -bh / 2, bw, bh, 0.12 * T); ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(bx + 0.05 * T, -bh / 2 + 0.07 * T, (bw - 0.1 * T) * clamp(fill, 0, 1), bh - 0.14 * T);
    rrect(bx, -bh / 2, bw, bh, 0.12 * T); ctx.stroke();
    ctx.strokeStyle = 'rgba(87,83,78,.7)';
    ctx.lineWidth = 1.5;
    for (var k = 1; k < 5; k++) {
      ctx.beginPath(); ctx.moveTo(bx + k * bw / 5, -bh / 2); ctx.lineTo(bx + k * bw / 5, -bh / 2 + 0.14 * T); ctx.stroke();
    }
    /* 推桿 */
    ctx.fillStyle = '#A8A29E';
    ctx.fillRect(bx + bw, -0.06 * T, 0.38 * T, 0.12 * T);
    ctx.fillStyle = '#57534E';
    rrect(bx + bw + 0.34 * T, -0.24 * T, 0.11 * T, 0.48 * T, 3); ctx.fill();
    /* 醫生的手 */
    ctx.fillStyle = '#FFE7D1';
    ctx.strokeStyle = '#9A3412';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx + bw * 0.62, 0.2 * T, 0.17 * T, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function water(sx, gY, lane) {
    var T = V.T, l = lane === 'low' ? B.LOW : B.HIGH;
    var cy = gY - (l[0] + l[1]) / 2 * T, h = (l[1] - l[0]) * T * 0.9, w = B.LEN * T;
    ctx.save();
    var g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, '#7DD3FC');
    g.addColorStop(1, '#0284C7');
    ctx.fillStyle = g;
    rrect(sx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = '#075985';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    rrect(sx - w / 2 + 0.18 * T, cy - h / 2 + 0.08 * T, w * 0.4, h * 0.22, h * 0.11);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    for (var k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(sx + w / 2 + k * 0.22 * T, cy + (k % 2 ? -1 : 1) * 0.08 * T, (0.1 - k * 0.02) * T, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function bubble(cx, bottom, text) {
    var T = V.T;
    ctx.save();
    ctx.font = '700 ' + Math.round(0.42 * T) + 'px ' + FONT;
    var tw = ctx.measureText(text).width, w = tw + 0.5 * T, h = 0.72 * T;
    var x = clamp(cx - w / 2, 4, V.w - w - 4), y = bottom - h;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth = 2;
    rrect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 0.12 * T, y + h - 1);
    ctx.lineTo(cx, y + h + 0.2 * T);
    ctx.lineTo(cx + 0.12 * T, y + h - 1);
    ctx.fill();
    ctx.fillStyle = '#7C2D12';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  function exclaim(cx, cy) {
    var T = V.T;
    ctx.save();
    ctx.fillStyle = '#B91C1C';
    ctx.beginPath(); ctx.arc(cx, cy, 0.3 * T, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 ' + Math.round(0.42 * T) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy + 1);
    ctx.restore();
  }

  /* ── 小粒子：跳起來的灰塵、撞到時的碎紙花、過關的彩帶（減少動態時不畫） ── */

  function puff(x, y, n, color) {
    if (reduce) return;
    for (var i = 0; i < n; i++) {
      G.parts.push({ x: x + (Math.random() - 0.5) * 0.4, y: y, vx: -0.5 - Math.random() * 1.5, vy: 0.4 + Math.random() * 1.6, t: 0, life: 0.45, r: 0.07 + Math.random() * 0.06, c: color, g: 4 });
    }
  }

  function burst(x, y) {
    if (reduce) return;
    var cs = ['#FB923C', '#FFF7ED', '#FDA4AF', '#FDBA74'];
    for (var i = 0; i < 14; i++) {
      var ang = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
      G.parts.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + 1.5, t: 0, life: 0.7, r: 0.08 + Math.random() * 0.08, c: cs[i % cs.length], g: 7 });
    }
  }

  function confetti(x, y) {
    if (reduce) return;
    var cs = ['#F97316', '#FACC15', '#22C55E', '#38BDF8', '#F472B6'];
    for (var i = 0; i < 36; i++) {
      G.parts.push({ x: x + (Math.random() - 0.3) * 4, y: y + 3 + Math.random() * 3, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, t: 0, life: 1.4, r: 0.08 + Math.random() * 0.06, c: cs[i % cs.length], g: 3 });
    }
  }

  function stepParticles(dt) {
    var ps = G.parts;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      p.t += dt;
      if (p.t >= p.life) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= p.g * dt;
    }
  }

  function drawParticles(camX, gY) {
    var T = V.T, ps = G.parts;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc((p.x - camX) * T, gY - p.y * T, p.r * T, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  renderLevels();

  /* 測試用 */
  window.__dash = {
    G: G, V: V, start: start, begin: begin, tick: tick, pause: pause, handle: handle,
    record: function () { return rec; }, speed: speed
  };
})();
