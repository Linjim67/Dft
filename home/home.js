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

  /* ── 重新填寫：先確認 ── */

  var restart = Anxin.wireDialog($('restartDlg'));
  $('restartBtn').addEventListener('click', restart.open);
  $('restartConfirm').addEventListener('click', function () {
    Anxin.profile.clear();
    window.location.replace('/');
  });
})();
