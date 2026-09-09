# Crosscut console prototype — builder contract

**TL;DR:** The area builders work in parallel on one plain HTML/CSS/JS prototype. Each owns one or two files under `js/screens/`, registers its routes with `Console.registerScreen`, reads and writes the single in-memory `Console.store`, and puts every mutation through `Console.commit` so the audit log stays truthful.

**MVP rule: status once, no restating prose.** A status is shown in exactly one place — its pill. Never add a checklist, note or paragraph that restates it, repeats a label, or explains the data model. A filled slot or row shows kind, title, id, one status pill and its buttons; an empty one shows what is missing and the control that fills it. Sublines carry at most one short fact, empty states one sentence, reviews only the rows that change plus one result line.

The shell, the visual system, the shared UI patterns and the demo data already exist. Do not rebuild them; extend them.

## 1. What is already built

| File | Contents |
|---|---|
| `index.html` | Shell page, script order, modal layer, toast area |
| `css/console.css` | Design tokens and every shared component class |
| `js/data.js` | Demo seed, split into per-area sections |
| `js/app.js` | Store, router, role gating, `Console.commit`, `Console.toast`, shell rendering |
| `js/ui.js` | `Console.ui.*` pattern helpers |
| `js/screens/desk.js` | Daily game (owned by the publishing builder) |
| `js/screens/stubs.js` | Placeholder screens for every unbuilt route |

Open `index.html` directly from the filesystem, or serve the design repo root with `python3 -m http.server 4173` and open `http://127.0.0.1:4173/admin-console/prototype/index.html`.

There is no build step, no npm and no ES modules. Classic `<script>` tags in order, one global namespace `Console`. Never add `type="module"`, `import`, `export` or `fetch`.

## 2. File ownership

| Builder | Owns these files | Must implement these routes |
|---|---|---|
| Editorial | `js/screens/library.js`, `js/screens/editor.js` | `#/library`, `#/library/:id` |
| Publishing | `js/screens/desk.js`, `js/screens/collections.js` | `#/desk` (replace the `Console.todo('P1')` stubs), `#/collections`, `#/collections/:id` |
| Support | `js/screens/players.js` | `#/players`, `#/players/:id` |
| Integrity and economy | `js/screens/leaderboards.js`, `js/screens/economy.js` | the Leaderboards tab of `#/collections`, painted by `collections.js` through `Console.leaderboards.render(mount)`; `#/economy` |
| Ads and operations | `js/screens/ads.js`, `js/screens/operations.js` | `#/ads`, `#/operations` |
| Access | `js/screens/access.js`, `js/screens/audit.js` | `#/access`, `#/audit` |

Rules:

1. Create your own files. Never edit another builder's screen file, `app.js`, `ui.js` or `css/console.css`.
2. Do **not** edit `js/screens/stubs.js` or `js/data.js` at all, and edit `index.html` only to add your own data-file script tag as described in rule 4. Your screen files under `js/screens/` are already wired and load in the right order whether or not the file exists yet; data files under `js/data/` are not.
3. Do **not** delete anything from the `STUBS` array. Stub screens load before your file, and the last registration for a route wins, so your real screen replaces the stub automatically the moment your file registers it.
4. Extra demo data goes in your own file `js/data/<area>.js` — `editorial.js`, `publishing.js`, `support.js`, `integrity-economy.js`, `ads-operations.js` or `access.js` — never in `js/data.js`. Data files are **not** pre-wired: if you create one, you must also add its `<script>` tag to `index.html`, in the data block after `js/data.js`, alongside the tags that are already there (`js/data/editorial.js`, `js/data/integrity-economy.js`, `js/data/ads-operations.js`, `js/data/access.js`). Add only your own tag and change nothing else in `index.html`. Each file is `(function (C) { … })(window.Console);` and runs before the store is seeded, so it may push new records into an existing `Console.data.<collection>` array or add fields to existing records looked up by id. It must never reassign a whole array, and never remove or reorder records another builder owns. See `js/data/README.md`.
5. Screen-specific CSS goes at the bottom of your own screen file in a single injected `<style>` block, or ask for a shared class to be added to `console.css`. Prefer the existing classes: almost every pattern already has one.

## 3. Registering a screen

```js
(function (C) {
  'use strict';
  var el = C.ui.el;

  C.registerScreen('#/players/:id', {
    title: function (params) { return C.find.player(params.id).name; },
    subline: function (params) { return params.id + ' · support record'; },
    actions: function (params) {            // optional; returns a node for the header slot
      return C.ui.button('Add note', { variant: 'pink', onClick: function () { /* … */ } });
    },
    render: function (mount, params) {      // required; append your screen into `mount`
      mount.appendChild(C.ui.tabs(/* … */));
    }
  });
})(window.Console);
```

- `title` and `subline` accept a string or a `function(params)`.
- `render(mount, params)` receives an empty `<div class="screen">`. Append nodes to it.
- Screens are re-rendered from scratch on every route change and after every `Console.commit`. Keep per-screen UI state (active tab, selection, filters) on `Console.store.ui.<yourArea>`, not in local closures, so it survives a re-render. `desk.js` shows the pattern.
- Routes must start `#/` and may carry `:params`. Registered later wins, so your file must load after `stubs.js`.
- Unknown routes fall back to `#/desk`. `#/signin` replaces the shell entirely and is owned by `app.js`.

## 4. The store

`Console.store` is one plain object seeded from `Console.data` on load and reset by a page reload. Nothing is persisted.

```
store.session          {operator, environment}      operator is null before sign-in
store.ui               {<area>: {...}}
store.operators        [{id, handle, name, roles:[roleId], note}]
store.environments     [{id:'demo'|'staging'|'production', label, note}]
store.puzzles          [puzzle]
store.collections      [collection]
store.days             [day]
store.players          [player]
store.supportActions   [{id, label, params:[{key,label,type,value}], ledger:boolean}]
store.flags            [flag]
store.boards           [board]
store.ledger           [ledgerEntry]
store.purchases        [purchase]
store.placements       [placement]
store.adRules          [{id, label, value, note}]
store.signals          [signal]
store.importBatches    [batch]
store.audit            [auditEntry]     newest first
store.todayIso         '2026-09-08'
store.todayLabel       'Tuesday, September 8, 2026'
```

### Record shapes

**puzzle** — `{id:'CW-2264' | 'GW-0915', title, kind:'cw'|'guessword', lang:'en'|'uk'|'ru', difficulty, status, validation:'passed'|'failed'|'not_run', validationIssues:[{code, where, message}], version:Number, author, topics:[String], updatedAt, content}`
`difficulty` is one enum per kind — a crossword is `Easy`, `Medium` or `Hard`; a Guessword is `Easy`, `Medium` or `Tricky`, the bands its difficulty estimate reports. Read the pair list from `Console.editorial.difficulties(kind)`.
`content` for `kind:'cw'` is `{size, par, grid:[[cell × size] × size], clues:{across:[{n,row,col,answer,clue}], down:[…]}}` — `size` is 5 for a Mini and 9 for a Weekend grid and drives the grid, the cell size and the preview; `par` is the target solve time in seconds, 300 for a Mini and 600 for a Weekend grid.

A **cell** is one of three things: `''` an open cell nobody has filled, `'#'` a block, or one upper-case letter. The grid is the only thing an operator types letters into. Everything else is derived from it and rewritten on Save:

- **Slots.** A cell starts an across slot when it is open, the cell to its left is a block or off the grid, and at least one open cell follows; the mirrored rule gives down slots.
- **`n`.** Numbers run in reading order, one per starting cell, shared by both directions. A block toggle renumbers the whole grid immediately.
- **`row`, `col`.** The slot's first cell, and the key clue text is bound to. Clue text follows `(row, col, direction)`, never a number, so renumbering never scrambles the clues.
- **`answer`.** The letters the slot spells, or `''` while any of its cells is empty. Typing in the grid and typing in a slot's answer field write the same cells, and both refresh the answers of every slot they touch. An `answer` left over from an import that disagrees with the grid is a crossing conflict: the check names the cell, and changing either side clears it.
- **Order.** Every across in reading order, then every down. That is the order the Play screen's question index walks, so it is data, not presentation.

Read it through `Console.editorial.derive(content)` → `{size, grid, numbers, across, down, slots, open(r,c), slotAt(r,c,dir), slotsAt(r,c)}`, and normalize a content block with `Console.editorial.cwSync(content)`, which is idempotent. There is no symmetry or mirroring rule at either size: blocks are placed one at a time, and `.` toggles the cell under the caret.
`content` for `kind:'guessword'` is `{answer:'CRANE'}` — **one** answer, five characters, upper-cased in the game's own locale after NFC normalization, and no hint. A Guessword is one word: the player board is six rows of five tiles for that word, so there is nothing else to author.
The kind vocabulary is `cw` and `guessword` everywhere — store field, filters, pickers, validators, library tab key and depth rows. Ids follow the kind: crosswords are `CW-####`, Guesswords are `GW-####`.

**Kind labels** — every user-visible kind word comes from one map in `app.js` and nowhere else, so renaming a game is a change to that map alone:

```
Console.KIND_LABEL = {
  cw:        {one:'Crossword', many:'Crosswords', a:'a crossword',
              word:'crossword', wordPlural:'crosswords', tag:'CW', idPrefix:'CW-'},
  guessword: {one:'Guessword', many:'Guesswords', a:'a Guessword',
              word:'Guessword', wordPlural:'Guesswords', tag:'GW', idPrefix:'GW-'}
}
```

| Key | Where it is used | `cw` |
|---|---|---|
| `one` | a label or a title | `Crossword` |
| `many` | a tab, a column | `Crosswords` |
| `a` | after a verb | `a crossword` |
| `word` | mid-sentence | `crossword` |
| `wordPlural` | mid-sentence, counted | `crosswords` |
| `tag` | a calendar or member chip | `CW` |
| `idPrefix` | id minting, not a label | `CW-` |

Read them through `Console.kindLabel(kind)`, `.kindLabelPlural`, `.kindArticle`, `.kindWord`, `.kindWordPlural`, `.kindTag` and `.kindIdPrefix`. Never write a kind's name as a literal in a screen file.

**wordBank** — `Console.data.wordBank` is two lists per language, the two-list pattern every five-letter deduction game uses:

```
Console.data.wordBank = {
  en: { answers: [{word:'CRANE', score:1}, …], accepted: ['CRANE', …, 'PLANK', …] },
  uk: { … }, ru: { … }
}
```

`answers` is the small curated bank an answer must come from; `score` is its rarity band, 1 for the most common word and 5 for the rarest, and feeds the difficulty estimate. `accepted` is the far larger list a player may type — every answer plus the rest of the playable dictionary. Both are read through `Console.editorial.bank(lang)`; reuse is not stored but derived, by `Console.editorial.usedAnswers(lang)`, from the Guesswords already published, live or scheduled.

**crosswordBank** — `Console.data.editorial.crosswordBank` is one flat list of words per language, read through `Console.editorial.cwBank(lang)` and `Console.editorial.inCwBank(word, lang)`. It is a short demo list, not a dictionary, so an answer outside it is a warning and never a block.

**collection** — `{id, name, shelf, blurb, unlockRule, reward, visibility:'published'|'draft'|'hidden', order, members:[puzzleId]}`

**day** — `{index:0…29, iso:'2026-09-11', dayOfMonth, dow:'Fri', label:'Sep 11', longLabel:'Fri Sep 11', today, past, crosswordId:'CW-2265'|null, guesswordId:'GW-0915'|null, scheduled:Boolean, publishTime:'12:00', publishMode:'utc'|'local', audit:[{time, operator, text}]}`
A day is exactly one **Daily game**: two references, `crosswordId` and `guesswordId`. Either may be `null` for an empty slot; neither can hold the wrong kind and there is no ordering to manage. Write a slot by assigning the field, never by pushing into a list.
Use `Console.deriveDay(day)` for readiness: it returns `{items:[{id,kind,title,status}], slots:{cw:item|null, guessword:item|null}, missing:['cw'|'guessword'], blocked, live, done, empty, readiness}`. A valid Daily game is exactly one crossword and exactly one Guessword, both approved or later. `slots` is what screens should render, `items` is the same two entries with the empty ones dropped, and `missing` names the empty slots — a non-empty `missing`, or a slot that is not approved yet, makes the day `blocked`.

**player** — `{id:'pl_8f2c41', name, signIn, lang, joined, streak, solved, tokens, stars, status:'active'|'suspended', profile:[[label, value, editable]], timeline:[[when, kind, text, amount]], devices:[[name, app, lastSeen]], ads:[[label, detail, tone]], notes:[{id, author, when, text, status:'open'|'closed'}]}`
`timeline` kinds are `solve`, `session`, `ledger`, `flag`.
`tokens` is the store key for the soft currency the interface calls **coins** — see §10. Never print the key. `stars` is the hard currency bought with money; every seeded player carries a plausible non-zero `stars` in step with `solved` (roughly 10–12 per solve), except `pl_71e0aa`, whose 500 stars and 0 coins are pinned to her ledger and timeline.

**flag** — `{id, playerId, playerName, puzzleId, puzzleTitle, scope, reason, decision:null|'cleared'|'excluded'|'shadow', evidence:[[label, value]]}`

**board** — `{id, scope:'week'|'puzzle', label, lang, entries:[{rank, playerId, playerName, score, eligible, note}]}`

**ledgerEntry** — `{id, when, playerId, currency:'tokens'|'stars', amount:Number, reason, source:'system'|operatorHandle, idempotencyKey, balanceAfter}`
`currency` is a store key. Render it through the screen's own `currencyWord()` map so `tokens` reads `coins` (`+40 coins`), never by printing `entry.currency` raw.

**purchase** — `{id, when, playerId, pack, plan, receipt, idempotencyKey, amount, status:'verified'|'refunded'|'pending'}`

**placement** — `{id, name, rule, cap:Number|null, reward, fill, platforms, enabled}`

**signal** — `{id, name, level:'ok'|'warn'|'failed', detail, lastRun, job, object, error, runs:[[when, outcome]], items:[{label, outcome, detail}], depth?:[{lang, kind, days, floor}]}`

**batch** — `{id, when, operator, source, accepted, rejected, items:[{label, outcome:'ok'|'failed', detail}]}`

**auditEntry** — `{time, operator, action, object, reason, result}`

### Lookups

`Console.find.puzzle(id)`, `.player(id)`, `.collection(id)`, `.day(iso)`, `.operator(id)` — each returns the record or `null`.

### Constructors

One constructor per game, and no kind selector anywhere. The library toolbar's primary control follows the active tab: **New crossword** on Crosswords, **New Guessword** on Guessword.

**New crossword** — title, language, difficulty, and grid size as two cards: `Mini · 5 × 5 · par 5:00` (the default) and `Weekend · 9 × 9 · par 10:00`. Create draft mints a `CW-` id and opens the crossword editor on an empty grid of that size, with `content.size` 5 or 9 and `content.par` 300 or 600. There is no symmetry field, at either size.

**New Guessword** — language, difficulty target, the answer as five character cells that behave as one field, and an optional title that falls back to the answer. Every keystroke re-runs the live checks; Create draft mints a `GW-` id and opens the Guessword editor.

**Live checks — Guessword.** `Console.editorial.answerChecks(answer, lang, exceptId)` returns one `{code, label, ok, warn, message, goTo}` per check, always in this order, each naming its own failure so every problem is visible at once:

| Check | Rule | Result |
|---|---|---|
| Length | Exactly five characters after NFC normalization | Block |
| Alphabet | Every character is in the language's alphabet — `A–Z` for en, `АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ` for uk, the Russian set with `Ё` folded to `Е` for ru | Block, naming the character and its position |
| Script | No mixed Latin and Cyrillic | Block, naming the odd letters |
| Answer bank | The word is in `wordBank[lang].answers` | Block |
| Accepted guesses | The word is also in `wordBank[lang].accepted`, so a player who types it is never rejected | Block |
| Reuse | Never the answer to a published, live or scheduled Guessword in this language. Names the game id and the day it dropped on, and the line opens that game | Block |
| Crossword clash | The word is not also an answer in a crossword already planned for the same language | Warning |

**Live checks — crossword.** `Console.editorial.cwChecks(puzzle)` returns one `{code, label, ok:false, warn, message, target, quiet}` line **per failing occurrence**, errors first and then warnings, recomputed on every edit. A clean grid returns an empty list, so the Content tab's check column exists only while there is something in it. `target` is `{kind:'cell', r, c, dir}` or `{kind:'clue', dir, n, r, c}` and is what the line walks to; `Console.editorial.whereOf(target)` turns it into the `where` column of a validation issue. A `quiet` line is about the grid as a whole — it still walks to a cell but does not paint one.

| Check | Level | Fires when |
|---|---|---|
| `unchecked_letter` | Error at 5 × 5, warning at 9 × 9 | An open cell belongs to fewer than two slots |
| `disconnected_region` | Error | The open cells fall into more than one connected group |
| `slot_short` | Error | A derived slot is shorter than three cells |
| `grid_empty` | Error, quiet | Open cells are still empty, counted once for the grid |
| `letter_alphabet` | Error, or a quiet warning when *every* letter is in one other alphabet | A letter is outside the language's alphabet. A grid written end to end in another script is a language field to correct, not a run of typos |
| `letter_script` | Error | The grid mixes Latin and Cyrillic |
| `grid_answer_mismatch` | Error | A stored `answer` disagrees with the grid, named per crossing cell |
| `answer_length` | Error | A stored `answer` is not the slot's length |
| `clue_missing` | Error | A slot has no clue text, counted per occurrence so a word square needs both |
| `clue_answer` | Error | The clue contains its own answer, or the answer less a suffix down to four letters |
| `duplicate_answer` | Error, except a word square's across/down twins | The same answer sits in two slots |
| `not_in_bank` | Warning | The answer is absent from `Console.data.editorial.crosswordBank[lang]`. Skipped while the alphabet is wrong |
| `clue_long` | Warning | A clue runs past 90 characters and the banner wraps past three lines |
| `word_square_clue` | Warning | A down clue still reads the same as its across twin |
| `clue_count` | Warning | The grid does not hold ten slots, the number the Play screen counts |

**The word square.** `Console.editorial.cwPairs(content)` returns the across/down twin map of a 5 × 5 with no blocks, and `Console.editorial.wordSquare(content)` returns it only once the letters actually read the same both ways. Completing a square runs `Console.editorial.prefillWordSquare(content)`, which gives every empty down clue its across twin's text; the row then says `same as N-Across` and carries a warning until it is rewritten. The repeated clue never blocks.

**A check never blocks Save.** A draft saves with failing checks and says how many. Everything failing that is not a warning — `Console.editorial.blockingChecks(checks)` for a Guessword, the non-warning lines of `cwChecks` for a crossword — is what `Console.editorial.validate` writes into `validationIssues`, and a failed validation is what holds **Approve** back. Approve names the one thing it is waiting on: Save, Run validation, or the failing count. The constructor, the editor's Content tab and the Validation tab all paint the same call, so a rule is written once.

**Difficulty estimate** — `Console.editorial.difficultyOf(answer, lang)` returns `{band, points, counts}`: the computed band (`Easy` / `Medium` / `Tricky`) and the four counts it is made of — rarity band from the bank's `score`, bank answers one letter away, a repeated letter, and letters outside the ten most frequent in the bank. Each count carries the threshold it is read against, so the band is never a hidden score. A band that disagrees with the chosen target is a warning, never a block.

**Board preview** — `Console.editorial.boardPreview(answer, lang, {reveal, compact})` draws six rows of five tiles with one worked guess, the reveal row, and the language's three-row keyboard carrying the same exact / present / absent states. The editor's Content tab and its Preview tab draw the same board.

## 5. Mutations: `Console.commit`

Every change a person makes goes through `commit`. It applies the mutation, appends exactly one audit entry, and re-renders the current screen.

```js
Console.commit({
  action: 'Restore streak',              // verb phrase, sentence case
  object: 'pl_71e0aa',                   // id of the thing changed; days use 'day 2026-09-11'
  reason: reasonField.value(),           // '' only where the guidelines allow no reason
  result: 'Streak restored to 61 days',  // what actually happened, incl. numbers
  apply: function (store) {              // optional; omit for read-only records
    Console.find.player('pl_71e0aa').streak = 61;
  },
  silent: false                          // true suppresses the re-render (rare)
});
```

Audit entry written: `{time, operator, action, object, reason, result}` — `time` and `operator` are filled in for you. Entries are prepended, so `store.audit[0]` is the newest. Read them back with `Console.ui.auditLine(entry)`.

A reason is **required** for player changes, ledger entries, leaderboard decisions, ad-rule changes and every destructive account action. `Console.ui.modal` enforces this automatically when the body contains a `Console.ui.reasonField`.

## 6. `Console.ui` helpers

All return DOM nodes. `Console.ui.el(tag, className, text)` is the tiny element helper.

| Helper | Signature and example |
|---|---|
| `pill(status, label?)` | Status pill, text plus colour. `C.ui.pill('review')` → “Needs review” in gold. |
| `status(status, label?)` | Compact inline dot + word for table cells. `C.ui.status(p.validation)` |
| `table(spec)` | `C.ui.table({cols:[{key:'title',label:'Title'},{key:'v',label:'Validation',align:'right',render:function(r){return C.ui.status(r.validation)}}], rows:puzzles, onRowClick:function(r){C.go('#/library/'+r.id)}, selectable:{selected:sel, idKey:'id', onChange:function(next){…}}, empty:'No games match these filters.'})`. One density everywhere. |
| `reasonField(opts)` | `var r = C.ui.reasonField({required:true, label:'Reason', placeholder:'…'}); r.value()` returns the trimmed text. No help text. |
| `reviewPanel(spec)` | `C.ui.reviewPanel({title:'Review the change', before:[['Streak','0 days']], after:[['Streak','61 days']], consequence:'The player is notified.'})`. Pass the full before/after arrays: rows whose value is unchanged are hidden for you. `consequence` is one short result line. |
| `modal(spec)` | `C.ui.modal({title:'Restore streak', body:node, wide:false, primary:{label:'Confirm', destructive:false, onClick:fn, disabled:function(){return !amount}}, secondary:{label:'Cancel'}})`. Primary is disabled while a contained reason field is empty. Close with `C.ui.closeModal()`; call `C.ui.refreshModal()` after changing something the `disabled()` test depends on. Escape and the backdrop close it. |
| `results(items)` | `C.ui.results([{label:'Sep 12', outcome:'ok', detail:'Queued 12:00 UTC'}, {label:'Sep 14', outcome:'skipped', detail:'Crossword not approved'}])`. Outcomes: `ok`, `skipped`, `failed`. |
| `auditLine(entry)` | `C.ui.auditLine(Console.store.audit[0])` |
| `puzzlePicker(spec)` | `C.ui.puzzlePicker({kind:'guessword', lang:'en', onPick:function(p){…}})` — searchable list of Approved games; pass `statuses:['approved','scheduled']` to widen it. |
| `tabs(items, active, onChange)` | `C.ui.tabs([{key:'profile',label:'Profile'}], tab, function(k){store.ui.players.tab=k; C.render();})` |
| `field(spec)` | `C.ui.field({label:'Display name', value:'Dana Whitfield', editable:true, changed:false, editing:false, onEdit:fn})`. Read-only fields render dashed and washed; editable fields sit on paper. |
| `emptyState(text, mark?)` | `C.ui.emptyState('No flagged solves are waiting.')` |
| `segmented(items, active, onChange)` | Small view switch. |
| `button(label, opts)` | `C.ui.button('Confirm schedule', {variant:'primary'\|'pink'\|'quiet'\|'danger', small:true, disabled:false, onClick:fn})` |

`Console.toast('Saved.')` shows a transient message. `Console.todo('P1')` is the placeholder for a flow another builder owns — remove every `todo` call in your own area.

## 7. Opening a modal flow

The standard high-impact flow is: gather parameters → show before/after → require a reason → commit → show the result.

```js
function restoreStreak(player) {
  var body = C.ui.el('div');
  body.appendChild(C.ui.reviewPanel({
    title: 'Restore streak',
    before: [['Streak', player.streak + ' days'], ['Last solve', 'Sep 6']],
    after:  [['Streak', '61 days'], ['Last solve', 'Sep 6']],
    consequence: 'The player is notified.'
  }));
  var reason = C.ui.reasonField({ required: true });
  body.appendChild(reason);

  C.ui.modal({
    title: 'Restore streak',
    body: body,
    secondary: { label: 'Cancel' },
    primary: {
      label: 'Restore streak',
      onClick: function () {
        C.commit({
          action: 'Restore streak', object: player.id,
          reason: reason.value(), result: 'Streak restored to 61 days',
          apply: function () { player.streak = 61; }
        });
        C.ui.closeModal();
        C.toast('Streak restored.');
      }
    }
  });
}
```

For bulk actions the result step is a second modal containing `Console.ui.results(...)`, showing the selection count, the effective time and one line per item.

## 8. Roles, routes and areas

| Role id | Label | Areas it unlocks |
|---|---|---|
| `content_editor` | Content editor | `#/library`, `#/library/:id` |
| `publisher` | Publisher | `#/desk`, `#/collections` (Collections tab), `#/collections/:id` |
| `support` | Support agent | `#/players`, `#/players/:id` |
| `integrity` | Integrity reviewer | `#/collections` (Leaderboards tab) |
| `economy` | Economy admin | `#/economy` |
| `ads` | Ads manager | `#/ads` |
| `operations` | Operations engineer | `#/operations` |
| `console_admin` | Console admin | `#/access`, `#/audit` |

**Collections** (nav label; the area holds both tabs) is one area at `#/collections`, unlocked by `publisher` **or** `integrity`. Inside it, the Collections tab is shown only to a publisher and the Leaderboards tab only to an integrity reviewer, so an operator with one of the two roles sees one tab. `#/leaderboards` and `#/collections/leaderboards` are aliases that open the area on the Leaderboards tab; register an alias with `Console.alias(from, to, before)`.

`Console.hasRole('publisher')` and `Console.canSee('players')` answer permission questions. Navigation hides areas the operator cannot enter, and a direct hash to a forbidden area renders a plain explanation instead of the screen. Where one area holds two role-gated tabs, the tab itself is gated with `Console.hasRole`. Demo operators: `m.olsen` (all roles), `a.reid` (editorial and publishing), `s.novak` (support and integrity), `t.baros` (operations, ads and economy).

## 9. Status vocabulary

Use these keys with `Console.ui.pill` / `Console.ui.status` so wording and colour stay consistent. Never signal state with colour alone.

- Game and Daily game: `draft` Draft · `review` Needs review · `approved` Approved · `scheduled` Scheduled · `published` Published · `live` Live now · `empty` No game
- Game kind: `cw` Crossword · `guessword` Guessword — read the words from `Console.KIND_LABEL`, never as literals
- Validation: `passed` · `failed` · `not_run` Not run
- Day readiness: `ready` · `blocked` · `queued` · `unplanned` · `done`
- Signals and jobs: `ok` · `warn` Warning · `failed`
- Notes and flags: `open` · `closed` · `cleared` · `excluded` Excluded from board · `shadow`
- Accounts and placements: `active` · `suspended` · `enabled` · `paused`
- Purchases: `verified` · `refunded` · `pending`
- Boards: `eligible` · `ineligible` Not eligible
- Collections: `published` · `draft` · `hidden`

Add a key only inside `ui.js`'s `STATUS` map — which means asking, since `ui.js` is shared.

## 10. Writing rules

- The daily pair of one crossword and one Guessword is a **Daily game** — sentence case, and never `Daily challenge` or `drop` in the interface (`Daily game`, `Schedule Daily game`, `Schedule 3 Daily games`, `Fri Sep 11 Daily game`, `Daily game generation`). `drop` survives only as a verb where nothing better fits (`drops at 12:00 UTC`; prefer `publishes at 12:00 UTC`) and in player-app labels quoted verbatim. Routes, ids and job names keep the old word — `#/desk`, `sig_drop_gen`, `drop.generate`, `desk.js`.
- Never write `Daily Five`, `Wordle` or `puzzle` in the interface. The two games are a **crossword** and a **Guessword**; name the kind when it is known (`Crossword editor`, `Guessword editor`, `Approve crossword`, `Replace Guessword`, `This day has no crossword yet`) and use **game** / **games** when both kinds are meant (`Import games`, `412 games`, `Search the library`). `Crossword` is a common noun: lower case mid-sentence and plural when counted (`3 approved crosswords are unassigned`). `Guessword` is the game's name: it keeps its capital everywhere, pluralises as `Guesswords` (`Search approved Guesswords`, `3 approved Guesswords are unassigned`) and stands alone as a label (`Guessword`, `No Guessword chosen`). Every one of those words is read from `Console.KIND_LABEL` — see §4. Code identifiers, store keys and routes keep their own vocabulary — `store.puzzles`, `Console.find.puzzle`, `puzzleId`, `#/library`.
- A Guessword is **one answer** and carries no hint. `hint` is a player-app word: the crossword hint sheet is bought with coins on the Play screen, and the Daily game screen has no surface for an authored hint. It survives in the console only as the ledger reason `Hint purchase` and the ads placement `Hint for a view`.
- The currency shown with the coin glyph is **coins** — never `tokens` — everywhere a person reads it: the Players list column and record stat, `Grant coins` and its review and audit strings, ledger and purchase labels (`+40 coins`, `Coin pack`), the economy currency selector (`Coins` / `Stars`), ads reward strings (`+25 coins`), player timeline amounts and collection reward text. The second currency stays **stars**. Code identifiers, store keys and ids keep the old word — `p.tokens`, `currency:'tokens'`, `grant_tokens` — so map the key to the word at render time rather than printing it. `token` survives in the interface only as the operator credential in Access and audit (`Rotate admin token`, `token_console_admin`) and in Better Auth wording; `css/console.css` keeps design tokens.
- The stat order for a player is Streak, Solved, Coins, Stars, in the list and on the record.
- Sentence case for titles, controls and messages. `Confirm schedule`, not `Confirm Schedule`.
- Concrete labels. `No Guessword assigned`, not `Issue`. `Retry generation`, not `Manage`.
- Every metric carries scope and window: `Guessword · English · 7 days`, and a threshold when one exists.
- Every alert names the object, the urgency and one recoverable next step.
- Minimum 14px body and control size. Generous space around destructive controls.
- Read-only and editable fields must look different — use `Console.ui.field`.
- No lorem ipsum. The DEMO label lives in the shell only; do not stamp it on rows.

## 11. Checklist before you finish

Run this in the browser at 1440 × 800, signed in as `m.olsen`:

1. Every route you own renders with no message in the browser console.
2. Sign in as the narrow operator for your area (`a.reid`, `s.novak` or `t.baros`) and confirm your screens still work and unrelated areas stay hidden.
3. Every happy path in `USE-CASES.md` for your routes is clickable end to end, including its dialogs.
4. Every mutation appears in `#/audit` with the right operator, object, reason and result.
5. Reason-required actions cannot be confirmed with an empty reason.
6. High-impact actions show a before/after review; bulk actions show selection count, effective time and per-item results.
7. No screen restates a status pill, and no prose repeats a label or the data model.
8. No horizontal page scroll at 1440 and at 1240 window width.
9. No `Console.todo(...)` calls remain in your files. Leave `stubs.js` alone — your registration already overrides the stub — and confirm your routes show your screen, not the placeholder.
10. Reload the page: the store resets cleanly and your screen still renders from the seed.
