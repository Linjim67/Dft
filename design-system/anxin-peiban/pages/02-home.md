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

The owner's direction (2026-11-12, revised twice the same day): no colour on the hub's features, one name each,
and the four features as quarter-circle buttons that together form a circle. An earlier X of grey lines was
replaced.

1. **Code card** («打針時，請把這組代碼交給醫檢師»). **修改資料** is a 48px white circle with a black pen in
   the card's bottom-right corner (`.code-edit` → `/portal/?edit`, `aria-label="修改資料"`). The card has an
   extra 44px of bottom padding, so the circle never covers the note in either state.
2. **Four quarter-circle buttons** (`.quad`, from the owner's reference image, 2026-11-12): one circle (up to
   330px) cut into four white buttons by a 10px cross-shaped gap. Top-left 安慰指南 (`/guide/`) · top-right
   抽血大小問 (`/cheer/`) · bottom-left 玩遊戲 (`/games/solo/`) · bottom-right 看繪本 (`/books/`). DOM order
   is the reading order and keeps the owner's list order.
   - Each button is a square grid cell. The outer corner's radius is `calc(100% − 10px)` and the three
     inner corners are 10px, so the sides add up to exactly 100% and the browser never scales the radii
     down. The result is a true quarter circle around the inner corner. Hit-testing follows the rounded
     shape.
   - Content sits on the quarter disc's centroid, 0.424 × radius from the inner corner (57.5% / 42.5% of the
     cell): a black-line icon (42px, `--primary-ink`, white fill) over a black bold name.
   - **Only the pressed button reacts**: it sinks 2px, turns `#EFEBE7`, and gets a 2px black inner ring
     that follows the shape (a shape change, not colour alone). The icon fill follows through `--quad-bg`.
     `-webkit-tap-highlight-color: transparent` removes the native highlight. `home.js` adds an empty
     passive `touchstart` listener so iPhone Safari applies `:active`.
   - Focus is a 3px ink outline, which follows the radius.
   - No 單機／雙機 split on the hub. The 雙機 entry is the last card in the games list.
3. **開始打針**: a full-width `.btn-primary` below.

Section heading (等待的時候) is `sr-only`: screen readers get the structure, the screen stays wordless.

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
