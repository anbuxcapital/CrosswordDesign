/* Players — the support agent's area (S1–S5).
   OWNER: support builder.

   S1 #/players          every player, with a live filter on id, name or sign-in
   S2 #/players/:id      Profile tab: edit a field → review + reason → Changed
   S3                    Support actions: restore streak, grant tokens, reset session
   S4                    Account safeguards: force sign-out, suspend, merge, delete
   S5                    Notes: add a note, close an open note

   Every mutation goes through Console.commit, so it lands in #/audit with the
   operator, the object, the reason and the result. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.players = {
    q: '',                // S1 filter text, applied from the first character
    tab: 'profile',       // active tab on the record
    editField: null,      // label of the profile field being edited
    editValue: '',        // the in-progress value for that field
    changed: {}           // {playerId: [fieldLabel, …]} — fields changed this session
  };

  function st() { return C.store.ui.players; }

  // A demo wall clock for timeline and ledger stamps, matching the seed style.
  var clock = 12 * 60 + 20;
  function stampTime() {
    clock += 3;
    var h = Math.floor(clock / 60) % 24;
    return 'Today ' + String(h).padStart(2, '0') + ':' + String(clock % 60).padStart(2, '0');
  }

  var grantSeq = 0;

  function initials(name) {
    var parts = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase();
  }

  function langLabel(code) { return code === 'uk' ? 'Ukrainian' : 'English'; }

  function isChanged(player, label) {
    var list = st().changed[player.id] || [];
    return list.indexOf(label) >= 0;
  }
  function markChanged(player, label) {
    var list = st().changed[player.id] || (st().changed[player.id] = []);
    if (list.indexOf(label) < 0) list.push(label);
  }

  function pushTimeline(player, kind, text, amount) {
    player.timeline.unshift([stampTime(), kind, text, amount || '']);
  }

  function accountLocked(player) {
    return !!player.deletionRequested;
  }

  // ------------------------------------------------------------------
  // S1 — the player list
  // ------------------------------------------------------------------

  /* Every player, filtered live from the first character of the box. */
  function listRows() {
    var needle = st().q.trim().toLowerCase();
    var all = C.store.players.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    if (!needle) return all;
    return all.filter(function (p) {
      return (p.id + ' ' + p.name + ' ' + p.signIn).toLowerCase().indexOf(needle) >= 0;
    });
  }

  function listScreen(mount) {
    var bar = el('div', 'pl-bar');
    var box = el('input', 'input');
    box.id = 'players_filter';
    box.type = 'search';
    box.value = st().q;
    box.placeholder = 'Filter by ID, name or sign-in address';
    box.setAttribute('aria-label', 'Filter players by ID, name or sign-in');
    bar.appendChild(box);

    var count = el('span', 'pl-count');
    bar.appendChild(el('div', 'spacer'));
    bar.appendChild(count);
    mount.appendChild(bar);

    var host = el('div', 'pl-table');
    mount.appendChild(host);

    function paint() {
      var rows = listRows();
      count.textContent = rows.length === C.store.players.length
        ? rows.length + (rows.length === 1 ? ' player' : ' players')
        : rows.length + ' of ' + C.store.players.length + ' shown';
      host.innerHTML = '';
      host.appendChild(C.ui.table({
        cols: [
          {
            key: 'name', label: 'Player', render: function (p) {
              var n = el('span', 'pl-cell-name');
              n.appendChild(el('span', 'pl-avatar', initials(p.name)));
              n.appendChild(el('span', 'cell-title', p.name));
              return n;
            }
          },
          { key: 'id', label: 'Player ID', cls: 'cell-id', width: '116px' },
          { key: 'signIn', label: 'Sign-in', cls: 'nowrap' },
          {
            key: 'lang', label: 'Language', width: '104px',
            render: function (p) { return langLabel(p.lang); }
          },
          {
            key: 'streak', label: 'Streak', align: 'right', width: '84px',
            render: function (p) { return p.streak + ' d'; }
          },
          { key: 'solved', label: 'Solved', align: 'right', width: '78px' },
          { key: 'tokens', label: 'Tokens', align: 'right', width: '82px' },
          {
            key: 'status', label: 'Status', align: 'right', width: '150px',
            render: function (p) {
              return C.ui.pill(p.status, p.deletionRequested ? 'Deletion pending' : null);
            }
          }
        ],
        rows: rows,
        onRowClick: function (p) { C.go('#/players/' + p.id); },
        empty: 'No player matches \u201c' + st().q.trim() + '\u201d.'
      }));
    }

    box.addEventListener('input', function () {
      st().q = box.value;
      paint();
    });
    paint();
  }

  // ------------------------------------------------------------------
  // record — header, banners, tabs
  // ------------------------------------------------------------------

  function statStrip(p) {
    var wrap = el('div', 'pl-head');

    var idBlock = el('div', 'pl-head-id');
    idBlock.appendChild(el('span', 'pl-avatar lg', initials(p.name)));
    var t = el('div');
    t.appendChild(el('div', 'pl-name', p.name));
    t.appendChild(el('div', 'pl-sub', p.signIn + ' · ' + langLabel(p.lang) + ' · joined ' + p.joined));
    idBlock.appendChild(t);
    wrap.appendChild(idBlock);
    wrap.appendChild(el('div', 'spacer'));

    [
      ['Streak', p.streak + ' d'],
      ['Solved', String(p.solved)],
      ['Tokens', String(p.tokens)],
      ['Stars', String(p.stars)]
    ].forEach(function (s) {
      var n = el('div', 'pl-stat');
      n.appendChild(el('span', 'eyebrow', s[0]));
      n.appendChild(el('span', 'pl-stat-value', s[1]));
      wrap.appendChild(n);
    });

    wrap.appendChild(C.ui.pill(p.status, p.deletionRequested ? 'Deletion pending' : null));
    return wrap;
  }

  function banners(mount, p) {
    if (p.deletionRequested) {
      var d = el('div', 'notice blocked');
      d.textContent = 'Deletion accepted ' + p.deletionRequested.when + ': the record is locked and is erased by ' +
        p.deletionRequested.by + '.';
      mount.appendChild(d);
      return;
    }
    if (p.status === 'suspended') {
      var b = el('div', 'notice blocked');
      b.style.display = 'flex';
      b.style.alignItems = 'center';
      b.style.gap = '12px';
      b.appendChild(el('span', null, 'Suspended: the player cannot sign in, solve or appear on a board.'));
      b.appendChild(el('div', 'spacer'));
      b.appendChild(C.ui.button('Unsuspend', { small: true, onClick: function () { suspendFlow(p, false); } }));
      mount.appendChild(b);
    }
    if (p.mergedInto) {
      var m = el('div', 'notice');
      m.textContent = 'Merged into ' + p.mergedInto + '. Its sign-in now resolves to that record.';
      mount.appendChild(m);
    }
  }

  // ------------------------------------------------------------------
  // S2 — profile fields
  // ------------------------------------------------------------------

  function fieldRow(p, entry, mount) {
    var label = entry[0], value = entry[1], editable = entry[2];
    var locked = accountLocked(p);

    if (st().editField === label) {
      var wrap = el('div', 'pl-edit');
      var input = el('input', 'input');
      input.value = st().editValue;
      input.setAttribute('aria-label', label);
      input.addEventListener('input', function () { st().editValue = input.value; });

      wrap.appendChild(C.ui.field({
        label: label, value: input, editable: true, editing: true
      }));

      var row = el('div', 'btn-row');
      row.style.marginTop = '8px';
      row.appendChild(el('div', 'spacer'));
      row.appendChild(C.ui.button('Cancel', {
        small: true,
        onClick: function () { st().editField = null; st().editValue = ''; C.render(); }
      }));
      row.appendChild(C.ui.button('Save', {
        variant: 'pink', small: true,
        onClick: function () { saveFieldFlow(p, label, value, st().editValue); }
      }));
      wrap.appendChild(row);
      return wrap;
    }

    return C.ui.field({
      label: label,
      value: value,
      editable: editable && !locked,
      changed: isChanged(p, label),
      onEdit: editable && !locked ? function () {
        st().editField = label;
        st().editValue = value;
        C.render();
      } : null
    });
  }

  function saveFieldFlow(p, label, oldValue, newValue) {
    newValue = String(newValue).trim();
    if (!newValue || newValue === oldValue) {
      C.toast(newValue ? 'That value is unchanged.' : 'Enter a value before saving.');
      return;
    }
    var identity = ['Display name', 'Sign-in', 'Language'].indexOf(label) >= 0;
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Review the change',
      before: [[label, oldValue], ['Record', p.id], ['Status', (C.ui.STATUS[p.status] || {}).label]],
      after: [[label, newValue], ['Record', p.id], ['Status', (C.ui.STATUS[p.status] || {}).label]],
      consequence: identity
        ? 'The player is notified.'
        : 'The player is not notified of this field.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      placeholder: 'e.g. Player asked for the corrected spelling, ticket #4832'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Change ' + label.toLowerCase(),
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Confirm change',
        onClick: function () {
          C.commit({
            action: 'Change profile field',
            object: p.id,
            reason: reason.value(),
            result: label + ' changed from “' + oldValue + '” to “' + newValue + '”',
            apply: function () {
              p.profile.forEach(function (f) { if (f[0] === label) f[1] = newValue; });
              if (label === 'Display name') p.name = newValue;
              if (label === 'Language') p.lang = /ukrain/i.test(newValue) ? 'uk' : 'en';
              markChanged(p, label);
              st().editField = null;
              st().editValue = '';
              pushTimeline(p, 'session', label + ' changed by support', '');
            }
          });
          C.ui.closeModal();
          C.toast(label + ' changed.');
        }
      }
    });
  }

  function profileTab(mount, p) {
    var wrap = el('div', 'pl-pad');

    var fields = el('div');
    p.profile.forEach(function (entry) { fields.appendChild(fieldRow(p, entry, mount)); });
    wrap.appendChild(fields);

    wrap.appendChild(supportActionsPanel(p));
    wrap.appendChild(accountPanel(p));
    mount.appendChild(wrap);
  }

  // ------------------------------------------------------------------
  // S3 — support actions
  // ------------------------------------------------------------------

  function supportActionsPanel(p) {
    var locked = accountLocked(p) || p.status === 'suspended';
    var panel = el('div', 'panel on-paper');
    panel.style.marginTop = '16px';
    var head = el('div', 'panel-head');
    head.appendChild(el('span', 'panel-title', 'Support actions'));
    panel.appendChild(head);

    var body = el('div', 'panel-body');

    var row = el('div', 'btn-row');
    C.store.supportActions.forEach(function (a) {
      row.appendChild(C.ui.button(a.label, {
        small: true,
        disabled: locked,
        onClick: function () { actionParamsStep(p, a); }
      }));
    });
    body.appendChild(row);
    if (locked) {
      body.appendChild(el('div', 'help', accountLocked(p)
        ? 'Closed while a deletion request is pending.'
        : 'Closed while the account is suspended.'));
    }
    panel.appendChild(body);
    return panel;
  }

  function actionParamsStep(p, action) {
    var values = {};
    action.params.forEach(function (par) { values[par.key] = par.value; });

    var body = el('div');
    if (action.params.length) {
      action.params.forEach(function (par) {
        var frow = el('div', 'form-row');
        var lab = el('label', 'label', par.label);
        lab.appendChild(el('span', 'req', 'required'));
        frow.appendChild(lab);
        var input = el('input', 'input');
        input.type = 'number';
        input.min = '1';
        input.value = String(par.value);
        input.addEventListener('input', function () {
          values[par.key] = Number(input.value);
          C.ui.refreshModal();
        });
        frow.appendChild(input);
        frow.appendChild(el('div', 'help', par.key === 'days'
          ? 'Current streak ' + p.streak + ' days.'
          : 'Current balance ' + p.tokens + ' tokens.'));
        body.appendChild(frow);
      });
    } else {
      body.appendChild(el('div', 'notice',
        'Ends every active session. Solve progress on today’s games is kept.'));
    }

    C.ui.modal({
      title: action.label,
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Review before / after',
        disabled: function () {
          return action.params.some(function (par) {
            return !(Number(values[par.key]) > 0);
          });
        },
        onClick: function () { actionReviewStep(p, action, values); }
      }
    });
  }

  function actionReviewStep(p, action, values) {
    var before = [], after = [], consequence, resultText, applyFn;

    if (action.id === 'restore_streak') {
      var days = Number(values.days);
      var next = p.streak + days;
      before = [['Streak', p.streak + ' days'], ['Tokens', p.tokens], ['Ledger', 'no entry']];
      after = [['Streak', next + ' days'], ['Tokens', p.tokens], ['Ledger', 'no entry']];
      consequence = 'The player is notified.';
      resultText = 'Streak restored to ' + next + ' days (+' + days + ')';
      applyFn = function () {
        p.streak = next;
        pushTimeline(p, 'session', 'Streak restored by support (+' + days + ' days)', '');
      };
    } else if (action.id === 'grant_tokens') {
      var amount = Number(values.amount);
      var balance = p.tokens + amount;
      before = [['Tokens', p.tokens], ['Last entry', lastLedgerLabel(p)], ['Streak', p.streak + ' days']];
      after = [['Tokens', balance], ['Last entry', '+' + amount + ' tokens · support grant'], ['Streak', p.streak + ' days']];
      consequence = 'A ledger entry of +' + amount + ' tokens is appended.';
      resultText = 'Granted ' + amount + ' tokens · balance ' + balance;
      applyFn = function (store) {
        grantSeq += 1;
        p.tokens = balance;
        store.ledger.unshift({
          id: 'le_' + String(9000 + grantSeq),
          when: stampTime(),
          playerId: p.id,
          currency: 'tokens',
          amount: amount,
          reason: 'Support grant · ' + (store.session.operator ? store.session.operator.handle : 'unknown'),
          source: store.session.operator ? store.session.operator.handle : 'unknown',
          idempotencyKey: 'idem_' + p.id.replace('pl_', '') + '_grant_' + grantSeq,
          balanceAfter: balance
        });
        pushTimeline(p, 'ledger', 'Support grant credited', '+' + amount);
      };
    } else {
      var device = (p.devices[0] && p.devices[0][0]) || 'the current device';
      before = [['Sessions', p.devices.length + ' active'], ['Last seen', (p.devices[0] && p.devices[0][2]) || '—'], ['Streak', p.streak + ' days']];
      after = [['Sessions', '0 active'], ['Last seen', 'ended just now'], ['Streak', p.streak + ' days']];
      consequence = 'Every active session ends, including ' + device + '.';
      resultText = 'Session reset · ' + p.devices.length + ' session(s) ended';
      applyFn = function () {
        pushTimeline(p, 'session', 'Session reset by support', '');
      };
    }

    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: action.label + ' · ' + p.name,
      before: before, after: after, consequence: consequence
    }));
    var reason = C.ui.reasonField({
      required: true,
      placeholder: action.id === 'restore_streak'
        ? 'e.g. Lost streak while travelling across time zones, ticket #4821'
        : 'e.g. Goodwill after the Sep 6 outage, ticket #4830'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: action.label,
      body: body,
      secondary: { label: 'Back', onClick: function () { actionParamsStep(p, action); } },
      primary: {
        label: 'Confirm ' + action.label.toLowerCase(),
        onClick: function () {
          C.commit({
            action: action.label,
            object: p.id,
            reason: reason.value(),
            result: resultText,
            apply: applyFn
          });
          C.ui.closeModal();
          C.toast(resultText + '.');
        }
      }
    });
  }

  function lastLedgerLabel(p) {
    var e = C.store.ledger.filter(function (l) { return l.playerId === p.id; })[0];
    return e ? (e.amount > 0 ? '+' : '') + e.amount + ' ' + e.currency + ' · ' + e.reason : 'no entry';
  }

  // ------------------------------------------------------------------
  // S4 — account safeguards
  // ------------------------------------------------------------------

  function accountPanel(p) {
    var panel = el('div', 'panel on-paper');
    panel.style.marginTop = '12px';
    var head = el('div', 'panel-head');
    head.appendChild(el('span', 'panel-title', 'Account'));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.status(p.status, p.deletionRequested ? 'Deletion pending' : null));
    panel.appendChild(head);

    var body = el('div', 'panel-body');
    var row = el('div', 'btn-row roomy');
    var locked = accountLocked(p);

    row.appendChild(C.ui.button('Force sign-out', {
      small: true, disabled: locked, onClick: function () { forceSignOutFlow(p); }
    }));
    row.appendChild(C.ui.button(p.status === 'suspended' ? 'Unsuspend' : 'Suspend', {
      small: true, disabled: locked,
      onClick: function () { suspendFlow(p, p.status !== 'suspended'); }
    }));
    row.appendChild(C.ui.button('Merge duplicate', {
      small: true, disabled: locked, onClick: function () { mergePickStep(p); }
    }));
    row.appendChild(el('div', 'spacer'));
    row.appendChild(C.ui.button('Delete on request', {
      variant: 'danger', small: true, disabled: locked,
      onClick: function () { deleteStepOne(p); }
    }));
    body.appendChild(row);
    panel.appendChild(body);
    return panel;
  }

  function resultModal(title, text, items) {
    var body = el('div');
    body.appendChild(el('div', 'notice', text));
    if (items && items.length) {
      var wrap = el('div');
      wrap.style.marginTop = '12px';
      wrap.appendChild(C.ui.results(items));
      body.appendChild(wrap);
    }
    C.ui.modal({
      title: title,
      body: body,
      primary: { label: 'Close', onClick: function () { C.ui.closeModal(); } }
    });
  }

  function forceSignOutFlow(p) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Force sign-out · ' + p.name,
      before: [['Sessions', p.devices.length + ' device(s) signed in'], ['Account', (C.ui.STATUS[p.status] || {}).label], ['Tokens', p.tokens]],
      after: [['Sessions', '0 signed in'], ['Account', (C.ui.STATUS[p.status] || {}).label], ['Tokens', p.tokens]],
      consequence: 'Every device is signed out immediately.'
    }));
    var reason = C.ui.reasonField({ required: true, placeholder: 'e.g. Shared device reported by the player, ticket #4840' });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Force sign-out',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Force sign-out',
        onClick: function () {
          var devices = p.devices.slice();
          C.commit({
            action: 'Force sign-out',
            object: p.id,
            reason: reason.value(),
            result: devices.length + ' device session(s) ended',
            apply: function () { pushTimeline(p, 'session', 'All devices signed out by support', ''); }
          });
          C.ui.closeModal();
          resultModal('Signed out of ' + devices.length + ' device(s)',
            'Every session ended at ' + C.store.audit[0].time + '.',
            devices.map(function (d) {
              return { label: d[0], outcome: 'ok', outcomeLabel: 'Ended', detail: d[1] };
            }));
        }
      }
    });
  }

  function suspendFlow(p, suspend) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: (suspend ? 'Suspend' : 'Unsuspend') + ' · ' + p.name,
      before: [['Account', (C.ui.STATUS[p.status] || {}).label], ['Play', p.status === 'suspended' ? 'blocked' : 'allowed'], ['Boards', p.status === 'suspended' ? 'not eligible' : 'eligible']],
      after: [['Account', suspend ? 'Suspended' : 'Active'], ['Play', suspend ? 'blocked' : 'allowed'], ['Boards', suspend ? 'not eligible' : 'eligible']],
      consequence: suspend
        ? 'The player cannot sign in, solve or appear on a board.'
        : 'The player can sign in and solve again.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      placeholder: suspend ? 'e.g. Repeated abusive display names, ticket #4844' : 'e.g. Appeal upheld, ticket #4844'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: suspend ? 'Suspend account' : 'Unsuspend account',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: suspend ? 'Suspend account' : 'Unsuspend account',
        destructive: suspend,
        onClick: function () {
          C.commit({
            action: suspend ? 'Suspend account' : 'Unsuspend account',
            object: p.id,
            reason: reason.value(),
            result: suspend ? 'Account suspended · play and boards blocked' : 'Account active again',
            apply: function () {
              p.status = suspend ? 'suspended' : 'active';
              pushTimeline(p, 'session', suspend ? 'Account suspended by support' : 'Suspension lifted by support', '');
            }
          });
          C.ui.closeModal();
          C.toast(suspend ? 'Account suspended.' : 'Suspension lifted.');
        }
      }
    });
  }

  // merge — step 1: pick the duplicate
  var MIN_QUERY = 2;   // merging is destructive: make the operator name the account
  function mergePickStep(survivor) {
    var body = el('div');
    body.appendChild(el('div', 'help',
      survivor.name + ' (' + survivor.id + ') is the record that survives.'));
    var search = el('input', 'input picker-search');
    search.type = 'search';
    search.placeholder = 'Duplicate account: ID, name or sign-in';
    search.setAttribute('aria-label', 'Search for the duplicate account');
    body.appendChild(search);

    var list = el('div', 'picker-list');
    body.appendChild(list);

    function paint() {
      list.innerHTML = '';
      var q = search.value.trim().toLowerCase();
      if (q.length < MIN_QUERY) {
        list.appendChild(C.ui.emptyState('Type at least ' + MIN_QUERY + ' characters to find the duplicate.', 'Search to begin'));
        return;
      }
      var rows = C.store.players.filter(function (o) {
        return o.id !== survivor.id && !o.deletionRequested && !o.mergedInto &&
          (o.id + ' ' + o.name + ' ' + o.signIn).toLowerCase().indexOf(q) >= 0;
      });
      if (!rows.length) {
        list.appendChild(C.ui.emptyState('No other account matches “' + search.value.trim() + '”.', 'No match'));
        return;
      }
      rows.forEach(function (o) {
        var b = el('button', 'picker-item');
        b.type = 'button';
        b.appendChild(el('span', 'p-id', o.id));
        b.appendChild(el('span', 'p-title', o.name));
        b.appendChild(el('span', 'spacer'));
        b.appendChild(el('span', 'p-meta', o.tokens + ' tokens · ' + o.solved + ' solved'));
        b.appendChild(C.ui.status(o.status));
        b.addEventListener('click', function () { mergeReviewStep(survivor, o); });
        list.appendChild(b);
      });
    }
    search.addEventListener('input', paint);
    paint();

    C.ui.modal({
      title: 'Merge duplicate account',
      body: body,
      wide: true,
      secondary: { label: 'Cancel' }
    });
  }

  // merge — step 2: review which record survives
  function mergeReviewStep(survivor, dup) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Which record survives',
      before: [
        ['Surviving', survivor.name + ' · ' + survivor.id],
        ['Tokens', survivor.tokens], ['Stars', survivor.stars],
        ['Solved', survivor.solved], ['Streak', survivor.streak + ' days'],
        ['Duplicate', dup.name + ' · ' + dup.id + ' (' + dup.tokens + ' tokens, ' + dup.solved + ' solved)']
      ],
      after: [
        ['Surviving', survivor.name + ' · ' + survivor.id],
        ['Tokens', survivor.tokens + dup.tokens], ['Stars', survivor.stars + dup.stars],
        ['Solved', survivor.solved + dup.solved], ['Streak', Math.max(survivor.streak, dup.streak) + ' days'],
        ['Duplicate', dup.id + ' closed and redirected']
      ],
      consequence: dup.id + ' is closed and its sign-in resolves to ' + survivor.id + '. This cannot be undone.'
    }));
    var reason = C.ui.reasonField({ required: true, placeholder: 'e.g. Player created a second account with Google, ticket #4851' });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Merge ' + dup.id + ' into ' + survivor.id,
      body: body,
      wide: true,
      secondary: { label: 'Back', onClick: function () { mergePickStep(survivor); } },
      primary: {
        label: 'Merge accounts',
        destructive: true,
        onClick: function () {
          C.commit({
            action: 'Merge duplicate account',
            object: survivor.id,
            reason: reason.value(),
            result: dup.id + ' merged into ' + survivor.id + ' · ' + (survivor.tokens + dup.tokens) + ' tokens, ' + (survivor.solved + dup.solved) + ' solved',
            apply: function () {
              survivor.tokens += dup.tokens;
              survivor.stars += dup.stars;
              survivor.solved += dup.solved;
              survivor.streak = Math.max(survivor.streak, dup.streak);
              dup.mergedInto = survivor.id;
              dup.status = 'suspended';
              dup.tokens = 0; dup.stars = 0;
              pushTimeline(survivor, 'session', 'Duplicate account ' + dup.id + ' merged in', '');
              pushTimeline(dup, 'session', 'Merged into ' + survivor.id + ' and closed', '');
            }
          });
          C.ui.closeModal();
          resultModal('Accounts merged',
            dup.id + ' is closed. ' + survivor.id + ' holds the combined totals.',
            [
              { label: 'Tokens', outcome: 'ok', outcomeLabel: 'Moved', detail: survivor.tokens + ' on ' + survivor.id },
              { label: 'Stars', outcome: 'ok', outcomeLabel: 'Moved', detail: survivor.stars + ' on ' + survivor.id },
              { label: 'Solved games', outcome: 'ok', outcomeLabel: 'Moved', detail: survivor.solved + ' total' },
              { label: 'Purchases and receipts', outcome: 'skipped', outcomeLabel: 'Kept', detail: 'stay with the original receipt' }
            ]);
        }
      }
    });
  }

  // delete — step 1: reason
  function deleteStepOne(p) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Delete on request · ' + p.name,
      before: [['Account', (C.ui.STATUS[p.status] || {}).label], ['Solve history', p.solved + ' games'], ['Balances', p.tokens + ' tokens, ' + p.stars + ' stars']],
      after: [['Account', 'Deletion pending'], ['Solve history', 'erased within 30 days'], ['Balances', 'forfeited, no refund']],
      consequence: 'The record is locked now and erased within 30 days. This cannot be undone.'
    }));
    var reason = C.ui.reasonField({ required: true, placeholder: 'e.g. Player exercised the right to erasure, ticket #4860' });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Delete on request',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Continue to confirmation',
        destructive: true,
        onClick: function () { deleteStepTwo(p, reason.value()); }
      }
    });
  }

  // delete — step 2: type the player id
  function deleteStepTwo(p, reasonText) {
    var typed = '';
    var body = el('div');

    var frow = el('div', 'form-row');
    var lab = el('label', 'label', 'Type ' + p.id + ' to confirm');
    lab.appendChild(el('span', 'req', 'required'));
    frow.appendChild(lab);
    var input = el('input', 'input');
    input.placeholder = p.id;
    input.setAttribute('aria-label', 'Type the player ID to confirm deletion');
    input.addEventListener('input', function () { typed = input.value.trim(); C.ui.refreshModal(); });
    frow.appendChild(input);
    frow.appendChild(el('div', 'help', 'Reason on record: “' + reasonText + '”'));
    body.appendChild(frow);

    C.ui.modal({
      title: 'Confirm deletion of ' + p.id,
      body: body,
      secondary: { label: 'Back', onClick: function () { deleteStepOne(p); } },
      primary: {
        label: 'Delete on request',
        destructive: true,
        disabled: function () { return typed !== p.id; },
        onClick: function () {
          C.commit({
            action: 'Delete on request',
            object: p.id,
            reason: reasonText,
            result: 'Deletion accepted · record locked, erased by Oct 8, 2026',
            apply: function () {
              p.deletionRequested = { when: 'Sep 8, 2026', by: 'Oct 8, 2026' };
              p.status = 'suspended';
              pushTimeline(p, 'session', 'Deletion on request accepted; record locked', '');
            }
          });
          C.ui.closeModal();
          resultModal('Deletion accepted',
            'The record is locked now and is erased by Oct 8, 2026.',
            [
              { label: 'Account access', outcome: 'ok', outcomeLabel: 'Locked', detail: 'sign-in blocked now' },
              { label: 'Profile and solve history', outcome: 'ok', outcomeLabel: 'Queued', detail: 'erased by Oct 8, 2026' },
              { label: 'Purchase receipts', outcome: 'skipped', outcomeLabel: 'Kept', detail: 'retained for tax records' }
            ]);
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // timeline, devices & ads, notes
  // ------------------------------------------------------------------

  var KIND = {
    solve: { label: 'Solve', color: 'var(--green)' },
    session: { label: 'Session', color: 'var(--ink-55)' },
    ledger: { label: 'Ledger', color: 'var(--gold)' },
    flag: { label: 'Flag', color: 'var(--pink)' }
  };

  function timelineTab(mount, p) {
    var wrap = el('div', 'pl-pad');
    wrap.appendChild(el('div', 'eyebrow', 'Newest first'));

    var list = el('div');
    list.style.marginTop = '8px';
    p.timeline.forEach(function (t) {
      var kind = KIND[t[1]] || { label: t[1], color: 'var(--ink-55)' };
      var row = el('div', 'pl-tl');
      row.appendChild(el('span', 'pl-tl-when', t[0]));
      var k = el('span', 'pl-tl-kind', kind.label);
      k.style.color = kind.color;
      row.appendChild(k);
      row.appendChild(el('span', 'pl-tl-text', t[2]));
      if (t[1] === 'flag') {
        var link = C.ui.button('Open in Leaderboards', {
          variant: 'quiet', small: true,
          onClick: function () { C.go('#/leaderboards'); }
        });
        row.appendChild(link);
      } else {
        row.appendChild(el('span'));
      }
      var amt = el('span', 'pl-tl-amt', t[3] || '');
      if (t[3]) amt.style.color = String(t[3]).charAt(0) === '+' ? 'var(--green)' : 'var(--pink)';
      row.appendChild(amt);
      list.appendChild(row);
    });
    if (!p.timeline.length) list.appendChild(C.ui.emptyState('This player has no recorded activity yet.'));
    wrap.appendChild(list);
    mount.appendChild(wrap);
  }

  function devicesTab(mount, p) {
    var wrap = el('div', 'pl-pad');
    wrap.appendChild(el('div', 'eyebrow', 'Devices · ' + p.devices.length + ' signed in'));
    var t = el('div');
    t.style.marginTop = '8px';
    t.appendChild(C.ui.table({
      cols: [
        { key: 'name', label: 'Device' },
        { key: 'app', label: 'App and OS' },
        { key: 'seen', label: 'Last seen', align: 'right' }
      ],
      rows: p.devices.map(function (d) { return { name: d[0], app: d[1], seen: d[2] }; }),
      empty: 'No device has signed in to this account.'
    }));
    wrap.appendChild(t);

    wrap.appendChild(C.ui.button('Force sign-out of every device', {
      small: true, disabled: accountLocked(p) || !p.devices.length,
      onClick: function () { forceSignOutFlow(p); }
    }));

    var ads = el('div');
    ads.style.marginTop = '18px';
    ads.appendChild(el('div', 'eyebrow', 'Ads and consent · read only'));
    var rows = el('div');
    rows.style.marginTop = '8px';
    p.ads.forEach(function (a) {
      var r = el('div', 'pl-ad');
      var dot = el('span', 'l-dot');
      dot.style.background = a[2] === 'ok' ? 'var(--green)' : a[2] === 'bad' ? 'var(--pink)' : 'var(--ink-35)';
      r.appendChild(dot);
      r.appendChild(el('span', 'pl-ad-label', a[0]));
      r.appendChild(el('span', 'spacer'));
      r.appendChild(el('span', 'pl-ad-detail', a[1]));
      rows.appendChild(r);
    });
    ads.appendChild(rows);
    wrap.appendChild(ads);
    mount.appendChild(wrap);
  }

  function notesTab(mount, p) {
    var wrap = el('div', 'pl-pad');
    var head = el('div', 'btn-row');
    head.appendChild(el('div', 'eyebrow', 'Support notes · internal only'));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.button('Add note', { variant: 'pink', small: true, onClick: function () { addNoteFlow(p); } }));
    wrap.appendChild(head);

    var list = el('div');
    list.style.marginTop = '10px';
    if (!p.notes.length) {
      list.appendChild(C.ui.emptyState('No support note on this record yet.'));
    }
    p.notes.forEach(function (n) {
      var card = el('div', 'pl-note');
      var meta = el('div', 'pl-note-meta');
      meta.appendChild(el('span', null, n.author));
      meta.appendChild(el('span', null, n.when));
      meta.appendChild(el('span', 'spacer'));
      meta.appendChild(C.ui.status(n.status));
      card.appendChild(meta);
      card.appendChild(el('div', 'pl-note-text', n.text));
      if (n.status === 'open') {
        var foot = el('div', 'btn-row');
        foot.style.marginTop = '8px';
        foot.appendChild(C.ui.button('Close note', {
          small: true,
          onClick: function () { closeNoteFlow(p, n); }
        }));
        card.appendChild(foot);
      }
      list.appendChild(card);
    });
    wrap.appendChild(list);
    mount.appendChild(wrap);
  }

  function addNoteFlow(p) {
    var text = '';
    var status = 'open';
    var body = el('div');

    var frow = el('div', 'form-row');
    var lab = el('label', 'label', 'Note');
    lab.appendChild(el('span', 'req', 'required'));
    frow.appendChild(lab);
    var ta = el('textarea', 'textarea');
    ta.placeholder = 'What the player asked for, what you did, and what the next agent should know.';
    ta.addEventListener('input', function () { text = ta.value.trim(); C.ui.refreshModal(); });
    frow.appendChild(ta);
    body.appendChild(frow);

    var srow = el('div', 'form-row');
    srow.appendChild(el('div', 'label', 'Status'));
    var segHolder = el('div');
    srow.appendChild(segHolder);
    function paintSeg() {
      segHolder.innerHTML = '';
      segHolder.appendChild(C.ui.segmented(
        [{ key: 'open', label: 'Open' }, { key: 'closed', label: 'Closed' }],
        status,
        function (k) { status = k; paintSeg(); }
      ));
    }
    paintSeg();
    body.appendChild(srow);

    C.ui.modal({
      title: 'Add support note',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Save note',
        disabled: function () { return !text; },
        onClick: function () {
          C.commit({
            action: 'Add support note',
            object: p.id,
            reason: '',
            result: 'Note added · ' + (status === 'open' ? 'Open' : 'Closed'),
            apply: function () {
              p.notes.unshift({
                id: 'n_' + Math.random().toString(36).slice(2, 7),
                author: (C.store.session.operator && C.store.session.operator.handle) || 'unknown',
                when: stampTime(),
                text: text,
                status: status
              });
              st().tab = 'notes';
            }
          });
          C.ui.closeModal();
          C.toast('Note added.');
        }
      }
    });
  }

  function closeNoteFlow(p, note) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Close note',
      before: [['Status', 'Open'], ['Author', note.author], ['Opened', note.when]],
      after: [['Status', 'Closed'], ['Author', note.author], ['Closed by', (C.store.session.operator && C.store.session.operator.handle) || 'unknown']],
      consequence: 'The note stays on the record.'
    }));
    C.ui.modal({
      title: 'Close note',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Close note',
        onClick: function () {
          C.commit({
            action: 'Close support note',
            object: p.id,
            reason: '',
            result: 'Note closed · “' + note.text.slice(0, 48) + (note.text.length > 48 ? '…' : '') + '”',
            apply: function () { note.status = 'closed'; st().tab = 'notes'; }
          });
          C.ui.closeModal();
          C.toast('Note closed.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // record assembly
  // ------------------------------------------------------------------

  function recordScreen(mount, params) {
    var p = C.find.player(params.id);
    if (!p) {
      mount.appendChild(C.ui.emptyState(
        'No player has the ID ' + params.id + '.', 'Not found'));
      var row = el('div', 'pl-pad');
      row.appendChild(C.ui.button('Back to players', { variant: 'pink', onClick: function () { C.go('#/players'); } }));
      mount.appendChild(row);
      return;
    }

    mount.appendChild(statStrip(p));
    var bannerWrap = el('div', 'pl-banners');
    banners(bannerWrap, p);
    if (bannerWrap.children.length) mount.appendChild(bannerWrap);

    var tab = st().tab;
    mount.appendChild(C.ui.tabs(
      [
        { key: 'profile', label: 'Profile' },
        { key: 'timeline', label: 'Timeline' },
        { key: 'devices', label: 'Devices & ads' },
        { key: 'notes', label: 'Notes' + (p.notes.filter(function (n) { return n.status === 'open'; }).length ? ' · ' + p.notes.filter(function (n) { return n.status === 'open'; }).length + ' open' : '') }
      ],
      tab,
      function (k) { st().tab = k; st().editField = null; C.render(); }
    ));

    if (tab === 'profile') profileTab(mount, p);
    else if (tab === 'timeline') timelineTab(mount, p);
    else if (tab === 'devices') devicesTab(mount, p);
    else notesTab(mount, p);

    var audit = C.store.audit.filter(function (a) { return a.object === p.id; });
    var foot = el('div', 'pl-pad rule-top');
    foot.appendChild(el('div', 'eyebrow', 'Audit · this record'));
    var al = el('div', 'audit-list');
    al.style.marginTop = '8px';
    if (!audit.length) al.appendChild(el('div', 'help', 'No changes on this record yet.'));
    audit.forEach(function (a) { al.appendChild(C.ui.auditLine(a)); });
    foot.appendChild(al);
    mount.appendChild(foot);
  }

  // ------------------------------------------------------------------
  // registration
  // ------------------------------------------------------------------

  C.registerScreen('#/players', {
    title: 'Players',
    subline: function () { return C.store.players.length + ' players'; },
    actions: function () {
      return C.ui.button('Clear filter', {
        small: true,
        disabled: !st().q,
        onClick: function () { st().q = ''; C.render(); }
      });
    },
    render: function (mount) { listScreen(mount); }
  });

  C.registerScreen('#/players/:id', {
    title: function (params) {
      var p = C.find.player(params.id);
      return p ? p.name : 'Player not found';
    },
    subline: function (params) {
      var p = C.find.player(params.id);
      return p ? params.id : params.id + ' · no such record';
    },
    actions: function () {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.button('Search another player', {
        variant: 'quiet',
        onClick: function () { st().editField = null; C.go('#/players'); }
      }));
      return row;
    },
    render: function (mount, params) { recordScreen(mount, params); }
  });

  // ------------------------------------------------------------------
  // screen-specific styles
  // ------------------------------------------------------------------

  var css = document.createElement('style');
  css.textContent = [
    '.pl-bar{display:flex;align-items:center;gap:14px;padding:12px var(--pad-x);',
    'border-bottom:1px solid var(--rule);background:var(--cream)}',
    '.pl-bar .input{max-width:300px;margin:0}',
    '.pl-count{font:700 11px var(--mono);color:var(--pink);white-space:nowrap}',
    '.pl-table{min-width:0}',
    '.pl-table .tbl td.nowrap{white-space:nowrap}',
    '.pl-cell-name{display:inline-flex;align-items:center;gap:10px;min-width:0}',
    '.pl-avatar{width:28px;height:28px;border-radius:4px;flex:none;background:var(--ink);color:var(--paper);',
    'display:flex;align-items:center;justify-content:center;font:800 11px var(--sans)}',
    '.pl-avatar.lg{width:42px;height:42px;font-size:15px}',
    '.pl-head{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:16px var(--pad-x);',
    'border-bottom:1px solid var(--rule);background:var(--paper)}',
    '.pl-head-id{display:flex;align-items:center;gap:12px;min-width:0}',
    '.pl-name{font:800 17px var(--sans)}',
    '.pl-sub{font:500 11px var(--mono);color:var(--ink-55)}',
    '.pl-stat{display:flex;flex-direction:column;gap:2px;min-width:74px}',
    '.pl-stat-value{font:800 18px var(--sans)}',
    '.pl-banners{display:flex;flex-direction:column;gap:8px;padding:12px var(--pad-x) 0}',
    '.pl-pad{padding:14px var(--pad-x) 20px;min-width:0}',
    '.pl-edit{margin-top:8px}',
    '.pl-edit + .field{margin-top:8px}',
    '.pl-tl{display:grid;grid-template-columns:100px 74px minmax(0,1fr) auto 70px;gap:12px;align-items:center;',
    'padding:9px 0;border-bottom:1px solid var(--rule-soft)}',
    '.pl-tl-when{font:500 11px var(--mono);color:var(--ink-55)}',
    '.pl-tl-kind{font:700 10px var(--mono);letter-spacing:.06em;text-transform:uppercase}',
    '.pl-tl-text{font:500 12px var(--sans);min-width:0}',
    '.pl-tl-amt{text-align:right;font:700 12px var(--mono)}',
    '.pl-ad{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--rule-soft)}',
    '.pl-ad .l-dot{width:7px;height:7px;border-radius:50%;flex:none}',
    '.pl-ad-label{font:600 12px var(--sans)}',
    '.pl-ad-detail{font:500 11px var(--mono);color:var(--ink-55)}',
    '.pl-note{border:1px solid var(--rule);border-radius:5px;background:var(--cream);padding:11px 13px}',
    '.pl-note + .pl-note{margin-top:10px}',
    '.pl-note-meta{display:flex;gap:10px;align-items:center;font:500 11px var(--mono);color:var(--ink-55)}',
    '.pl-note-text{font:500 13px/1.45 var(--sans);margin-top:4px}',
    '@media (max-width:1240px){.pl-bar .input{max-width:220px}}'
  ].join('');
  document.head.appendChild(css);
})(window.Console);
