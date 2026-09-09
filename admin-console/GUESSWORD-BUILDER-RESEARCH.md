# Guessword builder research

**TL;DR:** Every five-letter deduction game with a single six-row board — Wordle itself, Словко (uk), 5 букв (ru), word.rodeo, mywordle — has exactly **one answer per game**; the only products with more than one answer (Quordle, Octordle) draw one board per answer and raise the guess budget to 9–13, which our player screen cannot render. The prototype's model of five answers plus a hint is therefore wrong on both counts: the Daily Five screen is six rows × five tiles for one word, and it has no surface that shows an authored hint.
**Confidence:** High on the model question and on the two-list dictionary pattern (both carry direct source quotes); medium on the difficulty formula, which is assembled from three sources rather than lifted from one published one.
**Peter decides:** whether a Guessword becomes one answer per language per day (recommended), and whether the authored hint is cut outright or kept as a disabled field until the player screen gains a place to show it.

## Comparison table

| Tool or game | Answer entry | Validity check | Difficulty signal | Scheduling | Hint | Languages | Notes | Source |
|---|---|---|---|---|---|---|---|---|
| word.rodeo | One field, "Your secret word:", help text "3-15 letter word your friends have to guess." | Checkbox "Guesses must be real words from a dictionary." — applies to *guesses*, never to the answer | None | "Schedule unlimited puzzles" and "Puzzle archive" on the paid personal page only | "Hint" field, "Show a short text to help find the answer." | 9, incl. Deutsch, Polski, Lakȟota | Advanced options also set "Message for solvers" and "Number of guesses" (slider) | S1, S2 |
| mywordle.strivemath.com | One field, "Enter Custom Word"; "Word can be of any length" | Language select doubles as the dictionary; a "No Dictionary" option turns the check off | None | None; share by "Generate Link" | None | en, es, de, fr | "Play Random Word" is the built-in test play | S3 |
| AnyLanguage-Wordle (open source) | `src/constants/wordlist.ts` holds goal words; the day picks one by index | `isWordInWordList` = `WORDS.includes(word) \|\| VALIDGUESSES.includes(word)`; `orthography.ts` lists the language's graphemes | None | `getWordOfDay()` — days since a 2022-01-01 epoch, `WORDS[index % WORDS.length]` | None | Any; `config.ts` carries `language`, `wordLength`, `tries`, `normalization: 'NFC'` | The `normalization` key matches our own Cyrillic finding | S4, S5, S6, S7 |
| Wordle (NYT) | Editor picks from a curated answer list with a random number generator, then reviews the week | "While the answer list is curated, the much larger dictionary of English words that are valid guesses will not be curated." | Rejects words with "very common letters" and too many completions; rejects obscure picks (`parer`, `rupee`) | One answer per day, reviewed a week ahead against the news cycle | None | en | Answers are never a plural of a 3- or 4-letter word in S/ES: "never be FOXES or SPOTS, but it might be GEESE or FUNGI" | S8, S9 |
| Accepted-guess list (Wordle) | n/a | 14,854 entries, "taken straight from the game's source code" | n/a | n/a | n/a | en | Far larger than the answer list — the size gap *is* the design | S10 |
| Словко (uk) | One word a day | "Кожна спроба повинна містити справжнє слово з 5 літер" | Repeated letters are called out as the known trap | "Нове СЛОВКО з'являється кожен день!" | None | uk | Base-form rule: "Загадане може бути будь-яка частина мови, але в початковій формі, як в словнику: наприклад, називний відмінок або інфінітив" | S11 |
| 5 букв (ru) | One word a day | Not stated | Not stated | "каждый день загадываем новое слово" | None | ru | Answer is "существительное из пяти букв в единственном числе", six tries | S12 |
| Quordle | 4 answers at once | Not stated | Named tiers: "Extreme — 8 guesses, more unusual words"; "Chill — 12 guesses, fewer unusual words" | One dated set per day (9 September 2026) | None | en | "Classic — 9 guesses to solve 4 words"; "Sequence — solve one word at a time" | S13 |
| Octordle | 8 answers at once | Not stated | Not stated on the landing screen | One dated set per day | None | en | Same house as Quordle; confirms multi-answer means multi-board | S14 |
| Contexto | One secret word a day | n/a (semantic, not letter-based) | n/a | "Daily game 09/09/2026", a seven-day strip, and "Previous games" | Built-in tip control | Multiple, via a Language control | The day strip plus archive is the closest match to our Browse archive | S15 |
| Waffle | Generated grid, not typed | n/a | "Every WAFFLE can be solved in a minimum of 10 swaps" — solvability is proven at generation | Numbered, dated archive (`#25`, 17th May 2022) | None | en | Stars are awarded for swaps remaining, the same shape as our time bonus | S16 |
| wordle-analyzer | n/a (analysis tool) | n/a | `getRemainingCounts` — "Figure out the number of possibilities remaining for particular guesses"; ships `initial-remaining-averages.json` | n/a | n/a | en | The one runnable definition of answer difficulty found in the survey | S17 |
| MikhaD/wordle | Word list in the repo | Not stated | None | Date-seeded RNG: "the seed for the random number created from the date, ensuring that everyone gets the same random number" | None | en | Also ships hourly and infinite modes | S18 |

## Interaction patterns worth borrowing

| Pattern | Source | Why it fits Crosscut |
|---|---|---|
| Two lists, one curated. The answer must come from a small curated bank; guesses are checked against a much larger, uncurated dictionary. | NYT (S8); `isWordInWordList` (S6) | Our validation rules already name "dictionary membership" as one check. Splitting it into *answer bank* and *accepted guesses* is what makes an answer both fair and typeable, and it is the difference between a 14,854-word list and a curated one. |
| Show the dictionary check as a visible state, never a silent pass. word.rodeo makes it a labelled checkbox; mywordle makes "No Dictionary" a selectable language. | S1, S3 | Matches "show a status once" and "use color and text together for status". A Guessword row should say which bank passed it, not just go green. |
| Per-language alphabet list applied after NFC normalization. | `orthography.ts` + `config.ts` `normalization: 'NFC'` (S5, S7) | Identical to the finding in the content pipeline: NFC first, then upper-case with the game's locale, then check every character against the language alphabet. Reuse `normalizeLetter(lang, ch)` rather than writing a second rule in the console. |
| A base-form rule stated in the language's own grammar, not a blunt "no plurals". English forbids S/ES plurals of short words; Ukrainian requires the nominative or the infinitive; Russian requires a singular noun. | S8, S11, S12 | One rule per language, enforced by the bank's part-of-speech tag. It is the only version of "no plurals, no proper nouns" that survives translation to uk and ru. |
| Difficulty as a named band tied to word rarity plus how many candidates remain. | Quordle's "more unusual words" / "fewer unusual words" (S13); Bennett on words with "very common letters" and too many completions (S9); `getRemainingCounts` (S17) | Gives the console a difficulty estimate operators can reconcile, per the guideline against composite health scores: every input is a count they can see. |
| One answer per day, assigned by the day, with the next drop time visible. | `getWordOfDay()` (S6); date-seeded RNG (S18); "Нове СЛОВКО з'являється кожен день!" (S11) | Confirms the Daily game as the publishing unit: one Guessword per language per day, resolved by the drop date, not by a list index the operator has to reason about. |
| Test-play the game you just made, from the same screen. | "Play Random Word" (S3); the generated share link opens straight into the board (S1) | E5 already promises a phone-frame preview. For a Guessword the preview is cheap: six rows, five tiles, one keyboard. |
| A dated day strip plus a "previous games" archive. | Contexto (S15); Waffle's numbered archive (S16) | The player app's Daily Five archive is "today/resume first, then solved and missed history rows". The console's Guessword library should sort the same way so an operator sees what the player sees. |
| Solvability proven at generation time. | Waffle guarantees a minimum-swap solution (S16) | We cannot prove six guesses suffice, but we can prove the weaker, useful thing: the answer is itself a member of the accepted-guess list, so a player who types it is never rejected. Make that a blocking check. |

## Patterns to skip for the MVP

| Pattern | Why not |
|---|---|
| Variable answer length (word.rodeo 3–15, mywordle any length) | The player board is fixed at five tiles; a sixth column has nowhere to render. |
| Configurable number of tries | Six rows are drawn in the player app and in the kicker "ONE WORD · SIX TRIES". |
| Multi-answer boards (Quordle 4 words / 9 guesses, Octordle 8 / 13) | Needs one board per answer and a larger guess budget — a player-app redesign, not a console feature. |
| Per-game "Message for solvers" | The Solved screen is a fixed celebration with fixed awards (15 stars, 25 coins). |
| Extra lives, hourly mode, infinite mode | No player surface, and each one breaks the one-a-day streak rule. |
| Share links and QR codes for a single Guessword | Crosscut publishes through the Daily game desk; a per-game link is a second, unaudited publishing path. |
| A "No Dictionary" escape hatch | Removes the only guarantee that the answer is typeable, and there is no operator need for it. |
| Semantic-distance games (Contexto, Semantle) | A different mechanic with a different player screen. |
| Per-game branding or theme | Fixed by the visual system. |

## Proposal: the New Guessword constructor

Reached from Library → Guessword tab → New game, matching E2. Two columns; the left holds metadata, the right holds the answer and its checks.

| Field | Control | Behaviour |
|---|---|---|
| Language | Required select — English, Ukrainian, Russian | Sets the alphabet, the answer bank, the accepted-guess list and the base-form rule. Changing it after an answer is typed re-runs every check and says so. |
| Difficulty | Required select — Easy, Medium, Tricky (the enum the content pipeline already uses) | A *target*. It filters "Suggest an answer" and is compared against the computed band; a mismatch is a warning, never a block. |
| Answer | Required text, one field, five character cells | Upper-cases as typed using the game's locale. Live checks below. |
| Title | Optional text | Defaults to the drop-date kicker rendered by the client. Editorial convenience only; the player never sees it on the Daily Five screen. |
| Hint | Optional one-line text, **disabled with an explanation** | The player's Daily Five screen has no place to show authored hint text — its hint system is the coin-spent hint sheet on the crossword Play screen. Keep the field disabled and labelled until the player design adds a surface, the same way M2 is disabled until its server command exists. |

Remove the five answer rows and the required hint from the current draft. Reuse `answerReady` for the single field.

### Live checks on the answer

Each check reports as its own line with the offending character or word named, so the operator sees every failure at once rather than one at a time.

| Check | Rule | Result |
|---|---|---|
| Length | Exactly five letters after NFC normalization, counted as graphemes | Block. `ВОДА is four letters. Answers must be exactly five letters` |
| Alphabet | Every character is in the language's alphabet: `A–Z` for en; `АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ` for uk; the 33-letter Russian set with `Ё` folded to `Е` for ru | Block, naming the character and its position |
| Script | No mixed Latin/Cyrillic homoglyphs | Block. A Cyrillic answer holding a Latin `a` is unsolvable |
| Answer bank | The word is in the curated answer bank for this language | Block. `ЗЕМЛЯ is not in the Ukrainian answer bank` |
| Accepted guesses | The answer is also in the larger accepted-guess list, so a player who types it is never rejected | Block. This is the check the current draft is missing |
| Base form | en: not a plural of a three- or four-letter word formed with S or ES, and not a proper noun. uk: nominative singular or infinitive. ru: a singular noun. Read from the bank's part-of-speech tag, not guessed from the spelling | Block, quoting the language's rule |
| Reuse | Never used as an answer in this language before. A bank of 4–8 K words per language against ~365 answers a year makes "ever" affordable for a decade; the 90-day window in the draft is unnecessarily weak | Block, with the game id and the drop date it was used on |
| Same-day clash | The answer is not also an answer in the crossword scheduled for the same language and day | Warning only |

### Difficulty estimate

Computed, read-only, shown beside the target the operator chose. Four inputs, each a count the operator can open:

1. **Rarity band** of the answer in the language bank, from the bank's existing `score` field. *Source: Quordle expresses difficulty as "more unusual words" versus "fewer unusual words" (S13).*
2. **Neighbours** — how many other bank answers differ from this one by exactly one letter. High neighbour counts are what makes six guesses insufficient. *Source: Tracy Bennett rejects answers where, with four letters placed, "you still have more letters to guess than there are" guesses left (S9); `getRemainingCounts` is the runnable form of the same metric (S17).*
3. **Repeated letters** — a flag, since a repeated letter is the trap the Ukrainian rules screen calls out by name (S11).
4. **Rare letters** — how many of the five are outside the ten most frequent letters in the language bank.

Map the four to Easy / Medium / Tricky with published thresholds shown in the panel, per the guideline that a composite score is only acceptable when the calculation and drill-down are available. Show the band, the four counts, and the target side by side; do not show a single hidden score.

### The Guessword editor Content tab

| Region | Contents |
|---|---|
| Answer | The single answer field with the eight live checks inline, each linking to what it failed |
| Difficulty | The computed band, its four counts, and the target from Metadata, with the mismatch warning if they disagree |
| Reuse | Passed, or the id and drop date of the game that used the word, opening that game |
| Preview | Six rows × five tiles at the player's proportions, plus the three-row keyboard for the game's language, with one worked guess rendered so the operator sees `success` for exact, `gold` for present, `ink-tile` for absent and the same state carried onto the keys. The final row shows the reveal state after six failed guesses. Nothing else from the player screen — no awards, no archive |

That is the whole Content tab. Everything the player screen needs is the answer, its language and six rows; everything else belongs to Metadata or to the Daily game desk.

## Sources

| ID | Source | URL | Date |
|---|---|---|---|
| S1 | word.rodeo — custom game constructor form, read from the live page | https://word.rodeo/ | accessed 2026-09-09 |
| S2 | word.rodeo — personal and business plan features | https://word.rodeo/signup/ | accessed 2026-09-09 |
| S3 | Make Your Own Wordle (StriveMath) — creation form and language select | https://mywordle.strivemath.com/ | accessed 2026-09-09 |
| S4 | AnyLanguage-Wordle — README instructions for adapting to another language | https://github.com/QQQQQQ22222/AnyLanguage-Wordle | accessed 2026-09-09 |
| S5 | AnyLanguage-Wordle — `src/constants/config.ts` | https://raw.githubusercontent.com/QQQQQQ22222/AnyLanguage-Wordle/main/src/constants/config.ts | accessed 2026-09-09 |
| S6 | AnyLanguage-Wordle — `src/lib/words.ts` (`isWordInWordList`, `getWordOfDay`) | https://raw.githubusercontent.com/QQQQQQ22222/AnyLanguage-Wordle/main/src/lib/words.ts | accessed 2026-09-09 |
| S7 | AnyLanguage-Wordle — `src/constants/orthography.ts` | https://raw.githubusercontent.com/QQQQQQ22222/AnyLanguage-Wordle/main/src/constants/orthography.ts | accessed 2026-09-09 |
| S8 | Fortune — NYT's November 2022 answer-curation change, quoting NYT on the curated answer list versus the uncurated guess dictionary | https://www.fortune.com/2022/11/08/wordle-rule-changes-2022-more-challenging | published 2022-11-08 |
| S9 | TODAY — interview with NYT Wordle editor Tracy Bennett on how the day's answer is chosen and screened | https://www.today.com/popculture/wordle-editor-tracy-bennett-interview-rcna64987 | published 2023-01-09 |
| S10 | tabatkins/wordle-list — the accepted-guess list, 14,854 entries, "taken straight from the game's source code" | https://github.com/tabatkins/wordle-list | accessed 2026-09-09 |
| S11 | СЛОВКО — Ukrainian rules dialog on the live page | https://slovko.zaxid.net/ | accessed 2026-09-09 |
| S12 | Т-Банк — published rules of "5 букв" | https://www.tbank.ru/finance/blog/legendary-game/ | updated 2025-03-04 |
| S13 | Quordle at Merriam-Webster — mode labels and guess budgets | https://www.merriam-webster.com/games/quordle/ | accessed 2026-09-09 |
| S14 | Octordle at Merriam-Webster — dated daily set | https://www.merriam-webster.com/games/octordle/ | accessed 2026-09-09 |
| S15 | Contexto — daily game, day strip, previous games, language control | https://contexto.me/ | accessed 2026-09-09 |
| S16 | Waffle — daily rules and numbered archive | https://wafflegame.net/daily | accessed 2026-09-09 |
| S17 | jakearchibald/wordle-analyzer — `src/workers/analyze/index.ts`, `getRemainingCounts` | https://github.com/jakearchibald/wordle-analyzer | accessed 2026-09-09 |
| S18 | MikhaD/wordle — README on date-seeded daily word selection | https://github.com/MikhaD/wordle | accessed 2026-09-09 |

### Not verified

| Source | Status |
|---|---|
| nytimes.com and help.nytimes.com — the official Wordle rules page and the WordleBot introduction | Blocked by policy in this environment. NYT's editorial statements are cited only where a fetchable outlet quotes them directly (S8, S9). No WordleBot difficulty figures are claimed. |
| cwackerfuss/react-wordle and hannahcode's repositories | Both accounts return 404 or an empty repository list. The file structure they established (`wordlist.ts`, `validGuesses.ts`, `config.ts`) is verified instead through the surviving AnyLanguage-Wordle fork (S4–S7). |
| Semantle | The rules text is rendered client-side and returned nothing readable; no claim is made. |
| Forbes coverage of the November 2022 change | HTTP 403; superseded by S8. |
| Original Wordle answer-list size | No fetchable primary source; only the relative statement in S8 is used. |
