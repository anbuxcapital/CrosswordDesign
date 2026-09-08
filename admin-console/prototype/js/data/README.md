# Per-area demo data extensions

Each file here is one area builder's own data file, wrapped as `(function (C) { 'use strict'; /* … */ })(window.Console);`, and is loaded after `js/data.js` but before `js/app.js`, so it runs before the store is seeded in `Console.boot()`.

A file may **push new records** into an existing array — `C.data.puzzles.push({ … });` — and may **add fields to existing records** found by id — `C.data.players.filter(function (p) { return p.id === 'pl_8f2c41'; })[0].vipTier = 'gold';`.

A file must **never reassign a whole array or object** (`C.data.puzzles = [...]` is forbidden), never remove or reorder existing records, and never touch a collection another builder owns beyond adding a field it needs.

Files are optional: a missing file is a harmless 404 and the prototype still boots.
