/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 膠囊衝衝衝：角色與道具（Q 版 SVG）
   全部是醫院裡看得到的東西：
     小膠囊（蛋形的主角）· 體溫計火箭 · 藥杯飛碟 · 針（障礙物）· 藥盒（方塊）
     彈簧墊 · 星星 · 傳送門 · 安心旗 · 坐旋轉椅的醫生（大魔王，笑咪咪的）
   每張圖畫一次成 <img>，遊戲再依格子大小轉成點陣圖快取。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var INK = '#7C2D12';
  var EGG = 'M50 6C74 6 90 36 90 60C90 82 72 95 50 95C28 95 10 82 10 60C10 36 26 6 50 6Z';

  function svg(w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>';
  }

  /* 小膠囊：上半橘、下半奶油色，中間一條膠囊接縫；臉在下半部（Q 版的大眼睛低低的） */
  function eggBody(face) {
    var eyes = face === 'dizzy'
      ? '<path d="M31 58l10 6-10 6M69 58l-10 6 10 6" fill="none" stroke="#1C1917" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<ellipse cx="50" cy="79" rx="4.2" ry="4.8" fill="#1C1917"/>'
      : '<ellipse cx="37" cy="63" rx="5.6" ry="7.2" fill="#1C1917"/><ellipse cx="63" cy="63" rx="5.6" ry="7.2" fill="#1C1917"/>' +
        '<circle cx="38.9" cy="60.4" r="2.1" fill="#fff"/><circle cx="64.9" cy="60.4" r="2.1" fill="#fff"/>' +
        '<path d="M45 75q5 5 10 0" fill="none" stroke="#1C1917" stroke-width="3.2" stroke-linecap="round"/>';
    return '<defs><clipPath id="top"><rect width="100" height="49"/></clipPath></defs>' +
      '<path d="' + EGG + '" fill="#FFF7ED"/>' +
      '<path d="' + EGG + '" fill="#FB923C" clip-path="url(#top)"/>' +
      '<path d="M13.5 49Q50 55 86.5 49" fill="none" stroke="#C2410C" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="' + EGG + '" fill="none" stroke="' + INK + '" stroke-width="5"/>' +
      '<ellipse cx="34" cy="24" rx="9" ry="5" fill="#fff" opacity=".75" transform="rotate(-35 34 24)"/>' +
      '<ellipse cx="25" cy="74" rx="6" ry="3.6" fill="#FDA4AF"/><ellipse cx="75" cy="74" rx="6" ry="3.6" fill="#FDA4AF"/>' +
      eyes;
  }

  /* 小膠囊縮小放進載具裡（clipPath id 不能重複，換一個名字） */
  function miniEgg(tx, ty, s) {
    return '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' +
      eggBody('').replace(/id="top"/, 'id="top2"').replace(/url\(#top\)/, 'url(#top2)') + '</g>';
  }

  var THEMES = {
    orange: { band: '#FDBA74' },
    yellow: { band: '#FDE047' },
    sky: { band: '#7DD3FC' },
    lavender: { band: '#C4B5FD' },
    pink: { band: '#F9A8D4' },
    dusk: { band: '#FCA5A5' }
  };

  /* 藥盒：白色盒子、上面一條色帶、中間一顆兩色膠囊 */
  function block(band, edge) {
    return svg(100, 100,
      '<rect x="4" y="4" width="92" height="92" rx="14" fill="#fff" stroke="' + edge + '" stroke-width="5"/>' +
      '<path d="M6.5 30V18A11.5 11.5 0 0 1 18 6.5H82A11.5 11.5 0 0 1 93.5 18V30Z" fill="' + band + '"/>' +
      '<path d="M6.5 30H93.5" stroke="' + edge + '" stroke-width="3"/>' +
      '<g transform="rotate(-30 50 63)">' +
      '<rect x="31" y="55" width="38" height="16" rx="8" fill="#fff" stroke="' + edge + '" stroke-width="3.5"/>' +
      '<path d="M50 56.5H39a6.5 6.5 0 0 0 0 13H50Z" fill="' + band + '"/>' +
      '<path d="M50 55v16" stroke="' + edge + '" stroke-width="3"/></g>');
  }

  /* 針：銀色的針、彩色的針座。雙胞胎關「不一樣」的那根換成藍色 */
  function needle(hub, hub2, dark, down) {
    var body =
      '<defs><linearGradient id="m" x1="0" x2="1"><stop offset="0" stop-color="#FAFAF9"/><stop offset=".55" stop-color="#E7E5E4"/><stop offset="1" stop-color="#A8A29E"/></linearGradient></defs>' +
      '<path d="M50 16L57 70H43Z" fill="url(#m)" stroke="#44403C" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M48.6 64L50 27" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>' +
      '<rect x="33" y="67" width="34" height="14" rx="4" fill="' + hub + '" stroke="' + dark + '" stroke-width="3.5"/>' +
      '<rect x="24" y="80" width="52" height="16" rx="6" fill="' + hub2 + '" stroke="' + dark + '" stroke-width="3.5"/>';
    return svg(100, 100, down ? '<g transform="translate(0 100) scale(1 -1)">' + body + '</g>' : body);
  }

  var SPRITES = {
    egg: function () { return svg(100, 100, eggBody('')); },
    eggDizzy: function () { return svg(100, 100, eggBody('dizzy')); },

    /* 體溫計火箭：尾端的紅球是引擎，小膠囊坐在上面 */
    ship: function () {
      return svg(160, 100,
        '<path d="M36 60L17 40Q14 35 20 37L54 56Z" fill="#FDBA74" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M36 80L19 95Q16 99 22 97L54 84Z" fill="#FDBA74" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<rect x="30" y="56" width="122" height="28" rx="14" fill="#fff" stroke="' + INK + '" stroke-width="4"/>' +
        '<rect x="40" y="65" width="64" height="10" rx="5" fill="#F97316"/>' +
        '<path d="M70 59v5M82 59v5M94 59v5M106 59v5M118 59v5M130 59v5" stroke="#A8A29E" stroke-width="2.5" stroke-linecap="round"/>' +
        '<circle cx="34" cy="70" r="17" fill="#FB923C" stroke="' + INK + '" stroke-width="4"/>' +
        '<circle cx="29" cy="64" r="4" fill="#fff" opacity=".7"/>' +
        miniEgg(78, 2, 0.57));
    },

    /* 藥杯飛碟：玻璃罩裡坐著小膠囊，下面是一個倒過來的量杯 */
    ufo: function () {
      return svg(140, 100,
        '<path d="M44 66H96L89 92H51Z" fill="#fff" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
        '<path d="M57 74h8M57 83h6M76 74h8M78 83h6" stroke="#0EA5E9" stroke-width="2.6" stroke-linecap="round"/>' +
        miniEgg(51, 24, 0.38) +
        '<path d="M36 60A34 38 0 0 1 104 60Z" fill="#BAE6FD" fill-opacity=".45" stroke="#0369A1" stroke-width="3.5"/>' +
        '<path d="M46 40a26 28 0 0 1 12-14" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>' +
        '<ellipse cx="70" cy="63" rx="62" ry="12" fill="#FB923C" stroke="' + INK + '" stroke-width="4"/>' +
        '<ellipse cx="70" cy="60" rx="44" ry="4.5" fill="#FDBA74"/>' +
        '<circle cx="28" cy="64" r="4.5" fill="#FEF08A" stroke="' + INK + '" stroke-width="2"/>' +
        '<circle cx="70" cy="70" r="4.5" fill="#FEF08A" stroke="' + INK + '" stroke-width="2"/>' +
        '<circle cx="112" cy="64" r="4.5" fill="#FEF08A" stroke="' + INK + '" stroke-width="2"/>');
    },

    needle: function () { return needle('#F87171', '#DC2626', '#7F1D1D', false); },
    needleDown: function () { return needle('#F87171', '#DC2626', '#7F1D1D', true); },
    needleDiff: function () { return needle('#7DD3FC', '#0284C7', '#0C4A6E', false); },
    needleDownDiff: function () { return needle('#7DD3FC', '#0284C7', '#0C4A6E', true); },
    blockDiff: function () { return block('#7DD3FC', '#0369A1'); },

    /* 彈簧墊（寬 1 格、高 0.4 格） */
    pad: function () {
      return svg(100, 40,
        '<path d="M8 38Q8 5 50 5Q92 5 92 38Z" fill="#FACC15" stroke="#854D0E" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M36 29l14-12 14 12" fill="none" stroke="#854D0E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
    },

    star: function () {
      return svg(100, 100,
        '<path d="M50 6l12.5 26.5 29 3.6-21.3 20 5.5 28.7L50 70.6 24.3 84.8l5.5-28.7-21.3-20 29-3.6Z" fill="#FACC15" stroke="#A16207" stroke-width="5" stroke-linejoin="round"/>' +
        '<circle cx="42" cy="47" r="4" fill="#1C1917"/><circle cx="58" cy="47" r="4" fill="#1C1917"/>' +
        '<path d="M44.5 56q5.5 5 11 0" stroke="#1C1917" stroke-width="3.2" fill="none" stroke-linecap="round"/>');
    },

    /* 安心旗：經過之後變綠色，撞到了就從這裡重來 */
    flagOff: function () { return flag('#E7E5E4', '#78716C'); },
    flagOn: function () { return flag('#4ADE80', '#15803D'); },

    /* 醫生（大魔王）：坐在會滾的看診椅上，笑咪咪的——是陪你玩水槍，不是壞人 */
    doctor: function () { return doctor(false); },
    doctorHappy: function () { return doctor(true); }
  };

  function flag(fill, dark) {
    return svg(60, 120,
      '<rect x="8" y="8" width="6" height="110" rx="3" fill="#78716C"/>' +
      '<path d="M14 12H52L42 28L52 44H14Z" fill="' + fill + '" stroke="' + dark + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M26 23a5 5 0 0 1 8.5-1.6A5 5 0 0 1 43 23c0 5.5-8.5 10.5-8.5 10.5S26 28.5 26 23Z" fill="#fff"/>');
  }

  function doctor(happy) {
    var face = happy
      ? '<path d="M40 67q6-7 12 0M68 67q6-7 12 0" fill="none" stroke="#1C1917" stroke-width="3.6" stroke-linecap="round"/>' +
        '<path d="M49 76q11 13 22 0Z" fill="#1C1917"/><path d="M53 80q7 5 14 0" fill="#FB7185"/>'
      : '<path d="M38 52l12 3M82 52l-12 3" stroke="#44403C" stroke-width="3.6" stroke-linecap="round"/>' +
        '<ellipse cx="46" cy="65" rx="4.6" ry="5.8" fill="#1C1917"/><ellipse cx="74" cy="65" rx="4.6" ry="5.8" fill="#1C1917"/>' +
        '<circle cx="47.6" cy="62.8" r="1.7" fill="#fff"/><circle cx="75.6" cy="62.8" r="1.7" fill="#fff"/>' +
        '<path d="M51 77q9 8 18 0" fill="none" stroke="#1C1917" stroke-width="3.4" stroke-linecap="round"/>';
    return svg(120, 200,
      /* 看診椅 */
      '<rect x="56" y="150" width="8" height="30" fill="#78716C"/>' +
      '<path d="M28 186L60 176L92 186" stroke="#57534E" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="28" cy="190" r="7" fill="#44403C"/><circle cx="92" cy="190" r="7" fill="#44403C"/><circle cx="60" cy="190" r="7" fill="#44403C"/>' +
      '<ellipse cx="60" cy="150" rx="36" ry="8" fill="#38BDF8" stroke="#0C4A6E" stroke-width="4"/>' +
      /* 白袍 */
      '<path d="M24 150Q22 103 60 97Q98 103 96 150Z" fill="#fff" stroke="#57534E" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M60 100L47 125M60 100L73 125" stroke="#57534E" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M60 112V148" stroke="#D6D3D1" stroke-width="2.5"/>' +
      '<rect x="70" y="129" width="15" height="11" rx="2" fill="none" stroke="#A8A29E" stroke-width="2.5"/>' +
      '<path d="M74 124v9" stroke="#2563EB" stroke-width="3" stroke-linecap="round"/>' +
      /* 聽診器 */
      '<path d="M44 102Q38 126 50 133Q60 137 61 126" stroke="#0EA5E9" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="61" cy="123" r="5" fill="#E7E5E4" stroke="#57534E" stroke-width="2.5"/>' +
      /* 大頭（Q 版） */
      '<circle cx="60" cy="60" r="40" fill="#FFE7D1" stroke="#9A3412" stroke-width="4"/>' +
      '<path d="M21 56Q22 18 60 18Q98 18 99 56Q88 36 60 36Q32 36 21 56Z" fill="#57534E" stroke="#44403C" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="60" cy="28" r="9.5" fill="#F5F5F4" stroke="#78716C" stroke-width="3"/><circle cx="60" cy="28" r="3.2" fill="#A8A29E"/>' +
      '<ellipse cx="35" cy="75" rx="6.5" ry="3.8" fill="#FDA4AF"/><ellipse cx="85" cy="75" rx="6.5" ry="3.8" fill="#FDA4AF"/>' +
      face);
  }

  Object.keys(THEMES).forEach(function (t) {
    SPRITES['block_' + t] = function () { return block(THEMES[t].band, '#9A3412'); };
  });

  /* 傳送門：顏色 = 下一段的玩法 */
  var PORTAL = { cube: '#16A34A', rot: '#CA8A04', duo: '#0284C7', ship: '#DB2777', ufo: '#EA580C', boss: '#DC2626' };
  Object.keys(PORTAL).forEach(function (m) {
    SPRITES['portal_' + m] = function () {
      var c = PORTAL[m];
      return svg(80, 240,
        '<ellipse cx="40" cy="120" rx="28" ry="108" fill="' + c + '" fill-opacity=".16" stroke="' + c + '" stroke-width="10"/>' +
        '<ellipse cx="40" cy="120" rx="15" ry="90" fill="none" stroke="#fff" stroke-width="4" opacity=".85"/>');
    };
  });

  function source(name) {
    var f = SPRITES[name];
    return f ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f()) : null;
  }

  /* 一次把全部的圖載好；回傳 name → <img> */
  function images() {
    var out = {};
    if (typeof Image === 'undefined') return out;
    Object.keys(SPRITES).forEach(function (name) {
      var img = new Image();
      img.decoding = 'async';
      img.src = source(name);
      out[name] = img;
    });
    return out;
  }

  root.DashArt = { SPRITES: SPRITES, THEMES: THEMES, PORTAL: PORTAL, source: source, images: images };
})(typeof window !== 'undefined' ? window : globalThis);
