/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 雙機：QR code
   編碼交給 qrcode-generator（Kazuhiko Arase，MIT），從 jsDelivr 載入並鎖定版本與雜湊；
   畫成 SVG（放大不會糊、深色方塊在白底上，掃描最穩）。
   CDN 載不到時不影響配對：畫面上的網址與 4 位數代碼照樣能用。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  var SRI = 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k';
  var loading = null;

  function load() {
    if (root.qrcode) return Promise.resolve(root.qrcode);
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = SRC;
        s.integrity = SRI;
        s.crossOrigin = 'anonymous';
        s.async = true;
        s.onload = function () { if (root.qrcode) resolve(root.qrcode); else reject(new Error('qr-missing')); };
        s.onerror = function () { loading = null; reject(new Error('qr-unavailable')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  /* 每個深色模組一個 1×1 方塊；四周留 4 格空白（掃描器需要的 quiet zone） */
  function svg(qrcode, text) {
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();
    var q = 4;
    var size = n + 2 * q;
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
      }
    }
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" aria-hidden="true">' +
      '<rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#1C1917"/></svg>';
  }

  root.AnxinQR = { load: load, svg: svg };
})(window);
