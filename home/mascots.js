/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 主頁面的小角色（裝飾，aria-hidden；點了會有反應，但不擋任何按鈕）
   人物畫法沿用遊戲的 /games/dash/art.js（DashArt.SPRITES），再換成主頁的沙米調色盤。
   - 小麻糬：正正地躲在「抽血大小問」那塊後面，從圓弧探出頭；兩隻 U 字型的手搭在弧上。
     點牠：往下縮一點、左右擺頭，再探出來。
   - 小抹茶：在地平線上散步（慢慢起步、慢慢停下、站一下、轉身）。
     點牠：停下來、開心地跳一下，頭上飄出一顆葉綠色的小愛心，再繼續散步。
   減少動態效果時：小抹茶站在中間不走；點了只換成開心的臉，不跳、不縮。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var art = window.DashArt;
  if (!art || !art.SPRITES) return;
  var S = art.SPRITES;
  var doc = document;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ── 主頁的顏色（沙米調色盤，見 shared/styles.css） ── */
  var C = {
    fg: '#3E3329', paper: '#FCFAF7', leaf: '#87AE73', leafDeep: '#476D33',
    leafSoft: '#E7EFE0', leafTile: '#D5E4CB', cocoaSoft: '#F2ECE5', cocoaTile: '#E2D8CC', blush: '#F0B9A8'
  };

  /* 遊戲的顏色 → 主頁的顏色（只換這裡畫出來的圖，遊戲本身不變） */
  function recolor(svg, map) {
    Object.keys(map).forEach(function (from) { svg = svg.split(from).join(map[from]); });
    return svg;
  }
  var MATCHA_COLORS = {
    '#4D7A55': C.leafDeep,   /* 外框、手 */
    '#CBD8CC': C.leafTile,   /* 身體 */
    '#1C1917': C.fg,         /* 眼睛、嘴巴 */
    '#F4B6C2': C.blush,      /* 腮紅 */
    '#FB7185': '#D9826F',    /* 開心時的舌頭 */
    '#fff"': C.paper + '"'   /* 白肚子 */
  };
  var MOCHI_COLORS = {
    '#4A3728': C.fg,         /* 外框、眼睛 */
    '#FAD5AE': C.cocoaTile,  /* 身體漸層 */
    '#FCE6CC': C.cocoaSoft,
    '#FFFDF8': C.paper,
    '#FCD34D': C.leaf,       /* 皇冠 */
    '#B45309': C.leafDeep,
    '#FBCFE8': C.leafSoft,   /* OK 繃 */
    '#DB7FA8': C.leaf,
    '#FDF2F8': C.paper,
    '#FBB4B4': C.blush,      /* 腮紅 */
    '#D5E3DA': C.leafTile    /* 腳 */
  };

  /* ═══ 小麻糬 ═══════════════════════════════════════════════════ */

  var quad = doc.querySelector('.quad');
  var tile = quad && quad.querySelector('.quad-item.is-tr');
  if (quad && tile) {
    /* 身體：放在按鈕後面（z-index −1），圓弧自己把下半身擋住 */
    var body = doc.createElement('span');
    body.className = 'peek-body';
    body.setAttribute('aria-hidden', 'true');
    body.innerHTML = '<svg viewBox="0 0 100 100" focusable="false">' +
      '<defs><clipPath id="peekCut"><rect width="100" height="84"/></clipPath></defs>' +
      '<g clip-path="url(#peekCut)">' + recolor(S.mochi(), MOCHI_COLORS) + '</g></svg>';
    quad.appendChild(body);

    /* 兩隻手：蓋在按鈕上面，各自貼在弧上（弧是斜的，所以一高一低） */
    var NS = 'http://www.w3.org/2000/svg';
    var hands = doc.createElementNS(NS, 'svg');
    hands.setAttribute('class', 'peek-hands');
    hands.setAttribute('aria-hidden', 'true');
    hands.setAttribute('focusable', 'false');
    var handEls = [0, 1].map(function () {
      var p = doc.createElementNS(NS, 'path');
      p.setAttribute('fill', C.paper);
      p.setAttribute('stroke', C.fg);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      hands.appendChild(p);
      return p;
    });
    quad.appendChild(hands);

    /* 右上那塊的外弧：半徑 r = 格子寬 − 10px，圓心在格子左邊 10px、上面 r 的地方（格子座標） */
    var THETA = 57;            /* 小麻糬在弧上的位置（度，0 = 正右、90 = 正上）；再高皇冠會碰到上面的代碼卡 */
    var HAND_SPREAD = 4;       /* 兩隻手離中心幾度（主人：手再靠近身體一點） */
    var lastW = 0;
    var bodyW = 0;
    var layout = function () {
      var q = quad.getBoundingClientRect();
      var t = tile.getBoundingClientRect();
      if (!q.width || q.width === lastW) return;
      lastW = q.width;
      var w = t.width, r = w - 10;
      var cx = t.left - q.left + 10, cy = t.top - q.top + r;
      var at = function (deg) {
        var a = deg * Math.PI / 180;
        return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
      };
      bodyW = Math.round(q.width * 0.17);
      var p = at(THETA);
      /* 下巴（圖的 68%）比弧高 2px：臉完整露出，脖子以下躲在弧後面 */
      body.style.width = bodyW + 'px';
      body.style.left = (p[0] - bodyW / 2).toFixed(1) + 'px';
      body.style.top = (p[1] - 2 - bodyW * 0.68).toFixed(1) + 'px';

      hands.setAttribute('viewBox', '0 0 ' + q.width.toFixed(1) + ' ' + q.height.toFixed(1));
      var hw = bodyW * 0.13, hr = hw / 2, hh = bodyW * 0.17;
      [THETA + HAND_SPREAD, THETA - HAND_SPREAD].forEach(function (deg, i) {
        var h = at(deg);
        var x0 = h[0] - hr, y0 = h[1] - bodyW * 0.05;
        handEls[i].setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) +
          'V' + (y0 + hh - hr).toFixed(1) + 'a' + hr.toFixed(1) + ' ' + hr.toFixed(1) + ' 0 0 0 ' + hw.toFixed(1) + ' 0' +
          'V' + y0.toFixed(1));
        handEls[i].setAttribute('stroke-width', (bodyW * 0.035).toFixed(2));
      });
    };
    layout();
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(quad);
    else window.addEventListener('resize', layout);

    /* 點小麻糬：往下縮、左右擺頭、再探出來（以下巴為軸） */
    var ducking = false;
    body.addEventListener('click', function () {
      if (ducking || typeof body.animate !== 'function') return;
      ducking = true;
      if (reduced) {
        setTimeout(function () { ducking = false; }, 300);
        return;
      }
      var a = body.animate([
        { transform: 'translateY(0) rotate(0)' },
        { transform: 'translateY(26%) scale(1.04, .94) rotate(0)', offset: .2, easing: 'ease-out' },
        { transform: 'translateY(26%) rotate(-11deg)', offset: .38 },
        { transform: 'translateY(26%) rotate(11deg)', offset: .56 },
        { transform: 'translateY(26%) rotate(-7deg)', offset: .72 },
        { transform: 'translateY(26%) rotate(0)', offset: .82, easing: 'cubic-bezier(.22, 1, .36, 1)' },
        { transform: 'translateY(0) rotate(0)' }
      ], { duration: 1400, easing: 'ease-in-out' });
      /* 手跟著縮短一點（像是抓緊邊邊） */
      handEls.forEach(function (h) {
        h.animate([
          { transform: 'scaleY(1)' }, { transform: 'scaleY(.72)', offset: .2 },
          { transform: 'scaleY(.72)', offset: .82 }, { transform: 'scaleY(1)' }
        ], { duration: 1400, easing: 'ease-in-out' });
      });
      a.onfinish = function () { ducking = false; };
    });
  }

  /* ═══ 小抹茶 ═══════════════════════════════════════════════════ */

  var strip = doc.getElementById('stroll');
  var walker = doc.getElementById('strollWalker');
  if (!strip || !walker) return;

  /* 跳的時候只動裡面這一層，外面那層負責左右位置和方向 */
  var inner = doc.createElement('span');
  inner.className = 'stroll-body';
  walker.appendChild(inner);

  /* 五張圖疊在一起，只顯示目前那一張 */
  var FRAMES = {
    stand: S.matcha(), w1: S.matchaWalk1(), w2: S.matchaWalk2(), w3: S.matchaWalk3(), happy: S.matchaJump()
  };
  var frameEls = {};
  Object.keys(FRAMES).forEach(function (k) {
    var f = doc.createElement('span');
    f.className = 'stroll-frame';
    f.innerHTML = recolor(FRAMES[k], MATCHA_COLORS);
    f.hidden = k !== 'stand';
    inner.appendChild(f);
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

  var x = room() * (reduced ? 0.5 : 0.2 + Math.random() * 0.6);
  var dir = 1;
  function place() {
    walker.style.transform = 'translateX(' + x.toFixed(1) + 'px) scaleX(' + dir + ')';
  }
  place();

  /* 慢慢起步、慢慢停下 */
  function ease(t) {
    return 0.5 - Math.cos(Math.PI * t) / 2;
  }

  var trip = null;
  var happyUntil = 0;
  var restUntil = performance.now() + 600 + Math.random() * 900;

  /* 點小抹茶：停下來、開心地跳一下、飄出一顆愛心 */
  walker.addEventListener('click', function () {
    var now = performance.now();
    if (now < happyUntil) return;
    trip = null;
    show('happy');
    happyUntil = now + 1100;
    restUntil = happyUntil + 500;
    if (reduced || typeof inner.animate !== 'function') return;
    inner.animate([
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(0) scale(1.08, .9)', offset: .12 },
      { transform: 'translateY(-22px) scale(.96, 1.05)', offset: .45, easing: 'ease-in' },
      { transform: 'translateY(0) scale(1.06, .93)', offset: .8 },
      { transform: 'translateY(0) scale(1, 1)' }
    ], { duration: 650, easing: 'ease-out' });
    heart();
  });

  function heart() {
    var hEl = doc.createElement('span');
    hEl.className = 'stroll-heart';
    hEl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" fill="' +
      C.leaf + '" stroke="' + C.leafDeep + '" stroke-width="2" stroke-linejoin="round"/></svg>';
    hEl.style.left = (x + walker.offsetWidth / 2 - 10).toFixed(1) + 'px';
    strip.appendChild(hEl);
    var a = hEl.animate([
      { transform: 'translateY(0) scale(.4)', opacity: 0 },
      { transform: 'translateY(-14px) scale(1)', opacity: 1, offset: .25 },
      { transform: 'translateY(-46px) scale(.9)', opacity: 0 }
    ], { duration: 1100, easing: 'ease-out' });
    a.onfinish = function () { hEl.remove(); };
  }

  if (reduced) {
    /* 不走路；點了換成開心的臉一下就好 */
    var calm = function (now) {
      if (shown === 'happy' && now >= happyUntil) show('stand');
      window.requestAnimationFrame(calm);
    };
    window.requestAnimationFrame(calm);
    return;
  }

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
    if (shown === 'happy' && now >= happyUntil) show('stand');
    if (!trip && now >= restUntil && now >= happyUntil) {
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
