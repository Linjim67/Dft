/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 醫護端（/pro/）
   1. 登入：密碼在手機上用 PBKDF2 變成金鑰，只上傳金鑰；伺服器規則比對雜湊
   2. 查詢：家長的 4 位數暫時代碼 → 孩子的資料（不含暱稱）
   3. 回饋：家長估的害怕程度 vs 醫檢師實際觀察；送出 = 代碼失效
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var live = $('liveRegion');

  /* 要和 firestore.rules 的 validStaffSession 一致（鹽、次數、長度、期限上限 13 小時） */
  var KEY_SALT = 'anxin-staff-v1';
  var KEY_ITERATIONS = 600000;
  var SESSION_MS = 12 * 60 * 60 * 1000;
  var NET_TIMEOUT_MS = 15000;

  var fb = null;

  function firebase() {
    return Anxin.whenFirebase(10000).then(function (f) { fb = f; return f; });
  }

  function net(promise) {
    return Anxin.withTimeout(promise, NET_TIMEOUT_MS);
  }

  /* ─────────────────────────────────────────────────────────────
     畫面切換
     ───────────────────────────────────────────────────────────── */

  function show(view) {
    $('bootView').hidden = true;
    $('loginView').hidden = view !== 'login';
    $('lookupView').hidden = view !== 'lookup';
    $('signOutBtn').hidden = view !== 'lookup';
  }

  /* ─────────────────────────────────────────────────────────────
     1. 登入
     ───────────────────────────────────────────────────────────── */

  function toHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  /* Web Crypto 只在 https（或 localhost）可用；正式網站在 Vercel 上一定是 https */
  function deriveKey(password) {
    var enc = new TextEncoder();
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(Object.assign(new Error('no webcrypto'), { code: 'anxin/no-crypto' }));
    return subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return subtle.deriveBits({
          name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(KEY_SALT), iterations: KEY_ITERATIONS
        }, base, 256);
      })
      .then(toHex);
  }

  var loginForm = $('loginForm');
  var pwd = $('staffPwd');
  var pwdError = $('pwd-error');
  var loginBtn = $('loginBtn');
  var signingIn = false;

  function setSigningIn(on) {
    signingIn = on;
    loginBtn.disabled = on;
    loginBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    $('loginLabel').textContent = on ? '確認中…' : '登入';
  }

  function showPwdError(msg) {
    pwdError.textContent = msg;
    pwdError.hidden = false;
    pwd.setAttribute('aria-invalid', 'true');
  }

  function clearPwdError() {
    pwdError.hidden = true;
    pwdError.textContent = '';
    pwd.removeAttribute('aria-invalid');
  }

  pwd.addEventListener('input', clearPwdError);

  loginForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (signingIn) return;
    clearPwdError();

    if (!pwd.value) {
      showPwdError('請輸入團隊密碼。');
      pwd.focus();
      return;
    }

    setSigningIn(true);
    var password = pwd.value;

    net(Promise.all([deriveKey(password), firebase()]).then(function (r) {
      return r[1].staff.signIn(r[0], Date.now() + SESSION_MS);
    })).then(function () {
      pwd.value = '';
      setSigningIn(false);
      enterLookup();
    }, function (err) {
      setSigningIn(false);
      /* 規則拒絕＝金鑰的雜湊對不上＝密碼錯（匿名登入沒開會是 auth/ 開頭的錯誤） */
      if (err && err.code === 'permission-denied') {
        showPwdError('密碼不正確，請再試一次。');
        pwd.select();
      } else if (err && err.code === 'anxin/no-crypto') {
        showPwdError('這個瀏覽器不支援加密登入，請改用 Chrome 或 Safari 的最新版本。');
      } else if (Anxin.isSetupError(err)) {
        showPwdError('登入服務還沒設定好（不是網路的問題），請聯絡團隊。');
      } else {
        window.console.error('登入失敗：', err);
        showPwdError('連不上伺服器，請確認網路後再試一次。');
      }
      pwd.focus();
    });
  });

  /* 登入逾時（12 小時到了）或被登出：回登入畫面並說明 */
  function backToLogin(msg) {
    resetCase();
    show('login');
    if (msg) showPwdError(msg);
    $('loginTitle').focus();
  }

  $('signOutBtn').addEventListener('click', function () {
    var done = function () { backToLogin(); Anxin.announce(live, '已登出'); };
    if (!fb) { done(); return; }
    net(fb.staff.signOut()).then(done, done);
  });

  /* ─────────────────────────────────────────────────────────────
     2. 查詢代碼
     ───────────────────────────────────────────────────────────── */

  var codeInput = $('codeInput');
  var codeError = $('code-error');
  var lookupForm = $('lookupForm');
  var current = null;   /* { code, lock, profile } */
  var lookupSeq = 0;    /* 只處理最後一次查詢的結果（打字很快時，舊的回應晚到會被丟掉） */

  function enterLookup() {
    show('lookup');
    resetCase();
    codeInput.value = '';
    codeInput.focus();
  }

  function resetCase() {
    current = null;
    $('caseView').hidden = true;
    $('doneView').hidden = true;
    $('resultNote').hidden = true;
    codeError.hidden = true;
    codeInput.removeAttribute('aria-invalid');
  }

  function note(title, body, isError) {
    $('resultTitle').textContent = title;
    $('resultBody').textContent = body;
    $('resultNote').classList.toggle('is-error', !!isError);
    $('resultNote').hidden = false;
    Anxin.announce(live, title);
  }

  /* 只留數字，滿 4 碼就自動查 */
  codeInput.addEventListener('input', function () {
    var digits = codeInput.value.replace(/\D/g, '').slice(0, 4);
    if (digits !== codeInput.value) codeInput.value = digits;
    codeError.hidden = true;
    codeInput.removeAttribute('aria-invalid');
    if (digits.length === 4 && (!current || current.code !== digits)) lookup(digits);
  });

  lookupForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var digits = codeInput.value.replace(/\D/g, '');
    if (!/^\d{4}$/.test(digits)) {
      codeError.textContent = '代碼是 4 位數字。';
      codeError.hidden = false;
      codeInput.setAttribute('aria-invalid', 'true');
      codeInput.focus();
      return;
    }
    lookup(digits);
  });

  var STATE_TEXT = {
    missing: ['查無這組代碼', '請再核對一次家長手機主頁面上的 4 位數字。'],
    done: ['這組代碼已經結束了', '已經有醫檢師送出這位孩子的回饋，代碼隨即失效。'],
    expired: ['這組代碼已經過期', '代碼只在家長填寫後 24 小時內有效，請家長重新填寫一次。']
  };

  function lookup(code) {
    var seq = ++lookupSeq;
    resetCase();
    $('lookupBtn').setAttribute('aria-busy', 'true');
    Anxin.announce(live, '查詢中');

    var lock;
    net(firebase().then(function (f) { return f.codes.getLock(code); })).then(function (l) {
      lock = l;
      var state = Anxin.codes.state(lock, Date.now());
      if (state !== 'active') return { state: state };
      return net(fb.codes.getProfile(code)).then(function (p) {
        return { state: p ? 'active' : 'missing', profile: p };
      });
    }).then(function (r) {
      if (seq !== lookupSeq) return;
      $('lookupBtn').removeAttribute('aria-busy');
      if (r.state !== 'active') {
        note(STATE_TEXT[r.state][0], STATE_TEXT[r.state][1]);
        return;
      }
      current = { code: code, lock: lock, profile: r.profile };
      renderCase();
    }, function (err) {
      if (seq !== lookupSeq) return;
      $('lookupBtn').removeAttribute('aria-busy');
      lookupFailed(err);
    });
  }

  /* 讀個人資料被拒：通常是登入過期（規則要求有效的 staff 文件） */
  function lookupFailed(err) {
    if (err && err.code === 'permission-denied') {
      fb.staff.session().then(function (s) {
        if (!s || s.expiresAt <= Date.now()) backToLogin('登入已經超過 12 小時，請重新輸入密碼。');
        else note('沒有權限讀取', '代碼可能剛好在這時失效了，請再查一次。', true);
      }, function () {
        note('連不上伺服器', '請確認網路後再查一次。', true);
      });
      return;
    }
    window.console.error('查詢失敗：', err);
    note('連不上伺服器', '請確認網路後再查一次。', true);
  }

  /* ─────────────────────────────────────────────────────────────
     查到了：孩子的資料
     ───────────────────────────────────────────────────────────── */

  function row(term, detail, cls) {
    return '<div class="summary-row' + (cls ? ' ' + cls : '') + '">' +
      '<dt>' + term + '</dt><dd>' + esc(detail) + '</dd></div>';
  }

  var staffForm = $('staffForm');
  var staffErrors = Anxin.createFormErrors({
    form: staffForm,
    summary: $('errorSummary'),
    list: $('errorList'),
    fields: { staffFear: { label: '孩子實際的害怕程度' } }
  });

  var CHECK_SVG = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M6 12.4 10.2 16.6 18 8.8"/></svg>';

  function renderCase() {
    var p = current.profile;
    var fear = Anxin.FEAR_CAPTIONS[p.fearLevel - 1];

    $('caseCode').textContent = current.code;
    $('caseExpiry').textContent = Anxin.formatExpiry(current.lock.expiresAt);

    var html =
      row('年紀', Anxin.ageLabel(p.age)) +
      row('性別', p.gender === '男' ? '男孩' : '女孩') +
      row('家長估的害怕程度', fear + '（' + p.fearLevel + ' / 5）') +
      row('家長自己的擔心', Anxin.WORRY_CAPTIONS[p.worryLevel - 1] + '（' + p.worryLevel + ' / 5）');
    html += p.specialNeeds
      ? row('特別注意', p.specialNeeds, 'is-stacked is-alert')
      : row('特別注意', '家長沒有填寫');
    $('caseSummary').innerHTML = html;

    /* 題目：先說家長的評估，再問醫檢師的觀察 */
    $('fearQuestion').textContent = '家長覺得孩子「' + fear + '」，您實際觀察到的呢？';

    var host = $('staffScale');
    Anxin.buildFaceScale(host, Anxin.FEAR_CAPTIONS, {
      onChange: function () {
        /* 只有這一題必填：選了之後總覽就完全過時了，一起收掉 */
        staffErrors.clearError('staffFear');
        $('errorSummary').hidden = true;
        Anxin.setAnswered(host, true);
      }
    });
    Array.prototype.forEach.call(host.querySelectorAll('.face-option'), function (opt, i) {
      opt.insertAdjacentHTML('beforeend', '<span class="staff-check">' + CHECK_SVG + '</span>');
      if (i + 1 === p.fearLevel) {
        opt.classList.add('is-parent');
        /* 「家長」放進 label 裡：報讀時會唸成「蠻害怕 家長」，不只靠淡色底 */
        opt.insertAdjacentHTML('beforeend', '<span class="parent-tag">家長</span>');
      }
    });

    Anxin.setAnswered(host, false);
    $('staffNote').value = '';
    $('note-count').textContent = '還可以輸入 500 字';
    Anxin.setAnswered($('staffNote'), false);
    staffErrors.clearAll();
    $('errorSummary').hidden = true;
    $('finish-error').hidden = true;

    $('caseView').hidden = false;
    Anxin.announce(live, '找到代碼 ' + current.code + '，' + Anxin.ageLabel(p.age) +
      (p.gender === '男' ? '男孩' : '女孩') + '，家長覺得孩子' + fear);
  }

  $('staffNote').addEventListener('input', function () {
    var ta = $('staffNote');
    $('note-count').textContent = '還可以輸入 ' + (500 - ta.value.length) + ' 字';
    Anxin.setAnswered(ta, ta.value.trim());
  });

  /* ─────────────────────────────────────────────────────────────
     3. 送出回饋 → 代碼失效
     ───────────────────────────────────────────────────────────── */

  var finishBtn = $('finishBtn');
  var finishError = $('finish-error');
  var finishing = false;

  function setFinishing(on) {
    finishing = on;
    finishBtn.disabled = on;
    finishBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    $('finishLabel').textContent = on ? '送出中…' : '送出，結束這組代碼';
  }

  function showFinishError(msg) {
    finishError.textContent = msg;
    finishError.hidden = false;
    Anxin.announce(live, msg);
  }

  staffForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (finishing || !current) return;

    staffErrors.clearAll();
    finishError.hidden = true;
    var picked = staffForm.querySelector('[name="staffFear"]:checked');
    if (!picked) {
      staffErrors.setError('staffFear', '請選一個最接近您觀察的程度。');
      staffErrors.showSummary([{ key: 'staffFear', msg: '請選一個最接近您觀察的程度。' }]);
      Anxin.announce(live, '還有 1 個地方需要補上');
      return;
    }
    $('errorSummary').hidden = true;

    var c = current;
    var payload = Anxin.buildStaffFeedback(c.profile, { staffFear: picked.value, note: $('staffNote').value });

    setFinishing(true);
    net(fb.codes.finish(c.code, c.lock, payload)).then(function () {
      setFinishing(false);
      current = null;
      $('caseView').hidden = true;
      $('doneCode').textContent = c.code;
      $('doneView').hidden = false;
      codeInput.value = '';
      $('doneTitle').focus();
      Anxin.announce(live, '已送出，代碼 ' + c.code + ' 已失效');
    }, function (err) {
      setFinishing(false);
      if (err && err.code === 'permission-denied') {
        /* 可能是登入過期，也可能是別的醫檢師剛好先送出了：重新查一次就知道 */
        net(fb.codes.getLock(c.code)).then(function (lock) {
          var state = Anxin.codes.state(lock, Date.now());
          if (state === 'done') {
            showFinishError('這組代碼剛剛已經有人送出回饋了，不用再送一次。');
          } else {
            return fb.staff.session().then(function (s) {
              if (!s || s.expiresAt <= Date.now()) backToLogin('登入已經超過 12 小時，請重新輸入密碼後再送一次。');
              else showFinishError('沒辦法送出：代碼可能已經過期。請重新查詢一次。');
            });
          }
        }).catch(function () {
          showFinishError('連不上伺服器，您選的答案都還在。請確認網路後再按一次。');
        });
        return;
      }
      window.console.error('送出失敗：', err);
      showFinishError('連不上伺服器，您選的答案都還在。請確認網路後再按一次。');
    });
  });

  $('nextBtn').addEventListener('click', function () {
    resetCase();
    codeInput.focus();
  });

  /* ─────────────────────────────────────────────────────────────
     開頁：這支手機 12 小時內登入過，就直接進查詢畫面
     ───────────────────────────────────────────────────────────── */

  net(firebase().then(function (f) { return f.staff.session(); })).then(function (s) {
    if (s && s.expiresAt > Date.now()) enterLookup();
    else show('login');
  }, function () {
    show('login');
  });
})();
