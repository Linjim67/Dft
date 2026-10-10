/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 膠囊衝衝衝：角色與道具（Q 版 SVG）
   全部是醫院裡看得到的東西：
     小膠囊（蛋形的主角）· 體溫計火箭 · 藥杯飛碟 · 針（障礙物）· 藥盒（方塊）
     彈簧墊 · 星星 · 傳送門 · 安心旗 · 坐旋轉椅的醫生（大魔王，笑咪咪的）
   另外兩個可以選的角色（照 A.jpg、B.jpg 的手稿畫）：
     小麻糬（戴皇冠）· 小抹茶（雲朵耳朵、白肚子），各有自己的火箭和飛碟
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

  /* ── 小麻糬（A.jpg）：白白圓圓、頭上一頂小皇冠、左下角貼一片 OK 繃、兩隻小腳 ──
     暈倒時皇冠歪到一邊、眼睛轉圈圈。id：放進載具時漸層的名字不能重複 */
  var MOCHI_INK = '#4A3728';
  var MOCHI = 'M50 17C72 17 87 33 89 54C91 76 77 90 50 90C23 90 9 77 11 55C13 33 28 17 50 17Z';

  function crown(tf) {
    return '<path d="M36 20L34 6.5L43 13L50 3.5L57 13L66 6.5L64 20Z" fill="#FCD34D" stroke="#B45309" stroke-width="3.2" stroke-linejoin="round"' +
      (tf ? ' transform="' + tf + '"' : '') + '/>';
  }

  function mochiBody(face, id) {
    id = id || 'mo';
    var eyes = face === 'dizzy'
      ? '<path d="M38 52a1.6 1.6 0 1 1 3.2 0a3.2 3.2 0 1 1-6.4 0a4.8 4.8 0 1 1 9.6 0M62 52a1.6 1.6 0 1 1 3.2 0a3.2 3.2 0 1 1-6.4 0a4.8 4.8 0 1 1 9.6 0" fill="none" stroke="' + MOCHI_INK + '" stroke-width="2.6" stroke-linecap="round"/>' +
        '<ellipse cx="50" cy="66" rx="3.6" ry="4.4" fill="' + MOCHI_INK + '"/>'
      : '<ellipse cx="38" cy="52" rx="3.8" ry="4.6" fill="' + MOCHI_INK + '"/><ellipse cx="62" cy="52" rx="3.8" ry="4.6" fill="' + MOCHI_INK + '"/>' +
        '<circle cx="39.3" cy="50.4" r="1.3" fill="#fff"/><circle cx="63.3" cy="50.4" r="1.3" fill="#fff"/>' +
        '<path d="M45 59q5 5 10 0" fill="none" stroke="' + MOCHI_INK + '" stroke-width="2.8" stroke-linecap="round"/>';
    /* 左下角暖暖的桃色（手稿上的色鉛筆陰影），往右上淡掉 */
    return '<defs><radialGradient id="' + id + '" cx=".18" cy=".7" r=".62">' +
      '<stop offset="0" stop-color="#FAD5AE"/><stop offset=".55" stop-color="#FCE6CC"/><stop offset="1" stop-color="#FFFDF8"/></radialGradient></defs>' +
      '<ellipse cx="36" cy="89" rx="6" ry="4.5" fill="#D5E3DA" stroke="' + MOCHI_INK + '" stroke-width="3"/>' +
      '<ellipse cx="64" cy="89" rx="6" ry="4.5" fill="#D5E3DA" stroke="' + MOCHI_INK + '" stroke-width="3"/>' +
      '<path d="' + MOCHI + '" fill="url(#' + id + ')" stroke="' + MOCHI_INK + '" stroke-width="4.2"/>' +
      '<ellipse cx="66" cy="30" rx="8" ry="4.5" fill="#fff" transform="rotate(25 66 30)"/>' +
      /* OK 繃 */
      '<g transform="rotate(-52 27 76)"><rect x="18" y="71.5" width="18" height="9" rx="4.5" fill="#FBCFE8" stroke="#DB7FA8" stroke-width="1.8"/>' +
      '<rect x="23.5" y="73" width="7" height="6" rx="1.5" fill="#FDF2F8"/></g>' +
      '<ellipse cx="29" cy="60" rx="6" ry="3.8" fill="#FBB4B4"/><ellipse cx="71" cy="60" rx="6" ry="3.8" fill="#FBB4B4"/>' +
      eyes +
      (face === 'dizzy' ? crown('rotate(32 50 12) translate(14 -4)') : crown());
  }

  function miniMochi(tx, ty, s, id) {
    return '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' + mochiBody('', id) + '</g>';
  }

  /* ── 小抹茶（B.jpg）：灰綠色、軟軟的，頭上兩朵雲朵耳朵、肚子一個白色的圓 ──
     外框：每一塊先描粗邊、再蓋上填色，耳朵、手、腳才會跟身體連成一整塊。
     小抹茶不滾，是用走的：身體（含耳朵、手）可以歪一點、抬高一點，腳照姿勢擺 */
  var MATCHA_INK = '#4D7A55';
  var MATCHA_BODY =
    '<path d="M50 18C71 18 84 30 86 47C88 62 92 72 89 81C86 90 72 92 50 92C28 92 14 90 11 81C8 72 12 62 14 47C16 30 29 18 50 18Z"/>' +
    '<circle cx="23" cy="25" r="8"/><circle cx="14" cy="28" r="6"/><circle cx="21" cy="17" r="5.5"/>' +
    '<circle cx="77" cy="22" r="8"/><circle cx="85" cy="19" r="6"/><circle cx="76" cy="14" r="5.5"/>';

  /* lean：身體歪幾度（以腳底中間為軸）· lift：身體抬高 · look：臉往右（前進的方向）轉一點
     feet：兩隻腳 [x, y, 轉幾度] · up：手舉起來（跳的時候） */
  var MATCHA_POSE = {
    stand: { lean: 0, lift: 0, look: 0, feet: [[28, 88, 0], [72, 88, 0]] },
    /* 走路：右腳抬起來、身體往左歪 → 兩腳併攏、身體彈高 → 左腳抬起來、身體往右歪 → 兩腳併攏 */
    walk1: { lean: -6, lift: -1.5, look: 4, feet: [[28, 89, 0], [81, 82, -30]] },
    walk2: { lean: 0, lift: -3, look: 4, feet: [[34, 89, 0], [66, 89, 0]] },
    walk3: { lean: 6, lift: -1.5, look: 4, feet: [[19, 82, 30], [72, 89, 0]] },
    /* 跳：手舉高、腳往下伸、張嘴笑 */
    jump: { lean: 0, lift: -3, look: 3, up: true, feet: [[37, 89.5, 22], [63, 89.5, -22]] }
  };

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
      /* 開心地跳：眼睛彎彎、嘴巴張開 */
      eyes = '<path d="M' + (ex - 4.2) + ' 48.5q4.2-5.5 8.4 0M' + (ex2 - 4.2) + ' 48.5q4.2-5.5 8.4 0" fill="none" stroke="#1C1917" stroke-width="2.8" stroke-linecap="round"/>' +
        '<path d="M' + (45.5 + dx) + ' 52q4.5 7.5 9 0Z" fill="#1C1917" stroke="#1C1917" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M' + (47.6 + dx) + ' 55.6q2.4 1.8 4.8 0" fill="none" stroke="#FB7185" stroke-width="2" stroke-linecap="round"/>';
    } else {
      eyes = '<ellipse cx="' + ex + '" cy="47" rx="3.8" ry="4.4" fill="#1C1917"/><ellipse cx="' + ex2 + '" cy="47" rx="3.8" ry="4.4" fill="#1C1917"/>' +
        '<circle cx="' + (ex + 1.2) + '" cy="45.4" r="1.2" fill="#fff"/><circle cx="' + (ex2 + 1.2) + '" cy="45.4" r="1.2" fill="#fff"/>' +
        '<path d="M' + (46 + dx) + ' 52.5q4 3.5 8 0" fill="none" stroke="#1C1917" stroke-width="2.6" stroke-linecap="round"/>';
    }
    /* 整隻縮小一點點（以腳底為準）：走路歪身體、跳起來舉手時耳朵和手才不會超出格子 */
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

    /* 彈簧墊：灰色底座＋黃色的蓋子（中間的彈簧是 dash.js 用線畫的，踩到時才拉得長） */
    padBase: function () {
      return svg(100, 12.5,
        '<rect x="5" y="2" width="90" height="9" rx="4.5" fill="#A8A29E" stroke="#44403C" stroke-width="2.8"/>' +
        '<path d="M14 4.6H86" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>');
    },
    padTop: function () {
      return svg(100, 26,
        '<path d="M9 21Q9 2 50 2Q91 2 91 21Z" fill="#FACC15" stroke="#854D0E" stroke-width="3.2" stroke-linejoin="round"/>' +
        '<rect x="4" y="17" width="92" height="7" rx="3.5" fill="#EAB308" stroke="#854D0E" stroke-width="2.8"/>' +
        '<path d="M38 15L50 7L62 15" fill="none" stroke="#854D0E" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M18 12Q23 7 31 5.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>');
    },

    star: function () {
      return svg(100, 100,
        '<path d="M50 6l12.5 26.5 29 3.6-21.3 20 5.5 28.7L50 70.6 24.3 84.8l5.5-28.7-21.3-20 29-3.6Z" fill="#FACC15" stroke="#A16207" stroke-width="5" stroke-linejoin="round"/>' +
        '<circle cx="42" cy="47" r="4" fill="#1C1917"/><circle cx="58" cy="47" r="4" fill="#1C1917"/>' +
        '<path d="M44.5 56q5.5 5 11 0" stroke="#1C1917" stroke-width="3.2" fill="none" stroke-linecap="round"/>');
    },

    /* 安心旗：經過之後變綠色、多一個勾，撞到了就從這裡重來 */
    flagOff: function () { return flag(false); },
    flagOn: function () { return flag(true); },

    /* 醫生（大魔王）：坐在會滾的看診椅上，笑咪咪的——是陪你玩水槍，不是壞人 */
    doctor: function () { return doctor(false); },
    doctorHappy: function () { return doctor(true); },

    mochi: function () { return svg(100, 100, mochiBody('')); },
    mochiDizzy: function () { return svg(100, 100, mochiBody('dizzy')); },

    /* 小麻糬的紅火箭：從上面的座艙探出頭，尾巴噴火 */
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

    /* 小麻糬的飛碟：玻璃罩裡揮揮手，下面三顆黃色的腳 */
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

    matcha: function () { return svg(100, 100, matchaBody('')); },
    matchaDizzy: function () { return svg(100, 100, matchaBody('dizzy')); },
    /* 小抹茶走路（四格一輪，第二、四格一樣）和跳起來 */
    matchaWalk1: function () { return svg(100, 100, matchaBody('', 'walk1')); },
    matchaWalk2: function () { return svg(100, 100, matchaBody('', 'walk2')); },
    matchaWalk3: function () { return svg(100, 100, matchaBody('', 'walk3')); },
    matchaJump: function () { return svg(100, 100, matchaBody('', 'jump')); },

    /* 小抹茶的白火箭：紅色的頭和翅膀，圓窗戶裡看得到小抹茶 */
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

    /* 小抹茶的飛碟：黑框玻璃罩、灰色碟子上一排黃燈、兩隻小腳 */
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

  /* 三個角色：小朋友在選關畫面先選一個。body／dizzy／ship／ufo 是每個姿勢用哪一張圖，
     shipName／ufoName 換掉關卡名稱裡的載具，burst 是撞到時噴出來的碎片顏色。
     有 walk 的角色不滾：在地上照順序換腳走路，在空中換成 jump */
  var CHARS = [
    { id: 'capsule', name: '小膠囊', body: 'egg', dizzy: 'eggDizzy', ship: 'ship', ufo: 'ufo',
      shipName: '體溫計火箭', ufoName: '藥杯飛碟', burst: ['#FB923C', '#FFF7ED', '#FDA4AF', '#FDBA74'] },
    { id: 'mochi', name: '小麻糬', body: 'mochi', dizzy: 'mochiDizzy', ship: 'mochiShip', ufo: 'mochiUfo',
      shipName: '紅色火箭', ufoName: '小飛碟', burst: ['#FCD34D', '#FFFDF8', '#FBB4B4', '#FAD5AE'] },
    { id: 'matcha', name: '小抹茶', body: 'matcha', dizzy: 'matchaDizzy', ship: 'matchaShip', ufo: 'matchaUfo',
      shipName: '白色火箭', ufoName: '小飛碟', burst: ['#A9C2AC', '#FFFFFF', '#F4B6C2', '#CBD8CC'],
      walk: ['matchaWalk1', 'matchaWalk2', 'matchaWalk3', 'matchaWalk2'], jump: 'matchaJump' }
  ];

  function char(id) {
    for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === id) return CHARS[i];
    return CHARS[0];
  }

  /* 桿子＋往右飄的三角旗＋桿子頂端一顆金色小圓球，底下一個小底座 */
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

  root.DashArt = { SPRITES: SPRITES, THEMES: THEMES, PORTAL: PORTAL, CHARS: CHARS, char: char, source: source, images: images };
})(typeof window !== 'undefined' ? window : globalThis);
