/* Economy — the economy admin's screen (M1, M2, M3).
   OWNER: integrity and economy builder.

   M1 Ledger    : filter by player, entry type and date; read one entry in detail.
   M2 Compensate: append a compensating entry from a player's ledger view.
   M3 Purchases : search by player or receipt and read the receipt detail.

   Balances are never edited here. A correction is a new ledger entry appended on
   top of the existing ones, exactly as the production command would do. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.economy = {
    tab: 'ledger',
    query: '',            // player search, ledger tab
    playerId: null,       // pinned player context for M2
    direction: 'all',     // all | earned | spent
    currency: 'all',      // all | tokens (shown as coins) | stars
    source: 'all',        // all | system | operator
    date: 'all',          // all | today | 7d
    entryId: null,
    purchaseQuery: '',
    purchaseId: null
  };

  function st() { return C.store.ui.economy; }

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------

  var MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

  /* Demo timestamps are strings: 'Today 12:06', 'Sep 7 12:11', 'Aug 30 16:44'.
     daysAgo() turns one into a number of days before Sep 8 2026 so the date
     filter and the newest-first sort work on anything another builder appends. */
  function daysAgo(when) {
    if (!when) return 0;
    if (/^Today/i.test(when)) return 0;
    if (/^Yesterday/i.test(when)) return 1;
    var m = String(when).match(/^([A-Z][a-z]{2})\s+(\d{1,2})/);
    if (!m || !MONTHS[m[1]]) return 0;
    var month = MONTHS[m[1]];
    var day = Number(m[2]);
    var ago = (9 - month) * 31 + (8 - day);
    return ago < 0 ? 0 : ago;
  }

  function minutes(when) {
    var m = String(when || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  }

  function newestFirst(list) {
    return list.slice().sort(function (a, b) {
      var d = daysAgo(a.when) - daysAgo(b.when);
      return d !== 0 ? d : minutes(b.when) - minutes(a.when);
    });
  }

  function playerName(id) {
    var p = C.find.player(id);
    return p ? p.name : id;
  }

  /* Store keys stay 'tokens'; the interface always says coins. */
  var CURRENCY_LABEL = { tokens: 'coins', stars: 'stars' };
  function currencyWord(key) { return CURRENCY_LABEL[key] || key; }

  function isOperatorSource(entry) { return entry.source && entry.source !== 'system'; }

  function amountNode(entry) {
    var up = entry.amount >= 0;
    var n = el('span', 'ie-sign ' + (up ? 'up' : 'down'));
    n.textContent = (up ? '+' : '−') + Math.abs(entry.amount) + ' ' + currencyWord(entry.currency);
    return n;
  }

  function balanceOf(player, currency) {
    return currency === 'stars' ? (player.stars || 0) : (player.tokens || 0);
  }

  function clockNow() {
    var now = C.store.audit[0] && /^Sep 8 /.test(C.store.audit[0].time)
      ? C.store.audit[0].time.replace('Sep 8 ', '')
      : '12:10';
    return 'Today ' + now;
  }

  // ------------------------------------------------------------------
  // M1 — ledger
  // ------------------------------------------------------------------

  function pinnedPlayer() {
    if (st().playerId) return C.find.player(st().playerId);
    var q = st().query.trim().toLowerCase();
    if (!q) return null;
    var hits = C.store.players.filter(function (p) {
      return (p.name + ' ' + p.id + ' ' + p.signIn).toLowerCase().indexOf(q) >= 0;
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function ledgerRows() {
    var s = st();
    var q = s.query.trim().toLowerCase();
    return newestFirst(C.store.ledger.filter(function (e) {
      if (s.playerId && e.playerId !== s.playerId) return false;
      if (q) {
        var hay = (e.playerId + ' ' + playerName(e.playerId) + ' ' + e.reason + ' ' + e.id).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      if (s.direction === 'earned' && e.amount < 0) return false;
      if (s.direction === 'spent' && e.amount >= 0) return false;
      if (s.currency !== 'all' && e.currency !== s.currency) return false;
      if (s.source === 'system' && isOperatorSource(e)) return false;
      if (s.source === 'operator' && !isOperatorSource(e)) return false;
      if (s.date === 'today' && daysAgo(e.when) !== 0) return false;
      if (s.date === '7d' && daysAgo(e.when) > 7) return false;
      return true;
    }));
  }

  function filterGroup(label, items, active, onChange) {
    var g = el('div', 'ie-filter');
    g.appendChild(el('span', 'ie-filter-label', label));
    g.appendChild(C.ui.segmented(items, active, onChange));
    return g;
  }

  function ledgerToolbar() {
    var s = st();
    var bar = el('div', 'ie-toolbar');

    var search = el('div', 'ie-filter');
    search.appendChild(el('span', 'ie-filter-label', 'Player'));
    var input = el('input', 'input ec-search');
    input.type = 'search';
    input.value = s.query;
    input.placeholder = 'Search by player ID, name or reason';
    input.setAttribute('aria-label', 'Search the ledger by player');
    input.addEventListener('change', function () { s.query = input.value; s.entryId = null; C.render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { s.query = input.value; s.entryId = null; C.render(); }
    });
    search.appendChild(input);
    bar.appendChild(search);

    bar.appendChild(filterGroup('Direction',
      [{ key: 'all', label: 'All' }, { key: 'earned', label: 'Earned' }, { key: 'spent', label: 'Spent' }],
      s.direction, function (k) { s.direction = k; C.render(); }));

    bar.appendChild(filterGroup('Currency',
      [{ key: 'all', label: 'All' }, { key: 'tokens', label: 'Coins' }, { key: 'stars', label: 'Stars' }],
      s.currency, function (k) { s.currency = k; C.render(); }));

    bar.appendChild(filterGroup('Source',
      [{ key: 'all', label: 'All' }, { key: 'system', label: 'System' }, { key: 'operator', label: 'Operator' }],
      s.source, function (k) { s.source = k; C.render(); }));

    bar.appendChild(filterGroup('Date',
      [{ key: 'all', label: 'All time' }, { key: '7d', label: 'Last 7 days' }, { key: 'today', label: 'Today' }],
      s.date, function (k) { s.date = k; C.render(); }));

    bar.appendChild(el('div', 'spacer'));

    var player = pinnedPlayer();
    if (player) {
      var ctx = el('div', 'ec-context');
      ctx.appendChild(el('span', 'eyebrow', 'Player in view'));
      ctx.appendChild(el('span', 'ec-context-name', player.name + ' · ' + player.id));
      ctx.appendChild(el('span', 'ie-two-sub', player.tokens + ' coins · ' + player.stars + ' stars'));
      bar.appendChild(ctx);
      bar.appendChild(C.ui.button('Add compensating entry', {
        variant: 'pink', small: true,
        onClick: function () { openCompensation(player); }
      }));
    }
    return bar;
  }

  function ledgerTable() {
    return C.ui.table({
      cols: [
        { key: 'when', label: 'When', render: function (r) { return el('span', 'cell-id ie-nowrap', r.when); } },
        {
          key: 'playerId', label: 'Player', render: function (r) {
            var n = el('div', 'ie-two');
            n.appendChild(el('span', 'ie-two-main ie-nowrap', playerName(r.playerId)));
            n.appendChild(el('span', 'ie-two-sub', r.playerId));
            return n;
          }
        },
        { key: 'reason', label: 'Reason' },
        {
          key: 'source', label: 'Source', render: function (r) {
            return el('span', 'cell-id ie-nowrap', isOperatorSource(r) ? r.source : 'system');
          }
        },
        { key: 'amount', label: 'Amount', align: 'right', render: amountNode },
        {
          key: 'balanceAfter', label: 'Balance after', align: 'right',
          render: function (r) { return el('span', 'cell-id', String(r.balanceAfter)); }
        }
      ],
      rows: ledgerRows(),
      onRowClick: function (r) { st().entryId = r.id; C.render(); },
      empty: 'No ledger entries match these filters.'
    });
  }

  function entryDetail() {
    var wrap = el('div', 'ie-detail');
    var entry = C.store.ledger.filter(function (e) { return e.id === st().entryId; })[0];
    if (!entry) {
      wrap.appendChild(C.ui.emptyState('Pick a ledger entry to read its detail.', 'No entry open'));
      return wrap;
    }
    var player = C.find.player(entry.playerId);

    var head = el('div', 'ie-detail-head');
    head.appendChild(el('div', 'ie-detail-title', (entry.amount >= 0 ? '+' : '−') + Math.abs(entry.amount) + ' ' + currencyWord(entry.currency)));
    head.appendChild(el('span', 'cell-id', entry.id));
    head.appendChild(el('div', 'spacer'));
    wrap.appendChild(head);
    wrap.appendChild(el('div', 'ie-detail-sub', entry.when + ' · ' + playerName(entry.playerId) + ' · ' + entry.playerId));

    var panel = el('div', 'panel');
    var ph = el('div', 'panel-head');
    ph.appendChild(el('span', 'panel-kind', 'Entry'));
    ph.appendChild(el('span', 'panel-title', entry.reason));
    panel.appendChild(ph);
    var pb = el('div', 'panel-body');
    var dl = el('dl', 'kv-grid');
    [
      ['Source', isOperatorSource(entry) ? 'Operator ' + entry.source : 'System'],
      ['Idempotency key', entry.idempotencyKey],
      ['Balance after', String(entry.balanceAfter)]
    ].forEach(function (pair) {
      dl.appendChild(el('dt', null, pair[0]));
      var dd = el('dd', null, pair[1]);
      if (pair[0] === 'Idempotency key') dd.className = 'mono';
      dl.appendChild(dd);
    });
    pb.appendChild(dl);
    panel.appendChild(pb);
    var pf = el('div', 'panel-foot');
    pf.appendChild(C.ui.button('Open player record', {
      small: true, onClick: function () { C.go('#/players/' + entry.playerId); }
    }));
    pf.appendChild(C.ui.button('Show only this player', {
      small: true,
      onClick: function () {
        st().playerId = entry.playerId;
        st().query = entry.playerId;
        C.render();
      }
    }));
    pf.appendChild(el('div', 'spacer'));
    panel.appendChild(pf);
    wrap.appendChild(panel);

    var linked = C.store.purchases.filter(function (p) { return p.idempotencyKey === entry.idempotencyKey; })[0];
    if (linked) {
      var note = el('div', 'notice');
      note.textContent = 'Same idempotency key as purchase ' + linked.receipt + '.';
      wrap.appendChild(note);
    }

    if (player) {
      var act = el('div', 'ie-decide');
      act.appendChild(el('div', 'eyebrow', 'Correction'));
      var row = el('div', 'btn-row roomy');
      row.appendChild(C.ui.button('Add compensating entry', {
        variant: 'pink',
        onClick: function () { openCompensation(player); }
      }));
      act.appendChild(row);
      act.appendChild(el('div', 'help', 'Corrections append entries; balances are never overwritten.'));
      wrap.appendChild(act);
    }
    return wrap;
  }

  // ------------------------------------------------------------------
  // M2 — compensating entry
  // ------------------------------------------------------------------

  function openCompensation(player) {
    var amount = 100;
    var currency = 'tokens';

    var body = el('div');

    var note = el('div', 'notice');
    note.textContent = 'Stays disabled in production until the audited server command exists.';
    body.appendChild(note);

    var who = el('div', 'form-row');
    who.appendChild(C.ui.field({
      label: 'Player', value: player.name + ' · ' + player.id, editable: false
    }));
    body.appendChild(who);

    var amountRow = el('div', 'form-row');
    var amountLabel = el('label', 'label', 'Amount');
    amountLabel.appendChild(el('span', 'req', 'required'));
    amountRow.appendChild(amountLabel);
    var inputs = el('div', 'btn-row');
    var input = el('input', 'input ie-amount');
    input.type = 'number';
    input.step = '1';
    input.value = String(amount);
    input.setAttribute('aria-label', 'Amount to append');
    inputs.appendChild(input);
    var seg = C.ui.segmented(
      [{ key: 'tokens', label: 'Coins' }, { key: 'stars', label: 'Stars' }],
      currency,
      function (k) { currency = k; rebuildSeg(); repaint(); }
    );
    var segWrap = el('div');
    segWrap.appendChild(seg);
    inputs.appendChild(segWrap);
    amountRow.appendChild(inputs);
    body.appendChild(amountRow);

    function rebuildSeg() {
      segWrap.innerHTML = '';
      segWrap.appendChild(C.ui.segmented(
        [{ key: 'tokens', label: 'Coins' }, { key: 'stars', label: 'Stars' }],
        currency,
        function (k) { currency = k; rebuildSeg(); repaint(); }
      ));
    }

    var reviewWrap = el('div', 'form-row');
    body.appendChild(reviewWrap);

    var reason = C.ui.reasonField({
      required: true,
      placeholder: 'e.g. Coins lost in the Aug 30 outage, ticket #4903'
    });
    body.appendChild(reason);

    function current() { return balanceOf(player, currency); }
    function parsed() {
      var v = Number(input.value);
      return isNaN(v) ? 0 : Math.round(v);
    }
    function after() { return current() + parsed(); }
    function valid() { return parsed() !== 0 && after() >= 0; }

    function repaint() {
      reviewWrap.innerHTML = '';
      reviewWrap.appendChild(C.ui.reviewPanel({
        title: 'Review the compensating entry',
        before: [
          ['Balance', current() + ' ' + currencyWord(currency)],
          ['Last entry', lastEntryLabel(player, currency)]
        ],
        after: [
          ['Entry', (parsed() >= 0 ? '+' : '−') + Math.abs(parsed()) + ' ' + currencyWord(currency)],
          ['Balance', after() + ' ' + currencyWord(currency)]
        ],
        consequence: 'A new entry is appended under your operator handle.'
      }));
      if (!valid()) {
        var warn = el('div', 'notice blocked');
        warn.textContent = parsed() === 0
          ? 'Enter an amount other than zero.'
          : 'The entry cannot take the balance below zero.';
        reviewWrap.appendChild(warn);
      }
      if (open && C.ui.refreshModal) C.ui.refreshModal();
    }

    var open = false;
    input.addEventListener('input', repaint);
    repaint();
    open = true;

    C.ui.modal({
      title: 'Add compensating entry',
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Append entry',
        disabled: function () { return !valid(); },
        onClick: function () {
          var amt = parsed();
          var cur = currency;
          var balance = after();
          var handle = (C.store.session.operator && C.store.session.operator.handle) || 'operator';
          var key = 'idem_' + player.id.replace('pl_', '') + '_comp_' + String(C.store.ledger.length + 1).padStart(4, '0');
          st().playerId = player.id;
          st().query = player.id;
          st().tab = 'ledger';
          st().entryId = null;
          C.commit({
            action: 'Append compensating ledger entry',
            object: player.id,
            reason: reason.value(),
            result: (amt >= 0 ? '+' : '−') + Math.abs(amt) + ' ' + currencyWord(cur) + ' appended · balance ' + balance + ' ' + currencyWord(cur),
            apply: function (store) {
              var live = C.find.player(player.id);
              store.ledger.push({
                id: 'le_' + String(store.ledger.length + 1).padStart(4, '0'),
                when: clockNow(),
                playerId: player.id,
                currency: cur,
                amount: amt,
                reason: 'Compensating entry · ' + reason.value(),
                source: handle,
                idempotencyKey: key,
                balanceAfter: balance
              });
              if (live) {
                if (cur === 'stars') live.stars = balance;
                else live.tokens = balance;
              }
            }
          });
          C.ui.closeModal();
          C.toast('Compensating entry appended for ' + player.name + '.');
        }
      }
    });
  }

  function lastEntryLabel(player, currency) {
    var rows = newestFirst(C.store.ledger.filter(function (e) {
      return e.playerId === player.id && e.currency === currency;
    }));
    if (!rows.length) return 'No ' + currencyWord(currency) + ' entries yet';
    return rows[0].when + ' · ' + rows[0].reason;
  }

  // ------------------------------------------------------------------
  // M3 — purchases
  // ------------------------------------------------------------------

  function purchaseRows() {
    var q = st().purchaseQuery.trim().toLowerCase();
    return newestFirst(C.store.purchases.filter(function (p) {
      if (!q) return true;
      var hay = (p.playerId + ' ' + playerName(p.playerId) + ' ' + p.receipt + ' ' + p.pack + ' ' + p.id).toLowerCase();
      return hay.indexOf(q) >= 0;
    }));
  }

  function purchasesToolbar() {
    var s = st();
    var bar = el('div', 'ie-toolbar');
    var search = el('div', 'ie-filter');
    search.appendChild(el('span', 'ie-filter-label', 'Search'));
    var input = el('input', 'input ec-search');
    input.type = 'search';
    input.value = s.purchaseQuery;
    input.placeholder = 'Player ID, player name or receipt';
    input.setAttribute('aria-label', 'Search purchases by player or receipt');
    input.addEventListener('change', function () { s.purchaseQuery = input.value; s.purchaseId = null; C.render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { s.purchaseQuery = input.value; s.purchaseId = null; C.render(); }
    });
    search.appendChild(input);
    bar.appendChild(search);

    bar.appendChild(el('div', 'spacer'));
    return bar;
  }

  function purchasesTable() {
    return C.ui.table({
      cols: [
        { key: 'when', label: 'When', render: function (r) { return el('span', 'cell-id ie-nowrap', r.when); } },
        {
          key: 'playerId', label: 'Player', render: function (r) {
            var n = el('div', 'ie-two');
            n.appendChild(el('span', 'ie-two-main ie-nowrap', playerName(r.playerId)));
            n.appendChild(el('span', 'ie-two-sub', r.playerId));
            return n;
          }
        },
        {
          key: 'pack', label: 'Pack · plan', render: function (r) {
            var n = el('div', 'ie-two');
            n.appendChild(el('span', 'ie-two-main', r.pack));
            n.appendChild(el('span', 'ie-two-sub', r.plan));
            return n;
          }
        },
        { key: 'receipt', label: 'Receipt', render: function (r) { return el('span', 'cell-id', r.receipt); } },
        { key: 'amount', label: 'Amount', align: 'right' },
        { key: 'status', label: 'Status', align: 'right', render: function (r) { return C.ui.status(r.status); } }
      ],
      rows: purchaseRows(),
      onRowClick: function (r) { st().purchaseId = r.id; C.render(); },
      empty: 'No purchase matches that player or receipt.'
    });
  }

  function purchaseDetail() {
    var wrap = el('div', 'ie-detail');
    var pu = C.store.purchases.filter(function (p) { return p.id === st().purchaseId; })[0];
    if (!pu) {
      wrap.appendChild(C.ui.emptyState('Pick a purchase to read its receipt detail.', 'No purchase open'));
      return wrap;
    }

    var head = el('div', 'ie-detail-head');
    head.appendChild(el('div', 'ie-detail-title', pu.pack));
    head.appendChild(el('span', 'cell-id', pu.id));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.pill(pu.status));
    wrap.appendChild(head);
    wrap.appendChild(el('div', 'ie-detail-sub', pu.when + ' · ' + playerName(pu.playerId) + ' · ' + pu.playerId));

    var panel = el('div', 'panel');
    var ph = el('div', 'panel-head');
    ph.appendChild(el('span', 'panel-kind', 'Receipt'));
    ph.appendChild(el('span', 'panel-title', pu.receipt));
    panel.appendChild(ph);
    var pb = el('div', 'panel-body');
    var dl = el('dl', 'kv-grid');
    [
      ['Plan', pu.plan],
      ['Amount', pu.amount],
      ['Idempotency key', pu.idempotencyKey]
    ].forEach(function (pair) {
      dl.appendChild(el('dt', null, pair[0]));
      var dd = el('dd', null, pair[1]);
      if (pair[0] === 'Idempotency key') dd.className = 'mono';
      dl.appendChild(dd);
    });
    pb.appendChild(dl);
    panel.appendChild(pb);
    var pf = el('div', 'panel-foot');
    pf.appendChild(C.ui.button('Open player record', {
      small: true, onClick: function () { C.go('#/players/' + pu.playerId); }
    }));
    pf.appendChild(C.ui.button('Show ledger for this player', {
      small: true,
      onClick: function () {
        st().tab = 'ledger';
        st().playerId = pu.playerId;
        st().query = pu.playerId;
        st().entryId = null;
        C.render();
      }
    }));
    pf.appendChild(el('div', 'spacer'));
    panel.appendChild(pf);
    wrap.appendChild(panel);

    var entry = C.store.ledger.filter(function (e) { return e.idempotencyKey === pu.idempotencyKey; })[0];
    if (entry) {
      var linked = el('div', 'panel');
      var lh = el('div', 'panel-head');
      lh.appendChild(el('span', 'panel-kind', 'Ledger'));
      lh.appendChild(el('span', 'panel-title', 'Matching entry'));
      linked.appendChild(lh);
      var lb = el('div', 'panel-body');
      var line = el('div', 'ie-impact');
      line.appendChild(el('span', 'ie-impact-board', entry.reason));
      line.appendChild(el('span', 'cell-id', entry.when));
      line.appendChild(el('div', 'spacer'));
      line.appendChild(amountNode(entry));
      lb.appendChild(line);
      lb.appendChild(C.ui.button('Open entry', {
        small: true,
        onClick: function () { st().tab = 'ledger'; st().entryId = entry.id; C.render(); }
      }));
      linked.appendChild(lb);
      wrap.appendChild(linked);
    }
    return wrap;
  }

  // ------------------------------------------------------------------
  // assembly
  // ------------------------------------------------------------------

  function build(mount) {
    mount.appendChild(C.ui.tabs(
      [{ key: 'ledger', label: 'Ledger' }, { key: 'purchases', label: 'Purchases' }],
      st().tab,
      function (k) { st().tab = k; C.render(); }
    ));

    var grid = el('div', 'ie-grid wide');
    var list = el('div', 'ie-list');

    if (st().tab === 'ledger') {
      mount.appendChild(ledgerToolbar());
      list.appendChild(ledgerTable());
      grid.appendChild(list);
      grid.appendChild(entryDetail());
    } else {
      mount.appendChild(purchasesToolbar());
      list.appendChild(purchasesTable());
      grid.appendChild(list);
      grid.appendChild(purchaseDetail());
    }
    mount.appendChild(grid);
  }

  C.registerScreen('#/economy', {
    title: 'Economy',
    subline: function () {
      return st().tab === 'purchases'
        ? C.store.purchases.length + ' receipts'
        : C.store.ledger.length + ' ledger entries';
    },
    render: function (mount) { build(mount); }
  });

  if (!document.getElementById('ec-style')) {
    var s = document.createElement('style');
    s.id = 'ec-style';
    s.textContent = [
      '.ec-search{width:250px}',
      '.ec-context{display:flex;flex-direction:column;gap:2px}',
      '.ec-context-name{font:700 13px var(--sans)}'
    ].join('\n');
    document.head.appendChild(s);
  }
})(window.Console);
