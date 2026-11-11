# 看繪本 `/books/` — page overrides

Inherits MASTER and the subpage shell in `02-home.md`. There are no picture books yet. The page lists the
planned books and collects what the child wants, written to `bookWishes/{id}` (see `dbContent.md`).

Owner's brief (2026-11-12): add to wishlist · suggest a 繪本主題 · preferable character. Few words.

## Layout (390px, phone only)

1. **想看哪一本？** A 2-column shelf of the planned books (`Anxin.books.THEMES`). Each book is one big
   `aria-pressed` button: a 4:3 cover in its tone (`--tone-tile`, with a 7px spine shadow on the left),
   a two-tone 32 × 32 drawing, the name, and a pill 「♡ 加入願望清單」. When pressed, it gets a 2px apricot
   border, a filled heart and 「已加入」 (not colour alone).
2. **還想看什麼主題？** A pill text field (40 characters) and a 送出 button. Sent ideas show as removable
   chips (up to 5).
3. **最喜歡的角色？** Multi-select chips (`Anxin.books.CHARACTERS`) with a check when pressed, then a
   「其他角色」 field (30 characters, up to 5).

- Apricot is the only interactive colour. Covers use apricot, sage and honey. Apricot text sits only on
  `--apricot-soft` (4.78:1), never on `--apricot-tile` (4.32:1).
- Every tap saves to the phone at once (`localStorage['anxin.books.v1']`, one doc per code), then writes to
  the server after a 0.7s pause. 「✓ 已記下」 (a dark toast) appears only when the server accepts the
  write. If the write fails, the page looks the same and the next change tries again.
- Covers and characters are ids shared with `firestore.rules`. Change `shared/app.js` and
  `validBookWish` together.
