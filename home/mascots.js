/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 主頁面的小角色（裝飾，aria-hidden）
   人物畫法沿用遊戲的 /games/dash/art.js（DashArt.SPRITES），角色長相和遊戲裡一模一樣。
   - 小抹茶：在主頁最下面的地平線上散步。走到一個隨機的位置（慢慢起步、慢慢停下），
     站一下，再轉身走去別的地方；走路的三格動作照「走了多遠」換，起步、停下時腳步也跟著慢。
   - 小麻糬：趴在「抽血大小問」那塊的圓弧上，只露出上半身，兩隻 U 字型的手搭在弧上。
   減少動態效果時：小抹茶站在中間不走。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var art = window.DashArt;
  if (!art || !art.SPRITES) return;
  var S = art.SPRITES;
  var doc = document;

  /* ── 小麻糬：趴在圓弧上 ──
     遊戲的站姿小麻糬，從 y = 68 以下裁掉（這條線就貼在圓弧上，看起來像身體在弧的後面），
     再畫兩隻 U 字型的手，從身體垂下來、搭在弧上（蓋在按鈕上面）。 */
  var MOCHI_INK = '#4A3728';
  var peek = doc.getElementById('peek');
  if (peek) {
    var hand = function (x) {
      /* 從裁切線上方一點點開始往下垂（不蓋到臉），掛在按鈕上 */
      return '<path d="M' + x + ' 66V77a6 6 0 0 0 12 0V66" fill="#FFFDF8" stroke="' + MOCHI_INK +
        '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    };
    peek.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="peekCut"><rect x="0" y="0" width="100" height="68"/></clipPath></defs>' +
      '<g clip-path="url(#peekCut)">' + S.mochi() + '</g>' +
      hand(30) + hand(58) +
      '</svg>';
  }

  /* ── 小抹茶：在地平線上散步 ── */
  var strip = doc.getElementById('stroll');
  var walker = doc.getElementById('strollWalker');
  if (!strip || !walker) return;

  /* 四張圖疊在一起，只顯示目前那一張（比每一格重畫 innerHTML 省） */
  var FRAMES = { stand: S.matcha(), w1: S.matchaWalk1(), w2: S.matchaWalk2(), w3: S.matchaWalk3() };
  var frameEls = {};
  Object.keys(FRAMES).forEach(function (k) {
    var f = doc.createElement('span');
    f.className = 'stroll-frame';
    f.innerHTML = FRAMES[k];
    f.hidden = k !== 'stand';
    walker.appendChild(f);
    frameEls[k] = f;
  });
  var shown = 'stand';
  function show(k) {
    if (k === shown) return;
    frameEls[shown].hidden = true;
    frameEls[k].hidden = false;
    shown = k;
  }

  var SPEED = 34;          /* px／秒（走路的平均速度） */
  var STEP = 7;            /* 每走 7px 換一格腳步 */
  var WALK = ['w1', 'w2', 'w3', 'w2'];

  function room() {
    return Math.max(0, strip.clientWidth - walker.offsetWidth);
  }

  var x = room() * (0.2 + Math.random() * 0.6);
  var dir = 1;
  function place() {
    walker.style.transform = 'translateX(' + x.toFixed(1) + 'px) scaleX(' + dir + ')';
  }
  place();

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    x = room() / 2;
    place();
    return;
  }

  /* 慢慢起步、慢慢停下 */
  function ease(t) {
    return 0.5 - Math.cos(Math.PI * t) / 2;
  }

  var trip = null;
  var restUntil = performance.now() + 600 + Math.random() * 900;

  function pickTrip(now) {
    var W = room();
    if (W < 40) return null;
    var to;
    var tries = 0;
    do {
      to = Math.random() * W;
      tries++;
    } while (Math.abs(to - x) < W * 0.25 && tries < 8);
    var dist = Math.abs(to - x);
    return { from: x, to: to, t0: now, dur: (dist / SPEED) * 1000 + 400, dist: dist };
  }

  function tick(now) {
    var W = room();
    if (!trip && now >= restUntil) {
      trip = pickTrip(now);
      if (trip) dir = trip.to >= trip.from ? 1 : -1;
      else restUntil = now + 1500;
    }
    if (trip) {
      var k = Math.min(1, (now - trip.t0) / trip.dur);
      var e = ease(k);
      x = trip.from + (trip.to - trip.from) * e;
      show(WALK[Math.floor((trip.dist * e) / STEP) % WALK.length]);
      if (k >= 1) {
        trip = null;
        show('stand');
        restUntil = now + 1200 + Math.random() * 2600;
      }
    }
    /* 畫面變窄（旋轉手機）時不要走出地平線 */
    if (x > W) x = W;
    place();
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);
})();
