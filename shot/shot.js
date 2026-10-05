/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 03 開始打針
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var $ = function (id) { return document.getElementById(id); };

  var done = Anxin.wireDialog($('doneDlg'));
  $('doneBtn').addEventListener('click', done.open);

  /* ── 給醫檢師的代碼 ──
     醫檢師送出回饋的那一刻，這裡即時換成「已完成」，家長就知道可以按「打針完畢」了。
     連不上就只顯示代碼，不影響按鈕。 */

  $('shotCodeDigits').textContent = p.code;

  Anxin.whenFirebase(10000).then(function (fb) {
    return fb.ensureAuth().then(function (user) {
      fb.codes.watchLock(p.code, function (lock) {
        if (!lock || lock.holderUid !== user.uid || lock.status !== 'done') return;
        $('shotCode').classList.add('is-done');
        $('shotCodeText').textContent = '醫檢師已完成紀錄';
      }, function () { /* 監聽中斷：維持原樣 */ });
    });
  }).catch(function () { /* 維持原樣 */ });
})();
