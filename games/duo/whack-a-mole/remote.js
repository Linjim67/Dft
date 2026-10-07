/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 打地鼠・遙控器（家長的手機）
   - 看：孩子手機回報的 state/child（棋盤、回合、時間、分數、事件）
   - 放：手動模式下角色排好隊，家長只要點空洞 → cmds 新增一筆 place（隊伍最前面那一個）
   - 病毒：能發動時才出現「開始病毒入侵」按鈕；入侵時整條隊伍換成病毒
   - 搗蛋／幫忙：事件按鈕 → cmds 新增一筆 event
   - 模式：rooms/{代碼}.mode（我來放／自動出現）
   - 斷線：蓋一個對話框（孩子的手機沒回報、這支手機沒網路、監聽停止）
   孩子的手機才是遊戲的主人：它會再檢查一次能不能放，不行就在 ack 裡說原因。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var D = window.AnxinDuo;
  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var code = p.code;

  var duo = null;
  var room = null;
  var state = null;
  var stateSeenAt = 0;            /* 這支手機收到最新狀態的時間（判斷斷線用，不受兩支手機時鐘差影響） */
  var line = [];                  /* 排隊中的一般角色 { c, v }；病毒不排隊 */
  var placed = 0;                 /* 放了幾次：隊伍往前移時才重畫（每 500ms 的更新不會重播動畫） */
  var pending = {};               /* 洞 → { id, at, item }：已送出、還沒在孩子畫面上看到 */
  var sent = {};                  /* 指令 id → { kind, h, e, item, fromLine } */
  var cooldown = {};              /* 事件 → 可以再按的時間 */
  var lastAckId = null;

  var PENDING_MS = 4000;

  /* ── 角色圖：直接借打地鼠頁面裡的 SVG sprite（只有一份，不用複製） ── */
  if (window.fetch && window.DOMParser) {
    window.fetch('/games/whack-a-mole/')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        var sp = new window.DOMParser().parseFromString(html, 'text/html').querySelector('svg.sprite');
        if (sp) document.body.insertBefore(document.importNode(sp, true), document.body.firstChild);
      })
      .catch(function () { /* 沒有圖也能用：洞裡、隊伍裡都會寫角色名字 */ });
  }

  function art(c, v, cls) {
    return '<svg class="' + (cls || 'tile-art') + ' v-' + v + '" aria-hidden="true"><use href="#ch-' + c + '"></use></svg>';
  }

  function itemName(it) {
    return (it.v && it.v !== 'normal' ? D.COAT_NAMES[it.v] : '') + D.CHAR_NAMES[it.c];
  }

  /* ── 事件按鈕（病毒入侵不在這裡：它在排隊區旁邊，能按時才出現） ── */
  function eventButton(id) {
    var e = D.EVENTS[id];
    return '<button type="button" class="event-btn is-' + e.kind + '" data-event="' + id + '">' +
      '<span class="ev-name">' + esc(e.name) + '</span><span class="ev-note" id="evNote-' + id + '"></span></button>';
  }
  var gridIds = Object.keys(D.EVENTS).filter(function (k) { return D.EVENTS[k].kind !== 'virus'; });
  $('trickEvents').innerHTML = gridIds.filter(function (k) { return D.EVENTS[k].kind === 'trick'; }).map(eventButton).join('');
  $('helpEvents').innerHTML = gridIds.filter(function (k) { return D.EVENTS[k].kind === 'help'; }).map(eventButton).join('');

  /* ── 提示訊息（孩子的手機說不行的時候） ── */
  var toastTimer = null;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { t.hidden = true; }, 2600);
  }

  function stale() { return !!state && Date.now() - stateSeenAt > D.STALE_MS; }
  function canPlay() { return !!state && !stale() && state.view === 'play' && state.running && !state.teach; }
  function manual() { return !room || room.mode === 'manual'; }
  function round() { return (state && state.round) || 1; }
  function invading() { return canPlay() && !!state.inv; }
  function ending() { return invading() && D.invasionEnding(state); } /* 入侵最後階段：不能再放 */

  /* 事件現在能不能按，不能的話寫原因（不只把按鈕變灰） */
  function eventBlock(id, now) {
    if (cooldown[id] > now) return '再等 ' + Math.ceil((cooldown[id] - now) / 1000) + ' 秒';
    if (!canPlay()) return '遊戲中才能按';
    if (id === 'invasion') {
      if (round() < D.CHAR_FROM.virus) return '第 ' + D.CHAR_FROM.virus + ' 回合起才有病毒';
      if (state.inv) return '進行中';
      if (state.boss) return '大魔王在場';
      if (state.time < 7) return '這回合時間不夠了';
    }
    if (id === 'boss') {
      if (state.boss) return '進行中';
      if (state.inv) return '病毒入侵中';
      if (state.time < 8) return '時間不夠了';
    }
    if (id === 'quake' && state.quake) return '進行中';
    if (id === 'bubbles' && state.bubbles) return '進行中';
    if (id === 'double' && state.dbl) return '進行中';
    return '';
  }

  /* ── 排隊：現在看得到的隊伍（入侵時整條換成病毒，原本的隊伍留著，入侵完接著用） ── */
  function shownLine() {
    if (invading()) {
      var v = [];
      for (var i = 0; i < D.LINE_LEN; i++) v.push({ c: 'virus', v: 'normal' });
      return v;
    }
    line = D.refillLine(line, round());
    return line.slice(0, D.LINE_LEN);
  }

  /* 點洞時要放的那一個（從隊伍拿走；病毒入侵時是病毒） */
  function takeNext() {
    if (invading()) return { item: { c: 'virus', v: 'normal' }, fromLine: false };
    line = D.refillLine(line, round());
    return { item: line.shift(), fromLine: true };
  }

  /* 孩子的手機說不行（或沒送出去）：放回隊伍最前面，不會白白少一個 */
  function giveBack(meta) {
    if (meta && meta.kind === 'place' && meta.fromLine) line.unshift(meta.item);
  }

  var lineKey = '';
  function renderLine() {
    var items = shownLine();
    var key = placed + '|' + items.map(function (it) { return it.c + '.' + it.v; }).join(',');
    if (key !== lineKey) {
      lineKey = key;
      $('line').innerHTML = items.map(function (it, i) {
        var coat = it.v !== 'normal' ? '<span class="line-coat is-' + it.v + '">' + esc(D.COAT_NAMES[it.v]) + '</span>' : '';
        return '<li class="line-item' + (i === 0 ? ' is-now' : '') + (it.c === 'virus' ? ' is-virus' : '') + '">' +
          (i === 0 ? '<span class="line-kicker">下一個</span>' : '') +
          art(it.c, it.v, 'line-art') +
          '<span class="line-name">' + esc(D.CHAR_NAMES[it.c]) + '</span>' + coat + '</li>';
      }).join('');
    }
    var hint;
    if (!canPlay()) hint = '孩子開始玩之後，點一個空洞就會放「' + itemName(items[0]) + '」。';
    else if (ending()) hint = '病毒入侵快結束了：等孩子把剩下的病毒消滅光。';
    else if (invading()) hint = '病毒入侵中，隊伍換成病毒：點空洞放病毒。';
    else hint = '點一個空洞，就放「' + itemName(items[0]) + '」。';
    if ($('lineHint').textContent !== hint) $('lineHint').textContent = hint;
  }

  /* ── 病毒入侵：能發動才出現按鈕；不能的時候同一個位置寫原因（按鈕出現時棋盤不會跳） ── */
  function setText(id, text) { if ($(id).textContent !== text) $(id).textContent = text; }

  function renderStorm() {
    var now = Date.now();
    var why = eventBlock('invasion', now);
    var active = invading();
    $('stormBtn').hidden = !!why || active;
    $('stormWait').hidden = !why && !active;
    $('storm').classList.toggle('is-active', active);
    if (active && ending()) {
      setText('stormWaitName', '病毒入侵快結束了');
      setText('stormWaitNote', '不會再有新病毒，孩子把剩下的消滅光就結束');
    } else if (active) {
      setText('stormWaitName', '病毒入侵中・還有 ' + state.inv + ' 秒');
      setText('stormWaitNote', manual() ? '病毒會自己冒出來，你也可以點空洞放' : '病毒會自己冒出來');
    } else if (why) {
      setText('stormWaitName', '病毒還沒準備好');
      setText('stormWaitNote', why);
    } else {
      setText('stormNote', manual() ? '7 秒只出現病毒，你也可以點空洞放' : '7 秒只出現病毒');
    }
  }

  function holeLabel(i, h, next) {
    var base = '第 ' + (i + 1) + ' 個洞';
    if (!h || !h.o) return base + '：維修中';
    if (h.c) return base + '：' + itemName({ c: h.c, v: h.v }) + (h.b ? '（泡泡蓋住）' : '');
    if (manual() && canPlay() && !ending()) return base + '：空的，點一下放「' + itemName(next) + '」';
    return base + '：空的';
  }

  /* 六個洞的按鈕只建立一次，之後只更新內容：重畫整個棋盤會讓剛好落在重畫時的點擊消失 */
  var tiles = [];
  for (var t = 0; t < 6; t++) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.i = t;
    btn.className = 'tile';
    $('mirror').appendChild(btn);
    tiles.push({ el: btn, key: '' });
  }

  function renderMirror() {
    var holes = state && state.holes && state.holes.length ? state.holes : [];
    var now = Date.now();
    var placing = manual() && canPlay() && !ending();
    var next = shownLine()[0];
    for (var i = 0; i < 6; i++) {
      var h = holes[i];
      var pend = pending[i] && now - pending[i].at < PENDING_MS ? pending[i] : null;
      if (pending[i] && !pend) delete pending[i];
      if (h && h.c && pend) { delete pending[i]; pend = null; } /* 孩子畫面上出現了 */
      var cls = 'tile' + (!h || !h.o ? ' is-locked' : '') + (h && h.c ? ' is-up' : '') + (h && h.b ? ' has-bubble' : '') +
        (pend ? ' is-pending' : '') + (placing && h && h.o && !h.c ? ' can-place' : '');
      var inner = '<span class="tile-pit" aria-hidden="true"></span>';
      if (!h || !h.o) {
        inner += '<span class="tile-lock" aria-hidden="true">' + (h ? '維修中' : '') + '</span>';
      } else if (h.c) {
        inner += art(h.c, h.v || 'normal') + '<span class="tile-name">' + esc(D.CHAR_NAMES[h.c]) + '</span>';
        if (h.p < 100 || h.v === 'iron' || h.v === 'boss' || h.c === 'virus') {
          inner += '<span class="tile-hp" aria-hidden="true"><span style="width:' + Math.max(0, Math.min(100, h.p)) + '%"></span></span>';
        }
      } else if (pend) {
        /* 剛點的：先看到半透明的角色，孩子畫面上出現了就變實心 */
        inner += art(pend.item.c, pend.item.v, 'tile-art is-ghost') + '<span class="tile-name">放置中…</span>';
      } else if (placing) {
        inner += '<span class="tile-plus" aria-hidden="true">＋</span>';
      }
      if (h && h.b) inner += '<span class="tile-bubble" aria-hidden="true"></span>';
      inner += '<span class="tile-key" aria-hidden="true">' + (i + 1) + '</span>';
      var tile = tiles[i];
      if (tile.el.className !== cls) tile.el.className = cls;
      var label = holeLabel(i, h, next);
      if (tile.el.getAttribute('aria-label') !== label) tile.el.setAttribute('aria-label', label);
      if (tile.key !== inner) { tile.key = inner; tile.el.innerHTML = inner; }
    }
    $('mirror').classList.toggle('is-quake', !!(state && state.quake));
    $('mirror').classList.toggle('is-invasion', !!(state && state.inv));
  }

  function renderHud() {
    var st = failure ? { tone: 'error', text: failure.title }
      : dead ? { tone: 'error', text: '連線中斷了' } : D.childStatus(state, stale());
    $('duoStatusText').textContent = st.text;
    $('duoStatus').className = 'duo-status is-' + st.tone;
    var playingView = state && (state.view === 'play' || state.view === 'summary');
    $('rRound').textContent = playingView ? (state.round <= 6 ? '第 ' + state.round + ' / 6 回合' : '無限模式・第 ' + state.round + ' 回合') : '—';
    $('rTime').textContent = state && state.view === 'play' ? state.time : '—';
    $('rScore').textContent = state ? Number(state.score || 0).toLocaleString('zh-TW') : '0';
    var chips = [];
    if (state && state.mult > 1) chips.push(['mult', '連擊 ×' + state.mult]);
    if (state && state.dbl) chips.push(['help', '雙倍分數']);
    if (state && state.boss) chips.push(['trick', '大魔王']);
    if (state && state.quake) chips.push(['trick', '地震']);
    if (state && state.bubbles) chips.push(['trick', '泡泡 ' + state.bubbles + ' 個']);
    $('rChips').innerHTML = chips.map(function (c) { return '<span class="rh-chip is-' + c[0] + '">' + esc(c[1]) + '</span>'; }).join('');
    $('rChips').hidden = !chips.length;
  }

  function renderEvents() {
    var now = Date.now();
    gridIds.forEach(function (id) {
      var b = document.querySelector('.event-btn[data-event="' + id + '"]');
      var why = eventBlock(id, now);
      b.disabled = !!why;
      b.setAttribute('aria-label', D.EVENTS[id].name + '：' + (why || D.EVENTS[id].hint));
      $('evNote-' + id).textContent = why || D.EVENTS[id].hint;
    });
  }

  /* ── 斷線對話框 ──
     fail：一開始就連不上 · dead：監聽停止（Firestore 不會自己恢復）· offline：這支手機沒網路
     stale：孩子的手機超過 STALE_MS 沒回報。後兩種恢復時對話框自己關掉；
     家長按「繼續等」關掉的，同一種情況不會一直跳出來，恢復後再斷才會。 */
  var failure = null;
  var dead = false;
  var lostShown = null;
  var lostDismissed = null;
  var lostDlg = Anxin.wireDialog($('lostDlg'));
  var LOST = {
    dead: { title: '連線中斷了', body: '和孩子的手機斷線了。重新整理這一頁，就會再連上。', action: '重新整理' },
    offline: { title: '這支手機沒有網路', body: '連上網路後，這個視窗會自己關掉，遊戲可以接著玩。', action: '繼續等' },
    stale: { title: '孩子的手機好像斷線了', body: '請看看孩子的手機是不是還開著打地鼠、螢幕有沒有關掉。連回來之後，這個視窗會自己關掉。', action: '繼續等' }
  };

  function lostKind() {
    if (failure) return 'fail';
    if (dead) return 'dead';
    if (navigator.onLine === false) return 'offline';
    if (stale()) return 'stale';
    return null;
  }

  function mustReload(k) { return k === 'fail' || k === 'dead'; }

  function renderLost() {
    var k = lostKind();
    var dlg = $('lostDlg');
    if (!k) {
      lostDismissed = null;
      lostShown = null;
      if (dlg.hasAttribute('open')) dlg.close();
      return;
    }
    if (k === lostDismissed) return;
    if (k !== lostShown) {
      lostShown = k;
      var m = k === 'fail' ? { title: failure.title, body: failure.body, action: '重新整理' } : LOST[k];
      $('lostTitle').textContent = m.title;
      $('lostBody').textContent = m.body;
      $('lostAction').textContent = m.action;
    }
    if (!dlg.hasAttribute('open')) lostDlg.open();
  }

  $('lostAction').addEventListener('click', function () {
    if (mustReload(lostShown)) { window.location.reload(); return; }
    lostDismissed = lostShown;
    lostDlg.close();
  });
  $('lostDlg').addEventListener('cancel', function (ev) {
    if (mustReload(lostShown)) { ev.preventDefault(); return; } /* 不能用 Esc 關掉：關了也連不回來 */
    lostDismissed = lostShown;
  });
  window.addEventListener('offline', function () { render(); });
  window.addEventListener('online', function () { render(); });
  /* 螢幕關掉時這支手機收不到狀態：回來時先等一輪，不要一打開就跳「斷線了」 */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state) { stateSeenAt = Date.now(); render(); }
  });

  function render() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (input) {
      input.checked = !!room && input.value === room.mode;
    });
    $('modeHint').textContent = manual()
      ? '角色照隊伍的順序，只出現在你點的洞。病毒入侵時也會自己冒出病毒。'
      : '角色會像單機版一樣自己跑出來；你還是可以發動病毒、按下面的搗蛋和幫忙。';
    $('placeSection').hidden = !manual();
    renderHud();
    renderLine();
    renderStorm();
    renderMirror();
    renderEvents();
    renderLost();
  }

  function send(cmd, meta) {
    if (!duo) return null;
    var r = duo.sendCmd(code, cmd);
    sent[r.id] = meta;
    r.done.catch(function () {
      delete sent[r.id];
      if (meta.kind === 'place') { delete pending[meta.h]; giveBack(meta); placed++; }
      if (meta.kind === 'event') cooldown[meta.e] = 0;
      toast('網路不太穩，沒有送出去，請再按一次');
      render();
    });
    return r.id;
  }

  $('mirror').addEventListener('click', function (ev) {
    var b = ev.target.closest('.tile');
    if (!b) return;
    var i = Number(b.dataset.i);
    var h = state && state.holes && state.holes[i];
    if (!manual()) { toast(D.reasonText('auto')); return; }
    if (!canPlay()) { toast(D.reasonText('not-playing')); return; }
    if (!h || !h.o) { toast(D.reasonText('locked')); return; }
    if (h.c || pending[i]) { toast(D.reasonText('busy')); return; }
    if (state.boss) { toast(D.reasonText('boss')); return; }
    if (ending()) { toast(D.reasonText('inv-ending')); return; }
    if (!duo) return;
    var next = takeNext();
    var meta = { kind: 'place', h: i, item: next.item, fromLine: next.fromLine };
    var id = send({ t: 'place', h: i, c: next.item.c, v: next.item.v }, meta);
    pending[i] = { id: id, at: Date.now(), item: next.item };
    placed++;
    render();
  });

  function trigger(e) {
    if (eventBlock(e, Date.now())) return;
    if (send({ t: 'event', e: e }, { kind: 'event', e: e })) cooldown[e] = Date.now() + D.EVENTS[e].cooldownMs;
    render();
  }

  function onEventClick(ev) {
    var b = ev.target.closest('.event-btn');
    if (b && !b.disabled) trigger(b.dataset.event);
  }
  $('trickEvents').addEventListener('click', onEventClick);
  $('helpEvents').addEventListener('click', onEventClick);
  $('stormBtn').addEventListener('click', function () { trigger('invasion'); });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (input) {
    input.addEventListener('change', function () {
      if (!duo || !room || room.mode === input.value) return;
      duo.updateRoom(code, { mode: input.value }).catch(function () {
        toast('網路不太穩，沒有切換成功');
        render();
      });
    });
  });

  function onState(s) {
    /* 這組代碼以前有別的家庭用過：房間重建了，上一個孩子最後的畫面還留在 state/child。
       比這個房間還舊的畫面當作還沒收到，不會把昨天的棋盤和分數秀出來 */
    if (s && s.at && room && room.createdAt && s.at < room.createdAt) s = null;
    state = s;
    stateSeenAt = Date.now();
    var ack = s && s.ack;
    if (ack && ack.id && ack.id !== lastAckId) {
      lastAckId = ack.id;
      var meta = sent[ack.id];
      if (meta) {
        delete sent[ack.id];
        if (meta.kind === 'place') delete pending[meta.h];
        if (!ack.ok) {
          if (meta.kind === 'event') cooldown[meta.e] = 0; /* 沒成功就不用冷卻 */
          if (meta.kind === 'place') { giveBack(meta); placed++; }
          toast(D.reasonText(ack.why));
        }
      }
    }
    render();
  }

  var leaving = false;
  function onRoom(r) {
    if (leaving) return;
    room = r;
    if (!r || !D.roomUsable(r) || !r.childUid || r.game !== 'whack-a-mole') {
      leaving = true;
      window.location.replace('/games/duo/'); /* 解除配對或結束遊戲：回配對頁 */
      return;
    }
    render();
  }

  render();
  window.setInterval(render, 500); /* 冷卻倒數、斷線偵測 */

  Anxin.whenFirebase(15000)
    .then(function (fb) {
      duo = fb.duo;
      return duo.uid();
    })
    .then(function (uid) {
      return duo.getRoom(code).then(function (r) {
        if (!r || r.parentUid !== uid) { window.location.replace('/games/duo/'); return; }
        onRoom(r);
        var lost = function (err) {
          console.error('雙機：監聽停止', err);
          dead = true;
          render();
        };
        duo.watchRoom(code, onRoom, lost);
        duo.watchState(code, onState, lost);
      });
    })
    .catch(function (err) {
      console.error('雙機：連線失敗', err);
      failure = D.failureText(err);
      render();
    });
})();
