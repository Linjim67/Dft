/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 看繪本
   繪本還沒做：先列出準備中的繪本，收孩子的願望——
     1. 想看哪一本（加入願望清單）
     2. 還想看什麼主題（自己打）
     3. 最喜歡的角色（點選，也可以自己打）
   每改一次就存在手機上（一次造訪一份），並整筆覆寫到 bookWishes/{id}。
   清單、白名單、去暱稱在 Anxin.books（/shared/app.js）；規則在 firestore.rules。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  /* 醫檢師送出回饋 → 轉到「打針完畢」頁 */
  Anxin.shotFinished.redirectWhenDone(p);

  var B = Anxin.books;
  var doc = document;
  var KEY = 'anxin.books.v1';

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* 圖示都是這個檔裡的常數，不含使用者輸入 */
  function svg(paths, cls, viewBox) {
    var wrap = doc.createElement('span');
    wrap.innerHTML = '<svg viewBox="' + (viewBox || '0 0 24 24') + '" class="' + (cls || 'icon') +
      '" aria-hidden="true">' + paths + '</svg>';
    return wrap.firstChild;
  }

  /* ── 封面：雙色線條圖（f1 = 色調淺底、f2 = 白、ink = 實心深色） ── */
  var COVERS = {
    animals: { tone: 'honey', art:
      '<circle class="f2" cx="8.5" cy="9" r="3.6"/><circle class="f2" cx="23.5" cy="9" r="3.6"/>' +
      '<circle class="f1" cx="16" cy="17.5" r="10"/>' +
      '<circle class="ink" cx="12.2" cy="15.6" r="1.1"/><circle class="ink" cx="19.8" cy="15.6" r="1.1"/>' +
      '<ellipse class="f2" cx="16" cy="21.2" rx="3.8" ry="2.9"/><path d="M14.8 20.4h2.4"/>' },
    dinosaurs: { tone: 'sage', art:
      '<path class="f1" d="M3.5 21.5c2.6.1 4.3-.9 5.8-3 1.7-2.4 4-3.7 7-3.7 1.8 0 3-.6 3.7-1.9V8.6A3 3 0 0 1 23 5.6h2a2.2 2.2 0 0 1 0 4.4h-1v6.2c0 4.6-3.7 8.3-8.3 8.3H9.2c-2.9 0-5-1.2-5.7-3Z"/>' +
      '<path d="M11 24.5v3.3M18.6 24.5v3.3"/><circle class="ink" cx="23.4" cy="7.8" r="1"/>' +
      '<path d="M11.5 15.7l1.2-2.4 1.6 1.9M15.4 14.8l1.4-2.4 1.4 2"/>' },
    space: { tone: 'apricot', art:
      '<path class="f2" d="M10.3 17.4 6.5 21.2v3.6h3.8ZM21.7 17.4l3.8 3.8v3.6h-3.8Z"/>' +
      '<path class="f1" d="M16 3.5c3.9 2.9 5.8 7.2 5.8 12.8v8.5H10.2v-8.5c0-5.6 1.9-9.9 5.8-12.8Z"/>' +
      '<circle class="f2" cx="16" cy="13" r="2.7"/>' +
      '<path d="M13.6 24.8c0 1.8.9 3 2.4 4.2 1.5-1.2 2.4-2.4 2.4-4.2"/>' },
    ocean: { tone: 'sage', art:
      '<path class="f2" d="M24.2 16 29 11.2v9.6Z"/>' +
      '<path class="f1" d="M3.5 16c3.6-5.4 8.9-7.4 13.9-6.4 3 .6 5.4 2.7 6.8 6.4-1.4 3.7-3.8 5.8-6.8 6.4-5 1-10.3-1-13.9-6.4Z"/>' +
      '<circle class="ink" cx="9.6" cy="15" r="1.1"/><path d="M14.5 12.6c1.2 2.1 1.2 4.7 0 6.8"/>' +
      '<circle cx="8" cy="6" r="1.6"/><circle cx="12.4" cy="3.6" r="1"/>' },
    magic: { tone: 'honey', art:
      '<path class="f1" d="M5 11l5.2 4.6L16 7.5l5.8 8.1L27 11l-2.2 12.8H7.2Z"/>' +
      '<path d="M7 27.6h18"/><circle class="ink" cx="16" cy="18.6" r="1.5"/>' +
      '<circle class="ink" cx="10.4" cy="20" r="1"/><circle class="ink" cx="21.6" cy="20" r="1"/>' +
      '<path d="M26.5 3.6v3.2M24.9 5.2h3.2"/>' },
    hospital: { tone: 'apricot', art:
      '<path class="f1" d="M16 3.8 6 7.6v7.2c0 6.3 4.2 11.2 10 13.2 5.8-2 10-6.9 10-13.2V7.6Z"/>' +
      '<path class="ink" d="m16 10.4 1.7 3.4 3.7.5-2.7 2.6.7 3.7-3.4-1.8-3.4 1.8.7-3.7-2.7-2.6 3.7-.5Z"/>' }
  };

  var ICON_HEART = '<path d="M12 20s-7-4.3-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6C19 15.7 12 20 12 20Z"/>';
  var ICON_CHECK = '<path d="M6 12.4 10.2 16.6 18 8.8"/>';
  var ICON_X = '<path d="M7 7l10 10M17 7 7 17"/>';

  /* ── 狀態：存在手機上；換了一份資料（新代碼）就重新開始 ── */

  function randomId() {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var buf = new Uint8Array(20);
    var c = window.crypto;
    if (c && c.getRandomValues) c.getRandomValues(buf);
    else for (var i = 0; i < 20; i++) buf[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(buf, function (b) { return abc[b % abc.length]; }).join('');
  }

  function fresh() {
    return { id: randomId(), code: p.code, wishlist: [], themeIdeas: [], characters: [], characterIdeas: [] };
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.code === p.code && /^[A-Za-z0-9]{20}$/.test(s.id)) return s;
    } catch (e) { /* 無痕模式、資料壞了：重新開始 */ }
    return fresh();
  }

  var state = load();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 存不了：畫面照常 */ }
  }

  /* ── 送到伺服器：連續點很多下只送最後一次 ── */

  var toast = doc.getElementById('savedToast');
  var syncTimer = 0;
  var toastTimer = 0;

  function showSaved() {
    toast.textContent = '';
    toast.appendChild(svg(ICON_CHECK));
    toast.appendChild(doc.createTextNode('已記下'));
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 1600);
  }

  function sync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      var payload = B.build(state, p);
      Anxin.whenFirebase(10000).then(function (fb) {
        return fb.books.save(state.id, payload);
      }).then(showSaved, function () { /* 送不出去：手機上還留著，下次改動再送 */ });
    }, 700);
  }

  function changed() {
    persist();
    sync();
  }

  function toggle(list, id) {
    var i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    return i === -1;
  }

  /* ── 1. 想看哪一本？ ─────────────────────────────────────── */

  var shelf = doc.getElementById('shelf');

  function paintBook(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.querySelector('.book-wish-text').textContent = on ? '已加入' : '加入願望清單';
  }

  B.THEMES.forEach(function (t) {
    var c = COVERS[t.id];
    var li = el('li');
    var btn = el('button', 'book');
    btn.type = 'button';
    btn.setAttribute('data-tone', c.tone);
    var cover = el('span', 'book-cover');
    cover.appendChild(svg(c.art, 'book-art', '0 0 32 32'));
    btn.appendChild(cover);
    btn.appendChild(el('span', 'book-title', t.label));
    var wish = el('span', 'book-wish');
    wish.appendChild(svg(ICON_HEART, 'icon book-heart'));
    wish.appendChild(el('span', 'book-wish-text'));
    btn.appendChild(wish);
    paintBook(btn, state.wishlist.indexOf(t.id) !== -1);
    btn.addEventListener('click', function () {
      paintBook(btn, toggle(state.wishlist, t.id));
      changed();
    });
    li.appendChild(btn);
    shelf.appendChild(li);
  });

  /* ── 自己打的字：清單（可以刪） ──────────────────────────── */

  function renderIdeas(ul, list) {
    ul.textContent = '';
    list.forEach(function (text, i) {
      var li = el('li', 'idea');
      li.appendChild(el('span', 'idea-text', text));
      var del = el('button', 'idea-del');
      del.type = 'button';
      del.setAttribute('aria-label', '刪除「' + text + '」');
      del.appendChild(svg(ICON_X));
      del.addEventListener('click', function () {
        list.splice(i, 1);
        renderIdeas(ul, list);
        changed();
      });
      li.appendChild(del);
      ul.appendChild(li);
    });
    ul.hidden = list.length === 0;
  }

  function wireIdeaForm(formId, inputId, listId, key, maxLen) {
    var form = doc.getElementById(formId);
    var input = doc.getElementById(inputId);
    var ul = doc.getElementById(listId);
    var addBtn = form.querySelector('.idea-add');
    input.maxLength = maxLen;

    function full() { return state[key].length >= B.IDEAS_MAX; }
    function sync() {
      addBtn.disabled = !input.value.trim() || full();
      input.disabled = full();
      input.placeholder = full() ? '最多 ' + B.IDEAS_MAX + ' 個' : input.dataset.placeholder;
    }
    input.dataset.placeholder = input.placeholder;

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var t = input.value.trim();
      if (!t || full()) return;
      if (state[key].indexOf(t) === -1) state[key].push(t);
      input.value = '';
      renderIdeas(ul, state[key]);
      changed();
      sync();
    });
    input.addEventListener('input', sync);
    ul.addEventListener('click', function () { setTimeout(sync, 0); });

    renderIdeas(ul, state[key]);
    sync();
  }

  wireIdeaForm('themeForm', 'themeInput', 'themeIdeas', 'themeIdeas', B.THEME_IDEA_LEN);

  /* ── 3. 最喜歡的角色？（可複選） ──────────────────────────── */

  var chips = doc.getElementById('charChips');
  B.CHARACTERS.forEach(function (ch) {
    var b = el('button', 'char-chip');
    b.type = 'button';
    b.appendChild(svg(ICON_CHECK, 'icon char-check'));
    b.appendChild(doc.createTextNode(ch.label));
    b.setAttribute('aria-pressed', state.characters.indexOf(ch.id) !== -1 ? 'true' : 'false');
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', toggle(state.characters, ch.id) ? 'true' : 'false');
      changed();
    });
    chips.appendChild(b);
  });

  wireIdeaForm('charForm', 'charInput', 'charIdeas', 'characterIdeas', B.CHAR_IDEA_LEN);
})();
