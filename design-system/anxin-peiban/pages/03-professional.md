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

Parent side: `/shot/` now shows the code (the parent hands it over there) and watches the lock live.
When the 醫檢師 submits, the chip flips to 「醫檢師已完成紀錄」. `/home/` reads it once and greys the
code card. Both check `holderUid` as well. If Firebase is unreachable, both pages keep their current state.

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

## /pro/ layout — a work station, not a form

Context: the blood-draw counter. Staff may wear gloves, see many children per shift, and glance at the
screen between tasks. `ui-ux-pro-max --design-system` returned no verified match (a landing-page
pattern, neumorphism, and the cyan palette with the `#A5F3FC` border MASTER already rejected), so the
page keeps MASTER's tokens. Verified UX rules applied: password visibility toggle, confirmation before
irreversible actions, and submit feedback → success state.

- **Staff mode bar**: a sticky dark (`--primary-ink`) bar with 醫護端, 「登入至 HH:MM」 and 登出 (48px).
  Nobody can mistake it for the parent app. On the dark bar the focus ring switches to `#FDBA74`,
  because `#C2410C` on ink is only 2.8:1.
- **Code entry**: four 76px slots plus an on-screen 3×4 keypad with 60px keys, which works with gloves.
  A real `<input inputmode="none">` sits transparent over the slots, so paste, physical keyboards and
  screen readers all work and the phone keyboard never covers the keypad. Digits typed while a keypad
  button has focus are routed into the code. The lookup fires on the 4th digit.
- **Phases** (`#deskView[data-phase]`: entry → case → done). On a phone the keypad folds away once a
  case opens, and a 「‹ 換代碼」 bar replaces it. At ≥ 56rem, grid areas place the keypad and recent list
  on the left and the case on the right, always visible together. The dashed empty state there doubles
  as a 3-step guide for new staff.
- **Patient card**, in reading order for a glance: 「3 歲半 · 女孩」 (1.7rem) → **特別注意** (wash + warning
  icon, no side stripe; muted 「家長沒有填寫」 when empty) → fear and worry as 5-segment meters with text
  (filled `#EA580C` vs track is 3.21:1).
- **Two numbered steps**: ① 打針前 (card) and ② 打完針後 (rating card). Focus moves to ① when a case opens.
- **Compare note**: once staff pick, a status line reads 「比家長估的低 2 級」, 「和家長估的一樣」 or
  「高 N 級」, with an arrow icon as well as the text.
- **Safety nets**: submit opens a confirm dialog that summarises both ratings and the note; the default
  focus is 「再看一下」. If a new code would discard an unsent rating, a dialog asks first; 「回到代碼」
  restores the code shown in the slots.
- **最近完成**: the last 5 codes sent from this device (code, rating, time; localStorage, 12 h, cleared on
  登出). Staff use it to confirm a submission went through. It sits after the result panel in the page
  order, so on a phone 「查無」 appears right under the keypad.
- On phones (≤ 30rem) the rating card's padding drops to 16px and the scale gap to 6px, so 「完全不會」 and
  「非常害怕」 stay on one line at 375px.

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
