/* Puzzle editor — metadata, content, validation and player preview.
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
    id: null, tab: 'metadata', draft: null, focus: null, previewFill: 'key'
  };

  function st() { return C.store.ui.editor; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  var EDITABLE = ['title', 'lang', 'difficulty', 'topics', 'author', 'content'];

  function ensureDraft(p) {
    var s = st();
    if (s.id !== p.id || !s.draft) {
      s.id = p.id;
      s.draft = clone(p);
      s.tab = 'metadata';
      s.focus = null;
    }
    return s.draft;
  }

  function dirty(p) {
    var d = st().draft;
    return EDITABLE.some(function (k) {
      return JSON.stringify(d[k]) !== JSON.stringify(p[k]);
    });
  }

  function changedFields(p) {
    var d = st().draft;
    return EDITABLE.filter(function (k) {
      return JSON.stringify(d[k]) !== JSON.stringify(p[k]);
    });
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

  function reviewBar(p) {
    var d = st().draft;
    var bar = el('div', 'ed-bar');

    var facts = el('div', 'ed-facts');
    facts.appendChild(fact('Status', C.ui.pill(p.status)));
    facts.appendChild(fact('Validation', C.ui.status(p.validation)));
    facts.appendChild(fact('Version', 'v' + p.version));
    facts.appendChild(fact('Kind', ED.kindLabel(p.kind) + ' · ' + ED.langLabel(p.lang)));
    facts.appendChild(fact('Updated', p.updatedAt + ' · ' + p.author));
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

    var canApprove = p.validation === 'passed' && !dirty(p) &&
      (p.status === 'review' || p.status === 'draft');
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

  function noun(p) { return p.kind === 'cw' ? 'crossword' : 'Daily Five'; }

  function blockNote(p) {
    var reasons = [];
    if (dirty(p)) reasons.push('there are unsaved changes');
    if (p.validation === 'not_run') reasons.push('validation has not been run');
    else if (p.validation === 'failed') reasons.push('validation failed with ' + p.validationIssues.length + ' issues');
    if (p.status === 'approved') reasons.push('the ' + noun(p) + ' is already approved');
    if (p.status === 'scheduled' || p.status === 'published' || p.status === 'live') {
      reasons.push('a ' + (C.ui.STATUS[p.status] || {}).label.toLowerCase() + ' ' + noun(p) + ' is corrected, not edited in place');
    }
    if (!reasons.length) return null;
    var n = el('div', 'notice' + (p.validation === 'failed' ? ' blocked' : ''));
    n.textContent = 'Approve is blocked because ' + reasons.join(', and ') + '.';
    if (p.correctionOf) {
      n.textContent += ' This is a correction of ' + p.correctionOf +
        '; publishing it will not change the result of anyone who already solved ' + p.correctionOf + '.';
    }
    return n;
  }

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
        ? ' · ' + issues.map(function (i) { return i.where; }).join(', ')
        : ' · grid, clues, topics and dictionary all clean'),
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
      consequence: 'It becomes available to the drop desk as an approved ' +
        ED.kindLabel(p.kind) + ' in ' + ED.langLabel(p.lang) + '. Nothing is scheduled or published yet.'
    }));
    var reason = C.ui.reasonField({
      required: false,
      label: 'Approval note',
      placeholder: 'e.g. Checked against the style sheet',
      help: 'Optional for an approval. It is stored in the audit log with your operator name.'
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
      before: [['Status', C.ui.pill(p.status)], ['Available to the drop desk', p.status === 'approved' ? 'Yes' : 'No']],
      after: [['Status', C.ui.pill('draft')], ['Available to the drop desk', 'No']],
      consequence: 'The ' + noun(p) + ' returns to Draft and disappears from the approved pool the drop desk picks from. ' +
        'The validation result is kept so the author can see what failed.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      label: 'Reason to send back',
      placeholder: 'e.g. 7-across clue is ambiguous; rewrite before re-review',
      help: 'Required. The author sees this reason, and it is stored in the audit log.'
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
      consequence: 'Players who have already solved ' + p.correctionOf +
        ' keep their result, their streak and their leaderboard placement — the corrected version is not replayed and no score is recalculated. ' +
        'Players who open the ' + noun(p) + ' from now on get ' + p.id + ' v' + p.version + '.'
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
      placeholder: 'e.g. Corrected 7-across clue, cleared with the author',
      help: 'Optional. It is stored in the audit log next to the correction.'
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

    wrap.appendChild(el('div', 'ed-note',
      'Editable fields sit on paper; read-only facts are dashed and washed. Changes are held here until you press Save, which writes v' +
      (p.version + 1) + ' and one audit entry.'));

    var cols = el('div', 'ed-cols');

    var left = el('div');
    left.appendChild(textRow('Title', d.title, function (v) { d.title = v; markDirty(p); },
      { placeholder: 'e.g. Harbour lights', help: 'Shown on the feed card and the solve screen.' }));
    left.appendChild(chipRow('Language', [['en', 'English'], ['uk', 'Ukrainian']], d.lang,
      function (v) { d.lang = v; }, 'The dictionary used by validation follows the language.'));
    left.appendChild(chipRow('Difficulty', [['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']], d.difficulty,
      function (v) { d.difficulty = v; }));
    left.appendChild(textRow('Topics', d.topics.join(', '), function (v) {
      d.topics = v.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      markDirty(p);
    }, { placeholder: 'e.g. Travel, Food', help: 'Comma separated. At least one topic is required before approval.' }));
    left.appendChild(textRow('Author', d.author, function (v) { d.author = v; markDirty(p); },
      { placeholder: 'operator handle', help: 'The handle credited in the library and in exports.' }));
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
    if (approve) approve.disabled = !(p.validation === 'passed' && !changed.length && (p.status === 'review' || p.status === 'draft'));
  }

  // =====================================================================
  // tab: content (E3, and the fix half of E4)
  // =====================================================================

  function focusIs(kind, a, b) {
    var f = st().focus;
    if (!f || f.kind !== kind) return false;
    if (kind === 'cell') return f.r === a && f.c === b;
    if (kind === 'clue') return f.dir === a && f.n === b;
    if (kind === 'answer') return f.i === a;
    return false;
  }

  var focusTarget = null;

  function contentTab(p) {
    focusTarget = null;
    var d = st().draft;
    var wrap = el('div', 'ed-body');
    if (d.kind === 'cw') wrap.appendChild(crosswordEditor(p, d));
    else wrap.appendChild(dailyFiveEditor(p, d));
    if (focusTarget) {
      var node = focusTarget;
      setTimeout(function () {
        if (node.scrollIntoView) node.scrollIntoView({ block: 'center' });
        if (node.focus) node.focus();
        if (node.select) node.select();
      }, 0);
    }
    return wrap;
  }

  function clueNumberAt(d, r, c) {
    var across = d.content.clues.across;
    var down = d.content.clues.down;
    if (r === 0 && c === 0) return across[0] ? across[0].n : 1;
    if (r === 0) return down[c] ? down[c].n : null;
    if (c === 0) return across[r] ? across[r].n : null;
    return null;
  }

  function crosswordEditor(p, d) {
    var wrap = el('div');
    wrap.appendChild(el('div', 'ed-note',
      'The grid is a 5 × 5 double word square: every row is an across answer and every column is a down answer. ' +
      'Validation checks that each letter matches both answers, that every clue has text, and that every answer is a five-letter dictionary word.'));

    var cols = el('div', 'ed-cols');
    cols.style.marginTop = '14px';

    // grid
    var gridSide = el('div');
    gridSide.appendChild(el('div', 'label', 'Grid'));
    var grid = el('div', 'cwgrid');
    d.content.grid.forEach(function (row, r) {
      row.forEach(function (ch, c) {
        var cell = el('div', 'cwcell' + (focusIs('cell', r, c) ? ' is-flagged' : ''));
        var n = clueNumberAt(d, r, c);
        if (n != null) cell.appendChild(el('span', 'n', String(n)));
        var input = el('input');
        input.type = 'text';
        input.maxLength = 1;
        input.value = ch || '';
        input.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1));
        input.addEventListener('input', function () {
          input.value = input.value.toUpperCase().slice(0, 1);
          d.content.grid[r][c] = input.value;
          markDirty(p);
        });
        cell.appendChild(input);
        if (focusIs('cell', r, c)) focusTarget = input;
        grid.appendChild(cell);
      });
    });
    gridSide.appendChild(grid);
    gridSide.appendChild(el('div', 'help', 'One letter per cell. Numbers mark where an across or down answer starts.'));
    cols.appendChild(gridSide);

    // clues
    var clueSide = el('div');
    ['across', 'down'].forEach(function (dir) {
      var head = el('div', 'label', dir === 'across' ? 'Across clues' : 'Down clues');
      head.style.marginTop = dir === 'down' ? '16px' : '0';
      clueSide.appendChild(head);
      var list = el('div', 'clues');
      d.content.clues[dir].forEach(function (cl, i) {
        var flagged = focusIs('clue', dir, cl.n);
        var row = el('div', 'clue-row' + (flagged ? ' is-flagged' : ''));
        row.appendChild(el('span', 'clue-n', cl.n + '-' + dir));

        var text = el('input', 'input clue-text');
        text.type = 'text';
        text.value = cl.clue || '';
        text.placeholder = 'Clue text for ' + cl.n + '-' + dir;
        text.setAttribute('aria-label', 'Clue text for ' + cl.n + '-' + dir);
        text.addEventListener('input', function () {
          cl.clue = text.value;
          markDirty(p);
          row.classList.toggle('is-flagged', flagged && !text.value.trim());
        });
        row.appendChild(text);

        var ans = el('input', 'input clue-answer');
        ans.type = 'text';
        ans.maxLength = 5;
        ans.value = cl.answer || '';
        ans.setAttribute('aria-label', 'Answer for ' + cl.n + '-' + dir);
        ans.addEventListener('input', function () {
          ans.value = ans.value.toUpperCase();
          cl.answer = ans.value;
          markDirty(p);
        });
        row.appendChild(ans);

        var warn = el('span', 'clue-warn', '');
        if (!(cl.clue || '').trim()) warn.textContent = 'No clue';
        else if ((cl.answer || '').length !== 5) warn.textContent = 'Not 5';
        else if (!ED.inDictionary(cl.answer)) warn.textContent = 'Not in dict';
        row.appendChild(warn);

        if (flagged) focusTarget = (cl.clue || '').trim() ? ans : text;
        list.appendChild(row);
      });
      clueSide.appendChild(list);
    });
    cols.appendChild(clueSide);

    wrap.appendChild(cols);
    return wrap;
  }

  function dailyFiveEditor(p, d) {
    var wrap = el('div');
    wrap.appendChild(el('div', 'ed-note',
      'A Daily Five is five independent five-letter answers and one shared hint. Each answer is checked against the ' +
      ED.langLabel(d.lang) + ' dictionary and against the 90-day reuse window.'));

    var list = el('div', 'clues');
    list.style.marginTop = '14px';
    d.content.answers.forEach(function (a, i) {
      var flagged = focusIs('answer', i);
      var row = el('div', 'd5-row' + (flagged ? ' is-flagged' : ''));
      row.appendChild(el('span', 'd5-n', 'Answer ' + (i + 1)));

      var input = el('input', 'input');
      input.type = 'text';
      input.maxLength = 8;
      input.value = a || '';
      input.setAttribute('aria-label', 'Answer ' + (i + 1));
      var mark = el('span', 'dict');

      function paintMark() {
        var w = (input.value || '').trim().toUpperCase();
        mark.innerHTML = '';
        var cls, m, t;
        if (!w) { cls = 'mute'; m = '–'; t = 'Empty'; }
        else if (w.length !== 5) { cls = 'bad'; m = '✕'; t = w.length + ' letters, needs 5'; }
        else if (!ED.inDictionary(w)) { cls = 'bad'; m = '✕'; t = 'Not in the ' + ED.langLabel(d.lang) + ' dictionary'; }
        else if (ED.reuseOf(w)) { cls = 'bad'; m = '!'; t = 'Used in ' + ED.reuseOf(w) + ' within 90 days'; }
        else { cls = 'ok'; m = '✓'; t = 'In the ' + ED.langLabel(d.lang) + ' dictionary'; }
        mark.className = 'dict ' + cls;
        mark.appendChild(el('span', 'm', m));
        mark.appendChild(document.createTextNode(t));
      }

      input.addEventListener('input', function () {
        input.value = input.value.toUpperCase();
        d.content.answers[i] = input.value;
        paintMark();
        markDirty(p);
      });
      row.appendChild(input);
      paintMark();
      row.appendChild(mark);
      if (flagged) focusTarget = input;
      list.appendChild(row);
    });
    wrap.appendChild(list);

    var hint = el('div', 'form-row');
    hint.style.marginTop = '16px';
    hint.style.maxWidth = '620px';
    var lab = el('label', 'label', 'Hint');
    lab.setAttribute('for', 'ed_d5_hint');
    hint.appendChild(lab);
    var ta = el('textarea', 'textarea');
    ta.id = 'ed_d5_hint';
    ta.value = d.content.hint || '';
    ta.placeholder = 'One sentence the five answers have in common.';
    ta.addEventListener('input', function () { d.content.hint = ta.value; markDirty(p); });
    hint.appendChild(ta);
    hint.appendChild(el('div', 'help', 'Shown above the five slots on the solve screen.'));
    wrap.appendChild(hint);
    return wrap;
  }

  // =====================================================================
  // tab: validation (E4)
  // =====================================================================

  function focusFor(where) {
    var m = /^(\d+)-(across|down)$/.exec(where);
    if (m) return { tab: 'content', focus: { kind: 'clue', dir: m[2], n: parseInt(m[1], 10) } };
    m = /^row (\d+), column (\d+)$/.exec(where);
    if (m) return { tab: 'content', focus: { kind: 'cell', r: parseInt(m[1], 10) - 1, c: parseInt(m[2], 10) - 1 } };
    m = /^answer (\d+)$/.exec(where);
    if (m) return { tab: 'content', focus: { kind: 'answer', i: parseInt(m[1], 10) - 1 } };
    if (where === 'metadata') return { tab: 'metadata', focus: null };
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
    head.appendChild(el('div', 'banner-detail', dirty(p)
      ? 'There are unsaved changes. Run validation again to check them.'
      : 'Checks: grid and answers agree, every clue has text, answers are five-letter dictionary words, and at least one topic is set.'));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.button('Run validation', { small: true, onClick: function () { runValidation(p); } }));
    wrap.appendChild(head);

    if (p.validation === 'not_run') {
      wrap.appendChild(C.ui.emptyState(
        'Validation has not run for this ' + noun(p) + ' yet. Run it to see the exact cells and clues that need work.', 'Not run'));
      return wrap;
    }

    if (!p.validationIssues.length) {
      var checks = p.kind === 'cw'
        ? [['Grid and answers agree', 'All 25 cells match both directions', 'pass'],
           ['Clue text', 'All ten clues have text', 'pass'],
           ['Dictionary', 'Every answer is a five-letter ' + ED.langLabel(p.lang) + ' word', 'pass']]
        : [['Answer length', 'All five answers are exactly five letters', 'pass'],
           ['Dictionary', 'Every answer is a five-letter ' + ED.langLabel(p.lang) + ' word', 'pass'],
           ['Hint', 'The shared hint is set', 'pass'],
           ['Reuse window', 'No answer was used in the last 90 days', 'pass']];
      checks.push(['Metadata', p.topics.length + ' topic' + (p.topics.length === 1 ? '' : 's') + ' set', 'pass']);
      wrap.appendChild(C.ui.checklist(checks));
      var ok = el('div', 'ed-note');
      ok.textContent = p.status === 'approved'
        ? 'This ' + noun(p) + ' is already approved and is available to the drop desk.'
        : 'Nothing is blocking approval. Use Approve in the bar above.';
      wrap.appendChild(ok);
      return wrap;
    }

    wrap.appendChild(el('div', 'ed-note',
      'Click an issue to jump to the exact cell, clue or field it names. Fix it, then run validation again.'));

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

    if (dirty(p)) {
      var n = el('div', 'notice');
      n.textContent = 'These issues are from the last run. You have unsaved edits — run validation again to re-check them.';
      wrap.appendChild(n);
    }
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
      var mini = el('div', 'feed-mini');
      for (var i = 0; i < 25; i++) mini.appendChild(el('span'));
      card.appendChild(mini);
    } else {
      var slots = el('div', 'feed-slots');
      for (var j = 0; j < 5; j++) slots.appendChild(el('div', 'feed-slot'));
      card.appendChild(slots);
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
    bar.appendChild(el('span', 'ed-note', 'Rendered from the content on the Content tab, including unsaved edits.'));
    wrap.appendChild(bar);

    var row = el('div', 'preview-row');

    // feed
    var head = el('div', 'feed-head');
    head.appendChild(el('span', 'feed-day', 'Today'));
    head.appendChild(el('span', 'feed-sub', C.store.todayLabel));
    row.appendChild(phone('Feed card', [head, feedCard(d), el('div', 'feed-meta', 'Streak 61 · 240 tokens')]));

    // solve
    var solveKids = [];
    var title = el('div', 'feed-head');
    title.appendChild(el('span', 'feed-day', d.title || 'Untitled ' + noun(d)));
    title.appendChild(el('span', 'feed-sub', ED.kindLabel(d.kind)));
    solveKids.push(title);

    if (d.kind === 'cw') {
      var g = el('div', 'solve-grid');
      d.content.grid.forEach(function (rw, r) {
        rw.forEach(function (ch, c) {
          var cell = el('div', 'solve-cell');
          var n = clueNumberAt(d, r, c);
          if (n != null) cell.appendChild(el('span', 'n', String(n)));
          if (st().previewFill === 'key') cell.appendChild(document.createTextNode((ch || '').toUpperCase()));
          g.appendChild(cell);
        });
      });
      solveKids.push(g);
      var first = d.content.clues.across[0] || {};
      var cl = el('div', 'solve-clue');
      cl.appendChild(el('span', 'lab', (first.n || 1) + ' across'));
      cl.appendChild(document.createTextNode(first.clue || 'No clue set for this answer yet.'));
      solveKids.push(cl);
    } else {
      var hint = el('div', 'solve-clue');
      hint.appendChild(el('span', 'lab', 'Hint'));
      hint.appendChild(document.createTextNode(d.content.hint || 'No hint set yet.'));
      solveKids.push(hint);
      d.content.answers.forEach(function (a, i) {
        var slot = el('div', 'solve-slot');
        var w = (a || '').toUpperCase();
        for (var k = 0; k < 5; k++) {
          var b = el('div', 'b');
          if (st().previewFill === 'key') b.textContent = w.charAt(k) || '';
          else if (i === 0 && k === 0) b.textContent = w.charAt(0) || '';
          slot.appendChild(b);
        }
        solveKids.push(slot);
      });
    }

    var keys = el('div', 'solve-keys');
    'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').forEach(function (k) { keys.appendChild(el('span', null, k)); });
    solveKids.push(keys);

    row.appendChild(phone('Solve screen', solveKids));
    wrap.appendChild(row);
    return wrap;
  }

  // =====================================================================
  // screen
  // =====================================================================

  var TABS = [
    { key: 'metadata', label: 'Metadata' },
    { key: 'content', label: 'Content' },
    { key: 'validation', label: 'Validation' },
    { key: 'preview', label: 'Preview' }
  ];

  C.registerScreen('#/library/:id', {
    title: function (params) {
      var p = C.find.puzzle(params.id);
      return p ? p.title : 'Game editor';
    },
    subline: function (params) {
      var p = C.find.puzzle(params.id);
      if (!p) return 'Unknown game';
      return p.id + ' · ' + ED.kindLabel(p.kind) + ' · ' + ED.langLabel(p.lang) + ' · ' +
        p.difficulty + ' · v' + p.version + (p.correctionOf ? ' · correction of ' + p.correctionOf : '');
    },
    actions: function (params) {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.button('Back to library', { onClick: function () { C.go('#/library'); } }));
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
        mount.appendChild(C.ui.emptyState(
          'No game with the id ' + params.id + '. It may have been created in a session that has since been reloaded.', 'Not found'));
        mount.appendChild(C.ui.button('Back to library', { onClick: function () { C.go('#/library'); } }));
        return;
      }
      ensureDraft(p);

      mount.appendChild(reviewBar(p));

      var note = blockNote(p);
      if (note) {
        var holder = el('div', 'screen-pad');
        holder.appendChild(note);
        mount.appendChild(holder);
      }

      mount.appendChild(C.ui.tabs(TABS, st().tab, function (k) {
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
