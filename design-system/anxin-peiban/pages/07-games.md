# 07 小遊戲 — page overrides

Inherits MASTER. Covers `/games/solo/` (menu), `/games/whack-a-mole/` — (S) 打地鼠, the two-phone
(M) 打地鼠: `/games/duo/` (pairing), `/games/<code>/` (child's menu), `/games/<code>/whack-a-mole/`
(child's game) and `/games/duo/whack-a-mole/` (parent's remote), `/games/draw-circle/` — 畫圓圈, and
`/games/dash/` — (S) 膠囊衝衝衝 (the spec's "Geometry Dash").

## Routing

Spec: `/games/(auth code if needed)/what-game`. Single-player needs no code, so the game is
`/games/whack-a-mole/`; the child's phone in two-phone play uses `/games/<code>/whack-a-mole/`.
Those code URLs are **Vercel rewrites** (`vercel.json`) onto the real pages — the address bar keeps
the code, and the page reads it with `AnxinDuo.codeFromLocation` (local dev: `?code=1234`).
`/games/solo/` is the menu children pick from. Unbuilt games show as non-link cards with a
「即將推出」 badge (visible text, not only greyed-out).

「Mini mario」 is shown as **「跳跳冒險」** — "Mario" is a Nintendo trademark and this is a public site.
For the same reason 「Geometry Dash」 (RobTop Games) ships as **「膠囊衝衝衝」**.

## Files

| File | Role |
|---|---|
| `engine.js` | `window.WhackEngine` — **pure** rules, no DOM: spawn rate, weights, tiers, coatings, rewards, quiz selection, save/load. **Every tunable number is in `CONFIG`.** |
| `whack-a-mole.js` | Views, the rAF loop, pointer / hold-to-disinfect / keyboard input |
| `questions.json` | 小知識 bank |
| `index.html` | Views + an inline SVG sprite; characters are drawn once as `<symbol>`s |
| `duo-child.js` | Two-phone only: joins the room, boots the game with the room's age, applies the parent's commands, reports state |

## The spawn formula — interpreted as a RATE

Spec: `I(t) = 1 − ((t − 10)/20)²` (t = seconds left), `T(t) = (1 + #round/4) · I(t)`.

Taken literally as a period, `T(30) = 0` → a character every frame at the start of every round,
and `(1 + #round/4)` makes later rounds **slower**. Read as a rate, everything the spec describes
holds: calm start, faster through the countdown (peak at 20s in), a slight ease-off at the end,
and harder every round.

    rate      = (1 + min(round, 10)/4) · I(t)                     spawns / second
    interval  = max(250ms, 1000 / max(rate, 0.6) × 27 / (1 + age^1.5))

The age factor `27 / (1 + age^1.5)` (product owner's rule) slows young children down sharply:
×4.36 at age 3, ×1.72 at 6, ×0.96 at 9, ×0.35 at 18. It is 27 at age 0, so under ~3 the game is
very slow (a 45s gap at the start of a round) — acceptable, since toddlers aren't the players.
The `MIN_RATE` floor exists because `I(30) = 0`; without it each round opens with seconds of nothing.

## Rules as built

- **Weights** ∝ `max(100 − C_x, 10) × (1 + 5% × level)`, where `C_x` = lifetime catches of that
  character. Rarely-caught characters appear more — the game nudges children to collect all four.
- **Collection** counts characters *caught* (an iron one counts once, not three times).
- **Tiers** 10 / 50 / 100 make a character *eligible*; answering its 小知識 correctly is what
  actually levels it up.
- **Challenges are manual and unlimited.** As soon as a character reaches its threshold, **its
  collection card itself becomes the button** — on the start screen and the round summary — and
  any number can be challenged in one break. (Replaced the earlier "one automatic quiz per round",
  and later the separate 「挑戰小知識」 button inside the card.)
  - Ready card = a real `<button class="coll-item is-ready">`, **pale yellow #FEF9C3 + the 2px
    #C2410C inset border** (not colour alone); `aria-label`「止血帶：挑戰小知識，答對就升級」. No extra
    text in the card — the look is the hint. Contrast on the yellow: text 8.7:1, muted 7.1:1,
    border 4.8:1.
  - Cards that aren't ready (or are locked after a wrong answer, or waiting for the question bank)
    stay plain `<div>`s with a status line, and do nothing when tapped.
  - The line above the list says 「有 N 位角色可以挑戰小知識：點一下黃色的卡片！」.
- **Wrong** → that character is locked until *the next round ends*, then the *identical* question
  returns. Tracked with lifetime `roundsPlayed`, so it survives closing the page. Other characters
  stay challengeable. **The answer is not revealed on a wrong try**, or the retry would be
  meaningless. Leaving without answering (「先不要」) is not a failure.
- **Coatings unlock by level**: Lv1 silver · Lv2 + 金色大魔王 · Lv3 + iron. Each carries a text
  badge (×1.5 / ×2) — never colour alone. The 大魔王 has **no badge** (2026-10-05): its gold, the
  glow, the board's gold ring and the 「大魔王來了！」 callout already say it; screen readers still
  hear 「大魔王」 in the hole's label.
- **Point rewards** unlock automatically at lifetime-point thresholds (the same "reach a
  threshold" rule as collections): 停留更久 1.5k / 10k / 24k · 更多洞 4k / 16k · 更強的槌子 14k / 32k.
  Tuned by simulation so a perfect player earns about one reward per round through round 6,
  and a realistic child (slower, misses ~1 in 3) keeps earning into round 8.
- The hammer (更強的槌子) affects **taps** only — iron and 大魔王. Viruses are wiped by time, not HP.
- Infinity mode = rounds continue past 6, difficulty capped at round 10.
- No penalty for misses.

## Stay time — the formula, and why it needs attention

    stay = STAY_BASE_S / max(age, 1) × (1 + level) ÷ coat      coat: normal 1 · silver 2
    病毒 ×2 · iron ×1.6 (not in the formula; keeps the original "stays longer" rule)
    大魔王: fixed 8s (see below) · × 「停留更久」 reward · floor MIN_UP_MS = 550ms

Silver only unlocks at the level that cancels its divisor (Lv1 → 2/2), so **no character is ever
shorter than `STAY_BASE_S / age`**. `max(age, 1)` avoids `3 / 0`. (Gold's old ÷3 was dropped when
it became the boss: a third of the stay is far too short to tap 12–20 times.)

**⚠️ With the specified `STAY_BASE_S = 3` the game deadlocks.** `3/age` is shorter than a child's
see-and-tap time at every age, so normal characters are almost never caught; only the virus (×2) is.
Levelling is what lengthens stays, but levelling needs 10 catches first — so three of the four
characters stay at Lv0 forever. Simulated over six rounds (realistic reaction time per age,
1 tap in 4 missed, so ~75% is the ceiling):

| age | `3/age` (as specified) | `6/age` | `9/age` |
|---|---|---|---|
| 3 | 44% · 1/4 levelled | 76% · 3/4 | 76% · 3/4 |
| 5 | 21% · 1/4 | 78% · 4/4 | 78% · 4/4 |
| 7 | 16% · 1/4 | 79% · 4/4 | 79% · 4/4 |
| 10 | 15% · 1/4 | 76% · 4/4 | 76% · 4/4 |
| 14 | **0%** · 0/4 | 69% · 4/4 | 77% · 4/4 |
| 18 | **0%** · 0/4 | 68% · 4/4 | 76% · 4/4 |

**Adopted: `STAY_BASE_S = 6`** (product owner, after the simulation). 9 adds almost nothing.
The 350ms floor now only touches age 17+ (6/18 = 333ms).

## Visual design — verified in a real browser

Earlier rounds were built blind. This pass used headless Chromium screenshots at 375×667 and at
iPhone SE Safari's real visible height (375×548), which exposed problems code review never would:
characters ~63px with ~170px of empty space below, the 「開始打針」 pill as the loudest element
mid-game, 「開始遊戲」 / 「下一回合」 ~1,700px down the page, landscape showing only one row of holes,
and every 0 rendering as 「Ø」.

**Holes, redrawn from references.** Two openly licensed arcade photos on Wikimedia Commons — a
Taiwanese 打地鼠 machine (CC BY-SA 3.0) and Cedar Point's Whac-A-Mole (CC BY 2.0) — plus Playable's
hit-a-mole guide (hole artwork specified at 250×50, a flat 5:1 ellipse). Takeaways, drawn as our own SVG:
- a **flat opening** (3.6:1) with a lighter back wall and a darker depth, instead of a deep dark pit;
- a **lumpy raised dirt mound** around it, echoing the Taiwanese machine's dirt splash;
- the mound's **front lip drawn over the character** (`hole-back` → character → `hole-front`), so it
  genuinely emerges;
- **grass tufts**, for the arcade's outdoor cheerfulness — but the field itself stays warm, because a
  green lawn would swallow the green virus.
Locked holes are boarded over with two planks. Geometry: viewBox 100×48 at the hole's bottom; the
opening's centre line sits 24% up, which is where the character clip ends.

**Layout.** The board fills whatever space remains (`board-wrap` is a size container; each cell is the
smaller of what fits by width and by height). Portrait → **2 × 3** (holes ~150px, characters ~110px,
up from ~85 / ~63px); wide/landscape → 3 × 2. Play view is a 100dvh flex column and the page cannot
scroll. **No swab tray** any more (see 病毒入侵): the board takes the whole area under the HUD.
- **Top bar hidden during play** (`body.is-playing`): a child mashing the top of the screen could
  navigate out mid-round. 小遊戲選單 and 開始打針 move into the pause dialog — one tap deeper, never
  unreachable.
- **Sticky bottom CTA** (`.cta-bar`) for 開始遊戲 and 下一回合 — visible on the first screen.
- **Rounded numerals** (`--font-num`: ui-rounded / SF Rounded → Noto Sans) for the whole game page.
  Atkinson Hyperlegible's slashed zero read as 「Ø」 to children.

## Rewards

- **Streak multiplier** — consecutive catches with no escape: ×1.5 from 5, ×2 from 10.
  Shown as a 「×1.5」 / 「×2」 chip **next to the score** in the HUD and a centre callout 「5 連擊！×1.5」
  (taps pass through it).
  Points round to tens (150, 200, 300).
- **Round medal** by catch rate (caught ÷ appeared): gold ≥ 80% +500, silver ≥ 60% +300,
  bronze ≥ 40% +100; no medal under 3 appearances. The bonus counts toward rewards.
- **Sticker book** (8, kept per child): 第一次敲到 · 病毒清潔員 · 大魔王剋星 · 10 連擊 · 鐵甲剋星 ·
  小博士 · 金牌選手 · 六回合完成. Earned = solid ring + 「已獲得」; unearned = greyed, dashed, with
  how-to-earn text. New ones are listed on the round summary.

## Difficulty — tuned by simulation

Simulated child: per-age see-and-tap time with σ = 25% variance, **one finger** (a move/re-aim delay
between taps, so busy rounds cost misses), and 1 tap in 4 missed outright (≈ 75% ceiling).

Finding: with the 350ms floor, **14- and 18-year-olds scored 0% in rounds 1–2** — 6/14 = 429ms is
shorter than their ~430ms reaction — and could not catch anything until 「停留更久」 unlocked.

Changes: `MIN_UP_MS` 350 → **550** (affects only age ≥ 11); **warm-up** stay ×1.3 in round 1,
×1.15 in round 2, so the first impression is success. Result, hit rate per round:

| age | R1 | R2 | R3 | R4 | R5 | R6 |
|---|---|---|---|---|---|---|
| 3 | 86% | 75% | 100% | 60% | 58% | 62% |
| 7 | 76% | 68% | 72% | 64% | 72% | 73% |
| 10 | 69% | 74% | 73% | 76% | 60% | 61% |
| 14 | 74% | 69% | 66% | 66% | 58% | 62% |
| 18 | 68% | 67% | 65% | 59% | 64% | 57% |

Every age in 57–86% with a gentle ramp; no cliffs. (Age 3's round 3 is a small sample.)

## Staged introduction — 酒精棉片 from round 3, 病毒 only in 病毒入侵

Rounds 1–2 use only 止血帶 and 針筒 (`CHARACTERS[].from`). The **酒精棉片 character** joins the normal
mix from round 3. **病毒 is never in the normal mix** (`pickCharacter` skips `wipe` characters).

## 病毒入侵 — 7 seconds of viruses, hold to disinfect

From round 3 (infinity mode too), once per round at a random moment that **starts between 6s and
20s** (`invasionAt`); viruses stop coming by 25s and it ends once they are all wiped (or at the
round end):

- **Start:** everyone else ducks (not an escape, not counted in the medal's 「出現」). For 7s only
  viruses appear, **twice as often** as normal spawns (`invasionSpawnMs`, 250ms floor); stays still
  follow the formula (病毒 ×2). The board turns pale green with a 3px #15803D ring, and a pill at the
  bottom of the board (taps pass through) says 「按住病毒，就會一直消毒」 with the **countdown chip
  「5 秒」** at its end (white on #15803D, 5.0:1). Callout 「病毒入侵！」.
- **The finger is the swab.** No tray, no pick-up step: pressing anywhere on the board starts a
  hold (`setPointerCapture`), the swab ghost follows the finger, and the hole under the finger is
  tracked (on press and on every move). **A virus must be wiped for a while** — every frame adds
  the elapsed time to the virus under the finger, even if the finger doesn't move:
  **normal 0.2s · silver 0.375s · iron 0.6s** (`WIPE_MS`; halved on 2026-10-05 from
  0.4 / 0.75 / 1.2s, which was too slow to clear viruses in a 7s invasion).
  - A quick touch is not enough; the virus's bar (same bar as iron's HP) drains as it is wiped, and
    the virus wiggles (`.is-wiping`) only while the finger is on it.
  - Wiping **adds up**: lift halfway, come back, and it carries on.
  - **A virus being wiped can't escape** (its exit is pushed back while touched), so a long wipe
    never ends in "it ran away".
  - Sliding while held moves on to the next virus. Lifting the finger (or `pointercancel`) stops it.
  `touch-action: none` on the board during the invasion, so the browser doesn't treat the hold as
  a scroll. Verified in Chromium: after a 0.2s hold the virus was still up with its bar at 50%;
  by 0.5s it was gone (+200).
- **Escapes during the invasion don't break the streak** — viruses come thick and fast; it's a
  bonus phase. They still count against the medal's catch rate.
- **Last 2 seconds (`INVASION_LAST_MS`): no new viruses**, and the ones on the board **stop
  escaping** — the invasion **only ends when every virus is wiped**, even past the 7s. Callout
  「把病毒消滅光！」 (skipped if the board is already clean), and the chip switches from 「N 秒」 to
  **「剩 N 隻」**. The parent's phone can't add viruses then either (child refuses `inv-ending`; the
  remote stops offering holes and says 「病毒入侵快結束了」 — it reads `inv ≤ 2`, since the child
  reports `inv ≥ 1` for as long as the invasion lasts).
- **End:** after the last virus, 「消毒完成！」, and normal spawns resume after 600ms. If the round
  ends first, it is closed silently (leftovers not counted) and the next round starts clean.
  Verified in Chromium: spawns at 6.7 / 5.2 / 3.8 / 2.3s left, none after; 1.5s past the 7s the
  invasion was still on with 「剩 2 隻」; it ended with 「消毒完成！」 right after the second wipe.
- **No boss overlaps it:** a 大魔王 is only allowed if it can finish its 8s before the invasion
  starts (`bossAllowed(…, msToInvasion)`), never during it, and never as a virus.
- Pausing freezes the countdown (it runs on game time).

**Teaching.** Nothing is taught on entering round 3. At the **first invasion of each run**, the board
switches to 病毒入侵 and then a `<dialog>` opens with the clock frozen. Its title is
「手指<u>按住</u>病毒，就會一直消毒」 and it has a looping 4.4s animation in a fixed 240×160 stage. A
fingertip with the swab presses the first virus, and a pulsing ring shows it is still pressed. The
virus shrinks while the finger holds still, then disappears. Without lifting, the finger slides to
the second virus, which disappears too. Geometry is checked arithmetically: virus centres (64, 66) /
(176, 66), finger start (120, 118). Three steps follow; step 2 is bold: 「手指按住病毒不要放開」.
「我知道了，開始消毒！」 or Esc starts the 7 seconds. Later invasions in the same run skip the dialog.
It fits without scrolling on 375×548 (SE Safari, tightened spacing under 600px tall), 375×667 and 360×740.
Reduced motion shows a still: the finger pressed on the first virus with the ring on.
The start screen's rules card only teases it: 「還會突然病毒入侵 7 秒，到時候會教你怎麼消毒」.

Keyboard: `1`–`6` hit holes; during the invasion **holding a number key = holding a finger** on
that hole (keydown starts it, keyup stops it, auto-repeat is ignored). Enter / Space on a focused
hole can't be held, so each press wipes 0.25s (`WIPE_TAP_MS`): 1 press for a normal virus,
2 silver, 3 iron. `Esc` pauses; Ctrl/Cmd combos are
left alone.

## No 連擊 bar

The 槌子幫手 (auto-hammer) was removed, and later the progress bar above the board too: the board now
sits right under the HUD. The streak itself still counts — **a character escaping resets it**
(tapping an empty hole does not) — and still decides the multiplier, which shows as the chip next
to the score. Nothing else used the bar: the boss HP lives on the boss, the invasion countdown in
the invasion pill.

Old saves may still hold a `helper` sticker; it is ignored (the book counts only current ids).

## 金色大魔王 (boss) — replaces the gold coat

Rolled like a coat (Lv2 20%, Lv3 15%), but at most **one per round** and only when at least the
full 8s × 停留更久 is left, so the round end never swallows it.

- **Arrival:** everyone else ducks (not an escape — no streak loss, and not counted in the medal's
  「出現」); no new spawns while it is up. Callout 「大魔王來了！」.
- **Look:** gold coat that bobs, a pulsing gold glow behind the hole, and the board gets a 3px
  #B45309 ring (4.7:1). No 「大魔王」 badge next to it.
- **HP bar:** **right above the boss, exactly like iron's** (the same green 8px bar, no boss-only
  style) — it shrinks with every tap.
- **HP by age:** little 13 · kid 19 · junior 26 · teen 32 (×1.6 of the old 8 / 12 / 16 / 20 on
  2026-10-05) — all ≈ 5s at that age's top tapping speed (≈ 2.5 / 4 / 5 / 6.5 per second), inside
  the 8s stay. 更強的槌子 takes 2–3 HP per tap. Never a virus (viruses
  only come in 病毒入侵, where bosses are not allowed).
- **Stay:** a fixed **8s** (× 停留更久), not age- or level-scaled.
- **Knock-out:** 5× points (500) × the streak multiplier, +1 collection, sticker
  大魔王剋星, callout 「打倒大魔王！」, a longer buzz. It **doesn't drop into the hole**: a 1s defeat
  animation (`BOSS_DEFEAT_MS`, `.is-defeated`) — white flash and swell → squash → dizzy wobble left
  and right → spins 540° while shrinking to nothing; from 0.38s a gold ring expands and ten gold
  stars fly out (`.boss-burst`, injected into the hole, removed after). The HP bar goes away. The
  hole and all spawning wait until the animation is over; then the mole is put back down with
  transitions off, so it never slides down a second time.
- **Escape:** 「大魔王跑掉了！」 and the streak resets. Spawning resumes 700ms after it leaves.
- Reduced motion: no bob and no glow pulse (the glow stays, static); the defeat is a flash and a
  fade, no spin and no stars.

## No first-visit tutorial

The 4-step tutorial dialog that opened before round 1 (and the 「怎麼玩？」 button that reopened it)
was **removed**: the start screen's rules card already explains the game, and the only mechanic
that needs a demo — holding to disinfect — is taught in context at the first 病毒入侵.
「開始遊戲」 goes straight into round 1. New saves no longer carry `tutorialSeen`; old saves that
still have it load unchanged (the key is simply ignored).

## 剩下 5 秒

When the round clock crosses 5s left, a centre callout 「剩下 5 秒！」 pops up **once per round**,
and from then on the timer number jumps (scale 1.35 → 1) every second, on top of the existing
orange + underline low-time style (not colour alone). Never at round start; a pause just before
5s doesn't lose it. Reduced motion: the callout still shows, the number doesn't jump.

## 小知識 bank

`questions.json` (v2, **easy edition**): 4 characters × 4 age bands × 3 questions = 48.
Bands: `little` <6 (shows 「請爸爸媽媽念題目給你聽」), `kid` 6–8, `junior` 9–12, `teen` 13+.

- **Deliberately easy** (product owner: 「大幅度調低」). Everyday habits over science facts, and
  distractors that are obviously wrong (打針前護理師會用什麼擦你的手？ 酒精棉片 / 蛋糕 / 蠟筆). The
  `little` band's multiple choice has only 2 options. Removed: venous vs arterial flow, needle gauge,
  why 75% alcohol beats 100%, viral replication.
- **True/false is balanced at 16 / 16.** (An early draft was 78% 「對」 — guessable without reading.)
- Multiple-choice answers are stored at a fixed index for easy editing and **shuffled on screen**.
- Injection facts are phrased honestly (「可能會有一點點痛，但很快就過去了」), never "it won't hurt":
  a broken promise makes the next visit harder.
- If the bank fails to load (offline), the break skips the quiz and nothing is marked pending.

## Needle imagery — deliberate exception

MASTER forbids needle imagery on the site. **The game is the exception, by spec:** letting children
playfully "whack" medical tools is a recognised desensitisation technique (medical play). The syringe
is drawn plunger-up with its needle end below the hole's lip, so **no tip is ever visible**, and all
four characters have friendly faces. Outside the game, the rule still stands.

膠囊衝衝衝 is the second exception, also by spec ("Spikes are needles"): here the tips *are* visible,
because a hazard has to read as a hazard. They are drawn as cartoon needles on chunky coloured hubs
(no blood, no skin, nothing being injected), and the child's job is to hop *over* them — mastery,
not threat. The boss is a smiling doctor on a rolling stool playing 水槍大戰; see that section for why
he is not a villain.

## Robustness

- Clock advances only while playing; `dt` is capped at 100ms so returning to the tab can't skip seconds.
- Auto-pauses when the page is hidden (a parent takes a call); saves on `pagehide`.
- Progress (`anxin.wam.v1`) is keyed to the profile code: a new child on the same phone starts fresh.
- `localStorage` blocked → an in-memory fallback, so the game still plays.
- A finger tap fires `pointerdown` *and* `click`; hits are taken from `pointerdown`, and `click` is
  handled only when keyboard-generated (`detail === 0`), so nothing double-counts.

---

# (M) 打地鼠・雙機 — two phones

Spec: the parent's phone (parent portal) shows a QR code carrying the 4-digit code; the child's
phone (children portal) scans it and pairs; the child picks a game and the parent accepts or
rejects. In (M) 打地鼠 the parent **places characters** (or switches to automatic) and can trigger
**disrupting events**.

## Flow

1. **Parent `/games/duo/`** creates `rooms/{code}` (code = the profile's 4-digit code) and shows a
   QR of `https://…/games/{code}/`, the URL as text, the code, and a share/copy button (QR via
   qrcode-generator 1.4.4 from jsDelivr with SRI; if it can't load, the text still works).
2. **Child `/games/{code}/`** (no profile — no guard) signs in anonymously, writes its uid into
   `childUid`, and lists the games (打地鼠 ready, the rest 「即將推出」). Tapping 打地鼠 sends a
   `request`; a dialog says 「等爸爸媽媽按『好』…」.
3. **Parent** sees 「孩子想玩「打地鼠」」 → **好，開始** (sets `game`, opens the remote) or **等一下**
   (child is told and can pick again).
4. Child → `/games/{code}/whack-a-mole/`; parent → `/games/duo/whack-a-mole/`.
5. **結束遊戲** on the pairing page (or **重新配對**) — the child's game stops with a dialog
   pointing back to the menu; a re-paired child is told to scan again.

## Architecture: the child's phone owns the game

The child's phone runs the **same game code as (S)** — boss, invasion, timed wiping, streaks,
medals, quiz, stickers all work unchanged. `whack-a-mole.js` is wrapped in
`WhackGame.boot(profile, duo)`; solo boots itself, duo waits for `duo-child.js` to connect and boot
with `{ age, code }` from the room. Boot returns `{ snapshot, command, setMode, freeze }`.

Firestore (`shared/firebase.js` → `AnxinFirebase.duo`):

| Path | Writer | Content |
|---|---|---|
| `rooms/{code}` | parent creates; child joins / requests | `v, code, age, parentUid, childUid, mode, game, request, expiresAt, createdAt` — **no nickname** |
| `rooms/{code}/cmds/{id}` | parent only | `{t:'place', h, c, v}` or `{t:'event', e}`, immutable |
| `rooms/{code}/state/child` | child only | board (`holes[{o,c,v,b,p}]`), view, round, time, score, events, mode, last `ack` |

- **Commands** are one document each (no write contention). The child ignores the first server
  snapshot (stale commands from before it opened) and checks every command again: it answers in
  `state.ack {id, ok, why}`, and the remote shows the reason as a toast.
- **State** is one document, written on change but **at most every 600ms** (Firestore's ~1 write
  per second per document), with a trailing write so the last change always lands, plus a **5s
  heartbeat**. After 12s of silence (measured on its own clock) the remote opens the
  connection-lost dialog (see Screens).
- Measured on the emulators: parent tap → character on the child's screen ≈ **90ms**.

## Rules (`firestore.rules`, tested on the emulator: 34 cases)

- Rooms are readable by id only (the child must read before joining), never listable.
- Create: the exact client shape (`keys().hasOnly`), `parentUid == me`, 4-digit id == `code`,
  `childUid`/`game`/`request` empty, expiry in (now, now + 2 days).
- Join: only an empty seat, only to my own uid, not by the parent. A third phone is refused.
- Child may only send a `pending` request for a known game; parent may set mode, accept/reject,
  end the game, unpair (`childUid → null`, never to someone else); nobody can change `parentUid`.
- Commands: parent only, known types / holes 0–5 / characters / coats / events only.
  State: the joined child only, only `state/child`, only whitelisted fields, ≤ 6 holes.
- An **expired** room (another family's code from yesterday) can be re-created; an active one can't.
  Expired rooms accept no more commands, state or joins.

## Placing (我來放) — a line-up, the parent only picks the hole

Characters **queue up** (「排隊出場」): the front one is big with a 「下一個」 tag, the next three
follow. Tapping an empty hole on the **mirror board** places the front one and the line moves up
(each card slides into place; reduced motion: no slide). There is no character or coat picker.

- The line is `AnxinDuo.refillLine` (pure, in `duo-core.js`): characters come in **shuffled bags**
  of the ones already in play (`CHAR_FROM`, mirroring `engine.js`: 酒精棉片 from round 3), so the
  same one never comes twice in a row — rounds 1–2 simply alternate 止血帶 / 針筒.
- **Coats** come with the line: `coatChance(round)` = 8% per round after the first, capped at 40%,
  split evenly 銀色 / 鐵甲. The card says the coat in words (a pill), not only through the filter.
- **No viruses in the line.** During 病毒入侵 the whole line shows 病毒 and taps place viruses; the
  normal line is kept and resumes afterwards.
- A tapped hole shows the character **half-transparent** (「放置中…」) until the child's board has it.
  If the child's phone refuses (or the write fails) the character goes **back to the front** of the
  line, so nothing is lost.
- The parent's phone owns the line (the child just receives `{t:'place', h, c, v}` as before), so
  **`firestore.rules` did not change**.

Placed characters follow the normal stay formula for the child's age and level. The child's phone
refuses (and the remote explains): not playing, hole busy, hole 維修中, boss on the board, non-virus
during an invasion, virus outside one (it couldn't be wiped), automatic mode. In **我來放** nothing
spawns on its own and there is no scheduled invasion (viruses still pour out during an invasion the
parent starts). **自動出現** = exactly (S) behaviour; the line hides, the virus button and events stay.
The mirror tiles are created once and updated in place — re-rendering them would drop a tap that
lands mid-update.

## 開始病毒入侵 — appears when it can be launched

The invasion is not one of the 搗蛋 buttons any more. Between the line and the board there is one
fixed-height slot: when an invasion **can** start it holds a big green 「開始病毒入侵」 button that
pops in; otherwise the same slot says why not (dashed, grey virus: 「第 3 回合起才有病毒」 — viruses
join at round 3, as in (S) · 「遊戲中才能按」 · 「再等 N 秒」 · 「大魔王在場」 · 「這回合時間不夠了」), and
during one it shows 「病毒入侵中・還有 N 秒」. Keeping the slot's size fixed means the board never
jumps under the parent's finger when the button appears (checked: board top identical in all
three states).

## Events (game time; they pause with the game; cleared at round end)

| | Event | Effect | Refused when |
|---|---|---|---|
| 病毒 slot | 病毒入侵 | the (S) 7s invasion, how-to dialog first time per run | round < 3 · already on · boss up · < 7s left |
| 搗蛋 | 大魔王 | boss in a random open hole (never a virus), others duck | already up · invasion · < 8s left |
| 搗蛋 | 地震 | board shakes 4s (reduced motion: tilted, still) | already shaking |
| 搗蛋 | 泡泡 | 3 open holes covered 6s; first tap / finger pops the bubble, the next one hits | bubbles still floating |
| 幫忙 | 雙倍分數 | catches ×2 for 6s (stacks with the streak), 「雙倍」 chip by the score | already on |

Each button shows its hint, or the reason it can't be pressed (「進行中」 · 「大魔王在場」 ·
「時間不夠了」 · 「遊戲中才能按」 · 「再等 N 秒」) — not just greyed out. Cooldowns 12–20s stop
spamming; a refused event doesn't use its cooldown.

## Screens

- **Parent pairing:** status pill (dot + text), QR card, request card (orange inset ring),
  playing card (結束遊戲 · 打開遙控器), 重新配對.
- **Child menu:** no top bar (no profile, nowhere to go); the game cards are the buttons.
- **Child game:** the (S) page with the back link → the menu, no 開始打針 (needs a profile), a
  connection banner (「已連線・爸爸媽媽會幫你放角色」), callouts when the parent switches mode.
- **Remote:** status · round / time / score + event chips · mode switch · line-up · 病毒 slot ·
  mirror board (same coat filters as the game) · 搗蛋 / 幫忙 buttons · toast for refusals.
- **Connection lost → a dialog** on the remote, not a line in the status pill:
  | Case | Title | Main button | Closes |
  |---|---|---|---|
  | child silent 12s | 孩子的手機好像斷線了 | 繼續等 | by itself when the child reports again |
  | this phone offline (`offline` event) | 這支手機沒有網路 | 繼續等 | by itself when back online |
  | listener stopped (terminal in Firestore) | 連線中斷了 | 重新整理 | only by reloading (Esc blocked) |
  | couldn't connect at all | `failureText` title | 重新整理 | only by reloading |

  Every case also offers 回配對頁. 繼續等 keeps that case quiet until it recovers and happens again.
  Coming back to the page (screen unlocked) restarts the 12s wait instead of flashing the dialog
  for updates a hidden tab couldn't receive. On the **child's** phone a stopped listener freezes the
  game under the existing end dialog (「和爸爸媽媽的手機斷線了，回選單就能再連上」).
- Contrast measured in a real browser on every screen and state (178 text elements): all AA.

⚠️ Production needs the updated `firestore.rules` **published in the Firebase Console** and
**Anonymous sign-in enabled**. Until then every `rooms/*` read is `permission-denied`.

**Failure messages** (`AnxinDuo.failureText`): a server refusal (`permission-denied`, anonymous
sign-in off) shows 「雙機暫時不能用 — 不是手機網路的問題…請先玩單機遊戲」, because telling a parent
to check their Wi-Fi sends them after the wrong problem. Only real network failures (offline,
gstatic blocked) show 「連不上網路」. The raw error is always `console.error`ed. Firestore listeners
stop for good on an error (a dropped network reconnects silently and never reaches `onError`), so
their message is 「連線中斷了，請重新整理這一頁」, not "reconnecting".
(2026-10-04: the live project still had pre-duo rules — signed-in `GET rooms/0427` → 403 while
`threads` → 200 — which the old catch-all reported as 「連不上網路」.)

---

# (S) 畫圓圈 — `/games/draw-circle/`

| File | Role |
|---|---|
| `circle.js` | `window.CircleScore` — **pure** scoring, no DOM; every tunable in `CONFIG` |
| `draw-circle.js` | Canvas, turn-taking, views, record |

## Scoring algorithm

1. **Resample** the stroke to 64 points evenly spaced *along the path*. Without this, slow-drawn
   stretches carry extra points and bias both the fit and the error.
2. **Fit the best circle** by least squares (Kåsa algebraic fit, solved after centring on the
   centroid for numerical stability) → centre + radius.
3. **Roundness** = `1 − RMS(|p − c| − r) / r ÷ 0.22`, clamped 0–1.
4. **Completeness** = degrees swept around the centre ÷ 360, capped at 1. **This is what rejects a
   straight line**: a line fits a huge circle with tiny relative error, but sweeps almost no angle.
5. **Score = 100 × roundness × completeness²** (squared so an open "C" is clearly penalised).

Not scored, with a friendly retry that doesn't use up an attempt: fewer than 8 points (`short`),
drawing under 60px (`small`), or less than half a turn (`open`).

Calibration on synthetic shapes:

| shape | score | shape | score |
|---|---|---|---|
| perfect circle | 100 ★★★ | octagon | 88 ★★★ |
| careful hand (0.8% RMS) | 97 ★★★ | ellipse 1.3 : 1 | 58 ★ |
| decent hand (2.4%) | 89 ★★★ | square | 49 |
| wobbly (6.9%) | 69 ★ | C-shape (270°) | 56 ★ |
| spiral, 2 turns | 23 | ellipse 2 : 1 / triangle | 0 |

Stars: ≥ 88 ★★★ 超級圓！ · ≥ 72 ★★ 好圓喔！ · ≥ 55 ★ 有圓的樣子了 · below 再試一次看看.
Tested invariant to position, size, direction, starting point and drawing speed.

After each try the fitted circle is drawn **dashed** over the child's stroke — they can see where
it bulged, rather than only receiving a number.

## Play

- **自己玩** or **和爸爸媽媽比賽** (one phone, turns alternate child → parent, with a
  「把手機交給…」 prompt). Three tries each; the best counts. The multi-phone (M) version waits
  on the QR pairing.
- Only one finger is tracked; a second touch is ignored. `pointercancel` (a call, a system
  gesture) discards the stroke. `getCoalescedEvents` keeps fast strokes smooth.
- The record is the child's own best only, keyed to the profile code.
- Freehand drawing is the activity itself — the "essential" exception to WCAG 2.5.7 — so there is
  no keyboard alternative; scores are still announced as text.


---

# (S) 膠囊衝衝衝 — `/games/dash/` (spec: Geometry Dash)

| File | Role |
|---|---|
| `engine.js` | `window.DashEngine` — **pure** physics, collisions, portals, checkpoints, boss, records. Every tunable in `CONFIG` |
| `levels.js` | `window.DashLevels` — ASCII patterns, the six fixed levels, the infinity generator |
| `art.js` | `window.DashArt` — Q 版 SVG sprites, rasterised once per tile size |
| `dash.js` | Canvas renderer, input, HUD, dialogs, record |

## Characters — everything is something from a hospital

| Spec | Built as |
|---|---|
| egg-like chibi character | **小膠囊** — an egg-shaped capsule, orange top / cream bottom with a capsule seam, big low eyes |
| spikes are needles | needles on red hubs (blue in 雙胞胎 when they differ between the halves) |
| blocks | **藥盒** — medicine boxes with a two-tone pill; no red cross (a protected emblem) |
| ship mode | **體溫計火箭** — a thermometer, bulb as the engine, the capsule riding on top |
| UFO mode | **藥杯飛碟** — a glass dome on an upside-down medicine cup |
| boss "a doctor?" | a smiling doctor on a rolling stool holding a water-filled syringe |
| — | 彈簧墊 (jump pad), 安心旗 (checkpoint flag), 星星 (3 per level) |

## Physics — fixed step, measured in tiles

- 120 Hz fixed step in *game time*. Same inputs → same result, which is what lets the test bot prove
  levels are passable.
- **Age sets the speed of the whole game, not just the scroll**: one smooth curve,
  **0.7 × √(age ÷ 4), capped at 1.4** (ages under 1 count as 1 so the game never stops).
  - Result: 2 y ×0.49 · 4 y ×0.70 · 7 y ×0.93 · 9 y ×1.05 · 12 y ×1.21 · 15 y ×1.36 · 16 y+ ×1.40.
  - History: the first version used age bands (×0.7–×1.1). The product owner then asked for a
    "difficulty acceleration" of √age ÷ 2 on top, and stacked on the bands that hit ×2.33 at 18 —
    too fast for older children. The curve now replaces both. It is anchored so a 4-year-old is
    unchanged, it has no jumps at band edges, and it tops out near Geometry Dash's normal 1× speed.
  - Because everything — gravity and the boss's 1 s warning included — runs on game time, a jump
    covers the same tiles at every age; only the reaction time changes. A scroll-only change would
    alter jump lengths and break the maps.
- **Gravity is asymmetric** (GD feel): rising 62, falling 86 tiles/s² (1.4×), terminal 26. A jump is
  ≈ 2.25 tiles high, 0.49 s, ≈ 3.8 tiles long at the base speed of **7.8 tiles/s** (raised from 7 so the
  heavier jump still clears three needles). Hold = re-jump on landing (as in GD).
  Forgiveness: 0.12 s input buffer before landing, 0.07 s coyote time after an edge, corners within
  0.22 tiles step up instead of crashing.
- **Needles hurt less than they look**: drawn tip at 0.8 tiles, hitbox 0.24 × 0.45; the player's
  hazard box is 0.6 vs a 0.86 body. A single needle leaves a ~390 ms jump window at ×1.
- Ship: hold = up (46), release = down (40), ±7.5 tiles/s; floor and ceiling are safe to slide on.
- UFO: each tap = a ≈ 1.5-tile hop (Flappy Bird, gravity 46); holding does nothing.
- **The capsule rolls**: rotation = distance ÷ 0.45 tiles (its radius, so no slipping); it keeps
  spinning in the air and turns upright for the dizzy face on a crash. Reduced motion: a small tilt
  instead.
- **Speed lines**: thin warm-brown streaks with a white top edge, moving at 1.8× the scroll (they read
  as wind, not scenery), denser at higher speed; plus three short trails behind the capsule.
  Brown, not white — white vanishes on the light skies. Off with reduced motion.
- Respawn: checkpoints (安心旗) at every section start and ~45 tiles apart, always with ≥ 4 empty tiles
  ahead. A crash shows a dizzy "><" face for 0.7 s, then the capsule blinks at the flag for 0.65 s.
  The word is 「撞到了，沒關係」 — never 失敗.

## The six levels (spec a–f) + infinity (g)

| # | Name | Spec | Built |
|---|---|---|---|
| 1 | 出發囉 | (a) standard, dash + ship | cube → ship → cube |
| 2 | 快快跑 | (b) faster | speed portals ×1.2 then ×1.35 |
| 3 | 藥杯飛碟 | (c) UFO | 200 tiles of UFO between short cube runs; every column is a stack from the ceiling and/or the floor with a ≥ 3-tile gap (no floating boxes) |
| 4 | 雙胞胎 | (d) duo, split screen | see below |
| 5 | 轉轉 | (e) rotate 3° per jump / spike | see below |
| 6 | 醫生的水槍 | (f) boss with telegraphs | see below |
| ∞ | 無限挑戰 | (g) seeded array of modes | see below |

All levels are open from the start (children pick, per #07). Each shows 0–3 stars and 完成 / 最遠 N%.
Levels last 30–75 s at every age (tested).

**Portals are small, and the course funnels you into them.** Instead of a tall ring you can fly past,
each mode change is a 2-tile ring at the narrowest point of a funnel: the floor ramps up 0 → 1 and the
ceiling slopes down (from 5 on the jumping side, from the corridor ceiling 7 on rocket/UFO sides) to 3,
over 5 tiles in front and 4 behind. The slopes are **solid but safe** — the capsule rolls up and down
them (it sticks to a down-slope instead of hopping), a jump bonks on the ceiling, a rocket hugging the
ceiling is pushed down through the neck. Only a gap narrower than the capsule would hurt ("squeeze"),
which the generator never makes. Nothing else is placed inside a funnel; the checkpoint flag sits on
flat ground after it. Joins that keep the same mode (level 2's speed-ups) get no portal at all.

**Levels are built from ASCII patterns.** Each pattern is a few tiles of hand-drawn obstacles, graded
1–3 (`#` box, `^` needle, `v` hanging needle, `o` pad, `*` star slot). A level is a fixed seed plus a
list of sections `{mode, length, difficulty from → to}`; the generator picks patterns of rising
difficulty. Stars go on star-capable patterns at about 20 / 50 / 80 % of the level.

**雙胞胎 (d).** The canvas splits along a horizontal line. The top half is a *second world*, drawn
upside down (as in GD dual mode), and both capsules obey the same tap. Patterns are mostly identical;
where they differ, the differing obstacles are **blue and outlined with a dashed box** in both halves —
colour plus outline, never colour alone. The difference is computed cell by cell, not hand-tagged.

**轉轉 (e).** Each jump and each needle passed turns the view 3°; at ±15° it turns back the other way.
A literal cumulative 3° would put the course upside down after 60 events. The view eases to the new
angle at 40°/s; with reduced motion it snaps.

The tilt is also a slope: tilted clockwise the course runs downhill and the game speeds up, and
anticlockwise it runs uphill and slows down, by **×(1 + angle/40), kept within 0.8–1.4**. That's
×1.375 at the full 15° downhill and ×0.8 from 8° uphill. The product owner suggested
`max(0.8, 1 + angle/20)`; that reaches ×1.75 downhill, and stacked on the age boost a 10-year-old
would hit ×2.8, so the gentler slope was used. It follows the *eased* view angle, so speed and
picture change together. It changes game time like the age speed, so jumps keep their shape and the
level stays provably passable.

**醫生的水槍 (f).** A doctor as a villain who shoots needles at a child would undo what this site is for.
So he is a **playmate in a water fight**:
- He rolls in on his stool saying 「來玩水槍大戰！」.
- An **IV stand (點滴袋) stands beside him**, with a tube running to his syringe.
- **Every shot is charged first** (1 s): water flows from the bag through the tube, the syringe fills
  up and its plunger pulls back. **The bag drops a little with every charge**, so the bag is his
  health bar. The HUD swaps the progress bar for 「點滴袋 · 剩 N 發」.
- **Aiming is a laser pointer**: a thin bright line with a red glow that fades out on both sides,
  ending in a glowing dot on the capsule. It brightens as the syringe fills. A "!" bubble shows
  over his head.
- **No 「跳！／別跳！」 labels** (product owner): the laser alone tells. The dot's *position* — at the
  feet or at head height — carries low vs high, so it isn't colour alone. The one-time hint says
  「紅色雷射指到哪裡，水就射到哪裡」.
- When the bag runs dry he is **beaten**: a happy face, a little white flag and
  「點滴用完了，你贏了！」, then he rolls away and the goal appears 14 tiles on.

**After a crash in this level the capsule gets 0.5 s of invincibility** (real time, converted to game
time so it's 0.5 s at every age). It starts when play resumes after the 0.65 s blink at the flag and
keeps blinking (~2.3 Hz, partial opacity) while it lasts. Needles and water don't count, and running
into a box side puts the capsule on top instead of crashing. Respawning at the phase checkpoint can
otherwise land a child right in front of the next shot. Other levels don't get it.

**The arena floor is flat, with obstacles timed between the shots.** (A hilly version was tried and
dropped at the product owner's request — flat ground, obstacles instead.) The doctor's schedule is
fixed in time and the capsule's position is fixed in time, so each obstacle is placed where the capsule
passes it **at the midpoint of a gap between two water arrivals, at least 1 s from any shot** — a child
never has to jump an obstacle and dodge water at the same moment. Respawning at the phase checkpoint
keeps the same timing.
- A warm-up needle while he rolls in.
- Then one needle → a 2-box medicine stack → two needles, in turn (10 obstacles in level 6).
- The 3 star gaps put the needle directly under the star, so the jump that clears it collects it.
- Infinity's boss fights get the same obstacles (no stars there).

The laser and water ride the floor at lane height, so on this flat floor they are straight lines.

There are 12 shots: the opener is always low, low, high, and never three of one lane in a row. From
the halfway point (a checkpoint) he fires pairs. All 3 of level 6's stars float 2 tiles up, over a needle, in those gaps.

**無限挑戰 (g).** For each round, the seed shuffles `[跳跳, 火箭, 飛碟, 雙胞胎, 轉轉]`. Each mode plays
83 tiles behind a portal (1.5× the first version's 55). When the array is empty: boss (5 + round shots), then the next round with a
fresh shuffle, harder patterns and +6 % speed per round (capped at ×1.3). The sky colour follows the
mode, so a portal is felt even before the controls change. There are no checkpoints, and a crash ends
the run. The summary shows metres, the round reached, and **地圖編號** (the seed) with 「同一張地圖再玩」
and 「換一張新地圖」.

## Screen

- **The finish is a celebration, not a sign.** It has:
  - an arch of 13 balloons (orange, yellow, green, sky, pink) with two small bunches at the base;
  - a green ribbon banner 「終點」 between two gold stars, and a red finish tape that snaps in two
    and hangs from both sides when the capsule breaks it;
  - a black-and-white checkered line on the ground.

  The balloons bob gently, and four sparkles slowly brighten and dim (about 1 s, no flashing). With
  reduced motion everything holds still. It is drawn on the canvas, centred on the goal, so the
  capsule finishes *inside* the arch.
- Canvas 9 tiles high; tile = min(height / 9, width / 11). Portrait 375 px → 32 px tiles, ~8 tiles of
  look-ahead. The capsule sits 2.8 tiles from the left edge.
- **Portrait leaves space under the canvas: it becomes a big orange 「跳」 / 「飛」 pad** (dark ink on
  orange, per MASTER). It presses down while held. The whole stage is the touch target; the pad just
  tells children where to put their thumb. A mode's first-time hint appears under the pad. In
  landscape (no room for the pad) the hint pill sits over the floor strip instead of the top of the
  canvas, where ship gates are.
- 「點一下開始」 overlay: the first tap only starts the run, and a finger still held from it is ignored
  until lifted.
- Top bar hidden while playing (same as 打地鼠); pause holds 繼續 / 重新開始 / 選關卡 + 小遊戲選單 /
  開始打針. Auto-pause when the page is hidden.
- Keyboard: Space / ↑ / W jump (hold works), Esc / P pause. Focus moves to the canvas only when the
  game was started from the keyboard, so touch users never see a focus ring.
- Real-time hand–eye play is the activity itself (WCAG 2.5.7 "essential"). Mode changes, stars,
  crashes and results are also announced in a live region.
- Reduced motion: no particles, squash or star bob, and rotation snaps. No flashing anywhere; the
  respawn blink is ~2.3 Hz at partial opacity.
- Record `anxin.dash.v1` keyed to the profile code. Stars count only on a finish; leaving mid-level
  keeps the best %.

## Difficulty pass — a simulated 16-year-old

At 16 the game runs ×1.4. A simulated player played every level start to finish (20 playthroughs
each), respawning at flags like a child would:
- It reads the course perfectly (everything is visible ~0.6 s ahead) and aims every tap at the middle
  of that jump's success window.
- Each tap lands with **human timing error, σ = 35 ms** (also run at σ = 50 ms). The error is
  converted into game time at the current speed, so speed portals and 轉轉's downhill really do tighten
  it.
- Windows come from an exact search: every frame tap/no-tap, then a backward pass marking which states
  can still finish.
- Rocket / UFO stretches were checked separately: every section can be flown when input may only
  change **every 70 ms, for every phase of that rhythm**, with hazards enlarged by 0.06 tiles.

Three pieces left less than a human's margin, with these tightest windows (real ms at 16 y):

| Piece | Before | After | Change |
|---|---|---|---|
| three needles in a row (`n3`) | 71 ms (~69% per try) | 167 ms | now `^^` + 3-tile gap + `^` (`n2n1`) |
| box, then a needle 2 tiles after (`boxn`) | 36 ms | 268 ms | needle right against the box: one jump off the box clears it |
| tower, 2-wide steps and a 1-wide top (`tower`) | 48 ms | 143 ms | three 4-wide steps, star on top (the ~3.8-tile jump overshot 2-wide steps) |

After the change every jump piece leaves **≥ 119 ms** at 16 y; a test now enforces ≥ 110 ms. Deaths
per playthrough at σ 35 ms: L1 0.25 · L2 0.80 · L3 0.05 · L4 0.65 · L5 0.80 · L6 0.10, with no spot
dying more than a few times in 20 playthroughs. Infinity still tightens by design: +6 % speed per
round, up to ×1.3.

## Verified

- **Solver bot** (breadth-first search over inputs on the real engine, with hazards **enlarged by
  0.06–0.08 tiles** and inputs only every 25–50 ms):
  - every pattern passes, and every star slot is reachable;
  - all six levels finish **with all 3 stars**;
  - all-difficulty-3 sections pass in every mode;
  - three infinity seeds pass through round 1, the boss and into round 2.
- **Tests:** 54 engine/level tests, including:
  - the funnel shape;
  - rolling through it without leaving the ground;
  - a ship being pushed through by the ceiling;
  - the UFO column rule checked column by column;
  - the IV bag only ever draining, and empty at the win;
  - every boss obstacle being ≥ 1 s from any shot, with each star over a needle;
  - the post-respawn invincibility lasting 0.5 s of real time at ×0.7, ×1 and ×2 speed.

  Plus 18 jsdom page tests.
- **Real Chromium:** touch taps, ship hold over CDP touch, landscape, and an AA contrast audit
  (124 text elements).
