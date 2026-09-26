/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 02 主頁面
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var LEVEL = Anxin.LEVEL_TEXT;

  /* ── 1. 個人資訊簡介 ── */

  $('briefTitle').textContent = p.nickname + '的小檔案';
  $('codeDigits').textContent = p.code;
  $('codeExpiry').textContent = Anxin.formatExpiry(p.expiresAt);

  function row(term, detail, stacked) {
    return '<div class="summary-row' + (stacked ? ' is-stacked' : '') + '">' +
      '<dt>' + term + '</dt><dd>' + esc(detail) + '</dd></div>';
  }

  var html =
    row('年紀', Anxin.ageLabel(p.age)) +
    row('性別', p.gender === '男' ? '男孩' : '女孩') +
    row('對抽血的害怕', LEVEL[p.fearLevel] + '（' + p.fearLevel + ' / 5）') +
    row('家長的擔心', LEVEL[p.worryLevel] + '（' + p.worryLevel + ' / 5）');
  if (p.specialNeeds) html += row('特別注意', p.specialNeeds, true);
  $('summaryCard').innerHTML = html;

  /* ── 重新填寫：先確認 ── */

  var restart = Anxin.wireDialog($('restartDlg'));
  $('restartBtn').addEventListener('click', restart.open);
  $('restartConfirm').addEventListener('click', function () {
    Anxin.profile.clear();
    window.location.replace('/');
  });
})();
