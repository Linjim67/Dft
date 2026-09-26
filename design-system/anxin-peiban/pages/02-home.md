# 02 主頁面 + 子頁外框 — page overrides

Inherits MASTER. Covers `/home/` and the shell shared by every subpage (`/shared/page.css`).

## Routing

| Route | Needs profile | Notes |
|---|---|---|
| `/` | no | #01 form. A valid profile redirects to `/home/` from `<head>`, so the form never flashes. |
| `/home/` | yes | #02 hub |
| `/guide/` `/cheer/` `/games/solo/` `/games/duo/` | yes | scaffolds — 「內容準備中」 |
| `/shot/` `/feedback/` | yes | #03 |
| `/thanks/` | no | profile may have expired by then; personalises only if present |
| `/discussion/` | no | #04 placeholder; the spec opens it to everyone |

Protected pages guard in `<head>` with `Anxin.requireProfile()` → `location.replace('/')`.

- **Every internal path is root-absolute** (`/styles.css`, `/home/`). Vercel may serve `/home` without
  redirecting to `/home/`, and from there `./home.css` resolves to `/home.css`. Absolute paths survive
  both forms; the smoke test requests both.
- Navigation that shouldn't be returned to uses `location.replace` — submitting #01 must not leave a
  back-button entry that bounces straight to `/home/` again.

## Hub layout — the spec's five parts, in order

1. **Briefing**: 「{暱稱}的小檔案」, the code card (with 「打針時，請把這組代碼交給醫檢師」), summary rows,
   quiet 重新填寫.
2–3. 家長安慰指南 / 給家長的鼓勵 as **whole-card links** — one large target, no second button hidden inside.
4. 小遊戲 as one chunk holding **two** buttons, each with a subline (一支手機 / 兩支手機一起玩) because
   「單機／雙機」 alone is jargon to a parent.
5. **開始打針** — full-width `.btn-primary`, separated by `--sp-6` so it reads as its own step.

## Subpage shell

- Top bar: 「‹ 回主頁」 + a persistent 「開始打針」 pill (spec: reachable from any subsection).
  Not shown on `/shot/` itself.
- **No needle or syringe imagery anywhere.** These screens sit in front of anxious children; the CTA uses
  a neutral arrow.
- 重新填寫 is destructive (wipes profile + code), so it confirms in a `<dialog>` with **autofocus on
  取消** — an accidental Enter must not wipe data.

## Contrast notes specific to this shell

- `.pill-cta` text is 17px bold — *normal* text, since large-bold starts at 18.66px. Its hover therefore
  cannot darken to `#FFE2C4` (4.17:1); it lifts with a shadow instead. `.btn-primary` can use that
  hover only because its 18.7px bold label counts as large text.
