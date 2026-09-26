/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 03 回饋
   送到 Firestore 的內容由 Anxin.buildFeedbackPayload 產生：
   白名單欄位、不含暱稱，自由文字裡的暱稱也會被換成「孩子」。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  var $ = function (id) { return document.getElementById(id); };
  var live = $('liveRegion');
  var form = $('feedbackForm');

  /* ─────────────────────────────────────────────────────────────
     同一份資料只送一次：記住已送出的暫時代碼
     ───────────────────────────────────────────────────────────── */

  var SENT_KEY = 'anxin.feedback.v1';

  function alreadySent() {
    try { return localStorage.getItem(SENT_KEY) === p.code; } catch (e) { return false; }
  }

  function markSent() {
    try { localStorage.setItem(SENT_KEY, p.code); } catch (e) { /* 忽略：最多是能再送一次 */ }
  }

  function showSent() {
    $('formView').hidden = true;
    $('sentView').hidden = false;
  }

  if (alreadySent()) {
    showSent();
    return;
  }

  /* ─────────────────────────────────────────────────────────────
     題目：平衡的五點量表（中間為「普通」），存數字 + scaleVersion
     滿意度與有效程度由負到正，表情要反過來（哭臉在左、笑臉在右）
     ───────────────────────────────────────────────────────────── */

  var SATISFACTION = ['很不滿意', '不滿意', '普通', '滿意', '非常滿意'];
  var CRY = ['很平靜', '有點緊張', '小哭一下', '哭得明顯', '大哭大鬧'];
  var EFFECTIVENESS = ['非常無效', '無效', '普通', '有效', '非常有效'];

  var errors = Anxin.createFormErrors({
    form: form,
    summary: $('errorSummary'),
    list: $('errorList'),
    fields: {
      satisfaction: { label: '對醫護人員的滿意度' },
      cryLevel: { label: '孩子的哭鬧程度' },
      effectiveness: { label: '是否有效緩解緊張' }
    }
  });

  function scale(hostId, key, captions, reverse, extra) {
    var host = $(hostId);
    Anxin.buildFaceScale(host, captions, {
      reverse: reverse,
      onChange: function (v) {
        errors.clearError(key);
        Anxin.setAnswered(host, true);
        if (extra) extra(v);
      }
    });
  }

  /* 第二題的題目帶入第一題的選擇：「選擇『滿意』的原因為何？」 */
  scale('satisfactionScale', 'satisfaction', SATISFACTION, true, function (v) {
    $('reasonLabelText').textContent = '選擇「' + SATISFACTION[v - 1] + '」的原因為何？';
  });
  scale('cryScale', 'cryLevel', CRY, false);
  scale('effectivenessScale', 'effectiveness', EFFECTIVENESS, true);

  /* ── 字數提示與作答狀態 ── */

  function counter(textareaId, countId, max) {
    var ta = $(textareaId);
    var out = $(countId);
    ta.addEventListener('input', function () {
      out.textContent = '還可以輸入 ' + (max - ta.value.length) + ' 字';
      Anxin.setAnswered(ta, ta.value.trim());
    });
  }

  counter('reason', 'reason-count', 500);
  counter('suggestion', 'suggestion-count', 1000);

  /* ─────────────────────────────────────────────────────────────
     驗證
     ───────────────────────────────────────────────────────────── */

  function checked(name) {
    var r = form.querySelector('[name="' + name + '"]:checked');
    return r ? r.value : null;
  }

  function validate() {
    var list = [];
    errors.clearAll();
    ['satisfaction', 'cryLevel', 'effectiveness'].forEach(function (key) {
      if (!checked(key)) list.push({ key: key, msg: '請選一個最接近的選項。' });
    });
    list.forEach(function (e) { errors.setError(e.key, e.msg); });
    return list;
  }

  /* ─────────────────────────────────────────────────────────────
     送出
     Firestore 的 addDoc 在離線時不會失敗，而是一直等網路；
     沒有逾時的話，按鈕會永遠停在「送出中…」。
     ───────────────────────────────────────────────────────────── */

  var SEND_TIMEOUT_MS = 15000;
  var sendBtn = $('sendBtn');
  var sendLabel = $('sendLabel');
  var sendError = $('send-error');
  var sending = false;

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(
        function (v) { window.clearTimeout(timer); resolve(v); },
        function (e) { window.clearTimeout(timer); reject(e); });
    });
  }

  function setSending(on) {
    sending = on;
    sendBtn.disabled = on;
    sendBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    sendLabel.textContent = on ? '送出中…' : '送出回饋';
  }

  function showSendError() {
    sendError.textContent = '目前連不上伺服器，您填的內容都還在。請確認網路後，再按一次「送出回饋」。';
    sendError.hidden = false;
    Anxin.announce(live, sendError.textContent);
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (sending) return;

    var list = validate();
    if (list.length) {
      errors.showSummary(list);
      Anxin.announce(live, '還有 ' + list.length + ' 個地方需要補上');
      return;
    }

    $('errorSummary').hidden = true;
    sendError.hidden = true;

    var payload = Anxin.buildFeedbackPayload(p, {
      satisfaction: checked('satisfaction'),
      satisfactionReason: $('reason').value,
      cryLevel: checked('cryLevel'),
      effectiveness: checked('effectiveness'),
      suggestion: $('suggestion').value
    });

    setSending(true);

    withTimeout(
      Anxin.whenFirebase(10000).then(function (fb) { return fb.submitFeedback(payload); }),
      SEND_TIMEOUT_MS
    ).then(function () {
      markSent();
      showSent();
      /* 對話框關閉時，瀏覽器會把焦點還給開啟它的送出鈕——但送出鈕已經
         跟著表單隱藏了，焦點會掉到 <body>。改交給「已收到」的標題。 */
      var dlg = $('sentDlg');
      dlg.addEventListener('close', function () { $('sentTitle').focus(); }, { once: true });
      Anxin.wireDialog(dlg).open();
      Anxin.announce(live, '已送出，謝謝您');
    }, function (err) {
      window.console.error('回饋送出失敗：', err);
      setSending(false);
      showSendError();
    });
  });
})();
