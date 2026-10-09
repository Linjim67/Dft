# 04 討論區 — page overrides

Inherits MASTER. Covers `/discussion/` and `/discussion/parent/`. Data shape and rules: `dbContent.md` → `threads`.

## Two URLs, one page

`vercel.json` rewrites `/discussion/parent/` to `discussion/index.html`. An inline `<head>` script sets
`<html data-discuss="public | clinic">` before first paint, and `.only-public` / `.only-clinic` hide what the other
mode doesn't use. One page means search, replies and ranking can't drift apart between the two groups.

| | Public `/discussion/` | Parent `/discussion/parent/` |
|---|---|---|
| Reached from | shared link | 回饋 → 已收到 dialog / page |
| Top bar | 「安心陪伴」 label (no profile, so no home) | ‹ 回主頁 |
| Composer | 稱呼 (optional), 身分 chips, children cards, content, tags | identity card (「以家長身分匿名分享」, 孩子：3 歲半女孩), content, tags |
| Reply | content + 身分 `<select>` + 稱呼, remembered | content only, 「以家長身分匿名回覆」 |
| Extras | — | 「和{暱稱}差不多大」 chip (age ± 2); 推薦 boosts posts near the child's age |

The parent URL without a profile falls back to the public page (`location.replace`, keeping `#t=…`). It does **not**
send the parent back to the #01 form: someone who just finished the shot shouldn't fill in personal info again to read a forum.

## Views (hash routes)

`#` list · `#t=<id>` one post · `#new` composer. The phone's back button moves between them. 「所有討論」 uses
`history.back()` when the list was seen in this visit (so scroll position survives), otherwise `replaceState`.
After 發布, `#new` is replaced with `#t=<id>`, so back goes to the list instead of an empty form. Focus moves to the view's heading
(outline removed, as on `/shot/`), and returning from a post focuses that post's card.

## Components

- **Cards**: whole card is the link (stretched `::after` on the excerpt link). Tags on cards are text, not buttons, so
  nothing interactive is nested inside a link. In the post view, tags are buttons that search that tag.
- **Chips**: pills with a 1px taupe border. Selected chips get primary-wash plus a deep-orange border **and a check glyph**
  (MASTER: colour is never the only signal). 48px tall.
- **Role pill**: neutral for 家長 / 其他, orange wash for 醫師 / 護士 / 醫檢師. The text carries the meaning.
- **有幫助**: a toggle (`aria-pressed`); pressed fills the heart, so the shape changes, not only the colour. Hidden on your own posts.
- **Children cards**: one white card per child or age group, removable when there's more than one. Parents get one slider
  (untouched = 「尚未選擇」, required, same as #01) and 男孩／女孩. Professionals get two sliders (從 / 到, which push each other)
  defaulting to 各年齡 and 男孩／女孩／都有. Switching role converts what was already entered.
  The slider follows the #04 spec: half years below 5, whole years from 5 (#01 uses 6).
- **Fieldset legends** are floated in this page, so the divider sits above the question as it does for `div` fields.
  (#01 and 回饋 still show the legend sitting on the line.)
- **Cooldown**: both send buttons are disabled and read 「12 秒後可以再發言」 for 15 s after any post or reply.
  The server enforces the same rule (`cooldowns/{uid}`).

## Copy

Uses 您 throughout. The composer's footer says posts are public and asks people not to write full names, phone numbers or
chart numbers. On the parent page, the identity card says the nickname is never shown and is replaced with 「孩子」 in the text.
