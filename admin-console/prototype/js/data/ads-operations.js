/* Ads and operations demo-data extension.
   OWNER: ads and operations builder. Runs after js/data.js and before the store
   is seeded, so everything here is part of the seed a page reload restores.

   Only ads/operations-owned records are touched:
   - placements gain the machine-readable fields the rule editor (A2) writes:
     `capNumber`, `graceHours`, `platformList` and `fillPct`. The display fields
     (`cap`, `platforms`, `fill`) stay exactly as js/data.js wrote them.
   - the Daily Five pool warning gains the `depth` rows O2 drills into.
   - one reward-grant signal is added so the Ads grant-health card has a real
     Operations destination, and so O1 has a retry that actually succeeds.
   - one import batch is added so O3 covers both branches: a rejected item that
     exists in the library and one that never became a record. */
(function (C) {
  'use strict';

  function byId(list, id) {
    return list.filter(function (r) { return r.id === id; })[0] || null;
  }

  // ------------------------------------------------------------------
  // placements — fields the rule editor reads and writes
  // ------------------------------------------------------------------

  C.data.placements.forEach(function (p) {
    p.capNumber = p.cap;                       // null means no cap
    p.graceHours = 24;                         // first-session grace, hours
    p.platformList = String(p.platforms).split(' · ');
    p.fillPct = parseInt(String(p.fill), 10);
    p.fillFloor = 75;                          // % floor, measured over 7 days
    p.scheduledChange = null;                  // {to:Boolean, at:'22:00'} once A1 schedules one
  });

  // ------------------------------------------------------------------
  // signals
  // ------------------------------------------------------------------

  var poolWarn = byId(C.data.signals, 'sig_pool_warn');
  if (poolWarn) {
    poolWarn.depth = [
      { lang: 'en', kind: 'd5', days: 6, floor: 10 },
      { lang: 'uk', kind: 'd5', days: 1, floor: 10 }
    ];
  }

  C.data.signals.push({
    id: 'sig_reward_grants',
    name: 'Rewarded grant delivery',
    level: 'warn',
    detail: '3 of 812 grants failed · Post-solve rewarded · 7 days (0.4%, under the 1% alert floor)',
    lastRun: '11:52 UTC',
    job: 'ads.grant',
    object: 'placement post_solve_rewarded',
    error: 'GrantTimeout: the ledger did not acknowledge 3 reward grants within 5 s',
    runs: [['11:52 UTC', 'warn'], ['Sep 7 11:52 UTC', 'ok'], ['Sep 6 11:52 UTC', 'ok']],
    items: [
      { label: 'pl_8f2c41 · +25 coins · Sep 7 19:04', outcome: 'failed', detail: 'Ledger acknowledgement timed out' },
      { label: 'pl_2a90bd · +25 coins · Sep 7 21:31', outcome: 'failed', detail: 'Ledger acknowledgement timed out' },
      { label: 'pl_71e0aa · +25 coins · Sep 8 07:12', outcome: 'failed', detail: 'Ledger acknowledgement timed out' }
    ]
  });

  // ------------------------------------------------------------------
  // import batches
  // ------------------------------------------------------------------

  C.data.importBatches.unshift({
    id: 'batch_2026_37', when: 'Sep 8 07:20', operator: 'i.koval', source: '2026-37-fixups.json',
    accepted: 6, rejected: 2,
    items: [
      { label: 'CW-2272 Night shift', outcome: 'ok', detail: 'Draft created' },
      { label: 'CW-2273 Low tide', outcome: 'ok', detail: 'Draft created' },
      { label: 'CW-2270 Paper trail', outcome: 'failed', detail: 'Grid letter does not match 3-down' },
      { label: 'D5-0931 Salt flats', outcome: 'failed', detail: 'Answer 2 reuses a word from the Sep 3 Daily challenge' }
    ]
  });
})(window.Console);
