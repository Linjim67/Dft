/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 跨頁共用（window.Anxin）
   所有頁面都從這裡讀寫個人資料，確保只有一套規則。
   一般 <script> 載入（非 module），#01 的 script.js 與各子頁都能直接用。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     個人資料：只存在本機，24 小時後失效
     ───────────────────────────────────────────────────────────── */

  var STORE_KEY = 'anxin.profile.v1';
  var TTL_MS = 24 * 60 * 60 * 1000;

  /* 無痕模式或瀏覽器封鎖儲存時，存取 localStorage 本身就會丟例外 */
  function store() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function saveProfile(p) {
    var s = store();
    if (!s) return;
    try {
      s.setItem(STORE_KEY, JSON.stringify(p));
    } catch (e) {
      /* 儲存已滿：畫面照常，只是重新整理後會消失 */
    }
  }

  function loadProfile() {
    var s = store();
    if (!s) return null;
    try {
      var raw = s.getItem(STORE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      var intact = p && p.expiresAt && p.code &&
        typeof p.nickname === 'string' && p.nickname &&
        typeof p.age === 'number' &&
        p.fearLevel >= 1 && p.fearLevel <= 5 &&
        p.worryLevel >= 1 && p.worryLevel <= 5;
      /* 過期或結構不完整（舊版本、手動竄改）一律丟棄，重新填寫比顯示壞掉的摘要好 */
      if (!intact || Date.now() > p.expiresAt) {
        s.removeItem(STORE_KEY);
        return null;
      }
      return p;
    } catch (e) {
      return null;
    }
  }

  function clearProfile() {
    var s = store();
    if (!s) return;
    try { s.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
  }

  /* 需要個人資料的頁面呼叫：沒有（或已過期）就回到 #01 */
  function requireProfile() {
    var p = loadProfile();
    if (!p) root.location.replace('/');
    return p;
  }

  /* ─────────────────────────────────────────────────────────────
     顯示用格式
     ───────────────────────────────────────────────────────────── */

  function ageLabel(v) {
    if (v === 0) return '未滿 6 個月';
    if (v === 0.5) return '6 個月';
    var whole = Math.floor(v);
    return whole + ' 歲' + (v % 1 === 0.5 ? '半' : '');
  }

  var LEVEL_TEXT = ['', '完全不會', '有一點', '普通', '蠻明顯的', '非常明顯'];

  function formatExpiry(ts) {
    var d = new Date(ts);
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return '有效至 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + hh + ':' + mm;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ─────────────────────────────────────────────────────────────
     1–5 表情量表
     圖示只是輔助，語意由文字說明承擔（不單靠顏色或圖形）。
     FACES 由笑到哭；reverse 用於「負面 → 正面」的量表（如滿意度）。
     ───────────────────────────────────────────────────────────── */

  var FACES = [
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8 13.9c1.1 2 6.9 2 8 0"/>',
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8.7 14.3c1 1.1 5.6 1.1 6.6 0"/>',
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8.7 14.8h6.6"/>',
    '<path d="M9 10.3h.01M15 10.3h.01"/><path d="M8.7 15.6c1-1.1 5.6-1.1 6.6 0"/>',
    '<path d="M7.7 8.5 10.1 9.6M16.3 8.5 13.9 9.6"/><path d="M9 11.2h.01M15 11.2h.01"/>' +
    '<ellipse cx="12" cy="15.6" rx="2.3" ry="1.7"/>'
  ];

  function buildFaceScale(host, captions, opts) {
    opts = opts || {};
    var name = host.dataset.name;
    var describedby = host.dataset.describedby;
    var html = '';
    for (var i = 0; i < 5; i++) {
      var v = i + 1;
      var face = FACES[opts.reverse ? 4 - i : i];
      html +=
        '<label class="face-option">' +
        '<input type="radio" name="' + name + '" value="' + v + '"' +
        (opts.required === false ? '' : ' aria-required="true"') +
        (describedby ? ' aria-describedby="' + describedby + '"' : '') + '>' +
        '<span class="face-body">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
        face + '</svg>' +
        '<span class="face-caption">' + escapeHtml(captions[i]) + '</span>' +
        '</span>' +
        '</label>';
    }
    host.innerHTML = html;
    if (opts.onChange) {
      host.addEventListener('change', function (ev) {
        opts.onChange(Number(ev.target.value), ev);
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     表單回饋：行內錯誤 + 可聚焦的錯誤總覽（兩者並存）
     fields: { key: { label, focus?, invalid? } }
       focus   → 點總覽時要聚焦的元素 id；沒有就聚焦 name=key 的第一個控制項
       invalid → 出錯時要加 aria-invalid 的元素 id（文字輸入框才需要）
     ───────────────────────────────────────────────────────────── */

  function byId(id) { return root.document.getElementById(id); }

  function createFormErrors(cfg) {
    var fields = cfg.fields;
    var summary = cfg.summary;
    var list = cfg.list;
    var form = cfg.form;

    function setError(key, message) {
      var el = byId(key + '-error');
      el.textContent = message;
      el.hidden = false;
      if (fields[key].invalid) byId(fields[key].invalid).setAttribute('aria-invalid', 'true');
    }

    function clearError(key) {
      var el = byId(key + '-error');
      if (!el) return;
      el.textContent = '';
      el.hidden = true;
      if (fields[key] && fields[key].invalid) byId(fields[key].invalid).removeAttribute('aria-invalid');
    }

    function clearAll() {
      Object.keys(fields).forEach(clearError);
    }

    function firstFocusable(key) {
      if (fields[key].focus) return byId(fields[key].focus);
      return form.querySelector('[name="' + key + '"]');
    }

    function showSummary(errors) {
      list.innerHTML = errors.map(function (e) {
        return '<li><a href="#' + (fields[e.key].focus || '') + '" data-key="' + e.key + '">' +
          escapeHtml(fields[e.key].label) + '：' + escapeHtml(e.msg) + '</a></li>';
      }).join('');
      summary.hidden = false;
      summary.focus();
    }

    list.addEventListener('click', function (ev) {
      var link = ev.target.closest('a');
      if (!link) return;
      ev.preventDefault();
      var target = firstFocusable(link.dataset.key);
      if (target) {
        target.focus();
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });

    return {
      setError: setError,
      clearError: clearError,
      clearAll: clearAll,
      showSummary: showSummary
    };
  }

  /* 已作答的題目把標題調淡，讓還沒填的那題自然變成視線焦點 */
  function setAnswered(el, yes) {
    var field = el.closest('.field');
    if (field) field.classList.toggle('is-answered', !!yes);
  }

  function announce(liveEl, msg) {
    liveEl.textContent = '';
    root.setTimeout(function () { liveEl.textContent = msg; }, 60);
  }

  /* ─────────────────────────────────────────────────────────────
     對話框：原生 <dialog>，焦點鎖定與 Esc 關閉由瀏覽器負責。
     帶 data-close 的按鈕會關閉它。
     ───────────────────────────────────────────────────────────── */

  function wireDialog(dlg) {
    dlg.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) dlg.close();
    });
    return {
      open: function () {
        if (typeof dlg.showModal === 'function') dlg.showModal();
        else dlg.setAttribute('open', '');
      },
      close: function () { dlg.close(); }
    };
  }

  /* ─────────────────────────────────────────────────────────────
     回饋上傳
     暱稱絕不進資料庫。家長在自由文字裡很自然會寫到孩子的名字
     （「小恩上次暈針」），所以所有自由文字都先把暱稱換成「孩子」。
     用 split/join 而不是正規表示式，暱稱裡的標點符號不會出錯。
     ───────────────────────────────────────────────────────────── */

  var SCALE_VERSION = 'balanced-v1';

  function scrubNickname(text, nickname) {
    var t = String(text == null ? '' : text);
    var nick = String(nickname == null ? '' : nickname).trim();
    if (!nick) return t;
    return t.split(nick).join('孩子');
  }

  function level(v, name) {
    var n = Number(v);
    if (!(n >= 1 && n <= 5 && n % 1 === 0)) throw new Error('invalid ' + name + ': ' + v);
    return n;
  }

  function freeText(text, nickname, max) {
    return scrubNickname(String(text == null ? '' : text).trim(), nickname).slice(0, max);
  }

  /* 純函式：只挑白名單欄位，方便在 node 單元測試 */
  function buildFeedbackPayload(p, a) {
    return {
      satisfaction: level(a.satisfaction, 'satisfaction'),
      satisfactionReason: freeText(a.satisfactionReason, p.nickname, 500),
      cryLevel: level(a.cryLevel, 'cryLevel'),
      effectiveness: level(a.effectiveness, 'effectiveness'),
      suggestion: freeText(a.suggestion, p.nickname, 1000),
      profile: {
        age: Number(p.age),
        gender: p.gender,
        fearLevel: level(p.fearLevel, 'fearLevel'),
        worryLevel: level(p.worryLevel, 'worryLevel'),
        specialNeeds: freeText(p.specialNeeds, p.nickname, 200)
      },
      scaleVersion: SCALE_VERSION
    };
  }

  /* ─────────────────────────────────────────────────────────────
     等 /shared/firebase.js（module）就緒。它是 deferred 載入，
     家長通常填完表單時早已就緒；載入失敗就逾時，交給頁面顯示錯誤。
     ───────────────────────────────────────────────────────────── */

  function whenFirebase(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (root.AnxinFirebase) { resolve(root.AnxinFirebase); return; }
      var timer = root.setTimeout(function () {
        root.removeEventListener('anxin:firebase', onReady);
        reject(new Error('firebase-unavailable'));
      }, timeoutMs || 10000);
      function onReady() {
        root.clearTimeout(timer);
        resolve(root.AnxinFirebase);
      }
      root.addEventListener('anxin:firebase', onReady, { once: true });
    });
  }

  var Anxin = {
    profile: {
      KEY: STORE_KEY,
      TTL_MS: TTL_MS,
      save: saveProfile,
      load: loadProfile,
      clear: clearProfile
    },
    requireProfile: requireProfile,
    ageLabel: ageLabel,
    LEVEL_TEXT: LEVEL_TEXT,
    formatExpiry: formatExpiry,
    escapeHtml: escapeHtml,
    buildFaceScale: buildFaceScale,
    createFormErrors: createFormErrors,
    setAnswered: setAnswered,
    announce: announce,
    wireDialog: wireDialog,
    scrubNickname: scrubNickname,
    buildFeedbackPayload: buildFeedbackPayload,
    whenFirebase: whenFirebase,
    SCALE_VERSION: SCALE_VERSION
  };

  root.Anxin = Anxin;
  if (typeof module !== 'undefined' && module.exports) module.exports = Anxin;
})(typeof window !== 'undefined' ? window : globalThis);
