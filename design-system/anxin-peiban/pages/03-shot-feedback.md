# 03 開始打針 + 回饋 — page overrides

Inherits MASTER. Covers `/shot/`, `/feedback/`, `/thanks/`, and the Firestore `feedback` collection.

## /shot/

Spec says "just a button", and that's right: the parent is holding a child with one hand. One line of
reassurance, one 68px-tall 打針完畢. Its dialog offers 給建議 / 離開 **plus** 「還沒打完」 — a phone has no Esc
key, and an accidental tap must not force a navigation.

## /feedback/ — questions

Same components as #01. Balanced 5-point scales with a neutral midpoint, chosen over the original skewed
wording (2 negative / 3 positive, no neutral) because skew biases research data toward positive answers.

| Key | Required | Captions | Faces |
|---|---|---|---|
| `satisfaction` | yes | 很不滿意 / 不滿意 / 普通 / 滿意 / 非常滿意 | reversed (frown → smile) |
| `satisfactionReason` | no | label re-renders: 「選擇『滿意』的原因為何？」 | — |
| `cryLevel` | yes | 很平靜 / 有點緊張 / 小哭一下 / 哭得明顯 / 大哭大鬧 | normal (calm → upset) |
| `effectiveness` | yes | 非常無效 / 無效 / 普通 / 有效 / 非常有效 | reversed |
| `suggestion` | no | — | — |

**Stored as numbers + `scaleVersion: 'balanced-v1'`**, never as labels. If wording changes, bump the
version (and the `in [...]` list in the rules) so old and new answers are never silently mixed.

## Privacy — enforced twice

1. **Client** — `Anxin.buildFeedbackPayload` (`shared/app.js`) is a pure whitelist. It never emits
   `nickname`, `code`, `createdAt` or `expiresAt`, and runs `scrubNickname` over **every** free-text field
   (`specialNeeds`, `satisfactionReason`, `suggestion`) — parents naturally write 「小恩上次暈針」.
   `split/join`, not regex, so nickname punctuation can't break it. A 1-char nickname over-scrubs; that is
   the safe failure.
2. **Server** — `firestore.rules` `keys().hasOnly()` on the doc *and* on `profile`. A document carrying
   `nickname` is rejected by Firestore itself, not merely omitted by well-behaved code.
   Create-only; read/update/delete denied to everyone. `createdAt == request.time` prevents backdating.

The two whitelists must stay identical — the verification suite diffs them.

The form's footer tells parents plainly what is uploaded (age, gender, earlier answers — no nickname).

## Firebase

`shared/firebase.js` is an ES module (SDK 10.12.2, anonymous auth) that also publishes
`window.AnxinFirebase` and fires `anxin:firebase`. Page logic stays a classic script and waits with
`Anxin.whenFirebase()`. This means a blocked or slow gstatic CDN still renders a working form that fails
*visibly* on submit, instead of a page whose script never loaded.

- `ensureAuth()` retries — a first sign-in failure on hospital wifi must not be permanent.
- **`addDoc` does not reject when offline; it waits for a connection.** Submission is raced against a
  15s timeout so the button can't sit on 「送出中…」 forever. Answers are kept on failure.
- One submission per profile code (`anxin.feedback.v1`); a revisit shows the sent state instead.
- After the thank-you dialog closes, focus moves to the sent heading. Without this, the browser returns
  focus to the submit button — which is inside the now-hidden form — and it falls to `<body>`.

## Console steps (not deployed by Vercel)

1. Publish `firestore.rules` in Firebase Console → Firestore → Rules.
2. Confirm Authentication → Sign-in method → **Anonymous** is enabled.
