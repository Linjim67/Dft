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
      .then(function (b) { if (b && b.questions) bank = b; })
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

  var COAT_NAME = { normal: '', silver: '銀色', gold: '金色', iron: '鐵甲' };

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
    armed: false,      /* 點選模式：已經拿起酒精棉片 */
    drag: null,
    quiz: null,
    unlocked: [],
    leaving: false
  };

  var views = { intro: $('introView'), play: $('playView'), quiz: $('quizView'), summary: $('summaryView') };

  function show(name, focusEl) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    S.view = name;
    window.scrollTo(0, 0);
    if (focusEl) focusEl.focus();
  }

  /* ─────────────────────────────────────────────────────────────
     棋盤：6 個洞，未解鎖的顯示「維修中」
     ───────────────────────────────────────────────────────────── */

  var board = $('board');

  var HOLE_HTML =
    '<span class="hole-pit" aria-hidden="true"></span>' +
    '<span class="mole-clip" aria-hidden="true"><span class="mole">' +
    '<span class="hp"><span class="hp-fill"></span></span>' +
    '<span class="coat-badge"></span>' +
    '<svg class="mole-art"><use href="#ch-swab"></use></svg>' +
    '</span></span>' +
    '<span class="hole-lip" aria-hidden="true"></span>';

  var LOCKED_HTML =
    '<span class="hole-pit" aria-hidden="true"></span>' +
    '<span class="hole-lip" aria-hidden="true"></span>' +
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

  function raise(h, char, variant) {
    var hp = E.maxHp(variant);
    h.mole = {
      char: char, variant: variant, hp: hp, maxHp: hp,
      downAt: S.clock + E.upMs(char, variant, S.round, S.stay),
      lastWipe: -Infinity
    };
    setArt(h.use, char);
    h.moleEl.className = 'mole v-' + variant;
    h.badge.textContent = variant === 'silver' ? '×1.5' : (variant === 'gold' || variant === 'iron' ? '×2' : '');
    h.el.classList.toggle('has-hp', hp > 1);
    h.hpFill.style.width = '100%';
    h.el.classList.remove('is-hit', 'is-nope', 'is-hurt');
    h.el.dataset.char = char;
    h.el.classList.add('is-up');
    h.el.setAttribute('aria-label', holeLabel(h));
  }

  function lower(h, hit) {
    if (!h.mole) return;
    h.mole = null;
    h.freeAt = S.clock + 220; /* 等縮回去的動畫結束，才讓下一隻從同一個洞出來 */
    h.el.classList.remove('is-up', 'is-hurt');
    if (hit) h.el.classList.add('is-hit');
    delete h.el.dataset.char;
    h.el.setAttribute('aria-label', holeLabel(h));
  }

  function spawn() {
    var free = S.holes.filter(function (h) { return h.open && !h.mole && S.clock >= h.freeAt; });
    if (!free.length) return;
    var h = free[Math.floor(Math.random() * free.length)];
    var char = E.pickCharacter(progress, Math.random);
    raise(h, char, E.pickVariant(progress.level[char], Math.random));
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
    var pts = E.pointsFor(m.char, m.variant);
    S.runScore += pts;
    S.roundScore += pts;
    progress.totalPoints += pts;
    progress.clicks[m.char] = (progress.clicks[m.char] || 0) + 1;
    popScore(h, pts, m.variant);
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* 忽略 */ } }
    lower(h, true);
    $('hudScore').textContent = fmt(S.runScore);
  }

  function damage(h, amount) {
    var m = h.mole;
    m.hp -= amount;
    if (m.hp > 0) {
      h.hpFill.style.width = Math.round(100 * m.hp / m.maxHp) + '%';
      retrigger(h.el, 'is-hurt');
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

  var hintTimer = null;
  function nope(h) {
    retrigger(h.el, 'is-nope');
    var hint = $('trayHint');
    hint.classList.add('is-flash');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(function () { hint.classList.remove('is-flash'); }, 900);
  }

  function tapHole(i) {
    if (!S.running) return;
    var h = S.holes[i];
    if (!h || !h.open || !h.mole) return;
    if (E.BY_ID[h.mole.char].wipe) {
      if (S.armed) wipe(h); else nope(h);
      return;
    }
    damage(h, S.hammer);
  }

  board.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest('.hole');
    if (!el || el.classList.contains('is-locked')) return;
    ev.preventDefault();
    tapHole(Number(el.dataset.i));
  });

  /* 只處理鍵盤觸發的 click（Enter／Space）；手指點擊已經在 pointerdown 處理過 */
  board.addEventListener('click', function (ev) {
    if (ev.detail !== 0) return;
    var el = ev.target.closest('.hole');
    if (!el || el.classList.contains('is-locked')) return;
    tapHole(Number(el.dataset.i));
  });

  /* ─────────────────────────────────────────────────────────────
     酒精棉片：拖到病毒上擦掉；或點一下拿起、再點病毒
     ───────────────────────────────────────────────────────────── */

  var swab = $('swabTool');
  var ghost = $('dragGhost');

  function setArmed(on) {
    S.armed = !!on;
    swab.setAttribute('aria-pressed', S.armed ? 'true' : 'false');
    swab.classList.toggle('is-armed', S.armed);
    board.classList.toggle('swab-armed', S.armed);
  }

  function placeGhost(x, y) {
    ghost.style.transform = 'translate(' + Math.round(x - 36) + 'px,' + Math.round(y - 44) + 'px)';
  }

  function wipeAt(x, y) {
    var el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    var holeEl = el && el.closest ? el.closest('.hole') : null;
    if (!holeEl || holeEl.classList.contains('is-locked')) return;
    var h = S.holes[Number(holeEl.dataset.i)];
    if (h && h.mole && E.BY_ID[h.mole.char].wipe) wipe(h);
  }

  function endDrag() {
    S.drag = null;
    ghost.hidden = true;
    document.body.classList.remove('is-dragging');
  }

  swab.addEventListener('pointerdown', function (ev) {
    if (!S.running) return;
    ev.preventDefault();
    try { swab.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
    S.drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, moved: false };
  });

  swab.addEventListener('pointermove', function (ev) {
    var d = S.drag;
    if (!d || ev.pointerId !== d.id) return;
    if (!d.moved) {
      /* 移動超過 8px 才算拖曳，避免手抖把「點一下」當成拖曳 */
      if (Math.abs(ev.clientX - d.x0) + Math.abs(ev.clientY - d.y0) < 8) return;
      d.moved = true;
      ghost.hidden = false;
      document.body.classList.add('is-dragging');
    }
    placeGhost(ev.clientX, ev.clientY);
    if (S.running) wipeAt(ev.clientX, ev.clientY);
  });

  function finishDrag(ev) {
    var d = S.drag;
    if (!d || ev.pointerId !== d.id) return;
    if (d.moved) {
      if (ev.type === 'pointerup' && S.running) wipeAt(ev.clientX, ev.clientY);
    } else if (ev.type === 'pointerup' && S.running) {
      setArmed(!S.armed);
    }
    endDrag();
  }

  swab.addEventListener('pointerup', finishDrag);
  swab.addEventListener('pointercancel', finishDrag);
  swab.addEventListener('click', function (ev) {
    if (ev.detail === 0 && S.running) setArmed(!S.armed);
  });

  /* ─────────────────────────────────────────────────────────────
     鍵盤：1–6 打對應的洞、S 拿起／放下棉片、Esc 暫停
     ───────────────────────────────────────────────────────────── */

  document.addEventListener('keydown', function (ev) {
    if (S.view !== 'play' || !S.running || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key >= '1' && ev.key <= '6') {
      ev.preventDefault();
      tapHole(Number(ev.key) - 1);
    } else if (ev.key === 's' || ev.key === 'S') {
      ev.preventDefault();
      setArmed(!S.armed);
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
      if (h.mole && S.clock >= h.mole.downAt) lower(h, false);
    });

    if (S.clock >= C.ROUND_MS) {
      endRound();
      return;
    }

    var tLeft = (C.ROUND_MS - S.clock) / 1000;
    if (S.clock >= S.nextSpawnAt) {
      spawn();
      S.nextSpawnAt = S.clock + E.spawnIntervalMs(tLeft, S.round);
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
    endDrag();
  }

  /* ─────────────────────────────────────────────────────────────
     回合
     ───────────────────────────────────────────────────────────── */

  function startRun() {
    S.round = 1;
    S.runScore = 0;
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
    buildBoard();
    setArmed(false);
    $('hudRound').textContent = roundLabel(S.round);
    $('hudScore').textContent = fmt(S.runScore);
    renderTime(C.ROUND_MS / 1000);
    show('play', $('pauseBtn'));
    Anxin.announce(live, roundLabel(S.round) + '開始');
    resume();
  }

  function endRound() {
    halt();
    S.holes.forEach(function (h) { lower(h, false); });
    setArmed(false);
    progress.bestScore = Math.max(progress.bestScore, S.runScore);
    progress.bestRound = Math.max(progress.bestRound, S.round);
    S.unlocked = E.newlyUnlocked(S.roundStartTotal, progress.totalPoints);

    /* 收藏達到門檻 → 回合結束後進入小知識區域（一次一題，不打斷太久） */
    var quiz = bank ? E.nextQuiz(progress, bank, band) : null;
    if (quiz) progress.pending = { character: quiz.character, qid: quiz.question.id };
    save();
    Anxin.announce(live, roundLabel(S.round) + '結束，這回合得到 ' + S.roundScore + ' 分');

    if (quiz) showQuiz(quiz);
    else showSummary();
  }

  /* ─────────────────────────────────────────────────────────────
     暫停
     ───────────────────────────────────────────────────────────── */

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
      var status = !next ? '已經滿級！'
        : (ready ? '可以挑戰小知識！' : '再收集 ' + (next - clicks) + ' 個就能挑戰');
      return '<li class="coll-item' + (ready ? ' is-ready' : '') + '">' +
        '<svg class="coll-art" aria-hidden="true"><use href="#ch-' + c.id + '"></use></svg>' +
        '<span class="coll-name">' + esc(c.name) + '</span>' +
        '<span class="coll-stars" role="img" aria-label="等級 ' + lv + ' / ' + C.MAX_LEVEL + '">' + stars + '</span>' +
        '<span class="coll-count">收集 ' + clicks + ' 個</span>' +
        '<span class="coll-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span>' +
        '<span class="coll-status">' + status + '</span>' +
        '</li>';
    }).join('');
  }

  /* ─────────────────────────────────────────────────────────────
     小知識區域
     答錯不公布答案：規格是下一回合結束再挑戰「同一題」
     ───────────────────────────────────────────────────────────── */

  var COAT_NOTE = [
    '',
    '之後會出現銀色的它：分數更高，但跑得更快！',
    '金色的它也會出現了：分數加倍，要眼明手快！',
    '鐵甲版本登場：停得比較久，但要敲好幾下才打得倒！'
  ];

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function showQuiz(quiz) {
    var q = quiz.question;
    S.quiz = { character: quiz.character, question: q, done: false };
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
    if (ok) {
      var lv = Math.min(C.MAX_LEVEL, (progress.level[charId] || 0) + 1);
      progress.level[charId] = lv;
      progress.pending = null;
      r.className = 'quiz-result is-right';
      r.innerHTML = '<strong>答對了！</strong><span>' + esc(q.explain) + '</span>' +
        '<span class="quiz-levelup">' + name + ' 升級到 Lv ' + lv + '！' + COAT_NOTE[lv] + '</span>';
    } else {
      r.className = 'quiz-result is-wrong';
      r.innerHTML = '<strong>差一點點！</strong>' +
        '<span>可以問問爸爸媽媽。下一回合結束後，還能再挑戰這一題。</span>';
    }
    save();
    r.hidden = false;
    $('quizSkip').hidden = true;
    $('quizNext').hidden = false;
    $('quizNext').focus();
    Anxin.announce(live, ok ? '答對了' : '差一點點，下一回合再挑戰');
  });

  $('hintBtn').addEventListener('click', function () {
    $('quizHint').hidden = false;
    $('hintBtn').hidden = true;
  });

  $('quizNext').addEventListener('click', showSummary);
  $('quizSkip').addEventListener('click', showSummary); /* 題目保留在 pending */

  /* ─────────────────────────────────────────────────────────────
     回合結算
     ───────────────────────────────────────────────────────────── */

  function unlockText(u) {
    if (u.track === 'holes') return '第 ' + u.value + ' 個洞修好了，可以打的洞變多了！';
    if (u.track === 'stay') return '大家會在洞外停留更久（×' + u.value + '）';
    return '槌子變強了：鐵甲角色一次扣 ' + u.value + ' 格';
  }

  function showSummary() {
    var r = S.round;
    $('summaryTitle').textContent = r < C.ROUNDS ? '第 ' + r + ' 回合完成！'
      : (r === C.ROUNDS ? '六個回合都完成了！' : '無限模式・第 ' + r + ' 回合完成！');
    $('roundScore').textContent = fmt(S.roundScore);
    $('runScore').textContent = fmt(S.runScore);
    $('infinityNote').hidden = r !== C.ROUNDS;

    var ul = $('unlockList');
    ul.innerHTML = S.unlocked.map(function (u) {
      return '<li><strong>解鎖：' + esc(u.label) + '</strong><span>' + esc(unlockText(u)) + '</span></li>';
    }).join('');
    ul.hidden = !S.unlocked.length;

    renderCollection($('summaryCollection'));
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
    setArmed(false);
    save();
    renderCollection($('collection'));
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
    setBank: function (b) { bank = b; }
  };
})();
