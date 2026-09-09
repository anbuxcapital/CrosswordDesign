/* Game editor — metadata, content, validation and player preview.
   OWNER: editorial builder.
   Route: #/library/:id
   Use cases: E3 edit, E4 validate and fix, E5 preview, E6 approve or send back,
   E7 publish a correction.

   Editing model: opening a puzzle takes a working copy into
   store.ui.editor.draft. Field edits mutate the copy only; Save writes it back
   through Console.commit and increments the version. Run validation reads the
   working copy, so filling a missing clue really does clear its issue before
   anything is saved. */
(function (C) {
  'use strict';

  var el = C.ui.el;
  var ED = C.editorial;

  C.store.ui.editor = C.store.ui.editor || {
    id: null, tab: 'metadata', draft: null, focus: null, sel: null, previewFill: 'key'
  };

  function st() { return C.store.ui.editor; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  var EDITABLE = ['title', 'lang', 'difficulty', 'topics', 'author', 'content'];

  /* A crossword's slots, numbers and (row, col) bindings are derived, so two
     contents are the same content when they are the same after that derivation.
     Comparing the canonical form keeps an imported grid from reading as an
     unsaved change the moment it is opened. */
  function contentKey(kind, content) {
    var c = clone(content || {});
    if (kind === 'cw') ED.cwSync(c);
    return JSON.stringify(c);
  }

  function fieldKey(rec, k) {
    return k === 'content' ? contentKey(rec.kind, rec.content) : JSON.stringify(rec[k]);
  }

  function ensureDraft(p) {
    var s = st();
    if (s.id !== p.id || !s.draft) {
      s.id = p.id;
      s.draft = clone(p);
      s.tab = 'metadata';
      s.focus = null;
      s.sel = null;
    }
    if (s.draft.kind === 'cw') {
      ED.cwSync(s.draft.content);
      if (!s.sel) {
        var first = ED.derive(s.draft.content).across[0];
        s.sel = {
          r: first ? first.row : 0, c: first ? first.col : 0,
          dir: 'across', focus: 'grid', pending: false
        };
      }
    }
    return s.draft;
  }

  function dirty(p) {
    var d = st().draft;
    return EDITABLE.some(function (k) { return fieldKey(d, k) !== fieldKey(p, k); });
  }

  function changedFields(p) {
    var d = st().draft;
    return EDITABLE.filter(function (k) { return fieldKey(d, k) !== fieldKey(p, k); });
  }

  /* The live checks a crossword's Content tab paints, and the ones that hold
     Approve back. A Guessword answers the same question through answerChecks. */
  function liveChecks(d) {
    if (d.kind !== 'cw') return ED.answerChecks(d.content.answer, d.lang, d.id)
      .filter(function (c) { return !c.ok; });
    return ED.cwChecks(d);
  }
  function liveErrors(d) {
    return liveChecks(d).filter(function (c) { return !c.warn; });
  }

  var FIELD_LABEL = {
    title: 'title', lang: 'language', difficulty: 'difficulty',
    topics: 'topics', author: 'author', content: 'content'
  };

  // =====================================================================
  // review bar
  // =====================================================================

  function fact(k, v) {
    var n = el('div', 'ed-fact');
    n.appendChild(el('span', 'k', k));
    if (v instanceof Node) {
      var w = el('span', 'v');
      w.appendChild(v);
      n.appendChild(w);
    } else n.appendChild(el('span', 'v', v));
    return n;
  }

  /* Approve waits on a saved version that has passed validation, so it names
     the one thing standing in the way rather than a general state. */
  function approveOk(p) {
    if (p.status !== 'review' && p.status !== 'draft') return false;
    if (dirty(p)) return false;
    if (p.validation !== 'passed') return false;
    return liveErrors(st().draft).length === 0;
  }

  function approveBlockedBy(p) {
    var d = st().draft;
    if (dirty(p)) return 'Approve waits on Save';
    if (p.validation === 'not_run') return 'Approve waits on Run validation';
    var n = (p.validationIssues || []).length || liveErrors(d).length;
    return 'Approve waits on ' + n + ' failing ' + (n === 1 ? 'check' : 'checks');
  }

  function reviewBar(p) {
    var d = st().draft;
    var bar = el('div', 'ed-bar');

    var facts = el('div', 'ed-facts');
    facts.appendChild(fact('Status', C.ui.pill(p.status)));
    facts.appendChild(fact('Validation', C.ui.status(p.validation)));
    facts.appendChild(fact('Version', 'v' + p.version));
    facts.appendChild(fact('Kind', ED.kindLabel(p.kind) + ' · ' + ED.langLabel(p.lang)));
    if (p.correctionOf) facts.appendChild(fact('Correction of', p.correctionOf));
    bar.appendChild(facts);

    if (dirty(p)) {
      bar.appendChild(el('span', 'ed-dirty', 'Unsaved changes: ' +
        changedFields(p).map(function (k) { return FIELD_LABEL[k]; }).join(', ')));
    }

    bar.appendChild(el('div', 'spacer'));

    bar.appendChild(C.ui.button('Save', {
      variant: 'primary', small: true,
      disabled: !dirty(p),
      onClick: function () { save(p); }
    }));
    bar.appendChild(C.ui.button('Run validation', {
      small: true,
      onClick: function () { runValidation(p); }
    }));

    var canApprove = approveOk(p);
    if (!canApprove && (p.status === 'review' || p.status === 'draft')) {
      bar.appendChild(el('span', 'ed-blocked', approveBlockedBy(p)));
    }
    bar.appendChild(C.ui.button('Approve', {
      variant: 'pink', small: true,
      disabled: !canApprove,
      onClick: function () { approveFlow(p); }
    }));
    bar.appendChild(C.ui.button('Send back', {
      variant: 'danger', small: true,
      disabled: !(p.status === 'review' || p.status === 'approved'),
      onClick: function () { sendBackFlow(p); }
    }));

    if (p.correctionOf) {
      bar.appendChild(C.ui.button('Publish correction', {
        variant: 'pink', small: true,
        disabled: p.status !== 'approved',
        onClick: function () { publishCorrectionFlow(p); }
      }));
    }

    return bar;
  }

  function noun(p) { return C.kindWord(p.kind); }

  // =====================================================================
  // actions
  // =====================================================================

  function save(p) {
    var d = st().draft;
    var fields = changedFields(p);
    C.commit({
      action: 'Save ' + noun(p),
      object: p.id,
      reason: '',
      result: 'Saved as v' + (p.version + 1) + ' · changed ' +
        fields.map(function (k) { return FIELD_LABEL[k]; }).join(', '),
      apply: function () {
        var target = C.find.puzzle(p.id);
        /* Saving writes the canonical content: numbers, (row, col) and the
           across-then-down order are re-derived from the grid. */
        if (d.kind === 'cw') ED.cwSync(d.content);
        EDITABLE.forEach(function (k) { target[k] = clone(d[k]); });
        target.version += 1;
        target.updatedAt = ED.nowStamp();
        st().draft.version = target.version;
        st().draft.updatedAt = target.updatedAt;
      }
    });
    C.toast('Saved as v' + (C.find.puzzle(p.id) || p).version + '.');
  }

  function runValidation(p) {
    var d = st().draft;
    var issues = ED.validate(d);
    st().tab = 'validation';
    st().focus = null;
    C.commit({
      action: 'Run validation',
      object: p.id,
      reason: '',
      result: ED.summary(issues) + (issues.length
        ? ' · ' + issues.map(function (i) { return i.where; })
          .filter(function (w, i, all) { return all.indexOf(w) === i; }).join(', ')
        : p.kind === 'cw'
          ? ' · grid, clues, topics and dictionary all clean'
          : ' · answer, alphabet, both word lists and reuse all clean'),
      apply: function () {
        var target = C.find.puzzle(p.id);
        target.validation = issues.length ? 'failed' : 'passed';
        target.validationIssues = issues;
      }
    });
    C.toast(issues.length ? ED.summary(issues) + '.' : 'Validation passed.');
  }

  function approveFlow(p) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Approve ' + p.id,
      before: [['Status', C.ui.pill(p.status)], ['Validation', C.ui.status(p.validation)], ['Version', 'v' + p.version]],
      after: [['Status', C.ui.pill('approved')], ['Validation', C.ui.status('passed')], ['Version', 'v' + p.version]],
      consequence: 'It becomes available for a Daily game. Nothing is scheduled yet.'
    }));
    var reason = C.ui.reasonField({
      required: false,
      label: 'Approval note',
      placeholder: 'e.g. Checked against the style sheet'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Approve ' + noun(p),
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Approve',
        onClick: function () {
          C.commit({
            action: 'Approve ' + noun(p),
            object: p.id,
            reason: reason.value(),
            result: 'Status ' + ((C.ui.STATUS[p.status] || {}).label || p.status) +
              ' → Approved · v' + p.version + ' · validation passed',
            apply: function () { C.find.puzzle(p.id).status = 'approved'; }
          });
          C.ui.closeModal();
          C.toast(p.id + ' approved.');
        }
      }
    });
  }

  function sendBackFlow(p) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Send ' + p.id + ' back',
      before: [['Status', C.ui.pill(p.status)], ['Available for a Daily game', p.status === 'approved' ? 'Yes' : 'No']],
      after: [['Status', C.ui.pill('draft')], ['Available for a Daily game', 'No']],
      consequence: 'It leaves the approved pool. The author sees this reason.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      label: 'Reason to send back',
      placeholder: 'e.g. 7-across clue is ambiguous; rewrite before re-review'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Send back',
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Send back to draft',
        destructive: true,
        onClick: function () {
          C.commit({
            action: 'Send ' + noun(p) + ' back',
            object: p.id,
            reason: reason.value(),
            result: 'Status ' + (C.ui.STATUS[p.status] || {}).label + ' → Draft · v' + p.version,
            apply: function () { C.find.puzzle(p.id).status = 'draft'; }
          });
          C.ui.closeModal();
          C.toast(p.id + ' sent back to draft.');
        }
      }
    });
  }

  function publishCorrectionFlow(p) {
    var origin = C.find.puzzle(p.correctionOf);
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Publish the correction',
      before: [
        ['Serving now', p.correctionOf + (origin ? ' v' + origin.version : '')],
        ['Correction', p.id + ' · ' + (C.ui.STATUS[p.status] || {}).label],
        ['Validation', C.ui.status(p.validation)]
      ],
      after: [
        ['Serving now', p.id + ' v' + p.version],
        ['Correction', p.id + ' · Published'],
        ['Validation', C.ui.status('passed')]
      ],
      consequence: 'Players who already solved ' + p.correctionOf + ' keep their result.'
    }));
    if (p.note) {
      var note = el('div', 'notice');
      note.style.marginTop = '12px';
      note.textContent = p.note;
      body.appendChild(note);
    }
    var reason = C.ui.reasonField({
      required: false,
      label: 'Publication note',
      placeholder: 'e.g. Corrected 7-across clue, cleared with the author'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Publish correction',
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Publish correction',
        onClick: function () {
          C.commit({
            action: 'Publish correction',
            object: p.id,
            reason: reason.value(),
            result: p.id + ' v' + p.version + ' published as the correction of ' + p.correctionOf +
              ' · players who already solved ' + p.correctionOf + ' keep their result',
            apply: function () {
              var target = C.find.puzzle(p.id);
              target.status = 'published';
              target.updatedAt = ED.nowStamp();
              st().draft.status = 'published';
            }
          });
          C.ui.closeModal();
          C.toast('Correction ' + p.id + ' published.');
        }
      }
    });
  }

  // =====================================================================
  // tab: metadata (E3)
  // =====================================================================

  function textRow(label, value, onInput, opts) {
    opts = opts || {};
    var row = el('div', 'form-row');
    var id = 'ed_' + label.toLowerCase().replace(/[^a-z]+/g, '_');
    var lab = el('label', 'label', label);
    lab.setAttribute('for', id);
    row.appendChild(lab);
    var input = el(opts.multiline ? 'textarea' : 'input', opts.multiline ? 'textarea' : 'input');
    input.id = id;
    if (!opts.multiline) input.type = 'text';
    input.value = value == null ? '' : value;
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.addEventListener('input', function () { onInput(input.value); });
    row.appendChild(input);
    if (opts.help) row.appendChild(el('div', 'help', opts.help));
    return row;
  }

  function chipRow(label, items, active, onPick, help) {
    var row = el('div', 'form-row');
    row.appendChild(el('div', 'label', label));
    var btns = el('div', 'btn-row');
    items.forEach(function (it) {
      var b = el('button', 'chip' + (it[0] === active ? ' is-on' : ''), it[1]);
      b.type = 'button';
      b.addEventListener('click', function () { onPick(it[0]); C.render(); });
      btns.appendChild(b);
    });
    row.appendChild(btns);
    if (help) row.appendChild(el('div', 'help', help));
    return row;
  }

  function metadataTab(p) {
    var d = st().draft;
    var wrap = el('div', 'ed-body');

    var cols = el('div', 'ed-cols');

    var left = el('div');
    left.appendChild(textRow('Title', d.title, function (v) { d.title = v; markDirty(p); },
      { placeholder: 'e.g. Harbour lights' }));
    left.appendChild(chipRow('Language', ED.LANGS, d.lang,
      function (v) { d.lang = v; }));
    left.appendChild(chipRow(d.kind === 'guessword' ? 'Difficulty target' : 'Difficulty',
      ED.difficulties(d.kind), d.difficulty,
      function (v) { d.difficulty = v; }));
    left.appendChild(textRow('Topics', d.topics.join(', '), function (v) {
      d.topics = v.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      markDirty(p);
    }, { placeholder: 'e.g. Travel, Food' }));
    left.appendChild(textRow('Author', d.author, function (v) { d.author = v; markDirty(p); },
      { placeholder: 'operator handle' }));
    cols.appendChild(left);

    var right = el('div');
    right.appendChild(el('div', 'label', 'Read only'));
    [['Game id', p.id],
     ['Kind', ED.kindLabel(p.kind)],
     ['Status', (C.ui.STATUS[p.status] || {}).label || p.status],
     ['Version', 'v' + p.version],
     ['Validation', (C.ui.STATUS[p.validation] || {}).label || p.validation],
     ['Last updated', p.updatedAt]
    ].forEach(function (f) {
      right.appendChild(C.ui.field({ label: f[0], value: f[1], editable: false }));
    });
    if (p.correctionOf) {
      right.appendChild(C.ui.field({ label: 'Correction of', value: p.correctionOf, editable: false }));
    }
    if (p.note) {
      var n = el('div', 'notice');
      n.style.marginTop = '12px';
      n.textContent = p.note;
      right.appendChild(n);
    }
    cols.appendChild(right);

    wrap.appendChild(cols);
    return wrap;
  }

  /* Re-rendering on every keystroke would steal focus from the field being
     typed into, so text inputs update the working copy and only refresh the
     small "unsaved changes" marker and the Save control. */
  function markDirty(p) {
    var bar = document.querySelector('.ed-bar');
    if (!bar) return;
    var marker = bar.querySelector('.ed-dirty');
    var changed = changedFields(p);
    if (changed.length && !marker) {
      marker = el('span', 'ed-dirty', '');
      bar.insertBefore(marker, bar.querySelector('.spacer'));
    }
    if (marker) {
      if (!changed.length) marker.remove();
      else marker.textContent = 'Unsaved changes: ' + changed.map(function (k) { return FIELD_LABEL[k]; }).join(', ');
    }
    var save = Array.prototype.filter.call(bar.querySelectorAll('.btn'), function (b) { return b.textContent === 'Save'; })[0];
    if (save) save.disabled = !changed.length;
    var approve = Array.prototype.filter.call(bar.querySelectorAll('.btn'), function (b) { return b.textContent === 'Approve'; })[0];
    if (approve) approve.disabled = !approveOk(p);

    var blocked = bar.querySelector('.ed-blocked');
    var relevant = p.status === 'review' || p.status === 'draft';
    if (approve && approve.disabled && relevant) {
      if (!blocked) {
        blocked = el('span', 'ed-blocked', '');
        approve.parentNode.insertBefore(blocked, approve);
      }
      blocked.textContent = approveBlockedBy(p);
    } else if (blocked) blocked.remove();

    var tabs = document.querySelectorAll('.tabs .tab');
    if (tabs[1]) tabs[1].textContent = contentTabLabel(st().draft);
  }

  /* The Content tab carries the count so a failing check is visible from any
     tab; the lines themselves live under the clue column. Errors are what the
     count leads with, because they are what holds Approve. */
  function checkCounts(d) {
    var list = liveChecks(d);
    var bad = list.filter(function (c) { return !c.warn; }).length;
    return { total: list.length, bad: bad, warn: list.length - bad };
  }

  function checkWords(n) {
    if (n.bad) return n.bad + ' failing';
    if (n.warn) return n.warn + (n.warn === 1 ? ' warning' : ' warnings');
    return '';
  }

  function contentTabLabel(d) {
    var words = checkWords(checkCounts(d));
    return words ? 'Content · ' + words : 'Content';
  }

  // =====================================================================
  // tab: content (E3, and the fix half of E4)
  // =====================================================================

  // ---------------------------------------------------------------------
  // the crossword Content tab: the grid on the left, the derived clue list on
  // the right, and the live checks under it. Letters go into the grid; slots,
  // numbers and the clue rows follow from it. Nothing here blocks Save.
  // ---------------------------------------------------------------------

  /* The selection is where the caret is, which direction it is running in, and
     which control should hold the browser's focus after a repaint. */
  function sel() { return st().sel; }

  function contentTab(p) {
    var d = st().draft;
    var wrap = el('div', 'ed-body');
    if (d.kind === 'cw') wrap.appendChild(crosswordEditor(p, d));
    else wrap.appendChild(guesswordEditor(p, d));
    return wrap;
  }

  var LETTER = /[A-Za-zÀ-ÖØ-öø-ÿЀ-ӿ]/;

  function crosswordEditor(p, d) {
    var content = d.content;
    var s = sel();
    var g, checks, pairs, square;

    var gridEl = null;
    var rowNodes = {};      // slot key → the clue row
    var answerInputs = {};
    var clueInputs = {};
    var metaNodes = {};

    var wrap = el('div', 'cw-cols');

    var left = el('div', 'cw-left');
    var gridHost = el('div');
    var statsHost = el('div', 'cw-stats');
    left.appendChild(gridHost);
    left.appendChild(statsHost);

    var right = el('div', 'cw-right');
    var clueHost = el('div');
    var checkHost = el('div');
    right.appendChild(clueHost);
    right.appendChild(checkHost);

    wrap.appendChild(left);
    wrap.appendChild(right);

    function key(slot) { return slot.dir + ':' + slot.row + ':' + slot.col; }
    function letterAt(r, c) {
      var ch = (content.grid[r] || [])[c];
      return ch === ED.BLOCK ? '' : (ch || '');
    }
    function isBlock(r, c) { return (content.grid[r] || [])[c] === ED.BLOCK; }
    function currentSlot() {
      return g.slotAt(s.r, s.c, s.dir) ||
        g.slotAt(s.r, s.c, s.dir === 'across' ? 'down' : 'across');
    }

    function recompute() {
      g = ED.derive(content);
      pairs = ED.cwPairs(content);
      square = ED.wordSquare(content);
      checks = ED.cwChecks(d);
    }

    /* Which cells and which clue rows the checks have something to say about.
       A check that is not a warning paints its cell in the error tint; a
       warning flags it in gold. */
    function flags() {
      var f = { cellBad: {}, cellWarn: {}, rowBad: {}, rowWarn: {} };
      checks.forEach(function (c) {
        var t = c.target;
        if (!t || c.quiet) return;
        if (t.kind === 'cell') (c.warn ? f.cellWarn : f.cellBad)[t.r + ':' + t.c] = true;
        else (c.warn ? f.rowWarn : f.rowBad)[t.dir + ':' + t.r + ':' + t.c] = true;
      });
      return f;
    }

    // -- writing ---------------------------------------------------------

    /* Both the grid and an answer field write cells, and both refresh the
       stored answer of every slot the cell belongs to, so a letter changed from
       one side updates the other. */
    function writeCells(edits, keepRows) {
      var changed = false;
      edits.forEach(function (e) {
        if (content.grid[e[0]][e[1]] === e[2]) return;
        content.grid[e[0]][e[1]] = e[2];
        changed = true;
      });
      if (!changed) return;
      ED.cwSync(content);
      g = ED.derive(content);
      edits.forEach(function (e) {
        ['across', 'down'].forEach(function (dir) {
          var slot = g.slotAt(e[0], e[1], dir);
          if (!slot) return;
          var cl = ED.clueOf(content, slot);
          if (cl) cl.answer = ED.slotWord(content.grid, slot);
        });
      });
      ED.prefillWordSquare(content);
      recompute();
      markDirty(p);
      paint(keepRows);
    }

    function toggleBlock(r, c) {
      writeCells([[r, c, isBlock(r, c) ? '' : ED.BLOCK]], false);
    }

    // -- the grid --------------------------------------------------------

    function step(dr, dc) {
      var r = s.r + dr, c = s.c + dc;
      if (r < 0 || c < 0 || r >= g.size || c >= g.size) return;
      s.r = r; s.c = c;
      paint(false);
    }

    function advance() {
      var slot = g.slotAt(s.r, s.c, s.dir);
      if (!slot) return;
      var i = slot.cells.map(function (rc) { return rc[0] + ':' + rc[1]; })
        .indexOf(s.r + ':' + s.c);
      if (i < 0 || i >= slot.len - 1) return;
      s.r = slot.cells[i + 1][0];
      s.c = slot.cells[i + 1][1];
    }

    function stepSlot(delta) {
      var order = g.across.concat(g.down);
      if (!order.length) return;
      var cur = currentSlot();
      var i = cur ? order.indexOf(cur) : -1;
      var next = order[((i + delta) % order.length + order.length) % order.length];
      s.r = next.row; s.c = next.col; s.dir = next.dir; s.focus = 'grid';
      paint(false);
    }

    function onGridKey(e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        if (s.dir !== 'across') { s.dir = 'across'; paint(false); }
        else step(0, k === 'ArrowLeft' ? -1 : 1);
      } else if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        if (s.dir !== 'down') { s.dir = 'down'; paint(false); }
        else step(k === 'ArrowUp' ? -1 : 1, 0);
      } else if (k === 'Tab') {
        e.preventDefault();
        stepSlot(e.shiftKey ? -1 : 1);
      } else if (k === ' ') {
        e.preventDefault();
        s.dir = s.dir === 'across' ? 'down' : 'across';
        paint(false);
      } else if (k === '.' || k === '#') {
        e.preventDefault();
        toggleBlock(s.r, s.c);
      } else if (k === 'Backspace') {
        e.preventDefault();
        if (letterAt(s.r, s.c)) writeCells([[s.r, s.c, '']], false);
        else {
          step(s.dir === 'down' ? -1 : 0, s.dir === 'across' ? -1 : 0);
          if (letterAt(s.r, s.c)) writeCells([[s.r, s.c, '']], false);
        }
      } else if (k === 'Delete') {
        e.preventDefault();
        writeCells([[s.r, s.c, '']], false);
      } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        var letter = ED.normalizeLetter(d.lang, k);
        if (!letter || !LETTER.test(letter)) return;
        e.preventDefault();
        writeCells([[s.r, s.c, letter]], false);
        advance();
        paint(false);
      }
    }

    function paintGrid() {
      /* Repainting replaces the grid node, so a grid that was holding the
         keyboard keeps it: typing a letter must not drop the caret. */
      var hadFocus = gridEl && document.activeElement === gridEl;
      var f = flags();
      var slot = currentSlot();
      var inSlot = {};
      if (slot) slot.cells.forEach(function (rc) { inSlot[rc[0] + ':' + rc[1]] = true; });

      gridHost.innerHTML = '';
      var grid = el('div', 'cwgrid');
      grid.tabIndex = 0;
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', g.size + ' by ' + g.size + ' grid');
      grid.style.gridTemplateColumns = 'repeat(' + g.size + ', 44px)';

      for (var r = 0; r < g.size; r++) {
        for (var c = 0; c < g.size; c++) {
          grid.appendChild(cellNode(r, c, inSlot, f));
        }
      }
      grid.addEventListener('keydown', onGridKey);
      gridHost.appendChild(grid);
      gridEl = grid;
      if (hadFocus) grid.focus();
    }

    function cellNode(r, c, inSlot, f) {
      var k = r + ':' + c;
      var block = isBlock(r, c);
      var ch = letterAt(r, c);
      var cls = 'cwcell ' + (block ? 'is-block' : ch ? 'is-letter' : 'is-empty');
      if (!block && inSlot[k]) cls += ' is-slot';
      if (s.r === r && s.c === c) cls += ' is-caret';
      if (f.cellBad[k]) cls += ' is-error';
      else if (f.cellWarn[k]) cls += ' is-flagged';

      var cell = el('div', cls);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', ED.cellName(r, c) + ' · ' +
        (block ? 'block' : ch || 'empty'));
      var num = g.numbers[r][c];
      if (num != null) cell.appendChild(el('span', 'n', String(num)));
      if (!block && ch) cell.appendChild(el('span', 'ch', ch));
      if (f.cellWarn[k] && !f.cellBad[k]) cell.appendChild(el('span', 'flag-dot'));
      cell.addEventListener('mousedown', function (e) {
        e.preventDefault();
        pickCell(r, c);
      });
      return cell;
    }

    /* Clicking the caret cell again turns the selection through the other
       direction, the gesture the player already has on the Play screen. */
    function pickCell(r, c) {
      var same = s.r === r && s.c === c;
      var dir = same ? (s.dir === 'across' ? 'down' : 'across') : s.dir;
      if (!g.slotAt(r, c, dir)) dir = dir === 'across' ? 'down' : 'across';
      s.r = r; s.c = c; s.dir = dir; s.focus = 'grid'; s.pending = true;
      paint(false);
    }

    // -- the clue list ---------------------------------------------------

    function answerText(slot) {
      return ED.slotLetters(content.grid, slot).map(function (ch) {
        return ch || '·';
      }).join('');
    }

    function clueRow(slot) {
      var cl = ED.clueOf(content, slot) || { n: slot.n, clue: '', answer: '' };
      var k = key(slot);
      var row = el('div', 'cw-row');
      rowNodes[k] = row;

      row.appendChild(el('span', 'cw-n', String(slot.n)));
      row.appendChild(el('span', 'cw-dirtag', slot.dir === 'across' ? 'Across' : 'Down'));

      var ans = el('input', 'input cw-answer');
      ans.type = 'text';
      ans.value = answerText(slot);
      ans.style.width = Math.max(64, slot.len * 15 + 16) + 'px';
      ans.setAttribute('aria-label', 'Answer for ' + ED.slotName(slot) +
        ', ' + slot.len + ' letters');
      ans.setAttribute('autocomplete', 'off');
      ans.addEventListener('keydown', function (e) { onAnswerKey(e, slot, ans); });
      ans.addEventListener('paste', function (e) { onAnswerPaste(e, slot, ans); });
      ans.addEventListener('beforeinput', function (e) { e.preventDefault(); });
      ans.addEventListener('focus', function () {
        focusFrom(slot, 'answer');
        setAnswerCaret(ans, firstBlank(slot));
      });
      ans.addEventListener('click', function () {
        /* A click past the last cell is not a cell, so it lands on the first
           one still waiting for a letter. */
        if ((ans.selectionStart || 0) >= slot.len) setAnswerCaret(ans, firstBlank(slot));
        caretFromAnswer(slot, ans);
      });
      ans.addEventListener('keyup', function () { caretFromAnswer(slot, ans); });
      answerInputs[k] = ans;
      row.appendChild(ans);

      var text = el('input', 'input cw-clue');
      text.type = 'text';
      text.value = cl.clue || '';
      text.placeholder = 'Clue for ' + ED.slotName(slot);
      text.setAttribute('aria-label', 'Clue for ' + ED.slotName(slot));
      text.addEventListener('input', function () {
        cl.clue = text.value;
        recompute();
        markDirty(p);
        paintStats();
        paintChecks();
        paintRowStates();
      });
      text.addEventListener('focus', function () { focusFrom(slot, 'clue'); });
      clueInputs[k] = text;
      row.appendChild(text);

      var meta = el('span', 'cw-meta');
      metaNodes[k] = meta;
      row.appendChild(meta);

      return row;
    }

    function focusFrom(slot, where) {
      s.r = slot.row; s.c = slot.col; s.dir = slot.dir; s.focus = where;
      paintGrid();
      paintRowStates();
    }

    function caretFromAnswer(slot, input) {
      var i = Math.min(input.selectionStart || 0, slot.len - 1);
      var rc = slot.cells[i];
      if (!rc || (s.r === rc[0] && s.c === rc[1])) return;
      s.r = rc[0]; s.c = rc[1];
      paintGrid();
    }

    function firstBlank(slot) {
      var letters = ED.slotLetters(content.grid, slot);
      for (var i = 0; i < letters.length; i++) if (!letters[i]) return i;
      return 0;
    }

    function setAnswerCaret(input, i) {
      var pos = Math.max(0, Math.min(i, input.value.length));
      input.setSelectionRange(pos, pos);
    }

    function onAnswerKey(e, slot, input) {
      var from = input.selectionStart || 0;
      var to = input.selectionEnd || 0;
      var k = e.key;
      if (k === 'Backspace') {
        e.preventDefault();
        var a = to > from ? from : from - 1;
        var b = to > from ? to : from;
        if (a < 0) return;
        clearRange(slot, a, b, input, a);
      } else if (k === 'Delete') {
        e.preventDefault();
        var d0 = to > from ? from : from;
        var d1 = to > from ? to : from + 1;
        if (d0 >= slot.len) return;
        clearRange(slot, d0, d1, input, d0);
      } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        var letter = ED.normalizeLetter(d.lang, k);
        if (!letter || !LETTER.test(letter)) return;
        e.preventDefault();
        /* The field is exactly as long as the slot, so typing overwrites one
           cell and stops at the last one rather than pushing letters off it. */
        if (from >= slot.len) return;
        writeCells([[slot.cells[from][0], slot.cells[from][1], letter]], true);
        input.value = answerText(slot);
        setAnswerCaret(input, from + 1);
        caretFromAnswer(slot, input);
      }
    }

    function clearRange(slot, from, to, input, caret) {
      var edits = [];
      for (var i = from; i < Math.min(to, slot.len); i++) {
        edits.push([slot.cells[i][0], slot.cells[i][1], '']);
      }
      if (!edits.length) return;
      writeCells(edits, true);
      input.value = answerText(slot);
      setAnswerCaret(input, caret);
      caretFromAnswer(slot, input);
    }

    function onAnswerPaste(e, slot, input) {
      var text = (e.clipboardData || window.clipboardData || {}).getData('text');
      e.preventDefault();
      if (!text) return;
      var from = Math.min(input.selectionStart || 0, slot.len - 1);
      var chars = ED.chars(ED.normalizeAnswer(text, d.lang));
      var edits = [];
      for (var i = 0; i < chars.length && from + i < slot.len; i++) {
        if (!LETTER.test(chars[i])) continue;
        edits.push([slot.cells[from + i][0], slot.cells[from + i][1], chars[i]]);
      }
      if (!edits.length) return;
      writeCells(edits, true);
      input.value = answerText(slot);
      setAnswerCaret(input, from + edits.length);
    }

    function paintClues() {
      rowNodes = {}; answerInputs = {}; clueInputs = {}; metaNodes = {};
      clueHost.innerHTML = '';
      ['across', 'down'].forEach(function (dir) {
        clueHost.appendChild(el('div', 'cw-dir', dir === 'across' ? 'Across' : 'Down'));
        var list = el('div', 'cw-rows');
        var slots = g[dir];
        if (!slots.length) {
          list.appendChild(el('div', 'cw-none', 'No ' + dir + ' words in this grid.'));
        }
        slots.forEach(function (slot) { list.appendChild(clueRow(slot)); });
        clueHost.appendChild(list);
      });
      paintRowStates();
    }

    /* Selection, the check flags, the counter and the word-square marker are
       the only things that change without the slot set changing, so they are
       repainted on their own and the inputs keep their caret. */
    function paintRowStates() {
      var f = flags();
      var cur = currentSlot();
      g.slots.forEach(function (slot) {
        var k = key(slot);
        var row = rowNodes[k];
        if (!row) return;
        row.classList.toggle('is-on', cur === slot);
        row.classList.toggle('is-error', !!f.rowBad[k]);
        row.classList.toggle('is-flagged', !f.rowBad[k] && !!f.rowWarn[k]);

        var meta = metaNodes[k];
        var cl = ED.clueOf(content, slot) || {};
        meta.innerHTML = '';
        var twin = square && slot.dir === 'down' ? square['down:' + slot.n] : null;
        var twinClue = twin && ED.clueOf(content, twin);
        if (twinClue && (twinClue.clue || '').trim() &&
            (twinClue.clue || '').trim() === (cl.clue || '').trim()) {
          meta.appendChild(el('span', 'cw-same', 'same as ' + ED.slotName(twin)));
        }
        var len = (cl.clue || '').length;
        if (len > 70) {
          meta.appendChild(el('span', 'cw-count' + (len > ED.CLUE_MAX ? ' is-over' : ''),
            len + '/' + ED.CLUE_MAX));
        }
      });
    }

    function refreshAnswers() {
      g.slots.forEach(function (slot) {
        var input = answerInputs[key(slot)];
        if (!input || input === document.activeElement) return;
        input.value = answerText(slot);
      });
    }

    // -- the strip and the check lines ------------------------------------

    function paintStats() {
      var stat = ED.cwStats(content, checks);
      var n = { bad: checks.filter(function (c) { return !c.warn; }).length };
      n.warn = checks.length - n.bad;
      statsHost.innerHTML = '';
      var parts = [
        [stat.open + ' open ' + (stat.open === 1 ? 'cell' : 'cells'), null],
        [stat.slots + (stat.slots === 1 ? ' slot' : ' slots'), null],
        [stat.percent + '% filled', null]
      ];
      if (n.bad) parts.push([n.bad + ' failing ' + (n.bad === 1 ? 'check' : 'checks'), 'is-bad']);
      if (n.warn) parts.push([n.warn + (n.warn === 1 ? ' warning' : ' warnings'), 'is-warn']);
      if (!checks.length) parts.push(['No failing checks', null]);
      parts.forEach(function (t, i) {
        if (i) statsHost.appendChild(el('span', 'cw-sep', '·'));
        statsHost.appendChild(el('span', t[1], t[0]));
      });
    }

    function paintChecks() {
      checkHost.innerHTML = '';
      if (!checks.length) return;
      var shown = checks.slice(0, 12);
      checkHost.appendChild(ED.checkList(shown.map(function (c) {
        return {
          code: c.code, label: c.label, ok: false, warn: c.warn, message: c.message,
          onGo: function () { goTo(c.target); }
        };
      })));
      if (checks.length > shown.length) {
        checkHost.appendChild(el('div', 'ed-note',
          (checks.length - shown.length) + ' further ' +
          (checks.length - shown.length === 1 ? 'line is' : 'lines are') +
          ' hidden. Clear these first.'));
      }
    }

    function goTo(target) {
      if (!target) return;
      if (target.kind === 'cell') {
        s.r = target.r; s.c = target.c;
        if (g.slotAt(target.r, target.c, target.dir)) s.dir = target.dir;
        s.focus = 'grid';
      } else {
        s.r = target.r; s.c = target.c; s.dir = target.dir; s.focus = 'clue';
      }
      s.pending = true;
      paint(false);
    }

    // -- painting ---------------------------------------------------------

    function paint(keepRows) {
      paintGrid();
      if (keepRows) { refreshAnswers(); paintRowStates(); } else paintClues();
      paintStats();
      paintChecks();
      if (!keepRows) restoreFocus();
    }

    /* A screen is built detached and appended afterwards, so scrolling and
       focusing wait until the nodes are actually in the document. */
    function restoreFocus() {
      var wanted = s.pending;
      s.pending = false;
      function apply() {
        var slot = currentSlot();
        var k = slot ? key(slot) : null;
        var row = k ? rowNodes[k] : null;
        if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
        if (!wanted) return;
        var node = s.focus === 'clue' ? (k && clueInputs[k])
          : s.focus === 'answer' ? (k && answerInputs[k])
            : gridEl;
        if (!node) node = gridEl;
        if (node && node.focus) node.focus();
      }
      if (gridEl && gridEl.isConnected) apply();
      else setTimeout(apply, 0);
    }

    recompute();
    paint(false);
    return wrap;
  }

  /* The Guessword Content tab: the answer, what the live checks make of it,
     what the difficulty estimate makes of it, and the board a player would see.
     Nothing else — metadata belongs to its own tab and the drop date to the
     Daily game desk. */
  function guesswordEditor(p, d) {
    var wrap = el('div', 'gw-cols');

    var left = el('div');
    var answerRow = el('div', 'form-row');
    answerRow.appendChild(el('div', 'label', 'Answer'));
    var checks = el('div');

    var cells = ED.answerCells({
      lang: d.lang,
      value: d.content.answer,
      onChange: function (v) {
        d.content.answer = ED.normalizeAnswer(v, d.lang);
        paint();
        markDirty(p);
      }
    });
    answerRow.appendChild(cells);
    answerRow.appendChild(checks);
    left.appendChild(answerRow);

    var difficulty = el('div', 'form-row');
    left.appendChild(difficulty);

    var right = el('div');
    var boardRow = el('div', 'form-row');
    right.appendChild(boardRow);

    function paint() {
      var answer = d.content.answer || '';

      checks.innerHTML = '';
      checks.appendChild(ED.checkList(ED.answerChecks(answer, d.lang, p.id)));

      difficulty.innerHTML = '';
      difficulty.appendChild(el('div', 'label', 'Difficulty'));
      difficulty.appendChild(ED.difficultyPanel(answer, d.lang, d.difficulty));

      boardRow.innerHTML = '';
      boardRow.appendChild(el('div', 'label', 'Board'));
      boardRow.appendChild(ED.boardPreview(answer, d.lang, { reveal: true }));
    }
    paint();

    wrap.appendChild(left);
    wrap.appendChild(right);
    if (st().focus && st().focus.kind === 'answer') {
      st().focus = null;
      setTimeout(function () { if (cells.focus) cells.focus(); }, 0);
    }
    return wrap;
  }

  // =====================================================================
  // tab: validation (E4)
  // =====================================================================

  /* A validation issue names a cell, a slot or the metadata. Walking to it puts
     the Content tab's selection on the offending cell or clue rather than
     describing where it is. */
  function focusFor(where) {
    var d = st().draft;
    var s = st().sel;
    if (where === 'metadata') return { tab: 'metadata', focus: null };
    if (where === 'answer') return { tab: 'content', focus: { kind: 'answer' } };

    if (d && d.kind === 'cw' && s) {
      var m = /^(\d+)-(across|down)$/.exec(where);
      if (m) {
        var dir = m[2], n = parseInt(m[1], 10);
        var slot = ED.derive(d.content)[dir].filter(function (x) { return x.n === n; })[0];
        if (slot) {
          s.r = slot.row; s.c = slot.col; s.dir = dir; s.focus = 'clue'; s.pending = true;
        }
        return { tab: 'content', focus: null };
      }
      m = /^row (\d+), column (\d+)$/.exec(where);
      if (m) {
        s.r = parseInt(m[1], 10) - 1;
        s.c = parseInt(m[2], 10) - 1;
        s.focus = 'grid';
        s.pending = true;
        return { tab: 'content', focus: null };
      }
    }
    return { tab: 'content', focus: null };
  }

  function validationTab(p) {
    var wrap = el('div', 'ed-body');
    var d = st().draft;

    var head = el('div', 'banner ' + (p.validation === 'passed' ? 'calm' : 'attention'));
    head.appendChild(el('span', 'banner-dot'));
    head.appendChild(el('div', 'banner-text',
      p.validation === 'not_run' ? 'Validation has not been run on ' + p.id
        : p.validation === 'passed' ? 'Validation passed for ' + p.id + ' v' + p.version
          : ED.summary(p.validationIssues) + ' for ' + p.id + ' v' + p.version));
    if (dirty(p)) head.appendChild(el('div', 'banner-detail', 'Unsaved changes — run validation again.'));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.button('Run validation', { small: true, onClick: function () { runValidation(p); } }));
    wrap.appendChild(head);

    if (p.validation === 'not_run') {
      wrap.appendChild(C.ui.emptyState('Validation has not run yet.', 'Not run'));
      return wrap;
    }

    if (!p.validationIssues.length) return wrap;

    var list = el('div');
    p.validationIssues.forEach(function (issue) {
      var b = el('button', 'issue');
      b.type = 'button';
      b.appendChild(el('span', 'issue-where', issue.where));
      b.appendChild(el('span', 'issue-msg', issue.message));
      b.appendChild(el('span', 'issue-code', issue.code));
      b.addEventListener('click', function () {
        var target = focusFor(issue.where);
        st().tab = target.tab;
        st().focus = target.focus;
        C.render();
      });
      list.appendChild(b);
    });
    wrap.appendChild(list);
    return wrap;
  }

  // =====================================================================
  // tab: preview (E5)
  // =====================================================================

  function feedCard(d) {
    var card = el('div', 'feed-card');
    card.appendChild(el('div', 'feed-kicker', ED.kindLabel(d.kind)));
    card.appendChild(el('div', 'feed-title', d.title || 'Untitled ' + noun(d)));
    card.appendChild(el('div', 'feed-meta', d.difficulty + ' · ' + ED.langLabel(d.lang) + ' · ' + d.id));
    if (d.kind === 'cw') {
      var g = ED.derive(d.content);
      var px = g.size > 5 ? 9 : 16;
      var mini = el('div', 'feed-mini');
      mini.style.gridTemplateColumns = 'repeat(' + g.size + ', ' + px + 'px)';
      for (var r = 0; r < g.size; r++) {
        for (var c = 0; c < g.size; c++) {
          var sq = el('span', g.open(r, c) ? null : 'is-block');
          if (g.size > 5) { sq.style.width = px + 'px'; sq.style.height = px + 'px'; }
          mini.appendChild(sq);
        }
      }
      card.appendChild(mini);
    } else {
      var tiles = el('div', 'feed-mini');
      tiles.style.gridTemplateColumns = 'repeat(5, 16px)';
      for (var j = 0; j < 5; j++) tiles.appendChild(el('span'));
      card.appendChild(tiles);
    }
    card.appendChild(el('div', 'feed-cta', 'Solve'));
    return card;
  }

  function phone(label, children) {
    var wrap = el('div', 'phone');
    wrap.appendChild(el('div', 'phone-label', label));
    var frame = el('div', 'phone-frame');
    frame.appendChild(el('div', 'phone-notch'));
    children.forEach(function (c) { frame.appendChild(c); });
    wrap.appendChild(frame);
    return wrap;
  }

  function previewTab(p) {
    var d = st().draft;
    var wrap = el('div', 'ed-body');

    var bar = el('div', 'btn-row');
    bar.appendChild(el('span', 'eyebrow', 'Solve screen shows'));
    bar.appendChild(C.ui.segmented(
      [{ key: 'blank', label: 'What a player sees' }, { key: 'key', label: 'Answer key' }],
      st().previewFill,
      function (k) { st().previewFill = k; C.render(); }
    ));
    wrap.appendChild(bar);

    var row = el('div', 'preview-row');

    // feed
    var head = el('div', 'feed-head');
    head.appendChild(el('span', 'feed-day', 'Today'));
    head.appendChild(el('span', 'feed-sub', C.store.todayLabel));
    row.appendChild(phone('Feed card', [head, feedCard(d), el('div', 'feed-meta', 'Streak 61 · 240 coins')]));

    // solve
    var solveKids = [];
    var title = el('div', 'feed-head');
    title.appendChild(el('span', 'feed-day', d.title || 'Untitled ' + noun(d)));
    title.appendChild(el('span', 'feed-sub', ED.kindLabel(d.kind)));
    solveKids.push(title);

    if (d.kind === 'cw') {
      /* The Play screen at the size the player sees: the grid the editor is
         holding, its derived numbers, and the banner for the selected slot. */
      var gp = ED.derive(d.content);
      var spx = gp.size > 5 ? 26 : 44;
      var board = el('div', 'solve-grid');
      board.style.gridTemplateColumns = 'repeat(' + gp.size + ', ' + spx + 'px)';
      for (var r = 0; r < gp.size; r++) {
        for (var c = 0; c < gp.size; c++) {
          var open = gp.open(r, c);
          var cell = el('div', 'solve-cell' + (open ? '' : ' is-block'));
          cell.style.width = spx + 'px';
          cell.style.height = spx + 'px';
          if (gp.size > 5) cell.style.fontSize = '12px';
          if (open) {
            var num = gp.numbers[r][c];
            if (num != null) cell.appendChild(el('span', 'n', String(num)));
            if (st().previewFill === 'key') {
              cell.appendChild(document.createTextNode((d.content.grid[r][c] || '').toUpperCase()));
            }
          }
          board.appendChild(cell);
        }
      }
      solveKids.push(board);

      var order = gp.across.concat(gp.down);
      var s = st().sel;
      var shown = (s && (gp.slotAt(s.r, s.c, s.dir) ||
        gp.slotAt(s.r, s.c, s.dir === 'across' ? 'down' : 'across'))) || order[0];
      if (shown) {
        var text = (ED.clueOf(d.content, shown) || {}).clue;
        var cl = el('div', 'solve-clue');
        cl.appendChild(el('span', 'lab', 'Question ' + (order.indexOf(shown) + 1) +
          ' of ' + order.length + ' · ' + ED.slotName(shown)));
        cl.appendChild(document.createTextNode(text || 'No clue written for this answer yet.'));
        solveKids.push(cl);
      }

      var keys = el('div', 'solve-keys');
      (ED.KEYBOARD[d.lang] || ED.KEYBOARD.en).join('').split('')
        .forEach(function (k) { keys.appendChild(el('span', null, k)); });
      solveKids.push(keys);
    } else {
      solveKids.push(ED.boardPreview(d.content.answer, d.lang, {
        reveal: st().previewFill === 'key',
        compact: true
      }));
    }

    row.appendChild(phone('Solve screen', solveKids));
    wrap.appendChild(row);
    return wrap;
  }

  // =====================================================================
  // screen
  // =====================================================================

  function tabsFor(d) {
    return [
      { key: 'metadata', label: 'Metadata' },
      { key: 'content', label: contentTabLabel(d) },
      { key: 'validation', label: 'Validation' },
      { key: 'preview', label: 'Preview' }
    ];
  }

  /* The library is split into a Crosswords and a Guessword tab: come back to
     the one this game lives on. */
  function backToLibrary(id) {
    var p = C.find.puzzle(id);
    if (p && C.store.ui.library) C.store.ui.library.tab = p.kind;
    C.go('#/library');
  }

  C.registerScreen('#/library/:id', {
    title: function (params) {
      var p = C.find.puzzle(params.id);
      return p ? p.title : 'Game editor';
    },
    subline: function (params) {
      var p = C.find.puzzle(params.id);
      return p ? p.id + ' · ' + ED.kindLabel(p.kind) : 'Unknown game';
    },
    actions: function (params) {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.button('Back to library', {
        onClick: function () { backToLibrary(params.id); }
      }));
      var p = C.find.puzzle(params.id);
      if (p && (p.status === 'published' || p.status === 'live')) {
        row.appendChild(C.ui.button('Create correction', {
          variant: 'pink',
          onClick: function () { ED.correctionFlow(p); }
        }));
      }
      return row;
    },
    render: function (mount, params) {
      var p = C.find.puzzle(params.id);
      if (!p) {
        mount.appendChild(C.ui.emptyState('No game with the id ' + params.id + '.', 'Not found'));
        mount.appendChild(C.ui.button('Back to library', { onClick: function () { C.go('#/library'); } }));
        return;
      }
      ensureDraft(p);

      mount.appendChild(reviewBar(p));

      mount.appendChild(C.ui.tabs(tabsFor(st().draft), st().tab, function (k) {
        st().tab = k;
        if (k !== 'content') st().focus = null;
        C.render();
      }));

      if (st().tab === 'metadata') mount.appendChild(metadataTab(p));
      else if (st().tab === 'content') mount.appendChild(contentTab(p));
      else if (st().tab === 'validation') mount.appendChild(validationTab(p));
      else mount.appendChild(previewTab(p));
    }
  });
})(window.Console);
