/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 家長安慰指南
   內容在 /guide/content.js（GUIDE_CONTENT）；這裡只負責排版與切換年紀。
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

  function svg(paths, cls) {
    var wrap = doc.createElement('span');
    wrap.innerHTML = '<svg viewBox="0 0 24 24" class="icon ' + (cls || '') +
      '" aria-hidden="true">' + paths + '</svg>';
    return wrap.firstChild;
  }

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

  /* ── 1. 你可以這樣跟他說！──────────────────────────────── */

  var seg = doc.getElementById('ageSeg');
  var panelsHost = doc.getElementById('agePanels');
  var hint = doc.getElementById('ageHint');
  var panels = {};

  C.ageGroups.forEach(function (g) {
    var label = el('label', 'segmented-option');
    var input = el('input');
    input.type = 'radio';
    input.name = 'ageGroup';
    input.value = g.id;
    input.setAttribute('aria-controls', 'panel-' + g.id);
    label.appendChild(input);
    label.appendChild(el('span', 'segmented-face', g.label));
    seg.appendChild(label);

    var panel = el('div', 'topic-list age-panel');
    panel.id = 'panel-' + g.id;
    panel.hidden = true;
    g.topics.forEach(function (t, i) {
      var topic = Anxin.buildTopic(t.title, { open: i === 0 });
      topic.body.appendChild(renderItems(t.items));
      panel.appendChild(topic.root);
    });
    panelsHost.appendChild(panel);
    panels[g.id] = panel;
  });

  function showGroup(id) {
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== id; });
  }

  seg.addEventListener('change', function (ev) { showGroup(ev.target.value); });

  var startId = pickAgeGroup(p.age);
  seg.querySelector('input[value="' + startId + '"]').checked = true;
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
    var topic = Anxin.buildTopic(t.title);
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

  /* ── 3. 這些話先不要跟小孩說！避免的第 n 句 ↔ 改說的第 n 句 ─────── */

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
    var topic = Anxin.buildTopic(t.title);
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
})();
