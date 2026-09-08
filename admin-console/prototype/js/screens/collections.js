/* Collections — P5 Manage a collection.
   OWNER: publishing builder. Routes: #/collections (list) and
   #/collections/:id (editor: membership, metadata, visibility, preview, save).

   Edits are held in a draft on Console.store.ui.collections until Save, which
   is the single Console.commit for the whole change set. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.collections = { drafts: {}, focus: null };

  function ui() { return C.store.ui.collections; }

  var FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'shelf', label: 'Shelf' },
    { key: 'emoji', label: 'Emoji' },
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
    published: 'Visible on the shelf to every player who meets the unlock rule.',
    draft: 'Not on any shelf. Only operators see it here.',
    hidden: 'Kept out of the shelves but reachable by a direct link, for testing.'
  };

  function draftFor(col) {
    var d = ui().drafts[col.id];
    if (!d) {
      d = ui().drafts[col.id] = {
        name: col.name, shelf: col.shelf, emoji: col.emoji, blurb: col.blurb,
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
  // list
  // ------------------------------------------------------------------

  C.registerScreen('#/collections', {
    title: 'Collections',
    subline: function () {
      var pub = C.store.collections.filter(function (c) { return c.visibility === 'published'; }).length;
      return C.store.collections.length + ' collections · ' + pub + ' published to shelves';
    },
    actions: function () {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.densitySwitch());
      row.appendChild(C.ui.button('New collection', { variant: 'pink', onClick: openNewCollection }));
      return row;
    },
    render: function (mount) {
      var rows = C.store.collections.slice().sort(function (a, b) { return a.order - b.order; });

      var intro = el('div', 'banner calm');
      intro.appendChild(el('span', 'banner-dot'));
      intro.appendChild(el('div', 'banner-text', 'Shelves are ordered as listed. Only published collections reach players.'));
      intro.appendChild(el('div', 'banner-detail', 'Membership, metadata and visibility are saved together, in one audited change.'));
      mount.appendChild(intro);

      mount.appendChild(C.ui.table({
        cols: [
          {
            key: 'name', label: 'Collection',
            render: function (r) {
              var n = el('span', 'col-name-cell');
              n.appendChild(el('span', 'col-emoji', r.emoji));
              n.appendChild(el('span', 'cell-title', r.name));
              return n;
            }
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
        empty: 'No collections yet. Create one to group games onto a shelf.'
      }));
    }
  });

  function openNewCollection() {
    var body = el('div');
    var name = textRow(body, 'Name', 'e.g. Weekend warm-up');
    var shelf = textRow(body, 'Shelf', 'e.g. Featured');
    var emoji = textRow(body, 'Emoji', 'e.g. 🌤');
    shelf.input.value = 'Featured';
    emoji.input.value = '🧩';
    body.appendChild(el('div', 'help', 'The collection is created as a Draft with no members. Add games and set visibility in the editor, then save.'));
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
            emoji: emoji.input.value.trim() || '🧩',
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
      return col ? col.emoji + ' ' + col.name : 'Collection';
    },
    subline: function (p) {
      var col = C.find.collection(p.id);
      if (!col) return 'Unknown collection';
      var d = draftFor(col);
      var dirty = changeList(col, d).length;
      return col.shelf + ' shelf · ' + d.members.length + ' games · ' +
        ((C.ui.STATUS[d.visibility] || {}).label || d.visibility) +
        (dirty ? ' · ' + dirty + ' unsaved change' + (dirty === 1 ? '' : 's') : ' · saved');
    },
    actions: function (p) {
      var col = C.find.collection(p.id);
      var row = el('div', 'btn-row');
      if (!col) return row;
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
      var col = C.find.collection(params.id);
      if (!col) {
        mount.appendChild(C.ui.emptyState('No collection with the id ' + params.id + '. Open one from the collections list.'));
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
      dirty.appendChild(el('div', 'banner-text', changes.length + ' unsaved change' + (changes.length === 1 ? '' : 's') + ' in this collection.'));
      dirty.appendChild(el('div', 'banner-detail', changes.map(function (c) { return c[0]; }).join(' · ') + '. Nothing reaches players until you save.'));
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
    head.appendChild(el('span', 'col-count', d.members.length + ' games · shown to players in this order'));
    head.appendChild(C.ui.button('Add from library', { small: true, onClick: function () { openAdd(col, d, repaint); } }));
    wrap.appendChild(head);

    var list = el('div', 'col-members');
    if (!d.members.length) {
      list.appendChild(C.ui.emptyState('No games in this collection yet. Add approved, scheduled or published games from the library.'));
    }
    d.members.forEach(function (id, i) {
      var p = puzzleLine(id);
      var row = el('div', 'col-member');
      row.appendChild(el('span', 'col-pos', String(i + 1)));
      var text = el('div', 'col-member-text');
      var title = el('div', 'col-member-title');
      title.appendChild(el('span', 'l-tag', p.kind === 'cw' ? 'CW' : 'D5'));
      title.appendChild(el('span', null, p.title));
      text.appendChild(title);
      var meta = el('div', 'col-member-meta');
      meta.textContent = p.id + ' · ' + (p.kind === 'cw' ? 'Crossword' : 'Daily Five') + ' · ' +
        (p.lang === 'uk' ? 'Ukrainian' : 'English') + ' · ' + p.difficulty;
      text.appendChild(meta);
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

    wrap.appendChild(el('div', 'panel-note', 'Members are added from the library at Approved or later. Removing a game here never deletes it; it only leaves the shelf.'));
    return wrap;
  }

  function swap(d, a, b) {
    var t = d.members[a];
    d.members[a] = d.members[b];
    d.members[b] = t;
  }

  function openAdd(col, d, repaint) {
    var body = el('div');
    body.appendChild(el('div', 'help', 'Approved, scheduled and published games can join a shelf. Drafts and games awaiting review cannot.'));
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
    vhead.appendChild(el('div', 'spacer'));
    vhead.appendChild(C.ui.pill(d.visibility));
    wrap.appendChild(vhead);

    var vbody = el('div', 'col-fields');
    vbody.appendChild(C.ui.segmented(VISIBILITY, d.visibility, function (k) {
      d.visibility = k;
      repaint();
    }));
    vbody.appendChild(el('div', 'help', VISIBILITY_NOTE[d.visibility]));
    vbody.appendChild(C.ui.button('Preview shelf', { onClick: function () { openPreview(col); } }));
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

    if (d.visibility !== 'published') {
      var note = el('div', 'notice');
      note.textContent = ((C.ui.STATUS[d.visibility] || {}).label || d.visibility) +
        ': players do not see this shelf yet. The preview shows it as it would look once published.';
      body.appendChild(note);
    }

    var shelf = el('div', 'shelf');
    var shead = el('div', 'shelf-head');
    shead.appendChild(el('span', 'shelf-emoji', d.emoji || '🧩'));
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
      cards.appendChild(el('div', 'shelf-empty', 'This shelf has no games yet, so players would see nothing.'));
    }
    d.members.forEach(function (id, i) {
      var p = puzzleLine(id);
      var card = el('div', 'shelf-card');
      card.appendChild(el('div', 'shelf-card-kind', (p.kind === 'cw' ? 'Crossword' : 'Daily Five') + ' · ' + p.difficulty));
      card.appendChild(el('div', 'shelf-card-title', p.title));
      card.appendChild(el('div', 'shelf-card-num', String(i + 1) + ' of ' + d.members.length));
      cards.appendChild(card);
    });
    shelf.appendChild(cards);
    body.appendChild(shelf);
    body.appendChild(el('div', 'help', 'Preview only. Card art, progress rings and the solved state come from the app; this shows order, naming and the unlock line.'));

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
        ? 'Saving updates the ' + (d.shelf || col.shelf) + ' shelf for every player who meets the unlock rule. Games keep their own schedule; a collection never publishes a game on its own.'
        : 'Saving stores the collection but keeps it off the shelves, because visibility is ' +
          ((C.ui.STATUS[d.visibility] || {}).label || d.visibility) + '. Players see nothing until it is published.'
    }));

    var reason = C.ui.reasonField({
      required: false,
      label: 'Note (optional)',
      placeholder: 'e.g. Swapped the Hard opener after completion fell',
      help: 'Stored in the audit log with your operator name and the result.'
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
          var lbl = el('div', 'eyebrow', 'What changed');
          lbl.style.margin = '16px 0 6px';
          res.appendChild(lbl);
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
    '.col-name-cell{display:inline-flex;align-items:center;gap:8px}',
    '.col-emoji{font-size:16px}',
    '.col-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);min-width:0}',
    '.col-main{min-width:0;border-right:1px solid var(--rule)}',
    '.col-side{min-width:0;background:var(--paper)}',
    '.col-count{font:500 11px var(--mono);color:var(--ink-55)}',
    '.col-members{display:flex;flex-direction:column}',
    '.col-member{display:flex;align-items:center;gap:10px;padding:10px var(--pad-x);border-bottom:1px solid var(--rule-soft)}',
    '.is-compact .col-member{padding-top:6px;padding-bottom:6px}',
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
    '.shelf-emoji{font-size:30px;line-height:1}',
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
