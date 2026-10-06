/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 畫圓圈（單機）
   評分演算法在 circle.js（CircleScore），這裡只處理畫布、輪流與畫面。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var CS = window.CircleScore;
  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var live = $('liveRegion');

  var ATTEMPTS = 3;
  var PARENT_NAME = '爸爸媽媽';
  var STORE_KEY = 'anxin.circle.v1';

  var WARN = {
    short: '這樣太短了，要一筆畫一整個圓喔！',
    small: '畫大一點點，可以用整個畫布！',
    open: '要畫一整圈、回到起點才算喔！'
  };

  /* 無痕模式下 localStorage 可能丟例外：退回記憶體 */
  var storage = (function () {
    try { if (window.localStorage) return window.localStorage; } catch (e) { /* 忽略 */ }
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } };
  })();

  /* 最高紀錄跟著個人資料的暫時代碼走（換一位小朋友就重新開始） */
  function loadRecord() {
    try {
      var d = JSON.parse(storage.getItem(STORE_KEY) || 'null');
      if (d && d.v === 1 && d.code === p.code && typeof d.best === 'number') return d;
    } catch (e) { /* 忽略 */ }
    return { v: 1, code: p.code, best: 0, plays: 0 };
  }

  var record = loadRecord();

  function saveRecord() {
    try { storage.setItem(STORE_KEY, JSON.stringify(record)); } catch (e) { /* 忽略 */ }
  }

  /* ─────────────────────────────────────────────────────────────
     狀態：order 是輪流順序（自己玩 0,0,0；比賽 0,1,0,1,0,1）
     ───────────────────────────────────────────────────────────── */

  var S = {
    players: [],
    order: [],
    turn: 0,
    phase: 'ready',   /* ready → drawing → scored | invalid */
    points: [],
    pointerId: null,
    last: null
  };

  var views = { intro: $('introView'), draw: $('drawView'), results: $('resultsView') };

  function show(name, focusEl) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    window.scrollTo(0, 0);
    if (focusEl) focusEl.focus();
  }

  /* ─────────────────────────────────────────────────────────────
     畫布：以 CSS px 作畫，實際像素依裝置倍率放大，線條才清楚
     ───────────────────────────────────────────────────────────── */

  var pad = $('pad');
  var ctx = pad.getContext ? pad.getContext('2d') : null;
  var dpr = 1;

  function fitPad() {
    var w = pad.clientWidth;
    if (!w || !ctx) return;
    dpr = window.devicePixelRatio || 1;
    pad.width = Math.round(w * dpr);
    pad.height = Math.round(w * dpr);
    clearPad();
  }

  function clearPad() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pad.width, pad.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pen() {
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#C2410C';
  }

  function pos(ev) {
    var r = pad.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function addPoint(q) {
    var last = S.points[S.points.length - 1];
    if (last && Math.abs(q.x - last.x) + Math.abs(q.y - last.y) < 1.5) return;
    if (ctx && last) {
      pen();
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    S.points.push(q);
  }

  /* 疊上最完美的圓（虛線），讓小朋友看得出差在哪裡 */
  function drawIdeal(c) {
    if (!ctx) return;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#15803D';
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* 一次只跟一根手指；第二根手指會被忽略 */
  pad.addEventListener('pointerdown', function (ev) {
    if (S.phase !== 'ready' || S.pointerId !== null) return;
    ev.preventDefault();
    try { pad.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
    S.pointerId = ev.pointerId;
    S.phase = 'drawing';
    S.points = [];
    clearPad();
    $('padEmpty').hidden = true;
    addPoint(pos(ev));
  });

  pad.addEventListener('pointermove', function (ev) {
    if (S.phase !== 'drawing' || ev.pointerId !== S.pointerId) return;
    ev.preventDefault();
    /* 手指移動很快時，瀏覽器會把中間的點合併；取回來，線才不會變成折線 */
    var list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
    if (list && list.length) list.forEach(function (e) { addPoint(pos(e)); });
    else addPoint(pos(ev));
  });

  function finish(ev) {
    if (S.phase !== 'drawing' || ev.pointerId !== S.pointerId) return;
    S.pointerId = null;
    if (ev.type === 'pointercancel') {
      /* 被系統打斷（來電、手勢）：這筆不算，重新畫 */
      resetPad();
      return;
    }
    addPoint(pos(ev));
    grade();
  }

  pad.addEventListener('pointerup', finish);
  pad.addEventListener('pointercancel', finish);

  window.addEventListener('resize', function () {
    if (S.phase === 'ready' && !views.draw.hidden) fitPad();
  });

  /* ─────────────────────────────────────────────────────────────
     評分
     ───────────────────────────────────────────────────────────── */

  var STAR = '<svg class="dc-star" aria-hidden="true"><use href="#icon-star"></use></svg>';

  function current() { return S.players[S.order[S.turn]]; }

  function grade() {
    var r = CS.scoreStroke(S.points);
    if (!r.ok) {
      S.phase = 'invalid';
      var w = $('warnBox');
      w.textContent = WARN[r.reason] || WARN.open;
      w.hidden = false;
      $('retryBtn').hidden = false;
      $('retryBtn').focus();
      return; /* 不算次數 */
    }
    S.phase = 'scored';
    current().scores.push(r.score);
    renderHistory();
    drawIdeal(r.circle);

    $('scoreNum').textContent = r.score;
    var stars = '';
    for (var i = 0; i < 3; i++) stars += '<span class="dc-star-slot' + (i < r.rating.stars ? ' is-on' : '') + '">' + STAR + '</span>';
    $('scoreStars').innerHTML = stars;
    $('scoreStars').setAttribute('aria-label', r.rating.stars + ' 顆星');
    $('scoreStars').setAttribute('role', 'img');
    $('scoreText').textContent = r.rating.text;
    $('resultBox').hidden = false;

    var nb = $('nextBtn');
    var more = S.turn + 1 < S.order.length;
    if (!more) nb.textContent = '看結果';
    else if (S.players.length > 1) nb.textContent = '換' + S.players[S.order[S.turn + 1]].name + '畫';
    else nb.textContent = '下一次';
    nb.hidden = false;
    nb.focus();
    Anxin.announce(live, r.score + ' 分，' + r.rating.text);
  }

  /* 減少動態：教學動畫停在「圓剛畫完、手指還在」那一格，不動 */
  (function () {
    var demo = $('padDemo');
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function apply() {
      if (!demo || typeof demo.pauseAnimations !== 'function') return;
      if (mq && mq.matches) { demo.pauseAnimations(); demo.setCurrentTime(1.98); }
      else demo.unpauseAnimations();
    }
    apply();
    if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  })();

  function resetPad() {
    S.phase = 'ready';
    S.points = [];
    S.pointerId = null;
    clearPad();
    $('padEmpty').hidden = false;
    $('warnBox').hidden = true;
    $('retryBtn').hidden = true;
  }

  $('retryBtn').addEventListener('click', function () {
    resetPad();
    $('turnTitle').focus();
  });

  $('nextBtn').addEventListener('click', function () {
    S.turn++;
    if (S.turn >= S.order.length) showResults();
    else startTurn();
  });

  /* ─────────────────────────────────────────────────────────────
     輪流
     ───────────────────────────────────────────────────────────── */

  function startTurn() {
    var who = current();
    var n = who.scores.length + 1;
    var two = S.players.length > 1;
    $('turnTitle').textContent = (two ? who.name + '・' : '') + '第 ' + n + ' / ' + ATTEMPTS + ' 次';
    /* 比賽時換人：提醒把手機交出去（平常不顯示說明文字） */
    var switched = two && S.turn > 0 && S.order[S.turn - 1] !== S.order[S.turn];
    $('turnHint').textContent = switched ? '把手機交給' + who.name : '';
    $('turnHint').hidden = !switched;
    $('resultBox').hidden = true;
    $('nextBtn').hidden = true;
    resetPad();
    renderHistory();
    $('turnTitle').focus();
  }

  /* 前幾次的分數：每個人三格。畫完的寫分數；兩次以上時最高的那次加星星；現在要畫的那格框起來 */
  var STAR_S = '<svg class="hist-star" aria-hidden="true"><use href="#icon-star"></use></svg>';

  function renderHistory() {
    var two = S.players.length > 1, cur = current();
    $('history').innerHTML = S.players.map(function (pl) {
      var b = pl.scores.length > 1 ? best(pl) : null, marked = false, slots = '';
      for (var i = 0; i < ATTEMPTS; i++) {
        var sc = pl.scores[i], cls = 'hist-slot', inner, label;
        if (sc != null) {
          var top = sc === b && !marked;
          if (top) marked = true;
          cls += ' is-done' + (top ? ' is-best' : '');
          inner = (top ? STAR_S : '') + '<strong>' + sc + '</strong><span>分</span>';
          label = '第 ' + (i + 1) + ' 次 ' + sc + ' 分' + (top ? '，最高' : '');
        } else if (pl === cur && i === pl.scores.length && S.phase !== 'scored') {
          cls += ' is-now';
          inner = '這一次';
          label = '第 ' + (i + 1) + ' 次，正在畫';
        } else {
          inner = '—';
          label = '第 ' + (i + 1) + ' 次，還沒畫';
        }
        slots += '<li class="' + cls + '" aria-label="' + label + '">' + inner + '</li>';
      }
      return '<ol class="hist-row' + (two ? '' : ' is-solo') + '" aria-label="' + esc(pl.name) + '">' +
        (two ? '<li class="hist-name" aria-hidden="true">' + esc(pl.name) + '</li>' : '') + slots + '</ol>';
    }).join('');
  }

  function startGame() {
    var two = form2();
    S.players = [{ name: p.nickname, scores: [] }];
    if (two) S.players.push({ name: PARENT_NAME, scores: [] });
    S.order = [];
    for (var i = 0; i < ATTEMPTS; i++) {
      S.order.push(0);
      if (two) S.order.push(1);
    }
    S.turn = 0;
    show('draw');
    fitPad();
    startTurn();
  }

  function form2() {
    var r = document.querySelector('input[name="mode"]:checked');
    return !!r && r.value === '2';
  }

  $('startBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);

  /* ─────────────────────────────────────────────────────────────
     結果
     ───────────────────────────────────────────────────────────── */

  function best(pl) { return Math.max.apply(null, pl.scores); }

  function showResults() {
    var rows = S.players.map(function (pl) {
      var b = best(pl);
      var done = false;
      var list = pl.scores.map(function (s) {
        /* 標出最高分（同分只標第一次）：粗體 + 文字「最高」，不只靠顏色 */
        var top = !done && s === b;
        if (top) done = true;
        return '<li' + (top ? ' class="is-best"' : '') + '>' + s + (top ? '<span class="best-tag">最高</span>' : '') + '</li>';
      }).join('');
      return '<li class="dc-row"><span class="dc-name">' + esc(pl.name) + '</span>' +
        '<ol class="dc-tries" aria-label="三次的分數">' + list + '</ol>' +
        '<span class="dc-best-score"><strong>' + b + '</strong> 分</span></li>';
    }).join('');
    $('scoreBoard').innerHTML = rows;

    var w = $('winnerLine');
    if (S.players.length > 1) {
      var a = best(S.players[0]), c = best(S.players[1]);
      w.textContent = a === c ? '平手！兩個人都好厲害！'
        : (a > c ? S.players[0].name : S.players[1].name) + ' 贏了！';
    } else {
      w.textContent = '最圓的一次是 ' + best(S.players[0]) + ' 分！';
    }

    /* 紀錄只算小朋友自己的分數 */
    var mine = best(S.players[0]);
    var rec = $('recordLine');
    var isNew = mine > record.best;
    rec.hidden = !isNew && record.best === 0;
    rec.textContent = isNew
      ? (record.best ? '新紀錄！比之前的 ' + record.best + ' 分還要圓！' : '這是你的第一個紀錄：' + mine + ' 分！')
      : '目前最高紀錄是 ' + record.best + ' 分，再挑戰看看！';
    rec.classList.toggle('is-new', isNew);
    record.best = Math.max(record.best, mine);
    record.plays += 1;
    saveRecord();
    submitToBoard(mine);

    show('results', $('resultsTitle'));
    Anxin.announce(live, w.textContent);
  }

  /* ─────────────────────────────────────────────────────────────
     開始畫面
     ───────────────────────────────────────────────────────────── */

  if (record.best > 0) {
    $('bestLine').textContent = '最高紀錄 ' + record.best + ' 分';
    $('bestLine').hidden = false;
  }

  /* 測試用 */
  /* ─────────────────────────────────────────────────────────────
     每日排行榜：今天（台灣時間）前三名，只有分數。
     送出的是小朋友這一輪最好的一次（比賽模式也只送小朋友的）；每支手機每天只留最高分。
     連不上 Firebase：照樣顯示預設分數，寫一行說明，遊戲不受影響。
     ───────────────────────────────────────────────────────────── */

  var LB = { state: 'loading', top: [], mine: null };
  var MEDAL = ['第 1 名', '第 2 名', '第 3 名'];

  function firebase() {
    return Anxin.whenFirebase ? Anxin.whenFirebase(12000) : Promise.reject(new Error('no firebase'));
  }

  function renderBoard(el) {
    var rows = CS.board(LB.state === 'ok' ? LB.top : []);
    el.innerHTML = rows.map(function (r, i) {
      var tag = r.isDefault ? '<span class="lb-tag">預設</span>' : r.mine ? '<span class="lb-tag is-me">你</span>' : '';
      var label = MEDAL[i] + ' ' + r.score + ' 分' + (r.isDefault ? '（預設）' : r.mine ? '（你）' : '');
      return '<li class="lb-row rank-' + (i + 1) + (r.mine && !r.isDefault ? ' is-mine' : '') + (r.isDefault ? ' is-default' : '') +
        '" aria-label="' + label + '"><span class="lb-rank" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="lb-score"><strong>' + r.score + '</strong> 分</span>' + tag + '</li>';
    }).join('');
    return rows;
  }

  function renderBoards() {
    renderBoard($('lbIntro'));
    $('lbIntroNote').textContent = LB.state === 'off'
      ? '連不上排行榜，先顯示預設分數。'
      : '只顯示分數，不會公布名字。每天台灣時間 0 點重新開始。';
    var rows = renderBoard($('lbResults'));
    var me = $('lbMe');
    if (LB.state === 'sending') me.textContent = '分數送出中…';
    else if (LB.state === 'off') me.textContent = '連不上排行榜，這次的分數沒有送出。';
    else if (LB.mine != null) {
      var rank = -1;
      rows.forEach(function (r, i) { if (rank < 0 && r.mine && !r.isDefault) rank = i; });
      me.textContent = rank >= 0
        ? '你今天最好的 ' + LB.mine + ' 分，排第 ' + (rank + 1) + ' 名！'
        : '你今天最好的 ' + LB.mine + ' 分，再 ' + (rows[2].score - LB.mine + 1) + ' 分就能上榜！';
    } else me.textContent = '';
  }

  function loadBoard() {
    var day = CS.dayKey(Date.now());
    return firebase()
      .then(function (F) { return F.circle.today(day); })
      .then(function (r) { LB = { state: 'ok', top: r.top, mine: r.mine }; },
        function () { LB = { state: 'off', top: [], mine: null }; })
      .then(renderBoards);
  }

  function submitToBoard(score) {
    var day = CS.dayKey(Date.now());
    LB.state = 'sending';
    renderBoards();
    return firebase()
      .then(function (F) { return F.circle.submit(day, score); })
      .then(loadBoard, function () { LB = { state: 'off', top: [], mine: null }; renderBoards(); });
  }

  renderBoards();
  loadBoard();

  window.__dc = { state: S, record: function () { return record; }, board: function () { return LB; }, loadBoard: loadBoard };
})();
