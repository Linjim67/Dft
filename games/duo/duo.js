/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 小遊戲・雙機（家長的手機：配對）
   1. 用個人資料的 4 位數代碼建立房間 rooms/{代碼}（只放年齡，不放暱稱）
   2. 顯示 QR code → 孩子的手機掃描後打開 /games/{代碼}/，加入房間
   3. 孩子選遊戲 → 這裡答應或拒絕；答應後打開遙控器
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var D = window.AnxinDuo;
  var $ = function (id) { return document.getElementById(id); };
  var code = p.code;
  var joinUrl = window.location.origin + D.joinPath(code);
  var duo = null;
  var room = null;

  $('joinCode').textContent = code;
  $('joinUrl').textContent = window.location.host + D.joinPath(code);

  /* QR code：載不到就只留網址與代碼 */
  window.AnxinQR.load().then(function (qrcode) {
    $('qrBox').innerHTML = window.AnxinQR.svg(qrcode, joinUrl);
  }, function () {
    $('qrBox').hidden = true;
  });

  /* 分享：手機有分享選單就用（LINE、AirDrop…），否則複製連結 */
  $('shareBtn').addEventListener('click', function () {
    var btn = this;
    if (navigator.share) {
      navigator.share({ title: '安心陪伴・一起玩', url: joinUrl }).catch(function () { /* 取消分享 */ });
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl).then(function () {
        btn.textContent = '已複製連結';
        window.setTimeout(function () { btn.textContent = '分享連結給孩子的手機'; }, 2000);
      });
    }
  });

  function status(text, tone) {
    $('duoStatusText').textContent = text;
    $('duoStatus').className = 'duo-status' + (tone ? ' is-' + tone : '');
  }

  function showError(title, body) {
    $('errorTitle').textContent = title;
    $('errorBody').textContent = body;
    $('errorCard').hidden = false;
    ['pairCard', 'requestCard', 'playingCard', 'waitingCard'].forEach(function (id) { $(id).hidden = true; });
    $('unpairBtn').hidden = true;
    status('沒辦法連線', 'error');
  }

  function render(r) {
    room = r;
    if (!r) { showError('連線中斷了', '請重新整理這一頁。'); return; }
    var joined = !!r.childUid;
    var req = r.request && r.request.status === 'pending' ? r.request : null;
    var game = r.game ? D.gameById(r.game) : null;

    status(joined ? '孩子的手機已連線' : '等孩子的手機掃描…', joined ? 'ok' : 'wait');
    $('pairCard').hidden = joined;
    $('unpairBtn').hidden = !joined;
    $('requestCard').hidden = !req;
    $('playingCard').hidden = !game || !!req;
    $('waitingCard').hidden = !joined || !!req || !!game;
    if (req) $('requestTitle').textContent = '「' + (D.gameById(req.game) || { name: req.game }).name + '」';
    if (game) {
      $('playingTitle').textContent = game.name;
      $('remoteLink').setAttribute('href', '/games/duo/' + game.id + '/');
    }
  }

  function act(patch, then) {
    if (!duo) return;
    duo.updateRoom(code, patch).then(then || function () {}, function () {
      status('網路不太穩，請再按一次', 'error');
    });
  }

  $('acceptBtn').addEventListener('click', function () {
    var g = room && room.request && room.request.game;
    if (!g) return;
    act({ request: { game: g, status: 'accepted' }, game: g }, function () {
      window.location.assign('/games/duo/' + g + '/');
    });
  });

  $('rejectBtn').addEventListener('click', function () {
    var g = room && room.request && room.request.game;
    if (g) act({ request: { game: g, status: 'rejected' } });
  });

  $('endGameBtn').addEventListener('click', function () { act({ game: null, request: null }); });
  $('unpairBtn').addEventListener('click', function () { act({ childUid: null, game: null, request: null }); });

  Anxin.whenFirebase(15000)
    .then(function (fb) {
      duo = fb.duo;
      return duo.uid();
    })
    .then(function (uid) {
      return duo.getRoom(code).then(function (existing) {
        if (existing && D.roomUsable(existing) && existing.parentUid !== uid) {
          /* 同一組代碼正在被另一個家庭使用（4 位數偶爾會重複） */
          throw new Error('taken');
        }
        if (!existing || !D.roomUsable(existing)) return duo.createRoom(code, D.newRoom(p, uid));
        return null;
      });
    })
    .then(function () {
      duo.watchRoom(code, render, function (err) {
        console.error('雙機：房間監聽停止', err);
        status(D.LISTEN_LOST, 'error');
      });
    })
    .catch(function (err) {
      if (err && err.message === 'taken') {
        showError('這組代碼正在被使用', '請回主頁按「重新填寫」，拿一組新的代碼再試一次。');
      } else {
        console.error('雙機：建立房間失敗', err);
        var f = D.failureText(err);
        showError(f.title, f.body);
      }
    });
})();
