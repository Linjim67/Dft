(function (root) {
  'use strict';

  var INK = '#7C2D12';
  var EGG = 'M50 6C74 6 90 36 90 60C90 82 72 95 50 95C28 95 10 82 10 60C10 36 26 6 50 6Z';

  /* SVG 外框 */
  function svg(w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>';
  }

  /* 小膠囊：身體（上橘下白、臉；face = 'dizzy' 是暈倒的臉） */
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

  /* 小膠囊：縮小放進火箭、飛碟裡的身體 */
  function miniEgg(tx, ty, s) {
    return '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' +
      eggBody('').replace(/id="top"/, 'id="top2"').replace(/url\(#top\)/, 'url(#top2)') + '</g>';
  }

  var MOCHI_INK = '#4A3728';
  var MOCHI = 'M50 17C72 17 87 33 89 54C91 76 77 90 50 90C23 90 9 77 11 55C13 33 28 17 50 17Z';

  /* 小麻糬：頭上的皇冠 */
  function crown(tf) {
    return '<path d="M36 20L34 6.5L43 13L50 3.5L57 13L66 6.5L64 20Z" fill="#FCD34D" stroke="#B45309" stroke-width="3.2" stroke-linejoin="round"' +
      (tf ? ' transform="' + tf + '"' : '') + '/>';
  }

  var MOCHI_POSE = {
    stand: { lean: 0, lift: 0, look: 0, feet: [[36, 89, 0], [64, 89, 0]] },
    walk1: { lean: -6, lift: -1.5, look: 4, feet: [[35, 90, 0], [72, 85, -25]], arms: [[12, 58, -25], [89, 67, 20]] },
    walk2: { lean: 0, lift: -3, look: 4, feet: [[41, 90, 0], [59, 90, 0]], arms: [[11, 63, 0], [89, 63, 0]] },
    walk3: { lean: 6, lift: -1.5, look: 4, feet: [[28, 85, 25], [65, 90, 0]], arms: [[11, 67, -20], [88, 58, 25]] },
    jump: { lean: 0, lift: -3, look: 3, up: true, feet: [[39, 93, 18], [61, 93, -18]], arms: [[9, 52, -40], [91, 52, 40]] }
  };

  /* 小麻糬：身體（腳、小手、皇冠、OK 繃、臉；pose = 站、走路三格、跳） */
  function mochiBody(face, id, pose) {
    id = id || 'mo';
    var P = MOCHI_POSE[pose || 'stand'], dx = P.look;
    var tf = 'translate(0 ' + P.lift + ') rotate(' + P.lean + ' 50 90)';
    /* 小麻糬：一隻腳或一隻小手 */
    function limb(e, rx, ry, fill, sw) {
      return '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + e[2] + ' ' + e[0] + ' ' + e[1] + ')"' +
        ' fill="' + fill + '" stroke="' + MOCHI_INK + '" stroke-width="' + sw + '"/>';
    }
    var ex = 38 + dx, ex2 = 62 + dx;
    var eyes;
    if (face === 'dizzy') {
      eyes = '<path d="M38 52a1.6 1.6 0 1 1 3.2 0a3.2 3.2 0 1 1-6.4 0a4.8 4.8 0 1 1 9.6 0M62 52a1.6 1.6 0 1 1 3.2 0a3.2 3.2 0 1 1-6.4 0a4.8 4.8 0 1 1 9.6 0" fill="none" stroke="' + MOCHI_INK + '" stroke-width="2.6" stroke-linecap="round"/>' +
        '<ellipse cx="50" cy="66" rx="3.6" ry="4.4" fill="' + MOCHI_INK + '"/>';
    } else {
      eyes = '<ellipse cx="' + ex + '" cy="52" rx="3.8" ry="4.6" fill="' + MOCHI_INK + '"/><ellipse cx="' + ex2 + '" cy="52" rx="3.8" ry="4.6" fill="' + MOCHI_INK + '"/>' +
        '<circle cx="' + (ex + 1.3) + '" cy="50.4" r="1.3" fill="#fff"/><circle cx="' + (ex2 + 1.3) + '" cy="50.4" r="1.3" fill="#fff"/>' +
        (P.up
          ? '<ellipse cx="' + (50 + dx) + '" cy="61" rx="3.4" ry="4" fill="' + MOCHI_INK + '"/><ellipse cx="' + (50 + dx) + '" cy="62.6" rx="2" ry="1.5" fill="#FB7185"/>'
          : '<path d="M' + (45 + dx) + ' 59q5 5 10 0" fill="none" stroke="' + MOCHI_INK + '" stroke-width="2.8" stroke-linecap="round"/>');
    }
    return '<defs><radialGradient id="' + id + '" cx=".18" cy=".7" r=".62">' +
      '<stop offset="0" stop-color="#FAD5AE"/><stop offset=".55" stop-color="#FCE6CC"/><stop offset="1" stop-color="#FFFDF8"/></radialGradient></defs>' +
      '<g transform="translate(50 97) scale(.94) translate(-50 -97)">' +
      P.feet.map(function (f) { return limb(f, 6, 4.5, '#D5E3DA', 3); }).join('') +
      '<g transform="' + tf + '">' +
      (P.arms || []).map(function (a) { return limb(a, 6.5, 4.6, '#FFFDF8', 3); }).join('') +
      '<path d="' + MOCHI + '" fill="url(#' + id + ')" stroke="' + MOCHI_INK + '" stroke-width="4.2"/>' +
      '<ellipse cx="66" cy="30" rx="8" ry="4.5" fill="#fff" transform="rotate(25 66 30)"/>' +
      '<g transform="rotate(-52 27 76)"><rect x="18" y="71.5" width="18" height="9" rx="4.5" fill="#FBCFE8" stroke="#DB7FA8" stroke-width="1.8"/>' +
      '<rect x="23.5" y="73" width="7" height="6" rx="1.5" fill="#FDF2F8"/></g>' +
      '<ellipse cx="' + (29 + dx) + '" cy="60" rx="6" ry="3.8" fill="#FBB4B4"/><ellipse cx="' + (71 + dx) + '" cy="60" rx="6" ry="3.8" fill="#FBB4B4"/>' +
      eyes +
      (face === 'dizzy' ? crown('rotate(32 50 12) translate(14 -4)') : crown()) +
      '</g></g>';
  }

  /* 小麻糬：縮小放進火箭、飛碟裡的身體 */
  function miniMochi(tx, ty, s, id) {
    return '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' + mochiBody('', id) + '</g>';
  }

  var MATCHA_INK = '#4D7A55';
  var MATCHA_BODY =
    '<path d="M50 18C71 18 84 30 86 47C88 62 92 72 89 81C86 90 72 92 50 92C28 92 14 90 11 81C8 72 12 62 14 47C16 30 29 18 50 18Z"/>' +
    '<circle cx="23" cy="25" r="8"/><circle cx="14" cy="28" r="6"/><circle cx="21" cy="17" r="5.5"/>' +
    '<circle cx="77" cy="22" r="8"/><circle cx="85" cy="19" r="6"/><circle cx="76" cy="14" r="5.5"/>';

  var MATCHA_POSE = {
    stand: { lean: 0, lift: 0, look: 0, feet: [[28, 88, 0], [72, 88, 0]] },
    walk1: { lean: -6, lift: -1.5, look: 4, feet: [[28, 89, 0], [81, 82, -30]] },
    walk2: { lean: 0, lift: -3, look: 4, feet: [[34, 89, 0], [66, 89, 0]] },
    walk3: { lean: 6, lift: -1.5, look: 4, feet: [[19, 82, 30], [72, 89, 0]] },
    jump: { lean: 0, lift: -3, look: 3, up: true, feet: [[37, 89.5, 22], [63, 89.5, -22]] }
  };

  /* 小抹茶：身體（雲朵耳朵、白肚子、手、腳、臉；pose = 站、走路三格、跳） */
  function matchaBody(face, pose) {
    var P = MATCHA_POSE[pose || 'stand'], dx = P.look;
    var tf = 'translate(0 ' + P.lift + ') rotate(' + P.lean + ' 50 90)';
    var arms = P.up
      ? '<ellipse cx="13" cy="45" rx="5.5" ry="9" transform="rotate(-38 13 45)"/><ellipse cx="87" cy="45" rx="5.5" ry="9" transform="rotate(38 87 45)"/>'
      : '';
    var feet = P.feet.map(function (f) {
      return '<ellipse cx="' + f[0] + '" cy="' + f[1] + '" rx="8" ry="6.5" transform="rotate(' + f[2] + ' ' + f[0] + ' ' + f[1] + ')"/>';
    }).join('');
    var shape = '<g transform="' + tf + '">' + MATCHA_BODY + arms + '</g>' + feet;
    var ex = 38 + dx, ex2 = 62 + dx;
    var eyes;
    if (face === 'dizzy') {
      eyes = '<path d="M31 47q2.5-3 5 0t5 0t5 0M54 47q2.5-3 5 0t5 0t5 0M44 56q1.5-2 3 0t3 0t3 0" fill="none" stroke="#1C1917" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if (P.up) {
      eyes = '<path d="M' + (ex - 4.2) + ' 48.5q4.2-5.5 8.4 0M' + (ex2 - 4.2) + ' 48.5q4.2-5.5 8.4 0" fill="none" stroke="#1C1917" stroke-width="2.8" stroke-linecap="round"/>' +
        '<path d="M' + (45.5 + dx) + ' 52q4.5 7.5 9 0Z" fill="#1C1917" stroke="#1C1917" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M' + (47.6 + dx) + ' 55.6q2.4 1.8 4.8 0" fill="none" stroke="#FB7185" stroke-width="2" stroke-linecap="round"/>';
    } else {
      eyes = '<ellipse cx="' + ex + '" cy="47" rx="3.8" ry="4.4" fill="#1C1917"/><ellipse cx="' + ex2 + '" cy="47" rx="3.8" ry="4.4" fill="#1C1917"/>' +
        '<circle cx="' + (ex + 1.2) + '" cy="45.4" r="1.2" fill="#fff"/><circle cx="' + (ex2 + 1.2) + '" cy="45.4" r="1.2" fill="#fff"/>' +
        '<path d="M' + (46 + dx) + ' 52.5q4 3.5 8 0" fill="none" stroke="#1C1917" stroke-width="2.6" stroke-linecap="round"/>';
    }
    return '<g transform="translate(50 97) scale(.94) translate(-50 -97)">' +
      '<g fill="' + MATCHA_INK + '" stroke="' + MATCHA_INK + '" stroke-width="9">' + shape + '</g>' +
      '<g fill="#CBD8CC">' + shape + '</g>' +
      '<g transform="' + tf + '">' +
      '<ellipse cx="40" cy="31" rx="9" ry="4.5" fill="#fff" opacity=".55" transform="rotate(-18 40 31)"/>' +
      (P.up ? '' : '<path d="M21 62q-4 6 1 11M79 62q4 6-1 11" fill="none" stroke="' + MATCHA_INK + '" stroke-width="3" stroke-linecap="round"/>') +
      '<ellipse cx="' + (50 + dx / 2) + '" cy="71.5" rx="17.5" ry="14.5" fill="#fff" stroke="' + MATCHA_INK + '" stroke-width="3.5"/>' +
      '<ellipse cx="' + (30 + dx) + '" cy="56" rx="5.5" ry="3.6" fill="#F4B6C2"/><ellipse cx="' + (70 + dx) + '" cy="56" rx="5.5" ry="3.6" fill="#F4B6C2"/>' +
      eyes + '</g></g>';
  }

  /* 小抹茶：縮小放進火箭、飛碟裡的身體 */
  function miniMatcha(tx, ty, s) {
    return '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' + matchaBody('') + '</g>';
  }

  var THEMES = {
    orange: { band: '#FDBA74' },
    butter: { band: '#F2D88E' },
    sky: { band: '#7DD3FC' },
    lavender: { band: '#C4B5FD' },
    pink: { band: '#F9A8D4' },
    dusk: { band: '#FCA5A5' }
  };

  /* 藥盒（方塊）：白盒子、色帶、中間的膠囊 */
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

  /* 針（障礙物）：針身、針座；down = 倒過來掛在天花板 */
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
    /* 小膠囊：站著、暈倒 */
    egg: function () { return svg(100, 100, eggBody('')); },
    eggDizzy: function () { return svg(100, 100, eggBody('dizzy')); },

    /* 小膠囊：體溫計火箭 */
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

    /* 小膠囊：藥杯飛碟 */
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

    /* 針：紅色（一般）、藍色（雙胞胎「不一樣」的那根），朝上、朝下 */
    needle: function () { return needle('#F87171', '#DC2626', '#7F1D1D', false); },
    needleDown: function () { return needle('#F87171', '#DC2626', '#7F1D1D', true); },
    needleDiff: function () { return needle('#7DD3FC', '#0284C7', '#0C4A6E', false); },
    needleDownDiff: function () { return needle('#7DD3FC', '#0284C7', '#0C4A6E', true); },
    /* 藥盒：藍色（雙胞胎「不一樣」的那個） */
    blockDiff: function () { return block('#7DD3FC', '#0369A1'); },

    /* 彈簧墊：灰色底座 */
    padBase: function () {
      return svg(100, 12.5,
        '<rect x="5" y="2" width="90" height="9" rx="4.5" fill="#A8A29E" stroke="#44403C" stroke-width="2.8"/>' +
        '<path d="M14 4.6H86" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>');
    },
    /* 彈簧墊：黃色的蓋子 */
    padTop: function () {
      return svg(100, 26,
        '<path d="M9 21Q9 2 50 2Q91 2 91 21Z" fill="#FACC15" stroke="#854D0E" stroke-width="3.2" stroke-linejoin="round"/>' +
        '<rect x="4" y="17" width="92" height="7" rx="3.5" fill="#EAB308" stroke="#854D0E" stroke-width="2.8"/>' +
        '<path d="M38 15L50 7L62 15" fill="none" stroke="#854D0E" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M18 12Q23 7 31 5.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>');
    },

    /* 星星（收集品） */
    /* 雲朵：三種形狀（大團、兩團、長長扁扁） */
    cloud1: function () { return cloud([[60, 62, 28], [100, 46, 36], [142, 60, 28], [36, 74, 18], [166, 74, 18]], 30, 170, 'c1'); },
    cloud2: function () { return cloud([[72, 58, 30], [120, 54, 34], [152, 70, 20], [46, 72, 20]], 34, 166, 'c2'); },
    cloud3: function () { return cloud([[52, 70, 20], [86, 58, 26], [122, 60, 24], [154, 70, 18]], 34, 170, 'c3'); },

    star: function () {
      return svg(100, 100,
        '<path d="M50 6l12.5 26.5 29 3.6-21.3 20 5.5 28.7L50 70.6 24.3 84.8l5.5-28.7-21.3-20 29-3.6Z" fill="#FACC15" stroke="#A16207" stroke-width="5" stroke-linejoin="round"/>' +
        '<circle cx="42" cy="47" r="4" fill="#1C1917"/><circle cx="58" cy="47" r="4" fill="#1C1917"/>' +
        '<path d="M44.5 56q5.5 5 11 0" stroke="#1C1917" stroke-width="3.2" fill="none" stroke-linecap="round"/>');
    },

    /* 安心旗：還沒經過（灰色）、經過了（綠色、打勾） */
    flagOff: function () { return flag(false); },
    flagOn: function () { return flag(true); },

    /* 醫生（大魔王）：往下射、停下來、往上射；doctorIcon = 只有醫生本人的小圖 */
    doctorLower: function () { return doctor('lower'); },
    doctorStop: function () { return doctor('stop'); },
    doctorUpper: function () { return doctor('upper'); },
    doctorIcon: function () { return doctor('stop', true); },

    /* 小麻糬：站著、暈倒 */
    mochi: function () { return svg(100, 100, mochiBody('')); },
    mochiDizzy: function () { return svg(100, 100, mochiBody('dizzy')); },
    /* 小麻糬：走路三格、跳起來 */
    mochiWalk1: function () { return svg(100, 100, mochiBody('', 'mo', 'walk1')); },
    mochiWalk2: function () { return svg(100, 100, mochiBody('', 'mo', 'walk2')); },
    mochiWalk3: function () { return svg(100, 100, mochiBody('', 'mo', 'walk3')); },
    mochiJump: function () { return svg(100, 100, mochiBody('', 'mo', 'jump')); },

    /* 小麻糬：紅色火箭（從座艙探出頭） */
    mochiShip: function () {
      return svg(160, 100,
        '<path d="M34 59Q16 52 5 68Q16 84 34 77Z" fill="#FDE047" stroke="#F59E0B" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M34 63Q22 62 15 68Q22 74 34 73Z" fill="#FB923C"/>' +
        '<path d="M46 50L31 29Q29 25 35 26L72 48Z" fill="#DC4A2E" stroke="' + MOCHI_INK + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M46 86L33 96Q31 98 36 97L72 88Z" fill="#DC4A2E" stroke="' + MOCHI_INK + '" stroke-width="4" stroke-linejoin="round"/>' +
        miniMochi(65, 6, 0.56, 'mo2') +
        '<path d="M40 48H112C136 48 150 58 156 68C150 78 136 88 112 88H40Q32 88 32 80V56Q32 48 40 48Z" fill="#F2694A" stroke="' + MOCHI_INK + '" stroke-width="4"/>' +
        '<path d="M46 50.5V85.5M56 50.5V85.5" stroke="#fff" stroke-width="4.5"/>' +
        '<path d="M66 57H118" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>' +
        '<ellipse cx="93" cy="48.5" rx="25" ry="4.5" fill="#B9361F" stroke="' + MOCHI_INK + '" stroke-width="3.5"/>' +
        '<circle cx="134" cy="68" r="7" fill="#BAE6FD" stroke="' + MOCHI_INK + '" stroke-width="3.5"/>');
    },

    /* 小麻糬：飛碟（在玻璃罩裡揮手） */
    mochiUfo: function () {
      return svg(140, 100,
        '<ellipse cx="44" cy="79" rx="10" ry="6" fill="#FDE68A" stroke="' + MOCHI_INK + '" stroke-width="3"/>' +
        '<ellipse cx="70" cy="82" rx="10" ry="6" fill="#FDE68A" stroke="' + MOCHI_INK + '" stroke-width="3"/>' +
        '<ellipse cx="96" cy="79" rx="10" ry="6" fill="#FDE68A" stroke="' + MOCHI_INK + '" stroke-width="3"/>' +
        '<ellipse cx="70" cy="58" rx="31" ry="6" fill="#7DD3FC" stroke="' + MOCHI_INK + '" stroke-width="3"/>' +
        miniMochi(50, 20, 0.4, 'mo3') +
        '<ellipse cx="88" cy="41" rx="4.2" ry="5.4" fill="#FFFDF8" stroke="' + MOCHI_INK + '" stroke-width="2.4" transform="rotate(25 88 41)"/>' +
        '<path d="M36 60A34 46 0 0 1 104 60Z" fill="#DBEAFE" fill-opacity=".4" stroke="' + MOCHI_INK + '" stroke-width="3.5"/>' +
        '<path d="M45 40a26 30 0 0 1 11-17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>' +
        '<ellipse cx="70" cy="66" rx="62" ry="14" fill="#B9CDD0" stroke="' + MOCHI_INK + '" stroke-width="4"/>' +
        '<ellipse cx="70" cy="62" rx="46" ry="5" fill="#DCE8EA"/>' +
        '<circle cx="26" cy="68" r="4.5" fill="#FCD34D" stroke="#C2410C" stroke-width="2.2"/>' +
        '<circle cx="51" cy="73" r="4.5" fill="#FCD34D" stroke="#C2410C" stroke-width="2.2"/>' +
        '<circle cx="89" cy="73" r="4.5" fill="#FCD34D" stroke="#C2410C" stroke-width="2.2"/>' +
        '<circle cx="114" cy="68" r="4.5" fill="#FCD34D" stroke="#C2410C" stroke-width="2.2"/>');
    },

    /* 小抹茶：站著、暈倒 */
    matcha: function () { return svg(100, 100, matchaBody('')); },
    matchaDizzy: function () { return svg(100, 100, matchaBody('dizzy')); },
    /* 小抹茶：走路三格、跳起來 */
    matchaWalk1: function () { return svg(100, 100, matchaBody('', 'walk1')); },
    matchaWalk2: function () { return svg(100, 100, matchaBody('', 'walk2')); },
    matchaWalk3: function () { return svg(100, 100, matchaBody('', 'walk3')); },
    matchaJump: function () { return svg(100, 100, matchaBody('', 'jump')); },

    /* 小抹茶：白色火箭（圓窗戶裡看得到小抹茶） */
    matchaShip: function () {
      var K = '#1C1917', R = '#EF4444';
      return svg(160, 100,
        '<path d="M70 26Q58 5 38 5Q46 18 46 32Z" fill="' + R + '" stroke="' + K + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M70 78Q58 97 38 96Q46 86 46 72Z" fill="' + R + '" stroke="' + K + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<ellipse cx="30" cy="52" rx="8" ry="17" fill="#A8A29E" stroke="#57534E" stroke-width="3"/>' +
        '<path d="M24 42h6M23 48h7M23 56h7M24 62h6" stroke="#E7E5E4" stroke-width="2.2" stroke-linecap="round"/>' +
        '<ellipse cx="86" cy="52" rx="58" ry="30" fill="#fff"/>' +
        '<path d="M124 29.4Q112 52 124 74.6A58 30 0 0 0 124 29.4Z" fill="' + R + '"/>' +
        '<ellipse cx="86" cy="52" rx="58" ry="30" fill="none" stroke="' + K + '" stroke-width="4.5"/>' +
        '<path d="M40 52Q26 46 8 48Q4 52 8 56Q26 58 40 52Z" fill="' + R + '" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<defs><clipPath id="port"><circle cx="100" cy="51" r="11.5"/></clipPath></defs>' +
        '<circle cx="100" cy="51" r="12" fill="#F5F5F4"/>' +
        '<g clip-path="url(#port)">' + miniMatcha(83, 35, 0.34) + '</g>' +
        '<circle cx="100" cy="51" r="13" fill="none" stroke="' + K + '" stroke-width="4.5"/>');
    },

    /* 小抹茶：飛碟（黑框玻璃罩、一排黃燈） */
    matchaUfo: function () {
      var K = '#1C1917';
      return svg(140, 100,
        '<path d="M50 78L43 94M90 78L97 94" stroke="' + K + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M40 66V46A30 32 0 0 1 100 46V66Z" fill="#F1F5F9"/>' +
        miniMatcha(49, 24, 0.42) +
        '<path d="M40 64V46A30 32 0 0 1 100 46V64" fill="none" stroke="' + K + '" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="M50 34a22 24 0 0 1 12-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
        '<ellipse cx="70" cy="70" rx="60" ry="15" fill="#E7E5E4" stroke="#78716C" stroke-width="4.5"/>' +
        '<ellipse cx="70" cy="64.5" rx="44" ry="4" fill="#F5F5F4"/>' +
        '<circle cx="34" cy="72" r="5" fill="#FACC15" stroke="#A16207" stroke-width="1.6"/>' +
        '<circle cx="52" cy="75" r="5" fill="#FACC15" stroke="#A16207" stroke-width="1.6"/>' +
        '<circle cx="70" cy="76" r="5" fill="#FACC15" stroke="#A16207" stroke-width="1.6"/>' +
        '<circle cx="88" cy="75" r="5" fill="#FACC15" stroke="#A16207" stroke-width="1.6"/>' +
        '<circle cx="106" cy="72" r="5" fill="#FACC15" stroke="#A16207" stroke-width="1.6"/>');
    }
  };

  var CHARS = [
    { id: 'capsule', name: '小膠囊', body: 'egg', dizzy: 'eggDizzy', ship: 'ship', ufo: 'ufo',
      shipName: '體溫計火箭', ufoName: '藥杯飛碟', burst: ['#FB923C', '#FFF7ED', '#FDA4AF', '#FDBA74'] },
    { id: 'mochi', name: '小麻糬', body: 'mochi', dizzy: 'mochiDizzy', ship: 'mochiShip', ufo: 'mochiUfo',
      shipName: '紅色火箭', ufoName: '小飛碟', burst: ['#FCD34D', '#FFFDF8', '#FBB4B4', '#FAD5AE'],
      walk: ['mochiWalk1', 'mochiWalk2', 'mochiWalk3', 'mochiWalk2'], jump: 'mochiJump' },
    { id: 'matcha', name: '小抹茶', body: 'matcha', dizzy: 'matchaDizzy', ship: 'matchaShip', ufo: 'matchaUfo',
      shipName: '白色火箭', ufoName: '小飛碟', burst: ['#A9C2AC', '#FFFFFF', '#F4B6C2', '#CBD8CC'],
      walk: ['matchaWalk1', 'matchaWalk2', 'matchaWalk3', 'matchaWalk2'], jump: 'matchaJump' }
  ];

  /* 依 id 找角色 */
  function char(id) {
    for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === id) return CHARS[i];
    return CHARS[0];
  }

  /* 雲朵：幾團圓圓的雲疊在平平的底上，淡藍灰的邊、底下一點點陰影 */
  function cloud(puffs, x0, x1, id) {
    var shape = puffs.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '"/>'; }).join('') +
      '<rect x="' + x0 + '" y="62" width="' + (x1 - x0) + '" height="30" rx="15"/>';
    return svg(200, 100,
      '<defs><clipPath id="' + id + '">' + shape + '</clipPath></defs>' +
      '<g fill="#D6E4F0" stroke="#D6E4F0" stroke-width="6">' + shape + '</g>' +
      '<g fill="#fff">' + shape + '</g>' +
      '<ellipse cx="100" cy="92" rx="86" ry="14" fill="#E8F1F8" clip-path="url(#' + id + ')"/>');
  }

  /* 安心旗：桿子、三角旗、頂端的小圓球、底座 */
  function flag(on) {
    var fill = on ? '#4ADE80' : '#E7E5E4', dark = on ? '#15803D' : '#78716C';
    return svg(60, 120,
      '<rect x="4" y="111" width="20" height="7.5" rx="3.75" fill="#A8A29E" stroke="#57534E" stroke-width="2.5"/>' +
      '<rect x="11" y="14" width="6" height="99" rx="3" fill="#D6D3D1" stroke="#57534E" stroke-width="2.5"/>' +
      '<path d="M17 18L57 36L17 54Z" fill="' + fill + '" stroke="' + dark + '" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M23.5 36l4.5 4.5 8.5-9.5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
      '<circle cx="14" cy="10" r="7" fill="#FACC15" stroke="#A16207" stroke-width="2.5"/>' +
      '<circle cx="11.7" cy="7.7" r="2" fill="#fff" opacity=".85"/>');
  }

  var DOC_FRAME = { w: 54.1, h: 41.9, floor: 41.65 };
  var DOC_ART = {
    lower: {
      dx: 0.0444, layer: [-115.50032, -212.29507],
      needle: [0.5, 34.542],
      barrel: { x0: 11.33, x1: 33.17, y0: 30.42, y1: 38.5,
        d: 'M14.83 30.44L15.02 30.42L15.21 30.69L15.71 31.85L15.96 32.90L16.08 34.31L16.04 35.52L15.79 36.94L15.58 37.56L15.29 38.15L15.02 38.50L14.35 38.42L13.48 38.12L12.73 37.67L12.33 37.31L12.00 36.90L11.62 36.19L11.46 35.65L11.33 34.77L11.33 33.85L11.46 33.10L11.75 32.31L12.08 31.81L12.60 31.29L13.10 30.96L14.02 30.58ZM15.62 30.44L20.65 30.42L20.75 30.73L21.15 31.04L21.69 31.12L22.40 31.00L23.06 31.46L23.60 31.54L23.81 31.46L24.08 31.19L24.31 30.42L32.19 30.42L32.54 30.81L32.79 31.40L33.00 32.23L33.17 33.60L33.12 35.85L32.96 36.90L32.71 37.77L32.50 38.19L32.23 38.50L15.69 38.50L16.08 37.69L16.42 36.52L16.58 35.10L16.58 33.98L16.38 32.35L16.04 31.27Z' },
      fills: [
        ['#E8F1F6', 'M37.88 0.23L38.48 0.25L39.02 0.38L39.60 0.62L40.23 1.04L41.00 1.81L41.42 2.44L41.71 3.15L41.83 3.73L41.83 4.69L41.75 5.15L41.46 5.94L40.92 6.73L40.31 7.33L39.52 7.88L38.85 8.12L38.02 8.25L37.40 8.21L36.65 8.00L35.94 7.62L35.48 7.25L34.79 6.52L34.54 6.15L34.25 5.52L34.04 4.65L34.04 3.81L34.17 3.19L34.54 2.31L34.96 1.73L35.56 1.12L36.35 0.58L37.19 0.29ZM37.90 2.54L37.44 2.62L36.96 2.90L36.58 3.56L36.46 4.35L36.58 5.06L36.79 5.48L37.06 5.79L37.65 6.04L38.27 6.04L38.85 5.79L39.21 5.35L39.42 4.77L39.46 4.23L39.29 3.44L38.96 2.90L38.48 2.62Z'],
        ['#A5F3FC', 'M37.71 2.52L38.19 2.50L38.69 2.75L39.33 3.48L39.50 3.98L39.50 4.65L39.29 5.19L38.60 5.92L38.15 6.12L37.77 6.12L37.31 5.92L36.71 5.31L36.42 4.65L36.42 3.98L36.58 3.48L37.15 2.83L37.40 2.62Z'],
        ['#0891B2', 'M42.04 4.48L42.60 4.83L47.31 7.12L48.31 7.71L49.48 8.54L50.50 9.56L50.96 10.40L51.00 11.15L50.92 11.44L50.58 12.02L50.19 12.38L49.31 11.29L47.77 10.17L41.35 6.92L41.04 6.60L41.50 5.77L41.71 4.85Z'],
        ['#FFFDF8', 'M41.67 2.15L42.15 2.17L43.60 2.62L45.15 3.38L46.19 4.04L46.77 4.50L48.08 5.85L48.54 6.60L48.79 7.48L48.44 7.79L47.48 7.21L44.06 5.58L42.23 4.58L41.75 4.06L41.71 3.40L41.38 2.44ZM33.83 2.98L33.90 2.96L34.21 3.27L34.12 3.69L34.12 4.77L34.21 5.06L34.00 5.27L34.33 5.60L34.58 6.23L34.96 6.81L35.27 7.17L35.98 7.67L36.65 7.96L37.31 8.12L38.56 8.12L39.35 7.92L39.90 7.67L40.52 7.25L41.06 6.75L47.02 9.75L47.69 10.12L48.73 10.88L49.88 12.06L50.17 12.52L50.50 13.31L50.71 14.44L50.71 15.65L50.54 16.98L50.02 17.50L49.48 17.83L47.77 18.58L44.40 19.58L40.65 20.29L38.44 20.29L37.10 20.21L35.31 20.00L33.60 19.67L31.06 18.83L29.73 18.17L28.48 17.29L27.29 16.06L26.67 15.06L26.38 14.44L26.08 13.48L26.00 12.85L26.04 12.06L26.21 11.40L26.75 10.19L27.83 8.69L28.90 7.62L30.42 6.52L30.12 6.19L30.12 6.06L30.46 4.90L30.83 4.31L31.44 3.71L31.98 3.38L32.85 3.08ZM31.94 9.21L31.92 9.31L33.48 10.83L33.54 10.77ZM30.98 11.17L30.96 11.23L31.92 12.10L31.73 12.33L32.35 12.50L32.92 12.85ZM38.69 11.46L38.65 11.54ZM38.56 11.54L38.52 11.62ZM38.44 11.62L37.83 12.10ZM39.06 12.58L38.83 12.73L38.71 12.98L38.62 13.77L38.83 14.35L39.31 14.50L39.65 14.38L39.79 14.10L39.88 13.31L39.79 12.98L39.60 12.67L39.44 12.58ZM34.81 13.71L33.67 14.94L33.73 15.00L34.90 13.75L35.29 14.06L35.06 13.75ZM35.31 14.12L35.35 14.21ZM35.40 14.25L35.44 14.33ZM35.48 14.38L35.52 14.46ZM35.56 14.50L35.60 14.58ZM35.65 14.62L35.69 14.71ZM35.73 14.75L35.77 14.83ZM35.81 14.88L35.85 14.96ZM35.90 15.00L35.94 15.08ZM35.98 15.12L36.02 15.21ZM22.08 27.98L22.69 27.96L23.31 28.12L23.52 28.25L24.04 28.85L24.12 29.23L24.08 30.52L23.96 30.90L23.56 31.29L23.44 31.33L23.19 31.25L22.60 30.79L22.44 30.75L21.65 30.92L21.35 30.88L20.88 30.40L20.79 29.69L20.88 29.15L21.04 28.81L21.52 28.29ZM41.29 32.77L41.94 32.75L42.40 32.96L43.08 33.65L43.29 34.23L43.25 34.77L43.08 35.15L42.40 35.83L41.90 36.04L41.35 36.04L40.94 35.88L40.25 35.23L40.00 34.69L40.00 34.10L40.25 33.56L40.81 33.00Z'],
        ['#059669', 'M26.54 15.10L26.92 15.44L27.04 15.73L27.81 16.79L28.69 17.50L29.90 18.25L30.94 18.75L32.31 19.25L33.52 19.58L35.48 19.96L38.27 20.21L40.73 20.21L42.31 19.96L45.65 19.21L47.44 18.67L49.40 17.88L50.40 17.25L50.79 17.65L51.79 19.10L51.44 19.46L46.90 21.67L44.10 23.21L41.65 24.75L40.52 25.58L39.75 26.27L39.25 26.94L39.04 27.48L38.88 28.85L38.83 30.90L38.67 31.35L38.67 32.48L38.35 32.79L35.02 32.79L34.71 32.48L34.54 31.52L34.33 30.90L33.98 30.29L33.81 30.21L29.90 30.21L29.58 29.90L29.67 26.81L29.83 25.02L30.17 23.31L30.62 22.35L30.35 22.04L29.27 21.17L27.35 19.75L25.81 18.88L25.19 18.75L24.83 18.40L24.96 17.65L25.38 16.69L26.04 15.65Z'],
        ['#FFFFFF', 'M25.21 18.69L25.60 18.75L27.19 19.67L29.81 21.67L30.58 22.40L30.21 23.35L29.96 24.60L29.71 27.40L29.67 29.90L29.35 30.21L24.35 30.21L24.04 29.90L24.04 29.06L23.96 28.77L24.21 28.52L23.92 28.19L25.42 25.27L25.67 24.60L25.83 23.85L25.83 23.02L25.75 22.56L25.25 21.27L24.92 19.31L24.92 18.98ZM51.67 19.31L51.77 19.29L52.12 19.65L52.33 20.23L52.62 21.60L52.75 23.15L52.83 27.60L53.17 29.31L53.88 31.60L53.92 32.31L53.75 32.94L53.42 33.44L52.44 34.42L51.90 34.83L50.65 35.62L49.35 36.21L48.19 36.58L46.02 37.04L44.27 37.25L40.98 37.42L40.67 37.10L40.67 36.19L40.98 35.88L41.56 36.00L42.19 35.92L42.69 35.67L43.15 35.21L43.46 35.10L43.17 34.81L43.21 34.06L43.08 33.65L42.83 33.27L43.04 33.02L42.65 33.12L42.31 32.92L41.73 32.79L40.98 32.92L40.67 32.60L40.67 31.35L40.33 30.56L39.69 30.33L39.10 30.50L38.79 30.19L38.83 28.44L38.92 27.77L39.08 27.23L39.58 26.56L40.56 25.62L42.69 24.08L46.73 21.75ZM47.23 30.12L46.15 31.29L45.46 31.81L46.44 31.12L46.83 30.73ZM49.65 31.33L48.90 32.12L48.04 32.81L48.90 32.21L49.42 31.69ZM47.98 32.83L47.94 32.92ZM47.85 32.92L47.81 33.00ZM47.73 33.00L47.69 33.08Z'],
        ['#164E63', 'M47.29 36.73L47.40 36.71L47.71 37.02L46.92 37.90L46.62 38.35L46.42 38.98L46.10 39.29L45.48 39.12L44.40 39.12L43.90 39.21L42.52 39.67L41.81 40.12L41.04 39.27L40.58 38.31L40.67 37.65L40.98 37.33L44.77 37.12Z'],
        ['#0C3A4A', 'M27.88 38.73L31.31 38.71L31.62 39.06L31.12 40.02L30.31 40.75L29.98 40.92L29.44 41.04L27.81 41.00L26.98 40.83L26.58 40.44L26.58 40.27L27.17 39.44ZM44.54 39.06L45.31 39.04L45.73 39.12L46.06 39.25L46.42 39.60L46.38 40.65L46.29 40.81L45.69 41.33L45.06 41.46L44.48 41.46L43.69 41.33L42.65 40.88L41.88 40.19L42.19 39.88L42.94 39.46L43.81 39.17Z'],
        ['#ECFEFF', 'M14.83 30.15L15.02 30.12L15.35 30.42L15.65 30.12L20.65 30.12L21.15 30.75L21.69 30.83L22.40 30.71L23.06 31.17L23.60 31.25L23.83 31.10L24.00 30.44L24.31 30.12L32.19 30.12L32.67 30.56L32.96 31.06L33.21 31.85L33.42 33.06L33.46 35.40L33.33 36.48L33.00 37.77L32.71 38.31L32.23 38.79L15.69 38.79L15.38 38.48L15.40 38.42L15.02 38.79L14.77 38.79L13.48 38.42L12.73 37.96L12.04 37.31L11.71 36.90L11.33 36.19L11.17 35.65L11.04 34.77L11.08 33.52L11.25 32.81L11.58 32.10L12.60 31.00L13.65 30.42Z'],
        ['#0891B2', 'M32.92 30.15L33.65 30.12L34.21 30.65L34.67 31.77L34.92 33.40L34.92 35.56L34.71 36.98L34.29 38.15L33.69 38.79L32.94 38.79L32.62 38.48L33.08 37.35L33.38 35.52L33.38 33.44L33.25 32.35L33.04 31.44L32.62 30.48ZM39.46 30.31L39.85 30.29L40.06 30.42L40.58 30.98L40.75 31.48L40.75 32.94L40.29 33.44L40.04 34.15L40.04 34.65L40.17 35.10L40.38 35.48L40.75 35.85L40.75 37.60L40.54 38.15L39.98 38.71L39.77 38.79L39.35 38.71L38.79 38.15L38.58 37.60L38.58 31.48L38.83 30.85Z'],
        ['#CBD5E1', 'M35.08 32.73L38.35 32.71L38.67 33.02L38.67 36.02L38.35 36.33L35.10 36.33L34.79 36.02L34.88 35.06L34.79 33.02Z'],
        ['#22D3EE', 'M9.33 33.23L10.85 33.21L11.17 33.52L11.12 34.98L11.21 35.52L10.90 35.83L9.35 35.83L9.04 35.52L9.04 33.52Z'],
        ['#E8F1F6', 'M0.50 33.73L8.81 33.71L9.12 34.02L9.12 35.06L8.81 35.38L0.52 35.38L0.21 35.06L0.21 34.02Z']
      ],
      lines:
        '<ellipse cx="-153.45589" cy="216.59453" rx="1.5213542" ry="1.7859374" transform="scale(-1,1)"/>' +
        '<ellipse cx="-153.43739" cy="216.51382" rx="3.8695312" ry="3.96875" transform="scale(-1,1)"/>' +
        '<path d="m 156.46622,218.98377 c 6.64694,3.72925 10.71471,3.72962 9.49121,10.47612 -1.44751,1.24998 -5.73178,2.48576 -9.84269,3.07026 -10.51719,0.26458 -13.21539,-4.02384 -13.21539,-4.02384 -1.13832,-1.54247 -1.67364,-3.28053 -1.15129,-4.83418 1.28985,-3.83645 5.47893,-6.05674 7.97418,-6.04847"/>' +
        '<path d="m 165.65691,224.83106 c 3.8724,-3.97012 -7.21091,-6.84353 -8.34998,-8.31724"/>' +
        '<path d="m 164.23198,220.27226 c 0.35094,-3.26028 -5.90796,-6.15711 -7.46608,-5.78245"/>' +
        '<path d="m 149.7558,215.292 c -3.57597,0.0127 -3.99376,1.95599 -4.16521,3.71286"/>' +
        '<path d="m 165.95743,229.4599 c 0.64405,0.69211 1.10202,1.33533 1.43402,2.02106 z m 1.43402,2.02106 0.015,0.0207 -0.004,0.002 c -0.004,-0.007 -0.008,-0.0147 -0.0114,-0.0222 z m -13.07775,11.69076 c -0.0336,-1.55832 0.0746,-2.93756 0.23202,-3.48506 0.78534,-2.73195 12.8364,-8.17413 12.8571,-8.18348 0.79975,1.66844 0.83664,3.60095 0.83664,7.15099 0,5.02708 3.39267,5.87942 -1.56941,8.93485 -3.24704,1.99938 -8.34866,1.98468 -10.46293,2.07274"/>' +
        '<path d="m 163.97859,248.75658 c 0,0 -2.27386,1.5834 -2.12884,2.96484 0.14195,1.35219 0.0494,2.0631 -1.87089,1.96443 -2.73855,-0.14071 -3.96143,-2.79751 -3.87945,-3.41187"/>' +
        '<path d="m 161.84975,251.72142 c -1.21608,-0.8419 -3.7946,-0.0658 -4.5713,0.75792"/>' +
        '<path d="m 140.40967,231.02424 c -0.26866,-1.62431 1.69773,-3.82505 1.69773,-3.82505"/>' +
        '<path d="m 147.14897,251.00532 c 0,0 -0.24555,2.39633 -2.75909,2.29711 -2.51354,-0.0992 -3.03668,-0.25533 -1.14569,-2.25477"/>' +
        '<path d="m 156.54661,222.94454 c -1.71979,0.23151 -2.51355,0.89297 -3.40651,1.5875"/>' +
        '<path d="m 149.15639,223.24219 -1.88516,-1.85208"/>' +
        '<ellipse cx="-154.74573" cy="225.82187" rx="0.66145831" ry="0.9921875" transform="scale(-1,1)" fill="#000"/>' +
        '<path d="m 146.27904,223.34141 2.28204,1.91823 c 0,0 -1.15756,-1.25677 -3.27422,-0.13229"/>' +
        '<path d="m 151.66993,227.70703 -1.2237,-1.819 -1.38906,1.52135"/>' +
        '<path d="m 139.28839,240.74069 c 1.60123,-3.20244 2.73005,-4.50088 1.70106,-6.60563 -0.38947,-0.79663 -0.57978,-3.11082 -0.57978,-3.11082 0.95679,-0.54692 5.74019,3.62301 5.74019,3.62301 v 5.2e-4 c -0.61492,0.66812 -0.93367,3.25379 -0.99219,5.99808 l -0.0269,1.81153"/>' +
        '<path d="m 155.16377,242.59398 c 0.57818,0 1.04335,0.61391 1.04335,1.37666 v 1.37666 a 1.6205728,1.6205728 0 0 0 -0.70073,1.33377 1.6205728,1.6205728 0 0 0 0.70073,1.33067 v 1.65002 c 0,0.76276 -0.46517,1.37666 -1.04335,1.37666 -0.57818,0 -1.04386,-0.6139 -1.04386,-1.37666 v -5.69112 c 0,-0.76275 0.46568,-1.37666 1.04386,-1.37666 z"/>' +
        '<path d="m 150.12962,248.59077 h 3.99043 m 0,-3.54913 h -3.99043"/>' +
        '<path d="m 139.71265,242.45652 c 4.68712,5.2e-4 8.93282,10e-4 9.43909,10e-4 0.54652,0 1.24798,1.5905 1.24798,4.29483 0,2.70429 -0.70146,4.29483 -1.24798,4.29483 -0.96937,0 -18.51102,0.002 -18.51102,0.002 0,0 -4.003,-0.006 -4.06435,-4.31964 v -5.1e-4 c -0.0614,-4.31403 4.06435,-4.27313 4.06435,-4.27313 v 10e-5 c 0,0 3.40775,2.5e-4 5.8074,5.2e-4"/>' +
        '<path d="m 148.92618,246.75218 c 0,-2.70432 -0.70152,-4.29447 -1.24804,-4.29447"/>' +
        '<path d="m 148.92618,246.75218 c 0,2.70434 -0.70152,4.29448 -1.24804,4.29448"/>' +
        '<path d="m 130.64063,242.45577 c 0,0 1.18253,1.38193 1.18253,4.3079 0,3.22028 -1.18253,4.28473 -1.18253,4.28473"/>' +
        '<path d="m 126.61658,245.53118 h -2.0259 v 2.57005 h 2.0259"/>' +
        '<path d="m 124.65205,246.0207 h -8.90172 v 1.591 h 8.90172"/>' +
        '<circle cx="-157.12695" cy="246.68085" r="1.6205728" transform="scale(-1,1)"/>' +
        '<path d="m 158.11192,245.39396 c 0,0 3.99643,-1.05616 5.02542,-3.76895"/>' +
        '<path d="m 158.46476,247.59546 c 0,0 5.89903,-2.04921 6.97479,-4.48136"/>' +
        '<path d="m 142.27722,239.91093 c 0,0 -1.58469,1.09619 -2.98883,0.82976"/>' +
        '<path d="m 136.34582,241.90048 c 0,0.89502 -0.0394,1.55134 1.60403,1.0914 1.57732,1.45829 1.63712,-0.19638 1.63712,-1.0914 0,-0.89502 -0.1121,-1.49006 -1.62058,-1.62057 -0.89169,-0.0771 -1.62057,0.72555 -1.62057,1.62057 z"/>'
    },
    stop: {
      dx: 22.7321, layer: [-140.32984, -158.76389],
      fills: [
        ['#E8F1F6', 'M15.00 0.23L16.06 0.29L16.56 0.46L17.44 0.96L18.12 1.60L18.62 2.27L19.00 3.10L19.12 3.69L19.17 4.23L19.00 5.31L18.75 5.94L18.38 6.52L17.23 7.62L16.52 8.00L15.69 8.21L14.81 8.21L14.35 8.12L13.40 7.71L12.98 7.42L12.21 6.65L11.88 6.19L11.58 5.60L11.33 4.56L11.33 3.90L11.50 3.06L11.83 2.31L12.25 1.73L12.90 1.08L13.56 0.62L14.27 0.33ZM15.06 2.54L14.40 2.79L14.08 3.15L13.79 3.90L13.79 4.69L13.92 5.15L14.31 5.75L15.02 6.04L15.52 6.04L16.15 5.79L16.46 5.44L16.71 4.77L16.75 4.10L16.62 3.52L16.19 2.83L15.81 2.62Z'],
        ['#A5F3FC', 'M15.21 2.48L15.77 2.58L16.50 3.27L16.75 3.73L16.83 4.23L16.75 4.85L16.54 5.27L15.90 5.92L15.35 6.12L14.98 6.08L14.56 5.88L13.92 5.19L13.71 4.60L13.71 3.98L13.96 3.35L14.56 2.71L14.85 2.54Z'],
        ['#0891B2', 'M19.33 4.48L21.69 5.71L24.48 7.04L25.56 7.67L26.98 8.71L27.83 9.60L28.25 10.35L28.29 11.15L28.21 11.44L27.83 12.06L27.52 12.38L26.48 11.17L25.15 10.21L24.19 9.67L18.73 6.96L18.38 6.56L18.75 5.90L19.04 4.77Z'],
        ['#FFFDF8', 'M18.96 2.15L19.23 2.12L19.98 2.29L21.23 2.75L22.40 3.33L23.31 3.92L24.40 4.79L25.38 5.85L25.88 6.69L26.08 7.48L25.73 7.79L24.48 7.04L21.40 5.58L19.60 4.62L19.08 4.15L19.00 3.35L18.67 2.44ZM11.17 2.98L11.50 3.27L11.42 3.77L11.42 4.65L11.50 5.06L11.29 5.27L11.67 5.65L11.92 6.27L12.33 6.90L12.69 7.25L13.23 7.62L14.44 8.08L15.15 8.17L15.81 8.12L16.35 8.00L17.19 7.67L17.85 7.21L18.31 6.75L18.40 6.75L19.52 7.38L24.10 9.62L25.06 10.17L25.94 10.79L26.88 11.69L27.21 12.10L27.62 12.85L27.83 13.44L28.00 14.40L28.00 15.69L27.83 16.98L27.35 17.46L26.06 18.17L25.02 18.58L23.06 19.21L21.27 19.67L18.35 20.21L16.10 20.50L14.23 20.62L11.77 20.54L10.31 20.21L8.40 19.38L7.27 18.67L6.48 18.04L4.83 16.35L4.29 15.60L3.79 14.69L3.50 13.90L3.33 13.10L3.33 12.15L3.46 11.56L4.12 10.06L4.88 8.98L6.19 7.62L7.71 6.52L7.42 6.19L7.50 5.69L7.71 5.02L8.21 4.23L8.81 3.67L9.48 3.29L10.40 3.04ZM11.23 11.21L11.17 11.35L11.21 11.56L11.27 11.62L11.56 11.58L11.58 11.23ZM16.98 12.42L16.88 12.52L16.88 12.73L16.98 12.83L17.27 12.79L17.29 12.48Z'],
        ['#059669', 'M3.79 15.06L3.85 15.04L4.17 15.35L4.75 16.31L5.58 17.31L7.23 18.67L8.10 19.21L9.60 19.92L10.48 20.21L11.69 20.46L12.73 20.54L15.73 20.46L18.48 20.12L21.35 19.58L23.31 19.08L25.02 18.54L26.19 18.08L27.69 17.25L28.04 17.56L29.08 19.10L28.77 19.42L24.40 21.54L21.65 23.04L18.98 24.71L17.31 26.00L16.79 26.56L16.46 27.10L16.21 28.44L15.90 28.75L15.48 28.67L15.02 28.71L14.31 29.04L14.00 29.52L13.88 30.10L14.00 30.90L14.40 31.46L15.15 31.75L15.65 31.75L15.90 31.67L16.21 31.98L16.33 33.48L16.50 34.27L16.46 34.56L15.81 35.21L15.02 35.54L14.23 35.67L12.44 35.58L10.44 35.17L8.94 34.67L7.85 34.17L7.17 33.60L7.00 32.19L6.96 30.94L7.27 30.62L7.52 30.71L8.06 30.71L8.65 30.50L8.96 30.15L9.12 29.56L9.04 28.90L8.88 28.56L8.65 28.33L8.06 28.12L7.56 28.12L7.27 28.21L6.96 27.90L7.00 26.40L7.25 24.27L7.50 23.19L7.92 22.31L7.88 22.19L6.90 21.25L5.10 19.79L3.73 18.96L2.98 18.71L2.44 18.71L2.12 18.40L2.12 17.85L2.38 17.02L2.96 16.02Z'],
        ['#FFFFFF', 'M2.50 18.65L2.90 18.62L3.19 18.71L4.40 19.33L6.23 20.75L7.92 22.35L7.58 23.10L7.33 24.19L7.12 25.73L7.00 28.02L6.75 28.27L7.06 28.29L7.65 28.04L8.15 28.08L8.56 28.33L8.92 28.69L9.12 29.02L9.21 29.44L9.12 29.81L8.96 30.10L8.27 30.71L8.02 30.79L7.60 30.79L7.06 30.50L6.79 30.48L7.04 30.81L7.17 33.23L7.62 35.77L7.58 36.06L7.19 36.46L6.35 36.33L4.73 35.83L3.40 35.71L2.65 35.42L2.06 35.04L1.29 34.31L0.75 33.56L0.38 32.69L0.21 31.81L0.21 31.06L0.50 29.73L2.46 25.85L2.83 24.94L3.08 23.94L3.12 23.27L3.04 22.56L2.50 21.06L2.21 19.02L2.21 18.94ZM29.04 19.27L29.38 19.56L29.54 19.94L29.92 21.56L30.04 23.02L30.12 27.56L30.50 29.44L31.00 30.94L31.21 31.85L31.17 32.52L30.88 33.19L29.69 34.42L28.52 35.25L27.10 36.00L25.73 36.50L23.73 36.96L21.73 37.21L18.27 37.33L17.90 37.17L17.08 36.27L16.58 35.02L16.25 33.40L16.12 32.19L16.12 31.90L16.38 31.65L16.15 31.58L15.60 31.83L15.23 31.83L14.69 31.62L14.00 30.94L13.83 30.56L13.83 29.90L14.00 29.52L14.60 28.88L15.10 28.62L15.69 28.62L16.02 28.79L16.31 28.83L16.12 28.60L16.17 28.10L16.29 27.44L16.50 27.02L17.65 25.79L18.98 24.75L21.23 23.29L23.44 22.04L27.60 19.92ZM4.19 27.29L4.12 27.35L4.40 27.54ZM24.40 27.46L23.75 28.06L24.15 27.83ZM4.48 27.54L4.52 27.62ZM27.15 28.96L24.96 30.81L25.60 30.38ZM3.31 29.00L3.29 29.06L3.44 29.21L3.71 29.35ZM24.90 30.83L24.85 30.92Z'],
        ['#164E63', 'M7.58 34.02L8.81 34.58L10.48 35.12L11.77 35.42L13.06 35.58L14.27 35.58L15.10 35.46L16.02 35.08L16.35 34.79L16.71 35.15L16.96 35.98L17.42 36.81L17.65 37.04L18.19 37.25L18.44 37.50L18.73 37.25L19.85 37.25L22.23 37.08L23.31 36.96L24.52 36.71L24.60 36.71L24.92 37.02L24.04 37.90L23.67 38.56L23.62 38.90L23.27 39.25L22.65 39.08L21.60 39.08L20.52 39.33L19.73 39.71L18.90 39.29L18.46 38.81L18.31 38.29L18.10 38.50L17.44 38.33L16.81 38.33L14.94 38.62L13.90 38.71L12.19 38.29L11.40 38.25L10.98 38.38L10.60 38.62L9.56 39.71L9.19 39.92L8.44 39.96L6.31 39.67L5.27 39.33L4.67 38.73L4.54 38.31L4.50 37.19L4.25 36.06L4.56 35.75L6.69 36.38L7.35 36.38L7.50 36.19L7.54 35.60L7.29 34.31Z'],
        ['#0C3A4A', 'M21.71 39.02L22.52 39.00L22.98 39.08L23.40 39.25L23.75 39.60L23.92 40.06L23.92 40.35L23.83 40.56L23.40 41.00L23.10 41.17L22.31 41.38L20.40 41.42L19.48 41.12L19.12 40.77L19.08 40.60L19.21 40.35L19.94 39.58L20.90 39.17ZM5.00 39.23L6.44 39.62L8.23 39.88L8.77 39.88L9.08 40.23L8.27 41.12L7.44 41.54L6.69 41.67L6.06 41.67L4.69 41.50L4.27 41.33L3.92 40.98L3.88 40.73L4.12 40.23Z']
      ],
      lines:
        '<ellipse cx="-155.59776" cy="163.06332" rx="1.5213542" ry="1.7859374" transform="scale(-1,1)"/>' +
        '<ellipse cx="-155.57928" cy="162.98262" rx="3.8695312" ry="3.96875" transform="scale(-1,1)"/>' +
        '<path d="m 158.60809,165.45258 c 6.64694,3.72925 10.71471,3.72962 9.49121,10.47613 -2.18261,1.88477 -10.81484,3.73724 -15.57734,3.37344 -4.7625,-0.36381 -9.92188,-5.32474 -8.63203,-9.16121 1.28984,-3.83645 5.47893,-6.05674 7.97418,-6.04847"/>' +
        '<path d="m 167.79878,171.29987 c 3.8724,-3.97012 -7.21091,-6.84353 -8.34998,-8.31724"/>' +
        '<path d="m 166.37385,166.74107 c 0.35094,-3.26027 -5.90796,-6.15711 -7.46608,-5.78245"/>' +
        '<path d="m 151.89767,161.76081 c -3.57597,0.0127 -3.99376,1.956 -4.16521,3.71286"/>' +
        '<path d="m 156.49003,187.64019 c 0.0428,-0.66526 0.11381,-1.19283 0.19777,-1.4849 0.78601,-2.7343 12.86061,-8.18494 12.86061,-8.18494 l -1.44911,-2.04164 c 2.21589,2.38125 2.28203,4.16719 2.28203,9.19427 0,5.02708 3.39282,5.87953 -1.56926,8.93496 -3.24704,1.99938 -7.83924,1.94256 -9.95351,2.03062 -1.6145,0.0673 -2.23669,-2.93544 -2.37883,-5.69731"/>' +
        '<path d="m 166.12046,195.2254 c 0,0 -2.73688,1.74876 -2.12884,2.96484 0.60804,1.21608 0.0468,1.82411 -1.87089,1.96443 -1.91766,0.14032 -3.32082,-0.32741 -2.33861,-1.30962 0.98222,-0.98222 -1.7068,0.0997 -0.92356,-2.75649"/>' +
        '<path d="m 163.99162,198.19024 c -1.21608,-0.8419 -3.92391,-0.0988 -4.2095,0.65481"/>' +
        '<path d="m 147.30571,189.2242 c 0.0483,1.75685 0.20114,3.39467 0.45579,4.42919 0.7051,2.86448 -1.35634,0.9356 -3.2272,0.88883 -2.89935,-0.0725 -5.05155,-3.3674 -3.36775,-6.73499 1.60123,-3.20244 2.99373,-5.09842 1.96474,-7.20317 -0.38947,-0.79663 -0.43079,-2.20141 -0.57878,-3.10782 -3.2e-4,-8.7e-4 -7.4e-4,-0.002 -0.001,-0.003 l 0.001,5.1e-4 c 0.0972,-0.0443 0.20487,-0.0692 0.32091,-0.0765 1.74066,-0.10844 5.41828,3.699 5.41828,3.699 v 5.2e-4 c -0.61492,0.66812 -0.93367,3.25379 -0.99219,5.99808"/>' +
        '<path d="m 142.55154,177.49306 c -0.4493,-1.89378 1.69773,-3.82505 1.69773,-3.82505"/>' +
        '<path d="m 156.83531,193.27458 c -1.23757,2.43173 -8.10905,0.34246 -9.28698,-0.77918"/>' +
        '<path d="m 158.79258,197.53817 c -1.01203,-1.03811 -3.16177,0.0202 -4.65005,-0.11206 -1.48828,-0.1323 -2.34818,-1.05834 -3.40651,0.26458 -1.05833,1.32292 -1.42213,1.05833 -3.30729,0.82682 -1.88516,-0.23151 -2.51354,-0.52917 -2.51354,-1.65364 0,-1.12448 -0.38086,-2.32183 -0.38086,-2.32183"/>' +
        '<path d="m 149.57742,198.64623 c 0,0 -0.46197,1.85566 -2.97551,1.75644 -2.51354,-0.0992 -3.15359,-0.46597 -1.2626,-2.46541"/>' +
        '<circle cx="-157.43182" cy="171.3886" r="0.25000051" transform="scale(-1,1)" fill="#000"/>' +
        '<circle cx="-151.72562" cy="170.17252" r="0.25000051" transform="scale(-1,1)" fill="#000"/>' +
        '<path d="m 158.21427,175.51496 -8.90853,-2.08137" fill="#000"/>' +
        '<path d="m 168.5954,187.1735 c -2.08359,0.72761 -2.38125,2.57969 -5.32474,3.30729 -2.94349,0.72761 -6.79254,-0.16097 -6.79254,-0.16097 -0.21851,0.18884 -0.46736,0.25087 -0.72021,0.2521 -0.87079,8e-5 -1.57673,-0.70585 -1.57665,-1.57664 2e-4,-0.87059 0.70606,-1.57622 1.57665,-1.57614 0.2566,0.001 0.50903,0.0651 0.73372,0.20354 0,0 7.35847,0.94424 8.44987,-1.73466"/>' +
        '<path d="m 144.34033,185.9471 c 0.76371,0.94271 2.95762,1.16825 2.95762,1.16825 0.24005,-0.14816 0.54113,-0.25632 0.8519,-0.25638 h 2.5e-4 c 0.73946,3e-5 1.33891,0.59948 1.33894,1.33894 2.5e-4,0.73966 -0.59928,1.33942 -1.33894,1.33945 -0.30767,-8.3e-4 -0.60567,-0.10758 -0.8457,-0.3146 0,0 -3.00781,-0.44143 -3.83463,-1.59898"/>'
    },
    upper: {
      dx: -0.0891, layer: [-116.55857, -105.4034],
      needle: [0.5, 20.583],
      barrel: { x0: 11.33, x1: 33.17, y0: 16.5, y1: 24.58,
        d: 'M14.75 16.52L15.02 16.50L15.08 16.56L15.58 17.56L15.96 18.94L16.08 20.19L16.04 21.60L15.88 22.69L15.54 23.73L15.02 24.58L14.10 24.42L13.44 24.17L12.81 23.79L12.17 23.19L11.62 22.23L11.46 21.69L11.33 20.85L11.33 20.02L11.46 19.19L11.75 18.40L12.04 17.94L12.44 17.50L13.15 17.00L13.81 16.71ZM15.62 16.52L32.23 16.50L32.50 16.81L32.88 17.77L33.04 18.56L33.17 19.77L33.12 21.85L32.96 22.94L32.71 23.81L32.46 24.31L32.27 24.54L32.15 24.58L15.69 24.58L16.12 23.65L16.46 22.35L16.58 21.19L16.58 19.98L16.50 19.10L16.25 17.94L15.88 16.94Z' },
      fills: [
        ['#E8F1F6', 'M37.79 0.23L38.31 0.21L39.02 0.33L39.81 0.67L40.31 1.00L41.38 2.15L41.75 2.90L41.96 3.77L41.96 4.69L41.83 5.27L41.50 6.06L41.17 6.56L39.98 7.67L39.23 8.04L38.52 8.21L37.60 8.21L37.02 8.08L36.35 7.79L35.81 7.42L34.96 6.56L34.62 6.06L34.29 5.27L34.17 4.65L34.17 3.81L34.29 3.19L34.58 2.44L35.00 1.81L35.77 1.04L36.31 0.67L37.10 0.33ZM37.90 2.54L37.27 2.75L36.88 3.19L36.62 3.85L36.62 4.73L36.92 5.48L37.15 5.75L37.81 6.04L38.35 6.04L38.90 5.83L39.25 5.48L39.54 4.73L39.54 3.85L39.29 3.19L39.02 2.83L38.48 2.58Z'],
        ['#A5F3FC', 'M38.04 2.48L38.35 2.50L38.77 2.71L39.29 3.23L39.62 3.94L39.62 4.65L39.42 5.19L38.73 5.92L38.19 6.12L37.77 6.08L37.44 5.92L36.83 5.31L36.54 4.65L36.54 3.94L36.88 3.23L37.52 2.62Z'],
        ['#0891B2', 'M42.12 4.52L42.23 4.50L42.90 4.92L47.15 6.96L48.65 7.83L49.60 8.54L50.62 9.56L51.04 10.27L51.12 10.56L51.12 11.10L50.96 11.60L50.75 11.94L50.31 12.38L49.40 11.25L48.10 10.29L46.69 9.50L41.48 6.92L41.17 6.60L41.62 5.77L41.83 4.81Z'],
        ['#FFFDF8', 'M41.79 2.15L42.06 2.12L42.65 2.25L43.85 2.67L45.15 3.29L46.48 4.17L46.90 4.50L48.21 5.85L48.75 6.81L48.88 7.48L48.56 7.79L47.06 6.92L43.27 5.12L42.27 4.50L41.88 4.06L41.83 3.40L41.50 2.44ZM33.92 2.98L34.02 2.96L34.33 3.27L34.25 3.69L34.25 4.73L34.33 5.06L34.12 5.27L34.50 5.65L34.83 6.44L35.12 6.85L35.98 7.58L36.56 7.88L37.27 8.08L37.98 8.17L38.65 8.12L39.56 7.88L40.15 7.58L40.56 7.29L41.15 6.71L42.10 7.25L46.77 9.54L47.69 10.04L48.81 10.83L50.00 12.06L50.29 12.52L50.62 13.31L50.83 14.48L50.83 15.56L50.62 17.02L50.23 17.42L49.73 17.75L48.90 18.17L46.60 19.00L43.48 19.79L40.98 20.21L40.67 19.90L40.67 17.56L40.58 17.15L40.33 16.65L39.85 16.42L39.44 16.42L39.19 16.50L38.88 16.81L38.67 17.40L38.67 18.52L38.31 18.88L35.06 18.88L34.71 18.52L34.58 17.77L34.38 17.10L33.94 16.33L27.73 16.29L27.29 15.85L26.88 15.19L26.46 14.31L26.25 13.65L26.12 12.73L26.17 12.06L26.58 10.77L27.12 9.77L27.92 8.73L29.35 7.33L30.54 6.52L30.25 6.19L30.25 6.06L30.50 5.10L30.92 4.35L31.52 3.75L32.19 3.33L32.98 3.08ZM32.56 8.17L34.10 9.75L34.17 9.73L32.65 8.17ZM31.60 10.12L32.58 11.02L32.35 11.29L32.85 11.38L33.58 11.77ZM39.19 10.50L39.00 10.65ZM38.94 10.67L38.46 11.02L38.52 11.04ZM39.77 11.50L39.56 11.58L39.38 11.85L39.29 12.15L39.29 12.77L39.38 13.06L39.56 13.33L40.06 13.42L40.42 13.10L40.54 12.52L40.50 12.10L40.23 11.58ZM35.44 12.67L34.33 13.85L34.40 13.92L35.54 12.69ZM35.60 12.67L35.94 13.04L35.79 12.77ZM35.98 13.08L36.48 13.83ZM36.52 13.88L36.56 13.96ZM36.60 14.00L36.65 14.08ZM40.21 21.31L41.06 21.29L41.48 21.42L41.98 21.71L42.88 22.65L43.12 23.23L43.17 23.73L42.85 24.04L40.77 25.46L39.77 26.29L39.23 26.00L38.46 25.23L38.08 24.44L38.04 23.44L38.21 22.90L38.46 22.48L39.15 21.79L39.77 21.42ZM22.33 24.81L25.31 24.79L25.62 25.10L25.00 26.44L24.65 26.79L23.98 26.79L23.06 26.50L22.33 25.81L22.04 25.19L22.04 25.10Z'],
        ['#059669', 'M26.62 15.06L26.69 15.04L27.00 15.35L27.33 15.98L27.02 16.29L26.15 16.29L25.83 15.98ZM50.46 17.27L50.52 17.25L50.92 17.65L51.92 19.06L51.60 19.42L46.98 21.67L43.40 23.71L43.08 23.40L42.96 22.85L42.75 22.44L42.27 21.88L41.60 21.50L40.98 21.38L40.67 21.06L40.67 20.48L40.98 20.17L43.40 19.75L46.56 18.96L49.02 18.08L50.02 17.58ZM35.00 22.35L38.06 22.33L38.38 22.65L38.21 22.98L38.08 23.65L38.12 24.35L38.33 25.02L38.67 25.56L39.06 25.92L39.40 26.08L39.75 26.44L39.42 26.85L39.21 27.31L39.00 28.73L39.00 31.94L39.33 34.48L38.69 35.17L37.85 35.54L37.06 35.67L36.06 35.67L34.69 35.50L33.27 35.17L31.35 34.50L30.48 34.04L29.96 33.52L29.75 30.90L29.75 27.60L29.96 25.10L30.27 24.79L33.90 24.75L34.21 24.35L34.42 23.85L34.67 22.73Z'],
        ['#FFFFFF', 'M51.83 19.27L51.90 19.25L52.21 19.56L52.33 19.85L52.75 21.65L52.88 23.19L52.96 27.65L53.12 28.65L53.88 31.10L54.04 31.98L53.96 32.65L53.67 33.23L52.56 34.38L51.60 35.08L50.02 35.96L48.81 36.42L46.56 36.96L45.02 37.17L42.27 37.33L41.06 37.33L40.77 37.21L40.17 36.65L39.75 35.98L39.42 35.06L39.12 33.73L38.92 31.77L38.88 30.10L39.00 27.98L39.25 27.15L39.73 26.58L41.62 28.81L42.69 29.83L43.73 30.62L42.52 29.58L41.54 28.60L39.79 26.48L40.48 25.79L41.35 25.08L43.10 23.92L44.83 25.94L45.77 26.83L46.90 27.71L44.71 25.69L43.25 23.94L43.65 23.54L46.10 22.12ZM25.88 24.81L29.73 24.79L30.04 25.10L29.83 27.40L29.83 31.15L29.96 32.98L30.17 34.44L30.42 35.48L30.42 36.02L30.02 36.46L29.69 36.46L27.52 35.83L26.23 35.71L25.40 35.38L24.69 34.88L24.08 34.27L23.50 33.44L23.25 32.85L23.04 31.90L23.04 30.90L23.17 30.23L23.54 29.23L24.88 26.69L25.54 25.15ZM46.98 27.71L47.17 27.85ZM43.81 30.62L44.00 30.77Z'],
        ['#164E63', 'M30.38 34.02L31.85 34.67L33.15 35.08L34.60 35.42L35.90 35.58L37.10 35.58L37.77 35.50L38.56 35.25L39.19 34.79L39.50 35.10L39.83 36.10L40.33 36.94L40.60 37.12L40.98 37.25L41.27 37.54L41.56 37.25L45.06 37.08L46.15 36.96L47.35 36.71L47.71 37.02L46.83 37.94L46.54 38.44L46.42 38.94L46.10 39.25L45.44 39.08L44.27 39.12L43.10 39.42L42.56 39.71L41.77 39.33L41.25 38.77L41.15 38.29L40.94 38.50L40.27 38.33L39.65 38.33L37.77 38.62L36.73 38.71L35.81 38.54L35.02 38.29L34.23 38.25L33.52 38.54L32.44 39.67L32.02 39.92L31.27 39.96L29.35 39.71L28.73 39.58L28.02 39.29L27.46 38.69L27.38 38.40L27.33 37.27L27.08 36.06L27.40 35.75L29.52 36.38L29.94 36.42L30.23 36.33L30.38 35.81L30.29 35.10L30.08 34.31Z'],
        ['#0C3A4A', 'M44.50 39.02L45.35 39.00L45.81 39.08L46.23 39.25L46.58 39.60L46.75 40.10L46.71 40.48L46.02 41.12L45.35 41.33L44.73 41.42L43.23 41.42L42.44 41.21L41.92 40.73L41.92 40.56L42.04 40.35L42.90 39.50L43.73 39.17ZM27.83 39.23L29.23 39.62L31.02 39.88L31.60 39.88L31.92 40.23L31.15 41.08L30.27 41.54L29.52 41.67L27.69 41.54L27.15 41.38L26.71 40.94L26.71 40.69L27.04 40.10Z'],
        ['#ECFEFF', 'M14.75 16.23L15.02 16.21L15.35 16.50L15.65 16.21L32.23 16.21L32.71 16.69L32.96 17.15L33.25 18.10L33.42 19.19L33.42 21.85L33.25 22.94L33.00 23.81L32.62 24.48L32.15 24.88L15.69 24.88L15.38 24.56L15.40 24.50L14.98 24.88L14.10 24.71L13.44 24.46L12.60 23.92L11.88 23.19L11.42 22.44L11.08 21.23L11.08 19.65L11.25 18.90L11.50 18.31L11.75 17.94L12.44 17.21L13.48 16.54L14.27 16.29Z'],
        ['#0891B2', 'M32.92 16.23L33.69 16.21L34.29 16.85L34.71 18.06L34.92 19.52L34.92 21.48L34.71 22.98L34.50 23.73L34.25 24.27L33.65 24.88L32.94 24.88L32.62 24.56L33.12 23.23L33.38 21.44L33.38 19.56L33.25 18.44L33.04 17.52L32.62 16.56ZM39.54 16.35L39.98 16.42L40.50 16.94L40.71 17.40L40.75 21.02L40.44 21.33L39.60 21.50L38.90 21.92L38.58 21.60L38.58 17.48L38.67 17.19L38.92 16.81L39.23 16.50Z'],
        ['#CBD5E1', 'M35.08 18.81L38.35 18.79L38.67 19.10L38.67 22.06L38.31 22.42L35.10 22.42L34.79 22.10L34.88 20.85L34.79 19.10Z'],
        ['#22D3EE', 'M9.33 19.31L10.85 19.29L11.17 19.60L11.12 20.98L11.25 21.60L10.94 21.92L9.35 21.92L9.04 21.60L9.04 19.60Z'],
        ['#E8F1F6', 'M0.54 19.77L8.81 19.75L9.12 20.06L9.12 21.10L8.81 21.42L0.52 21.42L0.21 21.10L0.21 20.10Z']
      ],
      lines:
        '<path d="m 157.17262,126.71785 a 2.5500004,2.5500004 0 0 1 2.54971,2.54971 2.5500004,2.5500004 0 0 1 -5.1e-4,0.006 c -1.34696,0.8403 -2.53288,1.68747 -3.25923,2.44223 a 2.5500004,2.5500004 0 0 1 -1.8402,-2.44843 2.5500004,2.5500004 0 0 1 2.55023,-2.54971 z"/>' +
        '<ellipse cx="-154.64772" cy="109.70287" rx="1.5213542" ry="1.7859374" transform="scale(-1,1)"/>' +
        '<ellipse cx="-154.62923" cy="109.62215" rx="3.8695312" ry="3.96875" transform="scale(-1,1)"/>' +
        '<path d="m 157.65806,112.0921 c 6.64694,3.72925 10.71471,3.72962 9.49121,10.47613 -1.44751,1.24998 -5.73178,2.48576 -9.84269,3.07026 m -13.21539,-4.02384 c -1.13832,-1.54247 -1.67364,-3.28053 -1.15129,-4.83418 1.28985,-3.83646 5.47893,-6.05675 7.97418,-6.04848"/>' +
        '<path d="m 166.84875,117.93939 c 3.8724,-3.97012 -7.21091,-6.84353 -8.34998,-8.31724"/>' +
        '<path d="m 165.42382,113.38059 c 0.35094,-3.26027 -5.90796,-6.15711 -7.46608,-5.78245"/>' +
        '<path d="m 150.94764,108.40034 c -3.57597,0.0127 -3.99376,1.95599 -4.16521,3.71285"/>' +
        '<path d="m 167.14927,122.56823 c 2.21589,2.38125 2.28203,4.16719 2.28203,9.19427 0,5.02708 3.39282,5.87953 -1.56926,8.93496 -3.24704,1.99938 -7.83924,1.94256 -9.95351,2.03062 -2.69887,0.11241 -2.62483,-8.35379 -2.17079,-9.93327 0.78601,-2.7343 12.86061,-8.18494 12.86061,-8.18494 z"/>' +
        '<path d="m 167.38247,137.70429 c -2.0339,-0.85676 -3.49628,0.31807 -6.16827,-1.11511 -2.672,-1.43318 -4.88879,-4.72912 -4.88879,-4.72912"/>' +
        '<path d="m 165.17043,141.86492 c 0,0 -2.73688,1.74876 -2.12884,2.96484 0.60804,1.21608 0.0468,1.82411 -1.87089,1.96443 -1.91766,0.14032 -3.32082,-0.32741 -2.33861,-1.30962 0.98222,-0.98222 -1.7068,0.0997 -0.92356,-2.75649"/>' +
        '<path d="m 163.04159,144.82976 c -1.21608,-0.8419 -3.92391,-0.0988 -4.2095,0.65481"/>' +
        '<path d="m 146.59212,130.27615 c -0.4129,3.03924 -0.31458,7.8474 0.21937,10.01658 0.7051,2.86448 -1.35633,0.9356 -3.22719,0.88883 -2.89935,-0.0725 -5.05155,-3.36739 -3.36775,-6.73498 0.83896,-1.67791 1.62062,-2.99718 2.02671,-4.17573"/>' +
        '<path d="m 142.18,121.66757 c 0.50308,-0.8058 1.11924,-1.36004 1.11924,-1.36004"/>' +
        '<path d="m 155.88528,139.9141 c -1.23757,2.43173 -8.10905,0.34246 -9.28698,-0.77918"/>' +
        '<path d="m 157.84255,144.17769 c -1.01203,-1.03811 -3.16177,0.0202 -4.65005,-0.11206 -1.48828,-0.1323 -2.34818,-1.05834 -3.40651,0.26458 -1.05833,1.32292 -1.42213,1.05833 -3.30729,0.82682 -1.88516,-0.23151 -2.51354,-0.52917 -2.51354,-1.65364 0,-1.12448 -0.38086,-2.32183 -0.38086,-2.32183"/>' +
        '<path d="m 148.62739,145.28575 c 0,0 -0.46197,1.85566 -2.97551,1.75644 -2.51354,-0.0992 -3.15359,-0.46597 -1.2626,-2.46541"/>' +
        '<path d="m 158.26762,114.99453 c -1.71979,0.23151 -2.51355,0.89297 -3.40651,1.5875"/>' +
        '<path d="m 150.8774,115.29219 -1.88516,-1.85209"/>' +
        '<ellipse cx="-156.46672" cy="117.87188" rx="0.66145831" ry="0.9921875" transform="scale(-1,1)" fill="#000"/>' +
        '<path d="m 148.00005,115.39141 2.28204,1.91822 c 0,0 -1.15756,-1.25677 -3.27422,-0.13229"/>' +
        '<path d="m 153.39094,119.75703 -1.2237,-1.81901 -1.38906,1.52136"/>' +
        '<path d="m 151.18786,127.78026 h 3.99043 m 0,-3.54913 h -3.99043"/>' +
        '<path d="m 127.63458,125.91865 c -0.0614,-4.31403 4.06429,-4.27339 4.06429,-4.27339 0,0 17.54154,0.002 18.51091,0.002 0.54652,0 1.24797,1.59009 1.24797,4.29442 0,2.70429 -0.70145,4.29488 -1.24797,4.29488 -0.96937,0 -18.51091,0.002 -18.51091,0.002 0,0 -4.00294,-0.006 -4.06429,-4.31926 z"/>' +
        '<path d="m 149.98442,125.94167 c 0,-2.70432 -0.70152,-4.29447 -1.24804,-4.29447"/>' +
        '<path d="m 149.98442,125.94167 c 0,2.70434 -0.70152,4.29448 -1.24804,4.29448"/>' +
        '<path d="m 131.69887,121.64526 c 0,0 1.18253,1.38193 1.18253,4.3079 0,3.22028 -1.18253,4.28473 -1.18253,4.28473"/>' +
        '<path d="m 127.67482,124.72067 h -2.0259 v 2.57005 h 2.0259"/>' +
        '<path d="m 125.71029,125.21019 h -8.90172 v 1.591 h 8.90172"/>' +
        '<path d="m 166.66931,134.51143 c -3.65422,-0.49773 -6.94677,-5.24361 -6.94677,-5.24361"/>' +
        '<path d="m 156.22177,121.78327 c 0.57818,0 1.04387,0.61442 1.04387,1.37717 v 3.56413 a 2.5500004,2.5500004 0 0 0 -0.093,-0.007 2.5500004,2.5500004 0 0 0 -1.99419,0.96945 v -4.52686 c 0,-0.76275 0.46516,-1.37717 1.04334,-1.37717 z"/>' +
        '<path d="m 141.38899,132.1778 c -2.90279,0.16379 -2.78164,-1.94002 -2.78164,-1.94002"/>'
    }
  };
  var DOC_FLAG = [30.9, 29.4];

  /* 醫生：照抄三張 svg 的線條，加上墊在下面的顏色；crop = 只裁醫生本人 */
  function doctor(pose, crop) {
    var A = DOC_ART[pose];
    var vb = crop ? [22.3, 0, 31.8, DOC_FRAME.h] : [0, 0, DOC_FRAME.w, DOC_FRAME.h];
    var fills = A.fills.map(function (f) { return '<path d="' + f[1] + '" fill="' + f[0] + '"/>'; }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(vb[2] * 10) + '" height="' + Math.round(vb[3] * 10) +
      '" viewBox="' + vb.join(' ') + '"><g transform="translate(' + A.dx + ' 0)">' + fills +
      '<g fill="none" stroke="#000" stroke-width=".5" stroke-linejoin="bevel" transform="translate(' + A.layer.join(' ') + ')">' +
      A.lines + '</g></g></svg>';
  }

  /* 藥盒：每一種關卡顏色一個 */
  Object.keys(THEMES).forEach(function (t) {
    SPRITES['block_' + t] = function () { return block(THEMES[t].band, '#9A3412'); };
  });

  var PORTAL = { cube: '#16A34A', rot: '#CA8A04', duo: '#0284C7', ship: '#DB2777', ufo: '#EA580C', boss: '#DC2626' };
  /* 傳送門：每一種玩法一個顏色 */
  Object.keys(PORTAL).forEach(function (m) {
    SPRITES['portal_' + m] = function () {
      var c = PORTAL[m];
      return svg(80, 240,
        '<ellipse cx="40" cy="120" rx="28" ry="108" fill="' + c + '" fill-opacity=".16" stroke="' + c + '" stroke-width="10"/>' +
        '<ellipse cx="40" cy="120" rx="15" ry="90" fill="none" stroke="#fff" stroke-width="4" opacity=".85"/>');
    };
  });

  /* 一張圖的 data URL */
  function source(name) {
    var f = SPRITES[name];
    return f ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f()) : null;
  }

  /* 預先載入全部的圖（name → <img>） */
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

  root.DashArt = {
    SPRITES: SPRITES, THEMES: THEMES, PORTAL: PORTAL, CHARS: CHARS, char: char, source: source, images: images,
    DOCTOR: { frame: DOC_FRAME, art: DOC_ART, flag: DOC_FLAG, water: '#22D3EE', deep: '#0891B2' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
