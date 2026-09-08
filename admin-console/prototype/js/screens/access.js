/* Access — operator accounts, roles and environment (C2).
   OWNER: access builder. Route: #/access (role: console_admin). */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.access = { editing: null };

  // ------------------------------------------------------------------
  // role reference — labels come from Console.data.roles, areas from Console.nav
  // ------------------------------------------------------------------

  var ROLE_ORDER = [
    'content_editor', 'publisher', 'support', 'integrity',
    'economy', 'ads', 'operations', 'console_admin'
  ];

  var ROLE_NOTE = {
    content_editor: 'Creates, edits, validates and approves games. Never schedules a drop and never sees player data.',
    publisher: 'Fills daily slots, sets the publish time and curates collections. Never edits game content.',
    support: 'Looks up one player at a time, edits profile fields and runs support actions, always with a reason.',
    integrity: 'Decides flagged solves and board eligibility. Reward decisions stay with the economy admin.',
    economy: 'Inspects the ledger and purchases and appends compensating entries. Never overwrites a balance.',
    ads: 'Enables or pauses placements and edits caps, rewards and first-session grace. Campaigns stay in AdMob.',
    operations: 'Triages job signals, retries failed runs and reviews import batches. Makes no content or player changes.',
    console_admin: 'Manages operator accounts, roles and the audit log. Does no domain work of its own.'
  };

  function roleLabel(id) {
    return (C.data.roles[id] && C.data.roles[id].label) || id;
  }

  /* Areas a role unlocks, as navigation labels plus the routes behind them. */
  function areasFor(role) {
    return C.nav.filter(function (n) { return n.roles.indexOf(role) >= 0; });
  }

  function roleNames(roles) {
    return roles.map(roleLabel).join(', ');
  }

  function rolePills(roles) {
    var wrap = el('div', 'acc-pills');
    if (!roles.length) {
      wrap.appendChild(el('span', 'acc-norole', 'No roles — this operator sees nothing'));
      return wrap;
    }
    ROLE_ORDER.filter(function (r) { return roles.indexOf(r) >= 0; }).forEach(function (r) {
      wrap.appendChild(C.ui.pill(r, roleLabel(r)));
    });
    return wrap;
  }

  function isSelf(op) {
    var me = C.store.session.operator;
    return !!(me && me.id === op.id);
  }

  /* First route the signed-in operator may still open. Used after an operator
     edits away their own console_admin role, so the console does not dead-end. */
  function firstAllowedRoute() {
    var entry = C.nav.filter(function (n) { return n.roles.some(C.hasRole); })[0];
    return entry ? entry.route : '#/signin';
  }

  // ------------------------------------------------------------------
  // environment
  // ------------------------------------------------------------------

  function environmentSection() {
    var wrap = el('div', 'screen-pad');
    var head = el('div', 'section-head');
    head.appendChild(el('div', 'section-title', 'Environment'));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(el('div', 'panel-note', 'Chosen at sign-in. Sign out to move to another environment.'));
    wrap.appendChild(head);

    var current = C.store.session.environment;
    var cards = el('div', 'cards-3');
    C.store.environments.forEach(function (env) {
      var card = el('div', 'stat' + (env.id === current ? ' acc-env-on' : ''));
      var top = el('div', 'acc-env-top');
      var value = el('div', 'stat-value', env.label);
      top.appendChild(value);
      top.appendChild(el('div', 'spacer'));
      top.appendChild(env.id === current
        ? C.ui.pill('active', 'Current environment')
        : C.ui.pill('not_run', 'Not signed in'));
      card.appendChild(top);
      card.appendChild(el('div', 'stat-note', env.note));
      cards.appendChild(card);
    });
    wrap.appendChild(cards);
    return wrap;
  }

  // ------------------------------------------------------------------
  // operators table
  // ------------------------------------------------------------------

  function operatorsSection() {
    var wrap = el('div', 'screen-pad rule-top');
    var head = el('div', 'section-head');
    head.appendChild(el('div', 'section-title', 'Operators'));
    head.appendChild(el('div', 'spacer'));
    var active = C.store.operators.filter(function (o) { return o.status !== 'suspended'; }).length;
    head.appendChild(el('div', 'panel-note',
      active + ' active · ' + C.store.operators.length + ' accounts · ' + C.store.environments.filter(function (e) {
        return e.id === C.store.session.environment;
      })[0].label + ' environment'));
    wrap.appendChild(head);

    wrap.appendChild(C.ui.table({
      cols: [
        { key: 'handle', label: 'Handle', cls: 'cell-id', width: '110px' },
        {
          key: 'name', label: 'Name', width: '150px', render: function (o) {
            var n = el('span', 'cell-title', o.name);
            if (isSelf(o)) {
              var you = el('span', 'acc-you', 'you');
              var box = el('span', 'acc-name-cell');
              box.appendChild(n);
              box.appendChild(you);
              return box;
            }
            return n;
          }
        },
        { key: 'roles', label: 'Roles', render: function (o) { return rolePills(o.roles); } },
        {
          key: 'lastSignIn', label: 'Last sign-in', width: '130px', render: function (o) {
            return el('span', 'mono acc-when', isSelf(o) ? 'Now · this session' : (o.lastSignIn || 'Never'));
          }
        },
        {
          key: 'status', label: 'Status', width: '110px', render: function (o) {
            return C.ui.status(o.status || 'active');
          }
        },
        {
          key: 'act', label: '', align: 'right', width: '190px', render: function (o) {
            var row = el('div', 'btn-row acc-row-actions');
            row.appendChild(C.ui.button('Edit', {
              small: true,
              onClick: function (e) { e.stopPropagation(); operatorDialog(o); }
            }));
            var suspended = o.status === 'suspended';
            row.appendChild(C.ui.button(suspended ? 'Reactivate' : 'Deactivate', {
              small: true,
              variant: suspended ? 'quiet' : 'danger',
              disabled: !suspended && isSelf(o),
              onClick: function (e) {
                e.stopPropagation();
                if (suspended) reactivateDialog(o); else deactivateDialog(o);
              }
            }));
            return row;
          }
        }
      ],
      rows: C.store.operators,
      onRowClick: function (o) { operatorDialog(o); },
      empty: 'No operator accounts exist in this environment.'
    }));

    var foot = el('div', 'table-foot');
    foot.appendChild(el('span', null, 'A row opens the operator dialog. You cannot deactivate your own account.'));
    wrap.appendChild(foot);
    return wrap;
  }

  // ------------------------------------------------------------------
  // role matrix
  // ------------------------------------------------------------------

  function matrixSection() {
    var wrap = el('div', 'screen-pad rule-top');
    var head = el('div', 'section-head');
    head.appendChild(el('div', 'section-title', 'Role matrix'));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(el('div', 'panel-note', 'Navigation hides every area a role does not unlock. A direct link to a forbidden area explains itself instead of rendering.'));
    wrap.appendChild(head);

    wrap.appendChild(C.ui.table({
      cols: [
        {
          key: 'role', label: 'Role', width: '150px', render: function (r) {
            return el('span', 'cell-title', roleLabel(r.role));
          }
        },
        {
          key: 'areas', label: 'Areas it unlocks', width: '260px', render: function (r) {
            var box = el('div', 'acc-pills');
            areasFor(r.role).forEach(function (n) {
              var chip = el('span', 'chip chip-sm', n.label);
              box.appendChild(chip);
            });
            var routes = el('div', 'acc-routes', areasFor(r.role).map(function (n) {
              return n.area === 'library' ? '#/library, #/library/:id'
                : n.area === 'players' ? '#/players, #/players/:id'
                  : n.route;
            }).join('  '));
            var col = el('div', 'acc-area-cell');
            col.appendChild(box);
            col.appendChild(routes);
            return col;
          }
        },
        {
          key: 'note', label: 'What the role does', render: function (r) {
            return el('span', 'acc-note', ROLE_NOTE[r.role]);
          }
        },
        {
          key: 'held', label: 'Held by', align: 'right', width: '150px', render: function (r) {
            var who = C.store.operators.filter(function (o) { return o.roles.indexOf(r.role) >= 0; });
            if (!who.length) return el('span', 'muted', 'No operator');
            return el('span', 'mono acc-when', who.map(function (o) { return o.handle; }).join(', '));
          }
        }
      ],
      rows: ROLE_ORDER.map(function (r) { return { id: r, role: r }; }),
      empty: 'No roles are defined.'
    }));
    return wrap;
  }

  // ------------------------------------------------------------------
  // C2 — invite operator / edit operator roles
  // ------------------------------------------------------------------

  function roleChecks(selected, onToggle) {
    var box = el('div');
    ROLE_ORDER.forEach(function (r) {
      var on = selected.indexOf(r) >= 0;
      var row = el('button', 'check-row acc-role-row' + (on ? ' is-on' : ''));
      row.type = 'button';
      row.setAttribute('aria-pressed', String(on));
      var mark = el('span', 'checkbox' + (on ? ' is-on' : ''), on ? '✓' : '');
      row.appendChild(mark);
      var text = el('div', 'check-row-text');
      var label = el('div', 'check-row-label', roleLabel(r));
      text.appendChild(label);
      text.appendChild(el('div', 'check-row-detail', ROLE_NOTE[r]));
      text.appendChild(el('div', 'acc-routes', 'Unlocks ' + (areasFor(r).map(function (n) { return n.label; }).join(', ') || 'nothing yet')));
      row.appendChild(text);
      row.addEventListener('click', function () { onToggle(r); });
      box.appendChild(row);
    });
    return box;
  }

  function handleTaken(handle, exceptId) {
    return C.store.operators.some(function (o) {
      return o.handle.toLowerCase() === handle.toLowerCase() && o.id !== exceptId;
    });
  }

  /* operatorDialog(op) — op is an existing record, or null to invite. */
  function operatorDialog(op) {
    var inviting = !op;
    var draft = {
      handle: inviting ? '' : op.handle,
      name: inviting ? '' : op.name,
      roles: inviting ? [] : op.roles.slice()
    };
    var before = inviting ? [] : op.roles.slice();

    var body = el('div');

    // identity ------------------------------------------------------
    var identity = el('div', 'form-row');
    if (inviting) {
      var hLab = el('label', 'label', 'Handle');
      hLab.appendChild(el('span', 'req', 'required'));
      identity.appendChild(hLab);
      var hIn = el('input', 'input');
      hIn.type = 'text';
      hIn.placeholder = 'e.g. r.kaminska';
      hIn.setAttribute('aria-label', 'Operator handle');
      identity.appendChild(hIn);
      var hHelp = el('div', 'help', 'The handle is the audit identity. It cannot be changed once the account exists.');
      identity.appendChild(hHelp);
      hIn.addEventListener('input', function () {
        draft.handle = hIn.value.trim();
        hHelp.textContent = draft.handle && handleTaken(draft.handle, null)
          ? 'That handle already belongs to another operator. Pick a different one.'
          : 'The handle is the audit identity. It cannot be changed once the account exists.';
        C.ui.refreshModal();
      });

      var nLab = el('label', 'label', 'Name');
      nLab.appendChild(el('span', 'req', 'required'));
      identity.appendChild(nLab);
      var nIn = el('input', 'input');
      nIn.type = 'text';
      nIn.placeholder = 'e.g. Roksolana Kaminska';
      nIn.setAttribute('aria-label', 'Operator name');
      identity.appendChild(nIn);
      nIn.addEventListener('input', function () { draft.name = nIn.value.trim(); C.ui.refreshModal(); });
    } else {
      identity.appendChild(C.ui.field({ label: 'Handle', value: op.handle, editable: false }));
      identity.appendChild(C.ui.field({ label: 'Account', value: op.id + ' · invited by ' + (op.invitedBy || 'unknown') + ' · ' + (op.invitedOn || 'unknown date'), editable: false }));
      var nameWrap = el('div', 'form-row');
      nameWrap.style.marginTop = '10px';
      nameWrap.appendChild(el('label', 'label', 'Name'));
      var nEdit = el('input', 'input');
      nEdit.type = 'text';
      nEdit.value = op.name;
      nEdit.setAttribute('aria-label', 'Operator name');
      nEdit.addEventListener('input', function () {
        draft.name = nEdit.value.trim();
        repaint();
        C.ui.refreshModal();
      });
      nameWrap.appendChild(nEdit);
      identity.appendChild(nameWrap);
    }
    body.appendChild(identity);

    // roles + review ------------------------------------------------
    var dyn = el('div');
    body.appendChild(dyn);

    var reason = C.ui.reasonField({
      required: false,
      label: 'Reason (optional)',
      placeholder: inviting ? 'e.g. New editor joining the Ukrainian desk' : 'e.g. Taking over the ads rota from t.baros',
      help: 'Role changes are always audited. A reason makes the entry easier to read later.'
    });
    body.appendChild(reason);

    function added() { return draft.roles.filter(function (r) { return before.indexOf(r) < 0; }); }
    function removed() { return before.filter(function (r) { return draft.roles.indexOf(r) < 0; }); }
    function changed() {
      return inviting || added().length || removed().length || (draft.name && draft.name !== op.name);
    }

    function ordered(list) {
      return ROLE_ORDER.filter(function (r) { return list.indexOf(r) >= 0; });
    }

    function repaint() {
      dyn.innerHTML = '';
      var lab = el('div', 'label', 'Roles');
      lab.appendChild(el('span', 'req', 'at least one'));
      dyn.appendChild(lab);
      dyn.appendChild(roleChecks(draft.roles, function (r) {
        var at = draft.roles.indexOf(r);
        if (at >= 0) draft.roles.splice(at, 1); else draft.roles.push(r);
        repaint();
        C.ui.refreshModal();
      }));

      var review = el('div');
      review.style.marginTop = '16px';
      review.appendChild(C.ui.reviewPanel({
        title: inviting ? 'Review the invitation' : 'Review the role change',
        before: inviting
          ? [['Account', 'Does not exist yet'], ['Roles', 'None'], ['Areas', 'None']]
          : [['Roles', ordered(before).map(roleLabel).join(', ') || 'None'],
          ['Areas', areaCount(before) + ' of ' + C.nav.length], ['Name', op.name]],
        after: [
          ['Roles', ordered(draft.roles).map(roleLabel).join(', ') || 'None'],
          ['Areas', areaCount(draft.roles) + ' of ' + C.nav.length],
          ['Name', draft.name || (inviting ? '—' : op.name)]
        ],
        consequence: consequence()
      }));
      dyn.appendChild(review);
    }

    function areaCount(roles) {
      return C.nav.filter(function (n) {
        return n.roles.some(function (r) { return roles.indexOf(r) >= 0; });
      }).length;
    }

    function consequence() {
      if (inviting) {
        return 'The account appears on the sign-in screen immediately. No email is sent from this prototype.';
      }
      var lines = [];
      if (added().length) lines.push('Gains ' + ordered(added()).map(roleLabel).join(', ') + '.');
      if (removed().length) lines.push('Loses ' + ordered(removed()).map(roleLabel).join(', ') + '.');
      if (isSelf(op)) {
        lines.push(removed().indexOf('console_admin') >= 0
          ? 'This is your own account: you lose Access and Audit log the moment you save, and the console moves you to the first area you can still open. Sign in as another console admin to get them back.'
          : 'This is your own account: your navigation changes as soon as you save.');
      } else {
        lines.push('The change applies the next time ' + op.handle + ' loads a screen.');
      }
      return lines.join(' ');
    }

    repaint();

    C.ui.modal({
      title: inviting ? 'Invite operator' : 'Edit operator · ' + op.handle,
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: inviting ? 'Invite operator' : 'Save roles',
        disabled: function () {
          if (!draft.roles.length) return true;
          if (inviting) return !draft.handle || !draft.name || handleTaken(draft.handle, null);
          return !changed() || !draft.name;
        },
        onClick: function () {
          var list = ordered(draft.roles).map(roleLabel).join(', ');
          if (inviting) {
            var id = 'op_' + draft.handle.replace(/[^a-z0-9]/gi, '').toLowerCase();
            var record = {
              id: id, handle: draft.handle, name: draft.name, roles: ordered(draft.roles),
              note: 'Invited from the console on ' + C.store.todayLabel + '.',
              lastSignIn: 'Never', status: 'active',
              invitedBy: C.store.session.operator.handle, invitedOn: 'Sep 8 2026'
            };
            C.commit({
              action: 'Invite operator',
              object: draft.handle,
              reason: reason.value(),
              result: 'Invited with ' + draft.roles.length + ' role' + (draft.roles.length === 1 ? '' : 's') + ': ' + list,
              apply: function (store) { store.operators.push(record); }
            });
            C.ui.closeModal();
            C.toast('Invited ' + draft.handle + '.');
            return;
          }

          var self = isSelf(op);
          var losesAdmin = self && removed().indexOf('console_admin') >= 0;
          var next = ordered(draft.roles);
          var nextName = draft.name;
          C.commit({
            action: 'Change operator roles',
            object: op.handle,
            reason: reason.value(),
            result: 'Roles now ' + list
              + (added().length ? ' · added ' + ordered(added()).map(roleLabel).join(', ') : '')
              + (removed().length ? ' · removed ' + ordered(removed()).map(roleLabel).join(', ') : ''),
            apply: function (store) {
              var rec = C.find.operator(op.id);
              rec.roles = next;
              rec.name = nextName;
              /* The session holds the same record object the store holds, so a
                 role change to the signed-in operator is live immediately. If a
                 future app.js copies the operator into the session, mirror it
                 here as well. */
              if (store.session.operator && store.session.operator.id === rec.id) {
                store.session.operator = rec;
              }
            },
            silent: losesAdmin
          });
          C.ui.closeModal();
          if (losesAdmin) {
            C.toast('Roles saved. You no longer hold Console admin.');
            C.go(firstAllowedRoute());
          } else {
            C.toast('Roles saved for ' + op.handle + '.');
          }
        }
      }
    });
  }

  function deactivateDialog(op) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Deactivate ' + op.handle,
      before: [['Status', 'Active'], ['Roles', op.roles.map(roleLabel).join(', ')], ['Last sign-in', op.lastSignIn || 'Never']],
      after: [['Status', 'Suspended'], ['Roles', 'Kept, but inert'], ['Last sign-in', op.lastSignIn || 'Never']],
      consequence: 'The account can no longer sign in. Its roles and its audit history are kept so past entries stay readable, and a console admin can reactivate it.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      placeholder: 'e.g. Left the team on Sep 5, access review #12'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Deactivate operator',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Deactivate operator',
        destructive: true,
        onClick: function () {
          C.commit({
            action: 'Deactivate operator',
            object: op.handle,
            reason: reason.value(),
            result: 'Status suspended; sign-in blocked, ' + op.roles.length + ' roles kept for audit history',
            apply: function () { C.find.operator(op.id).status = 'suspended'; }
          });
          C.ui.closeModal();
          C.toast(op.handle + ' deactivated.');
        }
      }
    });
  }

  function reactivateDialog(op) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Reactivate ' + op.handle,
      before: [['Status', 'Suspended'], ['Roles', op.roles.map(roleLabel).join(', ')]],
      after: [['Status', 'Active'], ['Roles', op.roles.map(roleLabel).join(', ')]],
      consequence: 'The account can sign in again with exactly the roles it held before. Review those roles if the person has changed team.'
    }));
    var reason = C.ui.reasonField({
      required: false,
      label: 'Reason (optional)',
      placeholder: 'e.g. Returned from leave'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Reactivate operator',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Reactivate operator',
        onClick: function () {
          C.commit({
            action: 'Reactivate operator',
            object: op.handle,
            reason: reason.value(),
            result: 'Status active; roles restored: ' + op.roles.map(roleLabel).join(', '),
            apply: function () { C.find.operator(op.id).status = 'active'; }
          });
          C.ui.closeModal();
          C.toast(op.handle + ' reactivated.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // screen
  // ------------------------------------------------------------------

  C.registerScreen('#/access', {
    title: 'Access',
    subline: function () {
      return C.store.operators.length + ' operator accounts · 8 roles · every change is audited';
    },
    actions: function () {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.densitySwitch());
      row.appendChild(C.ui.button('Audit log', { onClick: function () { C.go('#/audit'); } }));
      row.appendChild(C.ui.button('Invite operator', {
        variant: 'pink',
        onClick: function () { operatorDialog(null); }
      }));
      return row;
    },
    render: function (mount) {
      mount.appendChild(environmentSection());
      mount.appendChild(operatorsSection());
      mount.appendChild(matrixSection());
    }
  });

  // ------------------------------------------------------------------
  // screen-specific styles
  // ------------------------------------------------------------------

  var style = document.createElement('style');
  style.textContent = [
    '.acc-pills{display:flex;flex-wrap:wrap;gap:4px}',
    '.acc-role-row{width:100%;text-align:left;font:inherit;color:inherit}',
    '.acc-norole{font:500 12px var(--sans);color:var(--pink)}',
    '.acc-name-cell{display:flex;align-items:baseline;gap:7px;min-width:0}',
    '.acc-you{font:700 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--pink)}',
    '.acc-when{font-size:11px;color:var(--ink-65);white-space:nowrap}',
    '.acc-note{font:400 12px/1.45 var(--sans);color:var(--ink-65)}',
    '.acc-routes{font:500 10px var(--mono);color:var(--ink-45);margin-top:4px}',
    '.acc-area-cell{display:flex;flex-direction:column;min-width:0}',
    '.acc-row-actions{justify-content:flex-end;flex-wrap:nowrap}',
    '.acc-env-top{display:flex;align-items:center;gap:8px}',
    '.stat.acc-env-on{border-color:var(--pink);box-shadow:inset 0 0 0 1px var(--pink)}'
  ].join('\n');
  document.head.appendChild(style);
})(window.Console);
