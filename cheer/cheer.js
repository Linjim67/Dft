/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 給家長的鼓勵
   內容準備中。頁面互動寫在這裡；個人資料用 Anxin.profile.load() 取得。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  /* 醫檢師送出回饋 → 轉到「打針完畢」頁 */
  Anxin.shotFinished.redirectWhenDone(p);
})();
