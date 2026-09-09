// script.js — 前端邏輯，直接透過 Firebase Web SDK 讀寫 Firestore（無需自架後端）。
//
// 資料模型：
//   threads (collection)
//     role         : 發文者身分（家長 / 醫師 / 護士 / 醫檢師 / 其他）
//     author       : 暱稱（預設「匿名」）
//     members[]    : 每位孩子 { gender, kind:'single', age }  或  { gender, kind:'range', ageMin, ageMax }
//     ageMin/ageMax: 由 members 攤平出的整體年齡涵蓋範圍，供篩選用
//     hashtags[]   : 標籤
//     content      : 內文
//     createdAt    : 建立時間（serverTimestamp）
//     clicks       : 被展開閱讀的次數
//     dwellMs      : 累計停留時間（毫秒）
//     replyCount   : 回覆數
//     lastActivityAt: 最後活動時間（發文或有人回覆）
//   threads/{id}/replies (subcollection)
//     author, content, createdAt

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, addDoc, doc, updateDoc, increment,
    query, where, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase 的「用戶端」設定值不是機密金鑰，公開在前端是正常且預期的做法；
// 真正的存取控制由 Firestore 安全規則（firestore.rules）決定，而非靠隱藏這組設定。
const firebaseConfig = {
    apiKey: "AIzaSyAgojah0JPnyrPjPan1GfRhRBO52abkgBE",
    authDomain: "dftt-48e02.firebaseapp.com",
    projectId: "dftt-48e02",
    storageBucket: "dftt-48e02.firebasestorage.app",
    messagingSenderId: "144394925297",
    appId: "1:144394925297:web:44b9be77dcd2117f34a550",
    measurementId: "G-YQTYB97482"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 需在 Firebase Console > Authentication > Sign-in method 開啟「匿名」登入，
// 否則 signInAnonymously 會失敗，Firestore 規則要求的 request.auth != null 也無法滿足。
const authReady = signInAnonymously(auth).catch(err => {
    console.error('匿名登入失敗，請確認 Firebase Console 已啟用「匿名」登入方式：', err);
});

// ---------- 常數與限制 ----------
const VALID_ROLES = ['家長', '醫師', '護士', '醫檢師', '其他'];
const VALID_GENDERS = ['男孩', '女孩', '不指定'];
const MAX_CONTENT_LENGTH = 2000;
const MAX_AUTHOR_LENGTH = 50;
const MAX_HASHTAGS = 5;
const MAX_HASHTAG_LENGTH = 20;
const MAX_MEMBERS = 8;
const REPLY_COOLDOWN_MS = 15_000;      // 回覆冷卻 15 秒
const REPLY_MAX_LENGTH = 1000;
const FETCH_LIMIT = 60;                 // 一次抓取的上限（熱門排序需在前端重算分數）

// ---------- 小工具 ----------
const $ = (sel, root = document) => root.querySelector(sel);

/** 依規格對年齡做級距吸附：未滿 5 歲以 0.5 為級距，5 歲（含）以上以 1 為級距。 */
function snapAge(value) {
    const v = Number(value);
    if (v < 5) return Math.round(v * 2) / 2;
    return Math.round(v);
}

/** 顯示用的年齡文字，例如 0.5 歲 / 3 歲。 */
function formatAge(v) {
    return `${Number.isInteger(v) ? v : v.toFixed(1)} 歲`;
}

let toastTimer;
function toast(message, isError = false) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// =====================================================================
//  發布：孩子（member）輸入列
// =====================================================================
const membersList = $('#membersList');
const memberTemplate = $('#memberTemplate');

function addMemberRow(removable = true) {
    if (membersList.children.length >= MAX_MEMBERS) {
        toast(`最多只能新增 ${MAX_MEMBERS} 位孩子`, true);
        return;
    }
    const node = memberTemplate.content.firstElementChild.cloneNode(true);

    const single = $('.member-single', node);
    const range = $('.member-range', node);
    const toggle = $('.member-range-toggle', node);

    const age = $('.member-age', node);
    const ageOut = $('.member-age-out', node);
    const ageMin = $('.member-agemin', node);
    const ageMinOut = $('.member-agemin-out', node);
    const ageMax = $('.member-agemax', node);
    const ageMaxOut = $('.member-agemax-out', node);

    // 單一年齡滑桿：即時吸附並更新顯示
    age.addEventListener('input', () => {
        const v = snapAge(age.value);
        age.value = v;
        ageOut.textContent = formatAge(v);
    });

    // 範圍滑桿：吸附並保持 min <= max
    const syncRange = () => {
        let lo = snapAge(ageMin.value);
        let hi = snapAge(ageMax.value);
        if (lo > hi) [lo, hi] = [hi, lo];
        ageMin.value = lo;
        ageMax.value = hi;
        ageMinOut.textContent = formatAge(lo);
        ageMaxOut.textContent = formatAge(hi);
    };
    ageMin.addEventListener('input', syncRange);
    ageMax.addEventListener('input', syncRange);

    toggle.addEventListener('change', () => {
        const useRange = toggle.checked;
        single.hidden = useRange;
        range.hidden = !useRange;
    });

    const removeBtn = $('.member-remove', node);
    removeBtn.hidden = !removable;
    removeBtn.addEventListener('click', () => {
        node.remove();
        // 移除後，確保至少留一列且第一列不可刪
        refreshRemovableState();
    });

    membersList.appendChild(node);
    refreshRemovableState();
}

/** 只有多於一位孩子時才顯示移除鈕。 */
function refreshRemovableState() {
    const rows = membersList.children;
    Array.from(rows).forEach((row, i) => {
        $('.member-remove', row).hidden = rows.length === 1;
    });
}

/** 從畫面讀出所有孩子資料，並回傳整體年齡涵蓋範圍供篩選。 */
function collectMembers() {
    const members = [];
    let ageMinAll = Infinity, ageMaxAll = -Infinity;

    for (const row of membersList.children) {
        const gender = $('.member-gender', row).value;
        const useRange = $('.member-range-toggle', row).checked;
        if (useRange) {
            const lo = snapAge($('.member-agemin', row).value);
            const hi = snapAge($('.member-agemax', row).value);
            members.push({ gender, kind: 'range', ageMin: lo, ageMax: hi });
            ageMinAll = Math.min(ageMinAll, lo);
            ageMaxAll = Math.max(ageMaxAll, hi);
        } else {
            const a = snapAge($('.member-age', row).value);
            members.push({ gender, kind: 'single', age: a });
            ageMinAll = Math.min(ageMinAll, a);
            ageMaxAll = Math.max(ageMaxAll, a);
        }
    }
    return { members, ageMin: ageMinAll, ageMax: ageMaxAll };
}

/** 把一位孩子渲染成顯示文字，例如「男孩 3 歲」「女孩 3–6 歲」。 */
function memberLabel(m) {
    if (m.kind === 'range') return `${m.gender} ${formatAge(m.ageMin)}–${formatAge(m.ageMax)}`.replace(' 歲–', '–');
    return `${m.gender} ${formatAge(m.age)}`;
}

// =====================================================================
//  發布：對話框控制
// =====================================================================
const composer = $('#composer');
const postForm = $('#postForm');

function openComposer() {
    if (membersList.children.length === 0) addMemberRow(false);
    composer.showModal();
}
function closeComposer() {
    composer.close();
}

$('#openComposerBtn').addEventListener('click', openComposer);
$('#closeComposerBtn').addEventListener('click', closeComposer);
$('#cancelComposerBtn').addEventListener('click', closeComposer);
$('#addMemberBtn').addEventListener('click', () => addMemberRow(true));

// 內文字數統計
const contentEl = $('#postContent');
contentEl.addEventListener('input', () => {
    $('#contentCount').textContent = contentEl.value.length;
});

function validatePost({ role, members, hashtags, author, content }) {
    if (!VALID_ROLES.includes(role)) return '身分角色無效';
    if (members.length === 0) return '請至少填寫一位孩子';
    if (members.some(m => !VALID_GENDERS.includes(m.gender))) return '性別設定無效';
    if (members.some(m => {
        const vals = m.kind === 'range' ? [m.ageMin, m.ageMax] : [m.age];
        return vals.some(a => Number.isNaN(a) || a < 0 || a > 18);
    })) return '年齡需介於 0 到 18 歲之間';
    if (!content) return '分享內容不可為空';
    if (content.length > MAX_CONTENT_LENGTH) return `分享內容過長（上限 ${MAX_CONTENT_LENGTH} 字）`;
    if (author.length > MAX_AUTHOR_LENGTH) return `暱稱過長（上限 ${MAX_AUTHOR_LENGTH} 字）`;
    if (hashtags.some(t => t.length > MAX_HASHTAG_LENGTH)) return `單一標籤過長（上限 ${MAX_HASHTAG_LENGTH} 字）`;
    return null;
}

postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = $('#submitPostBtn');

    const role = $('#postRole').value;
    const author = $('#postAuthor').value.trim() || '匿名';
    const content = contentEl.value.trim();
    const { members, ageMin, ageMax } = collectMembers();
    const hashtags = [...new Set(
        $('#postHashtag').value.split(/[,，]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    )].slice(0, MAX_HASHTAGS);

    const err = validatePost({ role, members, hashtags, author, content });
    if (err) { toast(err, true); return; }

    submitBtn.disabled = true;
    try {
        await authReady;
        if (!auth.currentUser) {
            toast('目前無法連線至 Firebase，請重新整理後再試。', true);
            return;
        }
        await addDoc(collection(db, 'threads'), {
            role, author, members, ageMin, ageMax, hashtags, content,
            clicks: 0, dwellMs: 0, replyCount: 0,
            createdAt: serverTimestamp(),
            lastActivityAt: serverTimestamp()
        });
        toast('發布成功，謝謝你的分享！');
        postForm.reset();
        membersList.innerHTML = '';
        $('#contentCount').textContent = '0';
        closeComposer();
        loadThreads();
    } catch (error) {
        console.error('發布失敗：', error);
        toast('發布失敗，請稍後再試（' + (error.code || error.message) + '）', true);
    } finally {
        submitBtn.disabled = false;
    }
});

// =====================================================================
//  篩選 / 搜尋 / 排序工具列
// =====================================================================
const searchInput = $('#searchInput');
const sortSelect = $('#sortSelect');
const filterPanel = $('#filterPanel');
const filterAge = $('#filterAge');
const filterAgeOut = $('#filterAgeOut');

$('#toggleFiltersBtn').addEventListener('click', (e) => {
    const open = filterPanel.hidden;
    filterPanel.hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', String(open));
});

filterAge.addEventListener('input', () => {
    const raw = Number(filterAge.value);
    if (raw < 0) { filterAgeOut.textContent = '全部'; return; }
    const v = snapAge(raw);
    filterAge.value = v;
    filterAgeOut.textContent = formatAge(v);
});

// 搜尋輸入做去抖動（debounce），避免每個按鍵都重跑
let searchTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyView, 250);
});
sortSelect.addEventListener('change', applyView);
['#filterRole', '#filterGender', '#filterHashtag'].forEach(sel =>
    $(sel).addEventListener('input', applyView));
filterAge.addEventListener('change', applyView);

$('#clearFilterBtn').addEventListener('click', () => {
    $('#filterRole').value = '';
    $('#filterGender').value = '';
    $('#filterHashtag').value = '';
    filterAge.value = -1;
    filterAgeOut.textContent = '全部';
    searchInput.value = '';
    applyView();
});

// =====================================================================
//  讀取資料
//  策略：伺服器端只用「最新」排序抓一批（避免大量複合索引），
//        關鍵字、年齡涵蓋、熱門排序等都在前端計算，維持彈性與零索引成本。
// =====================================================================
let cachedThreads = [];   // 目前抓下來的資料（含 doc id）

async function loadThreads() {
    const container = $('#threadsContainer');
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = '<p class="state-msg">載入中…</p>';
    try {
        const q = query(collection(db, 'threads'), orderBy('createdAt', 'desc'), limit(FETCH_LIMIT));
        const snap = await getDocs(q);
        cachedThreads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        applyView();
    } catch (error) {
        console.error('讀取討論串失敗：', error);
        container.innerHTML = '<p class="state-msg">無法載入討論，請稍後再試（詳情請看主控台）。</p>';
    } finally {
        container.setAttribute('aria-busy', 'false');
    }
}

/**
 * 熱門分數（Hacker News 風格的時間衰減）：
 *   score = (clicks + 3*replyCount + dwellMinutes) / (hoursSincePost + 2)^1.5
 * 綜合「點閱、回覆、停留時間」三種訊號，再以貼文年齡衰減，
 * 讓新且有互動的內容浮上來，避免舊文靠累積霸榜、也降低單純狂點的灌水效果。
 */
function hotScore(t) {
    const created = t.createdAt?.toDate?.() ?? new Date();
    const hours = Math.max(0, (Date.now() - created.getTime()) / 3.6e6);
    const engagement = (t.clicks || 0) + 3 * (t.replyCount || 0) + (t.dwellMs || 0) / 60000;
    return engagement / Math.pow(hours + 2, 1.5);
}

/** 依目前搜尋 / 篩選 / 排序條件，重新渲染列表（純前端）。 */
function applyView() {
    const kw = searchInput.value.trim().toLowerCase();
    const fRole = $('#filterRole').value;
    const fGender = $('#filterGender').value;
    const fTag = $('#filterHashtag').value.trim().replace(/^#/, '').toLowerCase();
    const fAgeRaw = Number(filterAge.value);
    const fAge = fAgeRaw < 0 ? null : snapAge(fAgeRaw);
    const sort = sortSelect.value;

    let list = cachedThreads.filter(t => {
        if (fRole && t.role !== fRole) return false;
        if (fGender && !(t.members || []).some(m => m.gender === fGender)) return false;
        if (fTag && !(t.hashtags || []).some(h => h.toLowerCase().includes(fTag))) return false;
        if (fAge !== null && !ageCovered(t, fAge)) return false;
        if (kw && !matchKeyword(t, kw)) return false;
        return true;
    });

    if (sort === 'new') {
        list.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
    } else if (sort === 'replies') {
        list.sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0));
    } else {
        list.sort((a, b) => hotScore(b) - hotScore(a));
    }

    renderList(list);
}

function tsMillis(ts) { return ts?.toDate?.().getTime?.() ?? 0; }

/** 討論是否涵蓋指定年齡（單一年齡需相符；範圍需落在區間內）。 */
function ageCovered(t, age) {
    return (t.members || []).some(m =>
        m.kind === 'range' ? age >= m.ageMin && age <= m.ageMax : m.age === age
    );
}

/** 關鍵字比對：內文、暱稱、身分、標籤。 */
function matchKeyword(t, kw) {
    const hay = [
        t.content, t.author, t.role,
        ...(t.hashtags || [])
    ].join(' ').toLowerCase();
    return hay.includes(kw);
}

// =====================================================================
//  渲染（一律用 textContent，避免使用者輸入被當成 HTML/JS 執行，防 XSS）
// =====================================================================
function renderList(list) {
    const container = $('#threadsContainer');
    // 重建列表前，先結算所有仍展開中的停留時間（避免舊卡片被丟棄後停留時間算不準）
    openDwell.forEach((_, id) => flushDwell(id));
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<p class="state-msg">目前沒有符合條件的討論，換個關鍵字或先來分享你的經驗吧！</p>';
        return;
    }
    list.forEach(t => container.appendChild(renderThread(t)));
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

// 內嵌 SVG 圖示（單一線性圖示家族，取代 emoji）。字串為固定常數，無使用者輸入，無 XSS 疑慮。
const ICONS = {
    eye: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    message: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"/></svg>',
    chevron: '<svg class="icon chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
};
function iconSvg(name) {
    const holder = document.createElement('span');
    holder.innerHTML = ICONS[name];
    return holder.firstElementChild;
}

function renderThread(t) {
    const card = el('div', 'thread');
    card.dataset.id = t.id;

    // meta 列
    const meta = el('div', 'thread-meta');
    meta.appendChild(el('span', 'role-chip', t.role));
    meta.appendChild(el('span', null, t.author));
    meta.appendChild(el('span', 'dot', '·'));
    meta.appendChild(el('span', null, t.createdAt ? t.createdAt.toDate().toLocaleString('zh-TW') : '時間未知'));
    card.appendChild(meta);

    // 孩子資訊
    if ((t.members || []).length) {
        const kids = el('div', 'kids');
        t.members.forEach(m => kids.appendChild(el('span', 'kid-chip', memberLabel(m))));
        card.appendChild(kids);
    }

    // 內文
    card.appendChild(el('p', 'thread-content', t.content));

    // 標籤
    if ((t.hashtags || []).length) {
        const tags = el('div', 'tags');
        t.hashtags.forEach(h => tags.appendChild(el('span', 'tag', `#${h}`)));
        card.appendChild(tags);
    }

    // 動作列
    const actions = el('div', 'thread-actions');
    actions.appendChild(makeStat('eye', t.clicks || 0, 'clicks'));
    actions.appendChild(makeStat('message', t.replyCount || 0, 'replies'));
    const replyBtn = el('button', 'link-btn');
    replyBtn.type = 'button';
    replyBtn.setAttribute('aria-expanded', 'false');
    const replyLabel = el('span', null, '查看 / 回覆');
    replyBtn.appendChild(replyLabel);
    replyBtn.appendChild(iconSvg('chevron'));
    actions.appendChild(replyBtn);
    card.appendChild(actions);

    // 回覆區（延遲載入）
    const repliesBox = el('div', 'replies');
    repliesBox.hidden = true;
    card.appendChild(repliesBox);

    let opened = false;
    replyBtn.addEventListener('click', async () => {
        const willOpen = repliesBox.hidden;
        repliesBox.hidden = !willOpen;
        replyBtn.setAttribute('aria-expanded', String(willOpen));
        replyLabel.textContent = willOpen ? '收合' : '查看 / 回覆';
        if (willOpen) {
            openDwell.set(t.id, Date.now());
            if (!opened) {
                opened = true;
                recordClick(t.id, card);
                await loadReplies(t.id, repliesBox);
            }
        } else {
            flushDwell(t.id);
        }
    });

    return card;
}

// 記錄目前展開中的討論開啟時間；收合或離開頁面時結算停留時間。
const openDwell = new Map();
function flushDwell(id) {
    const start = openDwell.get(id);
    if (!start) return;
    openDwell.delete(id);
    recordDwell(id, Date.now() - start);
}
// 單一 beforeunload 處理器，離開頁面時把所有展開中的停留時間補記
window.addEventListener('beforeunload', () => {
    openDwell.forEach((_, id) => flushDwell(id));
});

function makeStat(iconName, value, kind) {
    const s = el('span', 'stat');
    s.appendChild(iconSvg(iconName));
    s.appendChild(el('span', `stat-${kind}`, String(value)));
    return s;
}

// ---------- 互動訊號回報（供熱門排序使用） ----------
async function recordClick(id, card) {
    try {
        await authReady;
        await updateDoc(doc(db, 'threads', id), { clicks: increment(1) });
        const node = card.querySelector('.stat-clicks');
        if (node) node.textContent = String(Number(node.textContent || 0) + 1);
        const cached = cachedThreads.find(t => t.id === id);
        if (cached) cached.clicks = (cached.clicks || 0) + 1;
    } catch (e) { /* 統計失敗不影響閱讀，靜默略過 */ }
}

async function recordDwell(id, ms) {
    if (ms < 1500) return; // 太短不計，過濾誤點
    try {
        await authReady;
        await updateDoc(doc(db, 'threads', id), { dwellMs: increment(Math.round(ms)) });
        const cached = cachedThreads.find(t => t.id === id);
        if (cached) cached.dwellMs = (cached.dwellMs || 0) + Math.round(ms);
    } catch (e) { /* 靜默略過 */ }
}

// =====================================================================
//  回覆
// =====================================================================
async function loadReplies(threadId, box) {
    box.innerHTML = '<p class="cooldown-note">載入回覆中…</p>';
    try {
        const q = query(
            collection(db, 'threads', threadId, 'replies'),
            orderBy('createdAt', 'asc'), limit(100)
        );
        const snap = await getDocs(q);
        box.innerHTML = '';
        snap.forEach(d => box.appendChild(renderReply(d.data())));
        box.appendChild(buildReplyForm(threadId, box));
    } catch (e) {
        console.error('載入回覆失敗：', e);
        box.innerHTML = '<p class="cooldown-note">無法載入回覆。</p>';
    }
}

function renderReply(r) {
    const wrap = el('div', 'reply');
    const meta = el('div', 'reply-meta',
        `${r.author || '匿名'} · ${r.createdAt ? r.createdAt.toDate().toLocaleString('zh-TW') : ''}`);
    wrap.appendChild(meta);
    wrap.appendChild(el('div', 'reply-content', r.content));
    return wrap;
}

function buildReplyForm(threadId, box) {
    const form = el('form', 'reply-form');

    const nameRow = el('div', 'row');
    const nameInput = el('input');
    nameInput.type = 'text';
    nameInput.placeholder = '暱稱（選填，預設匿名）';
    nameInput.maxLength = MAX_AUTHOR_LENGTH;
    nameInput.style.flex = '1';
    nameRow.appendChild(nameInput);

    const textarea = el('textarea');
    textarea.placeholder = '善意提醒：這裡是彼此打氣的空間，請溫和地分享你的想法。';
    textarea.maxLength = REPLY_MAX_LENGTH;
    textarea.required = true;

    const btnRow = el('div', 'row');
    const submit = el('button', 'btn btn-primary btn-sm', '送出回覆');
    submit.type = 'submit';
    const note = el('span', 'cooldown-note');
    btnRow.appendChild(submit);
    btnRow.appendChild(note);

    form.appendChild(nameRow);
    form.appendChild(textarea);
    form.appendChild(btnRow);

    // 冷卻倒數：讀取上次回覆時間（存 localStorage），未滿 15 秒則禁用並倒數
    let cooldownTimer;
    function refreshCooldown() {
        const last = Number(localStorage.getItem('lastReplyAt') || 0);
        const remain = REPLY_COOLDOWN_MS - (Date.now() - last);
        if (remain > 0) {
            submit.disabled = true;
            note.textContent = `為了讓大家都能好好說話，請稍候 ${Math.ceil(remain / 1000)} 秒`;
            cooldownTimer = setTimeout(refreshCooldown, 500);
        } else {
            submit.disabled = false;
            note.textContent = '';
        }
    }
    refreshCooldown();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const last = Number(localStorage.getItem('lastReplyAt') || 0);
        if (Date.now() - last < REPLY_COOLDOWN_MS) { refreshCooldown(); return; }

        const content = textarea.value.trim();
        if (!content) { toast('回覆內容不可為空', true); return; }
        const author = nameInput.value.trim().slice(0, MAX_AUTHOR_LENGTH) || '匿名';

        submit.disabled = true;
        try {
            await authReady;
            if (!auth.currentUser) { toast('目前無法連線，請重新整理後再試。', true); return; }
            await addDoc(collection(db, 'threads', threadId, 'replies'), {
                author, content, createdAt: serverTimestamp()
            });
            // 更新主討論的回覆數與最後活動時間（供排序）
            await updateDoc(doc(db, 'threads', threadId), {
                replyCount: increment(1), lastActivityAt: serverTimestamp()
            });

            localStorage.setItem('lastReplyAt', String(Date.now()));
            const cached = cachedThreads.find(t => t.id === threadId);
            if (cached) cached.replyCount = (cached.replyCount || 0) + 1;

            textarea.value = '';
            // 重新載入回覆列表（會重建表單並重新啟動冷卻）
            clearTimeout(cooldownTimer);
            await loadReplies(threadId, box);
            toast('回覆成功！');
        } catch (error) {
            console.error('回覆失敗：', error);
            toast('回覆失敗，請稍後再試。', true);
            submit.disabled = false;
        }
    });

    return form;
}

// ---------- 啟動 ----------
addMemberRow(false);   // 預先建立第一列（供對話框開啟時使用）
loadThreads();
