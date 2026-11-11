# 02 主頁面 + 子頁外框 — page overrides

Inherits MASTER. Covers `/home/` and the shell shared by every subpage (`/shared/page.css`).

## Routing

| Route | Needs profile | Notes |
|---|---|---|
| `/portal/` | no | #01 form (`/` redirects here). A valid profile redirects to `/home/` from `<head>`, so the form never flashes. |
| `/home/` | yes | #02 hub |
| `/guide/` `/cheer/` | yes | #05 / #06 content pages (see `05-06-guide-cheer.md`) |
| `/games/solo/` `/games/duo/` | yes | #07 menus (see `07-games.md`). `/games/solo/` is titled 玩遊戲 and lists every game, ending with 兩支手機一起玩 → `/games/duo/`. |
| `/books/` | yes | 看繪本 (see `08-books.md`) |
| `/shot/` `/feedback/` | yes | #03 |
| `/thanks/` | no | profile may have expired by then; personalises only if present |
| `/discussion/` | no | #04, open to everyone (see `04-discussion.md`) |
| `/discussion/parent/` | optional | #04 for parents coming from 回饋; without a profile it falls back to `/discussion/` |

Protected pages guard in `<head>` with `Anxin.requireProfile()` → `location.replace('/portal/')`.

- **Every internal path is root-absolute** (`/shared/styles.css`, `/home/`). Vercel may serve `/home` without
  redirecting to `/home/`, and from there `./home.css` resolves to `/home.css`. Absolute paths survive
  both forms; the smoke test requests both.
- Navigation that shouldn't be returned to uses `location.replace` — submitting #01 must not leave a
  back-button entry that bounces straight to `/home/` again.

## Hub layout — as few words as possible

Owner's direction (2026-11-12): a 3 × 1 grid for the parent, a grey line, a 2 × 1 grid for the child;
one name per tile, no descriptions.

1. **Code card** only (「打針時，請把這組代碼交給醫檢師」). The child's details live in 修改資料.
2. **Parent tiles, 3 × 1** (`.tiles-3`): 修改資料 (`/portal/?edit`, honey) · 安慰指南 (`/guide/`, apricot) ·
   抽血大小問 (`/cheer/`, sage). Whole-tile links, 116px tall, 60px icon block.
3. **Grey line** (`.home-divider`, `#D6D3D1`, decorative) between the parent's and the child's features.
4. **Child tiles, 2 × 1** (`.tiles-2` + `.tile-kid`): 玩遊戲 (`/games/solo/`, apricot) · 看繪本 (`/books/`, sage).
   Bigger (156px, 84px icon block) so a child can hit them. No 單機／雙機 split on the hub; the 雙機 entry
   is the last card in the games list.
5. **開始打針** — full-width `.btn-primary`, separated by `--sp-6` so it reads as its own step.

Section headings (給家長 / 給孩子) are `sr-only`: screen readers get the structure, the screen stays wordless.

**Tile icons** are drawn for the hub on a 32 × 32 grid, two-tone: line in the tile's `--tone`
(icons need 3:1, and every tone is ≥ 4.3:1 on its `--tone-tile`), fill `.f1` = `--tone-soft`, `.f2` = white,
`.ink` = solid tone. Stroke 1.9 (1.7 on the child tiles, which render bigger).

## Subpage shell

- Top bar: 「‹ 回主頁」 + a persistent 「開始打針」 pill (spec: reachable from any subsection).
  Not shown on `/shot/` itself.
- **No needle or syringe imagery anywhere.** These screens sit in front of anxious children; the CTA uses
  a neutral arrow. *Exception: the 打地鼠 game, by spec — see `07-games.md` (medical play, no tip ever shown).*
  *Exception: the favicon (owner's choice), the owner's drawing of two syringes whose needles form an N.
  Everything favicon lives in `/favicon/`: `ver1.svg` is the Inkscape original (the second syringe is the first
  turned 180°); `favicon.svg` is it redrawn for tabs (black 1.2 stroke, white rounded square). It only appears at
  tab size. Every page links `/favicon/favicon.ico` (32px, `sizes` set so Chrome still picks the SVG),
  `/favicon/favicon.svg` and `/favicon/apple-touch-icon.png` (180px, white square for iPhone home screens);
  `/favicon.ico` is rewritten to the folder for browsers that ask the root. A new version: add `verN.svg`, redraw
  the three served files from it — no page changes.*
- 重新填寫 is destructive (wipes profile + code), so it confirms in a `<dialog>` with **autofocus on
  取消** — an accidental Enter must not wipe data.

## Contrast notes specific to this shell

- `.pill-cta` text is 17px bold — *normal* text, since large-bold starts at 18.66px. Its hover therefore
  cannot darken to `#FFE2C4` (4.17:1); it lifts with a shadow instead. `.btn-primary` can use that
  hover only because its 18.7px bold label counts as large text.
