/* Audit log — the session trail, newest first (C3).
   OWNER: access builder. Route: #/audit (role: console_admin). */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.audit = {
    operator: 'all',
    object: '',
    action: '',
    date: 'all',
    selected: null      // the audit entry object itself, so it survives new commits
  };

  function st() { return C.store.ui.audit; }

  function dateOf(entry) {
    var at = entry.time.lastIndexOf(' ');
    return at > 0 ? entry.time.slice(0, at) : entry.time;
  }

  function filtered() {
    var s = st();
    var obj = s.object.trim().toLowerCase();
    var act = s.action.trim().toLowerCase();
    return C.store.audit.filter(function (e) {
      if (s.operator !== 'all' && e.operator !== s.operator) return false;
      if (s.date !== 'all' && dateOf(e) !== s.date) return false;
      if (obj && String(e.object).toLowerCase().indexOf(obj) < 0) return false;
      if (act && String(e.action).toLowerCase().indexOf(act) < 0) return false;
      return true;
    });
  }

  function isFiltered() {
    var s = st();
    return s.operator !== 'all' || s.date !== 'all' || !!s.object.trim() || !!s.action.trim();
  }

  // ------------------------------------------------------------------
  // resolving an audit object to a console route
  // ------------------------------------------------------------------

  var AREA_LABEL = {};
  function areaLabel(area) {
    if (!AREA_LABEL[area]) {
      var hit = C.nav.filter(function (n) { return n.area === area; })[0];
      AREA_LABEL[area] = hit ? hit.label : area;
    }
    return AREA_LABEL[area];
  }

  /* resolve(object) → {area, route, what} when a screen owns the object,
     or {why: 'one line explaining why nothing can be opened'}. */
  function resolve(object) {
    var id = String(object || '').trim();
    if (!id) return { why: 'This entry records no object.' };

    var day = id.match(/^day (\d{4}-\d{2}-\d{2})$/);
    if (day) {
      var d = C.find.day(day[1]);
      return {
        area: 'desk', route: '#/desk',
        what: (d ? d.longLabel : day[1]) + ' in Daily challenge'
      };
    }

    if (/^pl_/.test(id)) {
      return C.find.player(id)
        ? { area: 'players', route: '#/players/' + id, what: C.find.player(id).name + '’s support record' }
        : { why: id + ' is no longer in this environment.' };
    }

    if (/^(CW|D5)-/.test(id)) {
      var puz = C.find.puzzle(id);
      return puz
        ? { area: 'library', route: '#/library/' + id, what: '“' + puz.title + '” in the ' + (puz.kind === 'cw' ? 'crossword' : 'Daily Five') + ' editor' }
        : { why: id + ' is not in this library.' };
    }

    if (C.find.collection(id) || /^col_/.test(id)) {
      var col = C.find.collection(id);
      return { area: 'collections', role: 'publisher', route: '#/collections', what: col ? '“' + col.name + '” in Collections' : 'Collections' };
    }

    var placement = C.store.placements.filter(function (p) { return p.id === id; })[0];
    var adRule = C.store.adRules.filter(function (r) { return r.id === id; })[0];
    if (placement || adRule) {
      return { area: 'ads', route: '#/ads', what: (placement ? '“' + placement.name + '”' : '“' + adRule.label + '”') + ' in Ads' };
    }

    if (/^fl_/.test(id)) {
      var flag = C.store.flags.filter(function (f) { return f.id === id; })[0];
      return flag
        ? { area: 'collections', role: 'integrity', route: '#/leaderboards', what: 'the flagged solve by ' + flag.playerName }
        : { why: id + ' is no longer in the queue.' };
    }

    if (/^(batch_|sig_)/.test(id)) {
      return { area: 'operations', route: '#/operations', what: id + ' in Operations' };
    }

    var op = C.store.operators.filter(function (o) { return o.handle === id; })[0];
    if (op) {
      return { area: 'access', route: '#/access', what: op.name + '’s operator account' };
    }

    return { why: id + ' is not owned by any console screen.' };
  }

  // ------------------------------------------------------------------
  // filters
  // ------------------------------------------------------------------

  function filterBar(onChange) {
    var bar = el('div', 'screen-pad aud-filters');
    var s = st();

    function labelled(text, control) {
      var box = el('div', 'aud-filter');
      box.appendChild(el('label', 'label', text));
      box.appendChild(control);
      return box;
    }

    var operators = [];
    C.store.audit.forEach(function (e) {
      if (operators.indexOf(e.operator) < 0) operators.push(e.operator);
    });
    operators.sort();

    var opSel = el('select', 'select');
    opSel.setAttribute('aria-label', 'Filter by operator');
    [{ v: 'all', t: 'Every operator' }].concat(operators.map(function (o) {
      return { v: o, t: o };
    })).forEach(function (o) {
      var opt = el('option', null, o.t);
      opt.value = o.v;
      if (o.v === s.operator) opt.selected = true;
      opSel.appendChild(opt);
    });
    opSel.addEventListener('change', function () { s.operator = opSel.value; onChange(); });
    bar.appendChild(labelled('Operator', opSel));

    var actIn = el('input', 'input');
    actIn.type = 'search';
    actIn.value = s.action;
    actIn.placeholder = 'e.g. approve';
    actIn.setAttribute('aria-label', 'Filter by action');
    actIn.addEventListener('input', function () { s.action = actIn.value; onChange(); });
    bar.appendChild(labelled('Action', actIn));

    var objIn = el('input', 'input');
    objIn.type = 'search';
    objIn.value = s.object;
    objIn.placeholder = 'e.g. pl_8f2c41 or CW-22';
    objIn.setAttribute('aria-label', 'Filter by object');
    objIn.addEventListener('input', function () { s.object = objIn.value; onChange(); });
    bar.appendChild(labelled('Object', objIn));

    var dates = [];
    C.store.audit.forEach(function (e) {
      var d = dateOf(e);
      if (dates.indexOf(d) < 0) dates.push(d);
    });
    var dateSel = el('select', 'select');
    dateSel.setAttribute('aria-label', 'Filter by date');
    [{ v: 'all', t: 'Every date' }].concat(dates.map(function (d) {
      return { v: d, t: d + (d === 'Sep 8' ? ' · today' : '') };
    })).forEach(function (o) {
      var opt = el('option', null, o.t);
      opt.value = o.v;
      if (o.v === s.date) opt.selected = true;
      dateSel.appendChild(opt);
    });
    dateSel.addEventListener('change', function () { s.date = dateSel.value; onChange(); });
    bar.appendChild(labelled('Date', dateSel));

    bar.appendChild(el('div', 'spacer'));
    var clear = C.ui.button('Clear filters', {
      small: true,
      disabled: !isFiltered(),
      onClick: function () {
        s.operator = 'all'; s.object = ''; s.action = ''; s.date = 'all';
        C.render();
      }
    });
    var clearBox = el('div', 'aud-filter aud-filter-btn');
    clearBox.appendChild(el('label', 'label', ' '));
    clearBox.appendChild(clear);
    bar.appendChild(clearBox);
    bar.clearBtn = clear;
    return bar;
  }

  // ------------------------------------------------------------------
  // list and detail
  // ------------------------------------------------------------------

  function countLine(rows) {
    if (!isFiltered()) return null;
    var n = el('div', 'table-foot aud-count');
    n.appendChild(el('span', null, rows.length + ' of ' + C.store.audit.length + ' entries'));
    return n;
  }

  function list(rows, onPick) {
    return C.ui.table({
      cols: [
        {
          key: 'sel', label: '', width: '14px', render: function (e) {
            return el('span', 'aud-sel' + (e === st().selected ? ' is-on' : ''));
          }
        },
        { key: 'time', label: 'Time', width: '104px', cls: 'cell-id' },
        { key: 'operator', label: 'Operator', width: '92px', cls: 'cell-id' },
        {
          key: 'action', label: 'Action', width: '190px', render: function (e) {
            return el('span', 'cell-title', e.action);
          }
        },
        { key: 'object', label: 'Object', width: '150px', cls: 'cell-id' },
        {
          key: 'result', label: 'Result', render: function (e) {
            return el('span', 'aud-result', e.result);
          }
        }
      ],
      rows: rows,
      onRowClick: onPick,
      empty: 'No audit entry matches these filters.'
    });
  }

  function detail(entry) {
    var wrap = el('div', 'aud-detail');
    if (!entry) {
      wrap.appendChild(C.ui.emptyState('Pick an entry to see its detail.', 'No entry selected'));
      return wrap;
    }

    var head = el('div', 'aud-detail-head');
    head.appendChild(el('div', 'inspector-title', entry.action));
    head.appendChild(el('div', 'inspector-sub', entry.time + ' · ' + entry.operator));
    wrap.appendChild(head);

    var body = el('div', 'aud-detail-body');
    var kv = el('dl', 'kv-grid');
    function pair(k, v, cls) {
      kv.appendChild(el('dt', null, k));
      kv.appendChild(el('dd', cls || null, v));
    }
    pair('Time', entry.time, 'mono');
    pair('Operator', entry.operator, 'mono');
    pair('Action', entry.action);
    pair('Object', entry.object || '—', 'mono');
    pair('Result', entry.result);
    pair('Reason', entry.reason || 'No reason recorded.', entry.reason ? null : 'muted');
    body.appendChild(kv);

    var hit = resolve(entry.object);
    var open = el('div', 'aud-open');
    if (hit.why) {
      open.appendChild(C.ui.button('Open affected object', { disabled: true }));
      open.appendChild(el('div', 'help', hit.why));
    } else if (!C.canSee(hit.area) || (hit.role && !C.hasRole(hit.role))) {
      open.appendChild(C.ui.button('Open affected object', { disabled: true }));
      open.appendChild(el('div', 'help', hit.role && !C.hasRole(hit.role)
        ? 'Opening it needs the ' + ((C.data.roles[hit.role] || {}).label || hit.role).toLowerCase() + ' role.'
        : 'This object lives in ' + areaLabel(hit.area) + ', which your roles do not unlock.'));
    } else {
      open.appendChild(C.ui.button('Open affected object', {
        variant: 'pink',
        onClick: function () { C.go(hit.route); }
      }));
      open.appendChild(el('div', 'help', 'Opens ' + hit.what));
    }
    body.appendChild(open);

    wrap.appendChild(body);
    return wrap;
  }

  // ------------------------------------------------------------------
  // screen
  // ------------------------------------------------------------------

  function build(mount) {
    var pane = el('div', 'aud-grid');
    var left = el('div', 'aud-list');
    var right = el('div', 'aud-side');
    pane.appendChild(left);
    pane.appendChild(right);

    function paint() {
      var rows = filtered();
      if (bar && bar.clearBtn) bar.clearBtn.disabled = !isFiltered();
      if (st().selected && rows.indexOf(st().selected) < 0) st().selected = null;
      left.innerHTML = '';
      var count = countLine(rows);
      if (count) left.appendChild(count);
      left.appendChild(list(rows, function (e) {
        st().selected = e;
        paint();
      }));
      right.innerHTML = '';
      right.appendChild(detail(st().selected));
    }

    var bar = filterBar(paint);
    mount.appendChild(bar);
    mount.appendChild(pane);
    paint();
  }

  C.registerScreen('#/audit', {
    title: 'Audit log',
    subline: function () {
      return C.store.audit.length + ' entries · newest first';
    },
    actions: function () {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.button('Access', { onClick: function () { C.go('#/access'); } }));
      return row;
    },
    render: function (mount) { build(mount); }
  });

  // ------------------------------------------------------------------
  // screen-specific styles
  // ------------------------------------------------------------------

  var style = document.createElement('style');
  style.textContent = [
    '.aud-filters{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--rule)}',
    '.aud-filter{display:flex;flex-direction:column;min-width:0}',
    '.aud-filter .input,.aud-filter .select{width:190px}',
    '.aud-filter-btn .label{visibility:hidden}',
    '.aud-count{border-bottom:1px solid var(--rule-soft);justify-content:space-between}',
    '.aud-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.85fr);min-width:0}',
    '.aud-list{min-width:0;border-right:1px solid var(--rule);overflow-x:auto}',
    '.aud-side{min-width:0;background:var(--paper)}',
    '.aud-result{font:500 12px var(--sans);color:var(--ink-65)}',
    '.aud-sel{display:block;width:6px;height:6px;border-radius:50%;background:transparent}',
    '.aud-sel.is-on{background:var(--pink)}',
    '.aud-detail{display:flex;flex-direction:column;min-width:0}',
    '.aud-detail-head{padding:16px var(--pad-x) 12px;border-bottom:1px solid rgba(22,19,11,.14)}',
    '.aud-detail-body{display:flex;flex-direction:column;gap:16px;padding:16px var(--pad-x)}',
    '.aud-detail-body .kv-grid{grid-template-columns:96px minmax(0,1fr)}',
    '.aud-open{display:flex;flex-direction:column;gap:2px;align-items:flex-start;padding-top:4px;border-top:1px solid var(--rule-soft)}',
    '.aud-open .btn{margin-top:14px}',
    '@media (max-width:1360px){',
    '  .aud-filter .input,.aud-filter .select{width:150px}',
    '  .aud-grid{grid-template-columns:minmax(0,1.25fr) minmax(280px,.9fr)}',
    '  .aud-list .tbl thead th:nth-child(4){width:150px}',
    '  .aud-list .tbl thead th:nth-child(5){width:120px}',
    '  .aud-list .tbl tbody td{padding-left:12px;padding-right:12px}',
    '  .aud-list .tbl thead th{padding-left:12px;padding-right:12px}',
    '}'
  ].join('\n');
  document.head.appendChild(style);
})(window.Console);
