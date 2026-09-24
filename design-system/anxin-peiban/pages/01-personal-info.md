# 01 個人資訊 — page overrides

Inherits MASTER. Deviations and page-specific decisions only.

## Layout: single scroll, not a wizard

Six fields for a parent standing in a waiting room. A 6-step wizard costs 6 extra taps and hides
how much is left. Single scroll with spacious grouping is faster and shows the whole commitment
up front — which is itself reassuring ("只要一分鐘" is verifiable at a glance).
Revisit only if the field count grows past ~8.

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

- **`input` → bubble** (live while dragging) · **`change` → `<output>`** (commits on release).
  This is the spec's "shows number while scrolling, displays after complete scrolling."
- `aria-valuetext` is set on every paint — otherwise a screen reader announces the raw index
  ("7") instead of the age ("3 歲半").
- Labels: `0 → 未滿 6 個月` · `0.5 → 6 個月` · `n.5 → n 歲半` · `n → n 歲`
- `touch-action: pan-y` so a horizontal drag adjusts the slider while the page still scrolls.
- −/+ steppers flank the track: no precision dragging required, and they satisfy
  `dragging-alternative` beyond the range input's native keyboard support.
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

## Progressive dimming

Answered questions drop their label from `--fg` to `--fg-muted` and their hint to `--idle`, so the
unanswered question is always the darkest thing on the form. **Dimming uses solid colours, never
`opacity`** — `opacity: .7` on the hint measured 3.49:1, below the 4.5 floor. Every dimmed state
is still AA.

## Copy

Second person, warm, never imperative-clinical. The worry question is framed as mattering in its
own right ("家長的緊張孩子會感覺到，所以這題同樣重要") so the parent doesn't read it as judgement.
Helper text on 特殊需求 gives concrete examples — parents under stress don't invent categories.
