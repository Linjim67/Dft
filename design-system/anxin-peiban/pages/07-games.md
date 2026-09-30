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

    rate      = (1 + min(round, 10)/4) · I(t)     spawns / second
    interval  = max(250ms, 1000 / max(rate, 0.6))

| interval (s) at t = 30 / 20 / 10 / 0 left | |
|---|---|
| round 1 | 1.67 / 1.07 / 0.80 / 1.07 |
| round 6 | 1.67 / 0.53 / 0.40 / 0.53 |
| round 10+ (cap) | 1.67 / 0.38 / 0.29 / 0.38 |

The `MIN_RATE` floor exists because `I(30) = 0`; without it each round opens with seconds of nothing.

## Rules as built

- **Weights** ∝ `max(100 − C_x, 10) × (1 + 5% × level)`, where `C_x` = lifetime catches of that
  character. Rarely-caught characters appear more — the game nudges children to collect all four.
- **Collection** counts characters *caught* (an iron one counts once, not three times).
- **Tiers** 10 / 50 / 100 make a character *eligible*; answering its 小知識 correctly is what
  actually levels it up. **One quiz per round break** so play isn't interrupted for long.
- **Wrong or skipped** → the *identical* question returns at the next break. **The answer is not
  revealed on a wrong try**, or the retry would be meaningless. The explanation shows only on success.
- **Coatings unlock by level**: Lv1 silver (×1.5, 75% visible time) · Lv2 + gold (×2, 60%) ·
  Lv3 + iron (×2, 160% visible, 3 HP with a bar). Each also carries a text badge — never colour alone.
- **Point rewards** unlock automatically at lifetime-point thresholds (the same "reach a
  threshold" rule as collections): 停留更久 1.5k / 10k / 24k · 更多洞 4k / 16k · 更強的槌子 14k / 32k.
  Tuned by simulation so a perfect player earns about one reward per round through round 6,
  and a realistic child (slower, misses ~1 in 3) keeps earning into round 8.
- The hammer affects **taps** only; each swab wipe deals 1 HP.
- Infinity mode = rounds continue past 6, difficulty capped at round 10.
- No penalty for misses.

## 病毒 — drag, with a single-pointer alternative

Drag the swab from the tray over a virus; hit-testing uses `elementFromPoint` under the finger
(the ghost has `pointer-events: none`). A 250ms per-virus cooldown makes an iron virus need three
real wipes, not three `pointermove` events from one swipe.

**Alternative (WCAG 2.2 dragging-alternative):** tap the swab to pick it up (`aria-pressed`), then
tap the virus. Movement under 8px counts as a tap, so a wobbly finger doesn't start a drag.
Keyboard: `1`–`6` hit holes, `S` picks up the swab, `Esc` pauses; Ctrl/Cmd combos are left alone.

## 小知識 bank

`questions.json`: 4 characters × 4 age bands × 3 questions (one per upgrade level) = 48.
Bands: `little` <6 (shows 「請爸爸媽媽念題目給你聽」), `kid` 6–8, `junior` 9–12, `teen` 13+.

- **True/false is balanced at 11 / 12.** The first draft was 18 of 23 「對」 — a child could score
  78% without reading.
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
