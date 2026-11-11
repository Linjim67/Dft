/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 02 主頁面
   最上面只放暫時代碼；下面是家長 3 格、孩子 2 格。填寫內容在「修改資料」（/portal/?edit）看、改、重新填寫。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var $ = function (id) { return document.getElementById(id); };

  /* ── 1. 暫時代碼 ── */

  $('codeDigits').textContent = p.code;
  $('codeExpiry').textContent = Anxin.formatExpiry(p.expiresAt);

  /* ── 代碼失效：醫檢師送出回饋後，這組代碼就查不到了 ──
     讀不到（離線、Firebase 載不到）就維持原樣；代碼卡只是提示，不擋任何功能。
     同時比對領取人：理論上代碼過期前不會發給別人，多一道保險。 */

  Anxin.whenFirebase(10000).then(function (fb) {
    return Promise.all([fb.codes.getLock(p.code), fb.ensureAuth()]);
  }).then(function (r) {
    var lock = r[0];
    if (!lock || lock.holderUid !== r[1].uid || lock.status !== 'done') return;
    $('codeCard').classList.add('is-done');
    $('codeExpiry').hidden = true;
    $('codeNote').textContent = '醫檢師已完成紀錄，這組代碼已經失效';
  }).catch(function () { /* 維持原樣 */ });

  /* ── 醫檢師送出回饋 → 轉到「打針完畢」頁（每組代碼一次） ── */

  Anxin.shotFinished.redirectWhenDone(p);
})();
