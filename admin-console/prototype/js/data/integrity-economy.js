/* Extra demo data for the integrity and economy area.
   OWNER: integrity and economy builder.

   Runs after js/data.js and before the store is seeded, so it may add fields to
   records that already exist and push new records into existing arrays. It must
   never reassign an array or touch another builder's records. */
(function (C) {
  'use strict';

  function board(id) {
    return C.data.boards.filter(function (b) { return b.id === id; })[0] || null;
  }

  /* Which puzzle a board ranks. Weekly boards rank a week, not one puzzle, so
     they carry `puzzleId: null` and a flag on any puzzle can move them. The
     leaderboards screen uses this to find the entries a decision affects. */
  var weekEn = board('bd_week_36_en');
  if (weekEn) {
    weekEn.puzzleId = null;
    weekEn.window = 'Sep 7 – Sep 13 · recomputed 12:05 UTC';
  }
  var puzEn = board('bd_puz_cw2262');
  if (puzEn) {
    puzEn.puzzleId = 'CW-2262';
    puzEn.window = 'All solves since Sep 8 12:00 UTC';
  }

  /* A Ukrainian weekly board, so the Boards tab has more than one language, and
     a second puzzle board so the flag on CW-2261 has an entry to move. */
  C.data.boards.push({
    id: 'bd_week_36_uk', scope: 'week', label: 'Week 36 · Ukrainian', lang: 'uk',
    puzzleId: null, window: 'Sep 7 – Sep 13 · recomputed 12:05 UTC',
    entries: [
      { rank: 1, playerId: 'pl_2a90bd', playerName: 'Ihor Melnyk', score: '5/6 · 09m 58s', eligible: false, note: 'Held pending flag fl_1001' },
      { rank: 2, playerId: 'pl_3d88c7', playerName: 'Oleh Tkachuk', score: '3/6 · 21m 07s', eligible: true, note: '' }
    ]
  });

  C.data.boards.push({
    id: 'bd_puz_cw2261', scope: 'puzzle', label: 'Moon walk · CW-2261', lang: 'en',
    puzzleId: 'CW-2261', window: 'All solves since Sep 7 12:00 UTC',
    entries: [
      { rank: 1, playerId: 'pl_a40f19', playerName: 'anon_44b1', score: '48s', eligible: false, note: 'Held pending flag fl_1002' },
      { rank: 2, playerId: 'pl_9b71fe', playerName: 'Amelia Frost', score: '1m 39s', eligible: true, note: '' },
      { rank: 3, playerId: 'pl_6e12ab', playerName: 'Priya Nair', score: '2m 12s', eligible: true, note: '' },
      { rank: 4, playerId: 'pl_5c3d02', playerName: 'Marek Dvorak', score: '3m 04s', eligible: true, note: '' }
    ]
  });
})(window.Console);
