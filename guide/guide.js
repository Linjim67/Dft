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
      '<circle cx="18.5" cy="16.5" r="1.8"/><path d="M6.8 11.8a3 3 0 0 1 2.2-1.3"/>'
  };
  var AGE_ICON = { baby: 'baby', preschool: 'bear', school: 'backpack' };

  var ICON_X = '<path d="M7 7l10 10M17 7 7 17"/>';
  var ICON_CHECK = '<path d="M6 12.4 10.2 16.6 18 8.8"/>';
  var ICON_ARROW = '<path d="M5 12h14M13 6l6 6-6 6"/>';

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

  /* 標題下的小字：「5 句」或「4 個做法」，讓人不用點開就知道裡面有什麼 */
  function countLabel(items) {
    var says = items.filter(function (it) { return !it.do; }).length;
    var dos = items.length - says;
    var parts = [];
    if (says) parts.push(says + ' 句可以說的話');
    if (dos) parts.push(dos + ' 個做法');
    return parts.join('・');
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

    var panel = el('div', 'topic-list age-panel');
    panel.id = 'panel-' + g.id;
    panel.hidden = true;
    g.topics.forEach(function (t, i) {
      var topic = Anxin.buildTopic(t.title, { open: i === 0, meta: countLabel(t.items) });
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
      } else if (b.games) {
        var a = el('a', 'inline-cta');
        a.href = '/games/solo/';
        a.appendChild(el('span', null, '打開我們的小遊戲'));
        a.appendChild(svg(ICON_ARROW));
        topic.body.appendChild(a);
      }
    });
    duringList.appendChild(topic.root);
  });

  /* ── 3. 這些話先不要跟小孩說！避免的第 n 句 ↔ 改說的第 n 句 ───────
     每個人都該看到，所以直接攤開，不收進折疊 */

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
    var card = el('section', 'dont-card');
    card.appendChild(el('h3', 'dont-title', t.title));
    var ul = el('ul', 'pair-list');
    t.avoid.forEach(function (bad, i) {
      var li = el('li', 'pair');
      li.appendChild(pairRow('is-avoid', '避免', ICON_X, bad));
      if (t.better[i]) li.appendChild(pairRow('is-better', '改說', ICON_CHECK, t.better[i]));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    dontList.appendChild(card);
  });

  /* ── 段落選單：標出目前看到的段落（aria-current），點了平滑捲過去 ── */

  var links = Array.prototype.slice.call(doc.querySelectorAll('.jump-link'));
  var jump = doc.querySelector('.jump');

  function markCurrent(id) {
    links.forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  markCurrent('say');

  if ('IntersectionObserver' in window) {
    /* 段落頂端進到畫面上方三分之一時，就算「正在看」 */
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) markCurrent(e.target.id); });
    }, { rootMargin: '-80px 0px -65% 0px' });
    links.forEach(function (a) {
      var sec = doc.getElementById(a.getAttribute('href').slice(1));
      if (sec) spy.observe(sec);
    });

    /* 選單黏住後加一點陰影，和內容分開 */
    var sentinel = el('div', 'jump-sentinel');
    jump.parentNode.insertBefore(sentinel, jump);
    new IntersectionObserver(function (entries) {
      jump.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);
  }
})();
