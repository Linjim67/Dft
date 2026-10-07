/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 浮空小島高爾夫：物理（純邏輯，不碰 DOM）
   世界座標：x 往右、y 往下，一個球洞是 360 × 640 的直式畫面。
   z 是離地高度（往上為正）：彈跳板、跳跳坡會把球拋到空中。
   固定步長（遊戲時間 1/120 秒）：同樣的一桿永遠走同樣的路，
   測試裡的機器人才證明得了每一洞都打得進去。
   所有可調整的數字都集中在 CONFIG。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var CONFIG = {
    DT: 1 / 120,
    MAX_REAL_DT: 0.1,         /* 切回分頁時不會一口氣跑好幾秒 */

    BALL_R: 7,
    CUP_R: 11,

    /* 擊球：力氣 0–1 → 初速（單位／秒）。指數 < 1：輕輕推的那一段比較好控制 */
    SHOT_MIN: 45,
    SHOT_MAX: 640,
    SHOT_CURVE: 0.8,

    ROLL: 150,                /* 草地的固定阻力（單位／秒²） */
    DRAG: 0.5,                /* 越快減得越多（1／秒） */
    STOP: 8,                  /* 比這個慢就停下來 */

    BOUNCE: 0.72,             /* 撞欄杆反彈 */
    BUMPER: 0.95,             /* 撞蘑菇彈簧 */
    RAIL_HALF: 3.5,           /* 欄杆半寬 */
    RAIL_H: 9,                /* 欄杆高度：球在這個高度以上就飛過去 */

    G: 900,                   /* 重力 */
    LAND_BOUNCE: 0.32,        /* 落地彈一下 */
    LAND_KEEP: 0.82,          /* 落地後保留的水平速度 */
    LAND_STICK: 90,           /* 往下速度比這個小就不再彈 */

    SINK_V: 330,              /* 比這個慢經過洞口就會進洞 */
    CUP_PULL: 320,            /* 洞口附近輕輕把球吸過去（小朋友比較容易進） */
    CUP_PULL_R: 10,

    RAMP_G: 320,              /* 跳跳坡往上滾的減速 */
    RAMP_VZ: 170,             /* 衝出坡頂往上的速度：越快飛越遠 */
    RAMP_TOP: 12,             /* 坡頂高度（也是起飛高度） */
    RAMP_MIN: 40,             /* 比這個慢就衝不上坡頂，會滾回來 */
    /* 衝出坡頂的速度夾在 min–max 之間：只要衝得上去就一定飛得到下一座小島，
       太用力也不會飛過頭（max 每個坡自己設，看下一座小島有多遠） */
    RAMP_HOP_MIN: 190,

    PORTAL_R: 15,
    PORTAL_MIN: 140,          /* 從魔法門出來至少這麼快，不會卡在門口 */

    FALL_S: 0.85,             /* 掉下小島的動畫時間 */
    PICKUP_OVER_PAR: 4,       /* 超過標準桿 4 桿還沒進：撿起來，下一洞 */
    PENALTY: 1                /* 掉下小島多算 1 桿 */
  };

  /* ─────────────────────────────────────────────────────────────
     幾何小工具
     ───────────────────────────────────────────────────────────── */

  function inPoly(poly, x, y) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function inRect(r, x, y, ox, oy) {
    var rx = r.x + (ox || 0), ry = r.y + (oy || 0);
    return x >= rx && x <= rx + r.w && y >= ry && y <= ry + r.h;
  }

  function wrapPi(a) {
    a = a % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /* ─────────────────────────────────────────────────────────────
     會動的東西：漂漂木橋
     ───────────────────────────────────────────────────────────── */

  function bridgeOff(B, t) {
    var s = Math.sin(Math.PI * 2 * t / B.period + (B.phase || 0));
    return { x: (B.ax || 0) * s, y: (B.ay || 0) * s };
  }

  /* ─────────────────────────────────────────────────────────────
     把球洞資料整理成碰撞用的世界
     ───────────────────────────────────────────────────────────── */

  function seg(ax, ay, bx, by, half) {
    return { ax: ax, ay: ay, bx: bx, by: by, half: half };
  }

  function build(H) {
    var W = {
      hole: H,
      islands: H.islands,
      segs: [],
      bumpers: H.bumpers || [],
      ramps: (H.ramps || []).map(function (r) {
        var vertical = r.dir[0] === 0;
        return {
          x: r.x, y: r.y, w: r.w, h: r.h, dir: r.dir,
          cx: r.x + r.w / 2, cy: r.y + r.h / 2,
          half: (vertical ? r.h : r.w) / 2,
          side: (vertical ? r.w : r.h) / 2,
          min: r.min || CONFIG.RAMP_HOP_MIN,
          max: r.max || 1e9
        };
      }),
      pads: H.pads || [],
      portals: H.portals || [],
      bridges: H.bridges || [],
      cup: H.cup,
      tee: H.tee
    };

    (H.rails || []).forEach(function (line) {
      for (var i = 0; i + 1 < line.length; i++) {
        W.segs.push(seg(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1], CONFIG.RAIL_HALF));
      }
    });

    return W;
  }

  /* 球腳下是什麼：-1 = 空中（會掉下去），0 = 小島，1 + i = 第 i 座木橋 */
  function groundAt(W, x, y, t) {
    for (var i = 0; i < W.bridges.length; i++) {
      var B = W.bridges[i], o = bridgeOff(B, t);
      if (inRect(B, x, y, o.x, o.y)) return 1 + i;
    }
    for (var k = 0; k < W.islands.length; k++) {
      if (inPoly(W.islands[k], x, y)) return 0;
    }
    for (var r = 0; r < W.ramps.length; r++) {
      if (inRect(W.ramps[r], x, y)) return 0;
    }
    return -1;
  }

  /* 球在跳跳坡上的位置（給畫面抬高球用）：0 = 坡底，1 = 坡頂；不在坡上 = -1 */
  function rampAlong(W, x, y) {
    for (var i = 0; i < W.ramps.length; i++) {
      var R = W.ramps[i];
      if (!inRect(R, x, y)) continue;
      var a = (x - R.cx) * R.dir[0] + (y - R.cy) * R.dir[1];
      return (a / R.half + 1) / 2;
    }
    return -1;
  }

  /* ─────────────────────────────────────────────────────────────
     球
     ───────────────────────────────────────────────────────────── */

  function newBall(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, z: 0, vz: 0, state: 'rest', fallT: 0, padCD: 0 };
  }

  function shotSpeed(power) {
    var p = Math.max(0, Math.min(1, power));
    return CONFIG.SHOT_MIN + (CONFIG.SHOT_MAX - CONFIG.SHOT_MIN) * Math.pow(p, CONFIG.SHOT_CURVE);
  }

  function shoot(b, dx, dy, power) {
    var L = Math.hypot(dx, dy) || 1, v = shotSpeed(power);
    b.vx = dx / L * v;
    b.vy = dy / L * v;
    b.vz = 0;
    b.z = 0;
    b.state = 'roll';
  }

  /* ─────────────────────────────────────────────────────────────
     碰撞
     ───────────────────────────────────────────────────────────── */

  function hitSeg(b, s, e, ev) {
    var ex = s.bx - s.ax, ey = s.by - s.ay, L2 = ex * ex + ey * ey;
    var u = L2 ? ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / L2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    var qx = s.ax + ex * u, qy = s.ay + ey * u;
    var dx = b.x - qx, dy = b.y - qy, d2 = dx * dx + dy * dy, R = CONFIG.BALL_R + s.half;
    if (d2 >= R * R) return;
    var d = Math.sqrt(d2);
    if (d < 1e-6) {
      /* 球心剛好壓在線上：往球來的方向推回去 */
      dx = -ey; dy = ex; d = Math.sqrt(L2) || 1;
      if (dx * b.vx + dy * b.vy > 0) { dx = -dx; dy = -dy; }
    }
    var nx = dx / d, ny = dy / d;
    b.x = qx + nx * R;
    b.y = qy + ny * R;
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
      if (ev && -vn > 30) ev.push({ type: 'wall', v: -vn });
    }
  }

  function hitCircle(b, c, ev) {
    var dx = b.x - c.x, dy = b.y - c.y, R = CONFIG.BALL_R + c.r, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return;
    var d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
    b.x = c.x + nx * R;
    b.y = c.y + ny * R;
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + CONFIG.BUMPER) * vn * nx;
      b.vy -= (1 + CONFIG.BUMPER) * vn * ny;
      if (ev) ev.push({ type: 'bumper', v: -vn, bumper: c });
    }
  }

  /* 欄杆和蘑菇都很矮：球飛得比欄杆高就直接飛過去 */
  function collide(W, b, ev) {
    if (b.z >= CONFIG.RAIL_H) return;
    for (var i = 0; i < W.segs.length; i++) hitSeg(b, W.segs[i], CONFIG.BOUNCE, ev);
    for (var k = 0; k < W.bumpers.length; k++) hitCircle(b, W.bumpers[k], ev);
  }

  /* ─────────────────────────────────────────────────────────────
     走一步（DT 秒）
     ghost = 預覽：時間不動（木橋停在現在的位置），
             碰到彈跳板、跳跳坡頂、魔法門就停在那裡（b.state = 'mark'）。
     ───────────────────────────────────────────────────────────── */

  function startFall(b, ev) {
    b.state = 'fall';
    b.fallT = 0;
    b.vz = 0;
    if (ev) ev.push({ type: 'fall' });
  }

  function step(W, b, t, ev, ghost) {
    var C = CONFIG, dt = C.DT;
    var st = b.state;
    if (st === 'sunk' || st === 'out' || st === 'mark') return;

    if (st === 'fall') {
      b.fallT += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.985;
      b.vy *= 0.985;
      b.vz -= C.G * dt;
      b.z += b.vz * dt;
      if (b.fallT >= C.FALL_S) {
        b.state = 'out';
        if (ev) ev.push({ type: 'out' });
      }
      return;
    }

    /* 站在木橋上：跟著木橋一起漂（停著也一樣） */
    if (st !== 'air' && !ghost && W.bridges.length) {
      var gi = groundAt(W, b.x, b.y, t);
      if (gi > 0) {
        var B = W.bridges[gi - 1], o0 = bridgeOff(B, t), o1 = bridgeOff(B, t + dt);
        b.x += o1.x - o0.x;
        b.y += o1.y - o0.y;
      }
    }
    if (st === 'rest') return;
    if (b.padCD > 0) b.padCD -= dt;

    if (st === 'air') {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 1 - 0.12 * dt;
      b.vy *= 1 - 0.12 * dt;
      b.vz -= C.G * dt;
      b.z += b.vz * dt;
      collide(W, b, ev);
      if (b.z <= 0) {
        b.z = 0;
        if (groundAt(W, b.x, b.y, t) < 0) {
          startFall(b, ev);
        } else if (-b.vz > C.LAND_STICK) {
          if (ev) ev.push({ type: 'land', v: -b.vz });
          b.vz = -b.vz * C.LAND_BOUNCE;
          b.vx *= C.LAND_KEEP;
          b.vy *= C.LAND_KEEP;
        } else {
          b.vz = 0;
          b.state = 'roll';
        }
      }
      return;
    }

    /* ── 在地上滾 ── */
    var ax = 0, ay = 0, tilted = false, i;
    var onRamp = null;
    for (i = 0; i < W.ramps.length; i++) {
      var R = W.ramps[i];
      if (inRect(R, b.x, b.y)) { onRamp = R; ax -= R.dir[0] * C.RAMP_G; ay -= R.dir[1] * C.RAMP_G; tilted = true; }
    }
    var cdx = W.cup[0] - b.x, cdy = W.cup[1] - b.y, cd = Math.hypot(cdx, cdy);
    var sp = Math.hypot(b.vx, b.vy);
    if (cd < C.CUP_R + C.CUP_PULL_R && cd > 0.5 && sp < 200) {
      var k = C.CUP_PULL * (1 - cd / (C.CUP_R + C.CUP_PULL_R));
      ax += cdx / cd * k;
      ay += cdy / cd * k;
    }
    b.vx += ax * dt;
    b.vy += ay * dt;

    sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      var ns = Math.max(0, sp - (C.ROLL + C.DRAG * sp) * dt);
      b.vx *= ns / sp;
      b.vy *= ns / sp;
      sp = ns;
    }

    var px = b.x, py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    collide(W, b, ev);

    /* 衝出跳跳坡頂：飛起來 */
    if (onRamp) {
      var a0 = (px - onRamp.cx) * onRamp.dir[0] + (py - onRamp.cy) * onRamp.dir[1];
      var a1 = (b.x - onRamp.cx) * onRamp.dir[0] + (b.y - onRamp.cy) * onRamp.dir[1];
      var lat = Math.abs((b.x - onRamp.cx) * onRamp.dir[1] - (b.y - onRamp.cy) * onRamp.dir[0]);
      var along = b.vx * onRamp.dir[0] + b.vy * onRamp.dir[1];
      if (a0 < onRamp.half && a1 >= onRamp.half && lat <= onRamp.side && along > C.RAMP_MIN) {
        if (ghost) { b.state = 'mark'; return; }
        var hop = Math.max(onRamp.min, Math.min(onRamp.max, along));
        var lx = b.vx - onRamp.dir[0] * along, ly = b.vy - onRamp.dir[1] * along;
        b.vx = onRamp.dir[0] * hop + lx * 0.5;
        b.vy = onRamp.dir[1] * hop + ly * 0.5;
        b.state = 'air';
        b.z = C.RAMP_TOP;
        b.vz = C.RAMP_VZ;
        if (ev) ev.push({ type: 'ramp' });
        return;
      }
    }

    /* 彈跳板：往板子指的方向彈上去 */
    for (i = 0; i < W.pads.length; i++) {
      var P = W.pads[i];
      if (b.padCD <= 0 && inRect(P, b.x, b.y)) {
        if (ghost) { b.state = 'mark'; return; }
        var side = b.vx * -P.dir[1] + b.vy * P.dir[0];
        b.vx = P.dir[0] * P.v + -P.dir[1] * side * 0.25;
        b.vy = P.dir[1] * P.v + P.dir[0] * side * 0.25;
        b.vz = P.vz;
        b.z = 4;
        b.state = 'air';
        b.padCD = 0.4;
        if (ev) ev.push({ type: 'pad', pad: i });
        return;
      }
    }

    /* 魔法門：從 a 鑽進去、從 b 出來，朝 out 的方向 */
    for (i = 0; i < W.portals.length; i++) {
      var Q = W.portals[i];
      if (Math.hypot(b.x - Q.a[0], b.y - Q.a[1]) < C.PORTAL_R - 4) {
        if (ghost) { b.state = 'mark'; return; }
        var v = Math.max(sp, C.PORTAL_MIN);
        b.x = Q.b[0] + Q.out[0] * 4;
        b.y = Q.b[1] + Q.out[1] * 4;
        b.vx = Q.out[0] * v;
        b.vy = Q.out[1] * v;
        if (ev) ev.push({ type: 'warp', portal: i });
        return;
      }
    }

    /* 進洞 */
    cd = Math.hypot(W.cup[0] - b.x, W.cup[1] - b.y);
    if (cd < C.CUP_R - 1.5) {
      if (sp < C.SINK_V) {
        b.state = 'sunk';
        b.vx = b.vy = 0;
        if (ev) ev.push({ type: 'sink' });
        return;
      }
      /* 太快：從洞口滑過去，慢一點 */
      b.vx *= 0.93;
      b.vy *= 0.93;
    }

    if (groundAt(W, b.x, b.y, t) < 0) { startFall(b, ev); return; }

    if (!tilted && sp < C.STOP) {
      b.vx = b.vy = 0;
      b.state = 'rest';
      if (ev) ev.push({ type: 'rest' });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     預覽：從現在的位置打出去，前面一段會怎麼走
     回傳路徑上的點（每 4 單位一個）和結尾：
       stop 停下來　fall 會掉下去　cut 只畫到這裡　mark 碰到機關　cup 進洞
     ───────────────────────────────────────────────────────────── */

  function preview(W, x, y, dx, dy, power, t, maxLen) {
    var b = newBall(x, y);
    shoot(b, dx, dy, power);
    var pts = [[x, y]], len = 0, lx = x, ly = y, end = 'cut';
    for (var n = 0; n < 1200; n++) {
      step(W, b, t, null, true);
      if (b.state === 'fall' || b.state === 'out') { end = 'fall'; break; }
      var d = Math.hypot(b.x - lx, b.y - ly);
      if (d >= 4) {
        len += d;
        lx = b.x; ly = b.y;
        pts.push([b.x, b.y]);
        if (len >= maxLen) break;
      }
      if (b.state === 'rest') { end = 'stop'; break; }
      if (b.state === 'mark') { end = 'mark'; break; }
      if (b.state === 'sunk') { end = 'cup'; break; }
    }
    if (pts[pts.length - 1][0] !== b.x || pts[pts.length - 1][1] !== b.y) pts.push([b.x, b.y]);
    return { pts: pts, end: end };
  }

  /* 一桿從頭跑到結束（測試、機器人用）：回傳 sunk / rest / out 和最後的位置 */
  function simulate(W, b, t, maxS) {
    var steps = Math.round((maxS || 20) / CONFIG.DT);
    for (var n = 0; n < steps; n++) {
      step(W, b, t, null, false);
      t += CONFIG.DT;
      if (b.state === 'sunk' || b.state === 'out' || b.state === 'rest') break;
    }
    return { state: b.state, t: t };
  }

  var GolfPhysics = {
    CONFIG: CONFIG,
    build: build,
    newBall: newBall,
    shotSpeed: shotSpeed,
    shoot: shoot,
    step: step,
    preview: preview,
    simulate: simulate,
    groundAt: groundAt,
    rampAlong: rampAlong,
    bridgeOff: bridgeOff,
    inPoly: inPoly,
    inRect: inRect
  };

  root.GolfPhysics = GolfPhysics;
  if (typeof module !== 'undefined' && module.exports) module.exports = GolfPhysics;
})(typeof window !== 'undefined' ? window : globalThis);
