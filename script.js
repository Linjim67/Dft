// script.js — 前端邏輯，直接透過 Firebase Web SDK 讀寫 Firestore（無需另外架設後端伺服器）

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 這是 Firebase 的「用戶端」設定值（不是機密金鑰），公開在前端程式碼中是正常且預期的做法。
// 真正的存取控制是由 Firestore 安全規則（見 firestore.rules）決定，而不是靠隱藏這組設定。
const firebaseConfig = {
    apiKey: "AIzaSyAZ7cCQlXh8oiNzwnT2LL07KPt5TMaI2d8",
    authDomain: "dhjhweb.firebaseapp.com",
    databaseURL: "https://dhjhweb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dhjhweb",
    storageBucket: "dhjhweb.firebasestorage.app",
    messagingSenderId: "763721572642",
    appId: "1:763721572642:web:4395ab9f74010a7fc0c57b",
    measurementId: "G-SSKS8JV7GN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 需在 Firebase Console > Authentication > Sign-in method 開啟「匿名」登入方式，
// 否則 signInAnonymously 會失敗，Firestore 規則要求的 request.auth != null 也無法滿足。
const authReady = signInAnonymously(auth).catch(err => {
    console.error('匿名登入失敗，請確認 Firebase Console 已啟用「匿名」登入方式：', err);
});

const VALID_ROLES = ['家長', '醫師', '護士', '醫檢師', '其他'];
const VALID_GENDERS = ['男', '女', '不指定'];
const MAX_CONTENT_LENGTH = 2000;
const MAX_AUTHOR_LENGTH = 50;
const MAX_HASHTAGS = 5;
const MAX_HASHTAG_LENGTH = 20;

function generateAgeOptions(elementId, isFilter) {
    const selectElement = document.getElementById(elementId);

    selectElement.innerHTML = isFilter
        ? '<option value="">全部</option>'
        : '<option value="" disabled selected>請選擇</option>';

    for (let i = 0; i < 4; i += 0.5) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} 歲`;
        selectElement.appendChild(option);
    }

    for (let i = 4; i <= 12; i += 1) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} 歲`;
        selectElement.appendChild(option);
    }
}

// 初始化年齡選單
generateAgeOptions('postAge', false);
generateAgeOptions('filterAge', true);

function validatePost({ role, childAge, childGender, hashtags, author, content }) {
    if (!VALID_ROLES.includes(role)) return '角色設定無效';
    if (!VALID_GENDERS.includes(childGender)) return '性別設定無效';
    if (Number.isNaN(childAge) || childAge < 0 || childAge > 12) return '小孩年紀無效';
    if (!content) return '討論內容不可為空';
    if (content.length > MAX_CONTENT_LENGTH) return `討論內容過長（上限 ${MAX_CONTENT_LENGTH} 字）`;
    if (author.length > MAX_AUTHOR_LENGTH) return `作者名稱過長（上限 ${MAX_AUTHOR_LENGTH} 字）`;
    if (hashtags.length === 0) return '請至少輸入一個 Hashtag';
    if (hashtags.some(tag => tag.length > MAX_HASHTAG_LENGTH)) return `單一 Hashtag 過長（上限 ${MAX_HASHTAG_LENGTH} 字）`;
    return null;
}

// 發布表單提交事件
document.getElementById('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const role = document.getElementById('postRole').value;
    const childAge = Number(document.getElementById('postAge').value);
    const childGender = document.getElementById('postGender').value;
    const author = document.getElementById('postAuthor').value.trim() || '匿名';
    const content = document.getElementById('postContent').value.trim();

    const hashtagsInput = document.getElementById('postHashtag').value;
    const hashtags = [...new Set(
        hashtagsInput.split(',').map(tag => tag.trim()).filter(tag => tag)
    )].slice(0, MAX_HASHTAGS);

    const validationError = validatePost({ role, childAge, childGender, hashtags, author, content });
    if (validationError) {
        alert(validationError);
        return;
    }

    try {
        await authReady; // 確保匿名登入完成，Firestore 規則要求 request.auth != null 才能寫入
        if (!auth.currentUser) {
            alert('目前無法連線至 Firebase，請重新整理頁面後再試一次。');
            return;
        }

        await addDoc(collection(db, 'threads'), {
            role,
            childAge,
            childGender,
            hashtags,
            author,
            content,
            createdAt: serverTimestamp()
        });

        alert('發布成功！');
        document.getElementById('postForm').reset();
        // 表單重置後，確保未指定預設值的 select 回到預設狀態
        document.getElementById('postAge').value = '';
        loadThreads(); // 重新載入列表
    } catch (error) {
        console.error('發布失敗：', error);
        alert('發布失敗，請稍後再試。（' + (error.code || error.message) + '）');
    }
});

// 篩選表單提交事件
document.getElementById('filterForm').addEventListener('submit', (e) => {
    e.preventDefault();

    loadThreads({
        age: document.getElementById('filterAge').value,
        gender: document.getElementById('filterGender').value,
        role: document.getElementById('filterRole').value,
        hashtag: document.getElementById('filterHashtag').value.trim()
    });
});

document.getElementById('clearFilterBtn').addEventListener('click', () => {
    document.getElementById('filterForm').reset();
    loadThreads();
});

// 獲取與渲染討論串列表
async function loadThreads(filters = {}) {
    const container = document.getElementById('threadsContainer');
    container.innerHTML = '載入中...';

    try {
        const clauses = [];
        if (filters.age !== undefined && filters.age !== '') clauses.push(where('childAge', '==', Number(filters.age)));
        if (filters.gender) clauses.push(where('childGender', '==', filters.gender));
        if (filters.role) clauses.push(where('role', '==', filters.role));
        if (filters.hashtag) clauses.push(where('hashtags', 'array-contains', filters.hashtag));

        const threadsQuery = query(
            collection(db, 'threads'),
            ...clauses,
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const snapshot = await getDocs(threadsQuery);

        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p>目前沒有相符的討論串。</p>';
            return;
        }

        snapshot.forEach(doc => {
            container.appendChild(renderThreadCard(doc.data()));
        });
    } catch (error) {
        console.error('讀取討論串失敗（若為複合查詢缺少索引，主控台會附上一組可直接點擊建立索引的連結）：', error);
        container.innerHTML = '<p style="color:red;">無法載入討論串，請稍後再試（詳情請查看瀏覽器主控台）。</p>';
    }
}

// 使用 textContent 而非 innerHTML 組出卡片，避免使用者輸入的內容被當成 HTML／JS 執行（防止 XSS）
function renderThreadCard(thread) {
    const timeString = thread.createdAt
        ? thread.createdAt.toDate().toLocaleString()
        : '時間未知';

    const card = document.createElement('div');
    card.className = 'thread-card';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${thread.role} - ${thread.author} | 目標對象：${thread.childAge} 歲 ${thread.childGender}孩童 | 發布時間：${timeString}`;

    const tags = document.createElement('div');
    tags.className = 'tags';
    tags.textContent = (thread.hashtags || []).map(tag => `#${tag}`).join(' ');

    const content = document.createElement('p');
    content.style.whiteSpace = 'pre-wrap';
    content.textContent = thread.content;

    card.appendChild(meta);
    card.appendChild(tags);
    card.appendChild(content);
    return card;
}

loadThreads();
