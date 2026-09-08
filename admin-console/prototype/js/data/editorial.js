/* Editorial demo-data extension.
   OWNER: editorial builder. Runs after js/data.js and before the store is seeded.

   The seed in js/data.js lists validation issues for three puzzles but their
   `content` is a clean copy of the shared valid grid, so the issues would
   disappear the first time the editor re-ran validation. This file makes those
   three records genuinely broken, so E4 (validate → click the issue → fix →
   re-run → Passed) is a real loop rather than a scripted one.

   Only editorial-owned fields on editorial-owned records are touched: `content`,
   `topics` and `validationIssues`. No ids, statuses, kinds or languages change,
   so the drop desk and collections see exactly the same records as before. */
(function (C) {
  'use strict';

  function puzzle(id) {
    return C.data.puzzles.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* js/data.js builds every crossword from two shared clue arrays, so the clue
     objects are shared between records. Detach a record's content before
     editing it, or the edit would leak into every puzzle built from the same
     grid. (The store itself is deep-cloned in Console.seed, so runtime edits in
     the editor are already safe.) */
  function detach(p) {
    p.content = JSON.parse(JSON.stringify(p.content));
    return p;
  }

  function acrossClue(p, n) {
    return p.content.clues.across.filter(function (c) { return c.n === n; })[0];
  }

  // -- CW-2264 “On the map” · Needs review · validation failed -------------
  // Seeded issues: no clue for 7-across, no topic. Make both true.
  var cw2264 = puzzle('CW-2264');
  if (cw2264) {
    detach(cw2264);
    acrossClue(cw2264, 7).clue = '';
    cw2264.topics = [];
    cw2264.validationIssues = [
      { code: 'clue_missing', where: '7-across', message: 'No clue for 7-across' },
      { code: 'topic_missing', where: 'metadata', message: 'At least one topic is required before approval' }
    ];
  }

  // -- CW-2270 “Paper trail” · Ukrainian · Draft · validation failed -------
  // One deliberate grid/answer mismatch and one missing clue.
  var cw2270 = puzzle('CW-2270');
  if (cw2270) {
    detach(cw2270);
    cw2270.content.grid[2][1] = 'V';            // row 3, column 2
    acrossClue(cw2270, 9).clue = '';
    cw2270.validationIssues = [
      { code: 'grid_answer_mismatch', where: 'row 3, column 2', message: 'Grid letter V does not match the answer for 7-across' },
      { code: 'clue_missing', where: '9-across', message: 'No clue for 9-across' }
    ];
  }

  // -- D5-0923 “Hard water” · Ukrainian · Draft · validation failed --------
  // Answer 2 is four letters; answer 1 was used inside the reuse window.
  var d50923 = puzzle('D5-0923');
  if (d50923) {
    detach(d50923);
    d50923.content.answers = ['ЗЕМЛЯ', 'ВОДА', 'ХМАРА', 'ВІТЕР', 'ПОТІК'];
    d50923.content.hint = 'П\'ять слів про воду і погоду.';
    d50923.validationIssues = [
      { code: 'answer_length', where: 'answer 2', message: 'ВОДА is four letters. Answers must be exactly five letters' },
      { code: 'answer_reuse', where: 'answer 1', message: 'ЗЕМЛЯ was used in D5-0911 within the 90-day reuse window' }
    ];
  }

  /* Words the demo dictionary rejects, and answers the demo reuse window has
     already seen. Both are read by the validator in js/screens/editor.js. */
  C.data.editorial = {
    notInDictionary: ['ЙЙЙЙЙ', 'ААААА', 'ZZZZZ', 'QQQQQ', 'XXXXX', 'ABCDE'],
    /* Keep this list to answers that no puzzle seeded as “passed” uses, or
       re-running validation on a healthy puzzle would fail it. */
    recentlyUsed: { 'ЗЕМЛЯ': 'D5-0911' }
  };
})(window.Console);
