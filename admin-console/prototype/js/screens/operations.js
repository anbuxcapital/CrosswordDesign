/* Operations — job signals, pool depth and import batches (O1, O2, O3).
   OWNER: ads and operations builder.

   O1 Triage and retry a failed job — signals table → detail (job, affected
      object, error, last runs) → Retry → per-item results. The retry re-reads
      the store, so filling the Sep 11 Guessword on the Daily game desk really does
      turn this signal green; until then the detail names the item still missing.
   O2 Act on pool depth — depth rows per language and kind against the 10-day
      floor, each short row opening the library filtered to Approved of that kind.
   O3 Review an import batch — accepted and rejected items with reasons; a
      rejected item opens in the library when a record exists for it. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.operations = { tab: 'signals', signal: 'sig_drop_gen', batch: null };

  /* Kind words come from Console.KIND_LABEL in app.js, read through the
     accessors, so a rename lands here too. */
  var LANG = { en: 'English', uk: 'Ukrainian', ru: 'Russian' };
  var READY = ['approved', 'scheduled', 'published', 'live'];

  function days(n) { return n + (n === 1 ? ' day' : ' days'); }
  function st() { return C.store.ui.operations; }
  function signals() { return C.store.signals; }
  function batches() { return C.store.importBatches; }
  function signalById(id) { return signals().filter(function (s) { return s.id === id; })[0] || null; }
  function batchById(id) { return batches().filter(function (b) { return b.id === id; })[0] || null; }

  function selectedSignal() { return signalById(st().signal) || signals()[0] || null; }
  function selectedBatch() { return batchById(st().batch) || batches()[0] || null; }

  function dayOf(sig) {
    if (!/^day /.test(sig.object || '')) return null;
    return C.find.day(sig.object.slice(4));
  }

  function actionLabel(sig) {
    if (sig.level === 'failed') return 'Triage';
    if (sig.depth) return 'View depth';
    return 'View detail';
  }

  // ------------------------------------------------------------------
  // O1 — retry
  // ------------------------------------------------------------------

  /* What a retry would do right now, recomputed from the store rather than
     replayed from the seed. */
  function retryPlan(sig) {
    var day = dayOf(sig);
    if (day) {
      var derived = C.deriveDay(day);
      // A Daily game is exactly two slots: one crossword, one Guessword.
      return ['cw', 'guessword'].map(function (kind) {
        var item = derived.slots[kind];
        if (!item) {
          return {
            kind: kind, label: day.label + ' ' + C.kindWord(kind), outcome: 'failed',
            detail: 'No ' + C.kindLabel(kind) + ' assigned to this day'
          };
        }
        if (READY.indexOf(item.status) < 0) {
          return {
            kind: kind, label: day.label + ' ' + C.kindWord(kind) + ' ' + item.id, outcome: 'failed',
            detail: item.title + ' is ' + (C.ui.STATUS[item.status] || { label: item.status }).label.toLowerCase() + ', not approved'
          };
        }
        return {
          kind: kind, label: day.label + ' ' + C.kindWord(kind) + ' ' + item.id, outcome: 'ok',
          detail: item.title + ' queued in the ' + C.kindLabel(kind) + ' slot'
        };
      });
    }
    return (sig.items || []).map(function (it) {
      return { label: it.label, outcome: 'ok', detail: 'Re-ran and succeeded' };
    });
  }

  function successDetail(sig, items) {
    var day = dayOf(sig);
    if (day) return 'Generated for ' + day.label + ' · ' + C.kindLabel('cw') +
      ' queued · ' + C.kindLabel('guessword') + ' queued';
    if (sig.id === 'sig_reward_grants') {
      return '0 of 812 grants failed · Post-solve rewarded · 7 days (under the 1% alert floor)';
    }
    return items.length + ' of ' + items.length + ' items re-ran successfully';
  }

  function failureDetail(sig, items) {
    var first = items.filter(function (i) { return i.outcome !== 'ok'; })[0];
    var day = dayOf(sig);
    return 'Failed for ' + (day ? day.label : sig.object) + ' — ' + first.detail.charAt(0).toLowerCase() + first.detail.slice(1);
  }

  function openRetry(sig) {
    var items = retryPlan(sig);
    var body = el('div');

    var kv = el('dl', 'kv-grid');
    [['Job', sig.job], ['Affected object', sig.object],
      [dayOf(sig) ? 'Slots to run' : 'Items to run', String(items.length)], ['Effective', 'Now · Sep 8']]
      .forEach(function (r) {
        kv.appendChild(el('dt', null, r[0]));
        kv.appendChild(el('dd', 'mono', r[1]));
      });
    body.appendChild(kv);

    var reason = C.ui.reasonField({
      required: false,
      label: 'Reason (optional)',
      placeholder: 'e.g. ' + C.kindLabel('guessword') + ' assigned in Daily game, re-running generation'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Retry ' + sig.job,
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Run retry',
        onClick: function () {
          var allOk = items.every(function (i) { return i.outcome === 'ok'; });
          var okCount = items.filter(function (i) { return i.outcome === 'ok'; }).length;
          C.commit({
            action: 'Retry job',
            object: sig.object || sig.id,
            reason: reason.value(),
            result: 'Ran ' + sig.job + ' · ' + okCount + ' of ' + items.length + (dayOf(sig) ? ' slots' : ' items') + ' ok · signal ' +
              (allOk ? 'cleared' : 'still failing: ' + items.filter(function (i) { return i.outcome !== 'ok'; })[0].label),
            apply: function () {
              var s = signalById(sig.id);
              s.items = items;
              s.lastRun = '12:31 UTC';
              s.runs = [['12:31 UTC', allOk ? 'ok' : 'failed']].concat(s.runs || []);
              if (allOk) {
                s.level = 'ok';
                s.error = '';
                s.detail = successDetail(s, items);
              } else {
                s.level = 'failed';
                s.detail = failureDetail(s, items);
              }
              st().signal = s.id;
            }
          });
          C.ui.closeModal();
          openRetryResults(sig, items);
        }
      }
    });
  }

  function openRetryResults(sig, items) {
    var allOk = items.every(function (i) { return i.outcome === 'ok'; });
    var body = el('div');
    body.appendChild(el('div', 'panel-note', sig.job + ' · run at 12:31 UTC'));
    body.lastChild.style.marginBottom = '10px';
    body.appendChild(C.ui.results(items.map(function (i) {
      return { label: i.label, outcome: i.outcome, detail: i.detail, outcomeLabel: i.outcome === 'ok' ? 'OK' : 'Failed' };
    })));

    var day = dayOf(sig);
    if (!allOk) {
      var first = items.filter(function (i) { return i.outcome !== 'ok'; })[0];
      var note = el('div', 'notice blocked');
      note.style.marginTop = '12px';
      note.textContent = day
        ? 'Assign ' + C.kindArticle(first.kind || 'cw') + ' to ' + day.longLabel + ' in Daily game, then retry.'
        : 'Fix the item above, then retry.';
      body.appendChild(note);
    }
    C.ui.modal({
      title: 'Retry results — ' + sig.name,
      body: body,
      wide: true,
      secondary: (!allOk && day && C.canSee('desk')) ? {
        label: 'Open ' + day.label + ' in Daily game',
        onClick: function () { C.ui.closeModal(); goToDay(day); }
      } : null,
      primary: { label: 'Done', onClick: function () { C.ui.closeModal(); } }
    });
  }

  function goToDay(day) {
    if (C.store.ui.desk && typeof C.store.ui.desk === 'object') {
      C.store.ui.desk.day = day.index;
      C.store.ui.desk.view = 'calendar';
    }
    C.go('#/desk');
  }

  // ------------------------------------------------------------------
  // O2 — pool depth
  // ------------------------------------------------------------------

  /* Hand-off to the editorial builder's library. The kind picks its tab;
     `filter` carries the state chips, `status` and `lang` the rest. */
  function openLibrary(row) {
    C.store.ui.library = Object.assign({}, C.store.ui.library || {}, {
      tab: row.kind, filter: 'all', status: 'approved', kind: row.kind, lang: row.lang,
      selected: []
    });
    C.go('#/library');
  }

  function depthTable(sig) {
    return C.ui.table({
      cols: [
        { key: 'lang', label: 'Language', width: '92px', render: function (r) { return LANG[r.lang] || r.lang; } },
        { key: 'kind', label: 'Kind', render: function (r) { return C.kindLabel(r.kind); } },
        { key: 'days', label: 'Depth', align: 'right', width: '124px', render: function (r) {
          var w = el('div', 'cell-stack');
          var v = el('span', 'num', days(r.days));
          if (r.days < r.floor) v.style.color = 'var(--gold)';
          w.appendChild(v);
          w.appendChild(el('span', 'cell-sub', r.floor + '-day floor'));
          return w;
        } },
        { key: 'state', label: 'State', align: 'right', width: '116px', render: function (r) {
          return r.days < r.floor
            ? C.ui.status('warn', days(r.floor - r.days) + ' short')
            : C.ui.status('ok', 'Above floor');
        } },
        { key: 'act', label: '', align: 'right', width: '124px', render: function (r) {
          if (r.days >= r.floor) return el('span', 'cell-sub', 'No action');
          if (!C.canSee('library')) return el('span', 'cell-sub', 'Needs the content editor role');
          return C.ui.button('Open library', { small: true, onClick: function () { openLibrary(r); } });
        } }
      ],
      rows: sig.depth,
      empty: 'This signal does not measure pool depth.'
    });
  }

  // ------------------------------------------------------------------
  // signal detail panel
  // ------------------------------------------------------------------

  /* One short line, and only where it names a next step the pill and the
     key-value rows above do not already give. */
  function alertNotice(sig) {
    if (sig.level !== 'failed') return null;
    var day = dayOf(sig);
    var n = el('div', 'notice blocked');
    n.textContent = day
      ? 'The ' + day.longLabel + ' Daily game cannot publish until the missing item is assigned.'
      : 'Retry the job; every item reports its own outcome.';
    return n;
  }

  function signalDetail() {
    var sig = selectedSignal();
    var wrap = el('div', 'inspector');
    if (!sig) {
      wrap.appendChild(C.ui.emptyState('Pick a signal to see its job, object and last runs.'));
      return wrap;
    }

    var head = el('div', 'inspector-head');
    var titles = el('div');
    titles.style.minWidth = '0';
    titles.appendChild(el('div', 'inspector-title', sig.name));
    head.appendChild(titles);
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.pill(sig.level));
    wrap.appendChild(head);

    var body = el('div', 'inspector-body');

    var kv = el('dl', 'kv-grid');
    var rows = [['Job', sig.job], ['Affected object', sig.object], ['Last run', sig.lastRun], ['Detail', sig.detail]];
    if (sig.error) rows.push(['Error', sig.error]);
    rows.forEach(function (r) {
      kv.appendChild(el('dt', null, r[0]));
      kv.appendChild(el('dd', r[0] === 'Detail' ? null : 'mono', r[1]));
    });
    body.appendChild(kv);

    var notice = alertNotice(sig);
    if (notice) body.appendChild(notice);

    if (sig.depth) {
      body.appendChild(el('div', 'eyebrow', 'Pool depth'));
      body.appendChild(depthTable(sig));
    }

    if (sig.items && sig.items.length) {
      body.appendChild(el('div', 'eyebrow', 'Items in the last run'));
      body.appendChild(C.ui.results(sig.items.map(function (i) {
        return { label: i.label, outcome: i.outcome, detail: i.detail, outcomeLabel: i.outcome === 'ok' ? 'OK' : 'Failed' };
      })));
    }

    body.appendChild(el('div', 'eyebrow', 'Last runs'));
    body.appendChild(C.ui.results((sig.runs || []).map(function (r) {
      return {
        label: r[0],
        outcome: r[1] === 'ok' ? 'ok' : r[1] === 'warn' ? 'skipped' : 'failed',
        outcomeLabel: (C.ui.STATUS[r[1]] || { label: r[1] }).label,
        detail: ''
      };
    })));

    var foot = el('div', 'btn-row roomy');
    var day = dayOf(sig);
    if (sig.level !== 'ok' || (sig.items && sig.items.length)) {
      foot.appendChild(C.ui.button('Retry ' + sig.job, {
        variant: sig.level === 'ok' ? 'quiet' : 'pink',
        onClick: function () { openRetry(sig); }
      }));
    }
    if (day && C.canSee('desk')) {
      foot.appendChild(C.ui.button('Open ' + day.label + ' in Daily game', {
        onClick: function () { goToDay(day); }
      }));
    }
    if (sig.job === 'content.import') {
      foot.appendChild(C.ui.button('Open the import batch', {
        onClick: function () { st().tab = 'batches'; st().batch = sig.object; C.render(); }
      }));
    }
    if (foot.children.length) body.appendChild(foot);

    wrap.appendChild(body);
    return wrap;
  }

  function signalsTable() {
    return C.ui.table({
      cols: [
        { key: 'level', label: 'Level', width: '106px', render: function (s) { return C.ui.status(s.level); } },
        { key: 'name', label: 'Signal', render: function (s) {
          var w = el('div', 'cell-stack');
          w.appendChild(el('span', 'cell-strong', s.name));
          w.appendChild(el('span', 'cell-sub', s.job));
          return w;
        } },
        { key: 'detail', label: 'Detail' },
        { key: 'lastRun', label: 'Last run', align: 'right', width: '104px', render: function (s) {
          return el('span', 'cell-sub', s.lastRun);
        } },
        { key: 'act', label: '', align: 'right', width: '116px', render: function (s) {
          return C.ui.button(actionLabel(s), { small: true, onClick: function (e) {
            e.stopPropagation(); st().signal = s.id; C.render();
          } });
        } }
      ],
      rows: signals(),
      onRowClick: function (s) { st().signal = s.id; C.render(); },
      selectable: null,
      empty: 'No job signals have been reported.'
    });
  }

  // ------------------------------------------------------------------
  // O3 — import batches
  // ------------------------------------------------------------------

  function itemPuzzleId(item) {
    var m = /^([A-Z][A-Z0-9]{0,3}-\d+)/.exec(item.label || '');
    return m ? m[1] : null;
  }

  function cannotOpen(item, id) {
    var body = el('div');
    body.appendChild(el('div', 'panel-note',
      id
        ? id + ' was rejected before a library record was created.'
        : 'This line does not name a single record.'));
    var n = el('div', 'notice');
    n.style.marginTop = '12px';
    n.textContent = 'Rejected: ' + item.detail + '. Fix it in the source file and re-import.';
    body.appendChild(n);
    C.ui.modal({
      title: 'Cannot open ' + (id || 'this item'),
      body: body,
      primary: { label: 'Close', onClick: function () { C.ui.closeModal(); } }
    });
  }

  function batchItemRow(item) {
    var row = el('div', 'result-item');
    row.appendChild(el('span', 'result-mark ' + item.outcome, item.outcome === 'ok' ? 'Accepted' : 'Rejected'));
    row.appendChild(el('span', 'result-label', item.label));
    row.appendChild(el('span', 'spacer'));
    row.appendChild(el('span', 'result-detail', item.detail || ''));
    if (item.outcome !== 'ok') {
      var id = itemPuzzleId(item);
      var exists = id ? C.find.puzzle(id) : null;
      if (exists && !C.canSee('library')) {
        row.appendChild(el('span', 'cell-sub', id + ' · needs the content editor role'));
        return row;
      }
      row.appendChild(C.ui.button(exists ? 'Open ' + id : 'Why no record?', {
        small: true,
        onClick: function () {
          if (exists) C.go('#/library/' + id);
          else cannotOpen(item, id);
        }
      }));
    }
    return row;
  }

  function batchDetail() {
    var b = selectedBatch();
    var wrap = el('div', 'inspector');
    if (!b) {
      wrap.appendChild(C.ui.emptyState('Pick an import batch to see its accepted and rejected items.'));
      return wrap;
    }

    var head = el('div', 'inspector-head');
    var titles = el('div');
    titles.style.minWidth = '0';
    titles.appendChild(el('div', 'inspector-title', b.source));
    head.appendChild(titles);
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.pill(b.rejected ? 'warn' : 'ok', b.rejected ? b.rejected + ' rejected' : 'All accepted'));
    wrap.appendChild(head);

    var body = el('div', 'inspector-body');

    var kv = el('dl', 'kv-grid');
    [['Batch', b.id], ['Imported by', b.operator], ['When', b.when],
     ['Accepted', b.accepted + ' games'], ['Rejected', b.rejected + ' games']].forEach(function (r) {
      kv.appendChild(el('dt', null, r[0]));
      kv.appendChild(el('dd', 'mono', r[1]));
    });
    body.appendChild(kv);

    body.appendChild(el('div', 'eyebrow', 'Items'));
    var list = el('div', 'results');
    (b.items || []).forEach(function (item) { list.appendChild(batchItemRow(item)); });
    body.appendChild(list);

    wrap.appendChild(body);
    return wrap;
  }

  function batchesTable() {
    return C.ui.table({
      cols: [
        { key: 'id', label: 'Batch', render: function (b) {
          var w = el('div', 'cell-stack');
          w.appendChild(el('span', 'cell-strong', b.source));
          w.appendChild(el('span', 'cell-sub', b.id));
          return w;
        } },
        { key: 'when', label: 'When', width: '112px', render: function (b) {
          var w = el('div', 'cell-stack');
          w.appendChild(el('span', 'cell-sub', b.when));
          w.appendChild(el('span', 'cell-sub', b.operator));
          return w;
        } },
        { key: 'accepted', label: 'Accepted', align: 'right', width: '84px', render: function (b) { return el('span', 'num', String(b.accepted)); } },
        { key: 'rejected', label: 'Rejected', align: 'right', width: '84px', render: function (b) {
          var s = el('span', 'num', String(b.rejected));
          if (b.rejected) s.style.color = 'var(--pink)';
          return s;
        } },
        { key: 'act', label: '', align: 'right', width: '108px', render: function (b) {
          return C.ui.button('View items', { small: true, onClick: function (e) {
            e.stopPropagation(); st().batch = b.id; C.render();
          } });
        } }
      ],
      rows: batches(),
      onRowClick: function (b) { st().batch = b.id; C.render(); },
      empty: 'No import batches yet.'
    });
  }

  // ------------------------------------------------------------------
  // screen
  // ------------------------------------------------------------------

  function failureBanner() {
    var bad = signals().filter(function (s) { return s.level === 'failed'; })[0];
    if (!bad) return null;
    var day = dayOf(bad);
    var b = el('div', 'banner attention');
    b.appendChild(el('span', 'banner-dot'));
    b.appendChild(el('div', 'banner-text', bad.name + ' · ' + bad.detail));
    b.appendChild(el('div', 'banner-detail', day
      ? 'Blocks the ' + day.longLabel + ' Daily game.'
      : 'Retry the job to get a per-item outcome.'));
    b.appendChild(el('div', 'spacer'));
    b.appendChild(C.ui.button('Triage', {
      small: true,
      onClick: function () { st().tab = 'signals'; st().signal = bad.id; C.render(); }
    }));
    return b;
  }

  function build(mount) {
    var banner = failureBanner();
    if (banner) mount.appendChild(banner);

    var head = el('div', 'section-head');
    head.appendChild(C.ui.tabs(
      [{ key: 'signals', label: 'Signals' }, { key: 'batches', label: 'Import batches' }],
      st().tab,
      function (k) { st().tab = k; C.render(); }
    ));
    head.appendChild(el('div', 'spacer'));
    mount.appendChild(head);

    var grid = el('div', 'ops-grid');
    var left = el('div', 'ops-list');
    left.appendChild(st().tab === 'signals' ? signalsTable() : batchesTable());
    grid.appendChild(left);
    grid.appendChild(st().tab === 'signals' ? signalDetail() : batchDetail());
    mount.appendChild(grid);
  }

  C.registerScreen('#/operations', {
    title: 'Operations',
    subline: 'Job signals, pool depth and import batches',
    render: function (mount) { build(mount); }
  });

  // ------------------------------------------------------------------
  // screen-specific CSS
  // ------------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent = [
    '.ops-grid{display:grid;grid-template-columns:minmax(340px,1fr) minmax(0,1fr);min-width:0}',
    '.ops-list{min-width:0;overflow:hidden;border-right:1px solid var(--rule)}',
    '.ops-grid .inspector{min-width:0}',
    '.ops-grid .inspector-body .eyebrow{margin-top:2px}',
    '.ops-grid .result-item .btn{margin-left:10px;flex:none}',
    '.ops-grid .result-mark{width:74px}',
    '.ops-grid .kv-grid{grid-template-columns:132px minmax(0,1fr)}',
    '.ops-grid .kv-grid dd{overflow-wrap:anywhere}'
  ].join('\n');
  document.head.appendChild(style);
})(window.Console);
