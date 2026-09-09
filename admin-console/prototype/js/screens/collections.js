/* Collections — one area, two role-gated tabs.
   OWNER: publishing builder. Routes: #/collections (Collections tab and the
   Leaderboards tab, which renders the integrity screen from leaderboards.js)
   and #/collections/:id (collection editor: membership, metadata, visibility,
   preview, save). #/collections/leaderboards and the old #/leaderboards are
   aliases that open this area on the Leaderboards tab.

   Collections is visible to the publisher, Leaderboards to the integrity
   reviewer; an operator with one role sees only that tab.

   Edits are held in a draft on Console.store.ui.collections until Save, which
   is the single Console.commit for the whole change set. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.collections = { drafts: {}, focus: null, tab: 'collections' };

  function ui() { return C.store.ui.collections; }

  var FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'shelf', label: 'Shelf' },
    { key: 'blurb', label: 'Blurb', multiline: true },
    { key: 'unlockRule', label: 'Unlock rule' },
    { key: 'reward', label: 'Reward' }
  ];

  var VISIBILITY = [
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'hidden', label: 'Hidden' }
  ];

  var VISIBILITY_NOTE = {
    published: 'On the shelf for players who meet the unlock rule.',
    draft: 'Not on any shelf.',
    hidden: 'Off the shelves, reachable by direct link.'
  };

  function draftFor(col) {
    var d = ui().drafts[col.id];
    if (!d) {
      d = ui().drafts[col.id] = {
        name: col.name, shelf: col.shelf, blurb: col.blurb,
        unlockRule: col.unlockRule, reward: col.reward,
        visibility: col.visibility, members: col.members.slice(),
        editing: null
      };
    }
    return d;
  }

  function changeList(col, d) {
    var out = [];
    FIELDS.forEach(function (f) {
      if (d[f.key] !== col[f.key]) out.push([f.label, String(col[f.key] || '—'), String(d[f.key] || '—')]);
    });
    if (d.visibility !== col.visibility) {
      out.push(['Visibility', (C.ui.STATUS[col.visibility] || {}).label || col.visibility,
        (C.ui.STATUS[d.visibility] || {}).label || d.visibility]);
    }
    if (d.members.join('|') !== col.members.join('|')) {
      var added = d.members.filter(function (id) { return col.members.indexOf(id) < 0; });
      var removed = col.members.filter(function (id) { return d.members.indexOf(id) < 0; });
      var detail = added.length ? 'added ' + added.join(', ') : '';
      if (removed.length) detail += (detail ? ', ' : '') + 'removed ' + removed.join(', ');
      if (!detail) detail = 'reordered';
      out.push(['Membership', col.members.length + ' games', d.members.length + ' games (' + detail + ')']);
    }
    return out;
  }

  function puzzleLine(id) {
    var p = C.find.puzzle(id);
    if (!p) return { id: id, title: 'Unknown game', kind: 'cw', difficulty: '—', status: 'draft', lang: 'en' };
    return p;
  }

  // ------------------------------------------------------------------
  // area tabs
  // ------------------------------------------------------------------

  var TABS = [
    { key: 'collections', label: 'Collections', role: 'publisher' },
    { key: 'leaderboards', label: 'Leaderboards', role: 'integrity' }
  ];

  function visibleTabs() {
    return TABS.filter(function (t) { return C.hasRole(t.role); });
  }

  /* The stored tab, unless the operator's roles do not unlock it. */
  function activeTab() {
    var vis = visibleTabs();
    var want = ui().tab;
    var ok = vis.filter(function (t) { return t.key === want; })[0];
    return ok ? ok.key : (vis[0] ? vis[0].key : 'collections');
  }

  function tabStrip() {
    return C.ui.tabs(visibleTabs(), activeTab(), function (k) {
      ui().tab = k;
      C.render();
    });
  }

  /* The Leaderboards tab is the integrity screen, rendered in place.
     leaderboards.js loads after this file, so it is read at render time. */
  function leaderboardsPanel(mount) {
    if (C.leaderboards && C.leaderboards.render) C.leaderboards.render(mount);
    else mount.appendChild(C.ui.emptyState('The leaderboards screen did not load.'));
  }

  // ------------------------------------------------------------------
  // list
  // ------------------------------------------------------------------

  function collectionsList(mount) {
    var rows = C.store.collections.slice().sort(function (a, b) { return a.order - b.order; });

    mount.appendChild(C.ui.table({
      cols: [
        {
          key: 'name', label: 'Collection',
          render: function (r) { return el('span', 'cell-title', r.name); }
        },
        { key: 'shelf', label: 'Shelf' },
        { key: 'blurb', label: 'Blurb' },
        {
          key: 'members', label: 'Members', align: 'right',
          render: function (r) { return r.members.length + ' games'; }
        },
        {
          key: 'visibility', label: 'Visibility', align: 'right',
          render: function (r) { return C.ui.pill(r.visibility); }
        }
      ],
      rows: rows,
      onRowClick: function (r) { C.go('#/collections/' + r.id); },
      empty: 'No collections yet.'
    }));
  }

  C.registerScreen('#/collections', {
    title: 'Collections',
    subline: function () {
      if (activeTab() === 'leaderboards') {
        var open = C.store.flags.filter(function (f) { return !f.decision; }).length;
        return open + ' flagged solves awaiting a decision';
      }
      return C.store.collections.length + ' collections';
    },
    actions: function () {
      if (activeTab() !== 'collections') return null;
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.button('New collection', { variant: 'pink', onClick: openNewCollection }));
      return row;
    },
    render: function (mount) {
      mount.appendChild(tabStrip());
      if (activeTab() === 'leaderboards') leaderboardsPanel(mount);
      else collectionsList(mount);
    }
  });

  /* #/leaderboards and #/collections/leaderboards both open this area on the
     Leaderboards tab: the audit log's "Open affected object" and the player
     timeline still link to the old route. */
  function toLeaderboards() { ui().tab = 'leaderboards'; }
  C.alias('#/leaderboards', '#/collections', toLeaderboards);
  C.alias('#/collections/leaderboards', '#/collections', toLeaderboards);

  function openNewCollection() {
    var body = el('div');
    var name = textRow(body, 'Name', 'e.g. Weekend warm-up');
    var shelf = textRow(body, 'Shelf', 'e.g. Featured');
    shelf.input.value = 'Featured';
    name.input.addEventListener('input', function () { C.ui.refreshModal(); });

    C.ui.modal({
      title: 'New collection',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Create collection',
        disabled: function () { return !name.input.value.trim(); },
        onClick: function () {
          var id = 'col_' + name.input.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) +
            '_' + (C.store.collections.length + 1);
          var record = {
            id: id, name: name.input.value.trim(),
            shelf: shelf.input.value.trim() || 'Featured',
            blurb: '', unlockRule: 'Free for everyone', reward: 'None',
            visibility: 'draft', order: C.store.collections.length + 1, members: []
          };
          C.ui.closeModal();
          C.commit({
            action: 'Create collection',
            object: id,
            reason: '',
            result: record.name + ' created as a Draft on the ' + record.shelf + ' shelf · 0 members',
            silent: true,
            apply: function () { C.store.collections.push(record); }
          });
          C.toast(record.name + ' created.');
          C.go('#/collections/' + id);
        }
      }
    });
  }

  function textRow(parent, label, placeholder) {
    var row = el('div', 'form-row');
    row.appendChild(el('label', 'label', label));
    var input = el('input', 'input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', label);
    row.appendChild(input);
    parent.appendChild(row);
    return { row: row, input: input };
  }

  // ------------------------------------------------------------------
  // editor
  // ------------------------------------------------------------------

  C.registerScreen('#/collections/:id', {
    title: function (p) {
      var col = C.find.collection(p.id);
      return col ? col.name : 'Collection';
    },
    subline: function (p) {
      var col = C.find.collection(p.id);
      if (!col) return 'Unknown collection';
      return draftFor(col).members.length + ' games';
    },
    actions: function (p) {
      var col = C.find.collection(p.id);
      var row = el('div', 'btn-row');
      if (!col || !C.hasRole('publisher')) return row;
      row.appendChild(C.ui.button('Back to collections', { onClick: function () { C.go('#/collections'); } }));
      row.appendChild(C.ui.button('Preview shelf', { onClick: function () { openPreview(col); } }));
      row.appendChild(C.ui.button('Save', {
        variant: 'pink',
        disabled: !changeList(col, draftFor(col)).length,
        onClick: function () { openSave(col); }
      }));
      return row;
    },
    render: function (mount, params) {
      if (!C.hasRole('publisher')) {
        mount.appendChild(C.ui.emptyState('Editing a collection needs the publisher role.', 'Not permitted'));
        return;
      }
      var col = C.find.collection(params.id);
      if (!col) {
        mount.appendChild(C.ui.emptyState('No collection with the id ' + params.id + '.'));
        return;
      }
      paint(mount, col);
    }
  });

  function paint(mount, col) {
    mount.innerHTML = '';
    var d = draftFor(col);
    var changes = changeList(col, d);

    /* Full re-render: the header carries Save and the live change count, and it
       lives outside the screen mount. Draft state survives on store.ui. */
    function repaint() { C.render(); }

    if (changes.length) {
      var dirty = el('div', 'banner attention');
      dirty.appendChild(el('span', 'banner-dot'));
      dirty.appendChild(el('div', 'banner-text', changes.length + ' unsaved change' + (changes.length === 1 ? '' : 's') +
        ': ' + changes.map(function (c) { return c[0]; }).join(' · ')));
      dirty.appendChild(el('div', 'spacer'));
      dirty.appendChild(C.ui.button('Discard changes', {
        small: true,
        onClick: function () {
          delete ui().drafts[col.id];
          C.toast('Changes discarded.');
          C.render();
        }
      }));
      dirty.appendChild(C.ui.button('Save', { small: true, variant: 'pink', onClick: function () { openSave(col); } }));
      mount.appendChild(dirty);
    }

    var grid = el('div', 'col-grid');
    grid.appendChild(membership(col, d, repaint));
    grid.appendChild(sidePanel(col, d, repaint));
    mount.appendChild(grid);

    if (d.editing) {
      var live = mount.querySelector('.field.is-editing input, .field.is-editing textarea');
      if (live) live.focus();
    }
  }

  // --- membership -----------------------------------------------------

  function membership(col, d, repaint) {
    var wrap = el('div', 'col-main');

    var head = el('div', 'section-head');
    head.appendChild(el('div', 'section-title', 'Membership'));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.button('Add from library', { small: true, onClick: function () { openAdd(col, d, repaint); } }));
    wrap.appendChild(head);

    var list = el('div', 'col-members');
    if (!d.members.length) {
      list.appendChild(C.ui.emptyState('No games in this collection yet.'));
    }
    d.members.forEach(function (id, i) {
      var p = puzzleLine(id);
      var row = el('div', 'col-member');
      row.appendChild(el('span', 'col-pos', String(i + 1)));
      var text = el('div', 'col-member-text');
      var title = el('div', 'col-member-title');
      title.appendChild(el('span', 'l-tag', p.kind === 'cw' ? 'CW' : 'WL'));
      title.appendChild(el('span', null, p.title));
      text.appendChild(title);
      text.appendChild(el('div', 'col-member-meta', p.id));
      row.appendChild(text);
      row.appendChild(el('div', 'spacer'));
      row.appendChild(C.ui.status(p.status));

      row.appendChild(C.ui.button('Move up', {
        small: true, disabled: i === 0,
        onClick: function () { swap(d, i, i - 1); repaint(); }
      }));
      row.appendChild(C.ui.button('Move down', {
        small: true, disabled: i === d.members.length - 1,
        onClick: function () { swap(d, i, i + 1); repaint(); }
      }));
      row.appendChild(C.ui.button('Remove', {
        small: true, variant: 'danger',
        onClick: function () {
          d.members = d.members.filter(function (x) { return x !== id; });
          C.toast(p.id + ' removed from the draft. Save to apply.');
          repaint();
        }
      }));
      list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function swap(d, a, b) {
    var t = d.members[a];
    d.members[a] = d.members[b];
    d.members[b] = t;
  }

  function openAdd(col, d, repaint) {
    var body = el('div');
    body.appendChild(el('div', 'help', 'Only approved, scheduled and published games can join a shelf.'));
    body.appendChild(C.ui.puzzlePicker({
      statuses: ['approved', 'scheduled', 'published'],
      onPick: function (p) {
        if (d.members.indexOf(p.id) >= 0) { C.toast(p.id + ' is already in this collection.'); return; }
        d.members.push(p.id);
        C.ui.closeModal();
        C.toast(p.id + ' added to the draft. Save to apply.');
        repaint();
      }
    }));
    C.ui.modal({
      title: 'Add a game to ' + col.name,
      wide: true,
      body: body,
      secondary: { label: 'Cancel' }
    });
  }

  // --- metadata, visibility -------------------------------------------

  function sidePanel(col, d, repaint) {
    var wrap = el('div', 'col-side');

    var head = el('div', 'section-head');
    head.appendChild(el('div', 'section-title', 'Metadata'));
    wrap.appendChild(head);

    var fields = el('div', 'col-fields');
    FIELDS.forEach(function (f) {
      fields.appendChild(metaField(f, col, d, repaint));
    });
    wrap.appendChild(fields);

    var vhead = el('div', 'section-head');
    vhead.appendChild(el('div', 'section-title', 'Visibility'));
    wrap.appendChild(vhead);

    var vbody = el('div', 'col-fields');
    vbody.appendChild(C.ui.segmented(VISIBILITY, d.visibility, function (k) {
      d.visibility = k;
      repaint();
    }));
    vbody.appendChild(el('div', 'help', VISIBILITY_NOTE[d.visibility]));
    wrap.appendChild(vbody);
    return wrap;
  }

  function metaField(f, col, d, repaint) {
    var editing = d.editing === f.key;
    var input = null;
    if (editing) {
      input = el(f.multiline ? 'textarea' : 'input', f.multiline ? 'textarea' : 'input');
      input.value = d[f.key] || '';
      input.setAttribute('aria-label', f.label);
      if (!f.multiline) {
        input.type = 'text';
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); commitField(); }
        });
      }
    }
    function commitField() {
      d[f.key] = input.value.trim();
      d.editing = null;
      repaint();
    }
    return C.ui.field({
      label: f.label,
      value: editing ? input : (d[f.key] || '—'),
      editable: true,
      editing: editing,
      changed: !editing && d[f.key] !== col[f.key],
      onEdit: function () {
        if (editing) commitField();
        else { d.editing = f.key; repaint(); }
      }
    });
  }

  // --- preview shelf ---------------------------------------------------

  function openPreview(col) {
    var d = draftFor(col);
    var body = el('div');
    var shelf = el('div', 'shelf');
    var shead = el('div', 'shelf-head');
    var stext = el('div');
    stext.appendChild(el('div', 'shelf-name', d.name || col.name));
    stext.appendChild(el('div', 'shelf-blurb', d.blurb || 'No blurb yet.'));
    shead.appendChild(stext);
    shelf.appendChild(shead);

    var meta = el('div', 'shelf-meta');
    meta.appendChild(el('span', null, d.unlockRule || 'Free for everyone'));
    meta.appendChild(el('span', null, '·'));
    meta.appendChild(el('span', null, d.reward && d.reward !== 'None' ? d.reward : 'No completion reward'));
    shelf.appendChild(meta);

    var cards = el('div', 'shelf-cards');
    if (!d.members.length) {
      cards.appendChild(el('div', 'shelf-empty', 'No games on this shelf yet.'));
    }
    d.members.forEach(function (id, i) {
      var p = puzzleLine(id);
      var card = el('div', 'shelf-card');
      card.appendChild(el('div', 'shelf-card-kind', (p.kind === 'cw' ? 'Crossword' : 'Wordle') + ' · ' + p.difficulty));
      card.appendChild(el('div', 'shelf-card-title', p.title));
      card.appendChild(el('div', 'shelf-card-num', String(i + 1) + ' of ' + d.members.length));
      cards.appendChild(card);
    });
    shelf.appendChild(cards);
    body.appendChild(shelf);

    C.ui.modal({
      title: 'Preview shelf · ' + (d.shelf || col.shelf),
      wide: true,
      body: body,
      primary: { label: 'Close preview', onClick: function () { C.ui.closeModal(); } }
    });
  }

  // --- save ------------------------------------------------------------

  function openSave(col) {
    var d = draftFor(col);
    var changes = changeList(col, d);
    if (!changes.length) { C.toast('Nothing to save.'); return; }

    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Review ' + changes.length + ' change' + (changes.length === 1 ? '' : 's') + ' to ' + col.name,
      before: changes.map(function (c) { return [c[0], c[1]]; }),
      after: changes.map(function (c) { return [c[0], c[2]]; }),
      consequence: d.visibility === 'published'
        ? 'Updates the ' + (d.shelf || col.shelf) + ' shelf for players who meet the unlock rule.'
        : 'Stored, but stays off the shelves.'
    }));

    var reason = C.ui.reasonField({
      required: false,
      label: 'Note (optional)',
      placeholder: 'e.g. Swapped the Hard opener after completion fell'
    });
    reason.style.marginTop = '16px';
    body.appendChild(reason);

    C.ui.modal({
      title: 'Save collection',
      wide: true,
      body: body,
      secondary: { label: 'Keep editing' },
      primary: {
        label: 'Save collection',
        onClick: function () {
          var summary = changes.map(function (c) { return c[0] + ' ' + c[1] + ' → ' + c[2]; }).join('; ');
          C.ui.closeModal();
          C.commit({
            action: 'Save collection',
            object: col.id,
            reason: reason.value(),
            result: changes.length + ' change' + (changes.length === 1 ? '' : 's') + ' saved · ' + summary,
            silent: true,
            apply: function () {
              FIELDS.forEach(function (f) { col[f.key] = d[f.key]; });
              col.visibility = d.visibility;
              col.members = d.members.slice();
            }
          });
          delete ui().drafts[col.id];
          C.render();

          var res = el('div');
          var head = el('div', 'notice');
          head.textContent = col.name + ' saved · ' + col.members.length + ' games · ' +
            ((C.ui.STATUS[col.visibility] || {}).label || col.visibility) + ' on the ' + col.shelf + ' shelf.';
          res.appendChild(head);
          res.appendChild(C.ui.results(changes.map(function (c) {
            return { label: c[0], outcome: 'ok', outcomeLabel: 'Saved', detail: c[1] + ' → ' + c[2] };
          })));
          C.ui.modal({
            title: 'Collection saved',
            wide: true,
            body: res,
            primary: { label: 'Done', onClick: function () { C.ui.closeModal(); } }
          });
          C.toast(col.name + ' saved.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // screen-specific styles
  // ------------------------------------------------------------------

  var style = document.createElement('style');
  style.textContent = [
    '.col-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);min-width:0}',
    '.col-main{min-width:0;border-right:1px solid var(--rule)}',
    '.col-side{min-width:0;background:var(--paper)}',
    '.col-members{display:flex;flex-direction:column}',
    '.col-member{display:flex;align-items:center;gap:10px;padding:10px var(--pad-x);border-bottom:1px solid var(--rule-soft)}',
    '.col-member:hover{background:var(--wash)}',
    '.col-pos{font:700 11px var(--mono);color:var(--ink-45);width:18px;flex:none}',
    '.col-member-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.col-member-title{display:flex;align-items:center;gap:7px;font:700 13px var(--sans)}',
    '.col-member-meta{font:500 11px var(--mono);color:var(--ink-55)}',
    '.col-member .btn-danger{margin-left:14px}',
    '.col-fields{padding:12px var(--pad-x) 18px;display:flex;flex-direction:column;gap:10px}',
    '.col-fields .input,.col-fields .textarea{margin:0}',
    '.shelf{border:1px solid var(--ink-28);border-radius:var(--radius-lg);background:var(--cream);padding:16px;margin-top:12px}',
    '.shelf-head{display:flex;align-items:center;gap:12px}',
    '.shelf-name{font:900 18px var(--sans)}',
    '.shelf-blurb{font:400 13px/1.45 var(--sans);color:var(--ink-65)}',
    '.shelf-meta{display:flex;gap:8px;margin-top:10px;font:600 11px var(--mono);color:var(--ink-55)}',
    '.shelf-cards{display:flex;gap:10px;overflow-x:auto;padding:14px 2px 4px}',
    '.shelf-card{flex:none;width:150px;min-height:104px;display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid var(--ink-28);border-radius:var(--radius);background:var(--paper)}',
    '.shelf-card-kind{font:700 9px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-55)}',
    '.shelf-card-title{font:800 14px var(--sans);flex:1}',
    '.shelf-card-num{font:500 10px var(--mono);color:var(--ink-45)}',
    '.shelf-empty{font:500 12px var(--sans);color:var(--ink-55);padding:12px 0}',
    '@media (max-width:1300px){.col-grid{grid-template-columns:minmax(0,1fr)}',
    '.col-main{border-right:0;border-bottom:1px solid var(--rule)}}'
  ].join('\n');
  document.head.appendChild(style);
})(window.Console);
