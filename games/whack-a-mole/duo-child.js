/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 打地鼠・雙機（孩子的手機）
   網址 /games/1234/whack-a-mole/（Vercel 改寫到同一個打地鼠頁面）。
   1. 確認這支手機就是房間裡的孩子（沒加入就回選單加入）
   2. 用房間裡的年齡、代碼開始遊戲（這支手機沒有個人資料）
   3. 收家長的指令（放角色、事件）與模式 → 交給遊戲；把結果回報給家長
   4. 把棋盤狀態寫回去給家長的遙控器看（節流：Firestore 單一文件每秒約 1 次）
   單機網址（沒有代碼）時什麼都不做。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var D = window.AnxinDuo;
  var code = D && D.codeFromLocation(window.location);
  if (!code) return;

  var $ = function (id) { return document.getElementById(id); };
  var menuPath = D.joinPath(code);

  /* ── 畫面調整：孩子的手機沒有個人資料，不能去「開始打針」或主頁 ── */
  var back = document.querySelector('.topbar .back-link');
  if (back) {
    back.setAttribute('href', menuPath);
    var label = back.querySelector('span');
    if (label) label.textContent = '遊戲選單';
  }
  var pill = document.querySelector('.topbar .pill-cta');
  if (pill) pill.hidden = true;
  var links = document.querySelector('#pauseDlg .dlg-links');
  if (links) links.innerHTML = '<a class="quiet-link" href="' + menuPath + '">回遊戲選單</a>';
  var lede = document.querySelector('#introView .page-lede');
  if (lede) lede.textContent = '和爸爸媽媽一起玩！爸爸媽媽會放角色給你敲，也會偷偷搗蛋喔。';

  var banner = document.createElement('p');
  banner.className = 'duo-banner';
  banner.id = 'duoBanner';
  banner.setAttribute('role', 'status');
  banner.textContent = '正在連線爸爸媽媽的手機…';
  var head = document.querySelector('#introView .page-head');
  if (head) head.insertAdjacentElement('afterend', banner);

  var startBtn = $('startBtn');
  startBtn.disabled = true; /* 連上之前還不能開始 */

  function say(text, tone) {
    banner.textContent = text;
    banner.className = 'duo-banner' + (tone ? ' is-' + tone : '');
  }

  function modeText(mode) {
    return mode === 'auto' ? '已連線・角色會自己跑出來' : '已連線・爸爸媽媽會幫你放角色';
  }

  /* ── 連線中斷／結束：蓋一個對話框，帶孩子回選單 ── */
  var endDlg = null;
  function stopWith(text) {
    if (game) game.freeze();
    if (!endDlg) {
      endDlg = document.createElement('dialog');
      endDlg.className = 'dlg';
      endDlg.id = 'duoEndDlg';
      endDlg.setAttribute('aria-labelledby', 'duoEndTitle');
      endDlg.innerHTML = '<h2 class="dlg-title" id="duoEndTitle"></h2>' +
        '<div class="dlg-actions"><a class="btn btn-primary" href="' + menuPath + '">回遊戲選單</a></div>';
      document.body.appendChild(endDlg);
    }
    endDlg.querySelector('#duoEndTitle').textContent = text;
    if (!endDlg.hasAttribute('open')) endDlg.showModal();
  }

  var game = null;
  var duo = null;
  var uid = null;
  var lastAck = null;

  /* ── 狀態回報：有變化就寫，但最快每 STATE_THROTTLE_MS 一次（最後一次一定會寫出去） ── */
  var lastWrite = 0;
  var timer = null;
  var inflight = false;
  var dirty = false;

  function schedule() {
    dirty = true;
    if (timer || inflight) return;
    timer = window.setTimeout(flush, Math.max(0, lastWrite + D.STATE_THROTTLE_MS - Date.now()));
  }

  function flush() {
    timer = null;
    if (!dirty || !game || !duo) return;
    dirty = false;
    inflight = true;
    lastWrite = Date.now();
    var s = game.snapshot();
    s.ack = lastAck;
    duo.setState(code, s).then(done, function () {
      say('網路不太穩，爸爸媽媽可能看不到最新的畫面', 'warn');
      done();
    });
    function done() {
      inflight = false;
      if (dirty) schedule();
    }
  }

  function onCmd(cmd) {
    if (!game) return;
    var r = D.validCmd(cmd) ? game.command(cmd) : { ok: false, why: 'bad' };
    lastAck = { id: cmd.id, ok: r.ok, why: r.why };
    schedule();
  }

  function onRoom(room) {
    if (!room || !D.roomUsable(room)) { stopWith('這次的雙機連線已經結束了'); return; }
    if (room.childUid !== uid) { stopWith('爸爸媽媽重新配對了，請再掃一次 QR code'); return; }
    if (room.game !== 'whack-a-mole') { stopWith('爸爸媽媽結束了打地鼠，要不要換一個遊戲？'); return; }
    if (game) game.setMode(room.mode);
    say(modeText(room.mode), 'ok');
  }

  function fail(text) {
    say(text, 'error');
    startBtn.disabled = true;
  }

  /* Firebase 的 module 只有雙機才載入（單機不需要，省流量） */
  var mod = document.createElement('script');
  mod.type = 'module';
  mod.src = '/shared/firebase.js';
  document.head.appendChild(mod);

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
      if (!room || !D.roomUsable(room)) {
        fail('找不到這個連線（可能過期了）。請爸爸媽媽重新打開「雙機」，再掃一次 QR code。');
        return;
      }
      var role = D.roleOf(room, uid);
      if (role === 'free') { window.location.replace(menuPath); return; } /* 還沒加入：回選單加入 */
      if (role === 'parent') { fail('這是爸爸媽媽的手機。請用孩子的手機掃描 QR code。'); return; }
      if (role === 'taken') { fail('已經有另一支手機連線了。請爸爸媽媽按「重新配對」。'); return; }
      if (room.game !== 'whack-a-mole') { window.location.replace(menuPath); return; } /* 爸爸媽媽還沒答應 */

      game = window.WhackGame.boot({ age: room.age, code: code }, { mode: room.mode, onChange: schedule });
      startBtn.disabled = false;
      say(modeText(room.mode), 'ok');
      duo.watchRoom(code, onRoom, function () { say('網路不太穩，正在重新連線…', 'warn'); });
      duo.watchCmds(code, onCmd, function () { say('網路不太穩，正在重新連線…', 'warn'); });
      window.setInterval(schedule, D.HEARTBEAT_MS); /* 畫面沒變也定時回報：家長才知道還連著 */
      schedule();
    })
    .catch(function () {
      fail('連不上網路。請確認孩子的手機有網路，再重新整理一次。');
    });
})();
