/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 打地鼠（單機）畫面與操作
   遊戲規則與數字在 engine.js（WhackEngine），這裡只處理畫面、計時與輸入。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var E = window.WhackEngine;
  var C = E.CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var live = $('liveRegion');

  /* 無痕模式下存取 localStorage 本身可能丟例外：退回記憶體，遊戲照玩，只是不會記住 */
  var storage = (function () {
    try { if (window.localStorage) return window.localStorage; } catch (e) { /* 忽略 */ }
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } };
  })();

  var progress = E.loadProgress(storage, p.code);
  var band = E.ageBand(p.age);

  /* 題庫載入失敗（離線）就跳過小知識；該題保留到下次 */
  var bank = null;
  if (window.fetch) {
    window.fetch('/games/whack-a-mole/questions.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (!b || !b.questions) return;
        bank = b;
        if (S.view === 'intro') { renderCollection($('collection')); renderChallengeHint($('introChallenge')); }
        if (S.view === 'summary') { renderCollection($('summaryCollection')); renderChallengeHint($('summaryChallenge')); }
      })
      .catch(function () { /* 離線：略過 */ });
  }

  function save() { E.saveProgress(storage, progress); }
  function fmt(n) { return Number(n).toLocaleString('zh-TW'); }

  function setArt(useEl, id) {
    useEl.setAttribute('href', '#' + (id.indexOf('-') > 0 ? id : 'ch-' + id));
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + (id.indexOf('-') > 0 ? id : 'ch-' + id));
  }

  function roundLabel(r) {
    return r <= C.ROUNDS ? '第 ' + r + ' / ' + C.ROUNDS + ' 回合' : '無限模式・第 ' + r + ' 回合';
  }

  var COAT_NAME = { normal: '', silver: '銀色', boss: '金色大魔王', iron: '鐵甲' };

  /* ─────────────────────────────────────────────────────────────
     狀態
     ───────────────────────────────────────────────────────────── */

  var S = {
    view: 'intro',
    round: 1,
    runScore: 0,
    roundScore: 0,
    roundStartTotal: 0,
    clock: 0,          /* 這回合已經過的毫秒（暫停時不走） */
    lastTs: null,
    rafId: null,
    running: false,
    nextSpawnAt: 0,
    shownSec: null,
    stay: 1,
    hammer: 1,
    holes: [],
    scrub: null,       /* 病毒入侵時按住螢幕的手指：{ id, x, y } */
    invasionAt: null,  /* 這回合幾毫秒時病毒入侵（null：沒有或已經入侵過） */
    invasion: null,    /* 入侵中：{ until } */
    invasionTaught: false, /* 這一局已經看過入侵教學 */
    quiz: null,
    unlocked: [],
    leaving: false,
    boss: null,        /* 大魔王所在的洞（在場時暫停冒出其他角色） */
    bosses: 0,         /* 這一回合出現過幾隻大魔王 */
    streak: 0,         /* 連擊：連續抓到、沒有角色逃走（決定分數倍率） */
    roundBestStreak: 0,
    appeared: 0,       /* 這一回合出現幾個（算獎牌用） */
    caught: 0,
    medal: null,
    medalBonus: 0,
    newStickers: []
  };

  var views = { intro: $('introView'), play: $('playView'), quiz: $('quizView'), summary: $('summaryView') };

  function show(name, focusEl) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    S.view = name;
    document.body.classList.toggle('is-playing', name === 'play');
    window.scrollTo(0, 0);
    if (focusEl) focusEl.focus();
  }

  /* ─────────────────────────────────────────────────────────────
     棋盤：6 個洞，未解鎖的顯示「維修中」
     ───────────────────────────────────────────────────────────── */

  var board = $('board');

  var HOLE_HTML =
    '<svg class="hole-back" aria-hidden="true"><use href="#hole-back"></use></svg>' +
    '<span class="mole-clip" aria-hidden="true"><span class="mole">' +
    '<span class="hp"><span class="hp-fill"></span></span>' +
    '<span class="coat-badge"></span>' +
    '<svg class="mole-art"><use href="#ch-swab"></use></svg>' +
    '</span></span>' +
    '<svg class="hole-front" aria-hidden="true"><use href="#hole-front"></use></svg>';

  var LOCKED_HTML =
    '<svg class="hole-back" aria-hidden="true"><use href="#hole-back"></use></svg>' +
    '<svg class="hole-boards" aria-hidden="true"><use href="#hole-boards"></use></svg>' +
    '<svg class="hole-front" aria-hidden="true"><use href="#hole-front"></use></svg>' +
    '<span class="locked-sign"><svg aria-hidden="true"><use href="#icon-cone"></use></svg>維修中</span>';

  function buildBoard() {
    var open = E.unlocks(progress.totalPoints).holes.value;
    board.innerHTML = '';
    S.holes = [];
    for (var i = 0; i < C.HOLES_TOTAL; i++) {
      var isOpen = i < open;
      var el = document.createElement(isOpen ? 'button' : 'div');
      if (isOpen) {
        el.type = 'button';
        el.className = 'hole';
        el.dataset.i = i;
        el.setAttribute('aria-label', '第 ' + (i + 1) + ' 個洞');
        el.innerHTML = HOLE_HTML + '<span class="hole-key" aria-hidden="true">' + (i + 1) + '</span>';
      } else {
        el.className = 'hole is-locked';
        el.innerHTML = LOCKED_HTML;
      }
      board.appendChild(el);
      S.holes.push({
        i: i, el: el, open: isOpen, mole: null, freeAt: 0,
        moleEl: isOpen ? el.querySelector('.mole') : null,
        use: isOpen ? el.querySelector('.mole-art use') : null,
        hpFill: isOpen ? el.querySelector('.hp-fill') : null,
        badge: isOpen ? el.querySelector('.coat-badge') : null
      });
    }
  }

  function holeLabel(h) {
    var base = '第 ' + (h.i + 1) + ' 個洞';
    if (!h.mole) return base;
    return base + '：' + COAT_NAME[h.mole.variant] + E.BY_ID[h.mole.char].name;
  }

  var BADGE = {
    normal: '', silver: '×1.5', iron: '×2',
    boss: '<svg aria-hidden="true"><use href="#icon-crown"></use></svg>大魔王'
  };

  function raise(h, char, variant) {
    var boss = variant === 'boss';
    if (boss) {
      /* 大魔王登場：其他角色先躲起來（不算逃走、也不算進獎牌的「出現」） */
      S.holes.forEach(function (o) {
        if (o !== h && o.mole) { lower(o, false); S.appeared--; }
      });
      S.boss = h;
      S.bosses++;
    }
    var hp = E.maxHp(variant, p.age);
    S.appeared++;
    h.mole = {
      char: char, variant: variant, hp: hp, maxHp: hp,
      upAt: S.clock,
      downAt: S.clock + E.upMs(char, variant, progress.level[char], p.age, S.stay, S.round),
      lastWipe: -Infinity
    };
    setArt(h.use, char);
    h.moleEl.className = 'mole v-' + variant;
    h.badge.innerHTML = BADGE[variant];
    h.el.classList.toggle('has-hp', hp > 1);
    h.el.classList.toggle('is-boss', boss);
    h.hpFill.style.width = '100%';
    h.el.classList.remove('is-hit', 'is-nope', 'is-hurt');
    h.el.dataset.char = char;
    h.el.classList.add('is-up');
    h.el.setAttribute('aria-label', holeLabel(h));
    if (boss) {
      setBossLook(true);
      callout('大魔王來了！');
    }
  }

  function lower(h, hit) {
    if (!h.mole) return;
    h.mole = null;
    h.freeAt = S.clock + 220; /* 等縮回去的動畫結束，才讓下一隻從同一個洞出來 */
    if (h === S.boss) {
      S.boss = null;
      S.nextSpawnAt = Math.max(S.nextSpawnAt, S.clock + C.BOSS_REST_MS);
      h.el.classList.remove('is-boss');
      setBossLook(false);
    }
    h.el.classList.remove('is-up', 'is-hurt');
    if (hit) h.el.classList.add('is-hit');
    delete h.el.dataset.char;
    h.el.setAttribute('aria-label', holeLabel(h));
  }

  function msToInvasion() {
    if (S.invasion) return 0;
    return S.invasionAt === null ? Infinity : S.invasionAt - S.clock;
  }

  function spawn() {
    if (S.boss) return; /* 大魔王在場：專心打它 */
    var free = S.holes.filter(function (h) { return h.open && !h.mole && S.clock >= h.freeAt; });
    if (!free.length) return;
    var h = free[Math.floor(Math.random() * free.length)];
    /* 病毒入侵：只出現病毒 */
    var char = S.invasion ? 'virus' : E.pickCharacter(progress, Math.random, S.round);
    var variant = E.pickVariant(progress.level[char], Math.random);
    if (variant === 'boss' && !E.bossAllowed(S.bosses, C.ROUND_MS - S.clock, S.stay, msToInvasion())) variant = 'normal';
    raise(h, char, variant);
  }

  /* ─────────────────────────────────────────────────────────────
     打擊
     ───────────────────────────────────────────────────────────── */

  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; /* 重新觸發同一個動畫 */
    el.classList.add(cls);
  }

  function popScore(h, pts, variant) {
    var s = document.createElement('span');
    s.className = 'pop-score' + (variant === 'normal' ? '' : ' is-' + variant);
    s.textContent = '+' + pts;
    s.setAttribute('aria-hidden', 'true');
    h.el.appendChild(s);
    window.setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 700);
  }

  function knockOut(h) {
    var m = h.mole;
    S.streak++;
    S.roundBestStreak = Math.max(S.roundBestStreak, S.streak);
    if (S.streak === 10) award('streak10');
    C.STREAK_TIERS.forEach(function (t) {
      if (S.streak === t.at) callout(t.at + ' 連擊！×' + t.mult);
    });
    /* 取到十位數，分數比較好看（150、200、300…） */
    var pts = Math.round(E.pointsFor(m.char, m.variant) * E.streakMult(S.streak) / 10) * 10;
    S.caught++;
    award('first');
    if (m.char === 'virus') award('virus');
    if (m.variant === 'iron') award('iron');
    if (m.variant === 'boss') {
      award('boss');
      callout('打倒大魔王！');
    }
    S.runScore += pts;
    S.roundScore += pts;
    progress.totalPoints += pts;
    progress.clicks[m.char] = (progress.clicks[m.char] || 0) + 1;
    popScore(h, pts, m.variant);
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* 忽略 */ } }
    lower(h, true);
    $('hudScore').textContent = fmt(S.runScore);
    renderCombo();
  }

  function damage(h, amount) {
    var m = h.mole;
    m.hp = Math.max(0, m.hp - amount);
    if (m.hp > 0) {
      h.hpFill.style.width = Math.round(100 * m.hp / m.maxHp) + '%';
      retrigger(h.el, 'is-hurt');
      if (h === S.boss) renderCombo();
      return;
    }
    knockOut(h);
  }

  function wipe(h) {
    var m = h.mole;
    if (S.clock - m.lastWipe < C.WIPE_COOLDOWN_MS) return;
    m.lastWipe = S.clock;
    damage(h, 1); /* 棉片擦一次扣一格；槌子升級只影響「點」 */
  }

  function wipeHole(h) {
    if (h && h.mole && E.BY_ID[h.mole.char].wipe) wipe(h);
  }

  /* 入侵以外的時間點到病毒（只有測試會發生）：搖頭表示「要用棉片喔」 */
  function nope(h) {
    retrigger(h.el, 'is-nope');
  }

  /* ─────────────────────────────────────────────────────────────
     連擊條：平常顯示離下一個加成還差幾個；大魔王在場時變成它的血條
     ───────────────────────────────────────────────────────────── */

  var comboEl = $('combo');
  var comboFill = $('comboFill');
  var comboCount = $('comboCount');
  var comboLabel = $('comboLabel');

  var comboMult = $('comboMult');
  var calloutEl = $('callout');
  var calloutTimer = null;

  /* 大字從棋盤中間跳出來：連擊里程碑、大魔王 */
  function callout(text) {
    calloutEl.textContent = text;
    retrigger(calloutEl, 'is-on');
    window.clearTimeout(calloutTimer);
    calloutTimer = window.setTimeout(function () { calloutEl.classList.remove('is-on'); }, 1000);
    Anxin.announce(live, text);
  }

  function renderMult() {
    var m = E.streakMult(S.streak);
    comboMult.hidden = m <= 1;
    comboMult.textContent = '×' + m;
  }

  function renderCombo() {
    renderMult();
    if (S.invasion) {
      var left = Math.max(0, S.invasion.until - S.clock);
      comboFill.style.width = (100 * left / C.INVASION_MS).toFixed(1) + '%';
      comboCount.textContent = Math.ceil(left / 1000) + ' 秒';
      return;
    }
    var b = S.boss && S.boss.mole;
    if (b) {
      comboFill.style.width = Math.round(100 * b.hp / b.maxHp) + '%';
      comboCount.textContent = b.hp + ' / ' + b.maxHp;
      return;
    }
    var next = E.nextStreakTier(S.streak);
    comboFill.style.width = next ? Math.round(100 * S.streak / next.at) + '%' : '100%';
    comboCount.textContent = next ? S.streak + ' / ' + next.at : String(S.streak);
  }

  function setBossLook(on) {
    comboEl.classList.toggle('is-boss', on);
    board.classList.toggle('is-boss', on);
    comboLabel.textContent = on ? '大魔王' : '連擊';
    renderCombo();
  }

  /* 有角色逃走：連擊歸零、倍率消失 */
  function breakCombo() {
    S.streak = 0;
    renderCombo();
  }

  /* ─────────────────────────────────────────────────────────────
     病毒入侵：7 秒只出現病毒；手指就是酒精棉片，按住就一直消毒
     ───────────────────────────────────────────────────────────── */

  var invasionHint = $('invasionHint');

  function setInvasionLook(on) {
    comboEl.classList.toggle('is-invasion', on);
    board.classList.toggle('is-invasion', on);
    invasionHint.hidden = !on;
    comboLabel.textContent = on ? '病毒入侵' : '連擊';
    renderCombo();
  }

  /* 其他角色先躲起來：不算逃走、也不算進獎牌的「出現」 */
  function clearBoard() {
    S.holes.forEach(function (h) {
      if (h.mole) { lower(h, false); S.appeared--; }
    });
  }

  function startInvasion() {
    S.invasionAt = null;
    clearBoard();
    S.invasion = { until: S.clock + C.INVASION_MS };
    S.nextSpawnAt = S.clock + C.INVASION_FIRST_MS;
    setInvasionLook(true);
    /* 這一局第一次：先跳出教學，時間停住；按「開始消毒」才開始倒數 */
    if (!S.invasionTaught) {
      S.invasionTaught = true;
      halt();
      virusDlg.open();
      return;
    }
    callout('病毒入侵！');
  }

  function endInvasion(quiet) {
    S.invasion = null;
    endScrub();
    clearBoard();
    setInvasionLook(false);
    S.nextSpawnAt = S.clock + C.INVASION_REST_MS;
    if (!quiet) callout('消毒完成！');
  }

  function award(id) {
    if (E.earnSticker(progress, id)) S.newStickers.push(id);
  }

  function tapHole(i) {
    if (!S.running) return;
    var h = S.holes[i];
    if (!h || !h.open || !h.mole) return;
    if (E.BY_ID[h.mole.char].wipe) {
      if (S.invasion) wipe(h); else nope(h);
      return;
    }
    damage(h, S.hammer);
  }

  board.addEventListener('pointerdown', function (ev) {
    if (S.invasion && S.running) {
      ev.preventDefault();
      startScrub(ev);
      return;
    }
    var el = ev.target.closest('.hole');
    if (!el || el.classList.contains('is-locked')) return;
    ev.preventDefault();
    tapHole(Number(el.dataset.i));
  });

  /* 按住消毒：手指在哪裡，就擦哪裡的病毒；手指不動也會繼續擦（每一幀檢查一次，靠冷卻控制速度） */
  var ghost = $('dragGhost');

  function placeGhost(x, y) {
    ghost.style.transform = 'translate(' + Math.round(x - 36) + 'px,' + Math.round(y - 44) + 'px)';
  }

  function wipeAt(x, y) {
    var el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    var holeEl = el && el.closest ? el.closest('.hole') : null;
    if (!holeEl || holeEl.classList.contains('is-locked')) return;
    wipeHole(S.holes[Number(holeEl.dataset.i)]);
  }

  function startScrub(ev) {
    try { board.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
    S.scrub = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    ghost.hidden = false;
    placeGhost(ev.clientX, ev.clientY);
    document.body.classList.add('is-scrubbing');
    var el = ev.target.closest ? ev.target.closest('.hole') : null;
    if (el && !el.classList.contains('is-locked')) wipeHole(S.holes[Number(el.dataset.i)]);
    else wipeAt(ev.clientX, ev.clientY);
  }

  function endScrub() {
    S.scrub = null;
    ghost.hidden = true;
    document.body.classList.remove('is-scrubbing');
  }

  board.addEventListener('pointermove', function (ev) {
    var d = S.scrub;
    if (!d || ev.pointerId !== d.id) return;
    d.x = ev.clientX;
    d.y = ev.clientY;
    placeGhost(d.x, d.y);
    if (S.running) wipeAt(d.x, d.y);
  });

  /* 長按不跳出系統選單（Android 長按可能會跳，打斷按住消毒） */
  board.addEventListener('contextmenu', function (ev) {
    if (S.view === 'play') ev.preventDefault();
  });

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
    board.addEventListener(type, function (ev) {
      if (S.scrub && ev.pointerId === S.scrub.id) endScrub();
    });
  });

  /* 只處理鍵盤觸發的 click（Enter／Space）；手指點擊已經在 pointerdown 處理過 */
  board.addEventListener('click', function (ev) {
    if (ev.detail !== 0) return;
    var el = ev.target.closest('.hole');
    if (!el || el.classList.contains('is-locked')) return;
    tapHole(Number(el.dataset.i));
  });

  /* ─────────────────────────────────────────────────────────────
     鍵盤：1–6 打對應的洞（入侵時是擦；按住按鍵會自動重複＝持續消毒）、Esc 暫停
     ───────────────────────────────────────────────────────────── */

  document.addEventListener('keydown', function (ev) {
    if (S.view !== 'play' || !S.running || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key >= '1' && ev.key <= '6') {
      ev.preventDefault();
      tapHole(Number(ev.key) - 1);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      pause();
    }
  });

  /* ─────────────────────────────────────────────────────────────
     計時迴圈：時間只在遊戲進行時走，暫停或切到別的 App 都會停
     ───────────────────────────────────────────────────────────── */

  var timeEl = $('hudTime');
  var timeWrap = $('hudTimeWrap');

  function renderTime(tLeft) {
    var s = Math.ceil(tLeft);
    if (s === S.shownSec) return;
    S.shownSec = s;
    timeEl.textContent = s;
    timeWrap.classList.toggle('is-low', s <= 5);
  }

  function frame(ts) {
    if (!S.running) return;
    if (S.lastTs === null) S.lastTs = ts;
    /* 上限 100ms：分頁剛回來時不會一口氣跳過好幾秒 */
    var dt = Math.min(Math.max(ts - S.lastTs, 0), 100);
    S.lastTs = ts;
    S.clock += dt;

    S.holes.forEach(function (h) {
      if (h.mole && S.clock >= h.mole.downAt) {
        var wasBoss = h === S.boss;
        lower(h, false);
        if (!S.invasion) breakCombo(); /* 有角色逃走 → 連擊歸零（入侵時病毒很多，不算） */
        if (wasBoss) callout('大魔王跑掉了！');
      }
    });

    if (S.invasion) {
      if (S.clock >= S.invasion.until) endInvasion();
    } else if (S.invasionAt !== null && S.clock >= S.invasionAt && !S.boss) {
      startInvasion();
      if (!S.running) return; /* 第一次入侵：教學對話框開著，時間停住 */
    }
    if (S.scrub) wipeAt(S.scrub.x, S.scrub.y); /* 手指按著不動，也繼續消毒 */
    if (S.invasion) renderCombo();

    if (S.clock >= C.ROUND_MS) {
      endRound();
      return;
    }

    var tLeft = (C.ROUND_MS - S.clock) / 1000;
    if (S.clock >= S.nextSpawnAt) {
      spawn();
      S.nextSpawnAt = S.clock + (S.invasion ? E.invasionSpawnMs : E.spawnIntervalMs)(tLeft, S.round, p.age);
    }
    renderTime(tLeft);
    S.rafId = window.requestAnimationFrame(frame);
  }

  function resume() {
    if (S.running) return;
    S.running = true;
    S.lastTs = null;
    S.rafId = window.requestAnimationFrame(frame);
  }

  function halt() {
    S.running = false;
    if (S.rafId !== null) window.cancelAnimationFrame(S.rafId);
    S.rafId = null;
    endScrub();
  }

  /* ─────────────────────────────────────────────────────────────
     回合
     ───────────────────────────────────────────────────────────── */

  function startRun() {
    S.round = 1;
    S.runScore = 0;
    S.invasionTaught = false;
    startRound();
  }

  function startRound() {
    var u = E.unlocks(progress.totalPoints);
    S.stay = u.stay.value;
    S.hammer = u.hammer.value;
    S.clock = 0;
    S.nextSpawnAt = 600; /* 給小朋友半秒準備 */
    S.roundScore = 0;
    S.roundStartTotal = progress.totalPoints;
    S.shownSec = null;
    S.boss = null;
    S.bosses = 0;
    S.invasion = null;
    S.invasionAt = E.invasionAt(S.round, Math.random);
    S.streak = 0;
    S.roundBestStreak = 0;
    S.appeared = 0;
    S.caught = 0;
    S.newStickers = [];
    buildBoard();
    setBossLook(false);
    setInvasionLook(false);
    $('hudRound').textContent = roundLabel(S.round);
    $('hudScore').textContent = fmt(S.runScore);
    renderTime(C.ROUND_MS / 1000);
    show('play', $('pauseBtn'));
    Anxin.announce(live, roundLabel(S.round) + '開始');
    resume();
  }

  function endRound() {
    halt();
    if (S.invasion) endInvasion(true); /* 先收掉入侵（還在場的病毒不算數），再收其他角色 */
    S.holes.forEach(function (h) { lower(h, false); });
    progress.bestScore = Math.max(progress.bestScore, S.runScore);
    progress.bestRound = Math.max(progress.bestRound, S.round);
    /* 回合獎牌：抓到 ÷ 出現；獎勵分數也算進總分（可能因此解鎖新獎勵） */
    S.medal = E.medalFor(S.caught, S.appeared);
    S.medalBonus = S.medal ? S.medal.bonus : 0;
    if (S.medalBonus) {
      S.runScore += S.medalBonus;
      S.roundScore += S.medalBonus;
      progress.totalPoints += S.medalBonus;
    }
    if (S.medal && S.medal.id === 'gold') award('gold');
    if (S.round === C.ROUNDS) award('round6');
    progress.bestStreak = Math.max(progress.bestStreak || 0, S.roundBestStreak);
    progress.bestScore = Math.max(progress.bestScore, S.runScore);

    S.unlocked = E.newlyUnlocked(S.roundStartTotal, progress.totalPoints);
    progress.roundsPlayed += 1;
    save();
    Anxin.announce(live, roundLabel(S.round) + '結束，這回合得到 ' + S.roundScore + ' 分');
    showSummary();
  }

  /* ─────────────────────────────────────────────────────────────
     暫停
     ───────────────────────────────────────────────────────────── */

  var virusDlgEl = $('virusDlg');
  var virusDlg = Anxin.wireDialog(virusDlgEl);

  $('virGo').addEventListener('click', function () { virusDlgEl.close(); });

  /* 不論按按鈕或 Esc 關掉，都開始入侵的 7 秒 */
  virusDlgEl.addEventListener('close', function () {
    if (S.view === 'play' && !S.running && S.invasion) {
      callout('病毒入侵！');
      resume();
    }
  });

  var pauseDlgEl = $('pauseDlg');
  var pauseDlg = Anxin.wireDialog(pauseDlgEl);

  function pause() {
    if (S.view !== 'play' || !S.running) return;
    halt();
    save();
    if (!pauseDlgEl.open) pauseDlg.open();
  }

  $('pauseBtn').addEventListener('click', pause);

  pauseDlgEl.addEventListener('close', function () {
    if (S.leaving) { S.leaving = false; return; }
    if (S.view === 'play') resume();
  });

  $('restartBtn').addEventListener('click', function () {
    S.leaving = true;
    pauseDlgEl.close();
    goIntro();
  });

  /* 家長接電話、切到別的 App：自動暫停 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
  });
  window.addEventListener('pagehide', save);

  /* ─────────────────────────────────────────────────────────────
     收藏
     ───────────────────────────────────────────────────────────── */

  var STAR = '<svg class="star" aria-hidden="true"><use href="#icon-star"></use></svg>';

  function renderCollection(ul) {
    ul.innerHTML = E.CHARACTERS.map(function (c) {
      var clicks = progress.clicks[c.id] || 0;
      var lv = progress.level[c.id] || 0;
      var ready = E.tierOf(clicks) > lv;
      var next = lv < C.MAX_LEVEL ? C.TIERS[lv] : null;
      var prev = lv > 0 ? C.TIERS[lv - 1] : 0;
      var pct = next ? Math.max(0, Math.min(100, Math.round(100 * (clicks - prev) / (next - prev)))) : 100;
      var stars = '';
      for (var i = 0; i < C.MAX_LEVEL; i++) stars += '<span class="star-slot' + (i < lv ? ' is-on' : '') + '">' + STAR + '</span>';
      var locked = ready && E.isLocked(progress, c.id);
      var canGo = ready && !locked && !!bank;
      var status = !next ? '已經滿級！'
        : (locked ? '下一回合結束後可以再挑戰'
          : (ready ? '題目載入中…'
            : (clicks === 0 && (c.from || 1) > 1 ? '第 ' + c.from + ' 回合登場'
              : '再收集 ' + (next - clicks) + ' 個就能挑戰')));
      var inner =
        '<svg class="coll-art" aria-hidden="true"><use href="#ch-' + c.id + '"></use></svg>' +
        '<span class="coll-name">' + esc(c.name) + '</span>' +
        '<span class="coll-stars" role="img" aria-label="等級 ' + lv + ' / ' + C.MAX_LEVEL + '">' + stars + '</span>' +
        '<span class="coll-count">收集 ' + clicks + ' 個</span>' +
        '<span class="coll-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span>';
      /* 可以挑戰：整張卡片就是按鈕（淡黃底＋深色外框），點一下直接開始；不另外放按鈕 */
      if (canGo) {
        return '<li class="coll-cell"><button type="button" class="coll-item is-ready" data-char="' + c.id + '"' +
          ' aria-label="' + esc(c.name) + '：挑戰小知識，答對就升級">' + inner + '</button></li>';
      }
      return '<li class="coll-cell"><div class="coll-item">' + inner +
        '<span class="coll-status">' + status + '</span></div></li>';
    }).join('');
  }

  /* ─────────────────────────────────────────────────────────────
     貼紙簿
     ───────────────────────────────────────────────────────────── */

  function stickerHtml(st, earned) {
    return '<li class="sticker' + (earned ? ' is-earned' : '') + '">' +
      '<span class="sticker-art sticker-' + st.id + '" aria-hidden="true"><svg><use href="#' + st.art + '"></use></svg>' +
      (st.id === 'streak10' ? '<b>10</b>' : '') + '</span>' +
      '<span class="sticker-name">' + esc(st.name) + '</span>' +
      '<span class="sticker-hint">' + (earned ? '已獲得' : esc(st.hint)) + '</span></li>';
  }

  function renderStickerBook() {
    var got = progress.stickers || {};
    var n = E.STICKERS.filter(function (st) { return got[st.id]; }).length;
    $('stickerCount').textContent = n + ' / ' + E.STICKERS.length;
    $('stickerBook').innerHTML = E.STICKERS.map(function (st) { return stickerHtml(st, !!got[st.id]); }).join('');
  }

  function renderNewStickers() {
    var list = S.newStickers.map(function (id) {
      return E.STICKERS.filter(function (st) { return st.id === id; })[0];
    }).filter(Boolean);
    $('newStickerList').innerHTML = list.map(function (st) { return stickerHtml(st, true); }).join('');
    $('newStickers').hidden = !list.length;
  }

  /* ─────────────────────────────────────────────────────────────
     小知識區域
     答錯不公布答案：規格是下一回合結束再挑戰「同一題」
     ───────────────────────────────────────────────────────────── */

  var COAT_NOTE = [
    '',
    '之後會出現銀色的它：分數更高，但跑得更快！',
    '金色大魔王會出現了：要連續敲很多下才打得倒，打倒有 5 倍分數！',
    '鐵甲版本登場：停得比較久，但要敲好幾下才打得倒！'
  ];

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function openChallenge(charId, from) {
    if (!bank || !E.canChallenge(progress, charId)) return;
    var quiz = E.challengeFor(progress, bank, band, charId);
    if (quiz) showQuiz(quiz, from);
  }

  function leaveQuiz() {
    var from = S.quiz ? S.quiz.from : 'summary';
    S.quiz = null;
    if (from === 'intro') goIntro();
    else showSummary();
  }

  /* 兩個收藏清單共用：點可以挑戰的卡片 */
  ['collection', 'summaryCollection'].forEach(function (id) {
    $(id).addEventListener('click', function (ev) {
      var b = ev.target.closest('.coll-item.is-ready');
      if (b) openChallenge(b.dataset.char, id === 'collection' ? 'intro' : 'summary');
    });
  });

  function showQuiz(quiz, from) {
    var q = quiz.question;
    S.quiz = { character: quiz.character, question: q, done: false, from: from };
    setArt($('quizArt'), quiz.character);
    $('quizCharName').textContent = E.BY_ID[quiz.character].name;
    $('quizParent').hidden = band !== 'little';
    $('quizPrompt').textContent = q.prompt;
    $('quizHint').textContent = q.hint;
    $('quizHint').hidden = true;
    $('hintBtn').hidden = false;
    $('quizResult').hidden = true;
    $('quizNext').hidden = true;
    $('quizSkip').hidden = false;

    var opts = q.type === 'tf'
      ? [{ v: 'true', label: '對' }, { v: 'false', label: '不對' }]
      : shuffle(q.options.map(function (label, idx) { return { v: String(idx), label: label }; }));
    $('quizOptions').innerHTML = opts.map(function (o) {
      return '<button type="button" class="quiz-opt' + (q.type === 'tf' ? ' is-tf' : '') +
        '" data-v="' + o.v + '">' + esc(o.label) + '</button>';
    }).join('');
    $('quizOptions').classList.toggle('is-tf', q.type === 'tf');

    show('quiz', $('quizTitle'));
  }

  $('quizOptions').addEventListener('click', function (ev) {
    var b = ev.target.closest('.quiz-opt');
    if (!b || !S.quiz || S.quiz.done) return;
    var q = S.quiz.question;
    var charId = S.quiz.character;
    var choice = q.type === 'tf' ? b.dataset.v === 'true' : Number(b.dataset.v);
    var ok = E.isCorrect(q, choice);
    S.quiz.done = true;

    Array.prototype.forEach.call($('quizOptions').querySelectorAll('.quiz-opt'), function (x) { x.disabled = true; });
    b.classList.add(ok ? 'is-right' : 'is-wrong');

    var r = $('quizResult');
    var name = esc(E.BY_ID[charId].name);
    E.recordAnswer(progress, charId, q.id, ok);
    if (ok) award('quiz');
    if (ok) {
      var lv = progress.level[charId];
      r.className = 'quiz-result is-right';
      r.innerHTML = '<strong>答對了！</strong><span>' + esc(q.explain) + '</span>' +
        '<span class="quiz-levelup">' + name + ' 升級到 Lv ' + lv + '！' + COAT_NOTE[lv] + '</span>';
    } else {
      r.className = 'quiz-result is-wrong';
      r.innerHTML = '<strong>差一點點！</strong>' +
        '<span>可以問問爸爸媽媽。玩完下一回合，就能再挑戰這一題。</span>';
    }
    save();
    r.hidden = false;
    $('quizSkip').hidden = true;
    $('quizNext').hidden = false;
    $('quizNext').focus();
    Anxin.announce(live, ok ? '答對了' : '差一點點，玩完下一回合再挑戰');
  });

  $('hintBtn').addEventListener('click', function () {
    $('quizHint').hidden = false;
    $('hintBtn').hidden = true;
  });

  $('quizNext').addEventListener('click', leaveQuiz);
  $('quizSkip').addEventListener('click', leaveQuiz); /* 還沒作答就離開：不算答錯 */

  /* ─────────────────────────────────────────────────────────────
     回合結算
     ───────────────────────────────────────────────────────────── */

  function renderChallengeHint(el) {
    var n = bank ? E.CHARACTERS.filter(function (c) { return E.canChallenge(progress, c.id); }).length : 0;
    el.textContent = n ? '有 ' + n + ' 位角色可以挑戰小知識：點一下黃色的卡片！' : '';
    el.hidden = !n;
  }

  function unlockText(u) {
    if (u.track === 'holes') return '第 ' + u.value + ' 個洞修好了，可以打的洞變多了！';
    if (u.track === 'stay') return '大家會在洞外停留更久（×' + u.value + '）';
    return '槌子變強了：鐵甲和大魔王一次扣 ' + u.value + ' 格';
  }

  function showSummary() {
    var r = S.round;
    $('summaryTitle').textContent = r < C.ROUNDS ? '第 ' + r + ' 回合完成！'
      : (r === C.ROUNDS ? '六個回合都完成了！' : '無限模式・第 ' + r + ' 回合完成！');
    $('roundScore').textContent = fmt(S.roundScore);
    $('runScore').textContent = fmt(S.runScore);

    var mc = $('medalCard');
    if (S.medal) {
      mc.className = 'medal medal-' + S.medal.id;
      $('medalName').textContent = S.medal.name;
      $('medalRate').textContent = '抓到 ' + S.caught + ' / ' + S.appeared + ' 個';
      $('medalBonus').textContent = '+' + fmt(S.medalBonus) + ' 分';
      mc.hidden = false;
    } else {
      mc.hidden = true;
    }
    var sl = $('streakLine');
    sl.textContent = '這回合最高連擊 ' + S.roundBestStreak + (S.roundBestStreak >= 5 ? '，好厲害！' : '');
    sl.hidden = S.roundBestStreak < 2;
    renderNewStickers();
    $('infinityNote').hidden = r !== C.ROUNDS;

    var ul = $('unlockList');
    ul.innerHTML = S.unlocked.map(function (u) {
      return '<li><strong>解鎖：' + esc(u.label) + '</strong><span>' + esc(unlockText(u)) + '</span></li>';
    }).join('');
    ul.hidden = !S.unlocked.length;

    renderCollection($('summaryCollection'));
    renderChallengeHint($('summaryChallenge'));
    var goal = E.nextUnlock(progress.totalPoints);
    $('nextGoal').textContent = goal
      ? '再得 ' + fmt(goal.at - progress.totalPoints) + ' 分，就能解鎖「' + goal.label + '」'
      : '所有獎勵都解鎖了，太厲害了！';

    $('nextRoundBtn').textContent = r < C.ROUNDS ? '開始第 ' + (r + 1) + ' 回合'
      : (r === C.ROUNDS ? '進入無限模式' : '繼續下一回合');
    show('summary', $('summaryTitle'));
  }

  $('nextRoundBtn').addEventListener('click', function () {
    S.round++;
    startRound();
  });

  $('endBtn').addEventListener('click', goIntro);

  /* ─────────────────────────────────────────────────────────────
     開始畫面
     ───────────────────────────────────────────────────────────── */

  function goIntro() {
    halt();
    S.holes.forEach(function (h) { lower(h, false); });
    S.invasion = null;
    S.invasionAt = null;
    save();
    renderCollection($('collection'));
    renderChallengeHint($('introChallenge'));
    renderStickerBook();
    var best = $('bestLine');
    if (progress.bestScore > 0) {
      best.textContent = '最高分 ' + fmt(progress.bestScore) + ' 分・最遠到' + roundLabel(progress.bestRound).replace(' / ' + C.ROUNDS, '');
      best.hidden = false;
    }
    show('intro', S.view === 'intro' ? null : $('introTitle'));
  }

  $('startBtn').addEventListener('click', startRun);

  goIntro();

  /* 測試用：讓自動化測試能指定某個洞出現某個角色（一般遊玩不會用到） */
  window.__wam = {
    state: S,
    progress: function () { return progress; },
    raise: function (i, char, variant) { raise(S.holes[i], char, variant || 'normal'); },
    setBank: function (b) { bank = b; },
    jumpToRound: function (n) { halt(); S.round = n; startRound(); },
    invade: function () { startInvasion(); }
  };
})();
