/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 03 開始打針
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (!Anxin.profile.load()) return; /* <head> 裡的守衛已經導回 / */

  var done = Anxin.wireDialog(document.getElementById('doneDlg'));
  document.getElementById('doneBtn').addEventListener('click', done.open);
})();
