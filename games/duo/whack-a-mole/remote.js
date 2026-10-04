/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 打地鼠・遙控器（家長的手機）
   - 看：孩子手機回報的 state/child（棋盤、回合、時間、分數、事件）
   - 放：手動模式選角色＋鍍層，點空洞 → cmds 新增一筆 place
   - 搗蛋／幫忙：事件按鈕 → cmds 新增一筆 event
   - 模式：rooms/{代碼}.mode（我來放／自動出現）
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
  var sel = { c: 'syringe', v: 'normal' };
  var beforeInvasion = null;      /* 病毒入侵時自動換成病毒，結束後換回來 */
  var pending = {};               /* 洞 → { id, at }：已送出、還沒在孩子畫面上看到 */
  var sent = {};                  /* 指令 id → { kind, h, e } */
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
      .catch(function () { /* 沒有圖也能用：洞裡會寫角色名字 */ });
  }

  function art(c, v, cls) {
    return '<svg class="' + (cls || 'tile-art') + ' v-' + v + '" aria-hidden="true"><use href="#ch-' + c + '"></use></svg>';
  }

  /* ── 調色盤：角色＋鍍層（單選；原生 radio，鍵盤也能用） ── */
  $('palette').innerHTML = D.PLACEABLE.map(function (c) {
    return '<label class="pal-option"><input type="radio" name="char" value="' + c + '"' + (c === sel.c ? ' checked' : '') + '>' +
      '<span class="pal-face">' + art(c, 'normal', 'pal-art') + '<span class="pal-name">' + esc(D.CHAR_NAMES[c]) + '</span>' +
      '<span class="pal-note"></span></span></label>';
  }).join('');
  $('coats').innerHTML = D.COATS.map(function (v) {
    return '<label class="segmented-option"><input type="radio" name="coat" value="' + v + '"' + (v === sel.v ? ' checked' : '') + '>' +
      '<span class="segmented-face">' + esc(D.COAT_NAMES[v]) + '</span></label>';
  }).join('');

  $('palette').addEventListener('change', function (ev) {
    if (ev.target.name === 'char') { sel.c = ev.target.value; beforeInvasion = null; render(); }
  });
  $('coats').addEventListener('change', function (ev) {
    if (ev.target.name === 'coat') { sel.v = ev.target.value; render(); }
  });

  /* ── 事件按鈕 ── */
  function eventButton(id) {
    var e = D.EVENTS[id];
    return '<button type="button" class="event-btn is-' + e.kind + '" data-event="' + id + '">' +
      '<span class="ev-name">' + esc(e.name) + '</span><span class="ev-note" id="evNote-' + id + '"></span></button>';
  }
  var ids = Object.keys(D.EVENTS);
  $('trickEvents').innerHTML = ids.filter(function (k) { return D.EVENTS[k].kind === 'trick'; }).map(eventButton).join('');
  $('helpEvents').innerHTML = ids.filter(function (k) { return D.EVENTS[k].kind === 'help'; }).map(eventButton).join('');

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

  /* 事件現在能不能按，不能的話寫原因（不只把按鈕變灰） */
  function eventBlock(id, now) {
    if (cooldown[id] > now) return '再等 ' + Math.ceil((cooldown[id] - now) / 1000) + ' 秒';
    if (!canPlay()) return '遊戲中才能按';
    if (id === 'invasion') {
      if (state.inv) return '進行中';
      if (state.boss) return '大魔王在場';
      if (state.time < 7) return '時間不夠了';
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

  function holeLabel(i, h) {
    var base = '第 ' + (i + 1) + ' 個洞';
    if (!h || !h.o) return base + '：維修中';
    if (h.c) return base + '：' + (h.v && h.v !== 'normal' ? D.COAT_NAMES[h.v] : '') + D.CHAR_NAMES[h.c] + (h.b ? '（泡泡蓋住）' : '');
    if (room && room.mode === 'manual') return base + '：空的，點一下放「' + D.COAT_NAMES[sel.v] + D.CHAR_NAMES[sel.c] + '」';
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
    var manual = room && room.mode === 'manual';
    for (var i = 0; i < 6; i++) {
      var h = holes[i];
      var pend = pending[i] && now - pending[i].at < PENDING_MS ? pending[i] : null;
      if (pending[i] && !pend) delete pending[i];
      if (h && h.c && pend) { delete pending[i]; pend = null; } /* 孩子畫面上出現了 */
      var cls = 'tile' + (!h || !h.o ? ' is-locked' : '') + (h && h.c ? ' is-up' : '') + (h && h.b ? ' has-bubble' : '') +
        (pend ? ' is-pending' : '') + (manual && canPlay() && h && h.o && !h.c ? ' can-place' : '');
      var inner = '<span class="tile-pit" aria-hidden="true"></span>';
      if (!h || !h.o) {
        inner += '<span class="tile-lock" aria-hidden="true">' + (h ? '維修中' : '') + '</span>';
      } else if (h.c) {
        inner += art(h.c, h.v || 'normal') + '<span class="tile-name">' + esc(D.CHAR_NAMES[h.c]) + '</span>';
        if (h.p < 100 || h.v === 'iron' || h.v === 'boss' || h.c === 'virus') {
          inner += '<span class="tile-hp" aria-hidden="true"><span style="width:' + Math.max(0, Math.min(100, h.p)) + '%"></span></span>';
        }
      } else if (pend) {
        inner += '<span class="tile-plus" aria-hidden="true">放置中…</span>';
      } else if (manual && canPlay()) {
        inner += '<span class="tile-plus" aria-hidden="true">＋</span>';
      }
      if (h && h.b) inner += '<span class="tile-bubble" aria-hidden="true"></span>';
      inner += '<span class="tile-key" aria-hidden="true">' + (i + 1) + '</span>';
      var tile = tiles[i];
      if (tile.el.className !== cls) tile.el.className = cls;
      var label = holeLabel(i, h);
      if (tile.el.getAttribute('aria-label') !== label) tile.el.setAttribute('aria-label', label);
      if (tile.key !== inner) { tile.key = inner; tile.el.innerHTML = inner; }
    }
    $('mirror').classList.toggle('is-quake', !!(state && state.quake));
    $('mirror').classList.toggle('is-invasion', !!(state && state.inv));
  }

  function renderHud() {
    var st = D.childStatus(state, stale());
    $('duoStatusText').textContent = st.text;
    $('duoStatus').className = 'duo-status is-' + st.tone;
    var playingView = state && (state.view === 'play' || state.view === 'summary');
    $('rRound').textContent = playingView ? (state.round <= 6 ? '第 ' + state.round + ' / 6 回合' : '無限模式・第 ' + state.round + ' 回合') : '—';
    $('rTime').textContent = state && state.view === 'play' ? state.time : '—';
    $('rScore').textContent = state ? Number(state.score || 0).toLocaleString('zh-TW') : '0';
    var chips = [];
    if (state && state.mult > 1) chips.push(['mult', '連擊 ×' + state.mult]);
    if (state && state.dbl) chips.push(['help', '雙倍分數']);
    if (state && state.inv) chips.push(['trick', '病毒入侵 ' + state.inv + ' 秒']);
    if (state && state.boss) chips.push(['trick', '大魔王']);
    if (state && state.quake) chips.push(['trick', '地震']);
    if (state && state.bubbles) chips.push(['trick', '泡泡 ' + state.bubbles + ' 個']);
    $('rChips').innerHTML = chips.map(function (c) { return '<span class="rh-chip is-' + c[0] + '">' + esc(c[1]) + '</span>'; }).join('');
    $('rChips').hidden = !chips.length;
  }

  function renderPalette() {
    var inv = !!(state && state.inv);
    /* 病毒只能在入侵時放；入侵時只能放病毒 → 自動幫家長切換 */
    if (inv && sel.c !== 'virus') { beforeInvasion = sel.c; sel.c = 'virus'; }
    if (!inv && sel.c === 'virus' && beforeInvasion) { sel.c = beforeInvasion; beforeInvasion = null; }
    Array.prototype.forEach.call($('palette').querySelectorAll('input'), function (input) {
      var c = input.value;
      var allowed = inv ? c === 'virus' : c !== 'virus';
      input.checked = c === sel.c;
      input.disabled = !allowed;
      input.closest('.pal-option').querySelector('.pal-note').textContent =
        c === 'virus' && !inv ? '入侵時' : (inv && c !== 'virus' ? '入侵中不行' : '');
    });
    Array.prototype.forEach.call($('coats').querySelectorAll('input'), function (input) {
      input.checked = input.value === sel.v;
    });
  }

  function renderEvents() {
    var now = Date.now();
    ids.forEach(function (id) {
      var b = document.querySelector('.event-btn[data-event="' + id + '"]');
      var why = eventBlock(id, now);
      b.disabled = !!why;
      b.setAttribute('aria-label', D.EVENTS[id].name + '：' + (why || D.EVENTS[id].hint));
      $('evNote-' + id).textContent = why || D.EVENTS[id].hint;
    });
  }

  function render() {
    var manual = !room || room.mode === 'manual';
    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (input) {
      input.checked = !!room && input.value === room.mode;
    });
    $('modeHint').textContent = manual
      ? '角色只會出現在你點的洞。病毒入侵時會自己冒出病毒。'
      : '角色會像單機版一樣自己跑出來；你還是可以按下面的搗蛋、幫忙。';
    $('placeSection').hidden = !manual;
    renderHud();
    renderPalette();
    renderMirror();
    renderEvents();
  }

  function send(cmd, meta) {
    if (!duo) return null;
    var r = duo.sendCmd(code, cmd);
    sent[r.id] = meta;
    r.done.catch(function () {
      delete sent[r.id];
      if (meta.kind === 'place') delete pending[meta.h];
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
    if (!room || room.mode !== 'manual') { toast(D.reasonText('auto')); return; }
    if (!canPlay()) { toast(D.reasonText('not-playing')); return; }
    if (!h || !h.o) { toast(D.reasonText('locked')); return; }
    if (h.c || pending[i]) { toast(D.reasonText('busy')); return; }
    if (state.boss) { toast(D.reasonText('boss')); return; }
    var id = send({ t: 'place', h: i, c: sel.c, v: sel.v }, { kind: 'place', h: i });
    if (id) pending[i] = { id: id, at: Date.now() };
    render();
  });

  function onEventClick(ev) {
    var b = ev.target.closest('.event-btn');
    if (!b || b.disabled) return;
    var e = b.dataset.event;
    if (send({ t: 'event', e: e }, { kind: 'event', e: e })) cooldown[e] = Date.now() + D.EVENTS[e].cooldownMs;
    render();
  }
  $('trickEvents').addEventListener('click', onEventClick);
  $('helpEvents').addEventListener('click', onEventClick);

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
        var lost = function (err) { console.error('雙機：監聽停止', err); toast(D.LISTEN_LOST); };
        duo.watchRoom(code, onRoom, lost);
        duo.watchState(code, onState, lost);
      });
    })
    .catch(function (err) {
      console.error('雙機：連線失敗', err);
      var f = D.failureText(err);
      $('duoStatusText').textContent = f.title + '。' + f.body;
      $('duoStatus').className = 'duo-status is-error';
    });
})();
