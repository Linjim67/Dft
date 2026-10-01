/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — Firebase（ES module）
   與先前版本相同：Firebase Web SDK 10.12.2 + 匿名登入。
   ═══════════════════════════════════════════════════════════════ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, addDoc, serverTimestamp,
  doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, Timestamp, connectFirestoreEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, signInAnonymously, connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

/* Firebase 的「用戶端」設定不是機密金鑰，本來就會送到每個瀏覽器；
   真正的存取控制在 firestore.rules。來源：settings.txt */
const firebaseConfig = {
  apiKey: 'AIzaSyAgojah0JPnyrPjPan1GfRhRBO52abkgBE',
  authDomain: 'dftt-48e02.firebaseapp.com',
  projectId: 'dftt-48e02',
  storageBucket: 'dftt-48e02.firebasestorage.app',
  messagingSenderId: '144394925297',
  appId: '1:144394925297:web:44b9be77dcd2117f34a550'
};

/* 本機測試用：只有在 localhost 而且 localStorage 'anxin.emulator' = '1' 時，才連到本機模擬器
   （demo- 開頭的專案不會碰到正式資料庫）。正式網站永遠不會走這條路。 */
const EMULATOR = ['localhost', '127.0.0.1'].includes(location.hostname) && (() => {
  try { return localStorage.getItem('anxin.emulator') === '1'; } catch (e) { return false; }
})();

const app = initializeApp(EMULATOR ? { ...firebaseConfig, projectId: 'demo-anxin' } : firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
if (EMULATOR) {
  connectFirestoreEmulator(db, '127.0.0.1', 8089);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

/* 需在 Firebase Console > Authentication > Sign-in method 開啟「匿名」，
   否則 firestore.rules 要求的 request.auth != null 無法成立。
   可重試：醫院 wifi 不穩，第一次登入失敗不該讓頁面永遠無法送出。 */
let pending = null;

export function ensureAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (!pending) {
    pending = signInAnonymously(auth)
      .then((cred) => cred.user)
      .finally(() => { pending = null; });
  }
  return pending;
}

/* 頁面一載入就先登入，家長按送出時通常已經好了 */
ensureAuth().catch((err) => {
  console.warn('匿名登入暫時失敗，送出時會再試一次：', err);
});

/* payload 由 Anxin.buildFeedbackPayload 產生（已排除暱稱）；時間戳記由伺服器決定 */
export async function submitFeedback(payload) {
  await ensureAuth();
  return addDoc(collection(db, 'feedback'), { ...payload, createdAt: serverTimestamp() });
}

/* ─────────────────────────────────────────────────────────────
   雙機（#07）：rooms/{代碼}
   - 房間文件：家長建立（只放年齡、模式、選的遊戲），孩子的手機加入時寫入自己的 uid
   - cmds/{id}：家長 → 孩子（放角色、事件）；每一筆一份文件，不會互相搶寫
   - state/child：孩子 → 家長（棋盤、分數、時間），單一文件覆寫
   這裡只做資料進出；規則與畫面邏輯在一般 script（可測試）與 firestore.rules。
   時間欄位一律轉成毫秒數字再交給頁面。
   ───────────────────────────────────────────────────────────── */

const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v);
const roomRef = (code) => doc(db, 'rooms', code);

function roomFrom(snap) {
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    ...d,
    expiresAt: toMs(d.expiresAt),
    createdAt: toMs(d.createdAt),
    request: d.request ? { ...d.request, at: toMs(d.request.at) } : null
  };
}

/* 先登入再訂閱；回傳的函式可以取消（登入還沒好也可以） */
function watch(start) {
  let stop = () => {};
  let cancelled = false;
  ensureAuth().then(() => { if (!cancelled) stop = start(); }, (err) => start.onError && start.onError(err));
  return () => { cancelled = true; stop(); };
}

const duo = {
  async uid() {
    return (await ensureAuth()).uid;
  },

  async getRoom(code) {
    await ensureAuth();
    return roomFrom(await getDoc(roomRef(code)));
  },

  /* data.expiresAt 是毫秒；createdAt 由伺服器決定 */
  async createRoom(code, data) {
    await ensureAuth();
    return setDoc(roomRef(code), {
      ...data,
      expiresAt: Timestamp.fromMillis(data.expiresAt),
      createdAt: serverTimestamp()
    });
  },

  /* request 的時間由伺服器決定 */
  async updateRoom(code, patch) {
    await ensureAuth();
    const p = { ...patch };
    if (p.request) p.request = { ...p.request, at: serverTimestamp() };
    if (typeof p.expiresAt === 'number') p.expiresAt = Timestamp.fromMillis(p.expiresAt);
    return updateDoc(roomRef(code), p);
  },

  watchRoom(code, cb, onError) {
    const start = () => onSnapshot(roomRef(code), (s) => cb(roomFrom(s)), onError);
    start.onError = onError;
    return watch(start);
  },

  /* 文件 id 先在本機產生：家長畫面可以馬上標示「放置中」，孩子回報時用同一個 id 對應 */
  sendCmd(code, cmd) {
    const ref = doc(collection(db, 'rooms', code, 'cmds'));
    const done = ensureAuth().then((u) => setDoc(ref, { ...cmd, by: u.uid, at: serverTimestamp() }));
    return { id: ref.id, done };
  },

  /* 只交出「開始聽之後」才出現的指令：第一次從伺服器拿到的那批（舊的）直接略過，
     孩子的手機晚打開時，不會一口氣執行一堆過期的指令 */
  watchCmds(code, cb, onError) {
    const start = () => {
      let primed = false;
      const q = query(collection(db, 'rooms', code, 'cmds'),
        where('at', '>=', Timestamp.fromMillis(Date.now() - 120000)));
      return onSnapshot(q, (snap) => {
        if (!primed) {
          if (!snap.metadata.fromCache) primed = true;
          return;
        }
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'added') cb({ id: ch.doc.id, ...ch.doc.data(), at: toMs(ch.doc.data().at) });
        });
      }, onError);
    };
    start.onError = onError;
    return watch(start);
  },

  async setState(code, state) {
    await ensureAuth();
    return setDoc(doc(db, 'rooms', code, 'state', 'child'), { ...state, at: serverTimestamp() });
  },

  watchState(code, cb, onError) {
    const start = () => onSnapshot(doc(db, 'rooms', code, 'state', 'child'), (s) => {
      cb(s.exists() ? { ...s.data(), at: toMs(s.data().at) } : null);
    }, onError);
    start.onError = onError;
    return watch(start);
  }
};

/* 給一般 <script> 用的橋：頁面邏輯維持非 module（可測試），
   gstatic 被擋或太慢時，表單照樣顯示，只是送出時會得到明確的錯誤。 */
window.AnxinFirebase = { submitFeedback, ensureAuth, duo };
window.dispatchEvent(new Event('anxin:firebase'));
