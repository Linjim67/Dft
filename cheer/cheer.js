/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 抽血大小問（常見問題）
   內容在 /cheer/content.js（CHEER_CONTENT）；這裡負責排版、搜尋、篩選。

   參考說明中心的做法：
   - 先搜尋、再瀏覽：搜尋框在最上面，邊打邊篩，命中的字標出來
   - 依時間分類：抽血前／抽血時／抽血後，和搜尋可以同時用
   - 「全部展開／全部收合」（GOV.UK accordion 的 Show all sections）
   - 每題答案第一句是重點，加粗放前面
   - 每題有自己的網址（#why-1、#faq-3），打開連結就直接展開那一題
   - 找不到答案時，告訴家長下一步：問現場醫護人員、看其他家長的經驗
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  /* 醫檢師送出回饋 → 轉到「打針完畢」頁 */
  Anxin.shotFinished.redirectWhenDone(p);

  var C = window.CHEER_CONTENT;
  if (!C) return;

  var doc = document;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var PHASES = [
    { id: 'all', label: '全部' },
    { id: 'before', label: '抽血前' },
    { id: 'during', label: '抽血時' },
    { id: 'after', label: '抽血後' }
  ];
  var PHASE_LABEL = {};
  PHASES.forEach(function (ph) { PHASE_LABEL[ph.id] = ph.label; });

  var SUGGEST = ['頭暈', '瘀青', '空腹', '血管'];

  var ICON_INFO = '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>';
  var ICON_HEART = '<path d="M12 19.5s-6.8-4.1-6.8-8.9A3.8 3.8 0 0 1 12 8.3a3.8 3.8 0 0 1 6.8 2.3c0 4.8-6.8 8.9-6.8 8.9Z"/>';
  var ICON_CHECK = '<path d="M6 12.4 10.2 16.6 18 8.8"/>';

  /* ── 每一題：記住可搜尋的文字節點，之後標記命中的字 ── */
  var items = [];

  function textNode(tag, cls, text, item) {
    var n = el(tag, cls, text);
    item.texts.push({ el: n, text: text });
    return n;
  }

  /* 小標附圖示：語意由文字承擔，圖示只是輔助 */
  function labelled(cls, icon, label, text, item) {
    var box = el('div', 'know ' + cls);
    var head = el('p', 'know-label');
    head.innerHTML = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">' + icon + '</svg>';
    head.appendChild(doc.createTextNode(label));
    box.appendChild(head);
    box.appendChild(textNode('p', null, text, item));
    return box;
  }

  /* 第一句是重點：拆成粗體的「簡單說」＋其餘說明 */
  function splitLead(para) {
    var i = para.indexOf('。');
    if (i < 0 || i === para.length - 1) return [para, ''];
    return [para.slice(0, i + 1), para.slice(i + 1)];
  }

  function addItem(section, list, idPrefix, idx, q, when, fill) {
    var topic = Anxin.buildTopic(q, { id: idPrefix + '-' + (idx + 1), meta: PHASE_LABEL[when] });
    var item = { topic: topic.root, section: section, when: when, texts: [], hay: '' };
    item.texts.push({ el: topic.title, text: q });
    fill(topic.body, item);
    item.hay = item.texts.map(function (t) { return t.text; }).join('\n').toLowerCase();
    list.appendChild(topic.root);
    items.push(item);
  }

  /* ── part 1 醫療現場解密 ── */
  var whyList = doc.getElementById('whyList');
  C.whys.forEach(function (w, i) {
    addItem('why', whyList, 'why', i, w.q, w.when, function (body, item) {
      body.appendChild(labelled('is-fact', ICON_INFO, '醫療小知識', w.fact, item));
      body.appendChild(labelled('is-tip', ICON_HEART, '給家長的小提醒', w.tip, item));
    });
  });

  /* ── part 2 抽血大小問 ── */
  var faqList = doc.getElementById('faqList');
  C.faqs.forEach(function (f, i) {
    addItem('faq', faqList, 'faq', i, f.q, f.when, function (body, item) {
      f.a.forEach(function (para, k) {
        if (k === 0) {
          var parts = splitLead(para);
          body.appendChild(textNode('p', 'answer-lead', parts[0], item));
          if (parts[1]) body.appendChild(textNode('p', null, parts[1], item));
        } else {
          body.appendChild(textNode('p', null, para, item));
        }
      });
    });
  });

  /* ── 篩選 ─────────────────────────────────────────────── */

  var input = doc.getElementById('faqSearch');
  var clearBtn = doc.getElementById('searchClear');
  var chips = doc.getElementById('phaseChips');
  var countEl = doc.getElementById('faqCount');
  var expandBtn = doc.getElementById('expandAll');
  var statusRow = doc.querySelector('.faq-status');
  var empty = doc.getElementById('faqEmpty');
  var emptyTitle = doc.getElementById('faqEmptyTitle');
  var sections = {
    why: { root: doc.getElementById('why'), count: doc.getElementById('whyCount') },
    faq: { root: doc.getElementById('faq'), count: doc.getElementById('faqListCount') }
  };

  var phase = 'all';
  var wasSearching = false;

  PHASES.forEach(function (ph) {
    var label = el('label', 'chip');
    var r = el('input');
    r.type = 'radio';
    r.name = 'phase';
    r.value = ph.id;
    if (ph.id === 'all') r.checked = true;
    label.appendChild(r);
    var face = el('span', 'chip-face');
    face.insertAdjacentHTML('beforeend',
      '<svg viewBox="0 0 24 24" class="icon chip-check" aria-hidden="true">' + ICON_CHECK + '</svg>');
    face.appendChild(doc.createTextNode(ph.label));
    label.appendChild(face);
    chips.appendChild(label);
  });

  /* 搜尋字：去掉頭尾空白，空白隔開的每個詞都要命中 */
  function terms() {
    return input.value.toLowerCase().split(/\s+/).filter(Boolean);
  }

  /* 把命中的字包進 <mark>；全程用文字節點，不拼 HTML */
  function paint(entry, ts) {
    var text = entry.text;
    var node = entry.el;
    node.textContent = '';
    if (!ts.length) { node.textContent = text; return; }
    var lower = text.toLowerCase();
    var ranges = [];
    ts.forEach(function (t) {
      var at = 0;
      while ((at = lower.indexOf(t, at)) !== -1) { ranges.push([at, at + t.length]); at += t.length; }
    });
    if (!ranges.length) { node.textContent = text; return; }
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [ranges[0]];
    ranges.slice(1).forEach(function (r) {
      var last = merged[merged.length - 1];
      if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push(r);
    });
    var pos = 0;
    merged.forEach(function (r) {
      if (r[0] > pos) node.appendChild(doc.createTextNode(text.slice(pos, r[0])));
      node.appendChild(el('mark', null, text.slice(r[0], r[1])));
      pos = r[1];
    });
    if (pos < text.length) node.appendChild(doc.createTextNode(text.slice(pos)));
  }

  function visibleItems() {
    return items.filter(function (it) { return !it.topic.hidden; });
  }

  function syncExpandBtn() {
    var vis = visibleItems();
    var allOpen = vis.length > 0 && vis.every(function (it) { return it.topic.open; });
    expandBtn.textContent = allOpen ? '全部收合' : '全部展開';
    expandBtn.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
    expandBtn.hidden = vis.length === 0;
  }

  function apply() {
    var ts = terms();
    var searching = ts.length > 0;
    var shown = { why: 0, faq: 0 };

    items.forEach(function (it) {
      var ok = (phase === 'all' || it.when === phase) &&
        ts.every(function (t) { return it.hay.indexOf(t) !== -1; });
      it.topic.hidden = !ok;
      it.texts.forEach(function (entry) { paint(entry, ts); });
      /* 搜尋時把命中的題目打開，才看得到字標在哪裡；清掉搜尋就收回去 */
      if (searching && ok) it.topic.open = true;
      if (!searching && wasSearching) it.topic.open = false;
      if (ok) shown[it.section]++;
    });
    wasSearching = searching;

    Object.keys(sections).forEach(function (k) {
      sections[k].root.hidden = shown[k] === 0;
      sections[k].count.textContent = shown[k];
    });

    var total = shown.why + shown.faq;
    var scope = phase === 'all' ? '' : PHASE_LABEL[phase] + '：';
    if (searching) {
      countEl.textContent = total
        ? scope + '找到 ' + total + ' 個和「' + input.value.trim() + '」有關的問題'
        : '';
    } else {
      countEl.textContent = scope + '共 ' + total + ' 個問題';
    }

    empty.hidden = total > 0;
    statusRow.hidden = total === 0;
    if (!total) {
      emptyTitle.textContent = searching
        ? '沒有找到和「' + input.value.trim() + '」有關的問題'
        : '這個分類還沒有問題';
    }
    clearBtn.hidden = !input.value;
    syncExpandBtn();
  }

  input.addEventListener('input', apply);
  /* 手機鍵盤按「搜尋」：收起鍵盤，讓結果露出來 */
  input.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') input.blur();
    if (ev.key === 'Escape' && input.value) { input.value = ''; apply(); }
  });
  clearBtn.addEventListener('click', function () {
    input.value = '';
    apply();
    input.focus();
  });
  chips.addEventListener('change', function (ev) {
    phase = ev.target.value;
    apply();
  });

  expandBtn.addEventListener('click', function () {
    var vis = visibleItems();
    var open = !vis.every(function (it) { return it.topic.open; });
    vis.forEach(function (it) { it.topic.open = open; });
    syncExpandBtn();
  });

  /* 使用者自己開合單題時，按鈕文字跟著變（toggle 不冒泡，用捕獲階段聽） */
  doc.addEventListener('toggle', function (ev) {
    if (ev.target.classList && ev.target.classList.contains('topic')) syncExpandBtn();
  }, true);

  /* 找不到時的建議字：點了直接搜尋 */
  var suggest = doc.getElementById('faqSuggest');
  SUGGEST.forEach(function (w) {
    var b = el('button', 'suggest-chip', w);
    b.type = 'button';
    b.addEventListener('click', function () {
      input.value = w;
      /* 換成「全部」，避免分類把建議字的結果也擋掉 */
      phase = 'all';
      chips.querySelector('input[value="all"]').checked = true;
      apply();
    });
    suggest.appendChild(b);
  });

  apply();

  /* ── 網址帶 #why-1、#faq-3：直接展開那一題 ── */
  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!/^(why|faq)-\d+$/.test(id)) return;
    var t = doc.getElementById(id);
    if (!t) return;
    t.hidden = false;
    t.open = true;
    t.scrollIntoView({ block: 'start' });
    t.querySelector('summary').focus({ preventScroll: true });
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();
