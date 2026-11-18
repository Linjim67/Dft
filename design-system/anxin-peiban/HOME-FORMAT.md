# 主頁面格式 — the home page's look, as a reference for other pages

> The format of `/home/` (#02 主頁面), written down so other pages can follow it.
> **MASTER.md** holds the tokens and global rules; **pages/02-home.md** holds the hub's own spec and its
> history. This file pulls out what makes the hub look the way it does, so a page told to «參照主頁面的
> format» knows exactly what to copy. Source of truth is the shipped code: `home/index.html`,
> `home/home.css`, `home/mascots.js`, tokens in `shared/styles.css`.

## The look in one paragraph

Sand ground, paper shapes floating on soft cocoa shadow, no outlines. Cocoa for words and actions,
leaf-deep for icons and for anything that is the child's own (the code, a score). Big friendly circles,
very few words, one bold name per thing. Pressing something makes it sink 2px and go a shade darker.
Two hues only, cocoa and leaf; no orange, no yellow, no saturated fills.

## 1. Page frame

| | Home | Value |
|---|---|---|
| Ground | `body` | `--bg` #E9E1D8 sand, 17px / 1.7, Atkinson Hyperlegible + system CJK |
| Column | `.wrap` | max `--measure` 34rem, side gutter `--sp-5` 24px (or the safe area). **Phone-only**: design at 375–390px, check 320px; no desktop layout |
| Top | `.site-top` | `--sp-5` + `env(safe-area-inset-top)`; the hub has no top bar |
| Subpage top | `.topbar` (`shared/page.css`) | «‹ back» (muted bold, left) + 開始打針 (`.pill-cta`, right) |
| Rhythm | | 8px inside a group · 24px between blocks (`--sp-5`) · 32px before a decorative band (`--sp-6`) · 48px + safe area at the bottom |

## 2. Colour roles

Use tokens only. Page CSS has **no hex values** except `#FFFFFF` text on a solid leaf-deep badge and
mascot artwork; JS may keep a token's value as a fallback.

| Role | Token | On the home page |
|---|---|---|
| Ground | `--bg` | page |
| Surface | `--card` #FCFAF7 | code card, quarter buttons, centre button, pen button |
| Words, actions | `--fg` / `--primary-ink` cocoa #3E3329 | button names, the note under the code |
| Quiet words | `--fg-muted` #5C524A | card labels («小安的暫時代碼») |
| **The child's data** | `--code` = `--leaf-deep` #476D33 | the four code digits |
| **Icons** | `--leaf-deep` | every line icon on the hub (5.75:1 on card) |
| Done | `--success` = leaf-deep, with a ✓ glyph | «已完成» note |
| Spent / inactive | `--idle` #685E56 | digits after the code is used |
| Pressed / hover | `--primary-wash` #EFE7DD | a pressed quarter, the centre button |
| Divider inside a card | `--hairline` 1px | line above the code card's footer |
| Ground line | `--rule` 2px | 小抹茶's walking line |
| Control boundary | `--line` 1px | the round pen button's edge (4.28:1 on card) |
| Shadow | cocoa-tinted `rgba(62, 51, 41, …)` | `--sh-sm` / `--sh-md` / `--sh-lg` |

`--leaf` #87AE73 itself is **fill only** (white on it 2.52:1). Text, lines and icons in green always use
`--leaf-deep`. Selected things use `--pick-wash` + a `--pick` (leaf-deep) border.

## 3. Surfaces

- **Cards float on shadow with no border and no dashed frame.** `--card`, `--sh-md`; `--r-xl` 28px for
  the hero card, `--r-lg` 22px for list cards.
- **A group of shapes shares one shadow.** The four quarters and the centre button sit under a single
  `filter: drop-shadow(0 2px 3px rgba(62,51,41,.06)) drop-shadow(0 8px 12px rgba(62,51,41,.12))` on
  `.quad`, so they read as one object.
- **Inside a card, top to bottom:** label → hero → hairline → footer row. The code card is the model:
  - label: `.9rem`, bold, `--fg-muted`, line-height 1.5;
  - hero: the digits, `3.1rem` bold, `tabular-nums`, `--code`, centred (`.2em` tracking for the code only);
  - footer: `border-top: 1px solid var(--hairline)`, 12px above and below; note on the left
    (`.9rem` bold cocoa, `text-wrap: balance`), the round action on the right.
- Containers that need to show they are sunk (a track, an empty slot) use `--bg-sunk`, darker than the
  ground.

## 4. Controls

| Control | Home example | Format |
|---|---|---|
| Shape button | `.quad-item`, `.quad-center` | Paper, **no border**, line icon above a bold cocoa name. The whole shape is the target |
| Round icon button | `.code-edit` | 48px circle, paper, 1px `--line`, `--sh-sm`, 22px cocoa icon |
| Text button (subpages) | — | MASTER style C: `.btn-primary` = paper + 2px cocoa border, `--r-btn` 16px, no shadow; `.btn-quiet` = transparent + 1px `--line` |

All of them:
- **Press** = `translateY(2px)` (1px for the 48px button) and the fill turns `--primary-wash`; the round
  button drops its shadow instead. Icons inside follow the fill through a variable (`--quad-bg`), so the
  icon's white interior never shows as a patch.
- **Hover** only for a fine pointer (`@media (hover: hover) and (pointer: fine)`): `--primary-wash`, or a
  bigger shadow for the round button.
- **Focus** = 3px cocoa outline, 2–3px offset, following the shape's radius.
- `-webkit-tap-highlight-color: transparent`, plus an empty passive `touchstart` listener so iPhone
  Safari applies `:active`.
- Targets ≥ 48px, gaps ≥ 8px. 140ms transitions on `transform` and `background-color`.

## 5. Icons

Inline SVG line drawings, Phosphor-like: stroke 1.7–1.9, round caps and joins, `stroke: --leaf-deep`,
**`fill` = the surface colour** (`var(--quad-bg, var(--card))`), so closed shapes look hollow on any
fill. A small solid accent (a dot, a star) gets `class="ink"` → `fill: currentColor`. Sizes on the hub:
40px on a quarter, 33px in the centre, 22px in the round button. No emoji. No needles except the
documented exceptions (02-home.md).

## 6. Shapes — the circle is the motif

The hub is built from circles: four quarter-circles that make one disc, a round hole in its centre, a
round 開始打針 button in the hole, a round pen button. Everything else uses 16–28px corners. Pills are
only for tags and small status chips, never for buttons.

## 7. Type

| Use | Size / weight | Colour |
|---|---|---|
| Button name | 1rem bold, line-height 1.35, no wrap | cocoa |
| Card label | .9rem bold, line-height 1.5 | muted |
| Note | .9rem bold, `text-wrap: balance` | cocoa |
| Big number | 3.1rem bold, `tabular-nums` | `--code` (leaf-deep) |
| Subpage title | `.page-head h1` 1.75rem bold, −.01em | cocoa |

Numbers are always `tabular-nums`. Sizes inside a scaled group use `min(rem, cqw)` so a narrow phone
shrinks them with the shape.

## 8. Words

As few as possible. One name per feature. The hub's own headings are `sr-only`: screen readers get the
structure, the screen stays wordless. A how-to is shown by a picture or an animation rather than a
paragraph. Status changes go to a `role="status"` region.

## 9. Motion

`--t-fast` 140ms for state, `--ease` `cubic-bezier(.22,.78,.35,1)`, transform and opacity only. Press =
2px sink. `prefers-reduced-motion`: no press translate, no walking; taps still get a still reaction.

## 10. Mascots (optional decoration)

小抹茶 and 小麻糬 come from the game's drawings (`/games/dash/art.js`), recoloured to the sand palette
(`home/mascots.js`). They are `aria-hidden`, react to a tap (hop, duck), never cover a control's hit
area, and stand still under reduced motion.

## 11. Bringing another page into this format — checklist

1. **Sand tokens.** A game page is listed in the games selector in `shared/styles.css`
   (`:root:has(link[href^="/games/…/"])`), which restores the orange values. Remove the page from that
   list.
2. **Replace every colour literal** in the page's CSS *and* JS (canvas strokes too) with a role from
   §2. Canvas code reads the token with `getComputedStyle(document.documentElement)`.
3. **Surfaces:** paper + `--sh-md`, no border, 22–28px corners. Drop inset hairlines and rings used only
   for decoration.
4. **Numbers about the child** (score, record, code) → `--code`, bold, `tabular-nums`.
5. **"Best", "first", "chosen", "you"** → leaf: `--pick-wash` ground + 2px `--pick` ring, a solid leaf
   badge with white text (5.99:1). Never colour alone: keep the star, the tag or the word.
6. **Achievement marks** (stars) → `--leaf` fill with a `--leaf-deep` outline; empty ones are outlined
   in `--line` with no fill. Leaf, not gold: the hub has no yellow.
7. **Buttons:** shared `.btn-*` (style C) on subpages; press 2px, hover only with a fine pointer.
8. **Icons:** leaf-deep line icons, fill = surface.
9. **Phone only:** remove `min-width` desktop layouts.
10. Check at 375px and 320px in a real browser, and measure any new colour pair (≥ 4.5:1 text, ≥ 3:1
    graphics).

## Pages in this format

| Page | Since | Notes |
|---|---|---|
| `/home/` | 2026-11-12 | the source |
| `/games/draw-circle/` 畫圓圈 | 2026-11-18 | left the orange game palette; mapping in `pages/07-games.md` |
