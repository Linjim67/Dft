# 05 家長安慰指南 + 06 給家長的鼓勵 — page overrides

Inherits MASTER and the subpage shell in `02-home.md`. Content lives in data files
(`/guide/content.js`, `/cheer/content.js`, source: `cheer/text.md`); the page scripts only lay it out,
so editors change wording without touching markup.

## Shared: collapsible topics (`Anxin.buildTopic` + `.topic` in `/shared/page.css`)

- Native `<details>/<summary>`: keyboard, screen-reader state and find-in-page come free.
- **One card per group, hairline dividers** (settings / help-centre list), not one floating card per
  question: a dozen stacked shadows was the noisiest thing on the page. Dividers are drawn only between
  *visible* items (`.topic:not([hidden]) ~ .topic:not([hidden])`) so filtering never leaves a stray line.
- Row: optional 40px icon tile · title + optional meta line · 32px round chevron. Open = title turns
  `--primary-deep` **and** the chevron flips (not colour alone).
- **No height animation.** A `::details-content` block-size transition clipped answers to zero in
  Chrome 130 when items were opened by script; the chevron turn is the only motion.
- Focus ring is drawn inside (`outline-offset: -3px`) because the group card clips overflow.

## 05 家長安慰指南 `/guide/`

- **Sticky section menu** (怎麼說 / 打針當下 / 不要說), 48px pills, `aria-current` via
  IntersectionObserver; gains a soft shadow once stuck. Sections carry `scroll-margin-top: 76px`.
- **Age cards** (2 歲以下 / 3–4 歲 / 5–9 歲): radio group with icon (baby / bear / backpack), check badge
  when selected. Pre-selected from the profile by whole years — 2歲半 → 2 歲以下; 10+ falls back to 5–9
  with a one-line note. Only the selected group's panel is rendered visible.
- Topic meta counts what's inside (「5 句可以說的話」「4 個做法」) so parents can choose without opening.
- Phrases to say are speech bubbles (`--bg-sunk`, tail bottom-left); actions are dot lists; riddle
  answers hide behind 「看答案」 so the parent can ask first.
- 打針當下 items get icon tiles; the section ends in the **我要打針了** card → `/games/solo/` (spec: the
  distraction content), distinct from the top bar's 開始打針 → `/shot/`.
- 這些話先不要跟小孩說 is **not collapsed** — GOV.UK: don't hide content every user needs. Each pair is
  「✕ 避免」 (muted) then 「✓ 改說」 in the same speech-bubble style as the phrases above.

## 06 給家長的鼓勵 `/cheer/` — FAQ page

Patterns taken from help centres and the GOV.UK accordion:

- **Search first**: pill search field at the top, filters as you type; every space-separated word must
  match; hits wrapped in `<mark>` (`#FED7AA` + `--fg` = 6.92:1, kept dark even inside orange titles).
  Matching questions open so the highlight is visible; clearing the search folds them again.
- **Phase filter**: 全部 / 抽血前 / 抽血時 / 抽血後 (`when` in content.js), combinable with search.
  The phase also shows as each question's meta line.
- **Status row**: 「共 18 個問題」/「找到 3 個和「頭暈」有關的問題」 (`role=status`) + 全部展開 ⇄ 全部收合.
- Section titles carry a live count badge; a section with no matches is hidden.
- **Answer lead**: the first sentence of each 打針大小問 answer is bold — the short answer, then detail.
  醫療現場解密 keeps the authors' two blocks: 醫療小知識 and a washed 給家長的小提醒 box.
- **Deep links**: `#why-1…7`, `#faq-1…11` open and scroll to that question.
- **Empty state** reuses `.empty-state` with tappable suggestions (頭暈 / 瘀青 / 空腹 / 血管).
- **Closing card** 「還有其他疑問嗎？」 → ask the staff on site, or `/discussion/parent/`.
