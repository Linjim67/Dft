/* ═══════════════════════════════════════════════════════════════
   安心陪伴 — Firebase（ES module）
   與先前版本相同：Firebase Web SDK 10.12.2 + 匿名登入。
   ═══════════════════════════════════════════════════════════════ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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

/* 給一般 <script> 用的橋：頁面邏輯維持非 module（可測試），
   gstatic 被擋或太慢時，表單照樣顯示，只是送出時會得到明確的錯誤。 */
window.AnxinFirebase = { submitFeedback, ensureAuth };
window.dispatchEvent(new Event('anxin:firebase'));
