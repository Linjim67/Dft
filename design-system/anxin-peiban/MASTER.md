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
| Platform | **Phone-only** web (375–390px target), except the staff page `/pro/` (desktop/tablet). No desktop layouts for parent/child pages — on a wide screen they show the phone column |
| Theme | **Bright mode only.** No dark mode — deliberate, per product owner. |
| Stack | Vanilla HTML/CSS/JS, no build step, static on Vercel. Cross-page logic in `/shared/app.js` (`window.Anxin`); Firestore for #01 code registry, #03 feedback + 醫護端 (`/pro/`), #04 discussion, #07 duo rooms |

## Colour — Sand palette (沙米調色盤, owner-approved 2026-11-12)

Sand ground `#E9E1D8`, cocoa ink, **no orange**, leaf green `#87AE73` as the one supporting colour.
Designed and approved on the proposal page "沙米調色盤" (claude.ai artifact). **Every pair below is
measured.** Token names are kept from the old orange system (`--primary-*`) so pages didn't change;
only the values did. Game screens keep the old orange values (see *Games keep their palette*).

| Token | Value | Measured / use |
|---|---|---|
| `--bg` | `#E9E1D8` sand | the owner's ground colour |
| `--bg-sunk` | `#DDD3C7` | slider track, 「選填」 tag; darker than bg so it reads as sunk |
| `--card` | `#FCFAF7` paper | cards, inputs (1.24:1 on bg — separated by shadow) |
| `--fg` | `#3E3329` cocoa | 9.49:1 on bg · 11.78:1 on card (less red than the earlier `#4A2A1C`) |
| `--fg-muted` | `#5C524A` | 5.88:1 on bg · 7.30:1 on card · 5.15:1 on bg-sunk |
| `--idle` | `#685E56` | unanswered faces, hints, chevrons: 4.88:1 on bg |
| `--primary-deep` | `#3E3329` (= cocoa) | selection borders, links, button text and borders, code digits |
| `--primary-wash` | `#EFE7DD` | selected ground, hover fill (cocoa text 10.02:1) |
| `--primary-fill` | `#6B5A4C` | slider fill, 4.45:1 vs track (leaf green would be 1.71:1) |
| `--primary` | `#87AE73` leaf | solid fill (staff brand mark); cocoa text on it 4.87:1 |
| `--primary-ink` | `#3E3329` | dark ink used as body text on some pages |
| `--leaf` / `-deep` / `-soft` / `-tile` | `#87AE73` / `#456535` / `#E7EFE0` / `#D5E4CB` | leaf is fill-only (white on it 2.52:1 ✗); deep 5.13:1 bg · 4.99:1 tile |
| `--success` / `-wash` | `#456535` / `#E7EFE0` | completion = leaf deep |
| `--danger` / `-wash` | `#A83420` / `#F5E0DA` | brick red: 5.11:1 bg · 6.34:1 card · 5.21:1 wash |
| `--line` | `#8A7362` | control boundaries: 3.45:1 bg · 4.28:1 card |
| `--hairline` / `--rule` | `#E4DACF` / `#C6B6A5` | decorative dividers only |
| shadows | `rgba(62, 51, 41, …)` | cocoa-tinted |

### Traps found by measuring
- **Leaf green can't carry text or boundaries**: white on `#87AE73` = 2.52:1, leaf on bg = 1.95:1,
  leaf vs slider track = 1.71:1. It is a fill with cocoa text, and `--leaf-deep` does text and icons.
- **The old cream-era washes were lighter than the sand ground** (`#FFF1E0` sunk, `#F5E3CE` hairline),
  so "sunk" looked raised; the sand palette's sunk/hairline are derived from the ground instead.

### Where cocoa and leaf go (owner: "網頁不需要完全類黑白", 2026-11-12)
- **Cocoa = actions:** buttons, links, focus rings, body text, the 開始打針 button.
- **Leaf = the child's data and "chosen":** the temporary code (home, 打針 page, staff page:
  `--code`), its dashed frame, the age readout and slider fill, every selected option (faces,
  gender, age cards, guide's active tab as solid leaf-deep with white text 6.63:1, filter chips,
  discussion chips/sort/「有幫助」, books) via `--pick` / `--pick-wash`, home tile icons, icon tiles,
  the leaf chapters and 完成. Text and lines use `--leaf-deep`; `#87AE73` itself only as a fill or
  a decorative frame. Games map `--code`/`--pick*` back to their orange.

### Buttons — style C 「可可描邊」 (owner's pick of five)
All buttons, including tabs, filter chips, 開始打針 and link buttons, use **16px corners**
(`--r-btn`), not pills. Primary: paper `--card` + 2px cocoa border + cocoa text (11.78:1), no
shadow. Secondary `.btn-quiet`: transparent + 1px `--line`. Danger: paper + 2px brick border. Hover
fills `--primary-wash`; press = 2px down + inset shadow. Tags, badges, dots, search fields and slider
tracks are not buttons and keep their round shapes.

### Chapter tones (guide, 抽血大小問, books)
`data-tone="cocoa | leaf | honey"`: 怎麼說 = cocoa `#5A4A3D` (soft `#F2ECE5`, tile `#E2D8CC`) ·
打針當下 / 醫療現場解密 = leaf · 不要說 / 抽血大小問 = honey `#77560A` (soft `#F3E9D2`, tile `#E9D7AB`).
*ink* = icons and short labels · *soft* = large washes · *tile* = icon tiles, count badges.
Search highlights (`mark`) use the honey tile (8.6:1 with cocoa).

### Games keep their palette
The owner excluded the games' own colours. `shared/styles.css` restores the old orange-era token
values (and pill buttons) on game screens, recognised with `:root:has(link[href^="/games/<game>/"])`.
The game menus (`/games/solo/`, `/games/duo/` and the pairing page) are not in that list and follow
the sand palette. **Add any new game's stylesheet path to that selector.**

## Style — warm soft, low-chrome

Claymorphism geometry **without** the hard flat edge shadows, which read as cheap plastic.

- Radius `12 / 16 / 22 / 28px`; buttons use 16px (`--r-btn`) since 2026-11-12, no pills
- **Depth is warm ambient shadow**, tinted `rgba(124,45,18,…)` — never a flat colour edge.
  (Shadows are cocoa-tinted; `--sh-orange` survives only for the games.)
- Press = `translateY(2px)` + shadow collapse. Subtle; never shifts layout bounds.
- **Borders only where WCAG 1.4.11 needs one** — inputs, steppers, unselected radio cards.
  Containers (assurance list, summary, code card) float on shadow with no outline.
  Outlining every surface was the main thing making the old build noisy.
- Resting borders are quiet taupe; **cocoa is reserved for focus and selection**,
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
