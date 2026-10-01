# 07 小遊戲 — page overrides

Inherits MASTER. Covers `/games/solo/` (menu) and `/games/whack-a-mole/` — (S) 打地鼠.

## Routing

Spec: `/games/(auth code if needed)/what-game`. Single-player needs no code, so the game is
`/games/whack-a-mole/`; the multiplayer build will live at `/games/<code>/whack-a-mole/`.
`/games/solo/` is the menu children pick from. Unbuilt games show as non-link cards with a
「即將推出」 badge (visible text, not only greyed-out).

「Mini mario」 is shown as **「跳跳冒險」** — "Mario" is a Nintendo trademark and this is a public site.

## Files

| File | Role |
|---|---|
| `engine.js` | `window.WhackEngine` — **pure** rules, no DOM: spawn rate, weights, tiers, coatings, rewards, quiz selection, save/load. **Every tunable number is in `CONFIG`.** |
| `whack-a-mole.js` | Views, the rAF loop, pointer / drag / keyboard input |
| `questions.json` | 小知識 bank |
| `index.html` | Views + an inline SVG sprite; characters are drawn once as `<symbol>`s |

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
- **Challenges are manual and unlimited.** As soon as a character reaches its threshold, a
  「挑戰小知識」 button appears on it — on the start screen and the round summary — and any number
  can be challenged in one break. (Replaced the earlier "one automatic quiz per round".)
- **Wrong** → that character is locked until *the next round ends*, then the *identical* question
  returns. Tracked with lifetime `roundsPlayed`, so it survives closing the page. Other characters
  stay challengeable. **The answer is not revealed on a wrong try**, or the retry would be
  meaningless. Leaving without answering (「先不要」) is not a failure.
- **Coatings unlock by level**: Lv1 silver · Lv2 + 金色大魔王 · Lv3 + iron. Each carries a text
  badge (×1.5 / 👑大魔王 / ×2) — never colour alone.
- **Point rewards** unlock automatically at lifetime-point thresholds (the same "reach a
  threshold" rule as collections): 停留更久 1.5k / 10k / 24k · 更多洞 4k / 16k · 更強的槌子 14k / 32k.
  Tuned by simulation so a perfect player earns about one reward per round through round 6,
  and a realistic child (slower, misses ~1 in 3) keeps earning into round 8.
- The hammer (更強的槌子) affects **taps** only — iron and 大魔王; each swab wipe deals 1 HP.
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
up from ~85 / ~63px); wide/landscape → 3 × 2 with the tray in a side column. Play view is a 100dvh
flex column and the page cannot scroll.
- **Top bar hidden during play** (`body.is-playing`): a child mashing the top of the screen could
  navigate out mid-round. 小遊戲選單 and 開始打針 move into the pause dialog — one tap deeper, never
  unreachable.
- **Sticky bottom CTA** (`.cta-bar`) for 開始遊戲 and 下一回合 — visible on the first screen.
- **Rounded numerals** (`--font-num`: ui-rounded / SF Rounded → Noto Sans) for the whole game page.
  Atkinson Hyperlegible's slashed zero read as 「Ø」 to children.
- The redundant 「可以挑戰小知識！」 line is dropped when the 挑戰 button is shown.

## Rewards

- **Streak multiplier** — consecutive catches with no escape: ×1.5 from 5, ×2 from 10.
  Shown as a 「×1.5」 chip on the combo row and a centre callout 「5 連擊！×1.5」 (taps pass through it).
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

## Staged introduction — 病毒 & 酒精棉片 from round 3

Rounds 1–2 use only 止血帶 and 針筒 (`CHARACTERS[].from`), and the swab tray is hidden and
inert (tap and the `S` key are ignored). The **酒精棉片 character** waits too, read literally from
「病毒和酒精棉片」 — the swab arrives as both a character and the tool that beats the virus.

Entering round 3 opens a `<dialog>` **before the clock starts**: a looping 3.2s animation in a
fixed 240×200 stage — a fingertip presses the swab in the tray, drags it up 102px (tool centre
158 → virus centre 56, checked arithmetically), scrubs, and the virus spins away with 「+200」 —
plus three numbered steps for parents. 「我知道了，開始！」 or Esc starts the round.
**Shown every run** at round 3, since that is where the mechanic arrives each time.
Reduced motion shows a deliberate still (swab resting on the virus) rather than the global rule's
end frame, where the virus has already vanished.

Soak after this change: teens' hit rate fell from ~63% to 40–45%. Their normal-character window
(429ms at 14) sits right at reaction time, and the long-staying viruses that used to lift it are
absent for two rounds. Still playable and still levelling; it reads as "harder for teens".

## Streak bar

The 槌子幫手 (auto-hammer) was **removed**. The bar under the HUD now tracks the streak toward the
next multiplier: 「3 / 5」 → (×1.5) 「7 / 10」 → (×2) just the count with a full bar. **A character
escaping resets it** (tapping an empty hole does not — young children tap freely). The same target
for every age; it only decides a score multiplier, not a power-up.

Old saves may still hold a `helper` sticker; it is ignored (the book counts only current ids).

## 金色大魔王 (boss) — replaces the gold coat

Rolled like a coat (Lv2 20%, Lv3 15%), but at most **one per round** and only when at least the
full 8s × 停留更久 is left, so the round end never swallows it.

- **Arrival:** everyone else ducks (not an escape — no streak loss, and not counted in the medal's
  「出現」); no new spawns while it is up. Callout 「大魔王來了！」 (「病毒大魔王！」 for the virus).
- **Look:** gold coat that bobs, a pulsing gold glow behind the hole, a 👑「大魔王」 badge under its
  own HP bar, and the board gets a 3px #B45309 ring.
- **HP bar:** the streak bar turns into the boss bar — label 「大魔王」, red→orange fill on a pale
  track, 「9 / 12」 text. It is 16px (vs 12px) but still shorter than the text line, so nothing
  shifts. Text #9A3412 on the page 6.9:1; fill vs track 4.3:1; ring 4.7:1.
- **HP by age:** little 8 · kid 12 · junior 16 · teen 20 — all ≈ 3–4s at that age's top tapping
  speed (≈ 2.5 / 4 / 5 / 6.5 per second). 更強的槌子 takes 2–3 HP per tap. **病毒大魔王** is wiped,
  not tapped, and wipes have a 250ms cooldown (≤ 4/s), so its HP is halved (4 / 6 / 8 / 10).
- **Stay:** a fixed **8s** (× 停留更久), not age-, level- or virus-scaled.
- **Knock-out:** 5× points (500; 病毒 1000) × the streak multiplier, +1 collection, sticker
  大魔王剋星, callout 「打倒大魔王！」. **Escape:** 「大魔王跑掉了！」 and the streak resets.
  Spawning resumes 700ms after it leaves.
- Reduced motion: no bob and no glow pulse (the glow stays, static).

## First-visit tutorial

A 4-step `<dialog>` opens once per child (`tutorialSeen`, keyed to the profile code): tapping,
wiping the virus, collecting + 挑戰, pausing. 上一步 / 下一步 with a step count and dots (the active
dot is wider, not only darker); the last step's 「開始玩！」 closes it and starts the game.
略過教學 or Esc also mark it seen. 「怎麼玩？」 on the start screen reopens it.

## 病毒 — drag, with a single-pointer alternative

Drag the swab from the tray over a virus; hit-testing uses `elementFromPoint` under the finger
(the ghost has `pointer-events: none`). A 250ms per-virus cooldown makes an iron virus need three
real wipes, not three `pointermove` events from one swipe.

**Alternative (WCAG 2.2 dragging-alternative):** tap the swab to pick it up (`aria-pressed`), then
tap the virus. Movement under 8px counts as a tap, so a wobbly finger doesn't start a drag.
Keyboard: `1`–`6` hit holes, `S` picks up the swab, `Esc` pauses; Ctrl/Cmd combos are left alone.

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

## Robustness

- Clock advances only while playing; `dt` is capped at 100ms so returning to the tab can't skip seconds.
- Auto-pauses when the page is hidden (a parent takes a call); saves on `pagehide`.
- Progress (`anxin.wam.v1`) is keyed to the profile code: a new child on the same phone starts fresh.
- `localStorage` blocked → an in-memory fallback, so the game still plays.
- A finger tap fires `pointerdown` *and* `click`; hits are taken from `pointerdown`, and `click` is
  handled only when keyboard-generated (`detail === 0`), so nothing double-counts.

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
