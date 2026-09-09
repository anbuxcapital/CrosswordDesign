# Crosscut console prototype — builder contract

**TL;DR:** The area builders work in parallel on one plain HTML/CSS/JS prototype. Each owns one or two files under `js/screens/`, registers its routes with `Console.registerScreen`, reads and writes the single in-memory `Console.store`, and puts every mutation through `Console.commit` so the audit log stays truthful.

**MVP rule: status once, no restating prose.** A status is shown in exactly one place — its pill. Never add a checklist, note or paragraph that restates it, repeats a label, or explains the data model. A filled slot or row shows kind, title, id, one status pill and its buttons; an empty one shows what is missing and the control that fills it. Sublines carry at most one short fact, empty states one sentence, reviews only the rows that change plus one result line.

The shell, the visual system, the shared UI patterns and the demo data already exist. Do not rebuild them; extend them.

## 1. What is already built

| File | Contents |
|---|---|
| `index.html` | Shell page, script order, modal layer, toast area |
| `css/console.css` | Tokens and every shared component class |
| `js/data.js` | Demo seed, split into per-area sections |
| `js/app.js` | Store, router, role gating, `Console.commit`, `Console.toast`, shell rendering |
| `js/ui.js` | `Console.ui.*` pattern helpers |
| `js/screens/desk.js` | Daily challenge (owned by the publishing builder) |
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

**puzzle** — `{id:'CW-2264', title, kind:'cw'|'d5', lang:'en'|'uk', difficulty:'Easy'|'Medium'|'Hard', status, validation:'passed'|'failed'|'not_run', validationIssues:[{code, where, message}], version:Number, author, topics:[String], updatedAt, content}`
`content` for `kind:'cw'` is `{size:5, grid:[[letter × 5] × 5], clues:{across:[{n,clue,answer}], down:[…]}}`; for `kind:'d5'` it is `{answers:[5 strings], hint}`.

**collection** — `{id, name, shelf, blurb, unlockRule, reward, visibility:'published'|'draft'|'hidden', order, members:[puzzleId]}`

**day** — `{index:0…29, iso:'2026-09-11', dayOfMonth, dow:'Fri', label:'Sep 11', longLabel:'Fri Sep 11', today, past, items:[puzzleId], scheduled:Boolean, publishTime:'12:00', publishMode:'utc'|'local', audit:[{time, operator, text}]}`
A day is exactly one **Daily challenge** with two fixed slots: one crossword and one Daily Five. `items` therefore holds at most one `cw` id and at most one `d5` id — never two of a kind, and there is no ordering to manage.
Use `Console.deriveDay(day)` for readiness: it returns `{items:[{id,kind,title,status}], slots:{cw:item|null, d5:item|null}, missing:['cw'|'d5'], extra:[String], blocked, live, done, empty, readiness}`. A valid Daily challenge is exactly one crossword and exactly one Daily Five, both approved or later. `slots` is what screens should render; `missing` names the empty slots and `extra` names any duplicate kind (which should never occur) — either one makes the day `blocked`.

**player** — `{id:'pl_8f2c41', name, signIn, lang, joined, streak, solved, tokens, stars, status:'active'|'suspended', profile:[[label, value, editable]], timeline:[[when, kind, text, amount]], devices:[[name, app, lastSeen]], ads:[[label, detail, tone]], notes:[{id, author, when, text, status:'open'|'closed'}]}`
`timeline` kinds are `solve`, `session`, `ledger`, `flag`.

**flag** — `{id, playerId, playerName, puzzleId, puzzleTitle, scope, reason, decision:null|'cleared'|'excluded'|'shadow', evidence:[[label, value]]}`

**board** — `{id, scope:'week'|'puzzle', label, lang, entries:[{rank, playerId, playerName, score, eligible, note}]}`

**ledgerEntry** — `{id, when, playerId, currency:'tokens'|'stars', amount:Number, reason, source:'system'|operatorHandle, idempotencyKey, balanceAfter}`

**purchase** — `{id, when, playerId, pack, plan, receipt, idempotencyKey, amount, status:'verified'|'refunded'|'pending'}`

**placement** — `{id, name, rule, cap:Number|null, reward, fill, platforms, enabled}`

**signal** — `{id, name, level:'ok'|'warn'|'failed', detail, lastRun, job, object, error, runs:[[when, outcome]], items:[{label, outcome, detail}], depth?:[{lang, kind, days, floor}]}`

**batch** — `{id, when, operator, source, accepted, rejected, items:[{label, outcome:'ok'|'failed', detail}]}`

**auditEntry** — `{time, operator, action, object, reason, result}`

### Lookups

`Console.find.puzzle(id)`, `.player(id)`, `.collection(id)`, `.day(iso)`, `.operator(id)` — each returns the record or `null`.

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
| `puzzlePicker(spec)` | `C.ui.puzzlePicker({kind:'d5', lang:'en', onPick:function(p){…}})` — searchable list of Approved games; pass `statuses:['approved','scheduled']` to widen it. |
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

- Game and Daily challenge: `draft` Draft · `review` Needs review · `approved` Approved · `scheduled` Scheduled · `published` Published · `live` Live now · `empty` No game
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

- The daily pair of one crossword and one Daily Five is a **Daily challenge** — sentence case, and never `drop` in the interface (`Daily challenge`, `Schedule Daily challenge`, `Schedule 3 Daily challenges`, `Fri Sep 11 Daily challenge`, `Daily challenge generation`). `drop` survives only as a verb where nothing better fits (`drops at 12:00 UTC`; prefer `publishes at 12:00 UTC`) and in player-app labels quoted verbatim. Code identifiers, ids, routes and job names keep the old word — `#/desk`, `sig_drop_gen`, `drop.generate`, `desk.js`.
- Never write `puzzle` in the interface. The two games are a **crossword** and a **Daily Five**; name the kind when it is known (`Crossword editor`, `Approve crossword`, `Replace Daily Five`, `This day has no crossword yet`) and use **game** / **games** when both kinds are meant (`Import games`, `New game`, `412 games`, `Search the library`). Never write `Wordle`; Daily Five may be introduced once per screen as `Daily Five (one word, six tries)`. Code identifiers, store keys, ids and routes keep the old names — `store.puzzles`, `Console.find.puzzle`, `puzzleId`, `#/library`.
- Sentence case for titles, controls and messages. `Confirm schedule`, not `Confirm Schedule`.
- Concrete labels. `No Daily Five assigned`, not `Issue`. `Retry generation`, not `Manage`.
- Every metric carries scope and window: `Daily Five · English · 7 days`, and a threshold when one exists.
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
