/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 衝衝衝（單機）
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
    butter: { sky: ['#FFFCF3', '#F8EDCF'], ground: '#EDD9A3', seam: '#D6BF85' },
    sky: { sky: ['#F0F9FF', '#BAE6FD'], ground: '#7DD3FC', seam: '#56BBE6' },
    lavender: { sky: ['#F8F6FC', '#E6E0F5'], ground: '#C8BDE6', seam: '#AFA1D6' },
    pink: { sky: ['#FDF2F8', '#FBCFE8'], ground: '#F9A8D4', seam: '#E687BD' },
    dusk: { sky: ['#FFF1F2', '#FECDD3'], ground: '#FDA4AF', seam: '#EF8391' }
  };
  /* 無限挑戰：天空的顏色跟著玩法換，一進傳送門就知道換了 */
  var MODE_THEME = { cube: 'orange', rot: 'pink', ship: 'butter', ufo: 'sky', duo: 'lavender', boss: 'dusk' };

  var MODES = {
    cube: { hint: '點一下：跳　按住：一直跳', tap: '點這裡也可以跳', word: '跳' },
    rot: { hint: '畫面會轉來轉去：下坡變快、上坡變慢', tap: '點這裡也可以跳', word: '跳' },
    ship: { hint: '體溫計火箭：按住往上飛，放開往下', tap: '按住這裡往上飛', word: '飛' },
    ufo: { hint: '藥杯飛碟：點一下往上飛一下', tap: '點一下往上飛一下', word: '飛' },
    duo: { hint: '上下兩個一起跳！藍色虛線框是不一樣的地方', tap: '點這裡，兩個一起跳', word: '跳' },
    boss: { hint: '圈圈縮小就跳　水在頭上不用跳', tap: '點這裡也可以跳', word: '跳' }
  };

  /* 被水射到之後，下一次怎麼躲（只在撞到後出現一次，不是每一發都貼標籤） */
  var COACH = {
    high: '水在頭上就不用跳，待在地上',
    early: '跳太早了！等圈圈縮到最小再跳',
    late: '圈圈縮到最小的時候就跳！'
  };

  /* 無痕模式下 localStorage 可能丟例外：退回記憶體 */
  var storage = (function () {
    try { if (window.localStorage) return window.localStorage; } catch (e) { /* 忽略 */ }
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } };
  })();

  var rec = E.loadRecord(storage, profile.code);

  /* 選的角色（小膠囊／小麻糬／小抹茶）：只換圖，玩法完全一樣。跟著個人資料的代碼記住 */
  var CHAR_KEY = 'anxin.dash.char';
  var CH = (function () {
    try {
      var d = JSON.parse(storage.getItem(CHAR_KEY) || 'null');
      if (d && d.code === profile.code) return ART.char(d.id);
    } catch (e) { /* 壞掉的紀錄 → 預設角色 */ }
    return ART.CHARS[0];
  })();
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
     全螢幕：藏起網址列、分頁列，橫的手機畫面大很多。
     手機、平板（手指操作）開始一關時自動進全螢幕；HUD 右邊的按鈕可以切換（電腦也有）。
     瀏覽器規定要「剛點過」才能進全螢幕：關卡卡片、下一關、再玩一次、重新開始都是點擊，所以在 start() 裡要求。
     用按鈕離開全螢幕的，之後就不再自動進去。iPhone 的瀏覽器不支援網頁全螢幕：按鈕不出現，照原本的畫面玩
     ───────────────────────────────────────────────────────────── */

  var docEl = document.documentElement;
  var fsRequest = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
  var fsExit = document.exitFullscreen || document.webkitExitFullscreen;
  var fsOk = !!(fsRequest && fsExit && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  var touchMq = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  var fsDeclined = false;

  function fsOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  /* 進出全螢幕之後更新按鈕；被瀏覽器拒絕就照原本的畫面玩 */
  function settle(p) { if (p && p.then) p.then(syncFs, function () { syncFs(); }); }

  function enterFs() {
    if (!fsOk || fsOn()) return;
    try { settle(fsRequest.call(docEl, { navigationUI: 'hide' })); } catch (e) { /* 忽略 */ }
  }

  function autoFs() {
    if (touchMq && touchMq.matches && !fsDeclined) enterFs();
  }

  function syncFs() { if (fsOk) $('fsBtn').setAttribute('aria-pressed', fsOn() ? 'true' : 'false'); }

  if (fsOk) {
    $('fsBtn').hidden = false;
    $('fsBtn').parentNode.classList.add('has-fs');
    $('fsBtn').addEventListener('click', function (ev) {
      if (fsOn()) {
        fsDeclined = true;
        try { settle(fsExit.call(document)); } catch (e) { /* 忽略 */ }
      } else {
        fsDeclined = false;
        enterFs();
      }
      /* 用手指、滑鼠按的：焦點不要留在按鈕上（空白鍵要拿來跳） */
      if (ev.detail) ev.currentTarget.blur();
    });
    /* 有的瀏覽器 fullscreenchange 來得晚：視窗大小一變（進出全螢幕一定會變）也對一次 */
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    window.addEventListener('resize', syncFs);
    syncFs();
  }

  /* 遊戲時間（shared/playtime.js）：選關畫面 = home，每一關 = 1–6／inf */
  function track(level) {
    if (window.AnxinPlay) window.AnxinPlay.at('dash', level);
  }

  /* ─────────────────────────────────────────────────────────────
     選關卡：地圖
     出發台 → 第 1 關 → … → 第 6 關 → 無限挑戰，中間用金色的路連起來。
     過了前一關，下一關的方框才會打開（第一次看到的：路從前一格長過去，方框啪一下跳出來）。
     選的角色縮小站在方框上面；點方框，角色沿著路走過去，再開始那一關。
     寬的畫面（橫的手機、電腦）排成一排；窄的排成 S 形：1→2→3，往下 4←5←6，再往下無限挑戰。
     ───────────────────────────────────────────────────────────── */

  function starIcons(on, cls) {
    var s = '';
    for (var i = 0; i < 3; i++) {
      s += '<svg class="star' + (on && on[i] ? ' is-on' : '') + (cls ? ' ' + cls : '') +
        '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"></use></svg>';
    }
    return s;
  }

  /* 圖片的 data URL 算一次就記住（地圖上的角色每一幀都可能換圖） */
  var SRC = {};
  function src(name) { return SRC[name] || (SRC[name] = ART.source(name)); }

  /* body／ship／ufo 換成現在選的角色那一張；其他（醫生、星星）照原本的名字 */
  var CARD_ART = { 1: ['ship'], 2: ['body'], 3: ['ufo'], 4: ['body', 'body'], 5: ['body'], 6: ['doctorIcon'] };

  /* 關卡名稱、提示裡的「體溫計火箭」「藥杯飛碟」是小膠囊的載具；換成現在這個角色的 */
  function vehicles(text) {
    return text.replace('體溫計火箭', CH.shipName).replace('藥杯飛碟', CH.ufoName);
  }

  function pic(role) {
    return role === 'body' || role === 'dizzy' || role === 'ship' || role === 'ufo' ? CH[role] : role;
  }

  function artImgs(names) {
    return names.map(function (n) { return '<img src="' + src(pic(n)) + '" alt="">'; }).join('');
  }

  var INF = LV.LEVELS.length + 1;                 /* 地圖上第 7 格是無限挑戰（第 0 格是出發台） */
  var INF_THEME = { sky: ['#FFF7ED', '#FED7AA'], ground: '#FDBA74' };
  var MAP_KEY = 'anxin.dash.map';

  /* seen：打開、看過的最後一格（打開的動畫只放一次）；at：角色站在哪一格。跟著個人資料的代碼記住 */
  var MAP = (function () {
    try {
      var d = JSON.parse(storage.getItem(MAP_KEY) || 'null');
      if (d && d.code === profile.code) {
        return { seen: clamp(Math.floor(d.seen) || 1, 1, INF), at: clamp(Math.floor(d.at) || 0, 0, INF) };
      }
    } catch (e) { /* 壞掉的紀錄 → 從頭 */ }
    return { seen: 1, at: 0 };
  })();

  /* pos：每一格在地圖上的位置（px）；busy：角色在走、方框在打開，先不能點 */
  var M = { pos: [], T: 0, heroH: 0, busy: false, raf: 0, dir: 1 };

  function saveMap() {
    try { storage.setItem(MAP_KEY, JSON.stringify({ code: profile.code, seen: MAP.seen, at: MAP.at })); } catch (e) { /* 忽略 */ }
  }

  /* 打開到第幾格：第 1 關一定開；前一關過了，下一關才開；六關都過了，打開無限挑戰 */
  function frontier() {
    var n = 1;
    while (n <= LV.LEVELS.length && rec.levels[n] && rec.levels[n].done) n++;
    return n;
  }

  function tileSlots(on) {
    var s = '';
    for (var i = 0; i < 3; i++) {
      s += on && on[i]
        ? '<svg class="tile-star is-on" viewBox="0 0 24 24"><use href="#i-star"></use></svg>'
        : '<span class="tile-star"></span>';
    }
    return s;
  }

  function tileLabel(n) {
    if (n === INF) {
      var best = rec.inf.best;
      return '無限挑戰：五種玩法隨機出現，打贏醫生再來一輪。' + (best ? '最遠 ' + best + ' 公尺。' : '');
    }
    var L = LV.LEVELS[n - 1], r = rec.levels[n] || null;
    var got = r ? r.stars.filter(Boolean).length : 0;
    return '第 ' + n + ' 關 ' + vehicles(L.name) + '：' + vehicles(L.sub) + '。星星 ' + got + ' / 3。' +
      (r && !r.done && r.best > 0 ? '最遠 ' + Math.round(r.best * 100) + '%。' : '');
  }

  /* 方框：打開了的才畫（還沒過前一關的根本不出現）；還沒放過打開動畫的先藏著（is-pending） */
  function renderMap() {
    var F = frontier(), html = '';
    if (MAP.seen > F) MAP.seen = F;
    for (var n = 1; n <= F; n++) {
      var th = n === INF ? INF_THEME : THEME[LV.LEVELS[n - 1].theme], r = rec.levels[n];
      var calling = n === F && (n < INF || !rec.inf.best);
      html += '<li data-node="' + n + '"' + (n > MAP.seen ? ' class="is-pending"' : '') + '>' +
        '<button type="button" class="map-tile' + (calling ? ' is-next' : '') + '" data-level="' + (n === INF ? 'inf' : n) + '"' +
        ' aria-label="' + tileLabel(n) + '" style="--sky0:' + th.sky[0] + ';--sky1:' + th.sky[1] + ';--ground:' + th.ground + '">' +
        '<span class="tile-art">' + artImgs(n === INF ? ['star'] : CARD_ART[n]) + '</span>' +
        '<span class="tile-num" aria-hidden="true">' + (n === INF ? '∞' : n) + '</span>' +
        (n === INF ? '' : '<span class="tile-stars" aria-hidden="true">' + tileSlots(r && r.stars) + '</span>') +
        '</button></li>';
    }
    $('mapTiles').innerHTML = html;
    $('mapStart').innerHTML = '<img src="' + src('flagOn') + '" alt="">';
    $('charChangeImg').src = src(CH.body);
    layoutMap();
    caption();
  }

  /* 排版：一格方框 T px；路寬 0.28T；角色身高 0.5T（站在方框上面，上面要留位置） */
  function layoutMap() {
    var box = $('map'), W = box.clientWidth;
    if (!W) return;
    var F = frontier(), rowT = W / 9.52;
    var row = rowT >= 80 || (window.innerWidth > window.innerHeight && rowT >= 56);
    var T = Math.floor(Math.min(row ? rowT : W / 3.56, 128));
    var g = Math.round(T * 0.28), heroH = Math.round(T * 0.5), head = heroH + 10;
    var pw = Math.round(T * 0.56), ph = Math.round(T * 0.2);
    var pos = [], H, i;
    function node(x, y, w, h) {
      x = Math.round(x); y = Math.round(y);
      return { x: x, y: y, w: w, h: h, cx: Math.round(x + w / 2), cy: Math.round(y + h / 2), top: y };
    }
    if (row) {
      var x0 = (W - (pw + g + INF * T + (INF - 1) * g)) / 2;
      pos[0] = node(x0, head + (T - ph) / 2, pw, ph);
      for (i = 1; i <= INF; i++) pos[i] = node(x0 + pw + g + (i - 1) * (T + g), head, T, T);
      H = head + T + 12;
    } else {
      var c0 = (W - (3 * T + 2 * g)) / 2, rg = heroH + 14;
      var y1 = head + ph + rg, y2 = y1 + T + rg, y3 = y2 + T + rg;
      var cells = [null, [0, y1], [1, y1], [2, y1], [2, y2], [1, y2], [0, y2], [0, y3]];
      pos[0] = node(c0 + (T - pw) / 2, head, pw, ph);
      for (i = 1; i <= INF; i++) pos[i] = node(c0 + cells[i][0] * (T + g), cells[i][1], T, T);
      H = (F >= INF ? y3 : y2) + T + 12;
    }
    M.pos = pos; M.T = T; M.heroH = heroH;
    box.style.height = H + 'px';
    box.style.setProperty('--t', T + 'px');
    var st = $('mapStart').style;
    st.left = pos[0].x + 'px'; st.top = pos[0].y + 'px'; st.width = pw + 'px'; st.height = ph + 'px';
    Array.prototype.forEach.call($('mapTiles').children, function (li) {
      var p = pos[Number(li.getAttribute('data-node'))], ls = li.style;
      ls.left = p.x + 'px'; ls.top = p.y + 'px'; ls.width = p.w + 'px'; ls.height = p.h + 'px';
    });
    drawPaths(F);
    var hs = $('mapHero').style;
    hs.width = heroH + 'px'; hs.height = heroH + 'px';
    if (!M.raf && !$('mapHero').hidden) heroAt(MAP.at);
  }

  /* 路：相鄰兩格的中心連起來（排版上一定在同一排或同一欄）。還沒打開的那一段先藏著 */
  function drawPaths(F) {
    var w = Math.max(8, Math.round(M.T * 0.17)), s = '';
    for (var i = 1; i <= F; i++) {
      var a = M.pos[i - 1], b = M.pos[i], d = 'M' + a.cx + ' ' + a.cy + 'L' + b.cx + ' ' + b.cy;
      s += '<g class="seg' + (i > MAP.seen ? ' is-pending' : '') + '" data-seg="' + i + '">' +
        '<path class="seg-edge" d="' + d + '" pathLength="1" stroke-width="' + (w + 5) + '"/>' +
        '<path class="seg-fill" d="' + d + '" pathLength="1" stroke-width="' + w + '"/></g>';
    }
    $('mapPaths').innerHTML = s;
  }

  /* 地圖下面一行字：角色站的那一關叫什麼；還有幾關沒打開 */
  function caption() {
    var n = MAP.at, F = frontier(), html = '';
    if (n === INF && F === INF) {
      html = '<b>無限挑戰</b><span>' + (rec.inf.best ? '最遠 ' + rec.inf.best + ' 公尺' : '五種玩法隨機出現，打贏醫生再來一輪') + '</span>';
    } else if (n >= 1 && n <= F) {
      var L = LV.LEVELS[n - 1];
      html = '<b>第 ' + n + ' 關・' + vehicles(L.name) + '</b><span>' + vehicles(L.sub) + '</span>';
    }
    if (F <= LV.LEVELS.length) html += '<span>點方框開始；過了第 ' + F + ' 關，下一關就會打開</span>';
    $('mapCaption').innerHTML = html;
  }

  /* ── 地圖上的角色（縮小）：腳踩在 (x, y)；sx, sy 是落地壓扁；spin 是小膠囊滾動的角度 ──
     走路的角色往左走時整個翻過來；小膠囊不翻，滾的方向反過來 */
  function heroDraw(x, y, sprite, sx, sy, spin) {
    var s = M.heroH, flip = CH.walk ? M.dir : 1;
    $('mapHero').style.transform = 'translate(' + (x - s / 2) + 'px,' + (y - s * 0.97) + 'px)' +
      ' translate(' + (s / 2) + 'px,' + s + 'px) scale(' + flip * (sx || 1) + ',' + (sy || 1) + ')' +
      ' translate(' + (-s / 2) + 'px,' + (-s) + 'px)';
    var img = $('mapHeroImg'), u = src(sprite);
    if (img.getAttribute('src') !== u) img.setAttribute('src', u);
    img.style.transform = spin ? 'rotate(' + spin + 'rad)' : '';
  }

  /* 站好（一上一下輕輕呼吸） */
  function heroAt(n) {
    var p = M.pos[n];
    if (!p) return;
    $('mapHero').classList.add('is-idle');
    heroDraw(p.cx, p.top, CH.body);
  }

  /* 沿著路從第 a 格走到第 b 格（一格一格經過中間的方框）：同一排用走的（小膠囊用滾的），換排用跳的。
     最多 1.8 秒：走得遠就走快一點。減少動態時直接站過去 */
  function heroWalk(a, b, done) {
    function arrive() {
      M.raf = 0;
      MAP.at = b;
      saveMap();
      heroAt(b);
      caption();
      if (done) done();
    }
    if (a === b || reduce || !M.pos[a] || !M.pos[b]) { arrive(); return; }
    var pts = [], segs = [], total = 0, step = a < b ? 1 : -1, i;
    for (i = a; i !== b + step; i += step) pts.push([M.pos[i].cx, M.pos[i].top]);
    for (i = 1; i < pts.length; i++) {
      var L = Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2));
      segs.push(L);
      total += L;
    }
    var speed = Math.max(M.T * 3.4, total / 1.8), d = 0, last = now();
    $('mapHero').classList.remove('is-idle');
    function frame() {
      var t = now();
      d = Math.min(total, d + speed * Math.min(0.05, (t - last) / 1000));
      last = t;
      var k = 0, acc = 0;
      while (k < segs.length - 1 && acc + segs[k] < d) { acc += segs[k]; k++; }
      var u = segs[k] ? clamp((d - acc) / segs[k], 0, 1) : 1;
      var p0 = pts[k], p1 = pts[k + 1], dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      var y = p0[1] + dy * u, sprite = CH.body;
      if (Math.abs(dx) > 1) M.dir = dx < 0 ? -1 : 1;
      if (Math.abs(dy) > 2) {
        y -= M.T * 0.3 * 4 * u * (1 - u);
        sprite = CH.jump || CH.body;
      } else if (CH.walk) {
        sprite = CH.walk[Math.floor(d / (M.T * 0.16)) % CH.walk.length];
      }
      heroDraw(p0[0] + dx * u, y, sprite, 1, 1, CH.walk ? 0 : M.dir * d / (M.heroH * 0.42));
      if (d < total) M.raf = window.requestAnimationFrame(frame);
      else arrive();
    }
    M.raf = window.requestAnimationFrame(frame);
  }

  /* 從天上掉到出發台，落地壓扁一下 */
  function heroDrop(done) {
    try { $('map').scrollIntoView({ block: 'nearest' }); } catch (e) { /* 忽略 */ }
    var p = M.pos[0], y1 = p.top, y0 = -$('map').getBoundingClientRect().top - M.heroH, t0 = now();
    $('mapHero').classList.remove('is-idle');
    heroDraw(p.cx, y0, CH.jump || CH.body);
    function fall() {
      var k = Math.min(1, (now() - t0) / 500);
      heroDraw(p.cx, y0 + (y1 - y0) * k * k, CH.jump || CH.body);
      if (k < 1) { M.raf = window.requestAnimationFrame(fall); return; }
      var t1 = now();
      (function squash() {
        var q = Math.min(1, (now() - t1) / 200), a = Math.sin(q * Math.PI) * 0.2;
        heroDraw(p.cx, y1, CH.body, 1 + a, 1 - a);
        if (q < 1) { M.raf = window.requestAnimationFrame(squash); return; }
        M.raf = 0;
        MAP.at = 0;
        heroAt(0);
        caption();
        done();
      })();
    }
    M.raf = window.requestAnimationFrame(fall);
  }

  /* 打開還沒看過的方框，一格一格來：路從前一格長過去，方框啪一下跳出來 */
  function revealNext(done) {
    var F = frontier();
    if (MAP.seen >= F) { done(); return; }
    var n = MAP.seen + 1;
    MAP.seen = n;
    saveMap();
    var seg = $('mapPaths').querySelector('[data-seg="' + n + '"]');
    var li = $('mapTiles').querySelector('[data-node="' + n + '"]');
    say((n === INF ? '無限挑戰' : '第 ' + n + ' 關') + '打開了！');
    if (reduce) {
      if (seg) seg.classList.remove('is-pending');
      if (li) li.classList.remove('is-pending');
      revealNext(done);
      return;
    }
    if (li) { try { li.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 忽略 */ } }
    if (seg) {
      window.getComputedStyle(seg.firstChild).strokeDashoffset;   /* 先算好「藏著」的樣子，路才會慢慢長出來 */
      seg.classList.add('is-drawing');
      seg.classList.remove('is-pending');
    }
    window.setTimeout(function () {
      if (li) { li.classList.remove('is-pending'); li.classList.add('is-new'); }
      window.setTimeout(function () {
        if (li) li.classList.remove('is-new');
        if (seg) seg.classList.remove('is-drawing');
        revealNext(done);
      }, 520);
    }, 360);
  }

  function focusTile(n) {
    var b = $('mapTiles').querySelector('[data-node="' + n + '"] button');
    if (!b) return;
    try { b.scrollIntoView({ block: 'nearest' }); b.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
  }

  /* 點方框：角色先走過去，再開始那一關（先要全螢幕：剛點過才可以） */
  $('mapTiles').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-level]');
    if (!b || M.busy) return;
    autoFs();
    var v = b.getAttribute('data-level'), n = v === 'inf' ? INF : Number(v);
    M.busy = true;
    heroWalk(MAP.at, n, function () {
      M.busy = false;
      start(v === 'inf' ? 'inf' : n);
    });
  });

  if (window.ResizeObserver) new ResizeObserver(function () { if (!views.intro.hidden) layoutMap(); }).observe($('map'));
  window.addEventListener('resize', function () { if (!views.intro.hidden) layoutMap(); });

  /* 角色上地圖：從天上掉到出發台，打開還沒看過的方框，再沿著路走到最新打開的那一關 */
  function heroEnter() {
    var F = frontier();
    $('mapHero').hidden = false;
    layoutMap();
    M.busy = true;
    function ready() { M.busy = false; focusTile(MAP.at); }
    if (reduce) {
      MAP.seen = F;
      renderMap();
      heroWalk(MAP.at, F, ready);
      return;
    }
    heroDrop(function () {
      revealNext(function () { heroWalk(0, F, ready); });
    });
  }

  /* ─────────────────────────────────────────────────────────────
     選角色（一進來就先選；地圖上的「換角色」也會打開）
     選到的：開心地跳一下，再原地踏步（小麻糬、小抹茶換走路的圖）或轉圈（小膠囊）。
     按「出發！」（或 Esc）：其他角色不見、選到的往下掉出去；接著在地圖上從天上掉下來（heroEnter）
     ───────────────────────────────────────────────────────────── */

  var charDlg = Anxin.wireDialog($('charDlg'));
  var PK = { id: CH.id, hop: 0, step: 0, going: false };

  function renderChars() {
    $('charList').innerHTML = ART.CHARS.map(function (c) {
      return '<label class="char-option" data-char="' + c.id + '"><input type="radio" name="dashChar" value="' + c.id + '"' +
        (c.id === PK.id ? ' checked' : '') + '>' +
        '<span class="char-body"><span class="char-stage"><img src="' + src(c.body) + '" alt=""></span>' +
        '<span class="char-name">' + c.name + '</span>' +
        '<svg class="char-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12.5l3.3 3.3L17 9"/></svg></span></label>';
    }).join('');
  }

  /* 全部停下來、換回站著的樣子 */
  function quietChars() {
    window.clearTimeout(PK.hop);
    window.clearInterval(PK.step);
    Array.prototype.forEach.call($('charList').querySelectorAll('.char-option'), function (o) {
      var st = o.querySelector('.char-stage');
      st.classList.remove('is-hop', 'is-spin');
      st.querySelector('img').src = src(ART.char(o.getAttribute('data-char')).body);
    });
  }

  function cheer(id) {
    quietChars();
    if (reduce) return;
    var C0 = ART.char(id), opt = $('charList').querySelector('[data-char="' + id + '"]');
    if (!opt) return;
    var st = opt.querySelector('.char-stage'), img = st.querySelector('img');
    void st.offsetWidth;
    st.classList.add('is-hop');
    if (C0.jump) img.src = src(C0.jump);
    PK.hop = window.setTimeout(function () {
      st.classList.remove('is-hop');
      img.src = src(C0.body);
      if (C0.walk) {
        var k = 0;
        PK.step = window.setInterval(function () { img.src = src(C0.walk[k++ % C0.walk.length]); }, 150);
      } else {
        st.classList.add('is-spin');
      }
    }, 520);
  }

  function openChars() {
    PK.id = CH.id;
    PK.going = false;
    renderChars();
    $('mapHero').hidden = true;
    charDlg.open();
    var c = $('charList').querySelector('input:checked');
    try { if (c) c.focus(); } catch (e) { /* 忽略 */ }
    cheer(PK.id);
  }

  $('charList').addEventListener('change', function (ev) {
    if (!ev.target || ev.target.name !== 'dashChar' || PK.going) return;
    PK.id = ev.target.value;
    cheer(PK.id);
  });

  function charGo() {
    if (PK.going) return;
    PK.going = true;
    CH = ART.char(PK.id);
    try { storage.setItem(CHAR_KEY, JSON.stringify({ code: profile.code, id: CH.id })); } catch (e) { /* 忽略 */ }
    renderMap();
    var dlg = $('charDlg');
    quietChars();
    if (reduce) { dlg.close(); return; }
    var opt = $('charList').querySelector('[data-char="' + CH.id + '"]');
    opt.querySelector('.char-stage img').src = src(CH.jump || CH.body);
    opt.classList.add('is-chosen');
    dlg.classList.add('is-going');
    window.setTimeout(function () {
      dlg.classList.add('is-falling');
      window.setTimeout(function () { if (dlg.open) dlg.close(); }, 560);
    }, 300);
  }

  $('charGo').addEventListener('click', charGo);
  $('charDlg').addEventListener('cancel', function (ev) {
    ev.preventDefault();
    charGo();
  });
  $('charDlg').addEventListener('close', function () {
    $('charDlg').classList.remove('is-going', 'is-falling');
    quietChars();
    heroEnter();
  });
  $('charChange').addEventListener('click', function () { if (!M.busy) openChars(); });

  /* ─────────────────────────────────────────────────────────────
     一局
     phase: ready（等第一下）→ play → crash（撞到，0.7 秒）→ respawn（從旗子重來，閃 0.65 秒）→ play …
            → over（過關或無限挑戰結束）；paused 時記得原本的 phase
     ───────────────────────────────────────────────────────────── */

  var G = {
    run: null, level: null, seed: null, phase: 'idle', resume: null,
    input: { held: false, presses: 0 }, pointers: {}, nPointers: 0, keyHeld: false, suppress: false,
    seen: {}, parts: [], angle: 0, lastLane: null,
    squashAt: 0, squashKind: '', recoilAt: 0, crashUntil: 0, holdUntil: 0, doneAt: 0,
    saved: false, started: false, raf: 0, last: 0, hintTimer: 0, round: 1, dlgAction: null, hud: {},
    duck: 0, jumpBt: -9, coach: '', briefed: false, briefAt: 0, portraitOk: false
  };

  function title() {
    if (G.level === 'inf') return '無限挑戰・第 ' + G.round + ' 輪';
    var L = LV.LEVELS[G.level - 1];
    return '第 ' + L.id + ' 關・' + vehicles(L.name);
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
    autoFs();
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
    G.outro = null;
    G.seen = {};
    G.parts = [];
    G.angle = 0;
    G.lastLane = null;
    G.doneAt = 0;
    G.hud = {};
    G.roll = 0;
    G.rollX = 0;
    G.duck = 0;
    G.jumpBt = -9;
    G.coach = '';
    G.briefed = false;
    G.springs = new WeakMap();
    resetInput();

    $('hudTitle').textContent = title();
    $('readyName').textContent = title();
    $('readySub').textContent = modeHint(G.run.mode);
    $('stageCanvas').setAttribute('aria-label', '遊戲畫面：' + CH.name + '往右跑。按空白鍵或向上鍵跳，Esc 暫停');
    setMode(G.run.mode);
    $('readyBox').hidden = false;
    $('modeHint').hidden = true;
    $('bossBar').hidden = true;
    $('hudProgress').hidden = false;
    $('hudProgress').classList.toggle('is-endless', level === 'inf');
    show('play');
    track(level);
    fit(true);
    updateHud();
    if (!rotateCheck()) $('goBtn').focus({ preventScroll: true });
    startLoop();
  }

  /* ─────────────────────────────────────────────────────────────
     直式手機：開始前請小朋友把手機橫過來（畫面大很多、看得比較遠）。
     轉過來就自動收起來；螢幕方向被鎖住的手機轉不過來，所以一定留「直的也可以玩」。
     ───────────────────────────────────────────────────────────── */

  var portraitMq = window.matchMedia ? window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 600px)') : null;
  var SKIP_KEY = 'anxin.dash.portrait';

  function portraitOk() {
    try { return window.sessionStorage.getItem(SKIP_KEY) === '1'; } catch (e) { return !!G.portraitOk; }
  }

  /* 回傳：現在是否正在請小朋友轉手機 */
  function rotateCheck() {
    var ask = G.phase === 'ready' && !!(portraitMq && portraitMq.matches) && !portraitOk();
    var box = $('rotateAsk');
    if (box.hidden === !ask) return ask;
    box.hidden = !ask;
    if (ask) say('把手機橫過來玩，畫面會比較大');
    else if (G.phase === 'ready') {
      try { $('goBtn').focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
    }
    return ask;
  }

  if (portraitMq) {
    var onTurn = function () { if (G.run) rotateCheck(); };
    if (portraitMq.addEventListener) portraitMq.addEventListener('change', onTurn);
    else if (portraitMq.addListener) portraitMq.addListener(onTurn);
  }

  $('rotateSkip').addEventListener('click', function () {
    G.portraitOk = true;
    try { window.sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) { /* 忽略 */ }
    rotateCheck();
  });

  /* fromKey：用鍵盤開始的才把焦點移到畫面上（手指點的不要出現焦點框） */
  function begin(fromKey) {
    if (G.phase !== 'ready' || !$('rotateAsk').hidden) return;
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
    if (!$('rotateAsk').hidden) return;
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
    /* 「把手機橫過來」的提示上面：讓按鈕自己處理，不算開始 */
    if (ev.target.closest && ev.target.closest('#rotateAsk')) return;
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
    return ['pauseDlg', 'winDlg', 'overDlg', 'briefDlg'].some(function (id) { return $(id).hasAttribute('open'); });
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
  var briefDlg = Anxin.wireDialog($('briefDlg'));

  /* ── 醫生出現：先停下來，用三張會動的小圖說明怎麼玩（每一局第一次遇到醫生都說明，打贏過也一樣） ──
     小朋友正在一直點畫面，對話框剛跳出來的 0.7 秒內按「開始」不算，免得還沒看就關掉 */
  var BRIEF_LOCK_MS = 700;

  function needBrief() {
    return !G.briefed;
  }

  function openBrief() {
    G.briefed = true;
    G.phase = 'brief';
    G.briefAt = now();
    resetInput();
    briefDlg.open();
    briefDemos(reduce);   /* 對話框打開之後才放進去：藏起來的時候放進去的 SMIL 不會動 */
    say('醫生來玩水槍大戰！水在腳邊：圈圈縮到最小就跳。水在頭上：不用跳。點滴袋用完，你就贏了。');
  }

  function briefTooSoon() { return now() - G.briefAt < BRIEF_LOCK_MS; }

  /* 三張示範小圖（SMIL，一圈 2.4 秒，和遊戲裡畫的一樣：橘色圈圈、水柱、綠色的勾）。
     減少動態時停在最能說明的那一格：跳在水柱正上方／水從蹲著的頭上飛過／舉白旗 */
  var DEMO_S = 2.4;
  var DEMO_STILL = { briefJump: 1.5, briefStay: 1.45, briefWin: 2.3 };

  function demoSvg(body) {
    return '<svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">' +
      '<rect y="72" width="120" height="12" fill="#FDA4AF"/><path d="M0 72.5H120" stroke="#9F1239" stroke-opacity=".5" stroke-width="2"/>' +
      body + '</svg>';
  }

  function anim(attr, values, keyTimes, extra) {
    return '<animate attributeName="' + attr + '" values="' + values + '" keyTimes="' + keyTimes + '" dur="' + DEMO_S +
      's" repeatCount="indefinite"' + (extra || '') + '/>';
  }

  /* 水柱：從右邊飛進來、飛出左邊 */
  function demoWater(y) {
    return '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;-150 0;-150 0" keyTimes="0;.4;.78;1" dur="' +
      DEMO_S + 's" repeatCount="indefinite"/>' +
      '<rect x="120" y="' + y + '" width="26" height="11" rx="5.5" fill="#38BDF8" stroke="#075985" stroke-width="1.6"/>' +
      '<rect x="124" y="' + (y + 2) + '" width="10" height="2.4" rx="1.2" fill="#fff" opacity=".75"/></g>';
  }

  function demoCheck(x, y) {
    return '<g opacity="0">' + anim('opacity', '0;0;1;1;0', '0;.8;.82;.94;1') +
      '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#15803D" stroke="#fff" stroke-width="1.6"/>' +
      '<path d="M' + (x - 3.2) + ' ' + y + 'l2.4 2.6 4.2-4.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>';
  }

  function briefDemos(still) {
    var egg = ART.source(CH.body);
    /* 用走的角色：跳在空中那一段換成跳的樣子 */
    var hop = CH.jump
      ? '<image href="' + egg + '" x="18" y="48" width="24" height="24">' + anim('opacity', '1;0;1', '0;.5;.8', ' calcMode="discrete"') + '</image>' +
        '<image href="' + ART.source(CH.jump) + '" x="18" y="48" width="24" height="24" opacity="0">' +
        anim('opacity', '0;1;0', '0;.5;.8', ' calcMode="discrete"') + '</image>'
      : '<image href="' + egg + '" x="18" y="48" width="24" height="24"/>';
    var jump =
      /* 目標小圈（虛線）→ 大圈圈縮過來 → 縮到最小那一刻亮一下，跳！ */
      '<circle cx="30" cy="60" r="15" fill="none" stroke="#7C2D12" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="3 2.4">' +
      anim('opacity', '1;1;0;0', '0;.49;.5;1') + '</circle>' +
      '<circle cx="30" cy="60" r="18" fill="#FDE047" opacity="0">' + anim('opacity', '0;0;.6;0;0', '0;.49;.5;.62;1') + '</circle>' +
      '<circle cx="30" cy="60" r="34" fill="none" stroke="#C2410C" stroke-width="2.6">' +
      anim('r', '34;15;15', '0;.5;1') + anim('opacity', '0;1;1;0;0', '0;.08;.56;.6;1') + '</circle>' +
      demoWater(60) +
      '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -30;0 0;0 0" keyTimes="0;.5;.62;.8;1"' +
      ' calcMode="spline" keySplines="0 0 1 1;.2 .7 .4 1;.6 0 .8 .3;0 0 1 1" dur="' + DEMO_S + 's" repeatCount="indefinite"/>' +
      hop + '</g>' +
      /* 頭上的箭頭：縮到最小時變成實心 */
      '<path d="M30 28l6 6h-3.2v5h-5.6v-5H24Z" stroke="#C2410C" stroke-width="1.6" stroke-linejoin="round" fill="#FFEDD5">' +
      anim('fill', '#FFEDD5;#FFEDD5;#C2410C;#C2410C', '0;.49;.5;1') + anim('opacity', '0;1;1;0;0', '0;.08;.56;.6;1') + '</path>' +
      demoCheck(48, 40);
    var stay =
      demoWater(29) +
      /* 蹲低低：從底部壓扁一點點 */
      '<g transform="translate(30 72)"><g><animateTransform attributeName="transform" type="scale" values="1 1;1 1;1.14 .78;1.14 .78;1 1;1 1"' +
      ' keyTimes="0;.3;.36;.78;.85;1" dur="' + DEMO_S + 's" repeatCount="indefinite"/>' +
      '<image href="' + egg + '" x="-12" y="-24" width="24" height="24"/></g></g>' +
      demoCheck(48, 52);
    var win =
      /* 點滴架：袋子裡的水慢慢變少 */
      '<path d="M30 71V9M22 9h12M22 71l8-3 8 3" fill="none" stroke="#78716C" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="14" y="13" width="18" height="28" rx="4" fill="#fff"/>' +
      '<clipPath id="bagClip"><rect x="14" y="13" width="18" height="28" rx="4"/></clipPath>' +
      '<rect x="14" y="16" width="18" height="26" fill="#7DD3FC" clip-path="url(#bagClip)">' +
      anim('y', '16;16;41;41', '0;.08;.7;1') + '</rect>' +
      '<rect x="14" y="13" width="18" height="28" rx="4" fill="none" stroke="#57534E" stroke-width="1.6"/>' +
      '<path d="M23 41v6" stroke="#57534E" stroke-width="1.6"/>' +
      /* 醫生：袋子空了就笑咪咪舉白旗 */
      '<image href="' + ART.source('doctorIcon') + '" x="58" y="9" width="48.6" height="64"/>' +
      /* 白旗拿在左手上（圖上 DOC.flag 的位置） */
      '<g opacity="0">' + anim('opacity', '0;0;1;1', '0;.7;.7;1', ' calcMode="discrete"') +
      '<path d="M71 56V30" stroke="#78716C" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M71 30q-6 2-12 0v9q6 2 12 0Z" fill="#fff" stroke="#57534E" stroke-width="1.4" stroke-linejoin="round"/></g>';
    var parts = { briefJump: jump, briefStay: stay, briefWin: win };
    Object.keys(parts).forEach(function (id) {
      var host = $(id);
      host.innerHTML = demoSvg(parts[id]);
      var s = host.firstChild;
      if (!s || typeof s.pauseAnimations !== 'function') return;
      if (still) { s.pauseAnimations(); s.setCurrentTime(DEMO_STILL[id]); }
      else { s.setCurrentTime(0); s.unpauseAnimations(); }
    });
  }

  $('briefGo').addEventListener('click', function () {
    if (briefTooSoon()) return;
    $('briefDlg').close();
  });

  $('briefDlg').addEventListener('cancel', function (ev) {
    if (briefTooSoon()) ev.preventDefault();
  });

  $('briefDlg').addEventListener('close', function () {
    if (G.phase !== 'brief') return;
    G.phase = 'play';
    G.last = now();
    resetInput();
    hint('boss');
  });

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

  /* 回到地圖：角色站在剛剛玩的那一關；剛過關、打開了新的方框 → 先打開，再走過去 */
  function toLevels() {
    saveExit();
    stopLoop();
    G.phase = 'idle';
    if (G.level) MAP.at = G.level === 'inf' ? INF : G.level;
    saveMap();
    show('intro');
    track('home');
    $('mapHero').hidden = false;
    renderMap();
    var F = frontier();
    if (MAP.seen >= F) { focusTile(MAP.at); return; }
    M.busy = true;
    revealNext(function () {
      heroWalk(MAP.at, F, function () { M.busy = false; focusTile(MAP.at); });
    });
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

  /* 下一關：回到地圖，看新的方框打開、角色走過去，再點方框開始 */
  $('nextBtn').addEventListener('click', dlgAction($('winDlg'), toLevels));
  $('againBtn').addEventListener('click', dlgAction($('winDlg'), function () { start(G.level); }));
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
      if (G.phase === 'play' && run.boss && run.boss.state === 'fight' && needBrief()) openBrief();
    } else if (G.phase === 'crash' && t >= G.crashUntil) {
      afterCrash(t);
    } else if (G.phase === 'respawn' && t >= G.holdUntil) {
      G.phase = 'play';
      G.input.presses = 0;
    } else if (G.phase === 'outro') {
      stepOutro(dt);
    }
    /* 畫面轉到的角度就是引擎用來算上坡／下坡速度的角度（減少動態時直接轉到位） */
    var target = run.mode === 'rot' ? run.rot.angle : 0;
    G.angle = reduce ? target : run.rot.view;
    /* 滾著前進：轉多少 = 走多遠 ÷ 半徑 */
    var moved = run.x - G.rollX;
    if (moved > 0 && moved < 2) G.roll = (G.roll + moved / ROLL_R) % (Math.PI * 2);
    G.rollX = run.x;
    if (Math.abs(G.angle - target) < 0.01) G.angle = target;
    var dk = duckTarget(run);
    G.duck = reduce ? dk : G.duck + clamp(dk - G.duck, -dt * 8, dt * 8);
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
          if (run.boss) G.jumpBt = run.boss.bt;
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
          if (e.obj) G.springs.set(e.obj, t);
          if (!e.top) puff(run.x, run.p.y - 0.4, 6, '#FDE047');
          break;
        case 'star':
          puff(run.x + 0.2, run.p.y, 8, '#FACC15');
          say(G.level === 'inf' ? '拿到星星！' : '拿到星星！' + run.gotN + ' / 3');
          break;
        case 'mode':
          /* 每一局第一次遇到醫生會先跳說明對話框，說明的一行字等對話框關掉再出現 */
          if (e.mode === 'boss' && needBrief()) setMode('boss');
          else hint(e.mode);
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
          showHint('點滴袋空了，打敗醫生！');
          break;
        case 'crash':
          G.coach = e.why === 'water' ? coachFor(e) : '';
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
    showHint(modeHint(mode));
  }

  function modeHint(mode) {
    return vehicles((MODES[mode] || MODES.cube).hint);
  }

  function showHint(text, ms, spoken) {
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
    }, ms || 3200);
    say(spoken || text);
  }

  /* 被水射到：是哪一排、那時候在地上還是空中 → 下一次怎麼躲 */
  function coachFor(e) {
    if (e.lane === 'high') return COACH.high;
    var b = G.run.boss, jumped = b && b.bt - G.jumpBt < 0.75;
    return jumped && (e.grounded || e.vy <= 0) ? COACH.early : COACH.late;
  }

  function crashed(t) {
    var run = G.run;
    G.phase = 'crash';
    G.crashUntil = t + (run.world.endless ? 900 : 700);
    G.input.presses = 0;
    burst(run.x, run.p.y);
    if (run.world.endless) return;
    if (G.coach) showHint(G.coach, 4800, '撞到了，沒關係。' + G.coach);
    else say('撞到了，沒關係，從旗子那裡再來一次');
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

  /* 終點：到了那個 x 就收走控制權，鏡頭停住，小膠囊用原本的速度（等速）跑（或飛）出畫面右邊，
     整個出去了才跳「過關了」。減少動態時不跑出去，稍等一下直接跳出結果 */
  var OUTRO = { SPARE_S: 1 };

  function won(t) {
    var run = G.run;
    var got = [0, 1, 2].map(function (i) { return !!run.got[i]; });
    E.mergeLevel(rec, G.level, { done: true, stars: got, progress: 1, deaths: run.deaths });
    E.saveRecord(storage, rec);
    G.saved = true;
    resetInput();
    if (reduce) {
      G.phase = 'over';
      window.setTimeout(function () { openWin(got); }, 250);
      return;
    }
    var k = run.baseScale * run.speedMul;
    G.phase = 'outro';
    G.outro = { t0: t, dx: 0, v: C.SPEED * k, k: k, y: run.p.y, vy: run.p.vy, got: got, opened: false };
    /* 分頁被切走、畫面不更新時的保險：跑出畫面需要的時間＋1 秒 */
    var exitS = (V.w / V.T - PX + 1.5) / G.outro.v;
    G.outro.timer = window.setTimeout(function () { finishOutro(); }, (exitS + OUTRO.SPARE_S) * 1000);
  }

  function stepOutro(dt) {
    var o = G.outro, run = G.run;
    if (!o || o.opened) return;
    o.dx += o.v * dt;                                   /* 等速 */
    if (E.physMode(run.mode) === 'cube') {
      /* 跳到一半碰到終點：落回地上再繼續跑 */
      var fl = E.floorAt(run.world, run.x + o.dx) + C.HALF;
      if (o.y > fl || o.vy > 0) {
        o.vy = Math.max(o.vy - C.FALL_GRAVITY * o.k * o.k * dt, -C.MAX_FALL * o.k);
        o.y = Math.max(fl, o.y + o.vy * dt);
        if (o.y === fl) o.vy = 0;
      }
      G.roll = (G.roll + o.v * dt / ROLL_R) % (Math.PI * 2);
    } else {
      o.vy += (0 - o.vy) * Math.min(1, dt * 6);     /* 火箭、飛碟：拉平，平平地飛出去 */
      o.y += o.vy * dt;
    }
    if ((PX + o.dx - 1) * V.T > V.w) finishOutro();
  }

  function finishOutro() {
    var o = G.outro;
    if (!o || o.opened) return;
    o.opened = true;
    window.clearTimeout(o.timer);
    G.phase = 'over';
    openWin(o.got);
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
    if (last) line = '點滴袋空了，你打敗醫生了！' + line;
    $('winLine').textContent = line;
    /* 這一次打開了新的方框才說「打開」；重玩已經過的關卡就是回地圖 */
    $('nextBtn').textContent = MAP.seen >= frontier() ? '回到地圖' : last ? '打開無限挑戰' : '打開下一關';
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
      (better ? '這是新紀錄！' : '最遠紀錄是 ' + rec.inf.best + ' 公尺。') + (G.coach ? '下一次：' + G.coach : '');
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
      /* 點滴袋：每一次蓄力都會少一點；空了就打敗醫生 */
      var bag = Math.round(E.bossBag(b) * 100);
      if (G.hud.bag !== bag) {
        G.hud.bag = bag;
        $('bossFill').style.transform = 'scaleX(' + (bag / 100) + ')';
      }
      setText('bossLeft', '剩 ' + Math.max(0, b.tank) + ' 發');
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
      drawTrigger(g, camX, gY, t);
    }

    /* 障礙物、星星 */
    for (c = c0; c <= c1; c++) {
      var l = cols[c];
      if (!l) continue;
      for (var j = 0; j < l.length; j++) drawObj(l[j], camX, gY, tn, t);
    }

    drawPlayer(P, a, gY, t);
  }

  /* ── 彈簧墊：底座、彈簧、黃色蓋子（單位：格，從地板往上量）──
     平常彈簧壓得短短的；踩到的那一刻蓋子往上衝、彈簧拉長，再晃幾下縮回去。
     碰撞範圍不變（engine.js 的 C.PAD），這裡只是畫面。減少動態時不彈 */
  var SPRING = {
    baseW: 0.8, baseH: 0.1, capW: 0.84, capH: 0.2184,
    foot: 0.05, rest: 0.26, w: 0.46, turns: 3,
    reach: 0.85, riseMs: 80, decayMs: 160, waveMs: 190, endMs: 760
  };

  function springExt(o, t) {
    var t0 = G.springs && G.springs.get(o), S = SPRING;
    if (t0 === undefined || reduce) return 0;
    var k = t - t0;
    if (k < 0 || k > S.endMs) return 0;
    if (k < S.riseMs) {
      var u = 1 - k / S.riseMs;
      return S.reach * (1 - u * u);
    }
    k -= S.riseMs;
    /* 晃回去：往下最多只壓一點點（彈簧不會壓到比平常短很多） */
    return Math.max(-0.05, S.reach * Math.exp(-k / S.decayMs) * Math.cos(Math.PI * k / S.waveMs));
  }

  function drawSpring(o, sx, floorY, t) {
    var T = V.T, S = SPRING, cx = sx + 0.5 * T;
    var top = floorY - (S.rest + springExt(o, t)) * T;
    coil(cx, floorY - S.foot * T, top, S.w * T, S.turns);
    blit('padBase', cx - S.baseW / 2 * T, floorY - S.baseH * T, S.baseW, S.baseH);
    blit('padTop', cx - S.capW / 2 * T, top - (S.capH - 0.03) * T, S.capW, S.capH);
  }

  /* 彈簧：從側面稍微往下看的螺旋。後半圈（往上彎）細、顏色深，先畫；前半圈（往下彎）粗、有外框，後畫 */
  function coil(cx, yb, yt, w, turns) {
    var T = V.T, n = turns * 2, step = (yb - yt) / n, bulge = 0.05 * T, i, y0, y1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#78716C';
    ctx.lineWidth = Math.max(1.5, 0.045 * T);
    for (i = 1; i < n; i += 2) {
      y0 = yb - i * step; y1 = y0 - step;
      ctx.beginPath();
      ctx.moveTo(cx + w / 2, y0);
      ctx.quadraticCurveTo(cx, (y0 + y1) / 2 - bulge, cx - w / 2, y1);
      ctx.stroke();
    }
    [['#44403C', 0.085], ['#E7E5E4', 0.04]].forEach(function (pass) {
      ctx.strokeStyle = pass[0];
      ctx.lineWidth = Math.max(1, pass[1] * T);
      for (i = 0; i < n; i += 2) {
        y0 = yb - i * step; y1 = y0 - step;
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, y0);
        ctx.quadraticCurveTo(cx, (y0 + y1) / 2 + bulge, cx + w / 2, y1);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  /* 傳送門前的漏斗：地板往上斜、天花板往下斜，只有門口過得去 */
  function drawFunnels(camX, gY, c0, c1, th) {
    var T = V.T, F = C.FUNNEL, sky = 14;
    var X = function (wx) { return (wx - camX) * T; };
    var Y = function (wy) { return gY - wy * T; };
    G.run.world.funnels.forEach(function (f) {
      if (f.x1 < c0 - 1 || f.x0 > c1 + 1) return;
      /* 每個漏斗自己的門口高度（雙胞胎的門在畫面正中間） */
      var a = f.px - F.NECK, b = f.px + F.NECK, fl = f.floor, top = f.floor + f.gap;
      ctx.save();
      ctx.fillStyle = th.ground;
      ctx.beginPath();
      ctx.moveTo(X(f.x0), Y(-0.02)); ctx.lineTo(X(a), Y(fl)); ctx.lineTo(X(b), Y(fl)); ctx.lineTo(X(f.x1), Y(-0.02));
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
        if (fl - d <= 0) continue;
        ctx.moveTo(X(f.x0 + 0.6), Y(Math.max(0, d * 0.25 - 0.05)));
        ctx.lineTo(X(a), Y(fl - d)); ctx.lineTo(X(b), Y(fl - d));
        ctx.lineTo(X(f.x1 - 0.6), Y(Math.max(0, d * 0.25 - 0.05)));
        ctx.moveTo(X(f.x0 + 0.3), Y(f.cIn + d)); ctx.lineTo(X(a), Y(top + d)); ctx.lineTo(X(b), Y(top + d)); ctx.lineTo(X(f.x1 - 0.3), Y(f.cOut + d));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(124,45,18,.6)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(X(f.x0), Y(0)); ctx.lineTo(X(a), Y(fl)); ctx.lineTo(X(b), Y(fl)); ctx.lineTo(X(f.x1), Y(0));
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
    /* 衝出終點時鏡頭停住，速度線照樣往後飛 */
    var base = (camX + (G.outro && G.phase === 'outro' ? G.outro.dx : 0)) * par;
    var k = clamp((run.baseScale * run.speedMul * E.tiltScale(run) - 0.55) / 0.75, 0.3, 1);
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
    else if (o.k === 'pad') drawSpring(o, sx, sy + T, t);
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

  var PORTAL_ICON = { cube: 'body', rot: 'body', duo: 'body', ship: 'ship', ufo: 'ufo', boss: 'doctorIcon' };

  function drawTrigger(g, camX, gY, t) {
    var T = V.T, sx = (g.x - camX) * T, run = G.run;
    if (g.k === 'portal') {
      /* 小小的門，剛好卡在漏斗最窄的地方（雙胞胎的門在畫面正中間） */
      var fn = E.funnelAt(run.world, g.x), F = C.FUNNEL;
      var h = (fn ? fn.gap : F.GAP) + 0.2, yb = (fn ? fn.floor : F.FLOOR) - 0.1;
      blit('portal_' + g.mode, sx - 0.4 * T, gY - (yb + h) * T, 0.8, h);
      var icon = PORTAL_ICON[g.mode] || 'body';
      var iw = icon === 'doctorIcon' ? 0.53 : icon === 'body' ? 0.5 : 0.62;
      var ih = icon === 'doctorIcon' ? 0.7 : icon === 'body' ? 0.5 : 0.42;
      blit(pic(icon), sx - iw / 2 * T, gY - (yb + h / 2 + ih / 2) * T, iw, ih);
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
    }
    /* 終點（goal）什麼都不畫：到了那個 x，小膠囊就自己跑出畫面 */
  }

  /* 跑起來時，小膠囊後面拖三條短短的線 */
  function streaks(pm, t) {
    if (reduce || (G.phase !== 'play' && G.phase !== 'outro')) return;
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
    var dead = run.dead, dash = 0;
    if (G.outro && (G.phase === 'outro' || G.phase === 'over')) { y = G.outro.y; dash = G.outro.dx; }
    ctx.save();
    /* 從旗子重來：先停著閃，打醫生的關卡再加 0.5 秒邊跑邊閃（無敵） */
    if ((G.phase === 'respawn' || run.invuln > 0) && Math.floor(t / 220) % 2) ctx.globalAlpha = 0.35;
    ctx.translate((PX + dash) * T, gY - y * T);
    streaks(pm, t);
    if (pm === 'cube') {
      var tilt = P.grounded ? 0 : clamp(-P.vy / C.JUMP_V, -1, 1) * 14;
      /* 滾著前進（畫面插值到這一幀的位置）；撞到時轉正，看得到暈暈的臉；減少動態時只微微傾斜 */
      var xr = G.phase === 'play' ? run.prevX + (run.x - run.prevX) * a : run.x;
      /* 用走的角色（小麻糬、小抹茶）不轉，靠換腳和跳的姿勢 */
      var spin = dead || CH.walk ? 0 : reduce ? tilt * Math.PI / 180 : G.roll - (run.x - xr) / ROLL_R;
      /* 蹲下來的時候轉正（臉朝前），起來再接著滾 */
      if (G.duck > 0 && !dead) {
        var up = ((spin % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (up > Math.PI) up -= 2 * Math.PI;
        spin = up * (1 - G.duck);
      }
      var sxs = 1, sys = 1;
      if (!reduce && G.squashAt && !dead) {
        var k = (t - G.squashAt) / 130;
        if (k >= 0 && k < 1) {
          var amt = (1 - k) * 0.15;
          if (G.squashKind === 'land') { sxs = 1 + amt; sys = 1 - amt; } else { sxs = 1 - amt * 0.6; sys = 1 + amt; }
        }
      }
      /* 水在頭上：小膠囊蹲低低（只是畫面，碰撞範圍不變——本來就碰不到高的水） */
      if (G.duck > 0 && !dead) { sxs *= 1 + 0.14 * G.duck; sys *= 1 - 0.22 * G.duck; }
      ctx.translate(0, 0.45 * T);
      ctx.scale(sxs, sys);
      ctx.translate(0, -0.45 * T);
      ctx.rotate(spin);
      blit(dead ? CH.dizzy : CH.walk ? walkPose(P, xr + dash) : CH.body, -0.5 * T, -0.52 * T, 1, 1);
    } else if (pm === 'ship') {
      ctx.rotate(clamp(-P.vy / C.SHIP_VMAX, -1, 1) * 20 * Math.PI / 180);
      blit(CH.ship, -0.72 * T, -0.55 * T, 1.44, 0.9);
    } else {
      ctx.rotate(clamp(-P.vy / C.UFO_VMAX, -1, 1) * 8 * Math.PI / 180);
      blit(CH.ufo, -0.66 * T, -0.52 * T, 1.32, 0.94);
    }
    ctx.restore();
  }

  /* 走路的角色：在空中是跳的樣子；在地上照走過的距離換腳（每 WALK_STEP 格換一張，跑得快換得快、腳不會在地上滑）。
     停著的時候（準備、從旗子重來）站好；減少動態時不換腳，只分站著和跳 */
  var WALK_STEP = 0.4;

  function walkPose(P, dist) {
    var o = G.outro && (G.phase === 'outro' || G.phase === 'over') ? G.outro : null;
    if (o ? o.vy !== 0 : !P.grounded) return CH.jump;
    if (reduce || (G.phase !== 'play' && G.phase !== 'outro')) return CH.body;
    var n = CH.walk.length;
    return CH.walk[((Math.floor(dist / WALK_STEP) % n) + n) % n];
  }

  /* ── 大魔王：醫生（lowerAttack／stopAttack／upperAttack.svg）、旁邊的點滴架、雷射瞄準、水柱 ──
     蓄力時照那一排水換圖（低 → lower、高 → upper），其他時候 stop（手上沒有針筒）。
     每一發先「蓄能」：點滴袋的水經過管子流進針筒，針筒裡的水從底下慢慢漲滿（點滴袋跟著變少），
     同時雷射筆的紅光貼著地面指到小膠囊身上；滿了就射出去。點滴袋空了 = 打敗醫生。
     大小：upperAttack 的針（往上射的那一條線）剛好在高的水柱的高度——圖上 1 格 = DOC_MM 公釐，
     三張圖用同一個比例，所以一樣大；針尖放在引擎射出水柱的地方（醫生左邊 B.TIP 格）。 */
  var DOC = ART.DOCTOR, DOC_ART = DOC.art;
  var DOC_MM = (DOC.frame.floor - DOC_ART.upper.needle[1]) / E.laneMid('high');
  var DOC_TIP = DOC_ART.upper.needle[0] + DOC_ART.upper.dx;        /* 針尖在框裡的 x */
  var DOC_HEAD = 38;                                              /* 額鏡（頭的中間）在框裡的 x */
  var DOC_CLIP = {};                                              /* 針筒裡面的形狀（Path2D），用到才做 */

  /* 這一排水：針在離地幾格（雷射從這裡出發） */
  function needleH(lane) {
    return (DOC.frame.floor - DOC_ART[lane === 'low' ? 'lower' : 'upper'].needle[1]) / DOC_MM;
  }

  function laneY(lane) { return E.laneMid(lane); }

  function drawBoss(camX, gY, b, t) {
    var T = V.T, w = G.run.world;
    var off = 0;
    if (b.bt < 1.2) off = Math.pow(1 - b.bt / 1.2, 2) * 7 * T;
    if (b.state === 'done' && G.doneAt) off = Math.max(0, (t - G.doneAt - 1000) / 1000) * 9 * T;   /* 舉旗 1 秒，再離開 */
    var docX = (PX + B.DX) * T + off;
    var dY = gY - E.floorAt(w, camX + PX + B.DX + off / T) * T;   /* 醫生站在山丘上 */
    var done = b.state === 'done';
    var tells = E.bossTells(b);
    var charge = tells.length ? tells[0].frac : 0;

    var tipX = docX - B.TIP * T;
    for (var i = tells.length - 1; i >= 0; i--) {
      laneBand(tells[i], gY, tipX, t, i === 0);
      laser(tells[i], camX, gY, tipX, dY);
    }

    var pose = done ? 'stop' : docPose(tells, t);
    /* 射出去的那一下往後退一點點 */
    var rk = G.recoilAt ? (t - G.recoilAt) / 160 : 1;
    var recoil = !reduce && !done && rk >= 0 && rk < 1 ? (1 - rk) * 0.2 * T : 0;
    var u = T / DOC_MM;                                            /* 圖上 1 公釐 = u px */
    var ox = tipX - DOC_TIP * u + recoil, oy = dY - DOC.frame.floor * u;   /* 框的左上角 */
    /* 點滴架在醫生右邊；管子從點滴袋繞到醫生背後（右肩），接到手上的針筒 */
    var bag = ivStand(ox + 60 * u, dY, E.bossBag(b), t);
    if (!done) tube(bag, ox + 50 * u, oy + 22 * u, charge > 0, t);
    blit('doctor' + pose.charAt(0).toUpperCase() + pose.slice(1), ox, oy, DOC.frame.w / DOC_MM, DOC.frame.h / DOC_MM);
    if (!done && pose !== 'stop') {
      /* 剛射完：水一口氣倒光 */
      var drain = !tells.length && G.recoilAt ? 1 - (t - G.recoilAt) / DRAIN_MS : 0;
      chargeFill(pose, ox, oy, u, tells.length ? charge : reduce ? 0 : drain, t);
    }
    if (done) whiteFlag(ox + DOC.flag[0] * u, oy + DOC.flag[1] * u, t);

    for (i = 0; i < b.shots.length; i++) water(b.shots[i], camX, gY);

    var headX = ox + DOC_HEAD * u;
    if (b.bt < B.INTRO_S && !done) bubble(headX, oy - 0.1 * T, '來玩水槍大戰！');
    else if (done) bubble(headX, oy - 0.1 * T, '點滴用完了，你贏了！');
    else if (tells.length) exclaim(headX - 0.75 * T, oy + 0.05 * T);

    var P = G.run.p;
    if (!G.run.dead && G.phase !== 'respawn') jumpRing(E.bossCue(b), P, gY, t);
  }

  /* 醫生的姿勢：蓄力時照那一排水換圖，剛射完再停 0.3 秒，其他時候 stop */
  function docPose(tells, t) {
    var lane = tells.length ? tells[0].lane : G.recoilAt && t - G.recoilAt < 300 ? G.lastLane : null;
    return lane === 'low' ? 'lower' : lane === 'high' ? 'upper' : 'stop';
  }

  /* 蓄能：針筒裡的水（子彈）從底下慢慢漲滿。水面有小波浪、水裡有小泡泡往上冒，快滿的時候一閃一閃；
     射出去之後 DRAIN_MS 內水一口氣倒光。畫在針筒裡面（art.js 的 barrel 當 clip），線條不會被蓋到。
     減少動態時：水位照樣漲（這是「還有多久」的資訊），沒有波浪、泡泡、閃爍 */
  var DRAIN_MS = 220;

  function chargeFill(pose, ox, oy, u, fill, t) {
    var A = DOC_ART[pose], R = A.barrel, f = clamp(fill, 0, 1);
    if (!R || f <= 0 || typeof Path2D === 'undefined') return;
    var clip = DOC_CLIP[pose] || (DOC_CLIP[pose] = new Path2D(R.d));
    var level = R.y1 - (R.y1 - R.y0) * f;
    var amp = reduce ? 0 : 0.35 * Math.sin(Math.PI * f), ph = t / 170;
    function surface(x) { return level + amp * Math.sin(x * 1.25 + ph); }
    ctx.save();
    /* 從這裡開始用圖上的公釐（各自檔案的 viewBox）畫 */
    ctx.translate(ox + A.dx * u, oy);
    ctx.scale(u, u);
    ctx.clip(clip);
    var g = ctx.createLinearGradient(0, R.y0, 0, R.y1);
    g.addColorStop(0, DOC.water);
    g.addColorStop(1, DOC.deep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(R.x0 - 1, R.y1 + 1);
    for (var x = R.x0 - 1; x <= R.x1 + 1; x += 0.5) ctx.lineTo(x, surface(x));
    ctx.lineTo(R.x1 + 1, R.y1 + 1);
    ctx.closePath();
    ctx.fill();
    /* 水面一條細細的白光 */
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (x = R.x0 - 1; x <= R.x1 + 1; x += 0.5) x === R.x0 - 1 ? ctx.moveTo(x, surface(x) + 0.3) : ctx.lineTo(x, surface(x) + 0.3);
    ctx.stroke();
    if (!reduce) {
      /* 小泡泡：從底下冒到水面就不見 */
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 0.18;
      for (var i = 0; i < 6; i++) {
        var k = (t / 1300 + hash(i + 3)) % 1;
        var bx = R.x0 + 2 + (R.x1 - R.x0 - 4) * hash(i + 11) + Math.sin(t / 300 + i) * 0.3;
        var by = R.y1 - 0.4 - (R.y1 - level) * k;
        if (by < surface(bx) + 0.5) continue;
        ctx.beginPath(); ctx.arc(bx, by, 0.28 + 0.18 * hash(i + 5), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      /* 快滿了：整管一閃一閃（要射了） */
      if (f > 0.85) {
        ctx.fillStyle = 'rgba(255,255,255,' + ((f - 0.85) / 0.15 * (0.18 + 0.18 * Math.sin(t / 55))).toFixed(3) + ')';
        ctx.fillRect(R.x0 - 1, R.y0 - 1, R.x1 - R.x0 + 2, R.y1 - R.y0 + 2);
      }
    }
    ctx.restore();
  }

  /* 現在最先會碰到的是哪一排水：還在飛、沒過小膠囊的 → 正在蓄力的 */
  function nextLane(run) {
    var b = run.boss, best = null;
    if (!b || b.state !== 'fight') return null;
    for (var i = 0; i < b.shots.length; i++) {
      var s = b.shots[i];
      if (!s.passed && (!best || s.x < best.x)) best = s;
    }
    if (best) return best.lane;
    var tl = E.bossTells(b);
    return tl.length ? tl[0].lane : null;
  }

  function duckTarget(run) {
    return run.boss && !run.dead && run.p.grounded && E.physMode(run.mode) === 'cube' && nextLane(run) === 'high' ? 1 : 0;
  }

  /* 水會經過的那一條：淡淡的紅色帶子＋上下兩條往小膠囊跑的虛線（水從右邊來）。
     低的帶子蓋在小膠囊身上、高的帶子在頭上——看得出「會不會射到我」，不只靠雷射那一條細線 */
  function laneBand(tl, gY, tipX, t, first) {
    var T = V.T, l = tl.lane === 'low' ? B.LOW : B.HIGH;
    var a = (first ? 1 : 0.45) * (0.3 + 0.7 * tl.frac);
    var y0 = gY - l[1] * T, y1 = gY - l[0] * T, x0 = -0.5 * T;
    ctx.save();
    ctx.fillStyle = 'rgba(239,68,68,' + (0.15 * a).toFixed(3) + ')';
    ctx.fillRect(x0, y0, tipX - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(185,28,28,' + (0.75 * a).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.5, 0.05 * T);
    ctx.setLineDash([0.3 * T, 0.22 * T]);
    ctx.lineDashOffset = reduce ? 0 : (t / 1000) * 2.2 * T;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(tipX, y0);
    ctx.moveTo(x0, y1); ctx.lineTo(tipX, y1);
    ctx.stroke();
    ctx.restore();
  }

  /* 什麼時候跳：一個大圈圈往小膠囊縮，縮到和虛線小圈一樣大 = 現在跳！頭上一個往上的箭頭。
     只給低的水柱；高的水柱沒有圈圈（不用跳），小膠囊自己蹲低低 */
  function jumpRing(cue, P, gY, t) {
    if (!cue || E.physMode(G.run.mode) !== 'cube') return;
    var T = V.T, cx = PX * T, cy = gY - P.y * T;
    var r0 = 0.72 * T, r = r0 + (2.4 * T - r0) * (1 - cue.k);
    var fade = clamp(cue.k / 0.12, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    if (cue.now) {
      var g = ctx.createRadialGradient(cx, cy, r0 * 0.4, cx, cy, r0 * 1.5);
      g.addColorStop(0, 'rgba(253,224,71,.55)');
      g.addColorStop(1, 'rgba(253,224,71,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r0 * 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      /* 目標：虛線小圈 */
      ctx.setLineDash([0.16 * T, 0.12 * T]);
      ctx.strokeStyle = 'rgba(124,45,18,.55)';
      ctx.lineWidth = Math.max(1.5, 0.045 * T);
      ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    /* 縮小中的圈圈：白邊＋深橘色 */
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = Math.max(4, (cue.now ? 0.2 : 0.15) * T);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#C2410C';
    ctx.lineWidth = Math.max(2.5, (cue.now ? 0.12 : 0.085) * T);
    ctx.stroke();
    /* 往上的箭頭：縮到最小時變大、跳一下 */
    var lift = cue.now && !reduce ? 0.18 * T : 0;
    upArrow(cx, cy - r0 - 0.28 * T - lift, (cue.now ? 0.36 : 0.27) * T, cue.now);
    ctx.restore();
  }

  function upArrow(cx, tipY, s, solid) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx + s, tipY + s);
    ctx.lineTo(cx + s * 0.42, tipY + s);
    ctx.lineTo(cx + s * 0.42, tipY + s * 1.7);
    ctx.lineTo(cx - s * 0.42, tipY + s * 1.7);
    ctx.lineTo(cx - s * 0.42, tipY + s);
    ctx.lineTo(cx - s, tipY + s);
    ctx.closePath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(4, 0.16 * V.T);
    ctx.stroke();
    ctx.fillStyle = solid ? '#C2410C' : '#FFEDD5';
    ctx.fill();
    ctx.strokeStyle = '#C2410C';
    ctx.lineWidth = Math.max(2, 0.06 * V.T);
    ctx.stroke();
    ctx.restore();
  }

  /* 雷射筆：細細一條亮線，兩旁的紅光越往外越淡；貼著地面、離地固定高度，終點是小膠囊身上的紅點。
     每一發不貼文字標籤：紅點在腳邊還是頭上、紅色帶子、縮小的圈圈、蹲下來的小膠囊一起說明（不只靠顏色） */
  function laser(tl, camX, gY, tipX, dY) {
    var T = V.T, w = G.run.world, mid = laneY(tl.lane);
    var a = 0.35 + 0.65 * tl.frac;            /* 蓄力越滿越亮 */
    var startY = dY - needleH(tl.lane) * T, pts = [];     /* 從針尖出發，第一格內接到這一排水的高度 */
    var relTip = (tipX / T) - PX;
    for (var r = relTip; r > -PX - 2; r -= 0.25) {
      var y = gY - (E.floorAt(w, camX + PX + r) + mid) * T;
      var k = clamp((relTip - r) / 1.2, 0, 1);   /* 離開針筒尖端的第一格：從針筒的高度接到地面的高度 */
      pts.push([(PX + r) * T, startY + (y - startY) * k]);
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    function path() {
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
    }
    [[0.5, 0.06], [0.3, 0.11], [0.16, 0.2]].forEach(function (g) {
      ctx.strokeStyle = 'rgba(239,68,68,' + (g[1] * a).toFixed(3) + ')';
      ctx.lineWidth = g[0] * T;
      path(); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(220,38,38,' + (0.9 * a).toFixed(3) + ')';
    ctx.lineWidth = Math.max(2.5, 0.07 * T);
    path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,241,242,' + a.toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, 0.025 * T);
    path(); ctx.stroke();
    /* 紅點：打在小膠囊身上 */
    var dx = PX * T, dy = gY - (E.floorAt(w, camX + PX) + mid) * T;
    var rg = ctx.createRadialGradient(dx, dy, 0, dx, dy, 0.42 * T);
    rg.addColorStop(0, 'rgba(255,241,242,' + a.toFixed(3) + ')');
    rg.addColorStop(0.25, 'rgba(239,68,68,' + (0.85 * a).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(dx, dy, 0.42 * T, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* 點滴架：醫生旁邊；點滴袋的水位 = 醫生還剩多少（每次蓄力都會變少） */
  function ivStand(x, dY, level, t) {
    var T = V.T;
    ctx.save();
    ctx.lineCap = 'round';
    /* 腳架與輪子 */
    ctx.strokeStyle = '#78716C';
    ctx.lineWidth = Math.max(2, 0.07 * T);
    ctx.beginPath();
    ctx.moveTo(x - 0.35 * T, dY - 0.12 * T); ctx.lineTo(x, dY - 0.3 * T); ctx.lineTo(x + 0.35 * T, dY - 0.12 * T);
    ctx.moveTo(x, dY - 0.3 * T); ctx.lineTo(x, dY - 3.75 * T);
    ctx.moveTo(x - 0.35 * T, dY - 3.75 * T); ctx.lineTo(x + 0.15 * T, dY - 3.75 * T);
    ctx.stroke();
    ctx.fillStyle = '#44403C';
    [-0.35, 0.35].forEach(function (k) { ctx.beginPath(); ctx.arc(x + k * T, dY - 0.08 * T, 0.08 * T, 0, Math.PI * 2); ctx.fill(); });
    /* 點滴袋 */
    var bw = 0.62 * T, bh = 1.05 * T, bx = x - 0.35 * T - bw / 2, by = dY - 3.62 * T;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    rrect(bx, by, bw, bh, 0.16 * T); ctx.fill();
    var lv = clamp(level, 0, 1), lh = (bh - 0.16 * T) * lv;
    if (lh > 0.5) {
      ctx.save();
      rrect(bx, by, bw, bh, 0.16 * T); ctx.clip();
      ctx.fillStyle = '#7DD3FC';
      ctx.fillRect(bx, by + bh - 0.08 * T - lh, bw, lh + 0.08 * T);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillRect(bx, by + bh - 0.08 * T - lh, bw, Math.max(1.5, 0.04 * T));
      ctx.restore();
    }
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth = Math.max(1.5, 0.05 * T);
    rrect(bx, by, bw, bh, 0.16 * T); ctx.stroke();
    /* 刻度、標籤 */
    ctx.strokeStyle = 'rgba(87,83,78,.55)';
    ctx.lineWidth = 1;
    for (var k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(bx + bw - 0.16 * T, by + k * bh / 4); ctx.lineTo(bx + bw - 0.04 * T, by + k * bh / 4); ctx.stroke(); }
    ctx.fillStyle = '#FDBA74';
    rrect(bx + 0.08 * T, by + 0.14 * T, bw * 0.45, 0.22 * T, 3); ctx.fill();
    /* 掛鉤、滴管 */
    ctx.strokeStyle = '#78716C';
    ctx.beginPath(); ctx.moveTo(bx + bw / 2, by); ctx.lineTo(bx + bw / 2, dY - 3.75 * T); ctx.stroke();
    var cx = bx + bw / 2, cy = by + bh;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.strokeStyle = '#57534E';
    rrect(cx - 0.08 * T, cy, 0.16 * T, 0.3 * T, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
    return { x: cx, y: cy + 0.3 * T };
  }

  /* 管子：點滴袋 → 針筒尾端（繞過醫生的右肩）；蓄力時管子裡的水滴往針筒流 */
  function tube(bag, ex, ey, flowing, t) {
    var T = V.T;
    var c1x = bag.x + 0.5 * T, c1y = bag.y + 0.8 * T, c2x = ex + 0.9 * T, c2y = ey;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = flowing ? 'rgba(14,165,233,.85)' : 'rgba(186,230,253,.95)';
    ctx.lineWidth = Math.max(2, 0.07 * T);
    ctx.beginPath(); ctx.moveTo(bag.x, bag.y); ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey); ctx.stroke();
    if (flowing && !reduce) {
      ctx.fillStyle = '#E0F2FE';
      for (var i = 0; i < 4; i++) {
        var u = ((t / 600) + i / 4) % 1, v = 1 - u;
        var px = v * v * v * bag.x + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * ex;
        var py = v * v * v * bag.y + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * ey;
        ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, 0.03 * T), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* 水柱：貼著地面、沿著山丘的坡度前進 */
  function water(shot, camX, gY) {
    var T = V.T, w = G.run.world, l = shot.lane === 'low' ? B.LOW : B.HIGH;
    var sx = (shot.x - camX) * T, cy = gY - E.shotY(w, shot.x, shot.lane) * T;
    var slope = (E.floorAt(w, shot.x + 0.3) - E.floorAt(w, shot.x - 0.3)) / 0.6;
    var h = (l[1] - l[0]) * T * 0.9, len = B.LEN * T;
    ctx.save();
    ctx.translate(sx, cy);
    ctx.rotate(-Math.atan(slope));
    var g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#7DD3FC');
    g.addColorStop(1, '#0284C7');
    ctx.fillStyle = g;
    rrect(-len / 2, -h / 2, len, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = '#075985';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    rrect(-len / 2 + 0.18 * T, -h / 2 + 0.08 * T, len * 0.4, h * 0.22, h * 0.11);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    for (var k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(len / 2 + k * 0.22 * T, (k % 2 ? -1 : 1) * 0.08 * T, (0.1 - k * 0.02) * T, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 打敗醫生：舉起小白旗（笑咪咪的投降） */
  function whiteFlag(x, y, t) {
    var T = V.T, wave = reduce ? 0 : Math.sin(t / 160) * 0.06 * T;
    ctx.save();
    ctx.strokeStyle = '#78716C';
    ctx.lineWidth = Math.max(2, 0.06 * T);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 1.5 * T); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 1.5 * T);
    ctx.quadraticCurveTo(x - 0.35 * T, y - 1.45 * T + wave, x - 0.75 * T, y - 1.5 * T);
    ctx.lineTo(x - 0.75 * T, y - 1.0 * T);
    ctx.quadraticCurveTo(x - 0.35 * T, y - 0.95 * T - wave, x, y - 1.0 * T);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
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

  /* ── 小粒子：跳起來的灰塵、撞到時的碎紙花（減少動態時不畫） ── */

  function puff(x, y, n, color) {
    if (reduce) return;
    for (var i = 0; i < n; i++) {
      G.parts.push({ x: x + (Math.random() - 0.5) * 0.4, y: y, vx: -0.5 - Math.random() * 1.5, vy: 0.4 + Math.random() * 1.6, t: 0, life: 0.45, r: 0.07 + Math.random() * 0.06, c: color, g: 4 });
    }
  }

  function burst(x, y) {
    if (reduce) return;
    var cs = CH.burst;
    for (var i = 0; i < 14; i++) {
      var ang = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
      G.parts.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + 1.5, t: 0, life: 0.7, r: 0.08 + Math.random() * 0.08, c: cs[i % cs.length], g: 7 });
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

  renderMap();
  openChars();
  track('home');

  /* 測試用 */
  window.__dash = {
    G: G, V: V, start: start, begin: begin, tick: tick, pause: pause, handle: handle, openBrief: openBrief,
    record: function () { return rec; }, speed: speed
  };
})();
