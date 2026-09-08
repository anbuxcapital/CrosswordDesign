/* Operations — job signals, pool depth and import batches (O1, O2, O3).
   OWNER: ads and operations builder.

   O1 Triage and retry a failed job — signals table → detail (job, affected
      object, error, last runs) → Retry → per-item results. The retry re-reads
      the store, so filling the Sep 11 Daily Five on the drop desk really does
      turn this signal green; until then the detail names the item still missing.
   O2 Act on pool depth — depth rows per language and kind against the 10-day
      floor, each short row opening the library filtered to Approved of that kind.
   O3 Review an import batch — accepted and rejected items with reasons; a
      rejected item opens in the library when a record exists for it. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.operations = { tab: 'signals', signal: 'sig_drop_gen', batch: null };

  var KIND = { cw: 'Crossword', d5: 'Daily Five' };
  var KIND_INLINE = { cw: 'crossword', d5: 'Daily Five' };
  var LANG = { en: 'English', uk: 'Ukrainian' };
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
      // A drop is exactly two slots: one crossword, one Daily Five.
      return ['cw', 'd5'].map(function (kind) {
        var item = derived.slots[kind];
        if (!item) {
          return {
            label: day.label + ' ' + KIND_INLINE[kind], outcome: 'failed',
            detail: 'No ' + KIND[kind] + ' assigned to this day'
          };
        }
        if (READY.indexOf(item.status) < 0) {
          return {
            label: day.label + ' ' + KIND_INLINE[kind] + ' ' + item.id, outcome: 'failed',
            detail: item.title + ' is ' + (C.ui.STATUS[item.status] || { label: item.status }).label.toLowerCase() + ', not approved'
          };
        }
        return {
          label: day.label + ' ' + KIND_INLINE[kind] + ' ' + item.id, outcome: 'ok',
          detail: item.title + ' queued in the ' + KIND[kind] + ' slot'
        };
      });
    }
    return (sig.items || []).map(function (it) {
      return { label: it.label, outcome: 'ok', detail: 'Re-ran and succeeded' };
    });
  }

  function successDetail(sig, items) {
    var day = dayOf(sig);
    if (day) return 'Generated for ' + day.label + ' · Crossword queued · Daily Five queued';
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

    var note = el('div', 'notice');
    note.style.marginTop = '12px';
    note.textContent = 'The retry re-reads the current content and reports one outcome per ' +
      (dayOf(sig) ? 'slot' : 'item') + '. It does not edit games, days or player records.';
    body.appendChild(note);

    var reason = C.ui.reasonField({
      required: false,
      label: 'Reason (optional)',
      placeholder: 'e.g. Daily Five assigned in Daily challenge, re-running generation',
      help: 'A job retry does not require a reason. Anything you write is stored in the audit log with the result.'
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
    body.appendChild(el('div', 'panel-note',
      sig.job + ' · ' + sig.object + ' · ' + items.length + (dayOf(sig) ? ' slots' : ' items') + ' · run at 12:31 UTC'));
    body.lastChild.style.marginBottom = '10px';
    body.appendChild(C.ui.results(items.map(function (i) {
      return { label: i.label, outcome: i.outcome, detail: i.detail, outcomeLabel: i.outcome === 'ok' ? 'OK' : 'Failed' };
    })));

    var note = el('div', allOk ? 'notice' : 'notice blocked');
    note.style.marginTop = '12px';
    if (allOk) {
      note.textContent = sig.name + ' is now OK. Nothing else is waiting on this job.';
    } else {
      var first = items.filter(function (i) { return i.outcome !== 'ok'; })[0];
      var day = dayOf(sig);
      note.textContent = sig.name + ' still fails: ' + first.label + ' — ' + first.detail + '. ' +
        (day
          ? 'Assign a ' + (/Daily Five/.test(first.label) ? 'Daily Five' : 'crossword') + ' to ' + day.longLabel + ' in Daily challenge, then retry.'
          : 'Fix the item above, then retry.');
    }
    body.appendChild(note);

    var day = dayOf(sig);
    C.ui.modal({
      title: 'Retry results — ' + sig.name,
      body: body,
      wide: true,
      secondary: (!allOk && day && C.canSee('desk')) ? {
        label: 'Open ' + day.label + ' in Daily challenge',
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

  /* Hand-off to the editorial builder's library. Its state object reads
     `filter` (kind or a tolerated status key), `status` and `lang`; `kind` is
     carried too so the shape stays readable if that screen changes. */
  function openLibrary(row) {
    C.store.ui.library = Object.assign({}, C.store.ui.library || {}, {
      filter: row.kind, status: 'approved', kind: row.kind, lang: row.lang
    });
    C.go('#/library');
  }

  function depthTable(sig) {
    return C.ui.table({
      cols: [
        { key: 'lang', label: 'Language', width: '92px', render: function (r) { return LANG[r.lang] || r.lang; } },
        { key: 'kind', label: 'Kind', render: function (r) { return KIND[r.kind] || r.kind; } },
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

  function alertNotice(sig) {
    var day = dayOf(sig);
    var n = el('div', 'notice' + (sig.level === 'failed' ? ' blocked' : ''));
    if (sig.depth) {
      var short = sig.depth.filter(function (r) { return r.days < r.floor; });
      if (!short.length) {
        n.className = 'panel-note';
        n.textContent = sig.name + ' is OK. Every language and kind is above the 10-day floor. Last run ' + sig.lastRun + '.';
        return n;
      }
      n.textContent = short.length + ' of ' + sig.depth.length + ' pools are under the floor: ' + short.map(function (r) {
        return LANG[r.lang] + ' ' + KIND[r.kind] + ' has ' + days(r.days) + ' against a ' + r.floor + '-day floor';
      }).join('; ') + '. Approve or import more games of that kind — Open library on a short row lands on Approved games of exactly that kind and language.';
      return n;
    }
    if (sig.level === 'ok') {
      n.className = 'panel-note';
      n.textContent = sig.name + ' is OK. Last run ' + sig.lastRun + '. Nothing is waiting on this job.';
      return n;
    }
    n.textContent = sig.name + ' failed on ' + sig.object + ' at ' + sig.lastRun + '. ' +
      (day
        ? 'The Daily challenge for ' + day.longLabel + ' will not publish until the missing item is assigned. Fix it in Daily challenge, then retry the job.'
        : 'Retry the job below; every item reports its own outcome.');
    return n;
  }

  function signalDetail() {
    var sig = selectedSignal();
    var wrap = el('div', 'inspector');
    if (!sig) {
      wrap.appendChild(C.ui.emptyState('Pick a signal to see the job, the affected object and its last runs.'));
      return wrap;
    }

    var head = el('div', 'inspector-head');
    var titles = el('div');
    titles.style.minWidth = '0';
    titles.appendChild(el('div', 'inspector-title', sig.name));
    titles.appendChild(el('div', 'inspector-sub', sig.job + ' · last run ' + sig.lastRun));
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

    body.appendChild(alertNotice(sig));

    if (sig.depth) {
      body.appendChild(el('div', 'eyebrow', 'Pool depth · measured ' + sig.lastRun + ' · 10-day floor'));
      body.appendChild(depthTable(sig));
    }

    if (sig.items && sig.items.length) {
      body.appendChild(el('div', 'eyebrow', 'Items in the last run'));
      body.appendChild(C.ui.results(sig.items.map(function (i) {
        return { label: i.label, outcome: i.outcome, detail: i.detail, outcomeLabel: i.outcome === 'ok' ? 'OK' : 'Failed' };
      })));
    }

    body.appendChild(el('div', 'eyebrow', 'Last runs'));
    body.appendChild(C.ui.checklist((sig.runs || []).map(function (r) {
      return [r[0], (C.ui.STATUS[r[1]] || { label: r[1] }).label, r[1] === 'ok' ? 'pass' : r[1] === 'warn' ? 'warn' : 'fail'];
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
      foot.appendChild(C.ui.button('Open ' + day.label + ' in Daily challenge', {
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
        ? id + ' was rejected before a library record was created, so there is nothing to open.'
        : 'This line covers several games at once and does not name a single record, so there is nothing to open.'));
    var n = el('div', 'notice');
    n.style.marginTop = '12px';
    n.textContent = 'Rejection reason: ' + item.detail + '. Fix the item in the source file and re-import the batch; the editorial import flow creates the draft on the next accepted run.';
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
    titles.appendChild(el('div', 'inspector-sub', b.id + ' · imported by ' + b.operator + ' · ' + b.when));
    head.appendChild(titles);
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.pill(b.rejected ? 'warn' : 'ok', b.rejected ? b.rejected + ' rejected' : 'All accepted'));
    wrap.appendChild(head);

    var body = el('div', 'inspector-body');

    var kv = el('dl', 'kv-grid');
    [['Batch', b.id], ['Source file', b.source], ['Imported by', b.operator], ['When', b.when],
     ['Accepted', b.accepted + ' games'], ['Rejected', b.rejected + ' games']].forEach(function (r) {
      kv.appendChild(el('dt', null, r[0]));
      kv.appendChild(el('dd', 'mono', r[1]));
    });
    body.appendChild(kv);

    if (b.rejected) {
      var n = el('div', 'notice');
      n.textContent = b.rejected + ' of ' + (b.accepted + b.rejected) + ' games in ' + b.source +
        ' were rejected and never became drafts. Open a rejected item to fix it, or send the reasons back to the author.';
      body.appendChild(n);
    }

    body.appendChild(el('div', 'eyebrow', 'Items · ' + (b.items || []).length + ' reported'));
    var list = el('div', 'results');
    (b.items || []).forEach(function (item) { list.appendChild(batchItemRow(item)); });
    body.appendChild(list);
    body.appendChild(el('div', 'panel-note',
      'This list is what the import job reported. Counts above cover the whole file; the lines here name every item the job called out.'));

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
      empty: 'No import batches yet. The editorial import flow adds them here.'
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
      ? 'Blocks the ' + day.longLabel + ' Daily challenge. Retry the job, or assign the missing game first.'
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
    head.appendChild(el('div', 'panel-note', st().tab === 'signals'
      ? signals().filter(function (s) { return s.level === 'failed'; }).length + ' failed · ' +
        signals().filter(function (s) { return s.level === 'warn'; }).length + ' warning · ' +
        signals().length + ' signals · content pool floor 10 days'
      : batches().length + ' batches · ' + batches().reduce(function (a, b) { return a + b.rejected; }, 0) + ' rejected items total'));
    head.appendChild(C.ui.densitySwitch());
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
    subline: 'Job signals, content pool depth and import batches',
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
