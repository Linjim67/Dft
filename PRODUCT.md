# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Parents waiting with a child for an injection or blood draw in a hospital or clinic waiting room. The parent operates the phone; the child often watches the screen alongside them, and plays the mini games on it. The parent is anxious too, and has a few minutes to fill before being called.

## Product Purpose

安心陪伴 lowers the anxiety of both the child and the parent before and during a paediatric injection or blood draw. Success is a calmer child and parent at the moment of the procedure, plus feedback that helps the team improve.

## Positioning

A one-visit companion handed over in the waiting room: no sign-up, no name or medical record number, a 4-digit temporary code that links the family's answers to the 醫檢師 for that one procedure and expires within a day.

## Operating Context

- Flow: the parent fills a short profile (child's nickname, age, gender, how afraid the child is, how worried the parent is, optional notes for the staff), gets a temporary code, then waits on the home page with: 家長安慰指南 (what to say to the child), 抽血大小問 (what is happening in the blood-draw room, FAQs), mini games (one phone or two paired phones), and 開始打針.
- The 醫檢師 looks up the code on a separate staff page (`/pro/`) to see the profile before the procedure and rates the child's actual fear afterwards.
- After the procedure, the parent can leave feedback and join a public discussion board about comforting children.
- Parents tend to read the guide and encouragement pages from top to bottom while waiting.

## Capabilities and Constraints

- Phone-only: every page is used on a phone in the waiting room, except the 醫護端 staff page (`/pro/`), which is used on desktop or tablet. Parent and child pages need no desktop layout; on a wide screen they simply show the phone column.
- Language: Traditional Chinese (zh-Hant-TW).
- Bright mode only, by product-owner decision.
- Static site on Vercel (vanilla HTML/CSS/JS, no build step); Firestore for codes, feedback, staff feedback, discussion and two-phone game rooms.
- No account. The child's nickname never leaves the phone; free text is scrubbed of the nickname before upload.

## Brand Commitments

- Name: 安心陪伴.
- Warm and reassuring, never clinical; the child's fear is never framed as a failure.
- The visual world is the sand palette approved by the owner on 2026-11-12: sand ground `#E9E1D8`, cocoa ink, leaf green `#87AE73` as the supporting colour, no orange, and outlined cocoa buttons with 16px corners (see `design-system/anxin-peiban/MASTER.md`). It stays warm and coloured: a black/grey-only text treatment was tried earlier and reverted. Games keep their own palettes.

## Evidence on Hand

- Guide and encouragement copy: `cheer/text.md` (source), `guide/content.js`, `cheer/content.js`.
- No testimonials, statistics or clinical claims exist; none may be invented.

## Product Principles

1. Calm first: every screen should lower anxiety, for the child and the parent.
2. Nothing to set up: no registration, nothing to remember beyond a short-lived code.
3. Private by default: nicknames stay on the phone; staff see only what helps them care for the child.
4. Speak to both: the parent operates, the child co-views.

## Accessibility & Inclusion

Text pairs at least 4.5:1, control borders at least 3:1, touch targets at least 48px, colour never the only signal, and reduced motion respected (see `design-system/anxin-peiban/MASTER.md`).
