# 05 家長安慰指南 + 06 給家長的鼓勵 — page overrides

Inherits MASTER and the subpage shell in `02-home.md`. Content lives in data files
(`/guide/content.js`, `/cheer/content.js`, source: `cheer/text.md`); the page scripts only lay it out,
so editors change wording without touching markup.

Redesigned 2026-11-12 at the owner's request ("沒有層次、像一般 FAQ、沒有溫度"; keep orange but
make it 更耐看; supporting colours allowed; parents read top to bottom). Direction contract:
`.impeccable/surfaces/guide-index-html.md`.

## Shared: the booklet (`/shared/page.css`)

- **`<body class="booklet">`** sets the ink to chocolate `#4A2A1C` (12.8:1) instead of the site's
  red-brown `#7C2D12`, so apricot reads as an accent rather than everything blurring into
  brown-orange. Text selection uses `--apricot-tile`.
- **Chapters carry a tone:** `data-tone="apricot | sage | honey"` on a `.part` sets `--tone` (ink: icons
  and labels), `--tone-soft` (large washes: speech bubbles, tip boxes) and `--tone-tile` (icon tiles,
  count badges). Tokens are in MASTER. Apricot stays the one *interactive* colour (selected age card,
  chips, links, CTAs); sage and honey only mark chapters.
- **Chapter heading:** a 48px tone tile with an authored SVG mark, then the `h2` (1.4rem) and a one-line
  lede. No eyebrow labels and no 01/02/03 numbering (the chapters aren't a sequence).
- **Desktop ≥ 64rem:** `main.booklet-layout` becomes an `18rem` sticky `.rail` (title plus chapter
  index or search) beside a `.flow` reading column (max 42rem). On mobile, `.rail` is
  `display: contents`, so the guide's chapter pills can stick to the whole page.

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
- **No height animation.** A `::details-content` block-size transition clipped answers to zero in
  Chrome 130 when items were opened by script (search opens matches).

## Shared: the closing card (`.help-card`)

Both pages end on a white card with an apricot icon tile and pill links: the guide's 都讀完了嗎？
(→ 小遊戲, → 給家長的鼓勵), and cheer's 還有其他疑問嗎？ (→ other parents' stories). A wash on
the cream ground was nearly invisible, which is why it is a white card.

## 05 家長安慰指南 `/guide/`

Chapters: 怎麼說 = apricot · 打針當下 = sage · 不要說 = honey.

- **Chapter menu:** on mobile, three sticky pills with tone dots, `aria-current` via
  IntersectionObserver, and a soft shadow once stuck. On desktop, a vertical index in the rail.
  The current chapter gets its tone's soft fill, inner ring and ink.
- **Age cards** (2 歲以下 / 3–4 歲 / 5–9 歲): a radio group with icons and a check badge, selected in
  apricot. Pre-selected from the profile by whole years (2歲半 → 2 歲以下; 10+ falls back to 5–9 with
  a note). Only the selected group's panel is rendered visible.
- **Phrases to say** are speech bubbles in the chapter's soft tone, regular weight, tail bottom-left,
  sized to their text. Actions are dot lists in the tone colour. Riddle answers hide behind 「看答案」.
- 打針當下 rows carry sage icon tiles. The chapter ends in the **我要打針了** card (white, 2px apricot
  border) → `/games/solo/`, which is distinct from the top bar's 開始打針 → `/shot/`.
- 這些話先不要跟小孩說 is **not collapsed** (GOV.UK: don't hide content every user needs). Each pair is
  「✕ 避免」 (grey text, red ✕ icon only) then 「✓ 改說」 in a honey speech bubble (green ✓ icon
  only). The tags have no coloured pill, which keeps the card quiet.

## 06 給家長的鼓勵 `/cheer/` — FAQ page

Chapters: 醫療現場解密 = sage · 打針大小問 = honey.

- **Search first:** a pill search field (apricot focus and caret) filters as you type. Every
  space-separated word must match, and hits are wrapped in `<mark>` (`#FED7AA` + ink). Matching
  questions open; clearing the search folds them again.
- **Phase filter:** 全部 / 抽血前 / 抽血時 / 抽血後, combinable with search. Four across on mobile,
  2×2 in the desktop rail.
- **Status row:** 「共 18 個問題」 / 「找到 3 個和「頭暈」有關的問題」 (`role=status`) + 全部展開 ⇄
  全部收合. Chapter titles carry a live count badge in the tone tile; a chapter with no matches is
  hidden.
- **Answers:** in 打針大小問, the first sentence is bold (the short answer). 醫療現場解密 keeps the
  authors' two blocks: 醫療小知識 (tone label) and 給家長的小提醒, a box in the chapter's soft tone.
- **Deep links:** `#why-1…7` and `#faq-1…11` open and scroll to that question.
- **Empty state:** reuses `.empty-state`, with tappable suggestions (頭暈 / 瘀青 / 空腹 / 血管).
