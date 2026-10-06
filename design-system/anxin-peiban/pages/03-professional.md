# 03 醫護端 + 暫時代碼 — page overrides

Inherits MASTER. Covers `/pro/`, the code claim in `/` (#01), the code chip on `/shot/` and `/home/`,
and the Firestore `codes`, `staff`, `staffFeedback` collections.

## Temporary code — unique by construction

The old code was `djb2(nickname|age|gender|time) % 10000`, stored only on the parent's phone. A hash
cannot make 4 digits unique: by the birthday bound, ~118 families in one 24 h window give a 50% chance
of a duplicate (~12% at 50 families), and nothing would notice. The 醫檢師 also had nothing to look up.

Now every code has a lock document, `codes/{code}`, and claiming it is one Firestore transaction:

1. `Anxin.codes.random()`: `crypto.getRandomValues`, rejection-sampled so 0000–9999 are equally likely.
2. `tx.get(lock)`. If it is free, write the lock and `codes/{code}/private/profile` in the same transaction.
   If it is taken, try another code (up to 8; with 10 000 codes this practically never loops).
3. If two phones race for the same code, Firestore aborts the later transaction and reruns it, and the
   rerun sees the code as taken. Verified with 10 concurrent claims (exactly one wins) and with 200
   sequential families (200 distinct codes).

The rules are the second guarantee. Create succeeds only on an empty lock; overwrite succeeds only when
`expiresAt < request.time`. The lock and the profile must appear together (`existsAfter`, plus
`lock.createdAt == request.time`), so a lookup that finds a code always finds its data.

**A code is never reissued inside its 24 h window, even after it is done.** The parent's duo room
(`rooms/{code}`) and local game progress use the same number until `expiresAt`. Reissuing early would
put two families on one room. The client waits a further 10 minutes after expiry
(`CODE_REUSE_MARGIN_MS`) to absorb phone clock skew. 10 000 codes per day is far above clinic volume.

Profiles are stored under `anxin.profile.v2`. v1 profiles held unregistered codes that could collide, so
`load()` deletes them and the parent fills in the form again.

## When the code expires

- **Done**: the 醫檢師 submits feedback. One batch does three things, all or nothing:
  create `staffFeedback/{code}-{claimMillis}`, set the lock to `done`, delete the private profile.
  The rules tie the three together: no `done` without that feedback document, and no feedback without `done`.
- **Expired**: 24 h after the claim. Lookups show 已過期, staff can't finish it, and a new family can claim it.

Lookup states (`Anxin.codes.state`): missing / active / done / expired, each with its own message.

Parent side: `/shot/` shows the code (the parent hands it over there). When the 醫檢師 submits, the
parent's phone switches to the **打針完畢 page** on its own; see `03-shot-feedback.md`.
`/home/` greys the code card once the parent has seen that page.

## Staff login

- The password never leaves the phone. `/pro/` derives `key = PBKDF2-SHA256(pw, 'anxin-staff-v1', 600 000, 32 B)`
  with Web Crypto and writes only `key` to `staff/{uid}`.
- The rules hold only `SHA-256(key)` and compare with `hashing.sha256(key)`. No password or key is
  stored in client JS. A wrong password is a `permission-denied`.
- ⚠️ `firestore.rules` is tracked in a **public** repo despite the `.gitignore` entry, so the hash is public.
  That is safe only if the password survives an offline attack. PBKDF2 at 600k iterations makes a long
  passphrase infeasible to crack, but a short numeric PIN falls within hours. Alternatively, untrack the file.
- Session lasts 12 h, enforced by the server (`expiresAt < now + 13h`). Reloading keeps the session,
  and 登出 deletes the doc. Every staff read and write checks `isStaff()`, which requires a live session doc.
- Current password: `123456`. To change it, run the one-liner in the comment above `validStaffSession`,
  paste the hash into the rules, and publish. Use a passphrase for real use (see the warning above).

## /pro/ layout — three layouts, one page, same flow

Context: the blood-draw counter. Staff may be on a phone, a touch tablet or a PC, see many children per
shift, and glance at the screen between tasks. `ui-ux-pro-max --design-system` returned no verified match,
so the page keeps MASTER's tokens. **Copy is minimal by request**: labels say what a thing is, and
nothing narrates what the UI already shows (no ledes, no step guide, 「XXXX 查無」 with no body).

| | Phone (< 56rem) | Touch tablet (≥ 56rem, coarse pointer) | **PC** (≥ 64rem + hover + fine pointer) |
|---|---|---|---|
| Code entry | 4 slots + on-screen keypad | same, left column | 4 compact slots in a sticky top toolbar; **no keypad** |
| Case | one phase at a time; keypad folds away behind 「‹ 換代碼」 | beside the keypad | ① card and ② rating **side by side**, fits 1440×900 without scrolling |
| After 送出 | done card + 「下一位」 | same | one-line 「XXXX 已送出」 banner; cursor back in the code box |
| 最近完成 | below results (hidden when empty) | left column | right sidebar, always shown (「—」 when empty) |

Keyboard handling on any mouse device (`(hover: hover) and (pointer: fine)`), so staff only reach
for the mouse to pick a face:
- **No clicking the code area first, and no text box takes focus.** Taiwanese PCs usually run the 注音
  IME, and inside a focused text box it turns the number row into bopomofo (1 → ㄅ, 5 → ㄓ). So the
  whole document listens for keys instead, and with no text field focused the IME stays out of the
  way. When the IME still intercepts (`key === 'Process'`), the physical `code` (Digit5 / Numpad5) is used.
- The overlay `<input>` gets `pointer-events: none` and `tabindex=-1` here. Clicking the slots draws no
  focus frame (by request); the active slot's thick border and blinking caret are the "type here" cue.
- Digits go to the code from anywhere except text fields (note textarea, password): radios, buttons
  and the page body all count. ⌫ deletes, Esc clears, Enter re-queries, Ctrl+V pastes (non-digits dropped).
- `focusEntry()` releases focus rather than taking it. After login, after sending and after Esc,
  nothing is left focused on a hidden field that would swallow keys.
- Ctrl/⌘+Enter sends from anywhere in the form. The kbd hints appear only in the PC layout.
- When a case opens, focus stays put, so a typo can be retyped at once. The live region announces the
  case. Touch layouts move focus to ① instead.

Shared by all three:
- **Staff mode bar**: a sticky dark bar with 醫護端, 「登入至 HH:MM」 and 登出 (48px).
- **Patient card**: 「3 歲半 · 女孩」 → **特別注意** (wash + warning icon; collapses to one line,
  「特別注意 無」, when empty) → fear and worry as 5-segment meters with text.
- **The question quotes the parent** (spec): 「家長說『蠻害怕』，實際呢？」. A compare note follows the
  pick: 「比家長低 2 級」, 「同家長」 or 「比家長高 N 級」.
- **No confirm window** (removed by request): 送出 sends at once. The footnote 「送出後代碼即失效」 stays.
  The only remaining dialog guards against data loss: switching codes with an unsent rating asks
  「XXXX 還沒送出」 → 「回到 XXXX」 / 「放棄」.
- Password show/hide toggle. The note counter reads 「n / 500」.

### The comparison scale (spec: shallow fill vs thicker, deeper border)

Uses the same captions as #01's fear question (`Anxin.FEAR_CAPTIONS`), so the two answers compare 1:1.

| Mark | Visual | Non-colour cue |
|---|---|---|
| Parent's answer | `--primary-wash` fill, dashed border | 「家長」 tag inside the label, so it is read aloud as 「蠻害怕 家長」 |
| 醫檢師's choice | 2px inset + 1px border in `--fg` (darker than #01's `--primary-deep`), no fill change | check badge, top-right |

The 醫檢師's choice does not change the fill. When both pick the same option, the shading and the
thick border show together.
Caption on the shaded option uses `--fg-muted`: `--idle` measured 4.19:1 on the wash.

The question quotes the parent: 「家長覺得孩子『蠻害怕』，您實際觀察到的呢？」

## Data — staffFeedback

`{ staffFear, parentFear, note ≤500, profile: { age, gender, worryLevel }, scaleVersion: 'staff-v1', createdAt }`.
`parentFear` and `profile` are checked against the stored profile by the rules, so staff can't alter
them. There is no nickname anywhere: the 醫檢師 asks the child directly. The note field reminds staff
not to type names. The collection is create-only and readable by nobody, the same as parent feedback.

## Console steps (not deployed by Vercel)

1. **Publish `firestore.rules`.** Until then #01 cannot claim codes; the parent sees a setup message, not a network one.
2. Anonymous auth must stay enabled (staff use it too).
3. Optional: a Firestore TTL policy on the `private` collection group's `expiresAt` field, so profiles of
   codes that were never finished are deleted automatically.
