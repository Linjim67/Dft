/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 醫護端（/pro/）
   1. 登入：密碼在手機上用 PBKDF2 變成金鑰，只上傳金鑰；伺服器規則比對雜湊
   2. 查詢：家長的 4 位數暫時代碼 → 孩子的資料（不含暱稱）
   3. 回饋：家長估的害怕程度 vs 醫檢師實際觀察；確認後送出 = 代碼失效
   工作台分三個階段（#deskView 的 data-phase）：entry → case → done
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var live = $('liveRegion');
  var FEAR = Anxin.FEAR_CAPTIONS;
  var WORRY = Anxin.WORRY_CAPTIONS;

  /* 要和 firestore.rules 的 validStaffSession 一致（鹽、次數、長度、期限上限 13 小時） */
  var KEY_SALT = 'anxin-staff-v1';
  var KEY_ITERATIONS = 600000;
  var SESSION_MS = 12 * 60 * 60 * 1000;
  var NET_TIMEOUT_MS = 15000;

  /* 這台裝置最近完成的代碼（只有代碼、評分、時間；登出時清掉） */
  var RECENT_KEY = 'anxin.pro.recent.v1';
  var RECENT_MAX = 5;

  var fb = null;

  function firebase() {
    return Anxin.whenFirebase(10000).then(function (f) { fb = f; return f; });
  }

  function net(promise) {
    return Anxin.withTimeout(promise, NET_TIMEOUT_MS);
  }

  function hhmm(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* 觸控裝置不主動把焦點放進代碼框：萬一瀏覽器不支援 inputmode=none，系統鍵盤會蓋住數字鍵 */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ─────────────────────────────────────────────────────────────
     畫面：登入 / 工作台；工作台的階段；右邊面板顯示哪一塊
     ───────────────────────────────────────────────────────────── */

  var desk = $('deskView');

  function show(view) {
    $('bootView').hidden = true;
    $('loginView').hidden = view !== 'login';
    desk.hidden = view !== 'desk';
    $('signOutBtn').hidden = view !== 'desk';
    if (view !== 'desk') $('sessionInfo').hidden = true;
  }

  function setSession(expiresAt) {
    $('sessionInfo').textContent = '登入至 ' + hhmm(expiresAt);
    $('sessionInfo').hidden = false;
  }

  function setPhase(phase) {
    desk.dataset.phase = phase;
  }

  var PANELS = { empty: 'emptyView', loading: 'loadingView', note: 'resultNote', 'case': 'caseView', done: 'doneView' };
  var panelState = 'empty';

  function panelShow(which) {
    panelState = which;
    Object.keys(PANELS).forEach(function (k) { $(PANELS[k]).hidden = k !== which; });
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

  var pwd = $('staffPwd');
  var pwdError = $('pwd-error');
  var pwdToggle = $('pwdToggle');
  var loginBtn = $('loginBtn');
  var signingIn = false;

  /* 顯示／隱藏密碼：標籤固定，狀態用 aria-pressed 表達 */
  pwdToggle.addEventListener('click', function () {
    var reveal = pwd.type === 'password';
    pwd.type = reveal ? 'text' : 'password';
    pwdToggle.setAttribute('aria-pressed', reveal ? 'true' : 'false');
    pwd.focus();
  });

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

  $('loginForm').addEventListener('submit', function (ev) {
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
    var expiresAt = Date.now() + SESSION_MS;

    net(Promise.all([deriveKey(password), firebase()]).then(function (r) {
      return r[1].staff.signIn(r[0], expiresAt);
    })).then(function () {
      pwd.value = '';
      pwd.type = 'password';
      pwdToggle.setAttribute('aria-pressed', 'false');
      setSigningIn(false);
      enterDesk(expiresAt);
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

  /* 登入逾時（12 小時到了）或登出：回登入畫面並說明 */
  function backToLogin(msg) {
    current = null;
    show('login');
    if (msg) showPwdError(msg);
    $('loginTitle').focus();
  }

  $('signOutBtn').addEventListener('click', function () {
    try { localStorage.removeItem(RECENT_KEY); } catch (e) { /* 忽略 */ }
    var done = function () { backToLogin(); Anxin.announce(live, '已登出'); };
    if (!fb) { done(); return; }
    net(fb.staff.signOut()).then(done, done);
  });

  /* ─────────────────────────────────────────────────────────────
     2. 輸入代碼：四格 + 數字鍵（也能直接打字或貼上）
     ───────────────────────────────────────────────────────────── */

  var codeInput = $('codeInput');
  var slots = Array.prototype.slice.call(document.querySelectorAll('#slots .slot'));
  var current = null;     /* { code, lock, profile } */
  var lookupSeq = 0;      /* 只處理最後一次查詢的結果 */

  function renderSlots() {
    var v = codeInput.value;
    slots.forEach(function (s, i) {
      s.textContent = v.charAt(i);
      s.classList.toggle('is-active', i === v.length);
    });
  }

  function setCode(v) {
    codeInput.value = v;
    renderSlots();
    codeChanged();
  }

  /* 已經滿 4 位再按數字＝開始輸入下一組 */
  function pushDigit(d) {
    var v = codeInput.value;
    setCode((v.length >= 4 ? '' : v) + d);
  }

  function focusEntry() {
    if (finePointer.matches) codeInput.focus();
  }

  function codeChanged() {
    var v = codeInput.value;
    if (v.length === 4) {
      requestLookup(v);
      return;
    }
    lookupSeq++; /* 改了代碼：還在路上的查詢結果作廢 */
    if (panelState === 'note' || panelState === 'loading' || panelState === 'done') {
      panelShow('empty');
      setPhase('entry');
    }
  }

  document.querySelector('.keypad').addEventListener('click', function (ev) {
    var key = ev.target.closest('.key');
    if (!key) return;
    var k = key.dataset.key;
    if (k === 'back') setCode(codeInput.value.slice(0, -1));
    else if (k === 'clear') setCode('');
    else pushDigit(k);
  });

  codeInput.addEventListener('input', function () {
    var digits = codeInput.value.replace(/\D/g, '').slice(0, 4);
    if (digits !== codeInput.value) codeInput.value = digits;
    renderSlots();
    codeChanged();
  });

  codeInput.addEventListener('keydown', function (ev) {
    var full = codeInput.value.length >= 4 && codeInput.selectionStart === codeInput.selectionEnd;
    if (/^\d$/.test(ev.key) && full) codeInput.value = '';
    if (ev.key === 'Enter' && codeInput.value.length === 4) requestLookup(codeInput.value, true);
  });

  /* 游標永遠在最後面（格子看不到游標，中間插字會讓人搞不清楚） */
  function caretToEnd() {
    var n = codeInput.value.length;
    try { codeInput.setSelectionRange(n, n); } catch (e) { /* 忽略 */ }
  }
  codeInput.addEventListener('focus', caretToEnd);
  codeInput.addEventListener('click', caretToEnd);

  /* 焦點在數字鍵上時，實體鍵盤打的數字也收進來 */
  $('entry').addEventListener('keydown', function (ev) {
    if (ev.target === codeInput || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (/^\d$/.test(ev.key)) {
      pushDigit(ev.key);
      ev.preventDefault();
    } else if (ev.key === 'Backspace') {
      setCode(codeInput.value.slice(0, -1));
      ev.preventDefault();
    }
  });

  /* ─────────────────────────────────────────────────────────────
     查詢；換代碼時若有沒送出的回饋，先問
     ───────────────────────────────────────────────────────────── */

  var staffForm = $('staffForm');

  function hasUnsaved() {
    return !!current && panelState === 'case' &&
      !!(staffForm.querySelector('[name="staffFear"]:checked') || $('staffNote').value.trim());
  }

  var discardDlg = $('discardDlg');
  var discard = Anxin.wireDialog(discardDlg);
  var pendingCode = null;
  var discarding = false;

  function askDiscard(nextCode) {
    pendingCode = nextCode;
    discarding = false;
    $('discardCode').textContent = current.code;
    $('discardKeepCode').textContent = current.code;
    discard.open();
  }

  $('discardGo').addEventListener('click', function () {
    discarding = true;
    discard.close();
    if (pendingCode) lookup(pendingCode);
    else leaveCase();
  });

  /* 選「回到原本的代碼」（或按 Esc）：代碼框還原成正在看的那一組 */
  discardDlg.addEventListener('close', function () {
    if (discarding || !current) return;
    codeInput.value = current.code;
    renderSlots();
    setPhase('case');
  });

  function requestLookup(code, force) {
    if (current && current.code === code && panelState === 'case' && !force) return;
    if (hasUnsaved() && current.code !== code) {
      askDiscard(code);
      return;
    }
    lookup(code);
  }

  function leaveCase() {
    current = null;
    setCode('');
    panelShow('empty');
    setPhase('entry');
    focusEntry();
  }

  $('changeCodeBtn').addEventListener('click', function () {
    if (hasUnsaved()) askDiscard(null);
    else leaveCase();
  });

  var STATE_TEXT = {
    missing: ['查無這組代碼', '請再核對一次家長手機主頁面上的 4 位數字。'],
    done: ['這組代碼已經結束了', '已經有醫檢師送出這位孩子的回饋，代碼隨即失效。'],
    expired: ['這組代碼已經過期', '代碼只在家長填寫後 24 小時內有效，請家長重新填寫一次。']
  };

  var noteAction = null;

  /* 查無／失效／連線錯誤：附一個下一步的按鈕 */
  function note(title, body, opts) {
    opts = opts || {};
    $('resultTitle').textContent = title;
    $('resultBody').textContent = body;
    $('resultNote').classList.toggle('is-error', !!opts.error);
    $('retryBtn').textContent = opts.retry ? '再查一次' : '重新輸入代碼';
    noteAction = opts.retry || function () { setCode(''); focusEntry(); };
    panelShow('note');
    setPhase('entry');
    Anxin.announce(live, title + '。' + body);
    if (!finePointer.matches) $('resultNote').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $('retryBtn').addEventListener('click', function () { if (noteAction) noteAction(); });

  function lookup(code) {
    var seq = ++lookupSeq;
    current = null;
    if (codeInput.value !== code) { codeInput.value = code; renderSlots(); }
    $('loadingText').textContent = '查詢代碼 ' + code + ' 中…';
    panelShow('loading');
    setPhase('entry');

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
      if (r.state !== 'active') {
        note(STATE_TEXT[r.state][0] + '（' + code + '）', STATE_TEXT[r.state][1]);
        return;
      }
      current = { code: code, lock: lock, profile: r.profile };
      renderCase();
    }, function (err) {
      if (seq !== lookupSeq) return;
      lookupFailed(err, code);
    });
  }

  /* 讀個人資料被拒：通常是登入過期（規則要求有效的 staff 文件） */
  function lookupFailed(err, code) {
    var retry = function () { lookup(code); };
    var offline = function () {
      note('連不上伺服器', '請確認網路後再查一次。', { error: true, retry: retry });
    };
    if (err && err.code === 'permission-denied') {
      fb.staff.session().then(function (s) {
        if (!s || s.expiresAt <= Date.now()) backToLogin('登入已經超過 12 小時，請重新輸入密碼。');
        else note('沒有權限讀取', '代碼可能剛好在這時失效了，請再查一次。', { error: true, retry: retry });
      }, offline);
      return;
    }
    window.console.error('查詢失敗：', err);
    offline();
  }

  /* ─────────────────────────────────────────────────────────────
     查到了：① 打針前（病人小卡）② 打完針後（回饋）
     ───────────────────────────────────────────────────────────── */

  var staffErrors = Anxin.createFormErrors({
    form: staffForm,
    summary: $('errorSummary'),
    list: $('errorList'),
    fields: { staffFear: { label: '孩子實際的害怕程度' } }
  });

  var ICON_ALERT = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">' +
    '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 9.5v4.5M12 17h.01"/></svg>';
  var ICON_INFO = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.2"/><path d="M12 11v5M12 8h.01"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M6 12.4 10.2 16.6 18 8.8"/></svg>';
  var ICON_DOWN = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  var ICON_UP = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  var ICON_SAME = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M5 9.5h14M5 14.5h14"/></svg>';

  function meter(label, caption, n) {
    var bars = '';
    for (var i = 1; i <= 5; i++) bars += '<i' + (i <= n ? ' class="on"' : '') + '></i>';
    return '<div class="meter"><dt>' + label + '</dt>' +
      '<dd class="meter-text">' + esc(caption) + '<span class="meter-num">' + n + ' / 5</span></dd>' +
      '<dd class="meter-bar" aria-hidden="true">' + bars + '</dd></div>';
  }

  function renderCase() {
    var p = current.profile;
    var fear = FEAR[p.fearLevel - 1];
    var gender = p.gender === '男' ? '男孩' : '女孩';

    $('barCode').textContent = current.code;
    $('finishLabel').textContent = '送出，結束代碼 ' + current.code;

    $('patientCard').innerHTML =
      '<header class="patient-head">' +
      '<p class="patient-who">' + esc(Anxin.ageLabel(p.age)) + '<span class="sep" aria-hidden="true">·</span>' + gender + '</p>' +
      '<p class="patient-meta">代碼 ' + esc(current.code) + '・' + esc(Anxin.formatExpiry(current.lock.expiresAt)) + '</p>' +
      '</header>' +
      (p.specialNeeds
        ? '<div class="needs">' + ICON_ALERT + '<div><p class="needs-label">特別注意</p>' +
          '<p class="needs-text">' + esc(p.specialNeeds) + '</p></div></div>'
        : '<div class="needs is-empty">' + ICON_INFO + '<div><p class="needs-label">特別注意</p>' +
          '<p class="needs-text">家長沒有填寫特殊需求</p></div></div>') +
      '<dl class="meters">' +
      meter('家長估的害怕程度', fear, p.fearLevel) +
      meter('家長自己的擔心', WORRY[p.worryLevel - 1], p.worryLevel) +
      '</dl>';

    /* 題目：先說家長的評估，再問醫檢師的觀察 */
    $('fearQuestion').textContent = '家長覺得孩子「' + fear + '」，您實際觀察到的呢？';

    var host = $('staffScale');
    var compare = $('compareNote');
    Anxin.buildFaceScale(host, FEAR, {
      onChange: function (v) {
        /* 只有這一題必填：選了之後總覽就完全過時了，一起收掉 */
        staffErrors.clearError('staffFear');
        $('errorSummary').hidden = true;
        Anxin.setAnswered(host, true);
        var d = v - p.fearLevel;
        compare.innerHTML = (d === 0 ? ICON_SAME + '和家長估的一樣'
          : d < 0 ? ICON_DOWN + '比家長估的低 ' + (-d) + ' 級'
            : ICON_UP + '比家長估的高 ' + d + ' 級');
        compare.hidden = false;
      }
    });
    Array.prototype.forEach.call(host.querySelectorAll('.face-option'), function (opt, i) {
      opt.insertAdjacentHTML('beforeend', '<span class="staff-check">' + ICON_CHECK + '</span>');
      if (i + 1 === p.fearLevel) {
        opt.classList.add('is-parent');
        /* 「家長」放進 label 裡：報讀時會唸成「蠻害怕 家長」，不只靠淡色底 */
        opt.insertAdjacentHTML('beforeend', '<span class="parent-tag">家長</span>');
      }
    });

    compare.hidden = true;
    Anxin.setAnswered(host, false);
    $('staffNote').value = '';
    $('note-count').textContent = '還可以輸入 500 字';
    Anxin.setAnswered($('staffNote'), false);
    staffErrors.clearAll();
    $('errorSummary').hidden = true;
    $('finish-error').hidden = true;

    panelShow('case');
    setPhase('case');
    window.scrollTo(0, 0);
    $('beforeTitle').focus();
    Anxin.announce(live, '代碼 ' + current.code + '：' + Anxin.ageLabel(p.age) + gender +
      (p.specialNeeds ? '，特別注意：' + p.specialNeeds : '') + '。家長覺得孩子' + fear);
  }

  $('staffNote').addEventListener('input', function () {
    var ta = $('staffNote');
    $('note-count').textContent = '還可以輸入 ' + (500 - ta.value.length) + ' 字';
    Anxin.setAnswered(ta, ta.value.trim());
  });

  /* ─────────────────────────────────────────────────────────────
     3. 送出：先確認（送出 = 代碼失效，不能反悔）
     ───────────────────────────────────────────────────────────── */

  var finishBtn = $('finishBtn');
  var finishError = $('finish-error');
  var finishing = false;
  var confirmDlg = Anxin.wireDialog($('confirmDlg'));

  function setFinishing(on) {
    finishing = on;
    finishBtn.disabled = on;
    finishBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    $('finishLabel').textContent = on ? '送出中…' : '送出，結束代碼 ' + (current ? current.code : '');
  }

  function showFinishError(msg) {
    finishError.textContent = msg;
    finishError.hidden = false;
    Anxin.announce(live, msg);
  }

  function picked() {
    return staffForm.querySelector('[name="staffFear"]:checked');
  }

  staffForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (finishing || !current) return;

    staffErrors.clearAll();
    finishError.hidden = true;
    var pick = picked();
    if (!pick) {
      staffErrors.setError('staffFear', '請選一個最接近您觀察的程度。');
      staffErrors.showSummary([{ key: 'staffFear', msg: '請選一個最接近您觀察的程度。' }]);
      Anxin.announce(live, '還有 1 個地方需要補上');
      return;
    }
    $('errorSummary').hidden = true;

    var v = Number(pick.value);
    var p = current.profile;
    var noteText = $('staffNote').value.trim();
    $('confirmCode').textContent = current.code;
    $('confirmList').innerHTML =
      '<div><dt>您的觀察</dt><dd>' + FEAR[v - 1] + '（' + v + ' / 5）</dd></div>' +
      '<div><dt>家長估計</dt><dd>' + FEAR[p.fearLevel - 1] + '（' + p.fearLevel + ' / 5）</dd></div>' +
      '<div><dt>補充</dt><dd>' + (noteText ? esc(noteText) : '（沒有）') + '</dd></div>';
    confirmDlg.open();
  });

  $('confirmSend').addEventListener('click', function () {
    confirmDlg.close();
    finish();
  });

  function finish() {
    var c = current;
    var pick = picked();
    if (!c || !pick) return;
    var payload = Anxin.buildStaffFeedback(c.profile, { staffFear: pick.value, note: $('staffNote').value });

    setFinishing(true);
    net(fb.codes.finish(c.code, c.lock, payload)).then(function () {
      addRecent({ code: c.code, staffFear: payload.staffFear, at: Date.now() });
      current = null;
      setFinishing(false);
      codeInput.value = '';
      renderSlots();
      $('doneCode').textContent = c.code;
      panelShow('done');
      setPhase('done');
      window.scrollTo(0, 0);
      $('doneTitle').focus();
      Anxin.announce(live, '已送出，代碼 ' + c.code + ' 已失效');
    }, function (err) {
      setFinishing(false);
      if (err && err.code === 'permission-denied') {
        /* 可能是登入過期，也可能是別的醫檢師剛好先送出了：重新查一次就知道 */
        net(fb.codes.getLock(c.code)).then(function (lock) {
          if (Anxin.codes.state(lock, Date.now()) === 'done') {
            showFinishError('這組代碼剛剛已經有人送出回饋了，不用再送一次。');
            return null;
          }
          return fb.staff.session().then(function (s) {
            if (!s || s.expiresAt <= Date.now()) backToLogin('登入已經超過 12 小時，請重新輸入密碼後再送一次。');
            else showFinishError('沒辦法送出：代碼可能已經過期。請重新查詢一次。');
          });
        }).catch(function () {
          showFinishError('連不上伺服器，您選的答案都還在。請確認網路後再按一次。');
        });
        return;
      }
      window.console.error('送出失敗：', err);
      showFinishError('連不上伺服器，您選的答案都還在。請確認網路後再按一次。');
    });
  }

  $('nextBtn').addEventListener('click', function () {
    setCode('');
    panelShow('empty');
    setPhase('entry');
    focusEntry();
  });

  /* ─────────────────────────────────────────────────────────────
     最近完成（這台裝置）
     ───────────────────────────────────────────────────────────── */

  function loadRecent() {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
      return list.filter(function (r) {
        return r && /^\d{4}$/.test(r.code) && r.staffFear >= 1 && r.staffFear <= 5 &&
          Date.now() - r.at < SESSION_MS;
      });
    } catch (e) {
      return [];
    }
  }

  function addRecent(r) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify([r].concat(loadRecent()).slice(0, RECENT_MAX)));
    } catch (e) { /* 存不進去就不顯示，不影響送出 */ }
    renderRecent();
  }

  function renderRecent() {
    var list = loadRecent();
    $('recent').hidden = !list.length;
    $('recentList').innerHTML = list.map(function (r) {
      return '<li><span class="recent-code">' + r.code + '</span>' +
        '<span class="recent-fear">' + FEAR[r.staffFear - 1] + '</span>' +
        '<time class="recent-time" datetime="' + new Date(r.at).toISOString() + '">' + hhmm(r.at) + '</time></li>';
    }).join('');
  }

  /* ─────────────────────────────────────────────────────────────
     開頁：這支裝置 12 小時內登入過，就直接進工作台
     ───────────────────────────────────────────────────────────── */

  function enterDesk(expiresAt) {
    show('desk');
    setSession(expiresAt);
    current = null;
    codeInput.value = '';
    renderSlots();
    panelShow('empty');
    setPhase('entry');
    renderRecent();
    focusEntry();
  }

  net(firebase().then(function (f) { return f.staff.session(); })).then(function (s) {
    if (s && s.expiresAt > Date.now()) enterDesk(s.expiresAt);
    else show('login');
  }, function () {
    show('login');
  });
})();
