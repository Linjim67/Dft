/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 01 個人資訊
   單次使用、不需註冊。資料只存在本機，24 小時後失效。
   共用邏輯（個人資料、表情量表、表單錯誤）在 /shared/app.js。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var form = $('infoForm');
  var live = $('liveRegion');

  /* ─────────────────────────────────────────────────────────────
     驗證：行內錯誤 + 可聚焦的錯誤總覽（兩者並存）
     ───────────────────────────────────────────────────────────── */

  var errors = Anxin.createFormErrors({
    form: form,
    summary: $('errorSummary'),
    list: $('errorList'),
    fields: {
      nickname: { label: '孩子的暱稱', focus: 'nickname', invalid: 'nickname' },
      age: { label: '孩子的年紀', focus: 'ageIndex' },
      gender: { label: '孩子的性別' },
      fearLevel: { label: '孩子會害怕抽血嗎' },
      worryLevel: { label: '您自己會擔心嗎' }
    }
  });

  /* ─────────────────────────────────────────────────────────────
     年紀：36 格線性刻度
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

  var ageInput = $('ageIndex');
  var ageOut = $('ageOut');
  var ageIdx = 12;
  /* 使用者是否已經碰過滑桿。沒碰過就不填色，
     否則軌道會暗示一個家長沒有選過的值。 */
  var ageTouched = false;

  function paintFill() {
    var ratio = (ageIdx - AGE_MIN_IDX) / (AGE_MAX_IDX - AGE_MIN_IDX);
    /* 軌道已選區段填成橘色（--fill 由 CSS 的 linear-gradient 取用） */
    ageInput.style.setProperty(
      '--fill', ageTouched ? (ratio * 100).toFixed(2) + '%' : '0%');
  }

  /* 題目那一行的 output 即時同步滑桿。
     input（拖曳中）與 change（放開）都走同一條路徑，兩者必定一致。 */
  function updateAge() {
    ageTouched = true;
    var snapped = snapIndex(Number(ageInput.value), ageIdx);
    if (snapped !== Number(ageInput.value)) ageInput.value = snapped;
    ageIdx = snapped;

    var label = Anxin.ageLabel(indexToAge(snapped));
    ageOut.textContent = label;
    ageOut.removeAttribute('data-empty');
    ageInput.setAttribute('aria-valuetext', label);

    Anxin.setAnswered(ageInput, true);
    errors.clearError('age');
    paintFill();
  }

  ageInput.addEventListener('input', updateAge);
  ageInput.addEventListener('change', updateAge);

  /* ─────────────────────────────────────────────────────────────
     1–5 表情量表
     ───────────────────────────────────────────────────────────── */

  function scale(hostId, key, captions) {
    var host = $(hostId);
    Anxin.buildFaceScale(host, captions, {
      onChange: function () {
        errors.clearError(key);
        Anxin.setAnswered(host, true);
      }
    });
  }

  scale('fearScale', 'fearLevel', Anxin.FEAR_CAPTIONS);
  scale('worryScale', 'worryLevel', Anxin.WORRY_CAPTIONS);

  /* ─────────────────────────────────────────────────────────────
     字數提示與作答狀態
     ───────────────────────────────────────────────────────────── */

  var needs = $('specialNeeds');
  var needsCount = $('needs-count');
  var NEEDS_MAX = 200;

  needs.addEventListener('input', function () {
    needsCount.textContent = '還可以輸入 ' + (NEEDS_MAX - needs.value.length) + ' 字';
    Anxin.setAnswered(needs, needs.value.trim());
  });

  $('nickname').addEventListener('input', function () {
    Anxin.setAnswered($('nickname'), $('nickname').value.trim());
  });

  $('nickname').addEventListener('blur', function () {
    if ($('nickname').value.trim()) errors.clearError('nickname');
  });

  form.addEventListener('change', function (ev) {
    if (ev.target.name === 'gender') {
      Anxin.setAnswered(ev.target, true);
      errors.clearError('gender');
    }
  });

  function validate() {
    var list = [];
    errors.clearAll();

    if (!$('nickname').value.trim()) {
      list.push({ key: 'nickname', msg: '請填寫孩子的暱稱，我們會用它跟孩子說話。' });
    }
    if (!ageTouched) {
      list.push({ key: 'age', msg: '請拖曳滑桿選擇孩子的年紀。' });
    }
    if (!form.querySelector('[name="gender"]:checked')) {
      list.push({ key: 'gender', msg: '請選擇孩子的性別。' });
    }
    if (!form.querySelector('[name="fearLevel"]:checked')) {
      list.push({ key: 'fearLevel', msg: '請選一個最接近的程度。' });
    }
    if (!form.querySelector('[name="worryLevel"]:checked')) {
      list.push({ key: 'worryLevel', msg: '請選一個最接近的程度。' });
    }

    list.forEach(function (e) { errors.setError(e.key, e.msg); });
    return list;
  }

  /* ─────────────────────────────────────────────────────────────
     送出 → 向伺服器領一組不重複的暫時代碼 → 存到本機 → 前往主頁面（#02）
     代碼的規則（怎麼挑、何時算空著、何時失效）在 Anxin.codes（/shared/app.js）。
     ───────────────────────────────────────────────────────────── */

  var CLAIM_TIMEOUT_MS = 15000;
  var submitBtn = $('submitBtn');
  var submitLabel = submitBtn.querySelector('.btn-label');
  var submitError = $('storage-error');
  var claiming = false;

  function setClaiming(on) {
    claiming = on;
    submitBtn.disabled = on;
    submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    submitLabel.textContent = on ? '正在產生代碼…' : '完成，開始陪伴';
  }

  function showSubmitError(msg) {
    submitError.textContent = msg;
    submitError.hidden = false;
    Anxin.announce(live, msg);
  }

  function claimErrorText(err) {
    if (err && err.code === 'anxin/no-free-code') {
      return '代碼暫時都在使用中，請過一分鐘再按一次「完成，開始陪伴」。';
    }
    if (Anxin.isSetupError(err)) {
      return '暫時代碼服務還沒準備好（是網站設定的問題，不是您的網路）。您填的內容都還在，請告訴現場的醫護人員。';
    }
    return '目前連不上伺服器，拿不到暫時代碼。您填的內容都還在，請確認網路後再按一次「完成，開始陪伴」。';
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (claiming) return;
    var list = validate();

    if (list.length) {
      errors.showSummary(list);
      Anxin.announce(live, '表單還有 ' + list.length + ' 個地方需要補上');
      return;
    }

    $('errorSummary').hidden = true;
    submitError.hidden = true;

    /* 主頁面靠本機資料運作。存不進去（封鎖儲存的無痕模式）就先別領代碼、別跳轉，
       否則主頁找不到資料會把家長彈回空白表單，剛填的全部不見。 */
    if (!Anxin.profile.canStore()) {
      showSubmitError('這個瀏覽器目前無法儲存資料，請關閉無痕模式或換個瀏覽器再試一次。');
      return;
    }

    var now = Date.now();
    var profile = {
      nickname: $('nickname').value.trim(),
      age: indexToAge(ageIdx),
      gender: form.querySelector('[name="gender"]:checked').value,
      fearLevel: Number(form.querySelector('[name="fearLevel"]:checked').value),
      worryLevel: Number(form.querySelector('[name="worryLevel"]:checked').value),
      specialNeeds: needs.value.trim(),
      createdAt: now,
      expiresAt: now + Anxin.profile.TTL_MS
    };
    /* 給醫檢師看的那份：沒有暱稱，特殊需求裡的暱稱也換成「孩子」 */
    var shared = Anxin.codes.buildProfile(profile);

    setClaiming(true);

    Anxin.withTimeout(
      Anxin.whenFirebase(10000).then(function (fb) {
        return Anxin.codes.claim(function (code) {
          return fb.codes.tryClaim(code, shared, Anxin.codes.isFree);
        });
      }),
      CLAIM_TIMEOUT_MS
    ).then(function (code) {
      profile.code = code;
      Anxin.profile.save(profile);
      if (!Anxin.profile.load()) {
        setClaiming(false);
        showSubmitError('這個瀏覽器目前無法儲存資料，請關閉無痕模式或換個瀏覽器再試一次。');
        return;
      }
      /* replace：返回鍵不會回到這張表單又被導回主頁 */
      window.location.replace('/home/');
    }, function (err) {
      window.console.error('領取暫時代碼失敗：', err);
      setClaiming(false);
      showSubmitError(claimErrorText(err));
    });
  });

  /* ─────────────────────────────────────────────────────────────
     初始化
     ───────────────────────────────────────────────────────────── */

  ageOut.setAttribute('data-empty', 'true');
  paintFill();
})();
