# Firebase 設定步驟（需在 Firebase Console 手動操作一次）

這個網站是純前端（`index.html` + `script.js`），直接透過 Firebase Web SDK 讀寫 Firestore，
不需要另外架設或維運後端伺服器。要讓它正常運作，請在 Firebase Console 完成以下設定：

## 1. 建立 Firestore 資料庫（如果還沒建立）
Firebase Console > Build > Firestore Database > 建立資料庫。

## 2. 啟用「匿名登入」
Authentication > Sign-in method > 新增登入提供者 > **匿名**，開啟即可。
`script.js` 會在頁面載入時自動呼叫 `signInAnonymously()`；
這不會出現任何登入畫面，使用者完全無感，只是讓 Firestore 規則能判斷「這是一個由網站送出的請求」。

## 3. 發布 Firestore 安全規則
把 [firestore.rules](firestore.rules) 的內容貼到 Firestore Database > 規則，按發布。
（或用 CLI：`firebase deploy --only firestore:rules`，需先 `firebase init`。）

這組規則會在伺服器端擋掉：
- 未登入的寫入請求
- 缺欄位 / 多餘欄位
- 角色、性別不在允許清單內
- 年齡不在 0–12 之間
- 內容超過 2000 字、作者名稱超過 50 字
- 任何人嘗試修改或刪除已發布的文章

## 4. 第一次篩選查詢時，Firestore 可能會要求建立複合索引
`script.js` 的篩選功能會同時用到「等於篩選」+「依時間排序」，Firestore 有時需要對應的複合索引。
如果瀏覽器主控台（F12 > Console）出現類似
`The query requires an index` 的錯誤，訊息裡會附一個連結，點下去就能一鍵建立索引，等個一兩分鐘即可。

## 5. 部署網站
因為現在完全是靜態檔案，可以直接用 Firebase Hosting（`firebase deploy --only hosting`）、
GitHub Pages，或任何靜態網頁空間，不需要 Node.js 執行環境。

---

## 關於濫用防護（誠實地說明限制）
Firestore 安全規則能驗證「這篇文章的內容格式對不對」，但沒辦法做到像 Express
`rate-limit` 那種「每個 IP 15 分鐘最多 5 篇」的機制（Firestore 規則看不到 IP）。
如果之後遇到洗版 / 濫用問題，建議方向（目前未實作，可以再請我加）：
- 啟用 **Firebase App Check**，阻擋非瀏覽器的自動化請求，是官方建議的做法。
- 或改用 Cloud Functions 作為唯一的寫入入口，在裡面做 IP 層級的限流。
