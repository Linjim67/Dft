/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 家長安慰指南
   內容在 /guide/content.js（GUIDE_CONTENT）；這裡只負責排版、切換年紀、段落選單。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var p = Anxin.profile.load();
  if (!p) return; /* <head> 裡的守衛已經導回 / */

  /* 醫檢師送出回饋 → 轉到「打針完畢」頁 */
  Anxin.shotFinished.redirectWhenDone(p);

  var C = window.GUIDE_CONTENT;
  if (!C) return;

  var doc = document;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* 圖示都是這個檔裡的常數，不含使用者輸入 */
  function svg(paths, cls) {
    var wrap = doc.createElement('span');
    wrap.innerHTML = '<svg viewBox="0 0 24 24" class="icon' + (cls ? ' ' + cls : '') +
      '" aria-hidden="true">' + paths + '</svg>';
    return wrap.firstChild;
  }

  var ICONS = {
    /* 年紀 */
    baby: '<circle cx="12" cy="13" r="7.5"/><path d="M12 5.5c0-1.6 1.2-2.8 2.8-2.8"/>' +
      '<path d="M9.4 12.2h.01M14.6 12.2h.01"/><path d="M10 15.6c1.2.9 2.8.9 4 0"/>',
    bear: '<circle cx="6.8" cy="7" r="2.6"/><circle cx="17.2" cy="7" r="2.6"/>' +
      '<circle cx="12" cy="13.5" r="7"/><path d="M9.8 12.4h.01M14.2 12.4h.01"/>' +
      '<path d="M10.8 16h2.4"/>',
    backpack: '<path d="M5.5 11a6.5 6.5 0 0 1 13 0v8a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2Z"/>' +
      '<path d="M9 5.2V4.5a3 3 0 0 1 6 0v.7"/><path d="M9 14.5h6v3.5H9Z"/>',
    /* 打針當下 */
    shield: '<path d="M12 3 5 6v5.2c0 4.3 2.9 8.1 7 9.8 4.1-1.7 7-5.5 7-9.8V6Z"/>' +
      '<path d="m9 12 2.2 2.2L15.5 10"/>',
    listen: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/>' +
      '<path d="M8 8.5h8M8 12.5h5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    wind: '<path d="M3 8.5h10a3 3 0 1 0-3-3"/><path d="M3 12.5h15a3 3 0 1 1-3 3"/>' +
      '<path d="M3 16.5h6"/>',
    bubbles: '<circle cx="9" cy="14" r="5.5"/><circle cx="17.5" cy="6.5" r="3"/>' +
      '<circle cx="18.5" cy="16.5" r="1.8"/><path d="M6.8 11.8a3 3 0 0 1 2.2-1.3"/>',
    /* 怎麼說、不要說：每個主題標題左邊的小圖示（content.js 的 icon） */
    note: '<path d="M9 18V6.2l10-2.2v11.6"/><circle cx="6.5" cy="18" r="2.5"/>' +
      '<circle cx="16.5" cy="15.6" r="2.5"/>',
    hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5V5a1.5 1.5 0 0 1 3 0v6.5"/>' +
      '<path d="M14 11.5V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4.1-2.1L4 14.4' +
      'a1.5 1.5 0 0 1 2.3-1.9L8 14.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
      '<circle cx="12" cy="12" r="3"/>',
    heart: '<path d="M12 20s-7-4.3-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6C19 15.7 12 20 12 20Z"/>',
    family: '<circle cx="8" cy="6.5" r="2.5"/><path d="M3.5 20v-3.5a4.5 4.5 0 0 1 9 0V20"/>' +
      '<circle cx="17" cy="10" r="2"/><path d="M14 20v-2.5a3 3 0 0 1 6 0V20"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01"/>' +
      '<path d="M8.5 14a4.5 4.5 0 0 0 7 0"/>',
    star: '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8Z"/>',
    trend: '<path d="M3.5 17 9 11.5l3.5 3.5 8-8"/><path d="M15 7h5.5v5.5"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/>' +
      '<circle cx="8" cy="17" r="2"/>',
    book: '<path d="M12 6.5C10.2 5.1 7.7 4.5 5 4.5v13c2.7 0 5.2.6 7 2 1.8-1.4 4.3-2 7-2v-13' +
      'c-2.7 0-5.2.6-7 2Z"/><path d="M12 6.5v13"/>',
    gift: '<rect x="4" y="9.5" width="16" height="10.5" rx="1.5"/><path d="M3 9.5h18M12 9.5V20"/>' +
      '<path d="M12 9.5C10.5 6 7 6 7 8s3 1.5 5 1.5Zm0 0c1.5-3.5 5-3.5 5-1.5s-3 1.5-5 1.5Z"/>',
    question: '<circle cx="12" cy="12" r="8.5"/>' +
      '<path d="M9.8 9.5a2.3 2.3 0 1 1 3.1 2.1c-.6.3-.9.8-.9 1.4v.5M12 16.5h.01"/>',
    medal: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7.5 21l4.5-2.5 4.5 2.5-1.1-7.6"/>',
    stethoscope: '<path d="M6 3.5H4.8v5.2a4.2 4.2 0 0 0 8.4 0V3.5H12"/>' +
      '<path d="M9 12.9v1.9a4.7 4.7 0 0 0 9.4 0v-2.3"/><circle cx="18.4" cy="10.4" r="2.1"/>'
  };
  var AGE_ICON = { baby: 'baby', preschool: 'bear', school: 'backpack' };

  var ICON_X = '<path d="M7 7l10 10M17 7 7 17"/>';
  var ICON_CHECK = '<path d="M6 12.4 10.2 16.6 18 8.8"/>';

  /* ── 年紀 → 分組：看「幾歲」（2 歲半算 2 歲），10 歲以上先給最接近的 5–9 歲 ── */
  function pickAgeGroup(age) {
    var whole = Math.floor(age);
    if (whole <= 2) return 'baby';
    if (whole <= 4) return 'preschool';
    return 'school';
  }

  /* ── 一個主題裡的句子：對話框／清單／猜謎 ── */
  function renderItems(items) {
    var ul = el('ul', 'tip-list');
    items.forEach(function (it) {
      var li;
      if (typeof it === 'string') {
        li = el('li', 'say', it);
      } else if (it.do) {
        li = el('li', 'do', it.do);
      } else if (it.q) {
        li = el('li', 'say riddle');
        li.appendChild(el('span', null, it.q));
        var ans = el('details', 'riddle-ans');
        ans.appendChild(el('summary', null, '看答案'));
        ans.appendChild(el('p', null, it.a));
        li.appendChild(ans);
      }
      if (li) ul.appendChild(li);
    });
    return ul;
  }

  /* ── 1. 你可以這樣跟他說！──────────────────────────────── */

  var options = doc.getElementById('ageOptions');
  var panelsHost = doc.getElementById('agePanels');
  var hint = doc.getElementById('ageHint');
  var panels = {};

  C.ageGroups.forEach(function (g) {
    var label = el('label', 'age-opt');
    var input = el('input');
    input.type = 'radio';
    input.name = 'ageGroup';
    input.value = g.id;
    input.setAttribute('aria-controls', 'panel-' + g.id);
    label.appendChild(input);
    var face = el('span', 'age-face');
    face.appendChild(svg(ICONS[AGE_ICON[g.id]], 'age-icon'));
    face.appendChild(el('span', 'age-label', g.label));
    face.appendChild(svg(ICON_CHECK, 'age-check'));
    label.appendChild(face);
    options.appendChild(label);

    var panel = el('div', 'topic-list is-plain age-panel');
    panel.id = 'panel-' + g.id;
    panel.hidden = true;
    g.topics.forEach(function (t, i) {
      var topic = Anxin.buildTopic(t.title, { open: i === 0, icon: ICONS[t.icon] });
      topic.body.appendChild(renderItems(t.items));
      panel.appendChild(topic.root);
    });
    panelsHost.appendChild(panel);
    panels[g.id] = panel;
  });

  function showGroup(id) {
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== id; });
  }

  options.addEventListener('change', function (ev) { showGroup(ev.target.value); });

  var startId = pickAgeGroup(p.age);
  options.querySelector('input[value="' + startId + '"]').checked = true;
  showGroup(startId);

  /* 說明為什麼先選這一組；名字用 textContent，不拼 HTML */
  var who = '「' + p.nickname + '」';
  var age = Anxin.ageLabel(p.age);
  hint.textContent = Math.floor(p.age) >= 10
    ? who + age + '，先顯示最接近的 5–9 歲，說法可以再依孩子調整。'
    : '已依' + who + '的年紀（' + age + '）選好。';
  hint.hidden = false;

  /* ── 2. 打針當下，家長可以這樣做！─────────────────────────── */

  var duringList = doc.getElementById('duringList');
  C.during.forEach(function (t) {
    var topic = Anxin.buildTopic(t.title, { icon: ICONS[t.icon] });
    t.body.forEach(function (b) {
      if (typeof b === 'string') {
        topic.body.appendChild(el('p', null, b));
      } else if (b.lead) {
        topic.body.appendChild(el('p', 'topic-lead', b.lead));
      } else if (b.list) {
        topic.body.appendChild(renderItems(b.list.map(function (s) { return { do: s }; })));
      }
    });
    duringList.appendChild(topic.root);
  });

  /* ── 3. 這些話先不要跟小孩說！避免的第 n 句 ↔ 改說的第 n 句 ───────
     和上面兩段一樣：先只列標題，點開才看到避免／改說 */

  function pairRow(kind, tag, icon, text) {
    var row = el('p', 'pair-row ' + kind);
    var t = el('span', 'pair-tag');
    t.appendChild(svg(icon));
    t.appendChild(doc.createTextNode(tag));
    row.appendChild(t);
    row.appendChild(el('span', 'pair-text', text));
    return row;
  }

  var dontList = doc.getElementById('dontList');
  C.dont.forEach(function (t) {
    var topic = Anxin.buildTopic(t.title, { icon: ICONS[t.icon] });
    var ul = el('ul', 'pair-list');
    t.avoid.forEach(function (bad, i) {
      var li = el('li', 'pair');
      li.appendChild(pairRow('is-avoid', '避免', ICON_X, bad));
      if (t.better[i]) li.appendChild(pairRow('is-better', '改說', ICON_CHECK, t.better[i]));
      ul.appendChild(li);
    });
    topic.body.appendChild(ul);
    dontList.appendChild(topic.root);
  });

  /* ── 章節分頁（怎麼說／打針當下／不要說）：一次顯示一章 ──────────
     WAI-ARIA tabs：左右鍵換分頁（自動切換）、Home／End；網址 #say／#during／#dont 直接開那一章 */

  var tabBar = doc.querySelector('.tabs');
  var tabs = Array.prototype.slice.call(tabBar.querySelectorAll('.tab'));

  /* 分頁列黏在頂端：換章時捲回這裡（下一章從頭看），黏住後加一點陰影 */
  var sentinel = el('div', 'tabs-sentinel');
  tabBar.parentNode.insertBefore(sentinel, tabBar);

  function tabFor(id) {
    return tabs.filter(function (t) { return t.getAttribute('aria-controls') === id; })[0];
  }

  function selectTab(tab, opts) {
    opts = opts || {};
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      doc.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (opts.focus) tab.focus();
    if (opts.rewind) {
      var top = sentinel.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > top) window.scrollTo(0, top);
    }
  }

  tabBar.addEventListener('click', function (ev) {
    var tab = ev.target.closest('.tab');
    if (tab) selectTab(tab, { rewind: true });
  });

  tabBar.addEventListener('keydown', function (ev) {
    var i = tabs.indexOf(doc.activeElement);
    if (i < 0) return;
    var next = { ArrowRight: tabs[(i + 1) % tabs.length], ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
      Home: tabs[0], End: tabs[tabs.length - 1] }[ev.key];
    if (!next) return;
    ev.preventDefault();
    selectTab(next, { focus: true, rewind: true });
  });

  function fromHash() {
    var tab = tabFor(location.hash.slice(1));
    if (tab) selectTab(tab, { rewind: true });
  }
  selectTab(tabFor(location.hash.slice(1)) || tabs[0]);
  window.addEventListener('hashchange', fromHash);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      tabBar.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);
  }
})();
