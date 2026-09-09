/* Crosscut admin console prototype — shared pattern helpers.
   Every helper returns a DOM node (some also return a small controller object).
   Build screens out of these instead of hand-rolling markup, so the safeguards
   (reason required, before/after review, per-item results, audit line) look and
   behave the same everywhere. */
window.Console = window.Console || {};

(function (C) {
  'use strict';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var ui = {};

  // ---------------------------------------------------------------------
  // status vocabulary — text AND colour, never colour alone
  // ---------------------------------------------------------------------
  var STATUS = {
    // game / Daily game states
    draft: { label: 'Draft', tone: 'mute' },
    review: { label: 'Needs review', tone: 'warn' },
    approved: { label: 'Approved', tone: 'ok' },
    scheduled: { label: 'Scheduled', tone: 'mute' },
    published: { label: 'Published', tone: 'ok' },
    live: { label: 'Live now', tone: 'ok' },
    empty: { label: 'No game', tone: 'bad' },
    // validation
    passed: { label: 'Passed', tone: 'ok' },
    failed: { label: 'Failed', tone: 'bad' },
    not_run: { label: 'Not run', tone: 'mute' },
    // day readiness
    ready: { label: 'Ready', tone: 'ok' },
    blocked: { label: 'Blocked', tone: 'bad' },
    queued: { label: 'Queued', tone: 'ok' },
    unplanned: { label: 'Unplanned', tone: 'mute' },
    done: { label: 'Done', tone: 'mute' },
    // signals / jobs / misc
    ok: { label: 'OK', tone: 'ok' },
    warn: { label: 'Warning', tone: 'warn' },
    open: { label: 'Open', tone: 'warn' },
    closed: { label: 'Closed', tone: 'ok' },
    cleared: { label: 'Cleared', tone: 'ok' },
    excluded: { label: 'Excluded from board', tone: 'bad' },
    shadow: { label: 'Shadow', tone: 'warn' },
    active: { label: 'Active', tone: 'ok' },
    suspended: { label: 'Suspended', tone: 'bad' },
    enabled: { label: 'Enabled', tone: 'ok' },
    paused: { label: 'Paused', tone: 'mute' },
    verified: { label: 'Verified', tone: 'ok' },
    refunded: { label: 'Refunded', tone: 'warn' },
    pending: { label: 'Pending', tone: 'warn' },
    hidden: { label: 'Hidden', tone: 'mute' },
    eligible: { label: 'Eligible', tone: 'ok' },
    ineligible: { label: 'Not eligible', tone: 'bad' }
  };
  ui.STATUS = STATUS;

  /* ui.pill('review') → <span class="pill pill-warn">● Needs review</span>
     Pass an unknown key and it renders the raw text in the neutral tone. */
  ui.pill = function (status, overrideLabel) {
    var s = STATUS[status] || { label: overrideLabel || String(status), tone: 'mute' };
    var n = el('span', 'pill pill-' + s.tone);
    n.appendChild(el('span', 'pill-dot'));
    n.appendChild(document.createTextNode(overrideLabel || s.label));
    return n;
  };

  /* ui.status('live') — the compact inline form used inside table cells. */
  ui.status = function (status, overrideLabel) {
    var s = STATUS[status] || { label: overrideLabel || String(status), tone: 'mute' };
    var tone = { ok: 'var(--green)', warn: 'var(--gold)', bad: 'var(--pink)', mute: 'var(--ink-55)' }[s.tone];
    var n = el('span', 'status');
    n.style.color = tone;
    n.appendChild(el('span', 'dot'));
    n.appendChild(document.createTextNode(overrideLabel || s.label));
    return n;
  };

  /* ui.table({
       cols: [{key, label, align:'right'|'left', width, render(row)}],
       rows: [{...}],                       // plain objects
       onRowClick: function(row, index),
       selectable: {selected:[ids], idKey:'id', onChange(ids)},
       empty: 'text shown when rows is empty'
     }) → <table class="tbl"> */
  ui.table = function (spec) {
    var idKey = (spec.selectable && spec.selectable.idKey) || 'id';
    var selected = (spec.selectable && spec.selectable.selected) || [];

    if (!spec.rows.length) return ui.emptyState(spec.empty || 'Nothing to show yet.');

    var table = el('table', 'tbl');
    var thead = el('thead');
    var htr = el('tr');
    if (spec.selectable) {
      var th0 = el('th', 'col-check');
      htr.appendChild(th0);
    }
    spec.cols.forEach(function (c) {
      var th = el('th', c.align === 'right' ? 'align-right' : null, c.label);
      if (c.width) th.style.width = c.width;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    var tbody = el('tbody');
    spec.rows.forEach(function (row, i) {
      var tr = el('tr');
      var id = row[idKey];
      if (spec.onRowClick) {
        tr.className = 'is-clickable';
        tr.tabIndex = 0;
        tr.addEventListener('click', function () { spec.onRowClick(row, i); });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spec.onRowClick(row, i); }
        });
      }
      if (spec.selectable) {
        var on = selected.indexOf(id) >= 0;
        if (on) tr.classList.add('is-selected');
        var td0 = el('td');
        var box = el('button', 'checkbox' + (on ? ' is-on' : ''), on ? '✓' : '');
        box.type = 'button';
        box.setAttribute('aria-pressed', String(on));
        box.setAttribute('aria-label', on ? 'Deselect row' : 'Select row');
        box.addEventListener('click', function (e) {
          e.stopPropagation();
          var next = on ? selected.filter(function (x) { return x !== id; }) : selected.concat([id]);
          spec.selectable.onChange(next);
        });
        td0.appendChild(box);
        tr.appendChild(td0);
      }
      spec.cols.forEach(function (c) {
        var td = el('td', c.align === 'right' ? 'align-right' : null);
        if (c.cls) td.classList.add(c.cls);
        var v = c.render ? c.render(row, i) : row[c.key];
        if (v == null) v = '';
        if (v instanceof Node) td.appendChild(v);
        else td.textContent = String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  };

  /* ui.reasonField({required:true, label, placeholder})
     → node with .value() and .focus(); fires onInput so a modal can re-check
       whether its primary control may be enabled. */
  ui.reasonField = function (opts) {
    opts = opts || {};
    var wrap = el('div', 'form-row');
    wrap.dataset.reasonField = '1';
    var lab = el('label', 'label', opts.label || 'Reason');
    if (opts.required !== false) lab.appendChild(el('span', 'req', 'required'));
    var id = 'reason_' + Math.random().toString(36).slice(2, 8);
    lab.setAttribute('for', id);
    wrap.appendChild(lab);
    var ta = el('textarea', 'textarea');
    ta.id = id;
    ta.placeholder = opts.placeholder || 'e.g. Lost streak while travelling, ticket #4821';
    wrap.appendChild(ta);
    wrap.value = function () { return ta.value.trim(); };
    wrap.required = opts.required !== false;
    wrap.focus = function () { ta.focus(); };
    ta.addEventListener('input', function () {
      if (wrap.onInput) wrap.onInput(ta.value.trim());
    });
    return wrap;
  };

  /* ui.reviewPanel({title, before:[[label,value]], after:[[label,value]], consequence})
     Only the rows that actually change are shown; `consequence` is one result line. */
  function pairText(v) { return v instanceof Node ? v.textContent : String(v == null ? '' : v); }

  ui.reviewPanel = function (spec) {
    var before = spec.before || [];
    var after = spec.after || [];
    if (before.length && before.length === after.length) {
      var keep = [];
      for (var i = 0; i < before.length; i++) {
        if (before[i][0] !== after[i][0] || pairText(before[i][1]) !== pairText(after[i][1])) keep.push(i);
      }
      if (keep.length) {
        before = keep.map(function (k) { return spec.before[k]; });
        after = keep.map(function (k) { return spec.after[k]; });
      }
    }
    var n = el('div', 'review');
    n.appendChild(el('div', 'review-head', spec.title || 'Review the change'));
    var cols = el('div', 'review-cols');
    function col(cls, title, pairs) {
      var c = el('div', 'review-col ' + cls);
      c.appendChild(el('div', 'review-col-title', title));
      (pairs || []).forEach(function (p) {
        var line = el('div', 'review-line');
        line.appendChild(el('span', 'k', p[0]));
        var v = el('span', 'v');
        if (p[1] instanceof Node) v.appendChild(p[1]); else v.textContent = String(p[1]);
        line.appendChild(v);
        c.appendChild(line);
      });
      return c;
    }
    cols.appendChild(col('before', 'Before', before));
    cols.appendChild(col('after', 'After', after));
    n.appendChild(cols);
    if (spec.consequence) n.appendChild(el('div', 'review-consequence', spec.consequence));
    return n;
  };

  /* ui.modal({title, body, wide, primary:{label, onClick, disabled(), destructive}, secondary:{label,onClick}})
     If `body` contains a reason field, the primary control stays disabled until
     the reason has text. Close with Console.ui.closeModal(). */
  var modalState = null;

  ui.modal = function (spec) {
    var layer = document.getElementById('modal-layer');
    layer.innerHTML = '';
    layer.hidden = false;

    var modal = el('div', 'modal' + (spec.wide ? ' wide' : ''));
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', spec.title || 'Dialog');

    var head = el('div', 'modal-head');
    head.appendChild(el('div', 'modal-title', spec.title || ''));
    head.appendChild(el('div', 'spacer'));
    var x = el('button', 'modal-close', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close dialog');
    x.addEventListener('click', ui.closeModal);
    head.appendChild(x);
    modal.appendChild(head);

    var body = el('div', 'modal-body');
    if (spec.body instanceof Node) body.appendChild(spec.body);
    else if (spec.body != null) body.textContent = String(spec.body);
    modal.appendChild(body);

    var foot = el('div', 'modal-foot' + (spec.primary && spec.primary.destructive ? ' destructive' : ''));
    foot.appendChild(el('div', 'spacer'));
    if (spec.secondary) {
      var sec = el('button', 'btn', spec.secondary.label || 'Cancel');
      sec.type = 'button';
      sec.addEventListener('click', function () {
        if (spec.secondary.onClick) spec.secondary.onClick();
        else ui.closeModal();
      });
      foot.appendChild(sec);
    }
    var prim = null;
    if (spec.primary) {
      prim = el('button', 'btn ' + (spec.primary.destructive ? 'btn-danger' : 'btn-pink'), spec.primary.label || 'Confirm');
      prim.type = 'button';
      prim.addEventListener('click', function () { spec.primary.onClick(); });
      foot.appendChild(prim);
    }
    modal.appendChild(foot);
    layer.appendChild(modal);

    var reason = body.querySelector('[data-reason-field]');
    function refresh() {
      if (!prim) return;
      var blocked = false;
      if (spec.primary.disabled) blocked = !!spec.primary.disabled();
      if (!blocked && reason && reason.required) blocked = !reason.value();
      prim.disabled = blocked;
    }
    if (reason) reason.onInput = refresh;
    modalState = { refresh: refresh, spec: spec };
    ui.refreshModal = refresh;
    refresh();

    layer.onclick = function (e) { if (e.target === layer) ui.closeModal(); };
    document.addEventListener('keydown', escClose);
    (reason ? reason : (prim || x)).focus();
    return modal;
  };

  function escClose(e) { if (e.key === 'Escape') ui.closeModal(); }

  ui.closeModal = function () {
    var layer = document.getElementById('modal-layer');
    layer.innerHTML = '';
    layer.hidden = true;
    layer.onclick = null;
    modalState = null;
    document.removeEventListener('keydown', escClose);
  };

  /* ui.results([{label, outcome:'ok'|'skipped'|'failed', detail}]) */
  ui.results = function (items) {
    var n = el('div', 'results');
    var WORD = { ok: 'Queued', skipped: 'Skipped', failed: 'Failed' };
    (items || []).forEach(function (it) {
      var row = el('div', 'result-item');
      row.appendChild(el('span', 'result-mark ' + it.outcome, it.outcomeLabel || WORD[it.outcome] || it.outcome));
      row.appendChild(el('span', 'result-label', it.label));
      row.appendChild(el('span', 'spacer'));
      row.appendChild(el('span', 'result-detail', it.detail || ''));
      n.appendChild(row);
    });
    return n;
  };

  /* ui.auditLine({time, operator, action, object, reason, result}) */
  ui.auditLine = function (entry) {
    var n = el('div', 'audit-line');
    n.appendChild(el('span', 'when', entry.time));
    n.appendChild(el('span', 'who', entry.operator));
    var what = el('span', 'what');
    what.textContent = entry.action + (entry.object ? ' · ' + entry.object : '') + ' → ' + entry.result;
    n.appendChild(what);
    if (entry.reason) n.appendChild(el('span', 'why', '“' + entry.reason + '”'));
    return n;
  };

  /* ui.puzzlePicker({kind:'cw'|'guessword', lang:'en', onPick(puzzle), statuses})
     Every kind word comes from Console.KIND_* through Console.kind*(). */
  ui.puzzlePicker = function (spec) {
    var statuses = spec.statuses || ['approved'];
    var wrap = el('div');
    var search = el('input', 'input picker-search');
    search.type = 'search';
    var pickNoun = spec.kind ? C.kindWordPlural(spec.kind) : 'games';
    search.placeholder = 'Search approved ' + pickNoun + ' by title or ID';
    search.setAttribute('aria-label', 'Search approved ' + pickNoun);
    wrap.appendChild(search);

    var list = el('div', 'picker-list');
    wrap.appendChild(list);

    function paint() {
      var q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      var rows = C.store.puzzles.filter(function (p) {
        if (spec.kind && p.kind !== spec.kind) return false;
        if (spec.lang && p.lang !== spec.lang) return false;
        if (statuses.indexOf(p.status) < 0) return false;
        if (!q) return true;
        return (p.title + ' ' + p.id).toLowerCase().indexOf(q) >= 0;
      });
      if (!rows.length) {
        list.appendChild(ui.emptyState('No approved ' + (spec.kind ? C.kindWord(spec.kind) : 'game') + ' matches that search.'));
        return;
      }
      rows.forEach(function (p) {
        var b = el('button', 'picker-item');
        b.type = 'button';
        b.appendChild(el('span', 'p-id', p.id));
        b.appendChild(el('span', 'p-title', p.title));
        b.appendChild(el('span', 'spacer'));
        b.appendChild(el('span', 'p-meta', p.lang + ' · ' + p.difficulty));
        b.appendChild(ui.status(p.status));
        b.addEventListener('click', function () { spec.onPick(p); });
        list.appendChild(b);
      });
    }
    search.addEventListener('input', paint);
    paint();
    return wrap;
  };

  /* ui.tabs([{key,label}], activeKey, onChange(key)) */
  ui.tabs = function (items, active, onChange) {
    var n = el('div', 'tabs');
    n.setAttribute('role', 'tablist');
    items.forEach(function (it) {
      var b = el('button', 'tab' + (it.key === active ? ' is-on' : ''), it.label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(it.key === active));
      b.addEventListener('click', function () { onChange(it.key); });
      n.appendChild(b);
    });
    return n;
  };

  /* ui.field({label, value, editable, changed, editing, onEdit})
     Read-only fields are dashed and washed; editable fields sit on paper. */
  ui.field = function (spec) {
    var cls = 'field ' + (spec.editable ? 'is-editable' : 'is-readonly');
    if (spec.editing) cls += ' is-editing';
    else if (spec.changed) cls += ' is-changed';
    var n = el('div', cls);
    n.appendChild(el('span', 'field-label', spec.label));
    var v = el('span', 'field-value');
    if (spec.value instanceof Node) v.appendChild(spec.value); else v.textContent = String(spec.value == null ? '' : spec.value);
    n.appendChild(v);
    n.appendChild(el('span', 'spacer'));
    if (spec.editable && spec.onEdit) {
      var b = el('button', 'field-action', spec.editing ? 'Done' : spec.changed ? 'Changed' : 'Edit');
      b.type = 'button';
      b.addEventListener('click', function () { spec.onEdit(n); });
      n.appendChild(b);
    } else if (!spec.editable) {
      n.appendChild(el('span', 'field-action', 'Read only'));
    }
    return n;
  };

  /* ui.emptyState('text') */
  ui.emptyState = function (text, mark) {
    var n = el('div', 'empty');
    n.appendChild(el('div', 'empty-mark', mark || 'Nothing here'));
    n.appendChild(el('div', 'empty-text', text));
    return n;
  };

  /* ui.segmented([{key,label}], activeKey, onChange) — small view switch */
  ui.segmented = function (items, active, onChange) {
    var n = el('div', 'seg');
    items.forEach(function (it) {
      var b = el('button', 'seg-item' + (it.key === active ? ' is-on' : ''), it.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(it.key === active));
      b.addEventListener('click', function () { onChange(it.key); });
      n.appendChild(b);
    });
    return n;
  };

  /* ui.button(label, {variant:'primary'|'pink'|'quiet'|'danger', onClick, disabled, small}) */
  ui.button = function (label, opts) {
    opts = opts || {};
    var cls = 'btn';
    if (opts.variant === 'primary') cls += ' btn-primary';
    else if (opts.variant === 'pink') cls += ' btn-pink';
    else if (opts.variant === 'quiet') cls += ' btn-quiet';
    else if (opts.variant === 'danger') cls += ' btn-danger';
    if (opts.small) cls += ' btn-sm';
    var b = el('button', cls, label);
    b.type = 'button';
    if (opts.disabled) b.disabled = true;
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    return b;
  };

  ui.el = el;
  C.ui = ui;
})(window.Console);
