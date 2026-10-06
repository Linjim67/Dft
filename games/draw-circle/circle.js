/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 畫圓圈：圓度評分（純數學，不碰 DOM）

   1. 重新取樣：沿著筆跡長度平均取 64 點——畫快畫慢不影響分數
   2. 擬合圓：最小平方法（Kåsa）找出最貼近的完美圓（圓心 + 半徑）
   3. 圓度：每一點離圓周的距離，除以半徑取均方根（RMS）；誤差越小越圓
   4. 完整度：繞著圓心轉了幾度，滿一圈（360°）才算完整
   5. 分數 = 100 × 圓度 × 完整度²（平方：缺一角的 C 字形要明顯扣分）
   一條直線會擬合出超大的圓、誤差很小，但只轉了一點點角度——完整度把它擋下來。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var CONFIG = {
    SAMPLES: 64,
    MIN_POINTS: 8,
    MIN_SIZE_PX: 60,        /* 外框最長邊小於這個 → 「畫大一點」 */
    MIN_SWEEP_DEG: 180,     /* 轉不到半圈 → 「要畫一整圈」 */
    /* RMS 誤差 22% 時圓度歸零。依形狀校準：正方形（誤差 11%）要落在 55 分以下，
       手畫得還不錯的圓（誤差約 2.5%）要能拿到三顆星。 */
    ERROR_FOR_ZERO: 0.22,
    RATINGS: [
      { min: 88, stars: 3, text: '超級圓！' },
      { min: 72, stars: 2, text: '好圓喔！' },
      { min: 55, stars: 1, text: '有圓的樣子了' },
      { min: 0, stars: 0, text: '再試一次看看' }
    ]
  };

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pathLength(pts) {
    var d = 0;
    for (var i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
    return d;
  }

  /* 沿路徑等距取 n 點（$1 Recognizer 的做法） */
  function resample(pts, n) {
    var total = pathLength(pts);
    if (total === 0) return pts.slice(0, 1);
    var step = total / (n - 1);
    var out = [{ x: pts[0].x, y: pts[0].y }];
    var acc = 0;
    var src = pts.map(function (p) { return { x: p.x, y: p.y }; });
    for (var i = 1; i < src.length; i++) {
      var d = dist(src[i - 1], src[i]);
      if (acc + d >= step && d > 0) {
        var t = (step - acc) / d;
        var q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y) };
        out.push(q);
        src.splice(i, 0, q);
        acc = 0;
      } else {
        acc += d;
      }
    }
    while (out.length < n) out.push({ x: src[src.length - 1].x, y: src[src.length - 1].y });
    return out.slice(0, n);
  }

  /* Kåsa 代數擬合：x² + y² + Dx + Ey + F = 0 的最小平方解。
     先移到質心再解，數值比較穩定。 */
  function fitCircle(pts) {
    var n = pts.length, mx = 0, my = 0;
    pts.forEach(function (p) { mx += p.x; my += p.y; });
    mx /= n; my /= n;
    var sxx = 0, syy = 0, sxy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
    pts.forEach(function (p) {
      var x = p.x - mx, y = p.y - my, z = x * x + y * y;
      sxx += x * x; syy += y * y; sxy += x * y; sx += x; sy += y;
      sxz += x * z; syz += y * z; sz += z;
    });
    /* 解 3×3 正規方程 M · [D E F]ᵀ = v */
    var M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
    var v = [-sxz, -syz, -sz];
    var s = solve3(M, v);
    if (!s) return null;
    var cx = -s[0] / 2, cy = -s[1] / 2;
    var r2 = cx * cx + cy * cy - s[2];
    if (!(r2 > 0)) return null;
    return { cx: cx + mx, cy: cy + my, r: Math.sqrt(r2) };
  }

  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  function solve3(M, v) {
    var d = det3(M);
    if (!isFinite(d) || Math.abs(d) < 1e-9) return null;
    var out = [];
    for (var c = 0; c < 3; c++) {
      var m = M.map(function (row, i) { return row.map(function (val, j) { return j === c ? v[i] : val; }); });
      out.push(det3(m) / d);
    }
    return out;
  }

  /* 繞圓心累積轉過的角度（弧度，可超過 2π） */
  function sweep(pts, cx, cy) {
    var total = 0;
    var prev = Math.atan2(pts[0].y - cy, pts[0].x - cx);
    for (var i = 1; i < pts.length; i++) {
      var a = Math.atan2(pts[i].y - cy, pts[i].x - cx);
      var d = a - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      total += d;
      prev = a;
    }
    return Math.abs(total);
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function rate(score) {
    for (var i = 0; i < CONFIG.RATINGS.length; i++) {
      if (score >= CONFIG.RATINGS[i].min) return CONFIG.RATINGS[i];
    }
    return CONFIG.RATINGS[CONFIG.RATINGS.length - 1];
  }

  /* 回傳 { ok, score, roundness, completeness, error, sweepDeg, circle } 或 { ok:false, reason } */
  function scoreStroke(raw) {
    if (!raw || raw.length < CONFIG.MIN_POINTS) return { ok: false, reason: 'short' };
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    raw.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    var size = Math.max(maxX - minX, maxY - minY);
    if (size < CONFIG.MIN_SIZE_PX) return { ok: false, reason: 'small' };

    var pts = resample(raw, CONFIG.SAMPLES);
    var c = fitCircle(pts);
    if (!c) return { ok: false, reason: 'open' };

    var sweepDeg = sweep(pts, c.cx, c.cy) * 180 / Math.PI;
    if (sweepDeg < CONFIG.MIN_SWEEP_DEG) return { ok: false, reason: 'open' };

    var sq = 0;
    pts.forEach(function (p) {
      var e = (dist(p, { x: c.cx, y: c.cy }) - c.r) / c.r;
      sq += e * e;
    });
    var error = Math.sqrt(sq / pts.length);
    var roundness = clamp01(1 - error / CONFIG.ERROR_FOR_ZERO);
    var completeness = clamp01(sweepDeg / 360);
    var score = Math.round(100 * roundness * completeness * completeness);
    return {
      ok: true, score: score, roundness: roundness, completeness: completeness,
      error: error, sweepDeg: sweepDeg, circle: c, rating: rate(score)
    };
  }

  /* ─────────────────────────────────────────────────────────────
     每日排行榜（純函式；資料進出在 /shared/firebase.js 的 circle）
     - 一天 = 台灣時間（UTC+8）的日期，寫成 YYYYMMDD
     - 只有分數，沒有名字
     - 今天的挑戰者不到三人時，空著的名次用預設分數補上（73、68、64），標成「預設」
     ───────────────────────────────────────────────────────────── */

  var BOARD_DEFAULTS = [73, 68, 64];

  function dayKey(ms) {
    return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
  }

  /* real：今天真正的前幾名 [{ score, mine }]（高到低）→ 一定回傳三名 [{ score, mine, isDefault }] */
  function board(real, defaults) {
    var list = (real || []).slice(0, 3).map(function (r) {
      return { score: r.score, mine: !!r.mine, isDefault: false };
    });
    var d = (defaults || BOARD_DEFAULTS).slice().sort(function (a, b) { return b - a; });
    for (var i = 0; list.length < 3 && i < d.length; i++) list.push({ score: d[i], mine: false, isDefault: true });
    /* 同分時真正的挑戰者排在預設分數前面 */
    list.sort(function (a, b) { return b.score - a.score || (a.isDefault ? 1 : 0) - (b.isDefault ? 1 : 0); });
    return list;
  }

  var CircleScore = {
    CONFIG: CONFIG, resample: resample, fitCircle: fitCircle, sweep: sweep,
    scoreStroke: scoreStroke, rate: rate, pathLength: pathLength,
    BOARD_DEFAULTS: BOARD_DEFAULTS, dayKey: dayKey, board: board
  };
  root.CircleScore = CircleScore;
  if (typeof module !== 'undefined' && module.exports) module.exports = CircleScore;
})(typeof window !== 'undefined' ? window : globalThis);
