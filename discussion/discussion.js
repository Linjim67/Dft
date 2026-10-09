/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — 04 討論區（畫面）
   兩個網址、同一張頁面：<html data-discuss="public | clinic">（見 index.html 的 <head>）
     public  /discussion/         任何人：自己填稱呼、身分、孩子的年紀與性別
     clinic  /discussion/parent/  從回饋頁過來的家長：身分固定家長，孩子沿用 #01 的資料
   資料規則（payload、搜尋、推薦排序）在 discuss-core.js，資料進出在 /shared/firebase.js。
   畫面：#（列表）、#t=<id>（單篇）、#new（發文），手機的返回鍵在三者之間來回。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var html = document.documentElement;
  if (!html.hasAttribute('data-discuss')) return; /* <head> 正在改到公開版 */

  var D = window.AnxinDiscuss;
  var CLINIC = html.getAttribute('data-discuss') === 'clinic';
  var SOURCE = CLINIC ? 'clinic' : 'public';
  var profile = Anxin.profile.load();
  /* 暱稱只用來把文字裡的暱稱換成「孩子」；公開版若這支手機也填過資料，一樣替換 */
  var nickname = profile ? profile.nickname : '';
  /* 家長版知道孩子幾歲：推薦排序把年紀相近的經驗往前排 */
  var viewerAge = CLINIC ? profile.age : null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = Anxin.escapeHtml;
  var live = $('liveRegion');

  var LIST_LIMIT = 300;
  var PAGE = 20;
  var SEND_TIMEOUT_MS = 15000;
  var FULL = { from: 0, to: D.AGE_MAX_IDX };

  /* ─────────────────────────────────────────────────────────────
     本機儲存（都只是方便，存不進去頁面照常）
     ───────────────────────────────────────────────────────────── */

  var KEYS = {
    /* 上次的稱呼（公開版還有身分）。兩版分開記：家長版的稱呼不會跑到公開版 */
    me: CLINIC ? 'anxin.discuss.me.clinic.v1' : 'anxin.discuss.me.v1',
    draft: 'anxin.discuss.draft.' + SOURCE + '.v1',  /* 還沒發布的內文、標籤 */
    opened: 'anxin.discuss.opened.v1',               /* 點開過的（點閱每支手機只算一次） */
    mine: 'anxin.discuss.mine.v1',                   /* 自己發的（不算自己的點閱、停留） */
    liked: 'anxin.discuss.liked.v1',                 /* 按過「有幫助」的（列表上的愛心要知道） */
    last: 'anxin.discuss.lastPost.v1'                /* 上次發言的時間（冷卻倒數） */
  };

  function readJson(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 忽略 */ }
  }

  function idList(key) {
    var a = readJson(key, []);
    return Array.isArray(a) ? a : [];
  }

  function hasId(key, id) { return idList(key).indexOf(id) !== -1; }

  function addId(key, id, cap) {
    var a = idList(key).filter(function (x) { return x !== id; });
    a.push(id);
    writeJson(key, a.slice(-cap));
  }

  function removeId(key, id) {
    writeJson(key, idList(key).filter(function (x) { return x !== id; }));
  }

  var me = readJson(KEYS.me, null);

  /* author 存手機上原本打的字（例如「小恩媽媽」），下次預先填好；上傳的才是換過暱稱的版本 */
  function rememberMe(role, author) {
    me = { role: role, author: author };
    writeJson(KEYS.me, me);
    fillIdentity();
  }

  /* ─────────────────────────────────────────────────────────────
     共用片段
     ───────────────────────────────────────────────────────────── */

  var ICON = {
    kid: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><circle cx="12" cy="7.5" r="3.2"/>' +
      '<path d="M5.8 19.5c.5-3.4 3-5.6 6.2-5.6s5.7 2.2 6.2 5.6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">' +
      '<path d="M12 20s-7-4.3-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6C19 15.7 12 20 12 20Z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M4.5 6.5h15v9h-8l-4 3v-3h-3Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>',
    plus: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
    offline: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M3.5 9.5a12 12 0 0 1 17 0"/>' +
      '<path d="M6.8 12.9a7.4 7.4 0 0 1 10.4 0M10 16.3a2.8 2.8 0 0 1 4 0"/><path d="M4 4l16 16"/></svg>',
    search: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/>' +
      '<path d="m16 16 4 4"/></svg>'
  };

  function rolePill(role) {
    return '<span class="role-pill">' + esc(role) + '</span>';
  }

  function metaHtml(item, now) {
    var when = item.createdAt || now;
    return '<p class="post-meta">' + rolePill(item.role) +
      '<span class="post-author">' + esc(item.author || '匿名') + '</span>' +
      '<span aria-hidden="true">·</span>' +
      '<time datetime="' + new Date(when).toISOString() + '">' + D.timeAgo(item.createdAt, now) + '</time>' +
      (item.source === 'clinic' ? '<span class="source-tag">打完針後分享</span>' : '') +
      '</p>';
  }

  function membersHtml(t) {
    if (!t.members.length) return '';
    return '<p class="post-members">' + ICON.kid + '<span>' + esc(D.membersLabel(t.members)) + '</span></p>';
  }

  function loadingHtml(text) {
    return '<div class="loading" role="status"><span class="vh">' + text + '</span>' +
      '<div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div></div>';
  }

  function stateHtml(icon, title, body, button) {
    return '<div class="empty-state">' + icon + '<strong>' + title + '</strong><span>' + body + '</span>' +
      (button || '') + '</div>';
  }

  function offlineHtml() {
    return stateHtml(ICON.offline, '目前連不上伺服器', '請確認網路後再試一次。',
      '<button class="btn btn-quiet" type="button" data-retry>再試一次</button>');
  }

  function counter(textarea, out, max) {
    function update() { out.textContent = '還可以輸入 ' + (max - textarea.value.length) + ' 字'; }
    textarea.addEventListener('input', update);
    return update;
  }

  /* 送出失敗的說法：伺服器拒絕（多半是 15 秒冷卻）、網站設定、網路 */
  function sendErrorText(err) {
    if (err && err.code === 'permission-denied') {
      return '伺服器沒有接受這次發言。兩次發言要間隔 15 秒，請稍候再送一次；一直失敗的話，可能是網站設定的問題。';
    }
    if (Anxin.isSetupError(err)) {
      return '討論區還沒準備好（是網站設定的問題，不是您的網路）。您寫的內容都還在。';
    }
    return '目前連不上伺服器，您寫的內容都還在。請確認網路後再送一次。';
  }

  /* ─────────────────────────────────────────────────────────────
     資料：最新 300 篇一次載入，搜尋、排序都在手機上做
     ───────────────────────────────────────────────────────────── */

  var state = {
    threads: [],
    loaded: false,
    loading: false,
    failed: false,
    sort: 'recommend',
    shown: PAGE,
    filters: { query: '', roles: [], from: FULL.from, to: FULL.to, gender: '' }
  };

  function findIndex(id) {
    for (var i = 0; i < state.threads.length; i++) if (state.threads[i].id === id) return i;
    return -1;
  }

  function upsert(t) {
    var i = findIndex(t.id);
    if (i === -1) state.threads.unshift(t);
    else state.threads[i] = t;
  }

  function loadThreads() {
    if (state.loading) return;
    state.loading = true;
    state.failed = false;
    renderList();
    Anxin.withTimeout(
      Anxin.whenFirebase(10000).then(function (fb) { return fb.discuss.list(LIST_LIMIT); }),
      SEND_TIMEOUT_MS
    ).then(function (docs) {
      /* 載入途中自己剛發的那篇（還不在結果裡）要留著 */
      var fresh = docs.map(D.normalizeThread);
      var ids = fresh.map(function (t) { return t.id; });
      state.threads.forEach(function (t) { if (ids.indexOf(t.id) === -1) fresh.unshift(t); });
      state.threads = fresh;
      state.loaded = true;
      state.loading = false;
      renderList();
    }, function (err) {
      window.console.error('討論區載入失敗：', err);
      state.loading = false;
      state.failed = true;
      renderList();
    });
  }

  /* ─────────────────────────────────────────────────────────────
     畫面切換：# 列表、#t=<id> 單篇、#new 發文
     ───────────────────────────────────────────────────────────── */

  var views = { list: $('listView'), thread: $('threadView'), compose: $('composeView') };
  var current = null;
  var listScroll = 0;
  /* 這次瀏覽看過列表：「所有討論」用 history.back()，列表的捲動位置才會留著 */
  var seenList = false;

  try { history.scrollRestoration = 'manual'; } catch (e) { /* 忽略 */ }

  function parseRoute() {
    var h = location.hash.replace(/^#/, '');
    if (h === 'new') return { view: 'compose' };
    var m = /^t=([A-Za-z0-9_-]{1,64})$/.exec(h);
    if (m) return { view: 'thread', id: m[1] };
    return { view: 'list' };
  }

  function route(first) {
    var next = parseRoute();
    var prev = current;
    if (prev && prev.view === next.view && prev.id === next.id) return;
    if (prev && prev.view === 'list') listScroll = window.scrollY;
    if (prev && prev.view === 'thread') leaveThread();
    current = next;
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== next.view; });
    updateTopbar(next.view);
    if (next.view === 'list') showList(prev, first);
    else if (next.view === 'thread') showThread(next.id, first);
    else showCompose(first);
  }

  window.addEventListener('hashchange', function () { route(false); });

  function updateTopbar(view) {
    var onList = view === 'list';
    $('backLink').hidden = onList && !CLINIC;
    $('backLink').setAttribute('href', onList ? '/home/' : '#');
    $('backLabel').textContent = onList ? '回主頁' : '所有討論';
    $('brand').hidden = !(onList && !CLINIC);
  }

  function toList() {
    if (seenList) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', location.pathname + location.search);
    route(false);
  }

  $('backLink').addEventListener('click', function (ev) {
    if (current && current.view === 'list') return; /* 回主頁：一般連結 */
    ev.preventDefault();
    toList();
  });

  /* ─────────────────────────────────────────────────────────────
     列表：搜尋、篩選、排序
     ───────────────────────────────────────────────────────────── */

  var threadList = $('threadList');
  var q = $('q');
  var ageFrom = $('ageFrom');
  var ageTo = $('ageTo');
  var near = CLINIC ? nearRange(profile.age) : null;

  /* 家長版的「和孩子差不多大」：前後 2 歲 */
  function nearRange(age) {
    var lo = D.ageToIndex(Math.max(0, age - 2));
    var hi = D.ageToIndex(Math.min(18, age + 2));
    if (!D.isSelectable(lo)) lo -= 1;
    if (!D.isSelectable(hi)) hi += 1;
    return { from: lo, to: Math.min(D.AGE_MAX_IDX, hi) };
  }

  function ageFiltered() {
    return state.filters.from !== FULL.from || state.filters.to !== FULL.to;
  }

  function filterCount() {
    var f = state.filters;
    return (f.roles.length ? 1 : 0) + (ageFiltered() ? 1 : 0) + (f.gender ? 1 : 0);
  }

  function matchFilters() {
    var f = state.filters;
    var aged = ageFiltered();
    return {
      query: f.query,
      roles: f.roles,
      ageMin: aged ? D.indexToAge(f.from) : null,
      ageMax: aged ? D.indexToAge(f.to) : null,
      gender: f.gender || null
    };
  }

  function cardHtml(t, now) {
    /* 摘要保留換行，但連續空行併成一行，四行的摘要才裝得下內容 */
    var excerpt = t.content.replace(/\n\s*\n+/g, '\n');
    return '<li><article class="thread-card">' +
      metaHtml(t, now) + membersHtml(t) +
      '<a class="thread-link" href="#t=' + esc(t.id) + '"><span class="thread-excerpt">' + esc(excerpt) + '</span></a>' +
      (t.hashtags.length ? '<p class="card-tags">' + t.hashtags.map(function (h) {
        return '<span>#' + esc(h) + '</span>';
      }).join('') + '</p>' : '') +
      '<p class="card-stats">' +
      likeButtonHtml(t) +
      '<span class="stat">' + ICON.chat + t.replyCount + '<span class="vh"> </span></span>' +
      '</p></article></li>';
  }

  function renderList() {
    var status = $('listStatus');
    var count = $('listCount');
    if (!state.loaded) {
      threadList.innerHTML = '';
      $('moreBtn').hidden = true;
      count.textContent = '';
      status.innerHTML = state.failed ? offlineHtml() : loadingHtml('正在載入討論…');
      return;
    }
    var f = matchFilters();
    var hits = D.sortThreads(state.threads.filter(function (t) { return D.matches(t, f); }),
      state.sort, Date.now(), viewerAge);
    var narrowed = !!state.filters.query.trim() || filterCount() > 0;
    count.textContent = (narrowed ? '找到 ' : '共 ') + hits.length + ' 則';

    if (!state.threads.length) {
      status.innerHTML = stateHtml(ICON.chat, '還沒有人分享', '成為第一個分享方法的人吧。');
    } else if (!hits.length) {
      status.innerHTML = stateHtml(ICON.search, '沒有符合的討論', '換個關鍵字，或放寬篩選條件。',
        '<button class="btn btn-quiet" type="button" data-clear>清除搜尋與篩選</button>');
    } else {
      status.innerHTML = '';
    }

    var now = Date.now();
    threadList.innerHTML = hits.slice(0, state.shown).map(function (t) { return cardHtml(t, now); }).join('');
    $('moreBtn').hidden = hits.length <= state.shown;
  }

  function renderFilters() {
    var f = state.filters;
    Array.prototype.forEach.call($('roleFilter').children, function (b) {
      b.setAttribute('aria-pressed', String(f.roles.indexOf(b.getAttribute('data-role')) !== -1));
    });
    ageFrom.value = f.from;
    ageTo.value = f.to;
    paintDual($('ageDual'), f.from, f.to);
    var lo = D.indexToAge(f.from);
    var hi = D.indexToAge(f.to);
    $('ageFilterOut').textContent = ageFiltered() ? D.ageRangeLabel(lo, hi) : '不限';
    ageFrom.setAttribute('aria-valuetext', Anxin.ageLabel(lo));
    ageTo.setAttribute('aria-valuetext', Anxin.ageLabel(hi));
    var g = document.querySelector('input[name="genderFilter"][value="' + f.gender + '"]');
    if (g) g.checked = true;
    var n = filterCount();
    $('filterCount').hidden = !n;
    $('filterCount').innerHTML = n + '<span class="vh"> 個條件</span>';
    if (near) {
      $('nearAgeBtn').setAttribute('aria-pressed', String(f.from === near.from && f.to === near.to));
    }
  }

  function filtersChanged(quiet) {
    state.shown = PAGE;
    renderFilters();
    renderList();
    if (!quiet) Anxin.announce(live, $('listCount').textContent);
  }

  function clearFilters(alsoQuery) {
    var f = state.filters;
    f.roles = [];
    f.from = FULL.from;
    f.to = FULL.to;
    f.gender = '';
    if (alsoQuery) {
      f.query = '';
      q.value = '';
    }
    filtersChanged();
  }

  /* 搜尋：打字停下來 0.18 秒才比對 */
  var searchTimer = 0;
  q.addEventListener('input', function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.filters.query = q.value;
      filtersChanged();
    }, 180);
  });
  /* 手機鍵盤的「搜尋」鍵：收起鍵盤 */
  q.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      q.blur();
    }
  });

  $('filterBtn').addEventListener('click', function () {
    var open = $('filterPanel').hidden;
    $('filterPanel').hidden = !open;
    this.setAttribute('aria-expanded', String(open));
  });

  $('roleFilter').innerHTML = D.ROLES.map(function (r) {
    return '<button class="chip" type="button" aria-pressed="false" data-role="' + r + '">' + r + '</button>';
  }).join('');

  $('roleFilter').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-role]');
    if (!b) return;
    var roles = state.filters.roles;
    var i = roles.indexOf(b.getAttribute('data-role'));
    if (i === -1) roles.push(b.getAttribute('data-role'));
    else roles.splice(i, 1);
    filtersChanged();
  });

  function onAgeFilter(ev) {
    var f = state.filters;
    var isFrom = ev.target === ageFrom;
    var v = D.snapIndex(Number(ev.target.value), isFrom ? f.from : f.to);
    /* 兩端不能交錯：起點最多拖到終點 */
    if (isFrom) f.from = Math.min(v, f.to);
    else f.to = Math.max(v, f.from);
    /* 拖曳中只更新畫面，放開才唸出結果 */
    filtersChanged(ev.type === 'input');
  }

  [ageFrom, ageTo].forEach(function (el) {
    el.addEventListener('input', onAgeFilter);
    el.addEventListener('change', onAgeFilter);
  });

  $('genderFilter').addEventListener('change', function (ev) {
    state.filters.gender = ev.target.value;
    filtersChanged();
  });

  $('clearFilters').addEventListener('click', function () { clearFilters(false); });

  if (near) {
    $('nearAgeBtn').textContent = '和' + nickname + '差不多大';
    $('nearAgeBtn').addEventListener('click', function () {
      var f = state.filters;
      var on = !(f.from === near.from && f.to === near.to);
      f.from = on ? near.from : FULL.from;
      f.to = on ? near.to : FULL.to;
      filtersChanged();
    });
  }

  document.querySelectorAll('input[name="sort"]').forEach(function (r) {
    r.addEventListener('change', function () {
      state.sort = r.value;
      state.shown = PAGE;
      renderList();
    });
  });

  $('moreBtn').addEventListener('click', function () {
    state.shown += PAGE;
    renderList();
  });

  $('listStatus').addEventListener('click', function (ev) {
    if (ev.target.closest('[data-retry]')) loadThreads();
    if (ev.target.closest('[data-clear]')) clearFilters(true);
  });

  function showList(prev, first) {
    seenList = true;
    document.title = '安心陪伴 · 討論區';
    if (!state.loaded) loadThreads();
    renderList();
    if (first) return;
    window.scrollTo(0, listScroll);
    /* 從單篇回來：焦點回到剛剛看的那一篇 */
    var back = prev && prev.view === 'thread' && threadList.querySelector('a[href="#t=' + prev.id + '"]');
    (back || $('listTitle')).focus({ preventScroll: true });
  }

  /* 單篇裡點標籤：回列表、搜尋這個標籤 */
  function searchTag(tag) {
    state.filters.query = '#' + tag;
    q.value = '#' + tag;
    state.shown = PAGE;
    renderFilters();
    listScroll = 0;
    window.history.pushState(null, '', location.pathname + location.search);
    route(false);
    $('listTitle').focus({ preventScroll: true });
    Anxin.announce(live, '搜尋 #' + tag + '：' + $('listCount').textContent);
  }

  /* ─────────────────────────────────────────────────────────────
     單篇：內容、有幫助、回覆（即時更新）
     點閱：每支手機每篇只送一次；停留：看得到畫面時才計時，每次最多 5 分鐘。
     自己發的文章都不算。
     ───────────────────────────────────────────────────────────── */

  var thread = {
    id: null, data: null, missing: false, failed: false, mine: false, counted: null, stops: []
  };
  var dwell = null;

  function canVote() {
    return !!thread.data;
  }

  function showThread(id, first) {
    var t = null;
    var i = findIndex(id);
    if (i !== -1) t = state.threads[i];
    thread.id = id;
    thread.data = t;
    thread.missing = false;
    thread.failed = false;
    thread.mine = hasId(KEYS.mine, id);
    $('post').removeAttribute('data-id');
    if (reply.threadId !== id) resetReply(id);

    document.title = '安心陪伴 · 討論內容';
    window.scrollTo(0, 0);
    renderPost();
    renderReplies(null);
    if (!first) $('threadTitle').focus({ preventScroll: true });

    Anxin.whenFirebase(10000).then(function (fb) {
      if (thread.id !== id) return;
      thread.stops.push(fb.discuss.watchThread(id, function (d) {
        if (thread.id !== id) return;
        if (!d) {
          thread.data = null;
          thread.missing = true;
          renderPost();
          return;
        }
        var nt = D.normalizeThread(d);
        upsert(nt);
        thread.data = nt;
        renderPost();
        countOpen(nt);
        startDwell(nt);
      }, function (err) {
        window.console.error('讀取討論失敗：', err);
        if (thread.id !== id || thread.data) return;
        thread.failed = true;
        renderPost();
      }));
      thread.stops.push(fb.discuss.watchReplies(id, function (rs) {
        if (thread.id === id) renderReplies(rs);
      }, function (err) {
        window.console.error('讀取回覆失敗：', err);
      }));
      /* 手機記的「按過哪幾篇」跟伺服器對一次 */
      fb.discuss.myVote(id).then(function (v) {
        if (liking[id]) return;
        setLiked(id, v);
        refreshLike(id);
      }, function () { /* 匿名登入不可用：維持手機記的 */ });
    }, function () {
      if (thread.id !== id || thread.data) return;
      thread.failed = true;
      renderPost();
    });
  }

  function leaveThread() {
    flushDwell();
    thread.stops.forEach(function (stop) { stop(); });
    thread.stops = [];
    thread.id = null;
  }

  function renderPost() {
    var post = $('post');
    var t = thread.data;
    if (!t) {
      post.hidden = true;
      $('replies').hidden = true;
      $('threadStatus').innerHTML = thread.missing
        ? stateHtml(ICON.chat, '找不到這篇討論', '連結可能有誤。',
          '<a class="btn btn-quiet" href="#" data-tolist>回到所有討論</a>')
        : thread.failed ? offlineHtml() : loadingHtml('正在載入討論…');
      return;
    }
    $('threadStatus').innerHTML = '';
    post.hidden = false;
    $('replies').hidden = false;
    /* 內容不會變，只畫一次；之後的快照只更新計數（按鈕的焦點才不會被洗掉） */
    if (post.getAttribute('data-id') !== t.id) {
      post.setAttribute('data-id', t.id);
      post.innerHTML = metaHtml(t, Date.now()) + membersHtml(t) +
        '<div class="post-body">' + esc(t.content) + '</div>' +
        /* 標籤和列表卡片一樣是純文字；點一下仍會搜尋這個標籤 */
        (t.hashtags.length ? '<ul class="card-tags post-tags" aria-label="標籤（點一下搜尋）">' +
          t.hashtags.map(function (h) {
            return '<li><button class="tag-link" type="button" data-tag="' + esc(h) + '">#' + esc(h) + '</button></li>';
          }).join('') + '</ul>' : '') +
        '<div class="post-actions" id="postActions"></div>';
    }
    renderActions();
  }

  function renderActions() {
    var bar = $('postActions');
    var t = thread.data;
    if (!bar || !t) return;
    if (!bar.firstChild) {
      bar.innerHTML = '<button class="helpful-btn" type="button" id="voteBtn" aria-pressed="false">' + ICON.heart +
        '<span>有幫助</span><span class="helpful-count" id="voteCount"></span></button>' +
        '<p class="stat stat-lg">' + ICON.chat + '<span id="replyStat"></span></p>';
    }
    $('voteCount').textContent = t.helpful;
    $('voteBtn').setAttribute('aria-pressed', String(isLiked(t.id)));
    $('replyStat').textContent = t.replyCount;
  }

  /* ─────────────────────────────────────────────────────────────
     有幫助（按讚）：列表卡片上的愛心、單篇裡的按鈕都走這裡，按一下就按讚、再按收回。
     一支手機一票（votes/{uid}），自己的文章也能按。
     按過哪幾篇記在手機上（anxin.discuss.liked.v1），點開單篇時再跟伺服器對一次。
     ───────────────────────────────────────────────────────────── */

  var liking = {}; /* 送出中的 id：連按不會送兩次 */

  function isLiked(id) { return hasId(KEYS.liked, id); }

  function setLiked(id, on) {
    if (on) addId(KEYS.liked, id, 1000);
    else removeId(KEYS.liked, id);
  }

  /* 每一篇都能按（早期原型的舊文章沒有 helpful 欄位，規則當 0 算） */
  function likeButtonHtml(t) {
    return '<button class="like-btn" type="button" data-like="' + esc(t.id) + '" aria-pressed="' +
      isLiked(t.id) + '" aria-label="有幫助（' + t.helpful + '）">' + ICON.heart +
      '<span class="like-count">' + t.helpful + '</span></button>';
  }

  /* 同一篇的愛心（列表）和按鈕（單篇）一起更新 */
  function refreshLike(id) {
    var i = findIndex(id);
    var n = i === -1 ? 0 : state.threads[i].helpful;
    var b = threadList.querySelector('[data-like="' + id + '"]');
    if (b) {
      b.setAttribute('aria-pressed', String(isLiked(id)));
      b.setAttribute('aria-label', '有幫助（' + n + '）');
      b.querySelector('.like-count').textContent = n;
    }
    if (thread.id === id) renderActions();
  }

  function bump(id, delta) {
    var i = findIndex(id);
    if (i !== -1) state.threads[i].helpful = Math.max(0, state.threads[i].helpful + delta);
  }

  function popHeart(id) {
    [threadList.querySelector('[data-like="' + id + '"]'), thread.id === id ? $('voteBtn') : null]
      .forEach(function (b) {
        if (!b) return;
        b.classList.remove('pop');
        void b.offsetWidth; /* 重新觸發動畫 */
        b.classList.add('pop');
      });
  }

  /* 正在看的那一篇有即時快照：計數交給 Firestore（本機寫入立刻反映、失敗自動退回）。
     列表上的其他篇沒有快照：自己先加減，失敗再退回。 */
  function toggleLike(id) {
    if (liking[id]) return;
    var on = !isLiked(id);
    var watched = thread.id === id && thread.stops.length > 0;
    liking[id] = true;
    setLiked(id, on);
    if (!watched) bump(id, on ? 1 : -1);
    refreshLike(id);
    if (on) popHeart(id);
    Anxin.whenFirebase(10000).then(function (fb) {
      return fb.discuss.vote(id, on);
    }).then(function () {
      delete liking[id];
      Anxin.announce(live, on ? '已按讚：有幫助' : '已收回');
    }, function (err) {
      window.console.error('有幫助送出失敗：', err);
      delete liking[id];
      setLiked(id, !on);
      if (!watched) bump(id, on ? -1 : 1);
      refreshLike(id);
      Anxin.announce(live, '沒有送出，請確認網路後再試一次。');
      /* 伺服器的票和手機記的不一樣（例如清過瀏覽器資料）：以伺服器為準 */
      if (err && err.code === 'permission-denied') {
        Anxin.whenFirebase(10000).then(function (fb) { return fb.discuss.myVote(id); }).then(function (v) {
          if (liking[id]) return;
          setLiked(id, v);
          refreshLike(id);
        }, function () { /* 讀不到：維持原樣 */ });
      }
    });
  }

  threadList.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-like]');
    if (!b) return;
    ev.preventDefault();
    toggleLike(b.getAttribute('data-like'));
  });

  $('post').addEventListener('click', function (ev) {
    var tag = ev.target.closest('[data-tag]');
    if (tag) {
      searchTag(tag.getAttribute('data-tag'));
      return;
    }
    if (ev.target.closest('#voteBtn') && canVote()) toggleLike(thread.id);
  });

  $('threadStatus').addEventListener('click', function (ev) {
    if (ev.target.closest('[data-retry]')) {
      var id = thread.id;
      leaveThread();
      showThread(id, false);
    }
    if (ev.target.closest('[data-tolist]')) {
      ev.preventDefault();
      toList();
    }
  });

  function countOpen(t) {
    if (thread.mine || thread.counted === t.id) return;
    thread.counted = t.id;
    if (hasId(KEYS.opened, t.id)) return;
    Anxin.whenFirebase(10000).then(function (fb) {
      return fb.discuss.open(t.id);
    }).then(function () {
      addId(KEYS.opened, t.id, 500);
    }, function () { /* 下次點開再算 */ });
  }

  function startDwell(t) {
    if (dwell || thread.mine) return;
    dwell = { id: t.id, ms: 0, since: document.hidden ? 0 : Date.now() };
  }

  function flushDwell() {
    if (!dwell) return;
    var d = dwell;
    dwell = null;
    if (d.since) d.ms += Date.now() - d.since;
    var ms = Math.min(D.DWELL_CAP_MS, d.ms);
    if (ms < 1000 || !window.AnxinFirebase) return;
    window.AnxinFirebase.discuss.dwell(d.id, ms).catch(function () { /* 只是統計，丟掉就算了 */ });
  }

  /* 切到別的 app、鎖螢幕：先送出這一段；回來重新計時 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flushDwell();
    else if (current && current.view === 'thread' && thread.data) startDwell(thread.data);
  });
  window.addEventListener('pagehide', flushDwell);

  function renderReplies(rs) {
    var list = $('replyList');
    if (!rs) {
      list.innerHTML = '';
      $('repliesTitle').textContent = '回覆';
      return;
    }
    $('repliesTitle').textContent = rs.length ? '回覆（' + rs.length + '）' : '回覆';
    if (!rs.length) {
      list.innerHTML = '<li class="reply-empty">還沒有回覆，留下第一則鼓勵吧。</li>';
      return;
    }
    var now = Date.now();
    list.innerHTML = rs.slice().sort(function (a, b) {
      return (a.createdAt || now) - (b.createdAt || now);
    }).map(function (r) {
      var item = {
        role: D.ROLES.indexOf(r.role) === -1 ? '其他' : r.role,
        author: typeof r.author === 'string' ? r.author : '',
        createdAt: r.createdAt,
        source: r.source
      };
      return '<li class="reply">' + metaHtml(item, now) +
        '<p class="reply-body">' + esc(typeof r.content === 'string' ? r.content : '') + '</p></li>';
    }).join('');
  }

  /* ── 回覆表單 ── */

  var replyText = $('replyText');
  var updateReplyCount = counter(replyText, $('reply-count'), D.MAX.reply);
  /* 同一則回覆用同一個 id：逾時後再送一次，不會變成兩則 */
  var reply = { threadId: null, id: null, sending: false };

  function resetReply(threadId) {
    reply.threadId = threadId;
    reply.id = null;
    replyText.value = '';
    updateReplyCount();
    $('reply-error').hidden = true;
  }

  function fillIdentity() {
    if (!me || typeof me !== 'object') return;
    if (!CLINIC && !$('replyRole').value && D.ROLES.indexOf(me.role) !== -1) $('replyRole').value = me.role;
    if (typeof me.author === 'string' && me.author) {
      if (!$('replyAuthor').value) $('replyAuthor').value = me.author;
      if (!$('author').value) $('author').value = me.author;
    }
    previewName($('replyAuthor'), $('replyAuthorPreview'));
    previewName($('author'), $('authorPreview'));
  }

  /* 稱呼裡有孩子的暱稱（「小恩媽媽」）：先讓家長看到實際會顯示「孩子媽媽」 */
  function previewName(input, out) {
    var typed = input.value.trim();
    var shown = D.authorName(typed, nickname);
    out.hidden = !typed || shown === typed;
    if (!out.hidden) {
      out.innerHTML = '孩子的暱稱不會公開，會顯示為「<strong>' + esc(shown || '匿名') + '</strong>」。';
    }
  }

  ['author', 'replyAuthor'].forEach(function (id) {
    $(id).addEventListener('input', function () { previewName($(id), $(id + 'Preview')); });
  });

  function showReplyError(msg, focusEl) {
    var el = $('reply-error');
    el.textContent = msg;
    el.hidden = false;
    if (focusEl) focusEl.focus();
  }

  function setReplying(on) {
    reply.sending = on;
    $('replyBtn').setAttribute('aria-busy', String(on));
    tickCooldown();
  }

  $('replyForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (reply.sending || cooldownLeft() > 0 || !thread.data) return;
    $('reply-error').hidden = true;
    var role = CLINIC ? '家長' : $('replyRole').value;
    if (!replyText.value.trim()) return showReplyError('請先寫下回覆的內容。', replyText);
    if (!role) return showReplyError('請選擇您的身分。', $('replyRole'));

    var typedName = $('replyAuthor').value.trim();
    var payload = D.buildReply({
      role: role,
      author: typedName,
      content: replyText.value
    }, { source: SOURCE, nickname: nickname });
    var id = thread.id;

    setReplying(true);
    Anxin.withTimeout(Anxin.whenFirebase(10000).then(function (fb) {
      if (!reply.id) reply.id = fb.discuss.newReplyId(id);
      return fb.discuss.reply(id, reply.id, payload);
    }), SEND_TIMEOUT_MS).then(function () {
      markPosted();
      rememberMe(payload.role, typedName);
      setReplying(false);
      if (reply.threadId === id) resetReply(id);
      Anxin.announce(live, '已送出回覆');
    }, function (err) {
      window.console.error('回覆失敗：', err);
      if (err && err.code === 'permission-denied') markPosted();
      setReplying(false);
      if (reply.threadId === id) showReplyError(sendErrorText(err));
    });
  });

  /* ─────────────────────────────────────────────────────────────
     發言冷卻：兩次發言（發文或回覆）至少隔 15 秒，按鈕顯示倒數。
     伺服器也擋（cooldowns/{uid}），這裡只是讓人知道還要等多久。
     ───────────────────────────────────────────────────────────── */

  var cooldownTimer = 0;

  function cooldownLeft() {
    return D.cooldownLeft(Number(readJson(KEYS.last, 0)) || 0, Date.now());
  }

  function markPosted() {
    writeJson(KEYS.last, Date.now());
    tickCooldown();
  }

  function tickCooldown() {
    var left = cooldownLeft();
    var wait = left > 0 ? Math.ceil(left / 1000) + ' 秒後可以再發言' : '';
    $('replyBtn').disabled = reply.sending || left > 0;
    $('replyLabel').textContent = reply.sending ? '送出中…' : wait || '送出回覆';
    $('postBtn').disabled = posting || left > 0;
    $('postLabel').textContent = posting ? '發布中…' : wait || '發布';
    window.clearTimeout(cooldownTimer);
    if (left > 0) cooldownTimer = window.setTimeout(tickCooldown, (left % 1000) || 1000);
  }

  /* ─────────────────────────────────────────────────────────────
     年紀範圍：一條軌道、兩端都能拖（篩選、醫護人員的年齡層）
     兩個 <input type=range> 疊在同一條軌道上：鍵盤、螢幕閱讀器照常操作各自那一端。
     手指／滑鼠由外框處理：拖哪一端動哪一端；兩端疊在一起時看往哪邊拖；
     點一下軌道（不用拖），最近的那一端就跳過去。
     ───────────────────────────────────────────────────────────── */

  var THUMB = 32; /* /styles.css 的滑桿把手寬度 */
  var drag = null;

  function dualHtml(p, lo, hi, title) {
    var input = function (cls, k, v, end) {
      return '<input type="range" class="' + cls + '" id="' + p + '-' + k + '" min="0" max="' + D.AGE_MAX_IDX +
        '" step="1" value="' + v + '" data-k="' + k + '" aria-label="' + title + '：' + end + '">';
    };
    return '<div class="dual-range" data-dual id="' + p + '-dual">' +
      '<div class="dual-track" aria-hidden="true"><div class="dual-fill"></div></div>' +
      input('dual-lo', 'from', lo, '最小年紀') + input('dual-hi', 'to', hi, '最大年紀') +
      '</div><p class="dual-scale" aria-hidden="true"><span>0 歲</span><span>18 歲</span></p>';
  }

  function paintDual(wrap, lo, hi) {
    if (!wrap) return;
    wrap.style.setProperty('--lo', String(lo / D.AGE_MAX_IDX));
    wrap.style.setProperty('--hi', String(hi / D.AGE_MAX_IDX));
  }

  function dualValue(wrap, x) {
    var r = wrap.getBoundingClientRect();
    var ratio = (x - r.left - THUMB / 2) / Math.max(1, r.width - THUMB);
    return Math.round(Math.min(1, Math.max(0, ratio)) * D.AGE_MAX_IDX);
  }

  function dualPick(d, v, dx) {
    var a = Number(d.lo.value);
    var b = Number(d.hi.value);
    if (a === b) {
      if (dx) return dx < 0 ? d.lo : d.hi;
      return v <= a ? d.lo : d.hi;
    }
    if (v <= a) return d.lo;
    if (v >= b) return d.hi;
    return v - a <= b - v ? d.lo : d.hi;
  }

  /* 交給原本的 input / change 處理（吸附、不交錯、更新畫面） */
  function dualSet(input, v) {
    if (Number(input.value) === v) return;
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  document.addEventListener('pointerdown', function (ev) {
    var wrap = ev.target.closest && ev.target.closest('[data-dual]');
    if (!wrap || ev.button > 0) return;
    drag = {
      wrap: wrap, lo: wrap.querySelector('.dual-lo'), hi: wrap.querySelector('.dual-hi'),
      id: ev.pointerId, x: ev.clientX, which: null, moved: false
    };
    try { wrap.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
    if (ev.pointerType === 'mouse') ev.preventDefault();
  });

  /* 先等手指動了 4px 才決定：往上下滑是捲動頁面（瀏覽器會送 pointercancel），不會動到把手 */
  document.addEventListener('pointermove', function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var dx = ev.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 4) return;
      drag.moved = true;
      drag.which = dualPick(drag, dualValue(drag.wrap, drag.x), dx);
      drag.which.focus({ preventScroll: true });
      drag.wrap.classList.add('is-dragging');
    }
    dualSet(drag.which, dualValue(drag.wrap, ev.clientX));
  });

  function endDrag(ev, cancelled) {
    if (!drag || ev.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    d.wrap.classList.remove('is-dragging');
    if (!d.moved) {
      if (cancelled) return;
      var v = dualValue(d.wrap, ev.clientX);
      d.which = dualPick(d, v, 0);
      d.which.focus({ preventScroll: true });
      dualSet(d.which, v);
    }
    d.which.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('pointerup', function (ev) { endDrag(ev, false); });
  document.addEventListener('pointercancel', function (ev) { endDrag(ev, true); });

  /* ─────────────────────────────────────────────────────────────
     發文
     公開版：稱呼、身分、孩子（家長可以好幾位；醫護人員填年齡範圍）、內容、標籤
     家長版：只有內容和標籤，身分與孩子沿用 #01 的資料
     ───────────────────────────────────────────────────────────── */

  var form = $('composeForm');
  var content = $('content');
  var posting = false;
  /* 同一份草稿用同一個 id：逾時後再按一次，不會變成兩篇 */
  var postId = null;

  var errorFields = {
    role: { label: '您的身分' },
    members: { label: '孩子的年紀與性別' },
    content: { label: '您的方法或經驗', focus: 'content', invalid: 'content' }
  };
  var errors = Anxin.createFormErrors({
    form: form,
    summary: $('errorSummary'),
    list: $('errorList'),
    fields: errorFields
  });

  var role = CLINIC ? '家長' : '';
  /* 一篇只寫一個孩子（醫護人員：一個年齡層）。陣列裡永遠只有一位 */
  var members = [];
  var tags = [];

  function proMode() { return D.isPro(role); }

  /* 單一年紀：idx = null 代表還沒選（滑桿停在 6 歲但不算數）；年齡範圍：預設各年齡、男女都有 */
  function blankMember() {
    return proMode()
      ? { idx: null, from: FULL.from, to: FULL.to, gender: '不限' }
      : { idx: null, from: FULL.from, to: FULL.to, gender: null };
  }

  /* 換身分（家長 ↔ 醫護人員）時，已經填的年紀盡量留著 */
  function convertMembers(toPro) {
    members = members.map(function (m) {
      if (toPro) {
        return {
          idx: null,
          from: m.idx == null ? FULL.from : m.idx,
          to: m.idx == null ? FULL.to : m.idx,
          gender: m.gender || '不限'
        };
      }
      var touched = m.from !== FULL.from || m.to !== FULL.to;
      return { idx: touched ? m.from : null, from: FULL.from, to: FULL.to, gender: m.gender === '不限' ? null : m.gender };
    });
  }

  function genderOpt(p, i, value, text, m) {
    var id = p + '-g' + i;
    return '<label class="segmented-option"><input type="radio" id="' + id + '" name="' + p + '-gender" value="' +
      value + '" data-k="gender"' + (m.gender === value ? ' checked' : '') + '>' +
      '<span class="segmented-face">' + text + '</span></label>';
  }

  function singleMemberHtml(m, i) {
    var p = 'm' + i;
    return '<div class="member" data-i="' + i + '">' +
      '<div class="member-row">' +
      '<label class="member-label" for="' + p + '-age">年紀</label>' +
      '<output class="member-out" id="' + p + '-age-out" for="' + p + '-age"></output>' +
      '<input type="range" id="' + p + '-age" min="0" max="' + D.AGE_MAX_IDX + '" step="1" value="' +
      (m.idx == null ? 12 : m.idx) + '" data-k="idx">' +
      '</div>' +
      '<div class="member-row" role="radiogroup" aria-labelledby="' + p + '-g">' +
      '<span class="member-label" id="' + p + '-g">性別</span>' +
      '<div class="segmented">' + genderOpt(p, 0, '男', '男孩', m) + genderOpt(p, 1, '女', '女孩', m) + '</div>' +
      '</div></div>';
  }

  function rangeMemberHtml(m, i) {
    var p = 'm' + i;
    return '<div class="member" data-i="' + i + '">' +
      '<div class="member-row">' +
      '<p class="member-label">年紀範圍</p>' +
      '<output class="member-out" id="' + p + '-range-out"></output>' +
      dualHtml(p, m.from, m.to, '年紀範圍') +
      '</div>' +
      '<div class="member-row" role="radiogroup" aria-labelledby="' + p + '-g">' +
      '<span class="member-label" id="' + p + '-g">性別</span>' +
      '<div class="segmented is-3">' + genderOpt(p, 0, '男', '男孩', m) + genderOpt(p, 1, '女', '女孩', m) +
      genderOpt(p, 2, '不限', '都有', m) + '</div>' +
      '</div></div>';
  }

  function paintMember(m, i) {
    var p = 'm' + i;
    if (proMode()) {
      var all = m.from === FULL.from && m.to === FULL.to;
      $(p + '-range-out').textContent = all ? '各年齡' : D.ageRangeLabel(D.indexToAge(m.from), D.indexToAge(m.to));
      $(p + '-from').setAttribute('aria-valuetext', Anxin.ageLabel(D.indexToAge(m.from)));
      $(p + '-to').setAttribute('aria-valuetext', Anxin.ageLabel(D.indexToAge(m.to)));
      paintDual($(p + '-dual'), m.from, m.to);
      return;
    }
    var out = $(p + '-age-out');
    var input = $(p + '-age');
    if (m.idx == null) {
      out.textContent = '尚未選擇';
      out.setAttribute('data-empty', 'true');
      input.style.setProperty('--fill', '0%');
      input.removeAttribute('aria-valuetext');
      return;
    }
    var label = Anxin.ageLabel(D.indexToAge(m.idx));
    out.textContent = label;
    out.removeAttribute('data-empty');
    input.setAttribute('aria-valuetext', label);
    input.style.setProperty('--fill', (m.idx / D.AGE_MAX_IDX * 100).toFixed(2) + '%');
  }

  function renderMembers() {
    var pro = proMode();
    $('membersLegend').textContent = pro ? '照顧過的孩子：年紀範圍與性別' : '孩子的年紀與性別';
    $('membersHint').textContent = pro
      ? '填年齡範圍（例如 3–6 歲）；不同年齡層的經驗，請分開發文。'
      : '一篇寫一個孩子；其他孩子的經驗，可以再發一篇。';
    errorFields.members.label = pro ? '孩子的年紀範圍' : '孩子的年紀與性別';
    $('members').innerHTML = members.map(pro ? rangeMemberHtml : singleMemberHtml).join('');
    members.forEach(paintMember);
  }

  $('members').addEventListener('input', function (ev) {
    var el = ev.target;
    var li = el.closest('[data-i]');
    if (!li || el.type !== 'range') return;
    var i = Number(li.getAttribute('data-i'));
    var m = members[i];
    var k = el.getAttribute('data-k');
    var prev = k === 'idx' ? (m.idx == null ? 12 : m.idx) : m[k];
    var v = D.snapIndex(Number(el.value), prev);
    /* 年齡層的兩端不能交錯 */
    if (k === 'from') v = Math.min(v, m.to);
    if (k === 'to') v = Math.max(v, m.from);
    if (Number(el.value) !== v) el.value = v;
    m[k] = v;
    paintMember(m, i);
    errors.clearError('members');
  });

  $('members').addEventListener('change', function (ev) {
    if (ev.target.getAttribute('data-k') !== 'gender') return;
    members[Number(ev.target.closest('[data-i]').getAttribute('data-i'))].gender = ev.target.value;
    errors.clearError('members');
  });

  form.addEventListener('change', function (ev) {
    if (ev.target.name !== 'role') return;
    var wasPro = proMode();
    role = ev.target.value;
    if (wasPro !== proMode()) {
      convertMembers(proMode());
      renderMembers();
    }
    Anxin.setAnswered(ev.target, true);
    errors.clearError('role');
  });

  /* ── 標籤 ── */

  var SUGGEST = ['深呼吸', '轉移注意力', '事先說明', '抱抱', '說故事', '玩遊戲', '小獎勵'];
  var tagInput = $('tagInput');

  function renderTags() {
    var full = tags.length >= D.MAX.tags;
    $('tagChips').innerHTML = tags.map(function (t, i) {
      return '<li><button class="chip chip-picked" type="button" data-untag="' + i + '" aria-label="移除標籤 ' +
        esc(t) + '">#' + esc(t) + ICON.x + '</button></li>';
    }).join('');
    $('tagChips').hidden = !tags.length;
    tagInput.disabled = full;
    $('tagAdd').disabled = full;
    tagInput.placeholder = full ? '已經 5 個了' : '例如：深呼吸';
    var left = SUGGEST.filter(function (s) { return tags.indexOf(s) === -1; });
    $('tagSuggestWrap').hidden = full || !left.length;
    $('tagSuggest').innerHTML = left.map(function (s) {
      return '<button class="chip chip-suggest" type="button" data-suggest="' + s + '">' + ICON.plus + '#' + s + '</button>';
    }).join('');
  }

  function addTagsFrom(text) {
    var before = tags.length;
    tags = D.addTags(tags, text);
    renderTags();
    saveDraft();
    return tags.length > before;
  }

  function commitTagInput() {
    if (!tagInput.value.trim()) return;
    var added = addTagsFrom(tagInput.value);
    tagInput.value = '';
    if (added) Anxin.announce(live, '已加入標籤，共 ' + tags.length + ' 個');
  }

  $('tagAdd').addEventListener('click', function () {
    commitTagInput();
    if (!tagInput.disabled) tagInput.focus();
  });

  tagInput.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.isComposing || ev.keyCode === 229) return;
    ev.preventDefault();
    commitTagInput();
  });

  /* 打完一個字詞接空白或逗號，就直接變成標籤（注音、拼音選字中不算） */
  tagInput.addEventListener('input', function (ev) {
    if (!ev.isComposing && /\S[\s,，、]$/.test(tagInput.value)) commitTagInput();
  });

  $('tagChips').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-untag]');
    if (!b) return;
    var t = tags.splice(Number(b.getAttribute('data-untag')), 1)[0];
    renderTags();
    saveDraft();
    tagInput.focus();
    Anxin.announce(live, '已移除標籤 ' + t);
  });

  $('tagSuggest').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-suggest]');
    if (!b) return;
    var t = b.getAttribute('data-suggest');
    addTagsFrom(t);
    /* 焦點交給剛加入的標籤（可以馬上移除），手機也不會跳出鍵盤 */
    var picked = $('tagChips').querySelector('[data-untag="' + tags.indexOf(t) + '"]');
    if (picked) picked.focus();
    Anxin.announce(live, '已加入標籤 ' + t);
  });

  /* ── 草稿：內文、標籤、稱呼（重新整理、離開再回來都還在） ── */

  function saveDraft() {
    writeJson(KEYS.draft, { content: content.value, tags: tags, author: $('author').value });
  }

  function clearDraft() {
    try { localStorage.removeItem(KEYS.draft); } catch (e) { /* 忽略 */ }
  }

  var updateContentCount = counter(content, $('content-count'), D.MAX.content);

  content.addEventListener('input', function () {
    Anxin.setAnswered(content, content.value.trim());
    if (content.value.trim()) errors.clearError('content');
    saveDraft();
  });

  $('author').addEventListener('input', saveDraft);

  function validate() {
    var list = [];
    errors.clearAll();
    if (!CLINIC) {
      if (!role) list.push({ key: 'role', msg: '請選擇您的身分。' });
      if (!proMode()) {
        if (members[0].idx == null) {
          errorFields.members.focus = 'm0-age';
          list.push({ key: 'members', msg: '請拖曳滑桿，選孩子的年紀。' });
        } else if (!members[0].gender) {
          errorFields.members.focus = 'm0-g0';
          list.push({ key: 'members', msg: '請選孩子的性別。' });
        }
      }
    }
    if (!content.value.trim()) list.push({ key: 'content', msg: '請寫下您的方法或經驗。' });
    list.forEach(function (e) { errors.setError(e.key, e.msg); });
    return list;
  }

  function memberPayload() {
    if (CLINIC) return [{ ageMin: profile.age, ageMax: profile.age, gender: profile.gender }];
    return members.map(function (m) {
      if (proMode()) return { ageMin: D.indexToAge(m.from), ageMax: D.indexToAge(m.to), gender: m.gender || '不限' };
      return { ageMin: D.indexToAge(m.idx), ageMax: D.indexToAge(m.idx), gender: m.gender };
    });
  }

  function showPostError(msg) {
    $('post-error').textContent = msg;
    $('post-error').hidden = false;
    Anxin.announce(live, msg);
  }

  function setPosting(on) {
    posting = on;
    $('postBtn').setAttribute('aria-busy', String(on));
    tickCooldown();
  }

  function resetComposer() {
    content.value = '';
    updateContentCount();
    Anxin.setAnswered(content, false);
    tags = [];
    renderTags();
    members = [blankMember()];
    renderMembers();
    clearDraft();
    errors.clearAll();
    $('errorSummary').hidden = true;
    $('post-error').hidden = true;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (posting || cooldownLeft() > 0) return;
    commitTagInput();
    var list = validate();
    if (list.length) {
      errors.showSummary(list);
      Anxin.announce(live, '還有 ' + list.length + ' 個地方需要補上');
      return;
    }
    $('errorSummary').hidden = true;
    $('post-error').hidden = true;

    var payload;
    var typedName = $('author').value.trim();
    try {
      payload = D.buildThread({
        role: role,
        author: typedName,
        content: content.value,
        members: memberPayload(),
        hashtags: tags
      }, { source: SOURCE, nickname: nickname });
    } catch (e) {
      window.console.error('發文內容有誤：', e);
      showPostError('內容有地方不對，請檢查後再試一次。');
      return;
    }

    setPosting(true);
    Anxin.withTimeout(Anxin.whenFirebase(10000).then(function (fb) {
      if (!postId) postId = fb.discuss.newThreadId();
      var id = postId;
      return fb.discuss.post(id, payload).then(function () { return id; });
    }), SEND_TIMEOUT_MS).then(function (id) {
      postId = null;
      markPosted();
      addId(KEYS.mine, id, 200);
      rememberMe(payload.role, typedName);
      var now = Date.now();
      upsert(D.normalizeThread(Object.assign({ id: id, createdAt: now, lastActivityAt: now }, payload)));
      setPosting(false);
      resetComposer();
      /* 換掉 #new 這一筆：看完自己的文章按返回，回到列表而不是空白表單 */
      window.history.replaceState(null, '', '#t=' + id);
      route(false);
      Anxin.announce(live, '已發布，謝謝您的分享');
    }, function (err) {
      window.console.error('發文失敗：', err);
      if (err && err.code === 'permission-denied') markPosted();
      setPosting(false);
      showPostError(sendErrorText(err));
    });
  });

  function showCompose(first) {
    document.title = '安心陪伴 · 分享您的方法';
    window.scrollTo(0, 0);
    if (!first) $('composeTitle').focus({ preventScroll: true });
  }

  function initComposer() {
    if (CLINIC) {
      $('clinicKid').textContent = D.memberLabel({ ageMin: profile.age, ageMax: profile.age, gender: profile.gender });
    } else if (me && D.ROLES.indexOf(me.role) !== -1) {
      role = me.role;
      var r = form.querySelector('input[name="role"][value="' + me.role + '"]');
      if (r) {
        r.checked = true;
        Anxin.setAnswered(r, true);
      }
    }
    members = [blankMember()];
    renderMembers();

    var draft = readJson(KEYS.draft, null);
    if (draft && typeof draft === 'object') {
      if (typeof draft.content === 'string') content.value = draft.content.slice(0, D.MAX.content);
      if (Array.isArray(draft.tags)) tags = D.addTags([], draft.tags.join(' '));
      if (typeof draft.author === 'string' && draft.author) $('author').value = draft.author;
      Anxin.setAnswered(content, content.value.trim());
      updateContentCount();
    }
    renderTags();
  }

  /* ─────────────────────────────────────────────────────────────
     開始
     ───────────────────────────────────────────────────────────── */

  renderFilters();
  initComposer();
  fillIdentity();
  tickCooldown();
  route(true);
  /* 直接打開單篇的連結：列表也先載好，按「所有討論」不用再等 */
  if (!state.loaded) loadThreads();
})();
