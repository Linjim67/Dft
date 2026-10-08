/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 浮空小島高爾夫（單機）
   規則在 physics.js、球洞在 holes.js；
   這裡只處理畫面（canvas）、輸入（手指／鍵盤）、HUD、對話框和紀錄。
   直式手機：球從下往上打。橫式：整個球場轉 90 度，從左往右打，畫面比較大。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var profile = Anxin.profile.load();
  if (!profile) return; /* <head> 裡的守衛已經導回 / */

  var P = window.GolfPhysics, HS = window.GolfHoles, C = P.CONFIG, HOLES = HS.HOLES;
  var $ = function (id) { return document.getElementById(id); };
  var live = $('liveRegion');

  var DEAD = 16;            /* 手指拉不到這麼遠（px）：放開就取消 */
  var CLIFF = 40;           /* 小島下面土塊的厚度（世界單位） */
  var LIP = 7;              /* 草地的厚度 */
  var FLAG_H = 50;
  var FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
  /* 預覽線的長度：年紀小的看得比較遠 */
  var PREVIEW_LEN = profile.age <= 6 ? 420 : 300;

  /* 每一洞的天空和草地（haze = 遠方小島的剪影） */
  var THEME = {
    1: { sky: ['#CBE7FB', '#FFF2E0'], haze: 'rgba(120, 155, 200, .16)', grass: '#9AD771', stripe: '#8FCF66', side: '#6CAD48', earth: ['#DDA56E', '#9A6641'] },
    2: { sky: ['#C3E4FF', '#EDF8FF'], haze: 'rgba(110, 150, 205, .16)', grass: '#96D66F', stripe: '#8ACD65', side: '#69AA49', earth: ['#D9A570', '#956441'] },
    3: { sky: ['#DFD6FA', '#FFEDE0'], haze: 'rgba(140, 120, 200, .16)', grass: '#92D27C', stripe: '#86C971', side: '#66A853', earth: ['#CF9E7A', '#86604A'] }
  };
  var AIM_COLORS = ['#22C55E', '#FACC15', '#F97316', '#EF4444'];

  /* 無痕模式下 localStorage 可能丟例外：退回記憶體 */
  var storage = (function () {
    try { if (window.localStorage) return window.localStorage; } catch (e) { /* 忽略 */ }
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } };
  })();

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduce = !!(mq && mq.matches);
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { reduce = mq.matches; });

  function say(text) {
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }

  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function fmtRel(n) { return n === 0 ? '±0' : n > 0 ? '+' + n : '−' + -n; }

  var PAR_TOTAL = HOLES.reduce(function (a, H) { return a + H.par; }, 0);

  /* ─────────────────────────────────────────────────────────────
     紀錄：只存在這支手機，跟著這次的代碼（換一位小朋友就重新開始）
     ───────────────────────────────────────────────────────────── */

  var REC_KEY = 'anxin.golf.v1';

  function loadRec() {
    try {
      var r = JSON.parse(storage.getItem(REC_KEY) || 'null');
      if (r && r.code === profile.code && Array.isArray(r.rounds) && r.best && typeof r.best === 'object') return r;
    } catch (e) { /* 壞掉的紀錄就重來 */ }
    return { code: profile.code, rounds: [], best: {} };
  }

  function saveRec() {
    try { storage.setItem(REC_KEY, JSON.stringify(rec)); } catch (e) { /* 存不進去：這次照常玩 */ }
  }

  var rec = loadRec();

  /* ─────────────────────────────────────────────────────────────
     成績的說法
     ───────────────────────────────────────────────────────────── */

  function scoreWord(strokes, par, picked) {
    if (picked) return '撿起來囉';
    var d = strokes - par;
    if (strokes === 1) return '一桿進洞！';
    if (d <= -3) return '信天翁！';
    if (d === -2) return '老鷹！';
    if (d === -1) return '小鳥！';
    if (d === 0) return '平標準桿';
    if (d === 1) return '柏忌';
    if (d === 2) return '雙柏忌';
    if (d === 3) return '三柏忌';
    return '進洞了！';
  }

  function scoreLine(strokes, par, picked) {
    if (picked) return '這一洞有點難，我們先去下一洞！';
    var d = strokes - par;
    var head = '標準桿 ' + par + '，你用了 ' + strokes + ' 桿。';
    if (strokes === 1) return head + '一桿就進洞，太厲害了！';
    if (d < 0) return head + '比標準桿少 ' + -d + ' 桿，好強！';
    if (d === 0) return head + '剛剛好，穩穩的！';
    return head + '下一洞再加油！';
  }

  function verdict(total) {
    var d = total - PAR_TOTAL;
    if (d <= -2) return '好厲害！小島們都在幫你拍手！';
    if (d <= 0) return '打得好穩，剛剛好！';
    if (d <= 4) return '很不錯！再打一次，桿數會更少。';
    return '小島這次贏了一點點，要不要再挑戰一次？';
  }

  /* ─────────────────────────────────────────────────────────────
     畫面切換
     ───────────────────────────────────────────────────────────── */

  var views = { intro: $('introView'), play: $('playView') };

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    document.body.classList.toggle('is-playing', name === 'play');
    window.scrollTo(0, 0);
  }

  /* 遊戲時間（shared/playtime.js）：球場介紹 = home，每一洞 = 洞號 */
  function track(level) {
    if (window.AnxinPlay) window.AnxinPlay.at('golf', level);
  }

  /* ─────────────────────────────────────────────────────────────
     球場介紹
     ───────────────────────────────────────────────────────────── */

  function renderIntro() {
    $('holeList').innerHTML = HOLES.map(function (H) {
      var best = rec.best[H.id];
      return '<li class="hole-item">' +
        '<span class="hole-map" aria-hidden="true"><canvas class="hole-thumb" data-hole="' + H.id + '"></canvas>' +
        '<span class="hole-num">' + H.id + '</span></span>' +
        '<span class="hole-text"><span class="hole-name"><span class="sr-only">第 ' + H.id + ' 洞 </span>' + H.name + '</span>' +
        '<span class="hole-tip">' + H.tip + '</span></span>' +
        '<span class="hole-side"><span class="hole-par">標準桿 ' + H.par + '</span>' +
        (best ? '<span class="hole-best">最佳 ' + best + ' 桿</span>' : '') + '</span>' +
        '</li>';
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('.hole-thumb'), function (c) {
      drawThumb(c, HOLES[+c.getAttribute('data-hole') - 1]);
    });

    var rounds = rec.rounds;
    $('roundList').innerHTML = rounds.length ? rounds.map(function (r, i) {
      return '<li class="round-item"><span class="round-rank">' + (i + 1) + '</span>' +
        '<span><span class="round-total">' + r.total + ' 桿</span><span class="round-rel">' + fmtRel(r.total - PAR_TOTAL) + '</span></span>' +
        '<span class="round-time">' + fmtTime(r.time) + '</span></li>';
    }).join('') : '<li class="round-empty">打完一輪，成績就會出現在這裡</li>';
  }

  /* 球洞小地圖：天空、小島（下面一點土色）、欄杆、球洞和發球台 */
  function drawThumb(c, H) {
    var cw = 64, ch = 92, d = Math.min(window.devicePixelRatio || 1, 2), T = THEME[H.id];
    c.width = cw * d;
    c.height = ch * d;
    var g = c.getContext('2d');
    if (!g) return;
    g.setTransform(d, 0, 0, d, 0, 0);
    var gr = g.createLinearGradient(0, 0, 0, ch);
    gr.addColorStop(0, T.sky[0]);
    gr.addColorStop(1, T.sky[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, cw, ch);
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    H.lands.forEach(function (L) {
      x0 = Math.min(x0, L.box[0]); y0 = Math.min(y0, L.box[1]);
      x1 = Math.max(x1, L.box[0] + L.box[2]); y1 = Math.max(y1, L.box[1] + L.box[3]);
    });
    var pad = 6, s = Math.min((cw - pad * 2) / (x1 - x0), (ch - pad * 2 - 4) / (y1 - y0));
    var ox = cw / 2 - s * (x0 + x1) / 2, oy = (ch - 4) / 2 - s * (y0 + y1) / 2;
    g.setTransform(d * s, 0, 0, d * s, d * ox, d * oy);
    function path(pts, dy) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1] + (dy || 0));
      for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1] + (dy || 0));
      g.closePath();
    }
    H.lands.forEach(function (L) {
      g.fillStyle = T.earth[1];
      path(L.inner, 26);
      g.fill();
      g.fillStyle = T.side;
      path(L.poly, 10);
      g.fill();
    });
    H.lands.forEach(function (L) {
      g.fillStyle = T.grass;
      path(L.poly);
      g.fill();
    });
    g.strokeStyle = '#FFF2E0';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    (H.rails || []).forEach(function (line) {
      g.beginPath();
      g.moveTo(line[0][0], line[0][1]);
      for (var i = 1; i < line.length; i++) g.lineTo(line[i][0], line[i][1]);
      g.stroke();
    });
    g.fillStyle = '#2B1D14';
    g.beginPath();
    g.arc(H.cup[0], H.cup[1], 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#F97316';
    g.beginPath();
    g.moveTo(H.cup[0], H.cup[1] - 60);
    g.lineTo(H.cup[0] + 34, H.cup[1] - 48);
    g.lineTo(H.cup[0], H.cup[1] - 36);
    g.fill();
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(H.cup[0], H.cup[1]);
    g.lineTo(H.cup[0], H.cup[1] - 60);
    g.stroke();
    g.fillStyle = '#FFFFFF';
    g.strokeStyle = '#8F8A84';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(H.tee[0], H.tee[1], 11, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  /* ─────────────────────────────────────────────────────────────
     遊戲狀態
     ───────────────────────────────────────────────────────────── */

  var cv = $('stageCanvas'), stage = $('stage'), ctx = cv.getContext('2d');

  var G = {
    phase: 'idle',          /* banner → play → done（打完一洞） */
    hole: 0,
    W: null,
    ball: null,
    t: 0,
    acc: 0,
    strokes: 0,
    scores: [null, null, null],
    lie: null,
    aim: null,              /* 手指拉的狀態 */
    kb: null,               /* 鍵盤瞄準：{ ang, power } */
    pv: null,               /* 預覽線 */
    pvKey: '',
    time: 0,
    idle: 0,
    raf: 0,
    last: 0,
    paused: false,
    trail: [],
    fx: [],                 /* 彩帶 */
    bump: [],               /* 蘑菇被撞到的時間 */
    padHit: [],
    warpT: -9,
    sinkT: -9,
    behind: false,          /* 掉下去的時候是不是在小島後面（要被小島擋住） */
    timers: []
  };

  function later(fn, ms) {
    var id = window.setTimeout(function () {
      G.timers = G.timers.filter(function (x) { return x !== id; });
      fn();
    }, ms);
    G.timers.push(id);
  }

  function clearTimers() {
    G.timers.forEach(function (id) { window.clearTimeout(id); });
    G.timers = [];
  }

  function total() {
    return G.scores.reduce(function (a, s) { return a + (s ? s.strokes : 0); }, 0);
  }

  /* ─────────────────────────────────────────────────────────────
     HUD
     ───────────────────────────────────────────────────────────── */

  function updateHud() {
    var H = HOLES[G.hole];
    $('hudNo').textContent = H.id;
    $('hudTitle').innerHTML = '<span class="sr-only">第 ' + H.id + ' 洞・</span>' + H.name;
    $('hudPar').textContent = '標準桿 ' + H.par;
    $('hudStrokes').textContent = G.strokes;
    $('hudTotal').textContent = '總共 ' + (total() + (G.phase === 'done' ? 0 : G.strokes)) + ' 桿';
    $('hudDots').innerHTML = HOLES.map(function (h, i) {
      return '<span class="hud-dot' + (i < G.hole || G.scores[i] ? ' is-done' : i === G.hole ? ' is-cur' : '') + '"></span>';
    }).join('');
  }

  var toastTimer = 0;
  function toast(text, ms) {
    var el = $('toast');
    el.textContent = text;
    el.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.hidden = true; }, ms || 1800);
  }

  function setHint(on) {
    $('hint').hidden = !on;
  }

  /* ─────────────────────────────────────────────────────────────
     開始一洞／一輪
     ───────────────────────────────────────────────────────────── */

  function startRound() {
    G.scores = [null, null, null];
    G.time = 0;
    show('play');
    startHole(0);
  }

  function startHole(i) {
    clearTimers();
    closeDialogs();
    var H = HOLES[i];
    G.hole = i;
    track(H.id);
    G.W = P.build(H);
    G.ball = P.newBall(H.tee[0], H.tee[1]);
    G.strokes = 0;
    G.scores[i] = null;
    G.lie = { x: H.tee[0], y: H.tee[1], bridge: -1 };
    G.aim = null;
    G.kb = null;
    G.pv = null;
    G.trail = [];
    G.fx = [];
    G.bump = (H.bumpers || []).map(function () { return -9; });
    G.padHit = (H.pads || []).map(function () { return -9; });
    G.warpT = G.sinkT = -9;
    G.behind = false;
    G.acc = 0;
    G.idle = 0;
    G.paused = false;
    $('pop').hidden = true;
    $('toast').hidden = true;
    $('aimMeter').hidden = true;
    setHint(false);

    V.key = '';
    fit();
    updateHud();

    $('bannerNo').textContent = H.id;
    $('bannerKicker').textContent = '第 ' + H.id + ' 洞';
    $('bannerName').textContent = H.name;
    $('bannerPar').textContent = '標準桿 ' + H.par;
    $('bannerTip').textContent = H.tip;
    $('banner').hidden = false;
    G.phase = 'banner';
    say('第 ' + H.id + ' 洞，' + H.name + '，標準桿 ' + H.par + '。' + H.tip + '點一下開始。');
    startLoop();
    later(hideBanner, 3600);
  }

  function hideBanner() {
    if (G.phase !== 'banner') return;
    $('banner').hidden = true;
    G.phase = 'play';
    G.idle = 0;
    setHint(true);
  }

  /* ─────────────────────────────────────────────────────────────
     打球
     ───────────────────────────────────────────────────────────── */

  function canAim() {
    return G.phase === 'play' && !G.paused && G.ball && G.ball.state === 'rest';
  }

  function takeShot(dx, dy, power) {
    var b = G.ball;
    var gi = P.groundAt(G.W, b.x, b.y, G.t);
    if (gi > 0) {
      var B = G.W.hole.bridges[gi - 1], o = P.bridgeOff(B, G.t);
      G.lie = { x: b.x, y: b.y, bridge: gi - 1, ox: b.x - (B.x + o.x), oy: b.y - (B.y + o.y) };
    } else {
      G.lie = { x: b.x, y: b.y, bridge: -1 };
    }
    P.shoot(b, dx, dy, power);
    G.strokes++;
    G.aim = null;
    G.kb = null;
    G.pv = null;
    G.trail = [];
    $('aimMeter').hidden = true;
    setHint(false);
    updateHud();
  }

  function respawn() {
    var L = G.lie, x = L.x, y = L.y;
    if (L.bridge >= 0) {
      var B = G.W.hole.bridges[L.bridge], o = P.bridgeOff(B, G.t);
      x = B.x + o.x + L.ox;
      y = B.y + o.y + L.oy;
    }
    G.ball = P.newBall(x, y);
    G.behind = false;
    G.trail = [];
  }

  /* 停下來（或掉下去回到原地）之後：桿數太多就撿起來 */
  function afterRest() {
    var H = HOLES[G.hole];
    if (G.strokes >= H.par + C.PICKUP_OVER_PAR) {
      holeDone(true);
      return;
    }
    G.idle = 0;
  }

  function holeDone(picked) {
    var H = HOLES[G.hole];
    G.phase = 'done';
    G.aim = null;
    G.kb = null;
    $('aimMeter').hidden = true;
    setHint(false);
    G.scores[G.hole] = { strokes: G.strokes, picked: !!picked };
    var prev = rec.best[H.id];
    if (!picked && (!prev || G.strokes < prev)) {
      rec.best[H.id] = G.strokes;
      saveRec();
    }
    updateHud();
    var word = scoreWord(G.strokes, H.par, picked);
    say(word + scoreLine(G.strokes, H.par, picked));
    if (!picked) {
      G.sinkT = G.t;
      if (!reduce) burst();
      var pop = $('pop');
      pop.textContent = word;
      pop.hidden = false;
    } else {
      toast('撿起來囉，下一洞！', 1600);
    }
    later(function () {
      $('pop').hidden = true;
      if (G.hole === HOLES.length - 1) showDone();
      else showCard();
    }, picked ? 1400 : 1500);
  }

  /* ─────────────────────────────────────────────────────────────
     記分卡
     ───────────────────────────────────────────────────────────── */

  function scorecard(cur) {
    var head = '<tr><th scope="row">球洞</th>', par = '<tr><th scope="row">標準桿</th>',
      st = '<tr class="sc-strokes"><th scope="row">桿數</th>';
    HOLES.forEach(function (H, i) {
      var c = i === cur ? ' class="is-cur"' : '';
      var s = G.scores[i];
      head += '<th scope="col"' + c + '>' + H.id + '</th>';
      par += '<td' + c + '>' + H.par + '</td>';
      if (s) {
        var d = s.strokes - H.par;
        st += '<td' + c + '>' + s.strokes +
          (d ? '<span class="sc-rel ' + (d < 0 ? 'is-under' : 'is-over') + '">' + fmtRel(d) + '</span>' : '') + '</td>';
      } else {
        st += '<td' + c + '><span aria-label="還沒打">－</span></td>';
      }
    });
    head += '<th scope="col" class="sc-total">合計</th></tr>';
    par += '<td class="sc-total">' + PAR_TOTAL + '</td></tr>';
    st += '<td class="sc-total">' + total() + '</td></tr>';
    return '<table><thead>' + head + '</thead><tbody>' + par + st + '</tbody></table>';
  }

  function showCard() {
    var H = HOLES[G.hole], s = G.scores[G.hole];
    $('cardKicker').textContent = '第 ' + H.id + ' 洞・' + H.name;
    $('cardTitle').textContent = scoreWord(s.strokes, H.par, s.picked);
    $('cardLine').textContent = scoreLine(s.strokes, H.par, s.picked);
    $('cardTable').innerHTML = scorecard(G.hole);
    openDlg($('cardDlg'));
  }

  function showDone() {
    var t = total(), rel = t - PAR_TOTAL;
    var entry = { total: t, time: Math.round(G.time), at: Date.now() };
    var prevBest = rec.rounds[0];
    var isBest = !prevBest || t < prevBest.total || (t === prevBest.total && entry.time < prevBest.time);
    rec.rounds.push(entry);
    rec.rounds.sort(function (a, b) { return a.total - b.total || a.time - b.time; });
    rec.rounds = rec.rounds.slice(0, 5);
    saveRec();

    $('doneTitle').textContent = '總共 ' + t + ' 桿';
    $('doneBest').hidden = !(isBest && rec.rounds.length > 1);
    $('doneVsPar').textContent = fmtRel(rel);
    $('doneTime').textContent = fmtTime(G.time);
    $('doneTable').innerHTML = scorecard(-1);
    $('doneLine').textContent = verdict(t);
    openDlg($('doneDlg'));
    say('打完三洞了！總共 ' + t + ' 桿，比標準桿' + (rel === 0 ? '剛好' : rel > 0 ? '多 ' + rel + ' 桿' : '少 ' + -rel + ' 桿') + '。' + verdict(t));
  }

  /* ─────────────────────────────────────────────────────────────
     對話框
     ───────────────────────────────────────────────────────────── */

  var dlgs = [$('pauseDlg'), $('cardDlg'), $('doneDlg')];

  function openDlg(d) {
    if (d.open) return;
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }

  function closeDialogs() {
    dlgs.forEach(function (d) {
      if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
    });
  }

  function anyOpen() {
    return dlgs.some(function (d) { return d.open; });
  }

  function dlgAction(dlg, fn) {
    return function () {
      if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
      fn();
    };
  }

  function pause() {
    if (views.play.hidden || G.paused || anyOpen()) return;
    G.paused = true;
    cancelAim();
    openDlg($('pauseDlg'));
  }

  function toIntro() {
    clearTimers();
    stopLoop();
    G.phase = 'idle';
    renderIntro();
    show('intro');
    track('home');
    $('introTitle').focus();
  }

  $('pauseBtn').addEventListener('click', pause);
  $('pauseDlg').addEventListener('close', function () {
    G.paused = false;
    G.last = now();
  });
  dlgs.forEach(function (d) {
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) d.close();
    });
  });
  /* 記分卡和總成績不能用 Esc 關掉（不然就卡在沒有下一步的畫面） */
  [$('cardDlg'), $('doneDlg')].forEach(function (d) {
    d.addEventListener('cancel', function (e) { e.preventDefault(); });
  });

  $('retryHoleBtn').addEventListener('click', dlgAction($('pauseDlg'), function () { startHole(G.hole); }));
  $('restartBtn').addEventListener('click', dlgAction($('pauseDlg'), startRound));
  $('toIntroBtn').addEventListener('click', dlgAction($('pauseDlg'), toIntro));
  $('nextBtn').addEventListener('click', dlgAction($('cardDlg'), function () { startHole(G.hole + 1); }));
  $('replayBtn').addEventListener('click', dlgAction($('cardDlg'), function () { startHole(G.hole); }));
  $('againBtn').addEventListener('click', dlgAction($('doneDlg'), startRound));
  $('doneIntroBtn').addEventListener('click', dlgAction($('doneDlg'), toIntro));
  $('startBtn').addEventListener('click', startRound);

  /* 家長接電話、切到別的 App：自動暫停 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.phase !== 'idle') pause();
  });

  /* ─────────────────────────────────────────────────────────────
     畫面座標
     直式：螢幕 = 世界 × s + 位移。
     橫式：轉 90 度（世界往上 = 螢幕往右），世界 +x = 螢幕往下。
     V.dn = 螢幕「往下」在世界裡的方向（畫土塊、把球抬高都用它）。
     球場鋪滿整個畫面；上面留給 HUD、下面留給提示，小島不會被蓋住。
     ───────────────────────────────────────────────────────────── */

  var V = { w: 0, h: 0, dpr: 1, s: 1, rot: false, ox: 0, oy: 0, dn: [0, 1], key: '' };
  var layers = { under: document.createElement('canvas'), top: document.createElement('canvas'), ok: false };

  function fit() {
    if (views.play.hidden || !G.W) return;
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rot = w > h * 1.1;
    var hud = $('hud').getBoundingClientRect(), st = stage.getBoundingClientRect();
    var top = Math.max(0, hud.bottom - st.top) + 6;
    var bottom = rot ? 10 : 58;
    var key = [w, h, dpr, rot, top, G.hole].join('|');
    if (key === V.key) return;
    V.key = key;
    V.w = w; V.h = h; V.dpr = dpr; V.rot = rot;
    V.dn = rot ? [1, 0] : [0, 1];
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);

    /* 只框住這一洞的小島（每一洞都盡量放大） */
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    G.W.hole.lands.forEach(function (L) {
      var b = L.box;
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
      x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]);
    });
    var side = 12, up = 34, down = CLIFF + 12;
    var aw = w, ah = h - top - bottom, cy0 = top;
    if (!rot) {
      var cw = x1 - x0 + side * 2, ch = y1 - y0 + up + down;
      V.s = Math.min(aw / cw, ah / ch);
      V.ox = aw / 2 - V.s * (x0 + x1) / 2;
      V.oy = cy0 + ah / 2 - V.s * ((y0 - up) + (y1 + down)) / 2;
    } else {
      var lw = y1 - y0 + side * 2, lh = x1 - x0 + up + down;
      V.s = Math.min(aw / lw, ah / lh);
      V.ox = aw / 2 + V.s * (y0 + y1) / 2;
      V.oy = cy0 + ah / 2 - V.s * ((x0 - up) + (x1 + down)) / 2;
    }
    initSky();
    buildLayers();
    G.pvKey = '';
  }

  window.addEventListener('resize', function () { fit(); });
  window.addEventListener('orientationchange', function () { window.setTimeout(fit, 250); });
  if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(stage);

  function toScreen(x, y, z) {
    z = z || 0;
    if (V.rot) return [V.ox - V.s * y, V.oy + V.s * x - V.s * z];
    return [V.ox + V.s * x, V.oy + V.s * y - V.s * z];
  }

  /* 螢幕上的一段位移 → 世界裡的方向 */
  function screenToWorldDelta(dx, dy) {
    if (V.rot) return [dy / V.s, -dx / V.s];
    return [dx / V.s, dy / V.s];
  }

  function worldTf(g) {
    var d = V.dpr, s = V.s;
    if (V.rot) g.setTransform(0, s * d, -s * d, 0, V.ox * d, V.oy * d);
    else g.setTransform(s * d, 0, 0, s * d, V.ox * d, V.oy * d);
  }

  function screenTf(g) { g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); }

  /* 世界裡的一點抬高 z（往螢幕上方） */
  function lift(x, y, z) { return [x - V.dn[0] * z, y - V.dn[1] * z]; }
  function drop(p, k) { return [p[0] + V.dn[0] * k, p[1] + V.dn[1] * k]; }

  function polyPath(g, pts, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    g.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + dx, pts[i][1] + dy);
    g.closePath();
  }

  function linePath(g, pts, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    g.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + dx, pts[i][1] + dy);
  }

  function mix(a, b, k) {
    return a.map(function (p, i) { return [p[0] + (b[i][0] - p[0]) * k, p[1] + (b[i][1] - p[1]) * k]; });
  }

  function seeded(n) {
    var x = Math.sin(n * 127.1 + G.hole * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ─────────────────────────────────────────────────────────────
     不會動的部分：先畫在兩張底圖上（影子＋土塊一張、草地＋欄杆一張），
     中間夾木橋：木橋蓋在土塊上面、兩端塞在草地下面。
     黏土風：厚厚的圓角、亮邊、軟軟的影子。
     ───────────────────────────────────────────────────────────── */

  function buildLayers() {
    var H = G.W.hole, T = THEME[H.id];
    [layers.under, layers.top].forEach(function (c) {
      c.width = cv.width;
      c.height = cv.height;
    });

    /* ── 影子和土塊 ── */
    var g = layers.under.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    worldTf(g);
    H.lands.forEach(function (L) {
      /* 飄在空中：下面遠遠的地方有一團淡淡的影子 */
      var b = L.box, cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
      var sc = drop([cx, cy], (V.rot ? b[2] : b[3]) / 2 + CLIFF + 34);
      var lat = (V.rot ? b[3] : b[2]) * 0.45;
      /* 邊緣淡出的橢圓：先畫一個半徑 1 的圓，再壓扁 */
      g.save();
      g.translate(sc[0], sc[1]);
      if (V.rot) g.scale(10, lat); else g.scale(lat, 10);
      var sg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      sg.addColorStop(0, 'rgba(70, 90, 140, .16)');
      sg.addColorStop(1, 'rgba(70, 90, 140, 0)');
      g.fillStyle = sg;
      g.beginPath();
      g.arc(0, 0, 1, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
    H.lands.forEach(function (L) {
      var top = L.poly, bot = L.inner.map(function (p) { return drop(p, CLIFF); });
      var b = L.box, far = V.rot ? b[0] + b[2] : b[1] + b[3];
      var gr = V.rot
        ? g.createLinearGradient(far - 30, 0, far + CLIFF, 0)
        : g.createLinearGradient(0, far - 30, 0, far + CLIFF);
      gr.addColorStop(0, T.earth[0]);
      gr.addColorStop(1, T.earth[1]);
      g.fillStyle = gr;
      /* 一塊一塊分開填：方向相反的四邊形放在同一條路徑裡會互相抵消，土塊就破洞了 */
      for (var i = 0; i < top.length; i++) {
        var j = (i + 1) % top.length;
        g.beginPath();
        polyPath(g, [top[i], top[j], bot[j], bot[i]]);
        g.fill();
      }
      g.beginPath();
      polyPath(g, bot);
      g.fill();
      /* 土裡的兩條地層線、幾顆石頭 */
      g.lineJoin = 'round';
      [0.4, 0.72].forEach(function (k, n) {
        var mid = mix(top, L.inner, k).map(function (p) { return drop(p, CLIFF * k); });
        g.strokeStyle = n ? 'rgba(90, 55, 30, .22)' : 'rgba(255, 235, 205, .35)';
        g.lineWidth = n ? 2 : 2.5;
        g.beginPath();
        polyPath(g, mid);
        g.stroke();
        if (n) return;
        g.fillStyle = 'rgba(255, 240, 220, .45)';
        for (var s = 0; s < mid.length; s += 5) {
          var p = mid[s], q = mid[(s + 1) % mid.length];
          var nx = q[1] - p[1], ny = -(q[0] - p[0]);
          if (nx * V.dn[0] + ny * V.dn[1] <= 0 || seeded(s + b[0]) < 0.45) continue;
          var c = drop(p, 7 + seeded(s * 3) * 6);
          g.beginPath();
          g.ellipse(c[0], c[1], 3 + seeded(s) * 2.5, 2 + seeded(s + 9) * 1.5, 0, 0, Math.PI * 2);
          g.fill();
        }
      });
      /* 草地的側面（一點點厚度） */
      g.fillStyle = T.side;
      g.beginPath();
      polyPath(g, top, V.dn[0] * LIP, V.dn[1] * LIP);
      g.fill();
    });

    /* ── 草地、條紋、欄杆、球洞、發球台、跳跳坡 ── */
    g = layers.top.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    worldTf(g);
    H.lands.forEach(function (L) {
      var b = L.box;
      g.save();
      g.beginPath();
      polyPath(g, L.poly);
      g.fillStyle = T.grass;
      g.fill();
      g.clip();
      g.fillStyle = T.stripe;
      for (var y = Math.floor(b[1] / 44) * 44; y < b[1] + b[3]; y += 44) g.fillRect(b[0] - 2, y, b[2] + 4, 22);
      /* 黏土的亮邊：內側一圈淡白 */
      g.strokeStyle = 'rgba(255, 255, 255, .42)';
      g.lineWidth = 10;
      g.lineJoin = 'round';
      g.beginPath();
      polyPath(g, L.poly);
      g.stroke();
      for (var k = 0; k < 7; k++) {
        var fx = b[0] + 20 + seeded(k * 7 + b[0]) * (b[2] - 40);
        var fy = b[1] + 20 + seeded(k * 13 + b[1]) * (b[3] - 40);
        if (!P.inPoly(L.inner, fx, fy)) continue;
        if (Math.hypot(fx - H.cup[0], fy - H.cup[1]) < 40 || Math.hypot(fx - H.tee[0], fy - H.tee[1]) < 30) continue;
        flower(g, fx, fy, k % 3 === 0 ? '#FDE68A' : k % 3 === 1 ? '#FBCFE8' : '#FFFFFF');
      }
      g.restore();
    });

    G.W.ramps.forEach(function (R) { drawRamp(g, R); });

    /* 發球台：一塊比較深的草皮，兩邊各一顆白色記號 */
    var tw = 17, tv = V.rot ? [0, 1] : [1, 0];
    g.fillStyle = 'rgba(46, 100, 30, .2)';
    g.beginPath();
    g.ellipse(H.tee[0], H.tee[1], 19, 19, 0, 0, Math.PI * 2);
    g.fill();
    [-1, 1].forEach(function (d) {
      var mx = H.tee[0] + tv[0] * tw * d, my = H.tee[1] + tv[1] * tw * d;
      g.fillStyle = '#FFFFFF';
      g.strokeStyle = 'rgba(60, 90, 40, .45)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(mx, my, 3, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });

    /* 球洞：一圈淺色的果嶺，中間深色的洞 */
    g.fillStyle = 'rgba(255, 255, 255, .28)';
    g.beginPath();
    g.arc(H.cup[0], H.cup[1], C.CUP_R + 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2B1D14';
    g.beginPath();
    g.arc(H.cup[0], H.cup[1], C.CUP_R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0, 0, 0, .35)';
    g.beginPath();
    g.arc(H.cup[0] + V.dn[0] * 3, H.cup[1] + V.dn[1] * 3, C.CUP_R - 2.5, 0, Math.PI * 2);
    g.fill();

    /* 欄杆：軟軟的黏土條（影子、深色邊、奶油色、上面一道亮光） */
    g.lineCap = 'round';
    g.lineJoin = 'round';
    (H.rails || []).forEach(function (line) {
      [
        ['rgba(70, 45, 20, .2)', 10, 3.5],
        ['#D89A5E', 8.5, 0],
        ['#FFF2E0', 5.5, 0],
        ['rgba(255, 255, 255, .95)', 1.8, -1.4]
      ].forEach(function (st) {
        g.strokeStyle = st[0];
        g.lineWidth = st[1];
        g.beginPath();
        linePath(g, line, V.dn[0] * st[2], V.dn[1] * st[2]);
        g.stroke();
      });
    });

    layers.ok = true;
  }

  function flower(g, x, y, petal) {
    g.fillStyle = petal;
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2;
      g.beginPath();
      g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#F59E0B';
    g.beginPath();
    g.arc(x, y, 1.6, 0, Math.PI * 2);
    g.fill();
  }

  /* 跳跳坡：坡頂抬高 RAMP_TOP，上面有往前的箭頭 */
  function drawRamp(g, R) {
    var d = R.dir, px = -d[1], py = d[0];
    var base = [R.cx - d[0] * R.half, R.cy - d[1] * R.half];
    var tip = [R.cx + d[0] * R.half, R.cy + d[1] * R.half];
    var b0 = [base[0] + px * R.side, base[1] + py * R.side], b1 = [base[0] - px * R.side, base[1] - py * R.side];
    var t0 = [tip[0] + px * R.side, tip[1] + py * R.side], t1 = [tip[0] - px * R.side, tip[1] - py * R.side];
    var T0 = lift(t0[0], t0[1], C.RAMP_TOP), T1 = lift(t1[0], t1[1], C.RAMP_TOP);
    g.lineJoin = 'round';
    /* 側面 */
    g.fillStyle = '#E07B32';
    [[b0, t0, T0], [b1, t1, T1]].forEach(function (tri) {
      g.beginPath();
      polyPath(g, tri);
      g.fill();
    });
    g.beginPath();
    polyPath(g, [t0, t1, T1, T0]);
    g.fill();
    /* 坡面 */
    var gr = g.createLinearGradient(base[0], base[1], (T0[0] + T1[0]) / 2, (T0[1] + T1[1]) / 2);
    gr.addColorStop(0, '#FDBA74');
    gr.addColorStop(1, '#FFEBD2');
    g.fillStyle = gr;
    g.beginPath();
    polyPath(g, [b0, b1, T1, T0]);
    g.fill();
    g.strokeStyle = '#C2410C';
    g.lineWidth = 1.5;
    g.stroke();
    /* 坡頂一道亮邊 */
    g.strokeStyle = 'rgba(255, 255, 255, .9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(T0[0], T0[1]);
    g.lineTo(T1[0], T1[1]);
    g.stroke();
    /* 箭頭 */
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (var k = 0; k < 2; k++) {
      var f = 0.3 + k * 0.32, w = R.side * 0.55;
      var c = [base[0] + (tip[0] - base[0]) * f, base[1] + (tip[1] - base[1]) * f];
      c = lift(c[0], c[1], C.RAMP_TOP * f);
      g.beginPath();
      g.moveTo(c[0] + px * w - d[0] * 8, c[1] + py * w - d[1] * 8);
      g.lineTo(c[0], c[1]);
      g.lineTo(c[0] - px * w - d[0] * 8, c[1] - py * w - d[1] * 8);
      g.stroke();
    }
  }

  /* ─────────────────────────────────────────────────────────────
     天空：漸層、太陽的暖光、遠方的小島剪影、兩層雲
     ───────────────────────────────────────────────────────────── */

  var sky = { clouds: [], isles: [] };
  function initSky() {
    sky.clouds = [];
    for (var i = 0; i < 7; i++) {
      var far = i < 3;
      sky.clouds.push({
        x: seeded(i * 5 + 1) * V.w, y: (0.1 + seeded(i * 9 + 2) * 0.82) * V.h,
        r: (far ? 10 : 16) + seeded(i * 4 + 3) * (far ? 10 : 20), v: far ? 3 : 6 + seeded(i + 7) * 5, far: far
      });
    }
    sky.isles = [];
    for (var k = 0; k < 3; k++) {
      sky.isles.push({ x: (0.12 + k * 0.36 + seeded(k + 20) * 0.1) * V.w, y: (0.22 + seeded(k + 30) * 0.6) * V.h, r: 12 + seeded(k + 40) * 10 });
    }
  }

  function cloud(g, c) {
    var r = c.r;
    g.fillStyle = c.far ? 'rgba(255, 255, 255, .45)' : 'rgba(255, 255, 255, .8)';
    g.beginPath();
    g.ellipse(c.x, c.y, r * 1.7, r * 0.62, 0, 0, Math.PI * 2);
    g.ellipse(c.x - r * 0.75, c.y - r * 0.25, r * 0.72, r * 0.58, 0, 0, Math.PI * 2);
    g.ellipse(c.x + r * 0.45, c.y - r * 0.45, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    if (c.far) return;
    /* 雲的下緣：淡淡的藍影，看起來比較軟 */
    g.fillStyle = 'rgba(160, 185, 225, .22)';
    g.beginPath();
    g.ellipse(c.x, c.y + r * 0.22, r * 1.5, r * 0.36, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawSky(g, dt) {
    var T = THEME[HOLES[G.hole].id];
    screenTf(g);
    var gr = g.createLinearGradient(0, 0, 0, V.h);
    gr.addColorStop(0, T.sky[0]);
    gr.addColorStop(1, T.sky[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, V.w, V.h);
    var sr = Math.max(V.w, V.h) * 0.45;
    var sun = g.createRadialGradient(V.w * 0.85, V.h * 0.08, 0, V.w * 0.85, V.h * 0.08, sr);
    sun.addColorStop(0, 'rgba(255, 244, 214, .9)');
    sun.addColorStop(1, 'rgba(255, 244, 214, 0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, V.w, V.h);
    /* 遠方的小島 */
    g.fillStyle = T.haze;
    sky.isles.forEach(function (s) {
      g.beginPath();
      g.ellipse(s.x, s.y, s.r * 1.6, s.r * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(s.x - s.r * 1.4, s.y);
      g.quadraticCurveTo(s.x, s.y + s.r * 1.6, s.x + s.r * 1.4, s.y);
      g.fill();
    });
    sky.clouds.forEach(function (c) {
      if (!reduce) c.x += c.v * dt;
      if (c.x - c.r * 3 > V.w) c.x = -c.r * 3;
      cloud(g, c);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     會動的東西
     ───────────────────────────────────────────────────────────── */

  function drawBridges(g) {
    (G.W.hole.bridges || []).forEach(function (B) {
      var o = P.bridgeOff(B, G.t), x = B.x + o.x, y = B.y + o.y;
      var rect = [[x, y], [x + B.w, y], [x + B.w, y + B.h], [x, y + B.h]];
      g.lineJoin = 'round';
      /* 木橋的厚度 */
      g.fillStyle = '#9A6436';
      g.beginPath();
      polyPath(g, rect, V.dn[0] * 7, V.dn[1] * 7);
      g.fill();
      g.fillStyle = '#EBBB82';
      g.beginPath();
      polyPath(g, rect);
      g.fill();
      /* 一片一片的木板 */
      g.strokeStyle = '#C08A55';
      g.lineWidth = 1.5;
      g.beginPath();
      var along = B.h >= B.w;
      for (var k = 13; k < (along ? B.h : B.w); k += 13) {
        if (along) { g.moveTo(x + 3, y + k); g.lineTo(x + B.w - 3, y + k); }
        else { g.moveTo(x + k, y + 3); g.lineTo(x + k, y + B.h - 3); }
      }
      g.stroke();
      /* 兩邊的扶手（黏土條） */
      g.lineCap = 'round';
      [[0, 4], [B.w, -4]].forEach(function (s) {
        var a = along ? [[x + s[0] + s[1], y + 2], [x + s[0] + s[1], y + B.h - 2]] : [[x + 2, y + s[0] + s[1]], [x + B.w - 2, y + s[0] + s[1]]];
        [['#8A5A33', 6], ['#D9A36A', 3.5]].forEach(function (st) {
          g.strokeStyle = st[0];
          g.lineWidth = st[1];
          g.beginPath();
          linePath(g, a);
          g.stroke();
        });
      });
    });
  }

  function drawPads(g) {
    (G.W.hole.pads || []).forEach(function (Pd, i) {
      var since = G.t - G.padHit[i];
      var squash = since < 0.35 ? Math.sin(since / 0.35 * Math.PI) : 0;
      var h = 7 - squash * 4;
      var x = Pd.x, y = Pd.y, w = Pd.w, hh = Pd.h;
      var base = [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
      g.lineJoin = 'round';
      /* 彈簧座 */
      g.fillStyle = '#2B6CB0';
      g.beginPath();
      polyPath(g, base, V.dn[0] * 2, V.dn[1] * 2);
      g.fill();
      /* 彈簧面（抬高 h） */
      var c = base.map(function (p) { return lift(p[0], p[1], h); });
      g.fillStyle = '#86CDF7';
      g.beginPath();
      polyPath(g, c);
      g.fill();
      g.strokeStyle = '#1E5A96';
      g.lineWidth = 1.8;
      g.stroke();
      g.strokeStyle = 'rgba(255, 255, 255, .7)';
      g.lineWidth = 3;
      g.beginPath();
      polyPath(g, mix(c, [lift(x + w / 2, y + hh / 2, h), lift(x + w / 2, y + hh / 2, h), lift(x + w / 2, y + hh / 2, h), lift(x + w / 2, y + hh / 2, h)], 0.18));
      g.stroke();
      /* 往上的箭頭 */
      var d = Pd.dir, px = -d[1], py = d[0], m = lift(x + w / 2, y + hh / 2, h);
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 3.5;
      g.lineCap = 'round';
      for (var k = 0; k < 2; k++) {
        var off = (k - 0.5) * 9;
        g.beginPath();
        g.moveTo(m[0] + d[0] * (off - 4) + px * 9, m[1] + d[1] * (off - 4) + py * 9);
        g.lineTo(m[0] + d[0] * (off + 4), m[1] + d[1] * (off + 4));
        g.lineTo(m[0] + d[0] * (off - 4) - px * 9, m[1] + d[1] * (off - 4) - py * 9);
        g.stroke();
      }
    });
  }

  function drawPortals(g) {
    (G.W.hole.portals || []).forEach(function (Q) {
      var spin = reduce ? 0 : G.t * 2.4;
      var flash = clamp(1 - (G.t - G.warpT) / 0.5, 0, 1);
      [Q.a, Q.b].forEach(function (p, idx) {
        var R = C.PORTAL_R;
        g.fillStyle = 'rgba(76, 29, 149, .25)';
        g.beginPath();
        g.arc(p[0] + V.dn[0] * 3, p[1] + V.dn[1] * 3, R + 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = idx === 0 ? '#4C1D95' : '#6D28D9';
        g.beginPath();
        g.arc(p[0], p[1], R + 3, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 3;
        g.lineCap = 'round';
        for (var k = 0; k < 3; k++) {
          var a = (idx === 0 ? spin : -spin) + k * Math.PI * 2 / 3;
          g.strokeStyle = k % 2 ? '#C4B5FD' : '#A78BFA';
          g.beginPath();
          g.arc(p[0], p[1], R - 3 - k * 3, a, a + 2.2);
          g.stroke();
        }
        g.strokeStyle = 'rgba(237, 233, 254, ' + (0.75 + flash * 0.25) + ')';
        g.lineWidth = 2.5 + flash * 4;
        g.beginPath();
        g.arc(p[0], p[1], R + 3 + flash * 8, 0, Math.PI * 2);
        g.stroke();
        if (idx === 1) {
          /* 出口：往外的小箭頭 */
          var d = Q.out, px = -d[1], py = d[0], tx = p[0] + d[0] * (R + 12), ty = p[1] + d[1] * (R + 12);
          g.strokeStyle = '#7C3AED';
          g.lineWidth = 3.5;
          g.beginPath();
          g.moveTo(tx - d[0] * 6 + px * 6, ty - d[1] * 6 + py * 6);
          g.lineTo(tx, ty);
          g.lineTo(tx - d[0] * 6 - px * 6, ty - d[1] * 6 - py * 6);
          g.stroke();
        }
      });
    });
  }

  /* 蘑菇彈簧：黏土做的，被撞到會鼓一下 */
  function drawBumpers(g) {
    (G.W.hole.bumpers || []).forEach(function (Bp, i) {
      var since = G.t - G.bump[i];
      var k = since < 0.3 ? 1 + Math.sin(since / 0.3 * Math.PI) * 0.18 : 1;
      var r = Bp.r * k, top = lift(Bp.x, Bp.y, 8);
      g.fillStyle = 'rgba(40, 70, 20, .25)';
      g.beginPath();
      g.ellipse(Bp.x + V.dn[0] * 3, Bp.y + V.dn[1] * 3, Bp.r * 0.95, Bp.r * 0.95, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#FFF4E4';
      g.strokeStyle = '#D9A46C';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(Bp.x, Bp.y, Bp.r * 0.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      var gr = g.createRadialGradient(top[0] - r * 0.35, top[1] - r * 0.4, r * 0.1, top[0], top[1], r);
      gr.addColorStop(0, '#FCA5A5');
      gr.addColorStop(1, '#EF4444');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(top[0], top[1], r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#B91C1C';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#FFFFFF';
      [[-0.42, -0.25, 0.22], [0.38, -0.12, 0.18], [0.02, 0.42, 0.2]].forEach(function (s) {
        g.beginPath();
        g.arc(top[0] + s[0] * r, top[1] + s[1] * r, s[2] * r, 0, Math.PI * 2);
        g.fill();
      });
    });
  }

  /* 旗子：白色旗桿、頂上一顆小金球，橘色旗面上寫著第幾洞 */
  function drawFlag(g) {
    var H = G.W.hole;
    screenTf(g);
    var base = toScreen(H.cup[0], H.cup[1], 0), s = V.s;
    var top = [base[0], base[1] - FLAG_H * s];
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(60, 40, 20, .35)';
    g.lineWidth = Math.max(3.5, 3.6 * s);
    g.beginPath();
    g.moveTo(base[0], base[1]);
    g.lineTo(top[0], top[1]);
    g.stroke();
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = Math.max(2, 2.2 * s);
    g.stroke();
    var wave = reduce ? 0 : Math.sin(G.t * 4) * 2 * s;
    var fw = 26 * s, fh = 18 * s;
    g.fillStyle = '#F97316';
    g.strokeStyle = '#C2410C';
    g.lineWidth = Math.max(1.2, 1.4 * s);
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(top[0], top[1]);
    g.quadraticCurveTo(top[0] + fw * 0.5, top[1] + wave, top[0] + fw, top[1] + fh * 0.5 + wave * 0.5);
    g.quadraticCurveTo(top[0] + fw * 0.5, top[1] + fh + wave, top[0], top[1] + fh);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#FFFFFF';
    g.font = '700 ' + Math.round(11 * s) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(H.id), top[0] + fw * 0.4, top[1] + fh * 0.52 + wave * 0.4);
    g.fillStyle = '#FACC15';
    g.strokeStyle = '#A16207';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(top[0], top[1] - 1.5 * s, Math.max(2.5, 2.8 * s), 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  /* ─────────────────────────────────────────────────────────────
     球
     ───────────────────────────────────────────────────────────── */

  function ballZ(b) {
    if (b.state === 'air' || b.state === 'fall' || b.state === 'out') return b.z;
    var a = P.rampAlong(G.W, b.x, b.y);
    return a >= 0 ? a * C.RAMP_TOP : 0;
  }

  function drawBall(g) {
    var b = G.ball;
    if (b.state === 'out') return;
    var z = ballZ(b), r = C.BALL_R, alpha = 1, scale = 1;
    if (b.state === 'fall') {
      var f = clamp(b.fallT / C.FALL_S, 0, 1);
      alpha = 1 - f;
      scale = 1 - f * 0.4;
    }
    if (b.state === 'sunk') {
      var since = G.t - G.sinkT;
      if (since > 0.3) return;
      scale = 1 - clamp(since / 0.3, 0, 1) * 0.7;
    }
    worldTf(g);
    g.globalAlpha = alpha;

    /* 拖尾 */
    G.trail.forEach(function (p, i) {
      var k = (i + 1) / G.trail.length;
      var q = lift(p[0], p[1], p[2]);
      g.fillStyle = 'rgba(255, 255, 255, ' + (0.4 * k) + ')';
      g.beginPath();
      g.arc(q[0], q[1], r * (0.4 + 0.45 * k), 0, Math.PI * 2);
      g.fill();
    });

    /* 影子：越高越小越淡 */
    if (b.state !== 'fall') {
      var sh = clamp(1 - z / 120, 0.3, 1);
      g.fillStyle = 'rgba(30, 60, 20, ' + (0.3 * sh) + ')';
      g.beginPath();
      g.ellipse(b.x + V.dn[0] * 2.5, b.y + V.dn[1] * 2.5, r * sh, r * sh * 0.85, 0, 0, Math.PI * 2);
      g.fill();
    }

    var c = lift(b.x, b.y, z), R = r * scale;
    var gr = g.createRadialGradient(c[0] - R * 0.35, c[1] - R * 0.45, R * 0.1, c[0], c[1], R);
    gr.addColorStop(0, '#FFFFFF');
    gr.addColorStop(0.6, '#F7F4F0');
    gr.addColorStop(1, '#D9D3CC');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(c[0], c[1], R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8F8A84';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = 'rgba(255, 255, 255, .95)';
    g.beginPath();
    g.arc(c[0] - R * 0.35, c[1] - R * 0.38, R * 0.25, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;

    /* 等你打的時候：球旁邊有一圈在呼吸，比較好找 */
    if (canAim() && !G.aim) {
      var pulse = reduce ? 0.5 : (Math.sin(G.idle * 4) + 1) / 2;
      g.strokeStyle = 'rgba(255, 255, 255, ' + (0.6 + pulse * 0.35) + ')';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(c[0], c[1], r + 6 + pulse * 3, 0, Math.PI * 2);
      g.stroke();
    }
  }

  /* ─────────────────────────────────────────────────────────────
     瞄準：方向箭頭（顏色＝力氣）、預覽小白點
     ───────────────────────────────────────────────────────────── */

  function aimState() {
    if (G.aim && G.aim.on) return { dx: G.aim.dx, dy: G.aim.dy, power: G.aim.power };
    if (G.kb) return { dx: Math.cos(G.kb.ang), dy: Math.sin(G.kb.ang), power: G.kb.power };
    return null;
  }

  function powerColor(p) {
    var i = Math.min(AIM_COLORS.length - 1, Math.floor(p * AIM_COLORS.length));
    return AIM_COLORS[i];
  }

  function drawAim(g) {
    var a = aimState();
    if (!a || !canAim()) return;
    var b = G.ball;
    /* 有木橋的洞：木橋一直在漂，預覽跟著時間重算 */
    var key = [b.x.toFixed(1), b.y.toFixed(1), a.dx.toFixed(3), a.dy.toFixed(3), a.power.toFixed(3),
      G.W.bridges.length ? G.t.toFixed(2) : ''].join('|');
    if (key !== G.pvKey) {
      G.pv = P.preview(G.W, b.x, b.y, a.dx, a.dy, a.power, G.t, PREVIEW_LEN);
      G.pvKey = key;
    }
    worldTf(g);
    var pts = G.pv.pts, n = pts.length;
    /* 小白點：越遠越淡 */
    for (var i = 3; i < n; i += 3) {
      var k = 1 - i / n;
      g.fillStyle = 'rgba(40, 60, 30, ' + (0.12 + 0.18 * k) + ')';
      g.beginPath();
      g.arc(pts[i][0] + V.dn[0] * 1.2, pts[i][1] + V.dn[1] * 1.2, 3.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255, 255, 255, ' + (0.35 + 0.65 * k) + ')';
      g.beginPath();
      g.arc(pts[i][0], pts[i][1], 3, 0, Math.PI * 2);
      g.fill();
    }
    var end = pts[n - 1];
    g.lineCap = 'round';
    if (G.pv.end === 'fall') {
      /* 會掉下去：紅色叉叉 */
      [['#FFFFFF', 5.5], ['#DC2626', 3]].forEach(function (st) {
        g.strokeStyle = st[0];
        g.lineWidth = st[1];
        g.beginPath();
        g.moveTo(end[0] - 5, end[1] - 5); g.lineTo(end[0] + 5, end[1] + 5);
        g.moveTo(end[0] + 5, end[1] - 5); g.lineTo(end[0] - 5, end[1] + 5);
        g.stroke();
      });
    } else if (G.pv.end === 'mark' || G.pv.end === 'cup') {
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(end[0], end[1], 7.5, 0, Math.PI * 2);
      g.stroke();
    }

    /* 方向箭頭：粗粗圓圓的黏土條 */
    var col = powerColor(a.power), L = 20 + a.power * 56, r = C.BALL_R + 4;
    var sx = b.x + a.dx * r, sy = b.y + a.dy * r, ex = b.x + a.dx * (r + L), ey = b.y + a.dy * (r + L);
    var px = -a.dy, py = a.dx;
    var head = [[ex + a.dx * 12, ey + a.dy * 12], [ex + px * 9, ey + py * 9], [ex - px * 9, ey - py * 9]];
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(41, 37, 36, .55)';
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.lineWidth = 4;
    g.fillStyle = 'rgba(41, 37, 36, .55)';
    g.beginPath(); polyPath(g, head); g.fill(); g.stroke();
    g.strokeStyle = col;
    g.lineWidth = 6.5;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = col;
    g.beginPath(); polyPath(g, head); g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, .55)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(sx + px * 1.3, sy + py * 1.3);
    g.lineTo(ex + px * 1.3, ey + py * 1.3);
    g.stroke();

    /* 後面的「橡皮筋」：拉越遠越長 */
    var back = 6 + a.power * 34;
    g.setLineDash([3, 4]);
    g.strokeStyle = 'rgba(255, 255, 255, .9)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(b.x - a.dx * r, b.y - a.dy * r);
    g.lineTo(b.x - a.dx * (r + back), b.y - a.dy * (r + back));
    g.stroke();
    g.setLineDash([]);
  }

  /* 第 1 洞的第一桿：一根手指示範「往後拉」 */
  function drawDemo(g) {
    if (G.hole !== 0 || G.strokes !== 0 || !canAim() || G.aim || G.kb || G.idle < 0.8) return;
    var b = G.ball;
    /* 往球前面那段路的反方向拉（第 1 洞：路先往上走） */
    var ahead = G.W.hole.tee[1] > G.W.hole.cup[1] ? [0, -1] : [0, 1];
    var bs = toScreen(b.x, b.y, 0), fs = toScreen(b.x + ahead[0] * 50, b.y + ahead[1] * 50, 0);
    var dx = bs[0] - fs[0], dy = bs[1] - fs[1], L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    var cyc = ((G.idle - 0.8) % 2.4) / 2.4;
    var k = reduce ? 0.7 : clamp((cyc - 0.1) / 0.55, 0, 1);
    var alpha = reduce ? 1 : cyc < 0.1 ? cyc / 0.1 : cyc > 0.8 ? (1 - cyc) / 0.2 : 1;
    var pull = Math.min(90, Math.min(V.w, V.h) * 0.22) * k;
    var start = [bs[0] + dx * 30, bs[1] + dy * 30], f = [start[0] + dx * pull, start[1] + dy * pull];
    screenTf(g);
    g.globalAlpha = alpha;
    g.setLineDash([4, 5]);
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(start[0], start[1]);
    g.lineTo(f[0], f[1]);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255, 237, 213, .85)';
    g.strokeStyle = '#C2410C';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(f[0], f[1], 16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.globalAlpha = 1;
  }

  /* ─────────────────────────────────────────────────────────────
     彩帶（進洞）
     ───────────────────────────────────────────────────────────── */

  function burst() {
    var H = G.W.hole, c = toScreen(H.cup[0], H.cup[1], 0);
    var cols = ['#F97316', '#FACC15', '#22C55E', '#38BDF8', '#A78BFA', '#F472B6'];
    for (var i = 0; i < 40; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 160 + Math.random() * 260;
      G.fx.push({ x: c[0], y: c[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.3 + Math.random() * 0.5, t: 0,
        c: cols[i % cols.length], s: 4 + Math.random() * 4, rot: Math.random() * 6 });
    }
  }

  function drawFx(g, dt) {
    if (!G.fx.length) return;
    screenTf(g);
    G.fx = G.fx.filter(function (p) {
      p.t += dt;
      p.vy += 520 * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 8;
      var a = clamp(1 - p.t / p.life, 0, 1);
      g.save();
      g.globalAlpha = a;
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.c;
      g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
      return p.t < p.life;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     一幀
     ───────────────────────────────────────────────────────────── */

  function render(dt) {
    var g = ctx;
    if (!layers.ok) return;
    drawSky(g, dt);

    /* 從小島後面掉下去的球：要被小島擋住，先畫 */
    var fallBehind = G.ball.state === 'fall' && G.behind;
    if (fallBehind) drawBall(g);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(layers.under, 0, 0);
    worldTf(g);
    drawBridges(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(layers.top, 0, 0);

    worldTf(g);
    drawPortals(g);
    drawPads(g);
    drawBumpers(g);
    if (!fallBehind) drawBall(g);
    drawFlag(g);
    drawAim(g);
    drawDemo(g);
    drawFx(g, dt);
  }

  /* ─────────────────────────────────────────────────────────────
     物理事件
     ───────────────────────────────────────────────────────────── */

  function handle(ev) {
    var b = G.ball;
    switch (ev.type) {
      case 'bumper':
        G.bump[G.W.bumpers.indexOf(ev.bumper)] = G.t;
        break;
      case 'pad':
        G.padHit[ev.pad] = G.t;
        break;
      case 'warp':
        G.warpT = G.t;
        G.trail = [];
        break;
      case 'fall':
        /* 球掉下去的地方，往螢幕下方一點點還是小島：代表在小島後面，要被擋住 */
        G.behind = P.groundAt(G.W, b.x + V.dn[0] * 24, b.y + V.dn[1] * 24, G.t) >= 0;
        break;
      case 'out':
        G.strokes += C.PENALTY;
        updateHud();
        toast('掉下小島了！多算 ' + C.PENALTY + ' 桿', 1800);
        say('掉下小島了，多算 ' + C.PENALTY + ' 桿。球回到剛剛打的地方。');
        respawn();
        afterRest();
        break;
      case 'sink':
        holeDone(false);
        break;
      case 'rest':
        say('球停下來了。第 ' + (G.strokes + 1) + ' 桿。');
        afterRest();
        break;
    }
  }

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
    var dt = clamp((t - G.last) / 1000, 0, C.MAX_REAL_DT);
    G.last = t;
    if (G.paused || anyOpen()) {
      render(0);
      return;
    }
    if (G.phase === 'play') G.time += dt;
    G.idle += dt;

    G.acc += dt;
    var evs = [];
    while (G.acc >= C.DT) {
      P.step(G.W, G.ball, G.t, evs, false);
      G.t += C.DT;
      G.acc -= C.DT;
      if (evs.length) {
        var list = evs;
        evs = [];
        for (var i = 0; i < list.length; i++) handle(list[i]);
      }
    }

    var b = G.ball, sp = Math.hypot(b.vx, b.vy);
    if ((b.state === 'roll' || b.state === 'air') && sp > 160 && !reduce) {
      G.trail.push([b.x, b.y, ballZ(b)]);
      if (G.trail.length > 8) G.trail.shift();
    } else if (G.trail.length) {
      G.trail.shift();
    }
    render(dt);
  }

  /* ─────────────────────────────────────────────────────────────
     手指：畫面任何地方按下去、往後拉、放開
     ───────────────────────────────────────────────────────────── */

  function pullMax() { return clamp(Math.min(V.w, V.h) * 0.42, 110, 240); }

  function updateAim(e) {
    var A = G.aim;
    A.cx = e.clientX;
    A.cy = e.clientY;
    var dx = A.sx - A.cx, dy = A.sy - A.cy, d = Math.hypot(dx, dy);
    var meter = $('aimMeter');
    meter.hidden = false;
    if (d < DEAD) {
      A.on = false;
      meter.classList.add('is-cancel');
      $('meterPct').textContent = '放開就取消';
      return;
    }
    var w = screenToWorldDelta(dx, dy), L = Math.hypot(w[0], w[1]) || 1;
    A.on = true;
    A.dx = w[0] / L;
    A.dy = w[1] / L;
    A.power = clamp((d - DEAD) / (pullMax() - DEAD), 0.02, 1);
    meter.classList.remove('is-cancel');
    $('meterFill').style.transform = 'scaleX(' + A.power + ')';
    $('meterPct').textContent = Math.round(A.power * 100) + '%';
  }

  function cancelAim() {
    G.aim = null;
    $('aimMeter').hidden = true;
  }

  stage.addEventListener('pointerdown', function (e) {
    if (G.phase === 'banner') { hideBanner(); return; }
    if (!canAim() || G.aim) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    G.kb = null;
    G.aim = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, on: false, dx: 0, dy: -1, power: 0 };
    setHint(false);
    updateAim(e);
  });

  stage.addEventListener('pointermove', function (e) {
    if (!G.aim || e.pointerId !== G.aim.id) return;
    updateAim(e);
  });

  stage.addEventListener('pointerup', function (e) {
    var A = G.aim;
    if (!A || e.pointerId !== A.id) return;
    updateAim(e);
    if (A.on && canAim()) {
      takeShot(A.dx, A.dy, A.power);
      say('打出去了！第 ' + G.strokes + ' 桿。');
    } else {
      cancelAim();
      if (G.strokes === 0) setHint(true);
    }
  });

  stage.addEventListener('pointercancel', function (e) {
    if (G.aim && e.pointerId === G.aim.id) cancelAim();
  });

  /* ─────────────────────────────────────────────────────────────
     鍵盤：左右瞄準、上下力氣、空白鍵打
     ───────────────────────────────────────────────────────────── */

  document.addEventListener('keydown', function (e) {
    if (views.play.hidden || anyOpen()) return;
    if (e.key === 'Escape') { pause(); return; }
    if (G.phase === 'banner' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); hideBanner(); return; }
    if (!canAim() || G.aim) return;
    var keys = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, ' ': 1, Enter: 1 };
    if (!keys[e.key]) return;
    e.preventDefault();
    if (!G.kb) {
      var H = G.W.hole, b = G.ball;
      G.kb = { ang: Math.atan2(H.cup[1] - b.y, H.cup[0] - b.x), power: 0.5 };
      setHint(false);
      if (e.key === ' ' || e.key === 'Enter') return;
    }
    var step = e.shiftKey ? Math.PI / 180 : Math.PI / 60;
    /* 橫式畫面轉了 90 度：左右鍵還是照螢幕上看到的方向轉 */
    if (e.key === 'ArrowLeft') G.kb.ang -= step;
    if (e.key === 'ArrowRight') G.kb.ang += step;
    if (e.key === 'ArrowUp') G.kb.power = clamp(G.kb.power + 0.05, 0.05, 1);
    if (e.key === 'ArrowDown') G.kb.power = clamp(G.kb.power - 0.05, 0.05, 1);
    if (e.key === ' ' || e.key === 'Enter') {
      takeShot(Math.cos(G.kb.ang), Math.sin(G.kb.ang), G.kb.power);
      say('打出去了！第 ' + G.strokes + ' 桿。');
      return;
    }
    say('力氣 ' + Math.round(G.kb.power * 100) + '%');
  });

  /* ─────────────────────────────────────────────────────────────
     開始
     ───────────────────────────────────────────────────────────── */

  renderIntro();
  show('intro');
  track('home');
})();
