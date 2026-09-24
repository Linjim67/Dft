# 安心陪伴 — Design System (MASTER)

> Global source of truth. Page files in `pages/<page>.md` **override** this file.
> Palette from `ui-ux-pro-max --domain color`, then contrast-measured before use.

## Product context

| | |
|---|---|
| Product | 安心陪伴 — pre-procedure calming companion for paediatric patients |
| URL | notcry.vercel.app |
| Audience | Parents (primary operator) + child (co-viewer), in a hospital waiting room |
| Emotional job | Lower anxiety. Warm, never clinical. |
| Language | zh-Hant-TW |
| Platform | Mobile-first web (375px target) |
| Theme | **Bright mode only.** No dark mode — deliberate, per product owner. |
| Stack | Vanilla HTML/CSS/JS, no build step, static on Vercel |

## Colour — warm orange ("Playful orange")

Source: `--domain color` → **#23 Pet Tech App**, *"Playful orange + trust blue"*.
**Every pair below is measured.** The cream ground is what makes this warm rather than clinical —
it does more work than the orange does.

| Token | Value | Measured |
|---|---|---|
| `--bg` | `#FFF7ED` warm cream | — |
| `--bg-sunk` | `#FFF1E0` | slider track, inset wells |
| `--card` | `#FFFFFF` | — |
| `--fg` | `#7C2D12` | 8.83:1 on bg · 9.37:1 on card |
| `--fg-muted` | `#57534E` warm stone | 7.19:1 on bg · 7.63:1 on card |
| `--primary` | `#F97316` | fills only |
| `--primary-ink` | `#1C1917` | **6.24:1 on orange** |
| `--primary-deep` | `#C2410C` | 5.18:1 on card — borders, selected, links |
| `--primary-fill` | `#EA580C` | 3.21:1 vs unfilled track |
| `--primary-wash` | `#FFEDD5` | selected-card ground |
| `--success` | `#15803D` | 5.02:1 on card |
| `--danger` | `#B91C1C` | 6.47:1 on card |
| `--line` | `#9C8578` warm taupe | **3.48:1 / 3.27:1** — control boundaries |
| `--hairline` | `#F5E3CE` | decorative only, never a boundary |

### Traps found by measuring
- **white on `#F97316` = 2.80:1.** Orange buttons take **dark ink** (`#1C1917`), not white.
  This is also the better look.
- **`#FED7AA` border = 1.35:1.** Unusable as a control boundary — the same trap the
  previous cyan palette had with `#A5F3FC`. Warm taupe `#9C8578` carries boundaries instead.
- **`#F97316` slider fill vs track = 2.52:1.** Fill uses `#EA580C`.

### Dropped from the dataset entry
The `#2563EB` "trust blue" accent. A third hue had nowhere to go in this UI and added noise.
Confirmation uses `--success` green; everything else is orange + warm neutrals.

## Style — warm soft, low-chrome

Claymorphism geometry **without** the hard flat edge shadows, which read as cheap plastic.

- Radius `12 / 16 / 22 / 28px`; buttons are full pills
- **Depth is warm ambient shadow**, tinted `rgba(124,45,18,…)` — never a flat colour edge.
  Orange elements get `--sh-orange` so the glow matches the object.
- Press = `translateY(2px)` + shadow collapse. Subtle; never shifts layout bounds.
- **Borders only where WCAG 1.4.11 needs one** — inputs, steppers, unselected radio cards.
  Containers (assurance list, summary, code card) float on shadow with no outline.
  Outlining every surface was the main thing making the old build noisy.
- Resting borders are quiet taupe; **saturated orange is reserved for focus and selection**,
  so the active element is the loudest thing on screen.

### Face scale is monochrome
All five faces use one ink. The scale is carried by **mouth curve + text caption**, and
selection is the only colour event. A five-step colour ramp was visual noise, and dropping it
also removes any reliance on colour to read the scale.

## Typography

- **Latin + digits:** Atkinson Hyperlegible · **Chinese:** system CJK
  (`PingFang TC`, `Noto Sans TC`, `Microsoft JhengHei`) — Atkinson has no CJK coverage, and
  falling through avoids a 2MB webfont on hospital wifi
- Base **17px** / line-height **1.7** (CJK wants looser leading), 18px ≥ 40rem
- Headings `-.01em` tracking; `font-variant-numeric: tabular-nums` on code, age, counters

## Spacing & motion

`4 · 8 · 12 · 16 · 24 · 32 · 48` · measure `34rem` · touch target **48px floor**
Motion subtle: `140ms` state / `220ms` transition, `cubic-bezier(.22,.78,.35,1)`, transform+opacity
only, max 1–2 animated elements per view. `prefers-reduced-motion` zeroes durations *and* removes
the press translate.

## Non-negotiables

1. No emoji as icons. Inline SVG, Phosphor language (1.8–1.9 stroke, round caps).
2. Colour is never the only signal — selection carries a check badge, errors carry a glyph.
3. Every control border ≥ 3:1, every text pair ≥ 4.5:1. **Measure, don't eyeball.**
4. Touch targets ≥ 48px, gaps ≥ 8px.
5. Sliders always get a keyboard/stepper alternative (WCAG 2.2 `dragging-alternative`).
6. Failed submit = inline field errors **and** a focusable linked summary. Never one or the other.
7. Don't outline a surface that a shadow can separate.

## Avoid

Cool/clinical palettes · hard flat "plastic" edge shadows · borders on every surface ·
multi-hue colour ramps · neon · AI purple-pink gradients ·
anything framing the child's fear as a failure.
