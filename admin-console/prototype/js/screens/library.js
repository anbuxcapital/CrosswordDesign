/* Puzzle library — the content editor's default screen.
   OWNER: editorial builder.
   Routes: #/library
   Use cases: E1 import a batch, E2 create or duplicate, entry point for E3–E7.

   This file also defines Console.editorial — the small set of helpers the
   editor screen shares with the library (id minting, blank content, validation,
   correction bookkeeping). editor.js loads after this file and calls them at
   click time, so the definition order below is the only coupling. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  // =====================================================================
  // shared editorial helpers (Console.editorial)
  // =====================================================================

  var ED = {};

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  ED.clone = clone;

  ED.KIND_LABEL = { cw: 'Crossword', d5: 'Daily Five' };
  ED.LANG_LABEL = { en: 'English', uk: 'Ukrainian' };

  ED.kindLabel = function (k) { return ED.KIND_LABEL[k] || k; };
  ED.langLabel = function (l) { return ED.LANG_LABEL[l] || l; };

  /* Mint the next free id for a kind. `taken` collects ids minted earlier in
     the same batch but not yet pushed into the store. */
  ED.nextId = function (kind, taken) {
    var prefix = kind === 'd5' ? 'D5-' : 'CW-';
    var max = 0;
    C.store.puzzles.forEach(function (p) {
      if (p.id.indexOf(prefix) !== 0) return;
      var n = parseInt(p.id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    (taken || []).forEach(function (id) {
      if (id.indexOf(prefix) !== 0) return;
      var n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return prefix + String(max + 1).padStart(4, '0');
  };

  /* Empty content for a brand-new puzzle. A crossword gets a blank 5×5 grid
     and the ten standard clue slots; a Daily Five gets five blank answers. */
  ED.blankContent = function (kind) {
    if (kind === 'd5') return { answers: ['', '', '', '', ''], hint: '' };
    var grid = [];
    for (var r = 0; r < 5; r++) grid.push(['', '', '', '', '']);
    function slots(nums) {
      return nums.map(function (n) { return { n: n, clue: '', answer: '' }; });
    }
    return {
      size: 5,
      grid: grid,
      clues: { across: slots([1, 6, 7, 8, 9]), down: slots([1, 2, 3, 4, 5]) }
    };
  };

  /* A known-good content block of the given kind, copied from a puzzle that
     already passes validation. Used by the import simulation so imported drafts
     are real, previewable puzzles rather than empty shells. */
  ED.sampleContent = function (kind) {
    var src = C.store.puzzles.filter(function (p) {
      return p.kind === kind && p.validation === 'passed';
    })[0];
    return src ? clone(src.content) : ED.blankContent(kind);
  };

  ED.newPuzzle = function (spec) {
    return {
      id: spec.id,
      title: spec.title,
      kind: spec.kind,
      lang: spec.lang,
      difficulty: spec.difficulty,
      status: 'draft',
      validation: 'not_run',
      validationIssues: [],
      version: spec.version || 1,
      author: spec.author || ((C.store.session.operator && C.store.session.operator.handle) || 'unknown'),
      topics: (spec.topics || []).slice(),
      updatedAt: nowStamp(),
      content: spec.content,
      correctionOf: spec.correctionOf || null,
      note: spec.note || ''
    };
  };

  function nowStamp() {
    var newest = C.store.audit[0];
    return newest ? newest.time : 'Sep 8 12:08';
  }
  ED.nowStamp = nowStamp;

  // ---------------------------------------------------------------------
  // validation (E4). Deterministic, runs against whatever content is on
  // screen, so filling a missing clue really does clear its issue.
  // ---------------------------------------------------------------------

  var MAX_ISSUES = 12;

  function dict() { return (C.data.editorial && C.data.editorial.notInDictionary) || []; }
  function reused() { return (C.data.editorial && C.data.editorial.recentlyUsed) || {}; }

  ED.inDictionary = function (word) {
    var w = (word || '').trim().toUpperCase();
    if (w.length !== 5) return false;
    if (/[^A-ZА-ЯЁЄІЇҐ'’-]/.test(w)) return false;   // letters only
    return dict().indexOf(w) < 0;
  };
  ED.reuseOf = function (word) {
    var w = (word || '').trim().toUpperCase();
    return reused()[w] || null;
  };

  /* ED.validate(puzzle) → [{code, where, message}] */
  ED.validate = function (p) {
    var issues = [];
    var c = p.content || {};

    if (!(p.title || '').trim()) {
      issues.push({ code: 'title_missing', where: 'metadata', message: 'The game needs a title before it can be approved' });
    }
    if (!(p.topics || []).length) {
      issues.push({ code: 'topic_missing', where: 'metadata', message: 'At least one topic is required before approval' });
    }

    if (p.kind === 'cw') {
      var grid = c.grid || [];
      var empties = 0;
      grid.forEach(function (row) {
        row.forEach(function (ch) { if (!(ch || '').trim()) empties++; });
      });
      if (empties) {
        issues.push({
          code: 'grid_empty', where: 'grid',
          message: empties + ' grid ' + (empties === 1 ? 'cell is' : 'cells are') + ' empty'
        });
      }

      var across = (c.clues && c.clues.across) || [];
      var down = (c.clues && c.clues.down) || [];

      function checkClues(list, dir) {
        list.forEach(function (cl, i) {
          var where = cl.n + '-' + dir;
          if (!(cl.clue || '').trim()) {
            issues.push({ code: 'clue_missing', where: where, message: 'No clue for ' + where });
          }
          var a = (cl.answer || '').trim().toUpperCase();
          if (a.length !== 5) {
            issues.push({
              code: 'answer_length', where: where,
              message: 'The answer for ' + where + ' is ' + a.length + ' letters. It must be exactly five'
            });
          } else if (!ED.inDictionary(a)) {
            issues.push({ code: 'invalid_entry', where: where, message: a + ' is not in the ' + ED.langLabel(p.lang) + ' dictionary' });
          }
        });
      }
      checkClues(across, 'across');
      checkClues(down, 'down');

      // One issue per mismatched cell, whichever direction disagrees first.
      if (!empties) {
        for (var r = 0; r < grid.length; r++) {
          for (var col = 0; col < (grid[r] || []).length; col++) {
            var letter = (grid[r][col] || '').toUpperCase();
            var aAns = ((across[r] || {}).answer || '').toUpperCase();
            var dAns = ((down[col] || {}).answer || '').toUpperCase();
            var bad = null;
            if (aAns.length === 5 && aAns.charAt(col) !== letter) bad = (across[r].n) + '-across';
            else if (dAns.length === 5 && dAns.charAt(r) !== letter) bad = (down[col].n) + '-down';
            if (bad) {
              issues.push({
                code: 'grid_answer_mismatch',
                where: 'row ' + (r + 1) + ', column ' + (col + 1),
                message: 'Grid letter ' + (letter || '—') + ' does not match the answer for ' + bad
              });
            }
          }
        }
      }
    } else {
      var answers = (c.answers || []);
      answers.forEach(function (a, i) {
        var w = (a || '').trim().toUpperCase();
        var where = 'answer ' + (i + 1);
        if (!w) {
          issues.push({ code: 'answer_missing', where: where, message: 'Answer ' + (i + 1) + ' is empty' });
          return;
        }
        if (w.length !== 5) {
          issues.push({
            code: 'answer_length', where: where,
            message: w + ' is ' + w.length + ' letters. Answers must be exactly five letters'
          });
          return;
        }
        if (!ED.inDictionary(w)) {
          issues.push({ code: 'invalid_entry', where: where, message: w + ' is not in the ' + ED.langLabel(p.lang) + ' dictionary' });
        }
        var prior = ED.reuseOf(w);
        if (prior) {
          issues.push({
            code: 'answer_reuse', where: where,
            message: w + ' was used in ' + prior + ' within the 90-day reuse window'
          });
        }
      });
      var seen = {};
      answers.forEach(function (a, i) {
        var w = (a || '').trim().toUpperCase();
        if (!w) return;
        if (seen[w] != null) {
          issues.push({
            code: 'answer_duplicate', where: 'answer ' + (i + 1),
            message: w + ' repeats answer ' + (seen[w] + 1) + ' in this Daily Five'
          });
        } else seen[w] = i;
      });
      if (!(c.hint || '').trim()) {
        issues.push({ code: 'hint_missing', where: 'metadata', message: 'The Daily Five hint is empty' });
      }
    }

    if (issues.length > MAX_ISSUES) {
      var extra = issues.length - MAX_ISSUES;
      issues = issues.slice(0, MAX_ISSUES);
      issues.push({
        code: 'more', where: 'grid',
        message: extra + ' further ' + (extra === 1 ? 'issue is' : 'issues are') + ' hidden. Fix these first and run validation again'
      });
    }
    return issues;
  };

  ED.summary = function (issues) {
    if (!issues.length) return 'Validation passed';
    return 'Validation failed · ' + issues.length + (issues.length === 1 ? ' issue' : ' issues');
  };

  C.editorial = ED;

  // =====================================================================
  // screen state
  // =====================================================================

  /* Per-screen UI state lives on the store so it survives the full re-render
     that follows every commit. The operations builder writes
     store.ui.library.filter (or navigates to #/library?status=…) before
     handing over from O2/O3; both routes are supported. */
  C.store.ui.library = C.store.ui.library || {};
  var LIB = C.store.ui.library;
  if (LIB.filter == null) LIB.filter = 'all';
  if (LIB.status == null) LIB.status = null;
  if (LIB.lang == null) LIB.lang = 'all';
  if (LIB.q == null) LIB.q = '';
  if (LIB.selected == null) LIB.selected = [];

  function st() { return C.store.ui.library; }

  var CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'cw', label: 'Crossword' },
    { key: 'd5', label: 'Daily Five' },
    { key: 'review', label: 'Needs review' },
    { key: 'failed', label: 'Validation failed' }
  ];
  var CHIP_KEYS = CHIPS.map(function (c) { return c.key; });
  var STATUS_KEYS = ['draft', 'review', 'approved', 'scheduled', 'published', 'live'];

  // ---------------------------------------------------------------------
  // query hints — #/library?status=approved&kind=d5&lang=en
  // The shell router splits the hash on "/" and would not match a route with a
  // query string, so the hint is consumed and stripped before the router sees
  // it. This listener is registered while the file loads, which is before
  // Console.boot() adds the router's own hashchange listener, so it runs first.
  // ---------------------------------------------------------------------

  function applyHints(query) {
    var s = st();
    query.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      var v = decodeURIComponent(i < 0 ? '' : pair.slice(i + 1));
      if (k === 'kind' && (v === 'cw' || v === 'd5')) s.filter = v;
      else if (k === 'status') s.status = STATUS_KEYS.indexOf(v) >= 0 ? v : null;
      else if (k === 'lang') s.lang = (v === 'en' || v === 'uk') ? v : 'all';
      else if (k === 'q') s.q = v;
      else if (k === 'filter') s.filter = v;
    });
    s.selected = [];
  }

  function normalizeHash() {
    var raw = location.hash || '';
    var qi = raw.indexOf('?');
    if (qi < 0) return;
    var base = raw.slice(0, qi);
    if (base !== '#/library') return;
    applyHints(raw.slice(qi + 1));
    location.hash = base;   // the router then sees a clean, matchable route
  }

  window.addEventListener('hashchange', normalizeHash);
  normalizeHash();

  // ---------------------------------------------------------------------
  // filtering
  // ---------------------------------------------------------------------

  function activeFilter() {
    var f = st().filter;
    // Tolerate a status key written straight into `filter` by another builder.
    return CHIP_KEYS.indexOf(f) >= 0 ? f : 'all';
  }

  function activeStatus() {
    var f = st().filter;
    if (STATUS_KEYS.indexOf(f) >= 0) return f;
    return STATUS_KEYS.indexOf(st().status) >= 0 ? st().status : null;
  }

  function rows() {
    var f = activeFilter();
    var status = activeStatus();
    var lang = st().lang;
    var q = st().q.trim().toLowerCase();

    return C.store.puzzles.filter(function (p) {
      if (f === 'cw' && p.kind !== 'cw') return false;
      if (f === 'd5' && p.kind !== 'd5') return false;
      if (f === 'review' && p.status !== 'review') return false;
      if (f === 'failed' && p.validation !== 'failed') return false;
      if (status && p.status !== status) return false;
      if (lang !== 'all' && p.lang !== lang) return false;
      if (!q) return true;
      return (p.id + ' ' + p.title + ' ' + p.author + ' ' + (p.topics || []).join(' ')).toLowerCase().indexOf(q) >= 0;
    });
  }

  function isPublished(p) { return p.status === 'published' || p.status === 'live'; }

  // ---------------------------------------------------------------------
  // E1 — import a puzzle batch
  // ---------------------------------------------------------------------

  var IMPORT_FILES = [
    {
      name: '2026-37-crosswords.json', size: '18 KB', items: [
        { title: 'Harbour lights', kind: 'cw', lang: 'en', difficulty: 'Medium', topics: ['Travel'], outcome: 'ok' },
        { title: 'Paper lantern', kind: 'cw', lang: 'en', difficulty: 'Easy', topics: ['Home'], outcome: 'ok' },
        { title: 'Broken symmetry', kind: 'cw', lang: 'en', difficulty: 'Hard', topics: ['Science'], outcome: 'failed', detail: 'Row 4 spells NRTSE, which is not in the English dictionary' }
      ]
    },
    {
      name: '2026-37-dailyfive.json', size: '6 KB', items: [
        { title: 'Second wind', kind: 'd5', lang: 'en', difficulty: 'Easy', topics: ['Sport'], outcome: 'ok' },
        { title: 'Loose change', kind: 'd5', lang: 'en', difficulty: 'Medium', topics: ['Everyday'], outcome: 'ok' },
        { title: 'Deep water', kind: 'd5', lang: 'en', difficulty: 'Hard', topics: ['Nature'], outcome: 'ok' }
      ]
    },
    {
      name: 'uk-batch-04.json', size: '9 KB', items: [
        { title: 'Львівська кава', kind: 'cw', lang: 'uk', difficulty: 'Medium', topics: ['City'], outcome: 'ok' },
        { title: 'Осінній вітер', kind: 'd5', lang: 'uk', difficulty: 'Medium', topics: ['Nature'], outcome: 'failed', detail: 'Answer 3 is four letters, not five' }
      ]
    },
    {
      name: 'retry-CW-2270.json', size: '2 KB', items: [
        { title: 'Paper trail (retry)', kind: 'cw', lang: 'uk', difficulty: 'Medium', topics: ['Work'], outcome: 'ok' }
      ]
    }
  ];

  function importFlow() {
    var picked = IMPORT_FILES.map(function (f) { return f.name; });

    function chosenFiles() {
      return IMPORT_FILES.filter(function (f) { return picked.indexOf(f.name) >= 0; });
    }
    function chosenItems() {
      var out = [];
      chosenFiles().forEach(function (f) {
        f.items.forEach(function (it) { out.push(Object.assign({ file: f.name }, it)); });
      });
      return out;
    }

    // -- step 1 ---------------------------------------------------------
    function step1() {
      var body = el('div');
      body.appendChild(el('div', 'help', 'Step 1 of 3 · Pick files. Drag and drop is simulated in this prototype: the four files below stand in for the drop zone.'));
      var list = el('div');
      list.style.marginTop = '12px';
      IMPORT_FILES.forEach(function (f) {
        var on = picked.indexOf(f.name) >= 0;
        var row = el('div', 'check-row' + (on ? ' is-on' : ''));
        var box = el('button', 'checkbox' + (on ? ' is-on' : ''), on ? '✓' : '');
        box.type = 'button';
        box.setAttribute('aria-pressed', String(on));
        box.setAttribute('aria-label', (on ? 'Deselect ' : 'Select ') + f.name);
        box.addEventListener('click', function () {
          picked = on ? picked.filter(function (n) { return n !== f.name; }) : picked.concat([f.name]);
          step1();
        });
        row.appendChild(box);
        var txt = el('div', 'check-row-text');
        txt.appendChild(el('div', 'check-row-label', f.name));
        txt.appendChild(el('div', 'check-row-detail', f.items.length + ' game' + (f.items.length === 1 ? '' : 's') + ' · ' + f.size + ' · JSON'));
        row.appendChild(txt);
        row.appendChild(el('div', 'spacer'));
        row.appendChild(C.ui.status(f.items.some(function (i) { return i.outcome === 'failed'; }) ? 'warn' : 'ok',
          f.items.some(function (i) { return i.outcome === 'failed'; }) ? 'Contains rejects' : 'Reads cleanly'));
        list.appendChild(row);
      });
      body.appendChild(list);

      C.ui.modal({
        title: 'Import games',
        body: body,
        wide: true,
        secondary: { label: 'Cancel' },
        primary: {
          label: 'Validate ' + chosenItems().length + ' games',
          disabled: function () { return !picked.length; },
          onClick: step2
        }
      });
    }

    // -- step 2 ---------------------------------------------------------
    function step2() {
      var items = chosenItems();
      var accepted = items.filter(function (i) { return i.outcome === 'ok'; });
      var rejected = items.filter(function (i) { return i.outcome !== 'ok'; });

      var body = el('div');
      body.appendChild(el('div', 'help', 'Step 2 of 3 · Validation summary. Rejected games are not imported; they stay in the batch record so Operations can open them (O3).'));

      var cards = el('div', 'cards-3');
      cards.style.margin = '12px 0';
      [['Files', chosenFiles().length, 'Selected in step 1'],
       ['Accepted', accepted.length, 'Will be created as Draft'],
       ['Rejected', rejected.length, 'Listed with a reason, not created']].forEach(function (s) {
        var c = el('div', 'stat');
        c.appendChild(el('div', 'eyebrow', s[0]));
        c.appendChild(el('div', 'stat-value', String(s[1])));
        c.appendChild(el('div', 'stat-note', s[2]));
        cards.appendChild(c);
      });
      body.appendChild(cards);

      body.appendChild(C.ui.results(items.map(function (i) {
        return {
          label: i.title + ' · ' + ED.kindLabel(i.kind) + ' · ' + ED.langLabel(i.lang),
          outcome: i.outcome === 'ok' ? 'ok' : 'failed',
          outcomeLabel: i.outcome === 'ok' ? 'Accepted' : 'Rejected',
          detail: i.outcome === 'ok' ? i.file : i.detail
        };
      })));

      C.ui.modal({
        title: 'Import games',
        body: body,
        wide: true,
        secondary: { label: 'Back', onClick: step1 },
        primary: {
          label: 'Review import',
          disabled: function () { return !accepted.length; },
          onClick: function () { step3(accepted, rejected, items); }
        }
      });
    }

    // -- step 3 ---------------------------------------------------------
    function step3(accepted, rejected, items) {
      var body = el('div');
      body.appendChild(el('div', 'help', 'Step 3 of 3 · Confirm. Importing creates Draft games only; nothing is scheduled or published.'));
      var wrap = el('div');
      wrap.style.marginTop = '12px';
      wrap.appendChild(C.ui.reviewPanel({
        title: 'Review the import',
        before: [
          ['Library', C.store.puzzles.length + ' games'],
          ['Drafts', C.store.puzzles.filter(function (p) { return p.status === 'draft'; }).length + ' drafts'],
          ['Import batches', C.store.importBatches.length + ' batches']
        ],
        after: [
          ['Library', (C.store.puzzles.length + accepted.length) + ' games'],
          ['Drafts', (C.store.puzzles.filter(function (p) { return p.status === 'draft'; }).length + accepted.length) + ' drafts'],
          ['Import batches', (C.store.importBatches.length + 1) + ' batches']
        ],
        consequence: accepted.length + ' games are created as Draft with validation Not run. ' +
          rejected.length + ' rejected ' + (rejected.length === 1 ? 'game stays' : 'games stay') +
          ' in the batch record for Operations to open. No Daily challenge is affected.'
      }));
      body.appendChild(wrap);

      C.ui.modal({
        title: 'Import games',
        body: body,
        wide: true,
        secondary: { label: 'Back', onClick: step2 },
        primary: {
          label: 'Import ' + accepted.length + ' games',
          onClick: function () { doImport(accepted, rejected, items); }
        }
      });
    }

    function doImport(accepted, rejected, items) {
      var taken = [];
      var created = accepted.map(function (i) {
        var id = ED.nextId(i.kind, taken);
        taken.push(id);
        return ED.newPuzzle({
          id: id, title: i.title, kind: i.kind, lang: i.lang,
          difficulty: i.difficulty, topics: i.topics,
          content: ED.sampleContent(i.kind),
          note: 'Imported from ' + i.file
        });
      });

      var batchId = 'batch_import_' + (C.store.importBatches.length + 1);
      var sources = chosenFiles().map(function (f) { return f.name; }).join(', ');

      C.commit({
        action: 'Import games',
        object: batchId,
        reason: '',
        result: created.length + ' drafts created from ' + chosenFiles().length + ' files · ' +
          rejected.length + ' rejected · ' + created.map(function (p) { return p.id; }).join(', '),
        apply: function (store) {
          created.forEach(function (p) { store.puzzles.push(p); });
          store.importBatches.unshift({
            id: batchId,
            when: ED.nowStamp(),
            operator: (store.session.operator && store.session.operator.handle) || 'unknown',
            source: sources,
            accepted: created.length,
            rejected: rejected.length,
            items: items.map(function (i, n) {
              var made = i.outcome === 'ok' ? created[accepted.indexOf(i)] : null;
              return {
                label: (made ? made.id + ' ' : '') + i.title,
                outcome: i.outcome === 'ok' ? 'ok' : 'failed',
                detail: i.outcome === 'ok' ? 'Draft created from ' + i.file : i.detail
              };
            })
          });
          st().filter = 'all';
          st().status = 'draft';
          st().lang = 'all';
          st().q = '';
          st().selected = created.map(function (p) { return p.id; });
        },
        silent: true
      });

      var body = el('div');
      body.appendChild(el('div', 'help', 'Imported. The new drafts are selected in the library and the batch is visible in Operations.'));
      var res = el('div');
      res.style.marginTop = '12px';
      res.appendChild(C.ui.results(created.map(function (p) {
        return { label: p.id + ' ' + p.title, outcome: 'ok', outcomeLabel: 'Created', detail: 'Draft · validation not run' };
      }).concat(rejected.map(function (i) {
        return { label: i.title, outcome: 'failed', outcomeLabel: 'Rejected', detail: i.detail };
      }))));
      body.appendChild(res);

      C.ui.modal({
        title: 'Import complete',
        body: body,
        wide: true,
        primary: {
          label: 'Done',
          onClick: function () { C.ui.closeModal(); C.render(); }
        }
      });
      C.toast(created.length + ' drafts imported.');
    }

    step1();
  }

  // ---------------------------------------------------------------------
  // E2 — new puzzle, and duplicate as draft
  // ---------------------------------------------------------------------

  function newPuzzleFlow() {
    var draft = { kind: 'cw', lang: 'en', difficulty: 'Medium', title: '' };

    function build() {
      var body = el('div');

      var r1 = el('div', 'form-row');
      r1.appendChild(el('label', 'label', 'Kind'));
      r1.appendChild(C.ui.segmented(
        [{ key: 'cw', label: 'Crossword' }, { key: 'd5', label: 'Daily Five' }],
        draft.kind, function (k) { draft.kind = k; build(); }
      ));
      r1.appendChild(el('div', 'help', draft.kind === 'cw'
        ? 'A 5 × 5 grid with five across and five down clues.'
        : 'Five five-letter answers and one shared hint.'));
      body.appendChild(r1);

      var r2 = el('div', 'form-row');
      r2.appendChild(el('label', 'label', 'Language'));
      var langRow = el('div', 'btn-row');
      [['en', 'English'], ['uk', 'Ukrainian']].forEach(function (l) {
        var b = el('button', 'chip' + (draft.lang === l[0] ? ' is-on' : ''), l[1]);
        b.type = 'button';
        b.addEventListener('click', function () { draft.lang = l[0]; build(); });
        langRow.appendChild(b);
      });
      r2.appendChild(langRow);
      body.appendChild(r2);

      var r3 = el('div', 'form-row');
      r3.appendChild(el('label', 'label', 'Difficulty'));
      var dRow = el('div', 'btn-row');
      ['Easy', 'Medium', 'Hard'].forEach(function (d) {
        var b = el('button', 'chip' + (draft.difficulty === d ? ' is-on' : ''), d);
        b.type = 'button';
        b.addEventListener('click', function () { draft.difficulty = d; build(); });
        dRow.appendChild(b);
      });
      r3.appendChild(dRow);
      body.appendChild(r3);

      var r4 = el('div', 'form-row');
      var lab = el('label', 'label', 'Title');
      lab.appendChild(el('span', 'req', 'required'));
      lab.setAttribute('for', 'new_puzzle_title');
      r4.appendChild(lab);
      var input = el('input', 'input');
      input.id = 'new_puzzle_title';
      input.type = 'text';
      input.value = draft.title;
      input.placeholder = 'e.g. Harbour lights';
      input.addEventListener('input', function () {
        draft.title = input.value;
        C.ui.refreshModal();
      });
      r4.appendChild(input);
      r4.appendChild(el('div', 'help', 'The next free id is ' + ED.nextId(draft.kind) + '. The ' + (draft.kind === 'cw' ? 'crossword' : 'Daily Five') + ' opens in the editor as a Draft with empty content.'));
      body.appendChild(r4);

      C.ui.modal({
        title: 'New game',
        body: body,
        secondary: { label: 'Cancel' },
        primary: {
          label: 'Create draft',
          disabled: function () { return !draft.title.trim(); },
          onClick: function () {
            var id = ED.nextId(draft.kind);
            var p = ED.newPuzzle({
              id: id, title: draft.title.trim(), kind: draft.kind,
              lang: draft.lang, difficulty: draft.difficulty, topics: [],
              content: ED.blankContent(draft.kind)
            });
            C.commit({
              action: 'Create a ' + (draft.kind === 'cw' ? 'crossword' : 'Daily Five'),
              object: id,
              reason: '',
              result: 'Draft ' + id + ' “' + p.title + '” created · ' + ED.kindLabel(p.kind) + ' · ' + ED.langLabel(p.lang) + ' · ' + p.difficulty,
              apply: function (store) { store.puzzles.push(p); },
              silent: true
            });
            C.ui.closeModal();
            C.toast('Draft ' + id + ' created.');
            C.go('#/library/' + id);
          }
        }
      });
      var t = document.getElementById('new_puzzle_title');
      if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
    }
    build();
  }

  function duplicateFlow(list) {
    var sources = list.filter(Boolean);
    if (!sources.length) return;

    var body = el('div');
    body.appendChild(el('div', 'help', sources.length === 1
      ? 'The copy keeps the content, language and difficulty of the original and starts again as a Draft at version 1.'
      : sources.length + ' games are copied. Each copy starts as a Draft at version 1.'));
    var res = el('div');
    res.style.marginTop = '12px';
    var taken = [];
    var plan = sources.map(function (p) {
      var id = ED.nextId(p.kind, taken);
      taken.push(id);
      return { src: p, id: id };
    });
    res.appendChild(C.ui.results(plan.map(function (x) {
      return {
        label: x.src.id + ' ' + x.src.title, outcome: 'ok', outcomeLabel: 'Copy',
        detail: 'becomes ' + x.id + ' · Draft'
      };
    })));
    body.appendChild(res);

    C.ui.modal({
      title: sources.length === 1 ? 'Duplicate as draft' : 'Duplicate ' + sources.length + ' games as drafts',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Duplicate as draft',
        onClick: function () {
          var made = plan.map(function (x) {
            return ED.newPuzzle({
              id: x.id,
              title: x.src.title + ' (copy)',
              kind: x.src.kind, lang: x.src.lang, difficulty: x.src.difficulty,
              topics: x.src.topics, content: clone(x.src.content),
              note: 'Duplicated from ' + x.src.id + ' v' + x.src.version
            });
          });
          C.commit({
            action: 'Duplicate as draft',
            object: plan.map(function (x) { return x.src.id; }).join(', '),
            reason: '',
            result: made.length + ' draft' + (made.length === 1 ? '' : 's') + ' created · ' + made.map(function (p) { return p.id; }).join(', '),
            apply: function (store) {
              made.forEach(function (p) { store.puzzles.push(p); });
              st().selected = [];
            },
            silent: true
          });
          C.ui.closeModal();
          C.toast(made.length === 1 ? 'Draft ' + made[0].id + ' created.' : made.length + ' drafts created.');
          if (made.length === 1) C.go('#/library/' + made[0].id);
          else C.render();
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // E7 — create a correction from a published puzzle
  // ---------------------------------------------------------------------

  function correctionFlow(src) {
    if (!isPublished(src)) return;
    var newId = ED.nextId(src.kind);
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Create a correction',
      before: [
        [src.id, src.title],
        ['Status', C.ui.pill(src.status)],
        ['Version', 'v' + src.version]
      ],
      after: [
        [newId, src.title],
        ['Status', C.ui.pill('draft')],
        ['Version', 'v' + (src.version + 1) + ' · correction of v' + src.version]
      ],
      consequence: src.id + ' stays published and keeps serving until the correction is approved and published. ' +
        'Players who have already solved ' + src.id + ' keep their result.'
    }));
    var reason = C.ui.reasonField({
      required: false,
      label: 'What needs correcting',
      placeholder: 'e.g. 7-across clue names the wrong river',
      help: 'Optional here. It is stored on the correction and shown again before the correction is published.'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Create correction',
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Create correction',
        onClick: function () {
          var note = 'Correction of ' + src.id + ' v' + src.version;
          var p = ED.newPuzzle({
            id: newId, title: src.title, kind: src.kind, lang: src.lang,
            difficulty: src.difficulty, topics: src.topics,
            content: clone(src.content),
            version: src.version + 1,
            correctionOf: src.id,
            note: note + (reason.value() ? ' · ' + reason.value() : '')
          });
          C.commit({
            action: 'Create correction',
            object: src.id,
            reason: reason.value(),
            result: newId + ' created as Draft v' + p.version + ' · ' + note,
            apply: function (store) {
              store.puzzles.push(p);
              st().selected = [];
            },
            silent: true
          });
          C.ui.closeModal();
          C.toast('Correction ' + newId + ' created as a draft.');
          C.go('#/library/' + newId);
        }
      }
    });
  }

  C.editorial.correctionFlow = correctionFlow;

  // ---------------------------------------------------------------------
  // row menu
  // ---------------------------------------------------------------------

  function rowMenu(p) {
    var body = el('div');
    var head = el('div', 'help', p.id + ' · ' + ED.kindLabel(p.kind) + ' · ' + ED.langLabel(p.lang) + ' · v' + p.version);
    body.appendChild(head);

    var list = el('div');
    list.style.marginTop = '12px';

    function action(label, detail, fn, disabled) {
      var b = el('button', 'check-row');
      b.type = 'button';
      b.style.width = '100%';
      b.style.textAlign = 'left';
      b.style.cursor = disabled ? 'not-allowed' : 'pointer';
      if (disabled) b.style.opacity = '.5';
      var txt = el('div', 'check-row-text');
      txt.appendChild(el('div', 'check-row-label', label));
      txt.appendChild(el('div', 'check-row-detail', detail));
      b.appendChild(txt);
      if (!disabled) b.addEventListener('click', function () { C.ui.closeModal(); fn(); });
      list.appendChild(b);
    }

    action('Open in editor', 'Metadata, content, validation and preview', function () { C.go('#/library/' + p.id); });
    action('Duplicate as draft', 'Copies the content into a new Draft at version 1', function () { duplicateFlow([p]); });
    action('Create correction',
      isPublished(p)
        ? 'New version in Draft, noted as a correction of v' + p.version
        : 'Only a Published or Live game can be corrected',
      function () { correctionFlow(p); },
      !isPublished(p));

    body.appendChild(list);

    C.ui.modal({
      title: p.title,
      body: body,
      secondary: { label: 'Close' }
    });
  }

  // ---------------------------------------------------------------------
  // screen
  // ---------------------------------------------------------------------

  function repaint(mount, keepFocus) {
    mount.innerHTML = '';
    build(mount);
    if (keepFocus) {
      var s = mount.querySelector('#library_search');
      if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    }
  }

  function filterBar(mount) {
    var bar = el('div', 'desk-toolbar');
    bar.style.flexWrap = 'wrap';

    var show = el('div', 'btn-row');
    show.appendChild(el('span', 'eyebrow', 'Show'));
    CHIPS.forEach(function (c) {
      var on = activeFilter() === c.key && !(c.key === 'all' && activeStatus());
      var b = el('button', 'chip' + (on ? ' is-on' : ''), c.label);
      b.type = 'button';
      b.addEventListener('click', function () {
        st().filter = c.key;
        if (c.key !== 'all') st().status = activeStatus();
        st().selected = [];
        repaint(mount);
      });
      show.appendChild(b);
    });

    var status = activeStatus();
    if (status) {
      var sc = el('button', 'chip is-on');
      sc.type = 'button';
      sc.appendChild(document.createTextNode((C.ui.STATUS[status] || {}).label || status));
      sc.appendChild(el('span', null, ' ✕'));
      sc.setAttribute('aria-label', 'Clear the ' + status + ' status filter');
      sc.addEventListener('click', function () {
        st().status = null;
        if (STATUS_KEYS.indexOf(st().filter) >= 0) st().filter = 'all';
        st().selected = [];
        repaint(mount);
      });
      show.appendChild(sc);
    }
    bar.appendChild(show);

    var langRow = el('div', 'btn-row');
    langRow.appendChild(el('span', 'eyebrow', 'Language'));
    [['all', 'All'], ['en', 'English'], ['uk', 'Ukrainian']].forEach(function (l) {
      var b = el('button', 'chip' + (st().lang === l[0] ? ' is-on' : ''), l[1]);
      b.type = 'button';
      b.addEventListener('click', function () { st().lang = l[0]; st().selected = []; repaint(mount); });
      langRow.appendChild(b);
    });
    bar.appendChild(langRow);

    bar.appendChild(el('div', 'spacer'));

    var search = el('input', 'input');
    search.id = 'library_search';
    search.type = 'search';
    search.style.maxWidth = '260px';
    search.placeholder = 'Search by id, title, author or topic';
    search.setAttribute('aria-label', 'Search the library');
    search.value = st().q;
    search.addEventListener('input', function () {
      st().q = search.value;
      st().selected = [];
      repaint(mount, true);
    });
    bar.appendChild(search);

    bar.appendChild(C.ui.densitySwitch());
    return bar;
  }

  function bulkBar(mount, list) {
    var sel = st().selected.filter(function (id) { return C.find.puzzle(id); });
    var chosen = sel.map(C.find.puzzle);
    var allPublished = chosen.length > 0 && chosen.every(isPublished);

    var bar = el('div', 'bulk-bar' + (sel.length ? ' is-active' : ''));
    bar.appendChild(el('span', 'bulk-label', sel.length
      ? sel.length + ' game' + (sel.length === 1 ? '' : 's') + ' selected'
      : list.length + ' game' + (list.length === 1 ? '' : 's') + ' shown'));
    bar.appendChild(el('span', 'bulk-hint', sel.length
      ? sel.join(', ')
      : 'Tick rows to duplicate several at once, or open a row to edit, validate, preview and approve it.'));
    bar.appendChild(el('div', 'spacer'));

    if (sel.length) {
      bar.appendChild(C.ui.button('Duplicate as draft', {
        small: true,
        onClick: function () { duplicateFlow(chosen); }
      }));
      bar.appendChild(C.ui.button('Create correction', {
        small: true,
        disabled: !allPublished || sel.length !== 1,
        onClick: function () { correctionFlow(chosen[0]); }
      }));
      bar.appendChild(C.ui.button('Clear selection', {
        small: true, variant: 'quiet',
        onClick: function () { st().selected = []; repaint(mount); }
      }));
      if (!allPublished || sel.length !== 1) {
        bar.appendChild(el('span', 'bulk-hint',
          'A correction is made from exactly one Published or Live row.'));
      }
    } else {
      bar.appendChild(C.ui.button('Select every row shown', {
        small: true,
        disabled: !list.length,
        onClick: function () {
          st().selected = list.map(function (p) { return p.id; });
          repaint(mount);
        }
      }));
    }
    return bar;
  }

  function table(mount, list) {
    return C.ui.table({
      cols: [
        { key: 'id', label: 'ID', cls: 'cell-id', width: '116px' },
        {
          key: 'title', label: 'Title', cls: 'cell-title',
          render: function (p) {
            var w = el('span');
            w.appendChild(el('span', null, p.title));
            if (p.correctionOf) {
              var tag = el('span', 'chip chip-sm', 'Correction');
              tag.style.marginLeft = '8px';
              w.appendChild(tag);
            }
            return w;
          }
        },
        {
          key: 'kind', label: 'Kind and language', width: '190px', cls: 'nowrap',
          render: function (p) { return ED.kindLabel(p.kind) + ' · ' + ED.langLabel(p.lang); }
        },
        { key: 'difficulty', label: 'Difficulty', width: '106px', cls: 'nowrap' },
        { key: 'status', label: 'Status', width: '150px', render: function (p) { return C.ui.pill(p.status); } },
        { key: 'validation', label: 'Validation', width: '120px', render: function (p) { return C.ui.status(p.validation); } },
        { key: 'version', label: 'Version', align: 'right', width: '86px', render: function (p) { return 'v' + p.version; } },
        { key: 'updatedAt', label: 'Updated', align: 'right', width: '118px', cls: 'nowrap' },
        {
          key: 'menu', label: '', align: 'right', width: '56px',
          render: function (p) {
            var b = el('button', 'btn btn-sm btn-quiet', '⋯');
            b.type = 'button';
            b.setAttribute('aria-label', 'Actions for ' + p.id);
            b.addEventListener('click', function (e) { e.stopPropagation(); rowMenu(p); });
            return b;
          }
        }
      ],
      rows: list,
      onRowClick: function (p) { C.go('#/library/' + p.id); },
      selectable: {
        selected: st().selected,
        idKey: 'id',
        onChange: function (next) { st().selected = next; repaint(mount); }
      },
      empty: 'No games match these filters. Clear a filter, or import a batch.'
    });
  }

  /* Another builder may write a status key straight into `filter` (the O2
     hand-off). Fold it into the status dimension so both chip rows stay
     independent and the ✕ chip can clear it. */
  function normalizeState() {
    if (STATUS_KEYS.indexOf(st().filter) >= 0) {
      st().status = st().filter;
      st().filter = 'all';
    }
    if (CHIP_KEYS.indexOf(st().filter) < 0) st().filter = 'all';
  }

  function build(mount) {
    normalizeState();
    var list = rows();

    var needsReview = C.store.puzzles.filter(function (p) { return p.status === 'review'; });
    var failing = C.store.puzzles.filter(function (p) { return p.validation === 'failed'; });
    if (needsReview.length || failing.length) {
      var b = el('div', 'banner attention');
      b.appendChild(el('span', 'banner-dot'));
      b.appendChild(el('div', 'banner-text',
        needsReview.length + ' game' + (needsReview.length === 1 ? '' : 's') + ' waiting for review · ' +
        failing.length + ' failing validation'));
      b.appendChild(el('div', 'banner-detail', 'Open one to validate, fix and approve it.'));
      b.appendChild(el('div', 'spacer'));
      b.appendChild(C.ui.button('Show needs review', {
        small: true,
        onClick: function () { st().filter = 'review'; st().status = null; st().selected = []; repaint(mount); }
      }));
      b.appendChild(C.ui.button('Show validation failed', {
        small: true,
        onClick: function () { st().filter = 'failed'; st().status = null; st().selected = []; repaint(mount); }
      }));
      mount.appendChild(b);
    }

    mount.appendChild(filterBar(mount));
    mount.appendChild(bulkBar(mount, list));

    var wrap = el('div');
    wrap.className = 'rule-top';
    wrap.appendChild(table(mount, list));
    mount.appendChild(wrap);

    var foot = el('div', 'table-foot');
    foot.appendChild(el('span', null, list.length + ' of ' + C.store.puzzles.length + ' games shown · ' +
      C.store.puzzles.filter(function (p) { return p.lang === 'en'; }).length + ' English · ' +
      C.store.puzzles.filter(function (p) { return p.lang === 'uk'; }).length + ' Ukrainian'));
    foot.appendChild(el('span', 'spacer'));
    foot.appendChild(el('span', null, 'Approved and unassigned: ' +
      C.store.puzzles.filter(function (p) { return p.status === 'approved' && p.kind === 'cw'; }).length + ' crosswords · ' +
      C.store.puzzles.filter(function (p) { return p.status === 'approved' && p.kind === 'd5'; }).length + ' Daily Five'));
    mount.appendChild(foot);
  }

  C.registerScreen('#/library', {
    title: 'Library',
    subline: function () {
      return 'Crosswords and Daily Five (one word, six tries) · ' + C.store.puzzles.length + ' games · English and Ukrainian · ' +
        C.store.puzzles.filter(function (p) { return p.status === 'draft'; }).length + ' drafts';
    },
    actions: function () {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.button('Import', { onClick: importFlow }));
      row.appendChild(C.ui.button('New game', { variant: 'pink', onClick: newPuzzleFlow }));
      return row;
    },
    render: function (mount) { build(mount); }
  });

  // ---------------------------------------------------------------------
  // screen-specific CSS (library + editor share this block)
  // ---------------------------------------------------------------------

  if (!document.getElementById('editorial-css')) {
    var style = el('style');
    style.id = 'editorial-css';
    style.textContent = [
      /* library table */
      '.tbl td.nowrap,.tbl td.cell-id{white-space:nowrap}',
      '.tbl td.cell-title{min-width:150px}',
      /* editor review bar */
      '.ed-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px var(--pad-x);',
      '  border-bottom:1px solid var(--rule);background:var(--paper)}',
      '.ed-facts{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
      '.ed-fact{display:flex;flex-direction:column;gap:2px}',
      '.ed-fact .k{font:700 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-55)}',
      '.ed-fact .v{font:700 13px var(--sans)}',
      '.ed-dirty{font:700 11px var(--mono);color:var(--gold)}',
      '.ed-body{padding:16px var(--pad-x);display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.ed-cols{display:grid;grid-template-columns:minmax(300px,360px) minmax(0,1fr);gap:18px;align-items:start}',
      '.ed-note{font:400 12px/1.5 var(--sans);color:var(--ink-55);max-width:620px}',
      /* crossword grid */
      '.cwgrid{display:grid;grid-template-columns:repeat(5,46px);gap:3px}',
      '.cwcell{position:relative}',
      '.cwcell input{width:46px;height:46px;text-align:center;text-transform:uppercase;',
      '  font:800 18px var(--mono);border:1px solid var(--ink-28);border-radius:3px;background:var(--paper);color:var(--ink);padding:0}',
      '.cwcell input:focus{border-color:var(--pink);outline:none;box-shadow:0 0 0 2px var(--pink-wash)}',
      '.cwcell.is-flagged input{border-color:var(--pink);background:var(--pink-tint)}',
      '.cwcell .n{position:absolute;top:1px;left:3px;font:700 8px var(--mono);color:var(--ink-45);pointer-events:none}',
      /* clue rows */
      '.clues{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.clue-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--rule);',
      '  border-radius:var(--radius);background:var(--paper)}',
      '.clue-row.is-flagged{border-color:var(--pink);background:var(--pink-wash)}',
      '.clue-n{font:700 11px var(--mono);color:var(--ink-55);width:56px;flex:none}',
      '.clue-row input.clue-text{flex:1;min-width:0}',
      '.clue-row input.clue-answer{width:110px;flex:none;text-transform:uppercase;font-family:var(--mono);font-weight:700;letter-spacing:.08em}',
      '.clue-warn{font:600 10px var(--mono);color:var(--pink);width:64px;flex:none;text-align:right}',
      /* daily five */
      '.d5-row{display:flex;align-items:center;gap:10px;padding:7px 9px;border:1px solid var(--rule);',
      '  border-radius:var(--radius);background:var(--paper)}',
      '.d5-row.is-flagged{border-color:var(--pink);background:var(--pink-wash)}',
      '.d5-n{font:700 11px var(--mono);color:var(--ink-55);width:64px;flex:none}',
      '.d5-row input{width:150px;flex:none;text-transform:uppercase;font-family:var(--mono);font-weight:700;letter-spacing:.12em}',
      '.dict{display:inline-flex;align-items:center;gap:6px;font:600 11px var(--sans)}',
      '.dict .m{font:700 11px var(--mono)}',
      '.dict.ok{color:var(--green)}.dict.bad{color:var(--pink)}.dict.mute{color:var(--ink-45)}',
      /* validation list */
      '.issue{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;padding:10px 12px;',
      '  border:1px solid var(--rule);border-radius:var(--radius);background:var(--paper);cursor:pointer}',
      '.issue + .issue{margin-top:7px}',
      '.issue:hover{border-color:var(--pink);background:var(--pink-wash)}',
      '.issue-where{font:700 11px var(--mono);color:var(--pink);width:130px;flex:none}',
      '.issue-msg{font:500 13px var(--sans);min-width:0}',
      '.issue-code{font:500 10px var(--mono);color:var(--ink-45);margin-left:auto;flex:none}',
      /* preview */
      '.preview-row{display:flex;gap:26px;flex-wrap:wrap}',
      '.phone{width:280px;flex:none}',
      '.phone-label{font:700 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-55);margin-bottom:8px}',
      '.phone-frame{width:280px;height:560px;border:2px solid var(--ink);border-radius:26px;background:var(--cream);',
      '  padding:14px 12px;overflow:hidden;display:flex;flex-direction:column;gap:12px}',
      '.phone-notch{width:74px;height:5px;border-radius:3px;background:var(--ink-28);margin:0 auto}',
      '.feed-head{display:flex;align-items:baseline;gap:8px}',
      '.feed-day{font:800 15px var(--sans)}',
      '.feed-sub{font:500 10px var(--mono);color:var(--ink-55)}',
      '.feed-card{background:var(--paper);border:1px solid var(--ink-28);border-radius:10px;padding:14px;',
      '  display:flex;flex-direction:column;gap:8px}',
      '.feed-kicker{font:700 9px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--pink)}',
      '.feed-title{font:900 20px/1.1 var(--sans);letter-spacing:-.4px}',
      '.feed-meta{font:500 10px var(--mono);color:var(--ink-55)}',
      '.feed-mini{display:grid;grid-template-columns:repeat(5,16px);gap:2px}',
      '.feed-mini span{width:16px;height:16px;border:1px solid var(--ink-28);border-radius:2px;background:var(--cream)}',
      '.feed-slots{display:flex;flex-direction:column;gap:4px}',
      '.feed-slot{height:14px;border-radius:3px;background:var(--wash);border:1px solid var(--rule)}',
      '.feed-cta{align-self:flex-start;background:var(--pink);color:var(--paper);border-radius:20px;',
      '  padding:6px 14px;font:800 11px var(--sans)}',
      '.solve-grid{display:grid;grid-template-columns:repeat(5,44px);gap:2px;justify-content:center}',
      '.solve-cell{position:relative;width:44px;height:44px;border:1px solid var(--ink-28);border-radius:2px;',
      '  background:var(--paper);display:flex;align-items:center;justify-content:center;font:800 17px var(--mono)}',
      '.solve-cell .n{position:absolute;top:1px;left:3px;font:700 8px var(--mono);color:var(--ink-45)}',
      '.solve-clue{background:var(--paper);border:1px solid var(--ink-28);border-radius:8px;padding:10px 12px;',
      '  font:600 13px/1.35 var(--sans)}',
      '.solve-clue .lab{font:700 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--pink);display:block;margin-bottom:4px}',
      '.solve-slot{display:flex;align-items:center;gap:6px;justify-content:center}',
      '.solve-slot .b{width:38px;height:44px;border:1px solid var(--ink-28);border-radius:3px;background:var(--paper);',
      '  display:flex;align-items:center;justify-content:center;font:800 16px var(--mono)}',
      '.solve-keys{display:flex;flex-wrap:wrap;gap:3px;margin-top:auto}',
      '.solve-keys span{width:24px;height:30px;border-radius:3px;background:var(--paper);border:1px solid var(--rule);',
      '  display:flex;align-items:center;justify-content:center;font:600 11px var(--mono);color:var(--ink-65)}'
    ].join('\n');
    document.head.appendChild(style);
  }
})(window.Console);
