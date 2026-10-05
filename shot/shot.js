/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 03 開始打針
   醫檢師送出回饋（代碼變 done）時，畫面自動換成「打針完畢」，接著寫回饋。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var $ = function (id) { return document.getElementById(id); };
  var html = document.documentElement;

  $('shotCodeDigits').textContent = p.code;
  $('finishedName').textContent = p.nickname;

  /* ── 家長自己按「打針完畢」 ── */

  var dlgEl = $('doneDlg');
  var dlg = Anxin.wireDialog(dlgEl);
  $('doneBtn').addEventListener('click', dlg.open);

  /* 選了「給建議」或「離開」＝已經走過打針完畢，之後醫檢師送出時不再把家長拉回來 */
  dlgEl.addEventListener('click', function (ev) {
    if (ev.target.closest('a')) Anxin.shotFinished.mark(p.code);
  });

  /* ── 醫檢師送出 → 打針完畢 ── */

  function showFinished() {
    Anxin.shotFinished.mark(p.code);
    if (dlgEl.open) dlgEl.close();
    html.classList.add('is-finished');
    /* 重新整理還是停在打針完畢 */
    if (!/[?&]done=1(&|$)/.test(window.location.search)) {
      try { window.history.replaceState(null, '', Anxin.shotFinished.URL); } catch (e) { /* 忽略 */ }
    }
    document.title = '安心陪伴 · 打針完畢';
    $('finishedTitle').focus();
  }

  if (html.classList.contains('is-finished')) {
    showFinished();
    return;
  }

  /* 連不上就只顯示代碼，「打針完畢」鈕照常可用 */
  Anxin.shotFinished.watch(p, showFinished);
})();
