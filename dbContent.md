# Firestore data structure

Firebase project `dftt-48e02` (Cloud Firestore + Anonymous Auth).

- Every visitor signs in anonymously, so every `uid` below is an anonymous uid. A "staff" user is just an anonymous uid that currently has a valid `staff/{uid}` doc.
- All reads and writes go through [shared/firebase.js](shared/firebase.js). The server-side validation is in [firestore.rules](firestore.rules). The payload builders are in [shared/app.js](shared/app.js). If a payload changes, update all three together.
- Local testing: on `localhost` with `localStorage['anxin.emulator'] = '1'`, the app uses the emulator (`demo-anxin`, Firestore `127.0.0.1:8089`, Auth `127.0.0.1:9099`) instead of the real database.

## Overview

```
codes/{code}                          4-digit temporary code (lock)
  └─ private/profile                  child profile for the 醫檢師
staff/{uid}                           staff login session
staffFeedback/{code}-{claimMs}        醫檢師 feedback after the shot
feedback/{autoId}                     parent feedback form
rooms/{code}                          two-phone game room
  ├─ cmds/{autoId}                    parent → child commands
  └─ state/child                      child → parent game snapshot
circleDays/{YYYYMMDD}                 (no fields: the doc is never written)
  └─ scores/{uid}                     draw-a-circle daily best score
threads/{autoId}                      discussion post (#04, not built yet)
  └─ replies/{autoId}                 reply
```

| Collection | Written by | Readable by | Page |
|---|---|---|---|
| `codes` | parent's phone (claim), staff (finish) | anyone signed in, one code at a time; only staff can list | 01 個人資訊, 03 醫護端 |
| `codes/*/private` | parent's phone (claim) | staff only, while the code is active | 03 醫護端 |
| `staff` | staff page | that uid only | 03 醫護端 |
| `staffFeedback` | staff | **nobody** (Console / Admin SDK only) | 03 醫護端 |
| `feedback` | parent's phone | **nobody** (Console / Admin SDK only) | 03 回饋 |
| `rooms` | parent's phone; child's phone joins | anyone signed in, one code at a time | 07 雙機 |
| `rooms/*/cmds` | parent | room members | 07 雙機打地鼠 |
| `rooms/*/state` | child | room members | 07 雙機打地鼠 |
| `circleDays/*/scores` | each phone, its own doc only | anyone signed in | 07 畫圓圈 |
| `threads`, `replies` | nothing yet | public | 04 討論區 |

## Shared conventions

- **Timestamps** are Firestore `Timestamp`s. `createdAt`, `at` and `doneAt` always come from `serverTimestamp()`; the rules check `== request.time`. `expiresAt` comes from the phone's clock. `shared/firebase.js` converts every timestamp to milliseconds before passing it to a page.
- **Level**: an integer from 1 to 5.
- **age**: a number from 0 to 18, in 0.5 steps up to 6 and whole years after that.
- **gender**: `'男'` or `'女'`.
- **code**: a 4-digit string (`^[0-9]{4}$`), e.g. `"0427"`. The same number is used as the doc id in both `codes/` and `rooms/`.
- **No nickname, ever.** The rules list the allowed keys (`keys().hasOnly([...])`), so the server rejects any doc with a nickname or any other extra field. Free-text fields have the nickname replaced with `孩子` before upload (`Anxin.scrubNickname`).

---

## `codes/{code}`

The lock for one 4-digit temporary code: who holds it, its status and when it expires. It contains no personal data.

| Field | Type | Value |
|---|---|---|
| `v` | number | `1` |
| `code` | string | same as the doc id |
| `holderUid` | string | uid of the parent's phone that claimed it |
| `status` | string | `'active'`, then `'done'` |
| `expiresAt` | Timestamp | claim time + 24 h, from the phone's clock (the rules allow at most + 2 days) |
| `doneAt` | Timestamp \| null | `null` until the staff finishes the code, then server time |
| `createdAt` | Timestamp | server time of the claim |

**Lifecycle**

1. **Claim** (01 個人資訊). One transaction writes the lock and `private/profile` together. It succeeds only if the doc doesn't exist or the previous `expiresAt` has passed. The client also waits an extra 10 minutes (`Anxin.codes.REUSE_MARGIN_MS`) and tries up to 8 random codes.
2. **Staff list** (03 醫護端 「等待中」). The query is `where('expiresAt', '>', now)`. The page itself decides between active, done and expired.
3. **Finish** (staff submits feedback). This is one batch with three writes: create `staffFeedback/…`, set `status: 'done'` and `doneAt`, and delete `private/profile`. Only `status` and `doneAt` can change.
4. **Parent's phone** listens to its own lock. When `status` becomes `done`, the phone goes to `/shot/?done=1`.
5. A `done` code is not reissued before its `expiresAt`, because `rooms/{code}` uses the same number.

**When a number is reused**

Two families never hold the same code at the same time. After a code expires, a new family can get the same number. This is what happens to the old family's data:

| Path | Old family's data |
|---|---|
| `codes/{code}` | Overwritten by the new claim. Nothing records that the earlier claim happened, except its `staffFeedback` doc if staff finished it. |
| `codes/{code}/private/profile` | Already deleted if staff finished the code. Otherwise the TTL policy removes it (see the next section); without that policy it stays until the new claim overwrites it. |
| `staffFeedback/{code}-{claimMs}` | Kept, and no collision is possible: every claim has a different `claimMs`. |
| `rooms/{code}` | Overwritten when the new parent opens 雙機. `childUid` goes back to `null`, so the old child's phone stops. |
| `rooms/{code}/cmds`, `state/child` | Kept, because overwriting a doc doesn't delete its subcollections. The child only runs commands from the last 2 minutes. The parent's remote ignores any `state/child` older than the room's `createdAt`. |
| `feedback`, `circleDays` | Not affected: they aren't keyed by code. |

A phone whose clock is more than 10 minutes fast can think an expired code is free before the server agrees. The server rejects that claim, and `tryClaim` treats the rejection as "taken" and moves on to the next random code. A rejection on a code that has never been used is a real setup problem, so that error still reaches the page.

## `codes/{code}/private/profile`

The child profile shown to the 醫檢師. The doc id is always `profile`. It is written only in the claim transaction and deleted in the finish batch. It is built by `Anxin.codes.buildProfile`.

If staff never finishes the code, the profile is deleted by a Firestore **TTL policy** on collection group `private`, field `expiresAt`, usually within about a day after it expires. That policy is set in the Firebase Console (Firestore → Time-to-live), not in this repo. Without it, the profile stays (unreadable) until the number is claimed again.

| Field | Type | Value |
|---|---|---|
| `age` | number | 0–18 |
| `gender` | string | `'男'` / `'女'` |
| `fearLevel` | level | 小孩會害怕抽血嗎: 1 完全不會 … 5 非常害怕 |
| `worryLevel` | level | 家長會擔心嗎: 1 完全不會 … 5 非常擔心 |
| `specialNeeds` | string | ≤ 200 chars, may be `''` |
| `expiresAt` | Timestamp | must equal the lock's `expiresAt` |

## `staff/{uid}`

A staff login session. The password never leaves the phone: the page derives a key from it, and the rules accept the doc only if SHA-256 of that key matches the hash stored in the rules. A uid counts as staff (`isStaff()` in the rules) when this doc exists and `expiresAt > now`.

| Field | Type | Value |
|---|---|---|
| `key` | string | 64 hex chars: PBKDF2-SHA256(password, `'anxin-staff-v1'`, 600 000 rounds, 32 bytes) |
| `at` | Timestamp | server time of sign-in |
| `expiresAt` | Timestamp | sign-in + 12 h (`SESSION_MS` in `pro/pro.js`; the rules allow at most 13 h) |

The doc is deleted on sign-out. Only its own uid can read or delete it, and it cannot be listed.

## `staffFeedback/{code}-{claimMs}`

The 醫檢師's rating of how afraid the child actually was, compared with what the parent said. It can be created but never read, updated or deleted by any client. It is built by `Anxin.buildStaffFeedback`.

Doc id = `code + '-' + lock.createdAt` in milliseconds, e.g. `0427-1791234567890`, so there is at most one per claim. The id matches the lock's `createdAt`. That joins it to `codes/{code}` only until the code is claimed again, because a new claim overwrites the lock.

| Field | Type | Value |
|---|---|---|
| `staffFear` | level | the 醫檢師's own judgment: 1 完全不會 … 5 非常害怕 |
| `parentFear` | level | the parent's `fearLevel`; the rules check it matches `private/profile` |
| `note` | string | ≤ 500 chars, optional |
| `profile` | map | `{ age, gender, worryLevel }`; the rules check it matches `private/profile` |
| `scaleVersion` | string | `'staff-v1'` |
| `createdAt` | Timestamp | server time |

## `feedback/{autoId}`

The parent's feedback form (03 → 回饋). It can be created but never read, updated or deleted by any client. It is built by `Anxin.buildFeedbackPayload`.

It has **no code and no nickname**, so a `feedback` doc cannot be linked to a code or to a `staffFeedback` doc.

| Field | Type | Value |
|---|---|---|
| `satisfaction` | level | 對醫護人員滿意度: 1 很不滿意 · 2 不滿意 · 3 普通 · 4 滿意 · 5 非常滿意 |
| `satisfactionReason` | string | ≤ 500 chars |
| `cryLevel` | level | 小孩實際的哭鬧程度: 1 很平靜 · 2 有點緊張 · 3 小哭一下 · 4 哭得明顯 · 5 大哭大鬧 |
| `effectiveness` | level | 是否有效緩解緊張: 1 非常無效 · 2 無效 · 3 普通 · 4 有效 · 5 非常有效 |
| `suggestion` | string | ≤ 1000 chars |
| `profile` | map | `{ age, gender, fearLevel, worryLevel, specialNeeds }`, same types as `private/profile` |
| `scaleVersion` | string | `'balanced-v1'` (balanced 5-point scale with 普通 in the middle) |
| `createdAt` | Timestamp | server time |

## `rooms/{code}`

Pairs the parent's phone with the child's phone for two-phone games. The doc id is the parent's 4-digit code. It holds only the age, which sets the game speed, and no other personal data. It is built by `AnxinDuo.newRoom` ([games/duo/duo-core.js](games/duo/duo-core.js)).

| Field | Type | Value |
|---|---|---|
| `v` | number | `1` |
| `code` | string | same as the doc id |
| `age` | number | 0–18 |
| `parentUid` | string | the parent's phone |
| `childUid` | string \| null | the child's phone, after it scans the QR code |
| `mode` | string | `'manual'` (the parent places the characters) / `'auto'` |
| `game` | string \| null | the game being played: `null` or `'whack-a-mole'` |
| `request` | map \| null | `{ game: 'whack-a-mole', status: 'pending' \| 'accepted' \| 'rejected', at: Timestamp }` |
| `expiresAt` | Timestamp | same as the profile's `expiresAt` (claim + 24 h) |
| `createdAt` | Timestamp | server time |

**Who can change what**

- **Parent**: `mode`, `game`, `request` (accept or reject), `childUid` (clear it only, i.e. unpair), `age`, `expiresAt`.
- **Child**: only `request`, and only with `status: 'pending'`.
- **Joining phone**: if `childUid` is `null`, it can set `childUid` to its own uid.
- **Anyone**: if the room has expired (`expiresAt < now`), it can be created again from scratch, e.g. when another family gets the same code the next day.

### `rooms/{code}/cmds/{autoId}`

Commands from the parent to the child. One doc per command, and commands are never changed. The id is generated on the phone so the parent's screen can show "放置中" right away; the child's `ack.id` refers back to it. There are two shapes:

| `t` | Other fields |
|---|---|
| `'place'` | `h`: hole 0–5 · `c`: `'tourniquet'` \| `'swab'` \| `'syringe'` \| `'virus'` · `v`: `'normal'` \| `'silver'` \| `'iron'` |
| `'event'` | `e`: `'invasion'` \| `'boss'` \| `'quake'` \| `'bubbles'` \| `'double'` |

Both shapes also have `by` (the parent's uid) and `at` (server time). The child only runs commands whose `at` is within the last 2 minutes, and it skips the first batch it gets when it starts listening. The rules let the parent delete commands, but the code never does, so they pile up under the room.

### `rooms/{code}/state/child`

A single doc holding the child's game screen, which the child overwrites at most every 600 ms (`STATE_THROTTLE_MS`). It is built by `snapshot()` in [games/whack-a-mole/whack-a-mole.js](games/whack-a-mole/whack-a-mole.js). The parent's remote ignores a snapshot whose `at` is older than the room's `createdAt`, which means it was left over from a previous family.

| Field | Type | Value |
|---|---|---|
| `v` | number | `1` |
| `view` | string | `'intro'` \| `'play'` \| `'quiz'` \| `'summary'` |
| `running` | bool | |
| `round` | int | 1–999 |
| `time` | int | seconds left, 0–30 |
| `score` | int | ≥ 0 |
| `mult` | number | current streak multiplier |
| `holes` | list (≤ 6) | `{ o: open?, c: character id \| null, v: variant \| null (also 'boss'), b: has bubble?, p: HP % }` |
| `inv` | int | seconds left in a virus invasion, 0 = none |
| `boss`, `quake`, `dbl` | bool | event flags |
| `bubbles` | int | bubble count |
| `mode` | string | `'manual'` / `'auto'` |
| `teach` | bool | the virus tutorial dialog is open |
| `ack` | map \| null | `{ id: cmd doc id, ok: bool, why: string \| null }`, the result of the last command |
| `at` | Timestamp | server time |

## `circleDays/{YYYYMMDD}/scores/{uid}`

The draw-a-circle daily leaderboard. Each phone has one doc per day holding only its best score, with no name. `{YYYYMMDD}` is the Taiwan (UTC+8) date (`CircleScore.dayKey`). The `circleDays/{day}` doc itself is never written; the Console shows it in italics.

| Field | Type | Value |
|---|---|---|
| `score` | int | 0–100 |
| `at` | Timestamp | server time |

- A phone can write only its own doc, only for today, and only with a higher score than before. Nobody can delete scores.
- The page reads the top 3 (`orderBy('score', 'desc')`, `limit(3)`) plus its own doc.

## `threads/{autoId}` (#04 討論區, not built yet)

The rules exist but no current code reads or writes this collection: [discussion/](discussion/) is a placeholder page.

**Current rules on create.** These are required fields only, not a whitelist, so extra fields such as `createdAt` are allowed.

| Field | Rule |
|---|---|
| `role` | `'家長'` \| `'醫師'` \| `'護士'` \| `'醫檢師'` \| `'其他'` |
| `author` | string ≤ 50 (anonymous is allowed) |
| `content` | string, 1–2000 chars |
| `members` | list of 1–8 items, one per child; the item shape is not fixed yet (spec: age or age range + gender) |
| `hashtags` | list of ≤ 5 items |
| `clicks`, `replyCount`, `dwellMs` | must be `0` |

After creation, only `clicks`, `dwellMs`, `replyCount` and `lastActivityAt` can be updated, for ranking by engagement. The rules don't check that these counters only increase. Threads cannot be deleted.

**Old docs.** The first prototype (Aug 2026, `script.js`) wrote a different shape: `role`, `childAge` (0–12), `childGender` (`'男'` \| `'女'` \| `'不指定'`), `hashtags`, `author`, `content`, `createdAt`. Docs from that version, if any are still in the database, have no `members` or counters.

### `threads/{id}/replies/{autoId}`

| Field | Rule |
|---|---|
| `content` | string, 1–1000 chars |
| `author` | string ≤ 50 |

No other fields are checked. Replies cannot be updated or deleted.

---

## Indexes

Every query filters or sorts on a single field, so no composite indexes are needed:

- `codes`: `expiresAt >`
- `rooms/{code}/cmds`: `at >=`
- `circleDays/{day}/scores`: `orderBy score desc, limit 3`

## Kept on the phone, not in Firestore

- `localStorage['anxin.profile.v2']`: the full profile, **including the nickname** and the code. It is dropped after 24 h. This is the only place the nickname is stored.
- `localStorage['anxin.shotDone.v1']`: the code whose 「打針完畢」 page has already been shown.
- The other `anxin.*` keys are per-phone game progress, drafts and UI state.
