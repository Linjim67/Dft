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
| Composer | 稱呼 (optional), 身分 chips, one child (age + gender), content, tags | identity card (「以家長身分分享」, 孩子：3 歲半女孩), 稱呼 (optional), content, tags |
| Reply | content + 身分 `<select>` + 稱呼, remembered | content + 稱呼 (optional), remembered; 「以家長身分回覆」 |
| Extras | — | 「和{暱稱}差不多大」 chip (age ± 2); 推薦 boosts posts near the child's age |

The parent URL without a profile falls back to the public page (`location.replace`, keeping `#t=…`). It does **not**
send the parent back to the #01 form: someone who just finished the shot shouldn't fill in personal info again to read a forum.

## Views (hash routes)

`#` list · `#t=<id>` one post · `#new` composer. The phone's back button moves between them. 「所有討論」 uses
`history.back()` when the list was seen in this visit (so scroll position survives), otherwise `replaceState`.
After 發布, `#new` is replaced with `#t=<id>`, so back goes to the list instead of an empty form. Focus moves to the view's heading
(outline removed, as on `/shot/`), and returning from a post focuses that post's card.

## Components

- **Cards**: whole card is the link (stretched `::after` on the excerpt link). Tags on cards are text, not buttons.
  The heart is the one exception: a like button stacked above the link (`z-index`, a sibling of the link, not inside it),
  so one tap likes without opening the post. It looks small but keeps a 48px hit area through negative margins.
  In the post view, tags are buttons that search that tag.
- **Card colours (owner's choice)**: content text black `#1C1917` (`--primary-ink`), hashtags `#7C2D12` (`--fg`), names unchanged.
  The post page and replies use the same colours, so a post doesn't change colour when it's opened.
- **Chips**: pills with a 1px taupe border. Selected chips get primary-wash plus a 2px deep-orange border. **No check glyph**
  (owner's choice, an exception to MASTER's check badge); the doubled border width is the non-colour cue, the same one the
  #01 face scale uses. 48px tall.
- **Role label**: plain bold text in the same grey as the time, no box, the same for every role (owner's choice), and
  separated from the name by 「·」 like name and time: 「家長 · 阿哲爸爸 · 剛剛」. On posts it follows the magnifier icon
  on line 2 (line 1 is the child); replies show it without an icon.
- **有幫助 (like)**: a toggle (`aria-pressed`), drawn the same everywhere: just the heart SVG and the count, no box and no
  「有幫助」 text (owner's choice). The hit area is 48px around the heart, so tapping near it counts. Pressed fills the heart,
  so the shape changes, not only the colour, with a short pop (off under reduced motion). Works on your own posts and on
  early-prototype posts. The phone keeps the list of liked posts (`anxin.discuss.liked.v1`) so cards show filled hearts
  without one read per post, and re-checks with the server when a post is opened.
- **Paper plane** (post page, after the reply count): copies the current address (the post's `#t=` link) and shows
  「網址已複製」 in a dark-brown pill near the bottom for ~2 s (also read out by the live region). Falls back to
  select + `execCommand('copy')` where the Clipboard API is missing or blocked; if both fail it says 「沒有複製成功，請從網址列複製」.
- **One child per post** (owner's decision): no 新增另一個孩子 button. The child's age and gender sit directly under the
  question, flat like #01, with the hint 「一篇寫一個孩子；其他孩子的經驗，可以再發一篇」. Parents get one slider
  (untouched = 「尚未選擇」, required, same as #01) and 男孩／女孩. Professionals get one age-range bar (below)
  defaulting to 各年齡 and 男孩／女孩／都有. Switching role converts what was already entered. The rules accept exactly one.
- **Age range bar** (filter + professionals): one track, two handles, orange between them, 0 歲 / 18 歲 under the ends.
  Two native range inputs are stacked for keyboard and screen readers (「最小年紀」「最大年紀」); the outer box handles
  pointers: drag the nearer handle; when both sit on the same age, the drag direction decides; a plain tap moves the
  nearest handle (WCAG 2.5.7, no drag needed). Nothing moves until the finger travels 4px sideways, so a vertical
  scroll that starts on the bar doesn't change it. The low end can't pass the high end. Keyboard focus rings the
  focused handle, not the whole bar.
  The slider follows the #04 spec: half years below 5, whole years from 5 (#01 uses 6).
- **Fieldset legends** are floated in this page, so the divider sits above the question as it does for `div` fields.
  (#01 and 回饋 still show the legend sitting on the line.)
- **Cooldown**: both send buttons are disabled and read 「12 秒後可以再發言」 for 15 s after any post or reply.
  The server enforces the same rule (`cooldowns/{uid}`).

## Copy

Uses 您 throughout. The composer's footer says posts are public and asks people not to write full names, phone numbers or
chart numbers. On the parent page, the identity card says the child's nickname is never shown and is replaced with 「孩子」.

**Names.** 稱呼 is optional everywhere; blank shows 匿名. Parents naturally type 「小恩媽媽」, so the name goes through the same
nickname scrub as the text. A line under the field previews the result (「會顯示為『孩子媽媽』」) whenever the scrub changes it,
so the parent isn't surprised after posting. The phone remembers what they typed, not the scrubbed version.
