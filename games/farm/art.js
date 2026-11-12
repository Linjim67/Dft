/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 機器人農場：像素圖（window.FarmArt）
   每張圖是一格一個字母的字串（空格只是方便數，畫的時候拿掉）；'.' = 透明。
   一格地 = 16 × 16 像素；小圖示 = 8 × 8。全部在載入時畫成小 canvas，之後只用 drawImage 放大。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var PAL = {
    k: '#2B1B17', K: '#5A3A2A', w: '#FFFFFF', c: '#FFF4E0',
    g: '#6DB54B', G: '#4E9A3C', h: '#95D163', j: '#2F7A35',
    s: '#9A6640', S: '#74482B', d: '#B9825A',
    o: '#F98B2A', O: '#D9601A', y: '#FFD84A', Y: '#E0A91C', r: '#EF5350', R: '#B5302F',
    b: '#7CCBEF', B: '#3D9AD9', n: '#2770B0',
    e: '#B8B2A8', E: '#8D867B', f: '#615A50', F: '#4A443D',
    m: '#D6C3A0', M: '#BFA982',
    v: '#5C4A52', V: '#43353C', L: '#FF8C1A', z: '#FFD54A', Z: '#E0461F',
    p: '#D9B8FF', P: '#9C6BE0', Q: '#6B45B0', q: '#8FF0E8',
    a: '#F7C531', A: '#C98D12', i: '#FFF0A8', t: '#C98F5A', T: '#93613A',
    x: '#EDE7DF', X: '#B8ADA0', u: '#FFB3C6', U: '#E8829C'
  };

  /* ─────────────────────────────────────────────────────────────
     16 × 16
     ───────────────────────────────────────────────────────────── */

  var A = {};

  A.sprout = [
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... .hh. .hh. ....', '.... hggh hggh ....', '.... .hgg ggh. ....', '.... ..hg gh.. ....',
    '.... ...G G... ....', '.... ...G G... ....', '.... .... .... ....', '.... .... .... ....'
  ];

  A.carrot1 = [
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... .h.. ..h. ....', '.... hgh. .hgh ....', '.... hggh hggh ....', '.... .hgg ggh. ....',
    '.... ..hg gh.. ....', '.... ..jg gj.. ....', '.... ..kG Gk.. ....', '.... .koo ooOk ....',
    '.... ..kk kk.. ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....'
  ];

  A.carrot2 = [
    '.... .... .... ....', '.... .h.. ..h. ....', '...h .gh. .hg. h...', '...h hgg. .ggh h...',
    '.... hggh hggh ....', '.... .hgg ggh. ....', '.... ..jg gj.. ....', '.... .kkG Gkkk ....',
    '.... kooo oooO k...', '.... kooo ooOO k...', '.... .koo ooOk ....', '.... .koo oOOk ....',
    '.... ..ko oOk. ....', '.... ...k Ok.. ....', '.... .... k... ....', '.... .... .... ....'
  ];

  A.corn1 = [
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... ...h .... ....', '.... ...g .... ....', '.... .h.g ..h. ....', '.... ..hg .hg. ....',
    '.... ...g hg.. ....', '.... h..g g... ....', '.... .hgg .... ....', '.... ..gg .... ....',
    '.... ...G .... ....', '.... ...G .... ....', '.... .... .... ....', '.... .... .... ....'
  ];

  A.corn2 = [
    '.... ...h .... ....', '.... ...g h... ....', '.... ..hg g... ....', '.... .hgg .kk. ....',
    '.... hg.g kyyk ....', '...h g..g kyik ....', '.... ...g kyyk ....', '.... ..hg kiyk ....',
    '.... .hgg kyyk ....', '.... hg.g kyYk ....', '...h g..g gkk. ....', '.... ...g hg.. ....',
    '.... ..hg .hg. ....', '.... ...G .... ....', '.... ...G .... ....', '.... .... .... ....'
  ];

  A.tomato1 = [
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... .... .... ....', '.... ..h. .h.. ....', '.... .hgh hgh. ....', '.... hggg gggh ....',
    '.... gGgh hgGg ....', '.... .hgg ggh. ....', '.... hgGg gGgh ....', '.... .gg. .gg. ....',
    '.... ..jG Gj.. ....', '.... ...G G... ....', '.... .... .... ....', '.... .... .... ....'
  ];

  A.bush = [
    '.... .... .... ....', '.... .... .... ....', '.... .hhg ghh. ....', '...h gggg Gggh ....',
    '..hg gGgg ggGg h...', '..gg gggg gggg g...', '..gG gggg gGgg g...', '..gg ggGg gggg G...',
    '..Gg gggg ggGg g...', '...g gGgg gggg G...', '...G gggg gGgg ....', '.... GgGg gggG ....',
    '.... .GGj jGG. ....', '.... ...j j... ....', '.... .... .... ....', '.... .... .... ....'
  ];

  A.barn = [
    '.... .... .... ....', '.... ..kk kk.. ....', '.... kkRR RRkk ....', '..kk RRRR RRRR kk..',
    '.kRR RRRR RRRR RRk.', 'kRRR RRRw wRRR RRRk', 'kRRR RRwK KwRR RRRk', 'kwww wwww wwww wwwk',
    '.kRr rrrr rrrr rRk.', '.kRr wwww wwww rRk.', '.kRr wwKK KKww rRk.', '.kRr wKwK KwKw rRk.',
    '.kRr wKKw wKKw rRk.', '.kRr wKwK KwKw rRk.', '.kRr wwKK KKww rRk.', '.kkk kkkk kkkk kkk.'
  ];

  A.lighthouse = [
    '.... ..kk kk.. ....', '.... .kRR RRk. ....', '.... kRRR RRRk ....', '.... kkkk kkkk ....',
    '.... kziz izik ....', '.... kiyi yiyk ....', '.... kkkk kkkk ....', '.... .kww wXk. ....',
    '.... .kRR RRk. ....', '.... .kRR RRk. ....', '.... .kww wXk. ....', '.... kwww wwXk ....',
    '.... kRRR RRRk ....', '.... kRRR RRRk ....', '...k wwww wwwX k...', '...k kkkk kkkk k...'
  ];

  A.pot = [
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '..kk kkkk kkkk kk..', '..kx FFFF FFFF xk..', '..kk kkkk kkkk kk..', '...k ffff ffff k...',
    '..kf Efff ffff fk..', '..kE ffff ffff Fk..', '..kf ffff ffff Fk..', '...k ffff fffF k...',
    '.... kkff FFkk ....', '.... kk.k k.kk ....', '.... .... .... ....', '..TT tTTt tTTt TT..'
  ];

  A.fire = [
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',
    '.... .... .... ....', '.... .z.. z..z ....', '...z LzLL zLzL z...', '..TT ZLZT TZLZ TT..'
  ];

  A.quarry = [
    '.... .... .... ....', '.kkk kk.. .... ....', 'keee eEk. .... ....', 'kk.T .kk. .... ....',
    '...T .... .... ....', '...T .... .... ....', '...T .... .... ....', '...T .... .... ....',
    '..kk kkkk kkkk kk..', '..kX xxxx xxxx Xk..', '..kX XXXX XXXX Xk..', '..kX xXXX XXXx Xk..',
    '...k XXXX XXXX k...', '...k kkkk kkkk k...', '.... kFk. .kFk ....', '.... .k.. ..k. ....'
  ];

  /* 農場上的採石場只畫推車；十字鎬另外畫（pick），會揮 */
  A.quarryCart = A.quarry.map(function (r, y) { return y < 8 ? '................' : r; });

  A.forge = [
    '.... .... .kfk ....', '.... .... .kFk ....', '.... .... .kfk ....', '..kk kkkk kkkk kk..',
    '..ke eeEe eeEe ek..', '..ke Eeee Eeee Ek..', '..ke ekkk kkke ek..', '..kE ekzz zzke Ek..',
    '..ke ekzL Lzke ek..', '..ke EkLL LLkE ek..', '..kE ekLZ ZLke Ek..', '..ke ekZZ ZZke ek..',
    '..ke eeee eEee ek..', '..kk kkkk kkkk kk..', '.... .... .... ....', '.... .... .... ....'
  ];

  A.altar = [
    '.... ...q .... ....', '.... ..kk kk.. ....', '.... .kwp pPk. ....', '.... .kpp pPk. ....',
    '.... .kpP PQk. ....', '.... ..kk kk.. ....', '.... .... .... ....', '.... .... .... ....',
    '...k kkkk kkkk k...', '...k eeee eeee k...', '...k kkkk kkkk k...', '.... keEe eEek ....',
    '.... kEeq qeEk ....', '.... keEe eEek ....', '...k kkkk kkkk k...', '...k EEEE EEEE k...'
  ];

  A.bank = [
    '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .kk. .... ....',
    '.... kUuk kkkk ....', '...k uuuu ukku k...', '..ku wkuu uuuu uk..', 'kkUu uuuu uuuu uUk.',
    'kUkU uuuu uuuu uUkk', 'kUUu uuuu uuuu uUk.', '.kku uuuu uuuu Uk..', '...k UUUU UUUU k...',
    '.... kUk. .kUk ....', '.... kkk. .kkk ....', '.... .... .... ....', '.... .... .... ....'
  ];

  A.robot = [
    '.... ..ko k... ....', '.... ...k .... ....', '.... kkkk kkkk ....', '...k xxxx xxxx k...',
    '...k xkkk kkkx k...', '...k xkqk kqkx k...', '...k xkkk kkkx k...', '...k xxxx xxxX k...',
    '.... kkkk kkkk ....', '...k oooo oooO k...', '..kk oxxx xxxO kk..', '...k oooo oooO k...',
    '.... kkkk kkkk ....', '.... .zL. .Lz. ....', '.... ..z. .z.. ....', '.... .... .... ....'
  ];

  A.boulder = [
    '.... .... .... ....', '.... .... .... ....', '.... .kkk kk.. ....', '.... keee eEkk ....',
    '...k exee eeEE k...', '..ke xeee eeee Ek..', '..ke eeee eeeE Ek..', '.kee eeee eEEE EEk.',
    '.kEe eeeE EEEE fEk.', '.kEE eEEE EEEf fEk.', '.kEE EEEE EEff ffk.', '..kf EEEE Efff fk..',
    '...k ffff ffff k...', '.... kkkk kkkk ....', '.... .... .... ....', '.... .... .... ....'
  ];

  /* 鋤頭（工具列）：斜斜的木柄、灰色的鐵片 */
  A.hoeTool = [
    '................', '................', '..........kkkkkk', '..........kxeeEk',
    '.........TkxeEEk', '........tTkeEEfk', '.......tT.kkkkkk', '......tT........',
    '.....tT.........', '....tT..........', '...tT...........', '..tT............',
    '.tT.............', '.k..............', '................', '................'
  ];

  A.cloud = [
    '.... .ww. .... ....', '.... wwww w.ww ....', '..ww wwww wwww w...', '.www wwww wwww ww..',
    'wwww wwww wwww www.', 'wxww wwww wwww wwww', '.xxx xxww wwxx xxx.', '..xx xxxx xxxx x...'
  ];

  /* ─────────────────────────────────────────────────────────────
     8 × 8 小圖示（頂列、機器人手上、飛到頂列的東西、按鈕）
     ───────────────────────────────────────────────────────────── */

  var I = {};
  I.coin = ['..kkkk..', '.kiaaak.', 'kiaiaaAk', 'kaiaaaAk', 'kaaaaaAk', 'kaaaaAAk', '.kaAAAk.', '..kkkk..'];
  I.stone = ['........', '..kkkk..', '.kexeEk.', 'kexeeeEk', 'keeeeEEk', 'kEeEEEfk', '.kffffk.', '..kkkk..'];
  I.ore = ['........', '..kkkk..', '.keiaEk.', 'keaiaAEk', 'keEaAeEk', 'kEeeEaAk', '.kffffk.', '..kkkk..'];
  I.orb = ['..kkkk..', '.kwppPk.', 'kwpppPPk', 'kppppPPk', 'kpppPPQk', 'kPPPPPQk', '.kPQQQk.', '..kkkk..'];
  I.soup = ['.q...q..', '..q.q...', 'kkkkkkkk', 'koyrogyk', 'kxxxxxXk', '.kxxxXk.', '..kXXk..', '...kk...'];
  I.carrot = ['.....hg.', '....hgh.', '...kkg..', '..kook..', '.kooOk..', '.koOk...', 'kOOk....', 'kk......'];
  I.corn = ['...kk...', '..kyik..', '..kiyk..', '..kyik..', '.gkiykg.', '.ggkkgg.', '..gggg..', '...gg...'];
  I.tomato = ['...jg...', '..kggk..', '.krrrrk.', 'krwrrrRk', 'krrrrrRk', 'krrrrRRk', '.kRRRRk.', '..kkkk..'];
  I.lock = ['..kkkk..', '.kX..Xk.', '.kX..Xk.', 'kkkkkkkk', 'kaiaaaAk', 'kaaKKaAk', 'kaaKaaAk', 'kkkkkkkk'];
  I.boots = ['........', '.kkk....', '.kook...', '.kook...', '.kooOkk.', '.kooooOk', '.kkkkkkk', '.zL.zL..'];
  I.basket = ['..kkkk..', '.k....k.', 'kkkkkkkk', 'ktTtTtTk', 'kTtTtTtk', 'ktTtTtTk', '.kTtTtk.', '..kkkk..'];
  I.shovel = ['......kk', '.....kTk', '....kTk.', '.kkkTk..', 'kiaak...', 'kaaAk...', 'kaAk....', '.kk.....'];
  I.hoe = ['kkkkk...', 'kroyk...', 'kgbPk...', 'kkkkTk..', '....kTk.', '.....kTk', '......kT', '.......k'];
  I.hand = ['...kk...', '..kxxk..', '..kxxkk.', '.kkxxxxk', 'kxkxxxxk', 'kxxxxxxk', '.kxxxxk.', '..kkkk..'];

  /* 小石頭、小金礦（採石場的推車裡一顆一顆疊起來）：3 × 2 */
  var PEBBLE = { s: ['eeE', 'EEf'], o: ['aiA', 'AAK'] };
  var BOWL = ['koyrk', '.xxX.', '..k..'];

  /* 3 × 5 數字（格子角落的 ×2） */
  var DIGITS = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
    'x': ['000', '101', '010', '101', '000']
  };

  /* ─────────────────────────────────────────────────────────────
     畫成 canvas
     ───────────────────────────────────────────────────────────── */

  var hasDom = typeof document !== 'undefined';

  function rows(art) { return art.map(function (r) { return r.replace(/ /g, ''); }); }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function paint(ctx, art, ox, oy, map) {
    art = rows(art);
    for (var y = 0; y < art.length; y++) {
      for (var x = 0; x < art[y].length; x++) {
        var ch = art[y].charAt(x);
        if (map && map[ch]) ch = map[ch];
        if (ch === '.' || !PAL[ch]) continue;
        ctx.fillStyle = PAL[ch];
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  function sprite(art, map, flip) {
    var r = rows(art);
    var c = canvas(r[0].length, r.length);
    var ctx = c.getContext('2d');
    if (flip) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    paint(ctx, art, 0, 0, map);
    return c;
  }

  /* 把小圖疊在大圖上（番茄 = 樹叢 + 三顆番茄） */
  function stamp(base, small, sx, sy) {
    var out = rows(base).map(function (r) { return r.split(''); });
    small.forEach(function (line, y) {
      line.split('').forEach(function (ch, x) { if (ch !== '.') out[sy + y][sx + x] = ch; });
    });
    return out.map(function (r) { return r.join(''); });
  }

  var TOMATO = ['.rr.', 'rwrr', 'rrrR', '.RR.'];
  A.tomato2 = stamp(stamp(stamp(A.bush, TOMATO, 3, 4), TOMATO, 8, 3), TOMATO, 6, 8);

  /* 決定性的亂數：同一格每次都長一樣 */
  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }

  function speckle(ctx, seed, colors, count) {
    for (var k = 0; k < count; k++) {
      var x = Math.floor(hash(seed * 131 + k * 7) * 16);
      var y = Math.floor(hash(seed * 197 + k * 13 + 5) * 16);
      ctx.fillStyle = PAL[colors[k % colors.length]];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  /* 地面：G 草地、S 碎石、B 火山岩；plot = 田（wet = 河邊，土比較深） */
  function ground(floor, seed, plot, wet) {
    var c = canvas(16, 16), ctx = c.getContext('2d');
    if (floor === 'G') {
      ctx.fillStyle = PAL.g;
      ctx.fillRect(0, 0, 16, 16);
      for (var k = 0; k < 9; k++) {
        var x = Math.floor(hash(seed * 31 + k) * 15), y = Math.floor(hash(seed * 47 + k * 3) * 14);
        ctx.fillStyle = PAL.h;
        ctx.fillRect(x, y, 1, 2);
        ctx.fillStyle = PAL.G;
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
      if (!plot && hash(seed * 7 + 3) < 0.35) {
        var fx = 3 + Math.floor(hash(seed * 11) * 10), fy = 3 + Math.floor(hash(seed * 13) * 10);
        ctx.fillStyle = hash(seed) < 0.5 ? PAL.w : PAL.y;
        ctx.fillRect(fx - 1, fy, 3, 1);
        ctx.fillRect(fx, fy - 1, 1, 3);
        ctx.fillStyle = PAL.o;
        ctx.fillRect(fx, fy, 1, 1);
      }
      if (plot) {
        ctx.fillStyle = wet ? PAL.S : PAL.s;
        ctx.fillRect(1, 1, 14, 14);
        ctx.fillStyle = wet ? PAL.K : PAL.S;
        for (var r = 3; r < 15; r += 4) ctx.fillRect(2, r, 12, 1);
        ctx.fillStyle = wet ? PAL.s : PAL.d;
        for (r = 2; r < 15; r += 4) {
          for (var xx = 2; xx < 14; xx += 3) ctx.fillRect(xx + (r % 3), r, 1, 1);
        }
      }
    } else if (floor === 'S' || floor === 'R') {
      ctx.fillStyle = PAL.M;
      ctx.fillRect(0, 0, 16, 16);
      speckle(ctx, seed, ['m', 'E', 'm', 'e'], 22);
    } else if (floor === 'B') {
      ctx.fillStyle = PAL.v;
      ctx.fillRect(0, 0, 16, 16);
      speckle(ctx, seed, ['V', 'V', 'f'], 18);
      ctx.fillStyle = PAL.V;
      var cx0 = Math.floor(hash(seed * 5) * 10) + 3;
      ctx.fillRect(cx0, 4, 1, 3);
      ctx.fillRect(cx0 + 1, 7, 1, 2);
      ctx.fillRect(cx0 - 1, 9, 1, 2);
    }
    return c;
  }

  /* 會動的地：水、岩漿；frame 0–2 */
  function water(seed, frame, edgeL, edgeR) {
    var c = canvas(16, 16), ctx = c.getContext('2d');
    ctx.fillStyle = PAL.B;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = PAL.n;
    ctx.fillRect(4, 0, 8, 16);
    ctx.fillStyle = PAL.B;
    for (var k = 0; k < 6; k++) {
      var y = (Math.floor(hash(seed * 17 + k) * 16) + frame * 3) % 16;
      ctx.fillRect(5 + Math.floor(hash(seed * 23 + k) * 6), y, 1, 2);
    }
    ctx.fillStyle = PAL.b;
    for (k = 0; k < 5; k++) {
      var wy = (Math.floor(hash(seed * 29 + k) * 16) + frame * 4) % 16;
      ctx.fillRect(2 + Math.floor(hash(seed * 37 + k) * 11), wy, 2, 1);
    }
    if (edgeL) { ctx.fillStyle = PAL.G; ctx.fillRect(0, 0, 1, 16); ctx.fillStyle = PAL.d; ctx.fillRect(1, 0, 1, 16); }
    if (edgeR) { ctx.fillStyle = PAL.G; ctx.fillRect(15, 0, 1, 16); ctx.fillStyle = PAL.d; ctx.fillRect(14, 0, 1, 16); }
    return c;
  }

  function lava(seed, frame) {
    var c = canvas(16, 16), ctx = c.getContext('2d');
    ctx.fillStyle = PAL.Z;
    ctx.fillRect(0, 0, 16, 16);
    for (var k = 0; k < 7; k++) {
      var x = Math.floor(hash(seed * 19 + k) * 14), y = Math.floor(hash(seed * 23 + k * 5) * 14);
      var grow = (k + frame) % 3;
      ctx.fillStyle = PAL.L;
      ctx.fillRect(x, y, 2 + grow, 2);
      if (grow === 2) { ctx.fillStyle = PAL.z; ctx.fillRect(x + 1, y, 1, 1); }
    }
    ctx.fillStyle = PAL.V;
    ctx.fillRect(0, 0, 16, 1);
    return c;
  }

  /* 十字鎬：用像素一格一格畫出某個角度（0 = 直立，往右前方倒是正的）。
     支點在推車左邊（握把，畫在推車後面），木柄 + 灰色的鎬頭，鎬頭兩端往下彎、外框只描上下左右。
     先畫好幾個角度，揮的時候換圖，才會一直是方方正正的像素 */
  var PICK_ANGLES = [10, 18, 26, 34, 42, 51, 60];

  function pick(deg) {
    var c = canvas(16, 16), ctx = c.getContext('2d');
    var a = deg * Math.PI / 180, px = 2, py = 12, L = 9.5;
    var sx = Math.sin(a), sy = -Math.cos(a);           /* 從握把往鎬頭 */
    var ex = px + sx * L, ey = py + sy * L;
    var grid = {}, head = [];
    function plot(x, y, ch, isHead) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x > 15 || y > 15) return;
      var key = x + ',' + y;
      if (isHead) { if (!grid[key] || grid[key] !== 'E') grid[key] = ch; head.push([x, y]); } else if (!grid[key]) grid[key] = ch;
    }
    for (var u = -3.4; u <= 3.401; u += 0.2) {
      var bend = Math.abs(u) > 2.3 ? 1 : 0;           /* 兩端往握把那邊彎 */
      plot(ex + Math.cos(a) * u - sx * bend, ey + Math.sin(a) * u - sy * bend, Math.abs(u) < 0.7 ? 'E' : 'e', true);
    }
    for (var d = 0; d <= L - 0.6; d += 0.2) plot(px + sx * d, py + sy * d, d < 1.4 ? 'K' : 'T', false);
    /* 鎬頭外框：只描上下左右，才不會糊成一團 */
    head.forEach(function (h) {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var nx = h[0] + o[0], ny = h[1] + o[1], k = nx + ',' + ny;
        if (!grid[k] && nx >= 0 && ny >= 0 && nx <= 15 && ny <= 15) grid[k] = 'k';
      });
    });
    Object.keys(grid).forEach(function (k) {
      var xy = k.split(',');
      ctx.fillStyle = PAL[grid[k]];
      ctx.fillRect(+xy[0], +xy[1], 1, 1);
    });
    return c;
  }

  var built = null;

  function build() {
    if (built || !hasDom) return built;
    var S = {};
    Object.keys(A).forEach(function (k) { S[k] = sprite(A[k]); });
    S.boulderFlip = sprite(A.boulder, null, true);
    S.potSoup = sprite(A.pot, { F: 'o' });
    S.potCook = sprite(stamp(A.pot, ['oyorgoyo'], 4, 5));
    S.forgeIdle = sprite(A.forge, { z: 'K', L: 'Z', Z: 'K' });
    S.picks = PICK_ANGLES.map(function (deg) { return { deg: deg, im: pick(deg) }; });
    S.robot2 = sprite(stamp(A.robot, ['.Lz..zL.', '........'], 4, 13));
    S.hoeGlow = sprite(A.tomato2);
    var icons = {};
    Object.keys(I).forEach(function (k) { icons[k] = sprite(I[k]); });
    /* 買不起時的灰色金幣、灰一點的石頭（地區價錢牌） */
    icons.coinGray = sprite(I.coin, { a: 'X', i: 'x', A: 'E' });
    icons.stoneGray = sprite(I.stone, { e: 'x', E: 'X', f: 'E' });
    var pebbles = { s: sprite(PEBBLE.s), o: sprite(PEBBLE.o) };
    built = { sprites: S, icons: icons, pebbles: pebbles, bowl: sprite(BOWL) };
    return built;
  }

  /* 數字：用 3 × 5 的像素字；回傳寬度 */
  function digits(ctx, text, x, y, color) {
    ctx.fillStyle = color;
    var cx = x;
    String(text).split('').forEach(function (ch) {
      var g = DIGITS[ch];
      if (!g) { cx += 2; return; }
      for (var r = 0; r < 5; r++) {
        for (var q = 0; q < 3; q++) if (g[r].charAt(q) === '1') ctx.fillRect(cx + q, y + r, 1, 1);
      }
      cx += 4;
    });
    return cx - x - 1;
  }

  /* 給 <img> 用的圖示（頂列、按鈕）：放大成 8 倍再轉 data URL，瀏覽器縮小時也不會糊 */
  var urls = {};
  function iconUrl(name, big) {
    var key = name + (big ? '!' : '');
    if (urls[key]) return urls[key];
    var b = build();
    var src = big ? b.sprites[name] : b.icons[name];
    if (!src) return '';
    var scale = big ? 4 : 8;
    var c = canvas(src.width * scale, src.height * scale), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    urls[key] = c.toDataURL();
    return urls[key];
  }

  root.FarmArt = {
    PAL: PAL, ART: A, ICONS: I, rows: rows, hash: hash,
    build: build, ground: ground, water: water, lava: lava, digits: digits, iconUrl: iconUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
