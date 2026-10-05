/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 感謝頁
   不強制需要個人資料（資料可能已過期）；有的話就用暱稱稱呼孩子。
   暱稱只在這支手機上顯示，不會送出。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  /* 已經結束了：醫檢師之後送出時，別再把家長拉去「打針完畢」頁 */
  if (p) Anxin.shotFinished.mark(p.code);
  if (p) {
    document.getElementById('thanksLede').textContent = '今天您和' + p.nickname + '都很勇敢。';
  }
})();
