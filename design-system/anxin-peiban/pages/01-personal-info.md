# 01 個人資訊 — page overrides

Inherits MASTER. Deviations and page-specific decisions only.

## Layout: single scroll, not a wizard

Six fields for a parent standing in a waiting room. A 6-step wizard costs 6 extra taps and hides
how much is left. Single scroll with spacious grouping is faster and shows the whole commitment
up front — which is itself reassuring ("只要一分鐘" is verifiable at a glance).
Revisit only if the field count grows past ~8.

## Inline question rows

暱稱, 年紀 and 性別 put the question and its answer on **one line** (`.field-inline`), so the form
scans as a list of settled facts rather than a stack of blocks. The answer is right-aligned, which
gives a consistent edge for the eye to run down.

Two constraints this creates:
- `<legend>` cannot be laid out inline reliably, so 性別 is a `role="radiogroup"` +
  `aria-labelledby` and 年紀 is a plain `<label for>`. Neither loses grouping semantics.
- `.age-readout` carries a fixed `min-height`, because 「尚未選擇」 (1rem) and 「1 歲半」 (1.4rem)
  are different type sizes and the row would otherwise jump on first answer.

Rows wrap rather than crush below ~340px.

## Age slider — non-linear index

Spec: 0.5 increments for 0–6, 1 increment for 6–18. Implemented as a **linear index 0–24** mapped
to a non-linear value, so the thumb moves evenly and every stop is reachable.

**Every index is worth exactly 0.5 years, across the whole track** — `age = i × 0.5`, 36 stops.
That is what makes the bar spatially linear: 2.0 index units per year everywhere.

| index | selectable | value |
|---|---|---|
| 0–12 | every unit | 0 … 6.0 by 0.5 |
| 13–36 | **even only** | 7 … 18 by 1 |

Odd indices above 12 would be 6.5, 7.5 … which the spec disallows, so they are snapped away
**in the direction of travel**: raw 13 coming up from 12 → 14 (7歲); raw 13 coming down from
14 → 12 (6歲). Snapping toward a fixed side would make the boundary feel sticky one way.
The steppers skip the dead index entirely, so +/− always walks one real stop.

The earlier 25-index version packed 0–6yr into the same width as 7–18yr, so a year was twice
as wide at the young end — the bar lied about the scale.

- **The floating bubble is gone.** The readout on the question line is now the single display and
  it live-syncs: `input` and `change` both call the same `updateAge()`, so the number, the
  `aria-valuetext`, and the orange track fill can never disagree with each other.
- ⚠️ **Deliberate deviation from prompt.md.** The original spec asked for the value to appear
  "after complete scrolling"; the product owner asked for continuous sync instead, so the number
  now updates during the drag rather than on release.
- `aria-valuetext` is set on every paint — otherwise a screen reader announces the raw index
  ("7") instead of the age ("3 歲半").
- Labels: `0 → 未滿 6 個月` · `0.5 → 6 個月` · `n.5 → n 歲半` · `n → n 歲`
- `touch-action: pan-y` so a horizontal drag adjusts the slider while the page still scrolls.
- No stepper buttons and no end labels (removed by product owner). WCAG 2.2 `dragging-alternative`
  is still met: a native `<input type="range">` is keyboard-operable by arrow keys on its own.
  The steppers were precision convenience, not a compliance dependency.
- The field has **one** control, so it uses a plain `<label for="ageIndex">` rather than
  `fieldset`/`legend` — a group wrapper for a single input is the wrong semantic, and the label
  also gives the range a proper accessible name.
- The track fills orange behind the thumb (`--fill`, set from JS). It is gated on `ageEngaged`,
  so an untouched slider shows an **empty** track — a filled track would imply a value the
  parent never chose, exactly like a pre-positioned thumb does.
- Starts **untouched** (`？` bubble, "尚未選擇"). A slider at a default position silently claims a
  value the parent never chose.

## 4-digit code

djb2 over `nickname|age|gender|timestamp`, `% 10000`, zero-padded. **Not authentication** — it only
lets a parent return to their own record on the same device. Stored in `localStorage` with a 24h
`expiresAt`; a valid record short-circuits straight to the success view on load.
All storage access is `try/catch` — private browsing throws rather than returning null.

## Chunking

Each question+answer is one chunk, separated by a 1px rule. The grouping is carried by
**proximity, not chrome**: 4–12px inside a chunk against 65px (32 + rule + 32) between them —
a 5.4× ratio, so the units form on their own without cards or boxes.

- The divider is `--rule #C09A72` at **2.44:1**. The previous `#F0DCC4` measured 1.26:1 and was
  effectively invisible, which is why the chunks did not read as separated.
  It stays lighter than the 3.27:1 input border so a separator never competes with a control.
- The submit button carries `margin-top: 32px` on top of the chunk's own 32px. Without it the
  button sat 32px from the last question while questions sat 65px apart — closer to 特殊需求
  than the questions were to each other, so it read as part of that chunk.

## Progressive dimming

Answered questions drop their label from `--fg` to `--fg-muted` and their hint to `--idle`, so the
unanswered question is always the darkest thing on the form. **Dimming uses solid colours, never
`opacity`** — `opacity: .7` on the hint measured 3.49:1, below the 4.5 floor. Every dimmed state
is still AA.

## Copy

Second person, warm, never imperative-clinical. The worry question is framed as mattering in its
own right ("家長的緊張孩子會感覺到，所以這題同樣重要") so the parent doesn't read it as judgement.
Helper text on 特殊需求 gives concrete examples — parents under stress don't invent categories.
