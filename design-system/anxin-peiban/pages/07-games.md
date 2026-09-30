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
- **Coatings unlock by level**: Lv1 silver · Lv2 + gold · Lv3 + iron. Each carries a text badge
  (×1.5 / ×2) — never colour alone.
- **Point rewards** unlock automatically at lifetime-point thresholds (the same "reach a
  threshold" rule as collections): 停留更久 1.5k / 10k / 24k · 更多洞 4k / 16k · 更強的槌子 14k / 32k.
  Tuned by simulation so a perfect player earns about one reward per round through round 6,
  and a realistic child (slower, misses ~1 in 3) keeps earning into round 8.
- The hammer affects **taps** only; each swab wipe deals 1 HP.
- Infinity mode = rounds continue past 6, difficulty capped at round 10.
- No penalty for misses.

## Stay time — the formula, and why it needs attention

    stay = STAY_BASE_S / max(age, 1) × (1 + level) ÷ coat      coat: normal 1 · silver 2 · gold 3
    病毒 ×2 · iron ×1.6 (not in the formula; keeps the original "stays longer" rule)
    × 「停留更久」 reward · floor MIN_UP_MS = 350ms

Coatings only unlock at the level that cancels their divisor (silver Lv1 → 2/2, gold Lv2 → 3/3), so
**no character is ever shorter than `STAY_BASE_S / age`**. `max(age, 1)` avoids `3 / 0`.

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

## Combo bar + helper hammer

Consecutive catches fill the bar; **a character escaping resets it** (tapping an empty hole does
not — young children tap freely). Target by age band, because a 3-year-old sees a fraction of the
characters a teen does: little 4 · kid 6 · junior 8 · teen 10.

Full bar → **槌子幫手** for 3s of *game* time (pauses with the game, ends with the round): every
normal character is smashed 180ms after it appears (long enough to be seen), iron in one blow,
with points and collection credit. **It leaves 病毒 alone** — hammers don't clean germs, so the
swab rule stays meaningful. Catches during the helper don't pre-fill the next combo.
The bar shows text (「3 / 6」, then 「2 秒」) and the board gets an outline — never colour alone.

Soak, six rounds per age: the hammer triggers 4–10 times (≈ once a round); hit rates 63–75%.

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
