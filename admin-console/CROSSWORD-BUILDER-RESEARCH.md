# Crossword builder research — what Crosscut's constructor should borrow

**Finding:** eight constructors were verified from their own sites, docs or source; the one that matches Crosscut most closely is Crosshare, whose builder opens on a 5×5 by default, turns symmetry **off** below 49 cells, and splits its pre-publish checks into blocking errors and non-blocking warnings — exactly the shape E4/E6 need.
**Confidence:** high on Crosshare, Exet, CrossFire, Crosserville and Ingrid (primary docs or AGPL source read directly); medium on Crossword Compiler and PuzzleMe (marketing pages only); the NYT's own submission page could not be fetched, so its rules are cited from Wikipedia and are secondary.
**Peter decides:** whether the 9×9 keeps a rotational-blocks toggle at all (the seeded `en-cross-0001` is not symmetric), and whether the word-square repeated clue is a warning or a hard block.

## Tools surveyed

| Tool | Grid editing | Fill help | Clues | Validation | Preview | Export | Notes | Src |
|---|---|---|---|---|---|---|---|---|
| Crosshare (web, AGPL) | Opens on 5×5; any size; `.` toggles a block, any letter toggles back, mobile has an all-black key; symmetry enum Rotational / Horizontal / Vertical / None / two diagonals, defaulting to **None under 49 cells** and Rotational at or above; bars supported | Background-worker autofiller fills the rest of the grid live as you type; `Enter` or "Rerun Autofill" gives a different fill; can be switched off; wordlist panel beside the grid, and any word may be typed | Separate "Clues" view listing every entry with one input each; clue-suggestion overlay; enumerations parsed | Errors block publish: grid not full, no title, missing clues (counted **per occurrence** of an answer). Warnings do not: repeated entries, two-letter words, unches, clue refs to entries that don't exist, missing or wrong enumerations | Same mobile-first solver UI the reader gets; embeddable | `.puz` in and out (barred grids can't export) | One work-in-progress per browser in `localStorage`; typing DELETE discards it | S1 S2 S3 |
| Exet v1.08.1 (web, free) | "New" menu offers lattice, US-style doubly-checked, blank and 3-D starts; blocks and bars added by hand or "automagically"; grid edits stay symmetric unless "Allow asymmetry" is ticked | Beam-search autofill; "viablots" — coloured dots on cells whose crossings are running out of candidates; Lufz (~276k) and Nediger (346k+) lexicons with popularity scores; regexp entry constraints; custom word lists not supported | Clue panel with cryptic analysis; dupe detection across clue text using stemmed forms, entries included | Analysis panel: connectivity, symmetry, consecutive unches, vertical and horizontal through-cut sizes, entry-length distribution, clue/entry dupes, long common substrings | Exolve player output | Exolve HTML, PDF, `.puz`, `.ipuz`; opens `.puz`/`.ipuz` | Keeps **every revision** of every crossword in browser storage; JSON backup export | S4 S5 |
| Phil (web, Apache 2.0) | Browser grid with symmetry tools | 100,000-entry custom dictionary suggesting across and down entries on the fly; Glucose 3.0 SAT solver | Clue list | Implied by the one-click solvable output | PDF | `.xw` (JSON) and `.puz` in and out, PDF, NYT submission | Oldest of the set; the `.xw` JSON idea is the closest analogue to Crosscut's own format | S6 S7 |
| CrossFire (desktop) | Three selection modes — square, whole word (light blue, Tab or perpendicular arrow flips direction), and drag-selected area; blocks by Shift-click or `PERIOD` | Fill tab ranks candidates by Word Score, Grid Score and Final Score, strikes candidates that lead nowhere and **bolds those proven to fill**; one-click Quick Fill; dictionaries scored 1–100; regex filters | Clues tab, Tab / Shift-Tab between entries; connected clue database shows all known clues for the selected word, double-click inserts | Summary tab: word counts by length with one- and two-letter words in pink, letter frequency, unused letters. Words tab: scores plus a crossing score (XScore), shared-substring highlighting | Print or PDF | Across Lite (binary and text), PNG, tab-delimited text, NYT submission format | Rebus support; Ctrl-T marks theme entries and protects them from deletion | S8 |
| Crossword Compiler 11 (desktop) | New Puzzle wizard picks type and size; American, cryptic, freeform, barred and shaped grids | Automatic filler from a word list; Pro Grid Filler add-on for semi-automated filling with manual control | AI clue and theme generators | Not documented on the pages read | Print preview | PDF, JPG, PNG, TIFF, SVG, EMF, RTF; web-publishing applet | The commercial baseline; word lists sold separately | S9 S10 |
| Ingrid (desktop, beta, freeware) | Symmetry controls in a Layout panel | Guided autofill; curated built-in wordlist, other lists can be added and the combined list ranked; regex filter with `@` for any vowel and `#` for any consonant | FAQ lists "clue database display" among the things it does **not** do | Not documented in the FAQ | Not documented | Projects live in one SQLite file | Built-in versioning; explicitly no collaborative editing and no easy cross-machine sync — the FAQ suggests screen-sharing | S11 S12 |
| Crosserville (web) | Multi-square selection with bulk toggle block / circle / shaded / delete | ~151k default list derived from 43k published grids; A–E ratings on 3–5 letter words (A = sparkle, E = avoid); numeric scores; per-slot alternative lists | Clue database of 11,974 NYT grids plus others; limited HTML in clue text | Grid score, "Grid Flow" connectivity metric, letter-distribution charts | PDF | Across Lite 1.4 and 2.0, PDF | Cloud sharing and a comparison tool; the current web alternative to Crosshare | S13 |
| Amuse Labs PuzzleMe (hosted) | Hosted authoring; import then keep editing | AI generates topical grids or improves an existing one | Rich media in clues; 40+ languages | Not documented | Hosted interactive preview | Imports CSV, XML, JPZ, PUZ; embeds via JS, iframe or WordPress | Publisher platform, not a constructor tool; analytics and difficulty heatmaps | S14 |

Reference rules, not a tool: NYT grids are 15×15 (≤78 words themed, ≤72 themeless) or 21×21 (≤140), 180° rotational symmetry, no unchecked squares, minimum answer length three (S15). ipuz v2.0.2 is JSON, free to use in software, © 2022 Puzzazz (S16). Scored word lists are the norm — XWord Info's has 253,290 entries scored 5 (avoid) to 60 (great) (S17). The 2025–2026 constructor landscape is Ingrid, Crosserville and Crosshare (S18).

## Interaction patterns worth borrowing

| Pattern | From | Why it fits Crosscut |
|---|---|---|
| No symmetry control below 49 cells; rotational only above | Crosshare's default (`width * height < 49 ? None : Rotational`) | A 5×5 Mini is 25 cells. Symmetry is not a rule the editor should be asked about at all; the 9×9 (81) is where a toggle earns its place. |
| Errors block, warnings inform, both name the offending entries | Crosshare's publish split | Maps onto E4 → E6 and onto the console rule that a blocked action must say exactly why. |
| Missing-clue check counted per occurrence of an answer | Crosshare | The word-square Minis repeat the same answer across and down; a single clue must not satisfy both slots. |
| Whole-slot selection highlighted, Tab or perpendicular arrow flips across/down | CrossFire | The same gesture the player has (tapping a cell cycles the across/down words through it). Editor and Play screen then behave alike. |
| One key toggles a block, any letter toggles it back | Crosshare | No mode switch, no toolbar; the fastest possible edit on a grid this small. |
| Candidate list beside the grid for the selected slot, scored, and a free-text escape hatch | Crosshare, CrossFire, Ingrid, Crosserville | Crosscut already has a per-language scored word bank; showing it per slot is cheap and does not commit to autofill. |
| Per-cell viability dot when a crossing slot has no candidate left | Exet's viablots | On a 5×5 double word square all ten slots interlock, so the first dead crossing is the only thing worth surfacing. |
| Connectivity and unchecked-cell reporting | Exet's Analysis panel | The pipeline makes fully-checked a hard rule for Minis, so this belongs in the live checks rather than in a report. |
| Two-way binding between the grid and the clue list | CrossFire, Crosshare | Grid left, clue list right fits at 1440; selecting either side focuses the other. |
| Length-mismatch check between the typed answer and the slot | Crosshare's enumeration check | Crosscut's equivalent guards the `answer` tuple against `sol`. |
| Clue-text dupe detection against the entries | Exet | The pipeline's hard rule that a clue must not contain its answer is the same check, and LLM-drafted clues make it necessary. |
| Import a file and keep editing it | Crosshare (`.puz` upload), PuzzleMe | E1 already imports JSON; converting `.puz`/`.ipuz` on the way in lets an editor draft in a desktop tool. |
| Revisions kept automatically | Exet, Ingrid | Crosscut gets this from git plus the version increment in E3. Borrow the expectation, not the storage. |

## Patterns to skip for the MVP

| Skipped | Reason |
|---|---|
| Full grid autofill in the console | The CSP filler already runs offline in the repo; the editor's job is review, not generation. |
| Theme entries and theme protection | Crosscut has one `themeWord`, pinned before the fill runs — not a protected theme set. |
| Rebus | The player grid is one letter per cell and the lock sweep assumes it. |
| Barred grids, Schrödinger squares, alternate solutions | One solution per crossword; the recursive lock sweep has no meaning otherwise. |
| Circles and shaded cells | Neither the authoring format nor the Play screen has a cell style. |
| 15×15 symmetry tooling, word-count budgets, black-square percentages | Meaningless at 25 or 81 cells. |
| Clue databases of previously published crosswords | No Crosscut corpus exists yet, and none exists at all for uk and ru. |
| Cryptic analysis, enumerations, ninas | The question banner shows a plain clue and a direction chip, nothing else. |
| Live multi-user editing | No tool surveyed has it; PR review is already Crosscut's collaboration model. |
| `.puz` / `.ipuz` export from the console | The repo JSON is the source of truth; interchange is an import-side concern. |
| AI clue generation inside the editor | Drafting is a batch job upstream; the editor reviews and rewrites text. |
| Solve analytics and difficulty heatmaps | Operations, not the Content tab. |

## Proposal: the New crossword dialog and the crossword editor Content tab

### New crossword dialog

Four fields, opened from Library → New game with the Crosswords tab active (E2). No symmetry field.

| Field | Control | Default | Writes |
|---|---|---|---|
| Title | Single-line text | Empty | `title` — required before Approve, not before Save |
| Language | Segmented EN / УК / РУ | Operator's last used | `lang`, and with it the alphabet, word bank and dictionary every check uses |
| Difficulty | Segmented Easy / Medium / Tricky | Medium | `difficulty` |
| Grid size | Two cards: Mini 5×5 · par 5:00 · daily, and Weekend 9×9 · par 10:00 | Mini | `kind`, `size`, `par`; the Mini card also sets `shape: word-square` and turns the fully-checked rule on |

Create opens the editor on a Draft with an empty grid of that size and an empty clue list.

### Content tab layout

Two columns at the 1440 × 800 reference viewport.

- **Left — grid.** Fixed 44px cells (5×5 = 244px, 9×9 = 428px including gaps), derived numbers in the top-left corner of each starting cell, and a one-line stats strip beneath: open cells, slot count, filled percentage, and the number of failing checks.
- **Right — clue list.** Across then Down, in the canonical order the format stores. One row per slot: number badge, direction, an answer field (Chivo Mono, upper-case, fixed to the slot length) and a clue field with a character counter that appears past 70. Selecting a row highlights its slot in the grid; selecting a slot scrolls its row into view and focuses the clue field.

### Cell states

The editor reuses the Play screen's vocabulary so the two never drift.

| State | Editor | Player equivalent |
|---|---|---|
| Block | Ink fill | Block |
| Empty | Card fill, ink 35% border | Empty |
| Letter | Card fill, near-black letter | Filled |
| In the selected slot | Accent-tint fill, 2px accent border | Active word |
| Caret cell | 3px accent border | Next to type |
| Flagged by a live check | Gold 2px border and a gold corner dot | Editor only |
| Hard error | Error-tint fill, error border | Error |

### Block toggling

`.` toggles the cell under the caret; typing a letter over a block clears it back to a letter cell. At 5×5 there is no mirroring and no symmetry control. At 9×9 the grid header carries a **Rotational blocks** toggle, on by default: while it is on, toggling a cell toggles its 180° partner and both animate. It stays switchable because the seeded weekend crossword is not symmetric.

### Slots, numbering and answer entry

- Slots are derived, never typed. A cell starts an across slot when it is open and the cell to its left is a block or off-grid and at least one open cell follows; the mirrored rule gives down slots. Numbers run in reading order, one number per starting cell, shared by both directions.
- The list order — every across in reading order, then every down — is the order the Play screen's "QUESTION n OF 10" index walks, so it is data, not presentation.
- Renumbering is immediate on every block toggle. Clue text is bound to its slot by `(row, col, direction)`, not by number, so a toggle that renumbers the grid never scrambles the clues.
- Answers can be typed into the grid or into the answer field; both write the same cells, and a crossing letter changed from one side updates the other. A conflict paints the crossing cell in error-tint until one side gives way.
- Clue text is edited only in the right column, never in the grid.
- For a word square the across and down answer sets are identical, so each down row is pre-filled with its across clue and marked "same as 1-Across" until the editor rewrites it. It carries a warning, not a block: the same clue appearing twice in the banner reads badly but is not invalid.

### Live checks

Recomputed on every edit, counted in the Content tab header, listed under the clue column, each row clicking through to the offending cell or clue. They never block Save — a Draft is allowed to be half-built.

| Check | Level | Fires when |
|---|---|---|
| Unchecked letter | Error at 5×5, warning at 9×9 | An open cell belongs to only one slot |
| Disconnected region | Error | Open cells form more than one connected group |
| Word shorter than three | Error | A derived slot is two cells long |
| Answer length mismatch | Error | The typed answer is not the slot's length |
| Missing clue | Error | A slot has no clue text, counted per occurrence so a word square needs both |
| Duplicate answer | Error, except the across/down pair of a word square | The same answer sits in two slots |
| Letter outside the language | Error | After NFC and locale upper-casing a character is outside the language's alphabet, or Latin and Cyrillic are mixed |
| Not in the word bank | Warning | The answer is absent from that language's bank |
| Clue contains its answer | Error | The normalized answer, or the answer less a one- or two-letter suffix, appears in the clue |
| Clue over 90 characters | Warning | The banner would wrap past three lines |
| `themeWord` not an answer, or a `reveal` index out of range | Error | The feed cover would render wrong |
| Non-default par | Warning | Par is not 300 at size 5 or 600 at size 9 |
| Clue count is not ten | Warning | The banner reads "QUESTION n OF 10" |

### What Run validation adds

1. It runs the shared validator — the same `packages/shared/src/puzzle/` code CI and the import endpoint run — so a pass here means the file will not be rejected downstream.
2. It canonicalizes and shows the result as a before/after the editor accepts: NFC plus locale upper-casing of every letter, hyphens and apostrophes stripped from answers, `num` derived, across and down re-ordered into canonical order.
3. It runs the cross-file checks a single open crossword cannot see: unique id, no second crossword on the same drop date in the same language, `themeWord` not reused within 30 days.
4. It produces the `{ public, secret }` split and the content hash the import endpoint compares, so Preview (E5) renders the exact payload the player will receive.
5. It writes the Passed or Failed result that Approve (E6) is gated on; while it is disabled, Approve names the failing check.

Live checks are the fast local approximation; Run validation is the authority. The header shows one status — either "n checks failing" or "Validation passed" — never both a pill and a sentence restating it.

Preview needs nothing new: it renders the public payload in the 390 × 844 frame at real cell sizes (54px at 5×5, 33px at 9×9) with the question banner, so clue length and the `themeWord` reveal are judged at the size the player sees them.

## Sources

| Ref | Source | URL | Date |
|---|---|---|---|
| S1 | Crosshare — constructor page copy, in the component that renders it | https://raw.githubusercontent.com/crosshare-org/crosshare/master/app/components/ConstructOrUploadPage.tsx | Accessed 2026-09-09 |
| S2 | Crosshare — builder reducer: publish errors and warnings, symmetry default | https://raw.githubusercontent.com/crosshare-org/crosshare/master/app/reducers/builderReducer.ts | Accessed 2026-09-09 |
| S3 | Crosshare — `Symmetry` enum | https://raw.githubusercontent.com/crosshare-org/crosshare/master/app/lib/types.ts | Accessed 2026-09-09 |
| S4 | Exet — full documentation, "Version: Exet v1.08.1" | https://raw.githubusercontent.com/viresh-ratnakar/exet/master/README.md | Version dated 2026-08-19; accessed 2026-09-09 |
| S5 | Exet — running app (exet.app redirects here) | https://viresh-ratnakar.github.io/exet.html | Accessed 2026-09-09 |
| S6 | Phil — README | https://raw.githubusercontent.com/keiranking/Phil/master/README.md | Accessed 2026-09-09 |
| S7 | Phil — announcement post | https://www.keiranking.com/blog/2017/phil/ | Published October 2017; accessed 2026-09-09 |
| S8 | CrossFire — "An Introduction to CrossFire" documentation | https://beekeeperlabs.com/crossfire/docs/index.html | Accessed 2026-09-09 |
| S9 | Crossword Compiler 11 — product page | https://www.crosswordcompiler.com/ | Accessed 2026-09-09 |
| S10 | Crossword Compiler — features | https://www.crosswordcompiler.com/features.html | Accessed 2026-09-09 |
| S11 | Ingrid — product page | https://ingrid.cx/ | Accessed 2026-09-09 |
| S12 | Ingrid — FAQ | https://ingrid.cx/faq/ | Accessed 2026-09-09 |
| S13 | Crosserville — FAQ | https://www.crosserville.com/FAQ | Accessed 2026-09-09 |
| S14 | Amuse Labs — PuzzleMe platform features | https://amuselabs.com/features/ | Accessed 2026-09-09 |
| S15 | NYT crossword rules, secondary | https://en.wikipedia.org/wiki/The_New_York_Times_crossword | Accessed 2026-09-09 |
| S16 | ipuz v2.0.2 specification and licence | https://www.puzzazz.com/ipuz | © 2022 Puzzazz; accessed 2026-09-09 |
| S17 | XWord Info scored word lists | https://www.xwordinfo.com/WordList | Accessed 2026-09-09 |
| S18 | Grid Alchemy — constructor tool landscape | https://grid-alchemy.com/resources/ | Entries dated 2025 and 2026; accessed 2026-09-09 |

Not verified: the NYT's own submission page (`nytimes.com/puzzles/submissions/crossword`) refuses automated fetches and is blocked by this environment's browsing policy, as is the Internet Archive; its rules are cited from S15 and are second-hand. Crossword Compiler and PuzzleMe were read from marketing pages only, so their validation and preview columns are blank rather than empty. Ingrid's export formats are not stated in its FAQ.
