/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — Firebase（ES module）
   與先前版本相同：Firebase Web SDK 10.12.2 + 匿名登入。
   ═══════════════════════════════════════════════════════════════ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, addDoc, serverTimestamp,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, Timestamp,
  runTransaction, writeBatch, connectFirestoreEmulator
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

/* ─────────────────────────────────────────────────────────────
   暫時代碼（#01 → 醫檢師）：codes/{代碼}
   - 鎖：誰拿著、狀態（active / done）、期限。沒有個人資料，登入的人都能用代碼讀單一張
   - private/profile：給醫檢師看的個人資料（不含暱稱），只有醫檢師讀得到
   規則（何時算空著、怎麼挑號碼）在 Anxin.codes；這裡只做資料進出。
   ───────────────────────────────────────────────────────────── */

const lockRef = (code) => doc(db, 'codes', code);
const codeProfileRef = (code) => doc(db, 'codes', code, 'private', 'profile');

function lockFrom(snap) {
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ...d, expiresAt: toMs(d.expiresAt), createdAt: toMs(d.createdAt), doneAt: toMs(d.doneAt) };
}

const codes = {
  /* 一筆交易：讀鎖 → isFree 說可以才連同個人資料一起寫入，回傳 true；有人在用回傳 false。
     兩支手機同時搶同一組時，Firestore 會讓晚到的那筆重跑，重跑時就會讀到已被佔用。
     profile 由 Anxin.codes.buildProfile 產生（expiresAt 是毫秒）。 */
  async tryClaim(code, profile, isFree) {
    const u = await ensureAuth();
    return runTransaction(db, async (tx) => {
      const lock = lockFrom(await tx.get(lockRef(code)));
      if (!isFree(lock, Date.now())) return false;
      const expiresAt = Timestamp.fromMillis(profile.expiresAt);
      tx.set(lockRef(code), {
        v: 1, code, holderUid: u.uid, status: 'active',
        expiresAt, doneAt: null, createdAt: serverTimestamp()
      });
      tx.set(codeProfileRef(code), { ...profile, expiresAt });
      return true;
    });
  },

  async getLock(code) {
    await ensureAuth();
    return lockFrom(await getDoc(lockRef(code)));
  },

  watchLock(code, cb, onError) {
    const start = () => onSnapshot(lockRef(code), (s) => cb(lockFrom(s)), onError);
    start.onError = onError;
    return watch(start);
  },

  /* 醫護端「等待中」：最近 24 小時領取的代碼（只有鎖，沒有個人資料），有變動就整批交出。
     只用 expiresAt 一個欄位篩選（單欄索引，不用另建複合索引）；
     active／done、是否已過期由頁面自己判斷。醫護人員才能列出（firestore.rules）。 */
  watchRecent(cb, onError) {
    const start = () => onSnapshot(
      query(collection(db, 'codes'), where('expiresAt', '>', Timestamp.now())),
      (snap) => cb(snap.docs.map(lockFrom)), onError);
    start.onError = onError;
    return watch(start);
  },

  /* 醫檢師才讀得到，而且代碼要還有效 */
  async getProfile(code) {
    await ensureAuth();
    const s = await getDoc(codeProfileRef(code));
    if (!s.exists()) return null;
    return { ...s.data(), expiresAt: toMs(s.data().expiresAt) };
  },

  /* 醫檢師送出回饋＝代碼失效，三件事同一批寫入，要嘛全部成功、要嘛全部沒發生：
     回饋存進 staffFeedback、鎖標成 done、個人資料刪掉。
     回饋的文件 id = 代碼-領取時間，一次領取只能有一份回饋。 */
  async finish(code, lock, payload) {
    await ensureAuth();
    const batch = writeBatch(db);
    batch.set(doc(db, 'staffFeedback', code + '-' + lock.createdAt), { ...payload, createdAt: serverTimestamp() });
    batch.update(lockRef(code), { status: 'done', doneAt: serverTimestamp() });
    batch.delete(codeProfileRef(code));
    return batch.commit();
  }
};

/* ─────────────────────────────────────────────────────────────
   醫護人員登入：staff/{uid}
   密碼不會離開手機：頁面先用 PBKDF2 把密碼變成金鑰，這裡只寫入金鑰。
   伺服器規則比對金鑰的 SHA-256，對了才建得出這份文件；
   之後讀代碼個人資料、寫回饋，規則都靠「這個 uid 有沒有有效的 staff 文件」判斷。
   ───────────────────────────────────────────────────────────── */

const staff = {
  async session() {
    const u = await ensureAuth();
    const s = await getDoc(doc(db, 'staff', u.uid));
    if (!s.exists()) return null;
    return { expiresAt: toMs(s.data().expiresAt) };
  },

  async signIn(key, expiresAt) {
    const u = await ensureAuth();
    return setDoc(doc(db, 'staff', u.uid), {
      key, at: serverTimestamp(), expiresAt: Timestamp.fromMillis(expiresAt)
    });
  },

  async signOut() {
    const u = await ensureAuth();
    return deleteDoc(doc(db, 'staff', u.uid));
  }
};

/* ─────────────────────────────────────────────────────────────
   畫圓圈・每日排行榜（#07）：circleDays/{YYYYMMDD 台灣時間}/scores/{匿名 uid}
   每支手機每天一筆（只留最高分），只有分數和時間，沒有名字。
   哪一天、補預設分數、排名在 CircleScore（可測試）；這裡只做資料進出。
   ───────────────────────────────────────────────────────────── */

const circleScores = (day) => collection(db, 'circleDays', day, 'scores');

const circle = {
  /* 今天前三名（只有分數；mine = 是不是這支手機）＋這支手機今天的最高分 */
  async today(day) {
    const u = await ensureAuth();
    const [snap, me] = await Promise.all([
      getDocs(query(circleScores(day), orderBy('score', 'desc'), limit(3))),
      getDoc(doc(circleScores(day), u.uid))
    ]);
    return {
      top: snap.docs.map((d) => ({ score: d.data().score, mine: d.id === u.uid })),
      mine: me.exists() ? me.data().score : null
    };
  },

  /* 只會往上：交易裡先讀自己今天的分數，這次比較高才寫入。回傳今天的最高分 */
  async submit(day, score) {
    const u = await ensureAuth();
    const ref = doc(circleScores(day), u.uid);
    return runTransaction(db, async (tx) => {
      const cur = await tx.get(ref);
      if (cur.exists() && cur.data().score >= score) return cur.data().score;
      tx.set(ref, { score, at: serverTimestamp() });
      return score;
    });
  }
};

/* 給一般 <script> 用的橋：頁面邏輯維持非 module（可測試），
   gstatic 被擋或太慢時，表單照樣顯示，只是送出時會得到明確的錯誤。 */
window.AnxinFirebase = { submitFeedback, ensureAuth, duo, codes, staff, circle };
window.dispatchEvent(new Event('anxin:firebase'));
