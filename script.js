/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 01 個人資訊
   單次使用、不需註冊。資料只存在本機，24 小時後失效。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORE_KEY = 'anxin.profile.v1';
  var TTL_MS = 24 * 60 * 60 * 1000;

  var $ = function (id) { return document.getElementById(id); };

  var formView = $('formView');
  var successView = $('successView');
  var form = $('infoForm');
  var live = $('liveRegion');

  /* ─────────────────────────────────────────────────────────────
     年紀：非線性刻度
     索引 0–12  → 0 至 6 歲，每格 0.5 歲
     索引 13–24 → 7 至 18 歲，每格 1 歲
     ───────────────────────────────────────────────────────────── */

  var AGE_MIN_IDX = 0;
  var AGE_MAX_IDX = 36;
  var HALF_STEP_MAX = 12;
  /* 每一格都固定等於 0.5 歲，滑桿在整條軌道上才是線性的。
     0–12 格每格可選（0–6 歲，0.5 歲一階）；
     13–36 格只有偶數可選（7–18 歲，1 歲一階），奇數格會被吸附掉。 */

  function indexToAge(i) {
    return i * 0.5;
  }

  function isSelectable(i) {
    return i <= HALF_STEP_MAX || i % 2 === 0;
  }

  /* 奇數格（>12）不可停留：依移動方向吸附到相鄰的偶數格 */
  function snapIndex(raw, prev) {
    if (isSelectable(raw)) return raw;
    var out = raw > prev ? raw + 1 : raw - 1;
    return Math.min(AGE_MAX_IDX, Math.max(AGE_MIN_IDX, out));
  }

  function ageLabel(v) {
    if (v === 0) return '未滿 6 個月';
    if (v === 0.5) return '6 個月';
    var whole = Math.floor(v);
    return whole + ' 歲' + (v % 1 === 0.5 ? '半' : '');
  }

  var ageInput = $('ageIndex');
  var ageBubble = $('ageBubble');
  var ageOut = $('ageOut');
  var ageIdx = 12;
  var ageTouched = false;
  /* engaged：使用者是否已經碰過滑桿。未碰過就不填色，
     否則軌道會暗示一個家長沒有選過的值。 */
  var ageEngaged = false;

  /* 氣泡跟著滑桿頭走：扣掉頭的寬度，端點才不會超出軌道 */
  function positionBubble() {
    var idx = Number(ageInput.value);
    var ratio = (idx - AGE_MIN_IDX) / (AGE_MAX_IDX - AGE_MIN_IDX);
    var thumb = 32;
    var usable = ageInput.offsetWidth - thumb;
    ageBubble.style.left = (thumb / 2 + ratio * usable) + 'px';
    /* 軌道已選區段填成橘色（--fill 由 CSS 的 linear-gradient 取用） */
    ageInput.style.setProperty(
      '--fill', ageEngaged ? (ratio * 100).toFixed(2) + '%' : '0%');
  }

  /* 拖曳中即時更新氣泡；放開後才把值寫進 output（「完整捲動後顯示」） */
  function paintBubble() {
    ageEngaged = true;
    var snapped = snapIndex(Number(ageInput.value), ageIdx);
    if (snapped !== Number(ageInput.value)) ageInput.value = snapped;
    ageIdx = snapped;
    var label = ageLabel(indexToAge(snapped));
    ageBubble.textContent = label;
    ageBubble.removeAttribute('data-empty');
    ageInput.setAttribute('aria-valuetext', label);
    positionBubble();
  }

  function commitAge() {
    ageTouched = true;
    setAnswered(ageInput, true);
    var label = ageLabel(indexToAge(ageIdx));
    ageOut.textContent = label;
    ageOut.removeAttribute('data-empty');
    clearError('age');
  }

  ageInput.addEventListener('input', paintBubble);
  ageInput.addEventListener('change', commitAge);
  window.addEventListener('resize', positionBubble);

  /* ─────────────────────────────────────────────────────────────
     1–5 表情量表
     圖示只是輔助，語意由文字說明承擔（不單靠顏色或圖形）
     ───────────────────────────────────────────────────────────── */

  var FACES = [
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8 13.9c1.1 2 6.9 2 8 0"/>',
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8.7 14.3c1 1.1 5.6 1.1 6.6 0"/>',
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8.7 14.8h6.6"/>',
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8.7 15.6c1-1.1 5.6-1.1 6.6 0"/>',
    '<path d="M7.7 8.5 10.1 9.6M16.3 8.5 13.9 9.6"/><path d="M9 11.2h.01M15 11.2h.01"/>' +
    '<ellipse cx="12" cy="15.6" rx="2.3" ry="1.7"/>'
  ];

  var CHECK = '<span class="face-check" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24"><path d="M5 12.6 9.6 17 19 7.4" fill="none"/></svg></span>';

  function buildScale(host, captions) {
    var name = host.dataset.name;
    var describedby = host.dataset.describedby;
    var html = '';
    for (var i = 0; i < 5; i++) {
      var v = i + 1;
      html +=
        '<label class="face-option">' +
        '<input type="radio" name="' + name + '" value="' + v + '"' +
        ' aria-required="true" aria-describedby="' + describedby + '">' +
        '<span class="face-body">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
        FACES[i] + '</svg>' +
        '<span class="face-caption">' + captions[i] + '</span>' +
        '</span>' + CHECK +
        '</label>';
    }
    host.innerHTML = html;
    host.addEventListener('change', function () {
      clearError(name);
      setAnswered(host, true);
    });
  }

  buildScale($('fearScale'), ['完全不會', '有一點', '普通', '蠻害怕', '非常害怕']);
  buildScale($('worryScale'), ['完全不會', '有一點', '普通', '蠻擔心', '非常擔心']);

  /* ─────────────────────────────────────────────────────────────
     字數提示
     ───────────────────────────────────────────────────────────── */

  var needs = $('specialNeeds');
  var needsCount = $('needs-count');
  var NEEDS_MAX = 200;

  needs.addEventListener('input', function () {
    needsCount.textContent = '還可以輸入 ' + (NEEDS_MAX - needs.value.length) + ' 字';
    setAnswered(needs, needs.value.trim());
  });

  $('nickname').addEventListener('input', function () {
    setAnswered($('nickname'), $('nickname').value.trim());
  });

  form.addEventListener('change', function (ev) {
    if (ev.target.name === 'gender') setAnswered(ev.target, true);
  });

  /* ─────────────────────────────────────────────────────────────
     驗證：行內錯誤 + 可聚焦的錯誤總覽（兩者並存）
     ───────────────────────────────────────────────────────────── */

  var errorSummary = $('errorSummary');
  var errorList = $('errorList');

  var FIELDS = {
    nickname: { label: '孩子的暱稱', focus: 'nickname' },
    age: { label: '孩子的年紀', focus: 'ageIndex' },
    gender: { label: '孩子的性別', focus: null },
    fearLevel: { label: '孩子會害怕抽血嗎', focus: null },
    worryLevel: { label: '您自己會擔心嗎', focus: null }
  };

  function setError(key, message) {
    var el = $(key + '-error');
    el.textContent = message;
    el.hidden = false;
    if (key === 'nickname') $('nickname').setAttribute('aria-invalid', 'true');
  }

  function clearError(key) {
    var el = $(key + '-error');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
    if (key === 'nickname') $('nickname').removeAttribute('aria-invalid');
  }

  function firstFocusable(key) {
    if (FIELDS[key].focus) return $(FIELDS[key].focus);
    return form.querySelector('[name="' + key + '"]');
  }

  function validate() {
    var errors = [];
    Object.keys(FIELDS).forEach(clearError);

    if (!$('nickname').value.trim()) {
      errors.push({ key: 'nickname', msg: '請填寫孩子的暱稱，我們會用它跟孩子說話。' });
    }
    if (!ageTouched) {
      errors.push({ key: 'age', msg: '請拖曳滑桿或按 +／− 選擇孩子的年紀。' });
    }
    if (!form.querySelector('[name="gender"]:checked')) {
      errors.push({ key: 'gender', msg: '請選擇孩子的性別。' });
    }
    if (!form.querySelector('[name="fearLevel"]:checked')) {
      errors.push({ key: 'fearLevel', msg: '請選一個最接近的程度。' });
    }
    if (!form.querySelector('[name="worryLevel"]:checked')) {
      errors.push({ key: 'worryLevel', msg: '請選一個最接近的程度。' });
    }

    errors.forEach(function (e) { setError(e.key, e.msg); });
    return errors;
  }

  function showSummary(errors) {
    errorList.innerHTML = errors.map(function (e) {
      return '<li><a href="#' + (FIELDS[e.key].focus || '') + '" data-key="' + e.key + '">' +
        FIELDS[e.key].label + '：' + e.msg + '</a></li>';
    }).join('');
    errorSummary.hidden = false;
    errorSummary.focus();
  }

  errorList.addEventListener('click', function (ev) {
    var link = ev.target.closest('a');
    if (!link) return;
    ev.preventDefault();
    var target = firstFocusable(link.dataset.key);
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });

  $('nickname').addEventListener('blur', function () {
    if ($('nickname').value.trim()) clearError('nickname');
  });

  /* ─────────────────────────────────────────────────────────────
     暫時代碼：djb2 雜湊取 4 位十進位，24 小時後失效
     （僅用於讓家長回到同一份資料，不具身分驗證作用）
     ───────────────────────────────────────────────────────────── */

  function makeCode(seed) {
    var h = 5381;
    for (var i = 0; i < seed.length; i++) {
      h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
    }
    return String(h % 10000).padStart(4, '0');
  }

  function save(profile) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(profile));
    } catch (e) {
      /* 無痕模式或儲存已滿：畫面照常顯示，只是重新整理後會消失 */
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      var intact = p && p.expiresAt && p.code &&
        typeof p.nickname === 'string' && p.nickname &&
        typeof p.age === 'number' &&
        p.fearLevel >= 1 && p.fearLevel <= 5 &&
        p.worryLevel >= 1 && p.worryLevel <= 5;
      /* 過期或結構不完整（舊版本、手動竄改）一律丟棄，重新填寫比顯示壞掉的摘要好 */
      if (!intact || Date.now() > p.expiresAt) {
        localStorage.removeItem(STORE_KEY);
        return null;
      }
      return p;
    } catch (e) {
      return null;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     完成畫面
     ───────────────────────────────────────────────────────────── */

  var LEVEL_TEXT = ['', '完全不會', '有一點', '普通', '蠻明顯的', '非常明顯'];

  function formatExpiry(ts) {
    var d = new Date(ts);
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return '有效至 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + hh + ':' + mm;
  }

  function row(term, detail, stacked) {
    return '<div class="summary-row' + (stacked ? ' is-stacked' : '') + '">' +
      '<dt>' + term + '</dt><dd>' + escapeHtml(detail) + '</dd></div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderSuccess(p) {
    formView.hidden = true;
    successView.hidden = false;

    $('successLede').textContent =
      '我們知道' + p.nickname + '現在的狀況了，接下來會依照這些資訊調整陪伴方式。';
    $('codeDigits').textContent = p.code;
    $('codeExpiry').textContent = formatExpiry(p.expiresAt);

    var html =
      row('暱稱', p.nickname) +
      row('年紀', ageLabel(p.age)) +
      row('性別', p.gender === '男' ? '男孩' : '女孩') +
      row('對抽血的害怕程度', LEVEL_TEXT[p.fearLevel] + '（' + p.fearLevel + ' / 5）') +
      row('家長的擔心程度', LEVEL_TEXT[p.worryLevel] + '（' + p.worryLevel + ' / 5）');
    if (p.specialNeeds) html += row('特別注意', p.specialNeeds, true);
    $('summaryCard').innerHTML = html;

    $('successHeading').focus();
  }

  /* 已作答的題目把標題調淡，讓還沒填的那題自然變成視線焦點 */
  function setAnswered(el, yes) {
    var field = el.closest('.field');
    if (field) field.classList.toggle('is-answered', !!yes);
  }

  function announce(msg) {
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 60);
  }

  /* ─────────────────────────────────────────────────────────────
     送出
     ───────────────────────────────────────────────────────────── */

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var errors = validate();

    if (errors.length) {
      showSummary(errors);
      announce('表單還有 ' + errors.length + ' 個地方需要補上');
      return;
    }

    errorSummary.hidden = true;
    var now = Date.now();
    var nickname = $('nickname').value.trim();
    var age = indexToAge(ageIdx);
    var gender = form.querySelector('[name="gender"]:checked').value;

    var profile = {
      nickname: nickname,
      age: age,
      gender: gender,
      fearLevel: Number(form.querySelector('[name="fearLevel"]:checked').value),
      worryLevel: Number(form.querySelector('[name="worryLevel"]:checked').value),
      specialNeeds: needs.value.trim(),
      code: makeCode(nickname + '|' + age + '|' + gender + '|' + now),
      createdAt: now,
      expiresAt: now + TTL_MS
    };

    save(profile);
    renderSuccess(profile);
    announce('已完成，您的暫時代碼是 ' + profile.code.split('').join(' '));
  });

  $('restartBtn').addEventListener('click', function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
    form.reset();
    ageTouched = false;
    ageIdx = 12;
    ageInput.value = ageIdx;
    ageBubble.textContent = '？';
    ageBubble.setAttribute('data-empty', 'true');
    ageOut.textContent = '尚未選擇';
    ageOut.setAttribute('data-empty', 'true');
    ageInput.removeAttribute('aria-valuetext');
    ageEngaged = false;
    needsCount.textContent = '還可以輸入 ' + NEEDS_MAX + ' 字';
    Object.keys(FIELDS).forEach(clearError);
    Array.prototype.forEach.call(
      form.querySelectorAll('.field.is-answered'),
      function (f) { f.classList.remove('is-answered'); });
    errorSummary.hidden = true;
    successView.hidden = true;
    formView.hidden = false;
    positionBubble();
    $('nickname').focus();
  });

  /* ─────────────────────────────────────────────────────────────
     初始化
     ───────────────────────────────────────────────────────────── */

  ageOut.setAttribute('data-empty', 'true');
  positionBubble();

  var saved = load();
  if (saved) renderSuccess(saved);
})();
