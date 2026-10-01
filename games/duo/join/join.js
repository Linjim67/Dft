/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 一起玩（孩子的手機：遊戲選單）
   網址 /games/1234/（Vercel 改寫到這一頁；本機可用 ?code=1234）。
   1. 加入房間：把這支手機的匿名 uid 寫進 childUid（規則只允許空位時寫入自己）
   2. 孩子點遊戲 → 提出 request；家長答應後自動打開 /games/1234/打地鼠
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var D = window.AnxinDuo;
  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var code = D.codeFromLocation(window.location);
  var duo = null;
  var uid = null;
  var waitDlg = Anxin.wireDialog($('waitDlg'));
  var asked = null;     /* 這一頁送出的 request（家長答應時才自動跳轉；回到選單時不會被拉回遊戲） */
  var lastRejectAt = null;

  function status(text, tone) {
    $('duoStatusText').textContent = text;
    $('duoStatus').className = 'duo-status' + (tone ? ' is-' + tone : '');
  }

  function showError(title, body) {
    $('errorTitle').textContent = title;
    $('errorBody').textContent = body;
    $('errorCard').hidden = false;
    $('gameList').hidden = true;
    if ($('waitDlg').hasAttribute('open')) $('waitDlg').close();
    status('沒辦法連線', 'error');
  }

  var ICON = {
    'whack-a-mole': '<ellipse cx="12" cy="18" rx="8" ry="3" /><path d="M7.5 17.5V11a4.5 4.5 0 0 1 9 0v6.5" /><path d="M10.3 11h.01M13.7 11h.01" />',
    'draw-circle': '<circle cx="12" cy="12" r="7.5" />',
    jump: '<path d="M4 19h16M7 19v-4h4v4M14 19v-7h4v7" /><path d="M8 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />'
  };

  function renderGames(room) {
    var playing = room && room.game;
    $('gameList').innerHTML = D.GAMES.map(function (g) {
      var icon = '<span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" class="icon">' + ICON[g.id] + '</svg></span>';
      var text = '<span><span class="card-title">' + esc(g.name) + '</span><span class="card-desc">' + esc(g.desc) + '</span></span>';
      if (!g.ready) {
        return '<div class="nav-card is-soon" aria-disabled="true">' + icon + text + '<span class="soon-badge">即將推出</span></div>';
      }
      /* 爸爸媽媽已經答應過：直接回去玩 */
      if (playing === g.id) {
        return '<a class="nav-card is-current" href="' + D.gamePath(code, g.id) + '">' + icon + text +
          '<span class="go-badge">繼續玩</span></a>';
      }
      return '<button type="button" class="nav-card" data-game="' + g.id + '">' + icon + text +
        '<svg viewBox="0 0 24 24" class="icon card-chevron" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>';
    }).join('');
    $('gameList').hidden = false;
  }

  $('gameList').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-game]');
    if (!b || !duo) return;
    var g = D.gameById(b.dataset.game);
    asked = g.id;
    $('waitGame').textContent = '「' + g.name + '」';
    waitDlg.open();
    duo.updateRoom(code, { request: { game: g.id, status: 'pending' } }).catch(function () {
      asked = null;
      $('waitDlg').close();
      status('網路不太穩，請再點一次', 'error');
    });
  });

  function onRoom(room) {
    if (!room || !D.roomUsable(room)) {
      showError('這次的連線已經結束了', '請爸爸媽媽重新打開「雙機」，再掃一次 QR code。');
      return;
    }
    if (room.childUid !== uid) {
      showError('爸爸媽媽重新配對了', '請用這支手機再掃一次爸爸媽媽手機上的 QR code。');
      return;
    }
    $('errorCard').hidden = true;
    status('已連上爸爸媽媽的手機', 'ok');
    var req = room.request;
    /* 這一頁問的遊戲被答應了 → 直接開始 */
    if (asked && room.game === asked && req && req.status === 'accepted') {
      window.location.assign(D.gamePath(code, asked));
      return;
    }
    if (asked && req && req.status === 'rejected' && req.at !== lastRejectAt) {
      lastRejectAt = req.at;
      asked = null;
      if ($('waitDlg').hasAttribute('open')) $('waitDlg').close();
      status('爸爸媽媽說：等一下喔！可以再選一次。', 'warn');
    }
    renderGames(room);
  }

  if (!code) {
    showError('找不到配對代碼', '請用手機掃描爸爸媽媽手機上的 QR code。');
    return;
  }

  Anxin.whenFirebase(15000)
    .then(function (fb) {
      duo = fb.duo;
      return duo.uid();
    })
    .then(function (id) {
      uid = id;
      return duo.getRoom(code);
    })
    .then(function (room) {
      if (!room || !D.roomUsable(room)) throw new Error('missing');
      var role = D.roleOf(room, uid);
      if (role === 'parent') throw new Error('parent');
      if (role === 'taken') throw new Error('taken');
      if (role === 'free') return duo.updateRoom(code, { childUid: uid });
      return null;
    })
    .then(function () {
      duo.watchRoom(code, onRoom, function () { status('網路不太穩，正在重新連線…', 'warn'); });
    })
    .catch(function (err) {
      var m = err && err.message;
      if (m === 'missing') showError('找不到這個連線', '可能過期了。請爸爸媽媽重新打開「雙機」，再掃一次 QR code。');
      else if (m === 'parent') showError('這是爸爸媽媽的手機', '請用孩子的手機掃描 QR code，兩支手機才能一起玩。');
      else if (m === 'taken') showError('已經有另一支手機連線了', '請爸爸媽媽在他們的手機上按「重新配對」。');
      else showError('連不上網路', '請確認這支手機有網路，再重新整理一次。');
    });
})();
