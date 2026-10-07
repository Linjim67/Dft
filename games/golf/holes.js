/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 浮空小島高爾夫：三個球洞
   座標和 physics.js 一樣：360 × 640，x 往右、y 往下，球從下面往上打。
   小島是多邊形；欄杆是折線（沒有欄杆的邊，球滾出去就會掉下去）。
   測試裡的機器人會把每一洞實際打進去，證明標準桿打得到。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* 圓角長方形的小島：直線邊每 step 單位取一點（欄杆要從中間切開時才需要） */
  function rr(x, y, w, h, r, step) {
    var pts = [];
    var corners = [
      [x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0],
      [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]
    ];
    corners.forEach(function (c, i) {
      for (var k = 0; k <= 6; k++) {
        var a = c[2] + k / 6 * Math.PI / 2;
        pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
      }
      if (step) {
        var n = corners[(i + 1) % 4], na = n[2];
        var p0 = pts[pts.length - 1], p1 = [n[0] + Math.cos(na) * r, n[1] + Math.sin(na) * r];
        var L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), m = Math.floor(L / step);
        for (var s = 1; s < m; s++) pts.push([p0[0] + (p1[0] - p0[0]) * s / m, p0[1] + (p1[1] - p0[1]) * s / m]);
      }
    });
    return pts;
  }

  function inGap(p, gaps) {
    return gaps.some(function (g) { return p[0] > g.x && p[0] < g.x + g.w && p[1] > g.y && p[1] < g.y + g.h; });
  }

  /* 去掉直線中間多餘的點：碰撞時少算很多段 */
  function simplify(line) {
    if (line.length < 3) return line;
    var out = [line[0]];
    for (var i = 1; i < line.length - 1; i++) {
      var a = out[out.length - 1], b = line[i], c = line[i + 1];
      var cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cross) > 0.5) out.push(b);
    }
    out.push(line[line.length - 1]);
    return out;
  }

  /* 沿著小島內側一圈的欄杆；gaps 裡的長方形範圍不放欄杆（開口） */
  function railRing(x, y, w, h, r, gaps) {
    var ring = rr(x + 4, y + 4, w - 8, h - 8, r - 4, 2);
    gaps = gaps || [];
    if (!gaps.length) return [simplify(ring.concat([ring[0]]))];
    /* 從一個開口後面開始繞，折線才不會在起點被切成兩段 */
    var start = 0;
    while (start < ring.length && !inGap(ring[start], gaps)) start++;
    var lines = [], cur = [];
    for (var k = 0; k < ring.length; k++) {
      var p = ring[(start + k) % ring.length];
      if (inGap(p, gaps)) {
        if (cur.length > 1) lines.push(simplify(cur));
        cur = [];
      } else {
        cur.push(p);
      }
    }
    if (cur.length > 1) lines.push(simplify(cur));
    return lines;
  }

  function island(x, y, w, h, r) {
    return { poly: rr(x, y, w, h, r), box: [x, y, w, h, r] };
  }

  /* ─────────────────────────────────────────────────────────────
     第 1 洞　轉轉風車
     一整座有欄杆圍起來的小島（第一洞不會掉下去），中間是風車屋。
     葉片轉到門口就擋住：看準空檔打進去，從後面出來。
     ───────────────────────────────────────────────────────────── */
  var h1Land = island(70, 40, 220, 570, 34);
  var HOLE1 = {
    id: 1,
    name: '轉轉風車',
    tip: '風車葉子轉開的時候，從門口打進去。',
    par: 3,
    tee: [180, 560],
    cup: [214, 112],
    lands: [h1Land],
    islands: [h1Land.poly],
    rails: railRing(70, 40, 220, 570, 34).concat([
      [[74, 300], [120, 300]],
      [[240, 300], [286, 300]]
    ]),
    bumpers: [
      { x: 132, y: 176, r: 13 },
      { x: 236, y: 440, r: 11 }
    ],
    windmill: { x: 180, y: 300, w: 120, h: 56, door: 36, period: 6.4, phase: 0.9, hubZ: 50, len: 52 },
    /* 隧道裡微微往後斜：球不會停在屋頂下面看不見 */
    slopes: [{ x: 162, y: 272, w: 36, h: 56, g: [0, -320] }]
  };

  /* ─────────────────────────────────────────────────────────────
     第 2 洞　漂漂木橋
     木橋左右漂：漂到正中間的時候打過去，
     再踩上彈跳板，飛到最上面的小島。
     ───────────────────────────────────────────────────────────── */
  var h2Tee = island(90, 490, 180, 120, 26);
  var h2Mid = island(90, 250, 180, 120, 26);
  var h2Top = island(60, 30, 240, 150, 30);
  var HOLE2 = {
    id: 2,
    name: '漂漂木橋',
    tip: '等木橋漂到中間再打，踩到彈跳板就會飛上去！',
    par: 3,
    tee: [180, 568],
    cup: [214, 82],
    lands: [h2Tee, h2Mid, h2Top],
    islands: [h2Tee.poly, h2Mid.poly, h2Top.poly],
    rails: [].concat(
      railRing(90, 490, 180, 120, 26, [{ x: 138, y: 480, w: 84, h: 24 }]),
      railRing(90, 250, 180, 120, 26, [{ x: 138, y: 356, w: 84, h: 24 }]),
      railRing(60, 30, 240, 150, 30)
    ),
    bumpers: [{ x: 128, y: 96, r: 12 }],
    bridges: [{ x: 148, y: 356, w: 64, h: 148, ax: 92, period: 6, phase: Math.PI }],
    pads: [{ x: 150, y: 264, w: 60, h: 30, dir: [0, -1], v: 200, vz: 320 }]
  };

  /* ─────────────────────────────────────────────────────────────
     第 3 洞　魔法門跳跳坡
     出發的小島沒有路：鑽進魔法門，從右邊的小島出來；
     衝上跳跳坡飛過去，再一個坡，就到山頂了。
     ───────────────────────────────────────────────────────────── */
  var h3Tee = island(30, 470, 150, 145, 26);
  var h3Two = island(205, 330, 125, 150, 24);
  var h3Three = island(195, 150, 135, 110, 24);
  var h3Top = island(30, 10, 300, 80, 26);
  var HOLE3 = {
    id: 3,
    name: '魔法門跳跳坡',
    tip: '鑽進魔法門，再衝上跳跳坡，飛到山頂！',
    par: 4,
    tee: [105, 582],
    cup: [104, 50],
    lands: [h3Tee, h3Two, h3Three, h3Top],
    islands: [h3Tee.poly, h3Two.poly, h3Three.poly, h3Top.poly],
    rails: [].concat(
      railRing(30, 470, 150, 145, 26),
      railRing(205, 330, 125, 150, 24, [{ x: 236, y: 320, w: 62, h: 20 }]),
      railRing(195, 150, 135, 110, 24, [{ x: 236, y: 140, w: 62, h: 20 }, { x: 226, y: 246, w: 82, h: 24 }]),
      railRing(30, 10, 300, 80, 26, [{ x: 226, y: 76, w: 82, h: 24 }]),
      [
        [[237, 330], [237, 385]], [[297, 330], [297, 385]],
        [[237, 150], [237, 200]], [[297, 150], [297, 200]]
      ]
    ),
    bumpers: [{ x: 178, y: 44, r: 11 }],
    ramps: [
      { x: 237, y: 330, w: 60, h: 55, dir: [0, -1], max: 330 },
      { x: 237, y: 150, w: 60, h: 50, dir: [0, -1], max: 250 }
    ],
    portals: [{ a: [105, 502], b: [267, 452], out: [0, -1] }]
  };

  var GolfHoles = { HOLES: [HOLE1, HOLE2, HOLE3], W: 360, H: 640 };

  root.GolfHoles = GolfHoles;
  if (typeof module !== 'undefined' && module.exports) module.exports = GolfHoles;
})(typeof window !== 'undefined' ? window : globalThis);
