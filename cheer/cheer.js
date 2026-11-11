/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 給家長的鼓勵
   內容在 /cheer/content.js（CHEER_CONTENT）；這裡只負責排版。
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

  /* 小標附圖示：語意由文字承擔，圖示只是輔助 */
  function labelled(cls, icon, label, text) {
    var box = el('div', 'know ' + cls);
    var head = el('p', 'know-label');
    head.innerHTML = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">' + icon + '</svg>';
    head.appendChild(doc.createTextNode(label));
    box.appendChild(head);
    box.appendChild(el('p', null, text));
    return box;
  }

  var ICON_INFO = '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>';
  var ICON_HEART = '<path d="M12 19.5s-6.8-4.1-6.8-8.9A3.8 3.8 0 0 1 12 8.3a3.8 3.8 0 0 1 6.8 2.3c0 4.8-6.8 8.9-6.8 8.9Z"/>';

  /* ── part 1 醫療現場解密 ── */
  var whyList = doc.getElementById('whyList');
  C.whys.forEach(function (w) {
    var topic = Anxin.buildTopic(w.q);
    topic.body.appendChild(labelled('is-fact', ICON_INFO, '醫療小知識', w.fact));
    topic.body.appendChild(labelled('is-tip', ICON_HEART, '給家長的小提醒', w.tip));
    whyList.appendChild(topic.root);
  });

  /* ── part 2 打針大小問 ── */
  var faqList = doc.getElementById('faqList');
  C.faqs.forEach(function (f) {
    var topic = Anxin.buildTopic(f.q);
    f.a.forEach(function (para) { topic.body.appendChild(el('p', null, para)); });
    faqList.appendChild(topic.root);
  });
})();
