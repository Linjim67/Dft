# 05 家長安慰指南 + 06 抽血大小問 — page overrides

Inherits MASTER and the subpage shell in `02-home.md`. Content lives in data files
(`/guide/content.js`, `/cheer/content.js`, source: `cheer/text.md`); the page scripts only lay it out,
so editors change wording without touching markup.

Redesigned 2026-11-12 at the owner's request ("沒有層次、像一般 FAQ、沒有溫度"; keep orange but
make it 更耐看; supporting colours allowed; parents read top to bottom). Direction contract:
`.impeccable/surfaces/guide-index-html.md`.

## Shared: the booklet (`/shared/page.css`)

- **`<body class="booklet">`** themes text selection (`--cocoa-tile`). The ink is the site-wide cocoa
  of the sand palette (MASTER).
- **Chapters carry a tone:** `data-tone="cocoa | leaf | honey"` on a `.part` sets `--tone` (ink: icons
  and labels), `--tone-soft` (large washes: speech bubbles, tip boxes) and `--tone-tile` (icon tiles,
  count badges). Tokens are in MASTER. Cocoa (`--primary-deep`) is the one *interactive* colour
  (selected age card, chips, links, buttons); the chapter tones only mark chapters.
- **Chapter heading:** a 48px tone tile with an authored SVG mark, then the `h2` (1.4rem) and a one-line
  lede. No eyebrow labels and no 01/02/03 numbering (the chapters aren't a sequence).
- **Phone-only** (MASTER): there is no desktop layout. A desktop rail was tried and removed on
  2026-11-12 because these pages are only used on phones.

## Shared: one card per question (`Anxin.buildTopic` + `.topic`)

These patterns were pinned by the owner:

- **Card list:** every `<details class="topic">` is its own white card (`--r-lg`, `--sh-sm`, 12px gap);
  an open card lifts to `--sh-md`.
- **Right side of the row:** a grey tag behind a **1px vertical bar** (`#DCCAB9`, decorative), then a
  **plain chevron** with no tinted circle (`--idle`, 4.80:1). Cheer shows 抽血前／時／後; the guide
  shows counts 「5 句」「4 個做法」. Open: the chevron flips and takes the chapter tone (not colour
  alone).
- Titles use `text-wrap: pretty` (balance wrapped CJK titles far too early on phones).
- The body sits under a hairline. Its content rises in on open (opacity and 4px translate only).
- Open/close motion (chevron turn, content rise, card lift) is **250ms** (`--t-open` on `.topic-list`);
  colour-only hovers elsewhere keep the site's 140ms.
- **Animated open/close (owner, 2026-11-14), done in script, not CSS.** Tapping a title grows or
  shrinks the card's height over 250ms with the Web Animations API (`animateTopic` in
  `shared/app.js`); closing fades the content and flips the chevron back at once (`.is-closing`).
  A tap mid-animation reverses from the current height. Search, 全部展開 and deep links still toggle
  `open` directly. Don't switch to a `::details-content` block-size transition: in Chrome 130 it
  clipped script-opened answers to zero. Reduced motion → native instant toggle.
  The guide opts out (`buildTopic(…, { animate: false })`) and runs its own, longer open/close that
  draws a tree (see 05 below).

## Shared: the closing card (`.help-card`)

Both pages end on a paper card with a leaf icon tile and outlined cocoa link buttons: the guide's 都讀完了嗎？
(→ 小遊戲, → 抽血大小問), and cheer's 還有其他疑問嗎？ (→ other parents' stories). A wash on
the cream ground was nearly invisible, which is why it is a white card.

## 05 家長安慰指南 `/guide/`

All three chapters are **leaf** (owner, 2026-11-14: 副色調 follows 打針當下), and none has a chapter
heading (`.part-head` removed): the sticky tabs name the chapter, and each tab panel is labelled by
its tab. The 「全年齡適用」 tag and the 打針當下 / 不要說 ledes went with the headings.

- **Chapter tabs** (owner's reference screenshot, 2026-11-12): three centred pills, sticky. They are
  real WAI-ARIA tabs that show **one chapter at a time**: ←/→/Home/End move between them, and
  `#say` / `#during` / `#dont` open that chapter. The selected tab is solid leaf-deep (`--pick`) with
  white text (5.99:1); the others are paper with cocoa text. Switching tabs while scrolled down rewinds to the
  tab bar, so the new chapter starts at its top.
- **Topic rows, not cards** (same screenshot; guide only, so cheer keeps its card list):
  `.topic-list.is-plain` drops the white card and shadow. Each row is a 20px icon in the chapter tone
  (in a 36px column), then the bold title, then a plain chevron, with **no right-side count**. When
  opened, the content sits directly under the title (indented 48px), in grey. Every topic has an
  `icon` in `content.js`; the icons are authored in `guide.js` (`ICONS`).
- **Opening a topic draws a tree** (owner, 2026-11-14): the lines are the chapter tone mixed 20%
  toward `--bg` (`--tree-ink`; owner asked for 淡 20%), the icon keeps the full tone. A 2px circle draws around the
  icon, starting and ending at the bottom (220ms). A vertical trunk then grows down from it at a
  steady ~0.9px/ms (200–560ms). As the trunk passes each line, a branch grows out to it and the
  line wipes in from the left (`clip-path`, not `transform`, because the branch lengths are measured
  from the lines' positions). Closing runs in reverse: the bottom branch retracts first, the trunk
  shrinks upward, then the circle unwinds. The chevron flips back at once (`.is-closing`). The card
  height animates too (Web Animations), so it never jumps open. Branches attach to the first line of
  each phrase or action, and only 怎麼說 draws them. 打針當下 and 不要說 only circle the icon, with
  no trunk or branches (owner, 2026-11-14; `plantTree(…, { lines: false })` → `.is-bare`). Their
  paragraphs, actions and pairs fade in one at a time on the same rhythm. `guide.js` measures the positions and
  re-measures on resize, font load and riddle reveals (`ResizeObserver`). Topics that open without a
  tap (the first one in each age group, find-in-page) appear already drawn. Reduced motion → instant.
- **Age cards** (2 歲以下 / 3–4 歲 / 5–9 歲): a radio group with icons and a check badge, selected in
  cocoa. Pre-selected from the profile by whole years (2歲半 → 2 歲以下; 10+ falls back to 5–9 with
  a note). Only the selected group's panel is rendered visible.
- 怎麼說 opens straight onto the age cards.
- **Phrases to say** are one per line in regular weight, with no bubbles. The tree's branch is their
  marker: a plain line for phrases, and a line ending in a 7px tone dot for actions (「做法」). Riddle
  answers hide behind 「看答案」.
- 打針當下 action lists have a 7px leaf (tone) dot before each item, centred on the first line;
  paragraphs and the bold lead have no marker. 讓孩子分心 has no game link
  inside it: the chapter ends in the **我要打針了** card (paper, 2px cocoa border, leaf icon tile) → `/games/solo/`,
  which is distinct from the top bar's 開始打針 → `/shot/`.
- 這些話先不要跟小孩說 uses the same topic rows as the other chapters (owner, 2026-11-12): only the
  titles show at first, and opening one shows its pairs. Each pair is 「✕ 不要說」 (grey text, red ✕ icon
  only) then 「✓ 改成說」 in bold with no background (green ✓ icon only; the
  bubble was removed on 2026-11-14). Both rows start flush under the title. Pairs are
  separated by a 1px solid `--rule` grey line (owner, 2026-11-14; the old dashed hairline was nearly
  invisible on the sand ground).

## 06 抽血大小問 `/cheer/` — FAQ page

Chapters: 醫療現場解密 and 抽血大小問 are both leaf (owner, 2026-11-14).

- **Search first:** a round search field (cocoa focus and caret) filters as you type. Every
  space-separated word must match, and hits are wrapped in `<mark>` (`#FED7AA` + ink). Matching
  questions open; clearing the search folds them again.
- **Phase filter:** 全部 / 抽血前 / 抽血時 / 抽血後, four across, combinable with search.
- **Status row:** 「共 18 個問題」 / 「找到 3 個和「頭暈」有關的問題」 (`role=status`) + 全部展開 ⇄
  全部收合. Chapter titles carry a live count badge in the tone tile; a chapter with no matches is
  hidden.
- **Answers (抽血大小問), structured for scanning** (owner: the old paragraphs were hard to read,
  2026-11-14). Each FAQ in `content.js` has fields instead of one paragraph, always in this order:
  **簡單說** (bold one-line answer behind a tone tag) → `lead` + `points` (always a list with leaf-deep dots,
  owner 2026-11-14; `{k, v}` items get a bold label with the explanation below) → `note` (grey) → **放心** (`calm`, leaf-soft box with a check) → **要注意** (`watch`, honey-soft
  box with a warning icon: when to tell the staff). The wording is the authors'; sentences were only
  split up, with a few joining words. 醫療現場解密 keeps its two blocks: 醫療小知識 and a 給家長的小提醒
  box in the chapter's soft tone. All of these text pieces are searchable and highlighted.
- **Deep links:** `#why-1…7` and `#faq-1…11` open and scroll to that question.
- **Empty state:** reuses `.empty-state`, with tappable suggestions (頭暈 / 瘀青 / 空腹 / 血管).
