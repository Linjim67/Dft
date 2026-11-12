/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 02 主頁面
   最上面是暫時代碼（右下角的筆 = 修改資料，/portal/?edit）；下面是四個四分之一圓的功能按鈕。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  /* iPhone Safari 要有 touchstart 監聽，:active 才會套用（按下時那一塊按鈕的反應） */
  document.addEventListener('touchstart', function () {}, { passive: true });

  var $ = function (id) { return document.getElementById(id); };

  /* ── 1. 暫時代碼 ── */

  /* 不顯示有效日期 */
  $('codeDigits').textContent = p.code;

  /* ── 代碼失效：醫檢師送出回饋後，這組代碼就查不到了 ──
     讀不到（離線、Firebase 載不到）就維持原樣；代碼卡只是提示，不擋任何功能。
     同時比對領取人：理論上代碼過期前不會發給別人，多一道保險。 */

  Anxin.whenFirebase(10000).then(function (fb) {
    return Promise.all([fb.codes.getLock(p.code), fb.ensureAuth()]);
  }).then(function (r) {
    var lock = r[0];
    if (!lock || lock.holderUid !== r[1].uid || lock.status !== 'done') return;
    $('codeCard').classList.add('is-done');
    $('codeNote').textContent = '醫檢師已完成紀錄，這組代碼已經失效';
  }).catch(function () { /* 維持原樣 */ });

  /* ── 醫檢師送出回饋 → 轉到「打針完畢」頁（每組代碼一次） ── */

  Anxin.shotFinished.redirectWhenDone(p);
})();
