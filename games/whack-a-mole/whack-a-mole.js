/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 打地鼠：畫面與操作
   遊戲規則與數字在 engine.js（WhackEngine），這裡只處理畫面、計時與輸入。
   單機：用這支手機的個人資料開始。
   雙機（孩子的手機，網址 /games/1234/whack-a-mole/）：這支手機沒有個人資料，
   duo-child.js 連上房間後，用房間裡的年齡與代碼呼叫 WhackGame.boot，
   並透過回傳的 api 收家長的指令（放角色、事件、模式）、回報棋盤狀態。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* duo：{ mode: 'manual' | 'auto', onChange: function }；單機為 null */
  function boot(p, duo) {
    duo = duo || null;

    var E = window.WhackEngine;
    var C = E.CONFIG;
    var $ = function (id) { return document.getElementById(id); };
    var esc = Anxin.escapeHtml;
    var live = $('liveRegion');

    /* 無痕模式下存取 localStorage 本身可能丟例外：退回記憶體，遊戲照玩，只是不會記住 */
    var storage = (function () {
      try { if (window.localStorage) return window.localStorage; } catch (e) { /* 忽略 */ }
      var m = {};
      return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } };
    })();

    var progress = E.loadProgress(storage, p.code);
    var band = E.ageBand(p.age);

    /* 題庫載入失敗（離線）就跳過小知識；該題保留到下次 */
    var bank = null;
    if (window.fetch) {
      window.fetch('/games/whack-a-mole/questions.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (b) {
          if (!b || !b.questions) return;
          bank = b;
          if (S.view === 'intro') { renderCollection($('collection')); renderChallengeHint($('introChallenge')); }
          if (S.view === 'summary') { renderCollection($('summaryCollection')); renderChallengeHint($('summaryChallenge')); }
        })
        .catch(function () { /* 離線：略過 */ });
    }

    function save() { E.saveProgress(storage, progress); }
    function fmt(n) { return Number(n).toLocaleString('zh-TW'); }

    function setArt(useEl, id) {
      useEl.setAttribute('href', '#' + (id.indexOf('-') > 0 ? id : 'ch-' + id));
      useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + (id.indexOf('-') > 0 ? id : 'ch-' + id));
    }

    function roundLabel(r) {
      return r <= C.ROUNDS ? '第 ' + r + ' / ' + C.ROUNDS + ' 回合' : '無限模式・第 ' + r + ' 回合';
    }

    var COAT_NAME = { normal: '', silver: '銀色', boss: '金色大魔王', iron: '鐵甲' };

    /* ─────────────────────────────────────────────────────────────
       狀態
       ───────────────────────────────────────────────────────────── */

    var S = {
      view: 'intro',
      round: 1,
      runScore: 0,
      roundScore: 0,
      roundStartTotal: 0,
      clock: 0,          /* 這回合已經過的毫秒（暫停時不走） */
      lastTs: null,
      rafId: null,
      running: false,
      nextSpawnAt: 0,
      shownSec: null,
      stay: 1,
      hammer: 1,
      holes: [],
      scrub: null,       /* 病毒入侵時按住螢幕的手指：{ id, x, y, i }（i：手指下的洞） */
      keyHold: null,     /* 按住數字鍵消毒：{ key, i } */
      warned: false,     /* 這回合已經提示過「剩下 5 秒」 */
      invasionAt: null,  /* 這回合幾毫秒時病毒入侵（null：沒有或已經入侵過） */
      invasion: null,    /* 入侵中：{ until } */
      invasionTaught: false, /* 這一局已經看過入侵教學 */
      quiz: null,
      unlocked: [],
      leaving: false,
      boss: null,        /* 大魔王所在的洞（在場時暫停冒出其他角色） */
      bosses: 0,         /* 這一回合出現過幾隻大魔王 */
      streak: 0,         /* 連擊：連續抓到、沒有角色逃走（決定分數倍率） */
      roundBestStreak: 0,
      appeared: 0,       /* 這一回合出現幾個（算獎牌用） */
      caught: 0,
      medal: null,
      medalBonus: 0,
      newStickers: [],
      /* 雙機：manual = 家長放角色（不會自己冒出來）；auto = 跟單機一樣 */
      mode: duo && duo.mode === 'auto' ? 'auto' : (duo ? 'manual' : 'auto'),
      quakeUntil: 0,     /* 雙機事件，遊戲時鐘 */
      bubbleUntil: 0,
      doubleUntil: 0
    };

    /* 雙機：畫面有變就通知 duo-child.js（它負責節流後寫進 Firestore） */
    function notify() {
      if (duo && duo.onChange) duo.onChange();
    }

    var views = { intro: $('introView'), play: $('playView'), quiz: $('quizView'), summary: $('summaryView') };

    function show(name, focusEl) {
      Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
      S.view = name;
      document.body.classList.toggle('is-playing', name === 'play');
      window.scrollTo(0, 0);
      if (focusEl) focusEl.focus();
      notify();
    }

    /* ─────────────────────────────────────────────────────────────
       棋盤：6 個洞，未解鎖的顯示「維修中」
       ───────────────────────────────────────────────────────────── */

    var board = $('board');

    var HOLE_HTML =
      '<svg class="hole-back" aria-hidden="true"><use href="#hole-back"></use></svg>' +
      '<span class="mole-clip" aria-hidden="true"><span class="mole">' +
      '<span class="hp"><span class="hp-fill"></span></span>' +
      '<span class="coat-badge"></span>' +
      '<svg class="mole-art"><use href="#ch-swab"></use></svg>' +
      '</span></span>' +
      '<svg class="hole-front" aria-hidden="true"><use href="#hole-front"></use></svg>' +
      '<span class="bubble" aria-hidden="true"></span>';

    var LOCKED_HTML =
      '<svg class="hole-back" aria-hidden="true"><use href="#hole-back"></use></svg>' +
      '<svg class="hole-boards" aria-hidden="true"><use href="#hole-boards"></use></svg>' +
      '<svg class="hole-front" aria-hidden="true"><use href="#hole-front"></use></svg>' +
      '<span class="locked-sign"><svg aria-hidden="true"><use href="#icon-cone"></use></svg>維修中</span>';

    function buildBoard() {
      var open = E.unlocks(progress.totalPoints).holes.value;
      board.innerHTML = '';
      S.holes = [];
      for (var i = 0; i < C.HOLES_TOTAL; i++) {
        var isOpen = i < open;
        var el = document.createElement(isOpen ? 'button' : 'div');
        if (isOpen) {
          el.type = 'button';
          el.className = 'hole';
          el.dataset.i = i;
          el.setAttribute('aria-label', '第 ' + (i + 1) + ' 個洞');
          el.innerHTML = HOLE_HTML + '<span class="hole-key" aria-hidden="true">' + (i + 1) + '</span>';
        } else {
          el.className = 'hole is-locked';
          el.innerHTML = LOCKED_HTML;
        }
        board.appendChild(el);
        S.holes.push({
          i: i, el: el, open: isOpen, mole: null, freeAt: 0,
          moleEl: isOpen ? el.querySelector('.mole') : null,
          use: isOpen ? el.querySelector('.mole-art use') : null,
          hpFill: isOpen ? el.querySelector('.hp-fill') : null,
          badge: isOpen ? el.querySelector('.coat-badge') : null
        });
      }
    }

    function holeLabel(h) {
      var base = '第 ' + (h.i + 1) + ' 個洞' + (h.bubble ? '（被泡泡蓋住了，先戳破）' : '');
      if (!h.mole) return base;
      return base + '：' + COAT_NAME[h.mole.variant] + E.BY_ID[h.mole.char].name;
    }

    /* 大魔王不貼角標：金色、金光、棋盤金框和「大魔王來了！」已經夠清楚（讀螢幕的人聽 aria-label） */
    var BADGE = { normal: '', silver: '×1.5', iron: '×2', boss: '' };

    function raise(h, char, variant) {
      var boss = variant === 'boss';
      if (boss) {
        /* 大魔王登場：其他角色先躲起來（不算逃走、也不算進獎牌的「出現」） */
        S.holes.forEach(function (o) {
          if (o !== h && o.mole) { lower(o, false); S.appeared--; }
        });
        S.boss = h;
        S.bosses++;
      }
      var hp = E.maxHp(variant, p.age);
      S.appeared++;
      var isVirus = !!E.BY_ID[char].wipe;
      h.mole = {
        char: char, variant: variant, hp: hp, maxHp: hp,
        upAt: S.clock,
        downAt: S.clock + E.upMs(char, variant, progress.level[char], p.age, S.stay, S.round),
        wiped: 0, wipeNeed: isVirus ? E.wipeMs(variant) : 0 /* 病毒：已經擦了幾毫秒／要擦滿幾毫秒 */
      };
      setArt(h.use, char);
      h.moleEl.className = 'mole v-' + variant;
      h.badge.innerHTML = BADGE[variant];
      /* 血條：要打好幾下的（鐵甲、大魔王），以及要擦一陣子的病毒 */
      h.el.classList.toggle('has-hp', hp > 1 || isVirus);
      h.el.classList.toggle('is-boss', boss);
      h.hpFill.style.transform = 'scaleX(1)';
      h.el.classList.remove('is-hit', 'is-nope', 'is-hurt', 'is-wiping');
      h.el.dataset.char = char;
      h.el.classList.add('is-up');
      h.el.setAttribute('aria-label', holeLabel(h));
      if (boss) {
        setBossLook(true);
        callout('大魔王來了！');
      }
      notify();
    }

    function lower(h, hit) {
      if (!h.mole) return;
      h.mole = null;
      h.freeAt = S.clock + 220; /* 等縮回去的動畫結束，才讓下一隻從同一個洞出來 */
      if (h === S.boss) {
        S.boss = null;
        S.nextSpawnAt = Math.max(S.nextSpawnAt, S.clock + C.BOSS_REST_MS);
        h.el.classList.remove('is-boss');
        setBossLook(false);
      }
      h.el.classList.remove('is-up', 'is-hurt', 'is-wiping');
      if (hit) h.el.classList.add('is-hit');
      delete h.el.dataset.char;
      h.el.setAttribute('aria-label', holeLabel(h));
      notify();
    }

    function msToInvasion() {
      if (S.invasion) return 0;
      return S.invasionAt === null ? Infinity : S.invasionAt - S.clock;
    }

    function spawn() {
      if (S.boss) return; /* 大魔王在場：專心打它 */
      if (S.mode === 'manual' && !S.invasion) return; /* 雙機手動：只有家長放的角色（病毒入侵照樣冒病毒） */
      if (S.invasion && S.invasion.closing) return; /* 入侵最後 2 秒：不再冒新病毒 */
      var free = S.holes.filter(function (h) { return h.open && !h.mole && S.clock >= h.freeAt; });
      if (!free.length) return;
      var h = free[Math.floor(Math.random() * free.length)];
      /* 病毒入侵：只出現病毒 */
      var char = S.invasion ? 'virus' : E.pickCharacter(progress, Math.random, S.round);
      var variant = E.pickVariant(progress.level[char], Math.random);
      if (variant === 'boss' && !E.bossAllowed(S.bosses, C.ROUND_MS - S.clock, S.stay, msToInvasion())) variant = 'normal';
      raise(h, char, variant);
    }

    /* ─────────────────────────────────────────────────────────────
       打擊
       ───────────────────────────────────────────────────────────── */

    function retrigger(el, cls) {
      el.classList.remove(cls);
      void el.offsetWidth; /* 重新觸發同一個動畫 */
      el.classList.add(cls);
    }

    function popScore(h, pts, variant) {
      var s = document.createElement('span');
      s.className = 'pop-score' + (variant === 'normal' ? '' : ' is-' + variant);
      s.textContent = '+' + pts;
      s.setAttribute('aria-hidden', 'true');
      h.el.appendChild(s);
      window.setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 700);
    }

    function knockOut(h) {
      var m = h.mole;
      S.streak++;
      S.roundBestStreak = Math.max(S.roundBestStreak, S.streak);
      if (S.streak === 10) award('streak10');
      C.STREAK_TIERS.forEach(function (t) {
        if (S.streak === t.at) callout(t.at + ' 連擊！×' + t.mult);
      });
      /* 取到十位數，分數比較好看（150、200、300…） */
      var pts = Math.round(E.pointsFor(m.char, m.variant) * E.streakMult(S.streak) * (doubleOn() ? 2 : 1) / 10) * 10;
      S.caught++;
      award('first');
      if (m.char === 'virus') award('virus');
      if (m.variant === 'iron') award('iron');
      if (m.variant === 'boss') {
        award('boss');
        callout('打倒大魔王！');
      }
      S.runScore += pts;
      S.roundScore += pts;
      progress.totalPoints += pts;
      progress.clicks[m.char] = (progress.clicks[m.char] || 0) + 1;
      popScore(h, pts, m.variant);
      if (navigator.vibrate) { try { navigator.vibrate(m.variant === 'boss' ? [20, 40, 30] : 12); } catch (e) { /* 忽略 */ } }
      if (m.variant === 'boss') defeatBoss(h);
      else lower(h, true);
      $('hudScore').textContent = fmt(S.runScore);
      renderMult();
    }

    /* 打倒大魔王：不直接縮回洞裡。閃一下、暈頭轉向、轉圈縮小，星星往外噴；
       播完（BOSS_DEFEAT_MS）這個洞才空出來，其他角色也等播完才冒出來 */
    function defeatBoss(h) {
      lower(h, false);
      h.freeAt = S.clock + C.BOSS_DEFEAT_MS;
      S.nextSpawnAt = Math.max(S.nextSpawnAt, S.clock + C.BOSS_DEFEAT_MS);
      h.el.classList.remove('has-hp'); /* 血條空了，不用再留著 */
      h.el.classList.add('is-defeated');
      var burst = document.createElement('span');
      burst.className = 'boss-burst';
      burst.setAttribute('aria-hidden', 'true');
      var rays = '<b></b>';
      for (var k = 0; k < 10; k++) rays += '<i style="--a:' + (k * 36 + 18) + 'deg;--d:' + (k % 2 ? 44 : 62) + 'px"></i>';
      burst.innerHTML = rays;
      h.el.appendChild(burst);
      var el = h.el;
      var moleEl = h.moleEl;
      window.setTimeout(function () {
        if (burst.parentNode) burst.parentNode.removeChild(burst);
        /* 角色已經縮不見了：直接把它放回洞底（不要看到它再滑下去一次） */
        moleEl.style.transition = 'none';
        el.classList.remove('is-defeated');
        void moleEl.offsetWidth;
        moleEl.style.transition = '';
      }, C.BOSS_DEFEAT_MS);
    }

    function damage(h, amount) {
      var m = h.mole;
      m.hp = Math.max(0, m.hp - amount);
      if (m.hp > 0) {
        h.hpFill.style.transform = 'scaleX(' + Math.round(100 * m.hp / m.maxHp) / 100 + ')';
        retrigger(h.el, 'is-hurt');
        notify();
        return;
      }
      knockOut(h);
    }

    /* 擦病毒：累計擦了多久，擦滿就消失；血條跟著變短。被擦的時候不會跑掉 */
    function wipe(h, ms) {
      var m = h.mole;
      m.wiped += ms;
      if (m.wiped >= m.wipeNeed) {
        knockOut(h);
        return;
      }
      m.downAt = Math.max(m.downAt, S.clock + 200);
      h.hpFill.style.transform = 'scaleX(' + Math.round(100 * (1 - m.wiped / m.wipeNeed)) / 100 + ')';
      notify();
    }

    function isVirusHole(h) {
      return !!(h && h.mole && E.BY_ID[h.mole.char].wipe);
    }

    /* 入侵以外的時間點到病毒（只有測試會發生）：搖頭表示「要用棉片喔」 */
    function nope(h) {
      retrigger(h.el, 'is-nope');
    }

    /* ─────────────────────────────────────────────────────────────
       連擊倍率（分數旁邊的 ×1.5）與跳出來的大字
       ───────────────────────────────────────────────────────────── */

    var hudMult = $('hudMult');
    var calloutEl = $('callout');
    var calloutTimer = null;

    /* 大字從棋盤中間跳出來：連擊里程碑、大魔王、病毒入侵、剩下 5 秒 */
    function callout(text) {
      calloutEl.textContent = text;
      retrigger(calloutEl, 'is-on');
      window.clearTimeout(calloutTimer);
      calloutTimer = window.setTimeout(function () { calloutEl.classList.remove('is-on'); }, 1000);
      Anxin.announce(live, text);
    }

    function renderMult() {
      var m = E.streakMult(S.streak);
      hudMult.hidden = m <= 1;
      hudMult.textContent = '×' + m;
    }

    /* 大魔王的血條就在它頭上（和鐵甲一樣），這裡只換棋盤外框 */
    function setBossLook(on) {
      board.classList.toggle('is-boss', on);
    }

    /* 有角色逃走：連擊歸零、倍率消失 */
    function breakCombo() {
      S.streak = 0;
      renderMult();
    }

    /* ─────────────────────────────────────────────────────────────
       病毒入侵：7 秒只出現病毒；手指就是酒精棉片，按住就一直消毒
       ───────────────────────────────────────────────────────────── */

    var invasionHint = $('invasionHint');
    var invasionLeft = $('invasionLeft');

    function virusesLeft() {
      return S.holes.filter(isVirusHole).length;
    }

    /* 寫在棋盤下方的提示裡：入侵剩幾秒；最後 2 秒起改成「還剩幾隻病毒」 */
    function renderInvasion() {
      if (!S.invasion) return;
      var text = S.invasion.closing ? '剩 ' + virusesLeft() + ' 隻'
        : Math.ceil(Math.max(0, S.invasion.until - S.clock) / 1000) + ' 秒';
      if (invasionLeft.textContent !== text) invasionLeft.textContent = text;
    }

    function setInvasionLook(on) {
      board.classList.toggle('is-invasion', on);
      invasionHint.hidden = !on;
      renderInvasion();
      notify();
    }

    /* 其他角色先躲起來：不算逃走、也不算進獎牌的「出現」 */
    function clearBoard() {
      S.holes.forEach(function (h) {
        if (h.mole) { lower(h, false); S.appeared--; }
      });
    }

    function startInvasion() {
      S.invasionAt = null;
      clearBoard();
      S.invasion = { until: S.clock + C.INVASION_MS };
      S.nextSpawnAt = S.clock + C.INVASION_FIRST_MS;
      setInvasionLook(true);
      /* 這一局第一次：先跳出教學，時間停住；按「開始消毒」才開始倒數 */
      if (!S.invasionTaught) {
        S.invasionTaught = true;
        halt();
        virusDlg.open();
        notify();
        return;
      }
      callout('病毒入侵！');
    }

    /* 入侵最後 2 秒：不再冒新病毒，場上的病毒也不會跑掉，全部消滅才結束 */
    function closeInvasion() {
      S.invasion.closing = true;
      S.holes.forEach(function (h) { if (isVirusHole(h)) h.mole.downAt = Infinity; });
      if (virusesLeft()) callout('把病毒消滅光！');
      notify();
    }

    function endInvasion(quiet) {
      S.invasion = null;
      endScrub();
      S.keyHold = null;
      clearBoard();
      setInvasionLook(false);
      S.nextSpawnAt = S.clock + C.INVASION_REST_MS;
      if (!quiet) callout('消毒完成！');
    }

    function award(id) {
      if (E.earnSticker(progress, id)) S.newStickers.push(id);
    }

    function tapHole(i) {
      if (!S.running) return;
      var h = S.holes[i];
      if (!h || !h.open) return;
      if (h.bubble) { popBubble(h); return; } /* 泡泡蓋住：這一下先戳破泡泡 */
      if (!h.mole) return;
      if (E.BY_ID[h.mole.char].wipe) {
        if (S.invasion) wipe(h, C.WIPE_TAP_MS); else nope(h); /* Enter／空白鍵沒辦法按住：一次算擦一小段 */
        return;
      }
      damage(h, S.hammer);
    }

    board.addEventListener('pointerdown', function (ev) {
      if (S.invasion && S.running) {
        ev.preventDefault();
        startScrub(ev);
        return;
      }
      var el = ev.target.closest('.hole');
      if (!el || el.classList.contains('is-locked')) return;
      ev.preventDefault();
      tapHole(Number(el.dataset.i));
    });

    /* 按住消毒：記下手指下面是哪個洞，每一幀把經過的時間加到那隻病毒身上（手指不動也一直擦） */
    var ghost = $('dragGhost');

    function placeGhost(x, y) {
      ghost.style.transform = 'translate(' + Math.round(x - 36) + 'px,' + Math.round(y - 44) + 'px)';
    }

    function holeIndexOf(el) {
      var holeEl = el && el.closest ? el.closest('.hole') : null;
      return holeEl && !holeEl.classList.contains('is-locked') ? Number(holeEl.dataset.i) : null;
    }

    function holeAt(x, y) {
      return holeIndexOf(document.elementFromPoint ? document.elementFromPoint(x, y) : null);
    }

    function startScrub(ev) {
      try { board.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
      var i = holeIndexOf(ev.target);
      S.scrub = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, i: i !== null ? i : holeAt(ev.clientX, ev.clientY) };
      popUnder(S.scrub.i);
      ghost.hidden = false;
      placeGhost(ev.clientX, ev.clientY);
      document.body.classList.add('is-scrubbing');
    }

    function endScrub() {
      S.scrub = null;
      ghost.hidden = true;
      document.body.classList.remove('is-scrubbing');
    }

    board.addEventListener('pointermove', function (ev) {
      var d = S.scrub;
      if (!d || ev.pointerId !== d.id) return;
      d.x = ev.clientX;
      d.y = ev.clientY;
      d.i = holeAt(d.x, d.y);
      popUnder(d.i);
      placeGhost(d.x, d.y);
    });

    /* 長按不跳出系統選單（Android 長按可能會跳，打斷按住消毒） */
    board.addEventListener('contextmenu', function (ev) {
      if (S.view === 'play') ev.preventDefault();
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
      board.addEventListener(type, function (ev) {
        if (S.scrub && ev.pointerId === S.scrub.id) endScrub();
      });
    });

    /* 只處理鍵盤觸發的 click（Enter／Space）；手指點擊已經在 pointerdown 處理過 */
    board.addEventListener('click', function (ev) {
      if (ev.detail !== 0) return;
      var el = ev.target.closest('.hole');
      if (!el || el.classList.contains('is-locked')) return;
      tapHole(Number(el.dataset.i));
    });

    /* ─────────────────────────────────────────────────────────────
       鍵盤：1–6 打對應的洞（入侵時按住數字鍵＝手指按住那個洞）、Esc 暫停
       ───────────────────────────────────────────────────────────── */

    document.addEventListener('keydown', function (ev) {
      if (S.view !== 'play' || !S.running || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key >= '1' && ev.key <= '6') {
        ev.preventDefault();
        if (S.invasion) {
          if (!ev.repeat) S.keyHold = { key: ev.key, i: Number(ev.key) - 1 };
          return;
        }
        tapHole(Number(ev.key) - 1);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        pause();
      }
    });

    document.addEventListener('keyup', function (ev) {
      if (S.keyHold && ev.key === S.keyHold.key) S.keyHold = null;
    });

    /* ─────────────────────────────────────────────────────────────
       計時迴圈：時間只在遊戲進行時走，暫停或切到別的 App 都會停
       ───────────────────────────────────────────────────────────── */

    var timeEl = $('hudTime');
    var timeWrap = $('hudTimeWrap');

    function renderTime(tLeft) {
      var s = Math.ceil(tLeft);
      if (s === S.shownSec) return;
      S.shownSec = s;
      timeEl.textContent = s;
      timeWrap.classList.toggle('is-low', s <= 5);
      notify();
      if (s <= 5 && S.clock > 0) {
        retrigger(timeEl, 'is-tick'); /* 最後 5 秒：每一秒數字跳一下 */
        if (!S.warned) {
          S.warned = true;
          callout('剩下 5 秒！');
        }
      }
    }

    /* 這一幀正在被擦的病毒：手指下的、按住數字鍵的 */
    function wipeTick(dt) {
      var on = {};
      if (S.scrub && S.scrub.i !== null) on[S.scrub.i] = true;
      if (S.keyHold) on[S.keyHold.i] = true;
      S.holes.forEach(function (h) {
        var wiping = !!on[h.i] && isVirusHole(h);
        h.el.classList.toggle('is-wiping', wiping);
        if (wiping) wipe(h, dt);
      });
    }

    function frame(ts) {
      if (!S.running) return;
      if (S.lastTs === null) S.lastTs = ts;
      /* 上限 100ms：分頁剛回來時不會一口氣跳過好幾秒 */
      var dt = Math.min(Math.max(ts - S.lastTs, 0), 100);
      S.lastTs = ts;
      S.clock += dt;

      S.holes.forEach(function (h) {
        if (h.mole && S.clock >= h.mole.downAt) {
          var wasBoss = h === S.boss;
          lower(h, false);
          if (!S.invasion) breakCombo(); /* 有角色逃走 → 連擊歸零（入侵時病毒很多，不算） */
          if (wasBoss) callout('大魔王跑掉了！');
        }
      });

      if (S.invasion) {
        if (!S.invasion.closing && S.invasion.until - S.clock <= C.INVASION_LAST_MS) closeInvasion();
      } else if (S.invasionAt !== null && S.clock >= S.invasionAt && !S.boss) {
        startInvasion();
        if (!S.running) return; /* 第一次入侵：教學對話框開著，時間停住 */
      }
      if (S.invasion) {
        wipeTick(dt); /* 手指按著（不動也算），就一直消毒 */
        if (S.invasion.closing && !virusesLeft()) endInvasion(); /* 最後一隻也消滅了 */
        else renderInvasion();
      }
      tickEvents();

      if (S.clock >= C.ROUND_MS) {
        endRound();
        return;
      }

      var tLeft = (C.ROUND_MS - S.clock) / 1000;
      if (S.clock >= S.nextSpawnAt) {
        spawn();
        S.nextSpawnAt = S.clock + (S.invasion ? E.invasionSpawnMs : E.spawnIntervalMs)(tLeft, S.round, p.age);
      }
      renderTime(tLeft);
      S.rafId = window.requestAnimationFrame(frame);
    }

    function resume() {
      if (S.running) return;
      S.running = true;
      S.lastTs = null;
      S.rafId = window.requestAnimationFrame(frame);
      notify();
    }

    function halt() {
      S.running = false;
      if (S.rafId !== null) window.cancelAnimationFrame(S.rafId);
      S.rafId = null;
      endScrub();
      notify();
    }

    /* ─────────────────────────────────────────────────────────────
       回合
       ───────────────────────────────────────────────────────────── */

    function startRun() {
      S.round = 1;
      S.runScore = 0;
      S.invasionTaught = false;
      startRound();
    }

    function startRound() {
      var u = E.unlocks(progress.totalPoints);
      S.stay = u.stay.value;
      S.hammer = u.hammer.value;
      S.clock = 0;
      S.nextSpawnAt = 600; /* 給小朋友半秒準備 */
      S.roundScore = 0;
      S.roundStartTotal = progress.totalPoints;
      S.shownSec = null;
      S.boss = null;
      S.bosses = 0;
      S.invasion = null;
      /* 雙機手動：病毒入侵交給家長按 */
      S.invasionAt = S.mode === 'manual' ? null : E.invasionAt(S.round, Math.random);
      S.keyHold = null;
      S.warned = false;
      S.streak = 0;
      S.roundBestStreak = 0;
      S.appeared = 0;
      S.caught = 0;
      S.newStickers = [];
      buildBoard();
      clearEvents();
      setBossLook(false);
      setInvasionLook(false);
      renderMult();
      $('hudRound').textContent = roundLabel(S.round);
      $('hudScore').textContent = fmt(S.runScore);
      renderTime(C.ROUND_MS / 1000);
      show('play', $('pauseBtn'));
      Anxin.announce(live, roundLabel(S.round) + '開始');
      resume();
    }

    function endRound() {
      halt();
      if (S.invasion) endInvasion(true); /* 先收掉入侵（還在場的病毒不算數），再收其他角色 */
      S.holes.forEach(function (h) { lower(h, false); });
      clearEvents();
      progress.bestScore = Math.max(progress.bestScore, S.runScore);
      progress.bestRound = Math.max(progress.bestRound, S.round);
      /* 回合獎牌：抓到 ÷ 出現；獎勵分數也算進總分（可能因此解鎖新獎勵） */
      S.medal = E.medalFor(S.caught, S.appeared);
      S.medalBonus = S.medal ? S.medal.bonus : 0;
      if (S.medalBonus) {
        S.runScore += S.medalBonus;
        S.roundScore += S.medalBonus;
        progress.totalPoints += S.medalBonus;
      }
      if (S.medal && S.medal.id === 'gold') award('gold');
      if (S.round === C.ROUNDS) award('round6');
      progress.bestStreak = Math.max(progress.bestStreak || 0, S.roundBestStreak);
      progress.bestScore = Math.max(progress.bestScore, S.runScore);

      S.unlocked = E.newlyUnlocked(S.roundStartTotal, progress.totalPoints);
      progress.roundsPlayed += 1;
      save();
      Anxin.announce(live, roundLabel(S.round) + '結束，這回合得到 ' + S.roundScore + ' 分');
      showSummary();
    }

    /* ─────────────────────────────────────────────────────────────
       暫停
       ───────────────────────────────────────────────────────────── */

    var virusDlgEl = $('virusDlg');
    var virusDlg = Anxin.wireDialog(virusDlgEl);

    $('virGo').addEventListener('click', function () { virusDlgEl.close(); });

    /* 不論按按鈕或 Esc 關掉，都開始入侵的 7 秒 */
    virusDlgEl.addEventListener('close', function () {
      if (S.view === 'play' && !S.running && S.invasion) {
        callout('病毒入侵！');
        resume();
      }
      notify();
    });

    var pauseDlgEl = $('pauseDlg');
    var pauseDlg = Anxin.wireDialog(pauseDlgEl);

    function pause() {
      if (S.view !== 'play' || !S.running) return;
      halt();
      save();
      if (!pauseDlgEl.open) pauseDlg.open();
    }

    $('pauseBtn').addEventListener('click', pause);

    pauseDlgEl.addEventListener('close', function () {
      if (S.leaving) { S.leaving = false; return; }
      if (S.view === 'play') resume();
    });

    $('restartBtn').addEventListener('click', function () {
      S.leaving = true;
      pauseDlgEl.close();
      goIntro();
    });

    /* 家長接電話、切到別的 App：自動暫停 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
    });
    window.addEventListener('pagehide', save);

    /* ─────────────────────────────────────────────────────────────
       收藏
       ───────────────────────────────────────────────────────────── */

    var STAR = '<svg class="star" aria-hidden="true"><use href="#icon-star"></use></svg>';

    function renderCollection(ul) {
      ul.innerHTML = E.CHARACTERS.map(function (c) {
        var clicks = progress.clicks[c.id] || 0;
        var lv = progress.level[c.id] || 0;
        var ready = E.tierOf(clicks) > lv;
        var next = lv < C.MAX_LEVEL ? C.TIERS[lv] : null;
        var prev = lv > 0 ? C.TIERS[lv - 1] : 0;
        var pct = next ? Math.max(0, Math.min(100, Math.round(100 * (clicks - prev) / (next - prev)))) : 100;
        var stars = '';
        for (var i = 0; i < C.MAX_LEVEL; i++) stars += '<span class="star-slot' + (i < lv ? ' is-on' : '') + '">' + STAR + '</span>';
        var locked = ready && E.isLocked(progress, c.id);
        var canGo = ready && !locked && !!bank;
        var status = !next ? '已經滿級！'
          : (locked ? '下一回合結束後可以再挑戰'
            : (ready ? '題目載入中…'
              : (clicks === 0 && (c.from || 1) > 1 ? '第 ' + c.from + ' 回合登場'
                : '再收集 ' + (next - clicks) + ' 個就能挑戰')));
        var inner =
          '<svg class="coll-art" aria-hidden="true"><use href="#ch-' + c.id + '"></use></svg>' +
          '<span class="coll-name">' + esc(c.name) + '</span>' +
          '<span class="coll-stars" role="img" aria-label="等級 ' + lv + ' / ' + C.MAX_LEVEL + '">' + stars + '</span>' +
          '<span class="coll-count">收集 ' + clicks + ' 個</span>' +
          '<span class="coll-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span>';
        /* 可以挑戰：整張卡片就是按鈕（淡黃底＋深色外框），點一下直接開始；不另外放按鈕 */
        if (canGo) {
          return '<li class="coll-cell"><button type="button" class="coll-item is-ready" data-char="' + c.id + '"' +
            ' aria-label="' + esc(c.name) + '：挑戰小知識，答對就升級">' + inner + '</button></li>';
        }
        return '<li class="coll-cell"><div class="coll-item">' + inner +
          '<span class="coll-status">' + status + '</span></div></li>';
      }).join('');
    }

    /* ─────────────────────────────────────────────────────────────
       貼紙簿
       ───────────────────────────────────────────────────────────── */

    function stickerHtml(st, earned) {
      return '<li class="sticker' + (earned ? ' is-earned' : '') + '">' +
        '<span class="sticker-art sticker-' + st.id + '" aria-hidden="true"><svg><use href="#' + st.art + '"></use></svg>' +
        (st.id === 'streak10' ? '<b>10</b>' : '') + '</span>' +
        '<span class="sticker-name">' + esc(st.name) + '</span>' +
        '<span class="sticker-hint">' + (earned ? '已獲得' : esc(st.hint)) + '</span></li>';
    }

    function renderStickerBook() {
      var got = progress.stickers || {};
      var n = E.STICKERS.filter(function (st) { return got[st.id]; }).length;
      $('stickerCount').textContent = n + ' / ' + E.STICKERS.length;
      $('stickerBook').innerHTML = E.STICKERS.map(function (st) { return stickerHtml(st, !!got[st.id]); }).join('');
    }

    function renderNewStickers() {
      var list = S.newStickers.map(function (id) {
        return E.STICKERS.filter(function (st) { return st.id === id; })[0];
      }).filter(Boolean);
      $('newStickerList').innerHTML = list.map(function (st) { return stickerHtml(st, true); }).join('');
      $('newStickers').hidden = !list.length;
    }

    /* ─────────────────────────────────────────────────────────────
       小知識區域
       答錯不公布答案：規格是下一回合結束再挑戰「同一題」
       ───────────────────────────────────────────────────────────── */

    var COAT_NOTE = [
      '',
      '之後會出現銀色的它：分數更高，但跑得更快！',
      '金色大魔王會出現了：要連續敲很多下才打得倒，打倒有 5 倍分數！',
      '鐵甲版本登場：停得比較久，但要敲好幾下才打得倒！'
    ];

    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    function openChallenge(charId, from) {
      if (!bank || !E.canChallenge(progress, charId)) return;
      var quiz = E.challengeFor(progress, bank, band, charId);
      if (quiz) showQuiz(quiz, from);
    }

    function leaveQuiz() {
      var from = S.quiz ? S.quiz.from : 'summary';
      S.quiz = null;
      if (from === 'intro') goIntro();
      else showSummary();
    }

    /* 兩個收藏清單共用：點可以挑戰的卡片 */
    ['collection', 'summaryCollection'].forEach(function (id) {
      $(id).addEventListener('click', function (ev) {
        var b = ev.target.closest('.coll-item.is-ready');
        if (b) openChallenge(b.dataset.char, id === 'collection' ? 'intro' : 'summary');
      });
    });

    function showQuiz(quiz, from) {
      var q = quiz.question;
      S.quiz = { character: quiz.character, question: q, done: false, from: from };
      setArt($('quizArt'), quiz.character);
      $('quizCharName').textContent = E.BY_ID[quiz.character].name;
      $('quizParent').hidden = band !== 'little';
      $('quizPrompt').textContent = q.prompt;
      $('quizHint').textContent = q.hint;
      $('quizHint').hidden = true;
      $('hintBtn').hidden = false;
      $('quizResult').hidden = true;
      $('quizNext').hidden = true;
      $('quizSkip').hidden = false;

      var opts = q.type === 'tf'
        ? [{ v: 'true', label: '對' }, { v: 'false', label: '不對' }]
        : shuffle(q.options.map(function (label, idx) { return { v: String(idx), label: label }; }));
      $('quizOptions').innerHTML = opts.map(function (o) {
        return '<button type="button" class="quiz-opt' + (q.type === 'tf' ? ' is-tf' : '') +
          '" data-v="' + o.v + '">' + esc(o.label) + '</button>';
      }).join('');
      $('quizOptions').classList.toggle('is-tf', q.type === 'tf');

      show('quiz', $('quizTitle'));
    }

    $('quizOptions').addEventListener('click', function (ev) {
      var b = ev.target.closest('.quiz-opt');
      if (!b || !S.quiz || S.quiz.done) return;
      var q = S.quiz.question;
      var charId = S.quiz.character;
      var choice = q.type === 'tf' ? b.dataset.v === 'true' : Number(b.dataset.v);
      var ok = E.isCorrect(q, choice);
      S.quiz.done = true;

      Array.prototype.forEach.call($('quizOptions').querySelectorAll('.quiz-opt'), function (x) { x.disabled = true; });
      b.classList.add(ok ? 'is-right' : 'is-wrong');

      var r = $('quizResult');
      var name = esc(E.BY_ID[charId].name);
      E.recordAnswer(progress, charId, q.id, ok);
      if (ok) award('quiz');
      if (ok) {
        var lv = progress.level[charId];
        r.className = 'quiz-result is-right';
        r.innerHTML = '<strong>答對了！</strong><span>' + esc(q.explain) + '</span>' +
          '<span class="quiz-levelup">' + name + ' 升級到 Lv ' + lv + '！' + COAT_NOTE[lv] + '</span>';
      } else {
        r.className = 'quiz-result is-wrong';
        r.innerHTML = '<strong>差一點點！</strong>' +
          '<span>可以問問爸爸媽媽。玩完下一回合，就能再挑戰這一題。</span>';
      }
      save();
      r.hidden = false;
      $('quizSkip').hidden = true;
      $('quizNext').hidden = false;
      $('quizNext').focus();
      Anxin.announce(live, ok ? '答對了' : '差一點點，玩完下一回合再挑戰');
    });

    $('hintBtn').addEventListener('click', function () {
      $('quizHint').hidden = false;
      $('hintBtn').hidden = true;
    });

    $('quizNext').addEventListener('click', leaveQuiz);
    $('quizSkip').addEventListener('click', leaveQuiz); /* 還沒作答就離開：不算答錯 */

    /* ─────────────────────────────────────────────────────────────
       回合結算
       ───────────────────────────────────────────────────────────── */

    function renderChallengeHint(el) {
      var n = bank ? E.CHARACTERS.filter(function (c) { return E.canChallenge(progress, c.id); }).length : 0;
      el.textContent = n ? '有 ' + n + ' 位角色可以挑戰小知識：點一下黃色的卡片！' : '';
      el.hidden = !n;
    }

    function unlockText(u) {
      if (u.track === 'holes') return '第 ' + u.value + ' 個洞修好了，可以打的洞變多了！';
      if (u.track === 'stay') return '大家會在洞外停留更久（×' + u.value + '）';
      return '槌子變強了：鐵甲和大魔王一次扣 ' + u.value + ' 格';
    }

    function showSummary() {
      var r = S.round;
      $('summaryTitle').textContent = r < C.ROUNDS ? '第 ' + r + ' 回合完成！'
        : (r === C.ROUNDS ? '六個回合都完成了！' : '無限模式・第 ' + r + ' 回合完成！');
      $('roundScore').textContent = fmt(S.roundScore);
      $('runScore').textContent = fmt(S.runScore);

      var mc = $('medalCard');
      if (S.medal) {
        mc.className = 'medal medal-' + S.medal.id;
        $('medalName').textContent = S.medal.name;
        $('medalRate').textContent = '抓到 ' + S.caught + ' / ' + S.appeared + ' 個';
        $('medalBonus').textContent = '+' + fmt(S.medalBonus) + ' 分';
        mc.hidden = false;
      } else {
        mc.hidden = true;
      }
      var sl = $('streakLine');
      sl.textContent = '這回合最高連擊 ' + S.roundBestStreak + (S.roundBestStreak >= 5 ? '，好厲害！' : '');
      sl.hidden = S.roundBestStreak < 2;
      renderNewStickers();
      $('infinityNote').hidden = r !== C.ROUNDS;

      var ul = $('unlockList');
      ul.innerHTML = S.unlocked.map(function (u) {
        return '<li><strong>解鎖：' + esc(u.label) + '</strong><span>' + esc(unlockText(u)) + '</span></li>';
      }).join('');
      ul.hidden = !S.unlocked.length;

      renderCollection($('summaryCollection'));
      renderChallengeHint($('summaryChallenge'));
      var goal = E.nextUnlock(progress.totalPoints);
      $('nextGoal').textContent = goal
        ? '再得 ' + fmt(goal.at - progress.totalPoints) + ' 分，就能解鎖「' + goal.label + '」'
        : '所有獎勵都解鎖了，太厲害了！';

      $('nextRoundBtn').textContent = r < C.ROUNDS ? '開始第 ' + (r + 1) + ' 回合'
        : (r === C.ROUNDS ? '進入無限模式' : '繼續下一回合');
      show('summary', $('summaryTitle'));
    }

    $('nextRoundBtn').addEventListener('click', function () {
      S.round++;
      startRound();
    });

    $('endBtn').addEventListener('click', goIntro);

    /* ─────────────────────────────────────────────────────────────
       開始畫面
       ───────────────────────────────────────────────────────────── */

    function goIntro() {
      halt();
      S.holes.forEach(function (h) { lower(h, false); });
      clearEvents();
      S.invasion = null;
      S.invasionAt = null;
      save();
      renderCollection($('collection'));
      renderChallengeHint($('introChallenge'));
      renderStickerBook();
      var best = $('bestLine');
      if (progress.bestScore > 0) {
        best.textContent = '最高分 ' + fmt(progress.bestScore) + ' 分・最遠到' + roundLabel(progress.bestRound).replace(' / ' + C.ROUNDS, '');
        best.hidden = false;
      }
      show('intro', S.view === 'intro' ? null : $('introTitle'));
    }

    $('startBtn').addEventListener('click', startRun);

    /* ─────────────────────────────────────────────────────────────
       雙機：家長的遙控器（放角色、事件、模式）
       單機不會用到；泡泡、地震、雙倍只有家長按了才會出現
       ───────────────────────────────────────────────────────────── */

    var hudDouble = $('hudDouble');

    function quakeOn() { return S.clock < S.quakeUntil; }
    function doubleOn() { return S.clock < S.doubleUntil; }
    function bubbleCount() { return S.holes.filter(function (h) { return h.bubble; }).length; }
    function playing() { return S.view === 'play' && S.running; }
    function msLeft() { return C.ROUND_MS - S.clock; }

    function renderDouble() { hudDouble.hidden = !doubleOn(); }

    function popBubble(h, quiet) {
      h.bubble = false;
      h.el.classList.remove('has-bubble');
      if (!quiet) retrigger(h.el, 'is-popped');
      h.el.setAttribute('aria-label', holeLabel(h));
      if (!bubbleCount()) S.bubbleUntil = 0;
      notify();
    }

    /* 按住消毒時手指碰到泡泡：先戳破 */
    function popUnder(i) {
      var h = i === null || i === undefined ? null : S.holes[i];
      if (h && h.bubble) popBubble(h);
    }

    function clearEvents() {
      S.quakeUntil = 0;
      S.doubleUntil = 0;
      S.bubbleUntil = 0;
      board.classList.remove('is-quake');
      S.holes.forEach(function (h) { if (h.bubble) popBubble(h, true); });
      renderDouble();
    }

    function tickEvents() {
      if (S.quakeUntil && !quakeOn()) {
        S.quakeUntil = 0;
        board.classList.remove('is-quake');
        notify();
      }
      if (S.doubleUntil && !doubleOn()) {
        S.doubleUntil = 0;
        renderDouble();
        notify();
      }
      if (S.bubbleUntil && S.clock >= S.bubbleUntil) {
        S.holes.forEach(function (h) { if (h.bubble) popBubble(h); });
      }
    }

    function no(why) { return { ok: false, why: why }; }
    var OK = { ok: true, why: null };

    function placeAt(i, char, variant) {
      if (!playing()) return no('not-playing');
      if (S.mode !== 'manual') return no('auto');
      var h = S.holes[i];
      if (!h || !h.open) return no('locked');
      if (h.mole || S.clock < h.freeAt) return no('busy');
      if (S.boss) return no('boss');
      if (S.invasion && S.invasion.closing) return no('inv-ending'); /* 最後 2 秒不再有新病毒 */
      var ch = E.BY_ID[char];
      if (!ch) return no('bad');
      if (S.invasion && !ch.wipe) return no('invasion');
      if (!S.invasion && ch.wipe) return no('no-invasion'); /* 入侵以外放病毒會擦不掉 */
      raise(h, char, variant === 'silver' || variant === 'iron' ? variant : 'normal');
      return OK;
    }

    function trigger(name) {
      if (!playing()) return no('not-playing');
      if (name === 'invasion') {
        if (S.invasion) return no('active');
        if (S.boss) return no('boss');
        if (msLeft() < C.INVASION_MS) return no('too-late');
        startInvasion();
        return OK;
      }
      if (name === 'boss') {
        if (S.boss) return no('active');
        if (S.invasion) return no('invasion');
        if (msLeft() < C.BOSS_STAY_MS * S.stay) return no('too-late');
        var pool = E.availableAt(S.round).filter(function (c) { return !c.wipe; });
        var open = S.holes.filter(function (h) { return h.open; });
        clearBoard();
        raise(open[Math.floor(Math.random() * open.length)], pool[Math.floor(Math.random() * pool.length)].id, 'boss');
        return OK;
      }
      if (name === 'quake') {
        if (quakeOn()) return no('active');
        S.quakeUntil = S.clock + C.QUAKE_MS;
        board.classList.add('is-quake');
        callout('地震了！');
        notify();
        return OK;
      }
      if (name === 'bubbles') {
        if (bubbleCount()) return no('active');
        shuffle(S.holes.filter(function (h) { return h.open; })).slice(0, C.BUBBLE_COUNT).forEach(function (h) {
          h.bubble = true;
          h.el.classList.remove('is-popped');
          h.el.classList.add('has-bubble');
          h.el.setAttribute('aria-label', holeLabel(h));
        });
        S.bubbleUntil = S.clock + C.BUBBLE_MS;
        callout('泡泡飄來了！');
        notify();
        return OK;
      }
      if (name === 'double') {
        if (doubleOn()) return no('active');
        S.doubleUntil = S.clock + C.DOUBLE_MS;
        renderDouble();
        callout('雙倍分數！');
        notify();
        return OK;
      }
      return no('bad');
    }

    function setMode(m) {
      m = m === 'auto' ? 'auto' : 'manual';
      if (m === S.mode) return;
      S.mode = m;
      if (m === 'manual') S.invasionAt = null; /* 手動：病毒入侵交給家長 */
      else S.nextSpawnAt = Math.min(S.nextSpawnAt, S.clock + 400);
      if (playing()) callout(m === 'manual' ? '爸爸媽媽來放角色囉！' : '角色自己跑出來囉！');
      notify();
    }

    function hpPercent(m) {
      if (m.wipeNeed) return Math.round(100 * Math.max(0, 1 - m.wiped / m.wipeNeed));
      return Math.round(100 * m.hp / m.maxHp);
    }

    /* 回報給家長的畫面（欄位要和 firestore.rules 的 validState 一致） */
    function snapshot() {
      return {
        v: 1,
        view: S.view,
        running: S.running,
        round: S.round,
        time: S.view === 'play' ? Math.max(0, Math.min(30, Math.ceil(msLeft() / 1000))) : 0,
        score: S.runScore,
        mult: E.streakMult(S.streak),
        holes: S.holes.map(function (h) {
          var m = h.mole;
          return { o: h.open, c: m ? m.char : null, v: m ? m.variant : null, b: !!h.bubble, p: m ? hpPercent(m) : 0 };
        }),
        /* 入侵中至少是 1：倒數到 0 之後還在等孩子消滅最後幾隻；≤ 2 = 最後階段（遙控器據此顯示） */
        inv: S.invasion ? Math.max(1, Math.ceil((S.invasion.until - S.clock) / 1000)) : 0,
        boss: !!S.boss,
        quake: quakeOn(),
        bubbles: bubbleCount(),
        dbl: doubleOn(),
        mode: S.mode,
        teach: virusDlgEl.hasAttribute('open')
      };
    }

    function command(c) {
      if (!c) return no('bad');
      if (c.t === 'place') return placeAt(c.h, c.c, c.v);
      if (c.t === 'event') return trigger(c.e);
      return no('bad');
    }

    goIntro();

    /* 測試用：讓自動化測試能指定某個洞出現某個角色（一般遊玩不會用到） */
    window.__wam = {
      state: S,
      progress: function () { return progress; },
      raise: function (i, char, variant) { raise(S.holes[i], char, variant || 'normal'); },
      setBank: function (b) { bank = b; },
      jumpToRound: function (n) { halt(); S.round = n; startRound(); },
      invade: function () { startInvasion(); }
    };

    /* 雙機結束（家長解除配對、換遊戲）：停在原地，不開暫停對話框；duo-child.js 會帶孩子回選單 */
    function freeze() {
      halt();
    }

    return { snapshot: snapshot, command: command, setMode: setMode, freeze: freeze };
  }

  window.WhackGame = { boot: boot };

  /* 單機：馬上開始。雙機：等 duo-child.js 連上房間再呼叫 boot */
  if (!(window.AnxinDuo && window.AnxinDuo.codeFromLocation(window.location))) {
    var profile = Anxin.profile.load();
    if (profile) boot(profile, null); /* 沒有個人資料：<head> 裡的守衛已經導回 / */
  }
})();
