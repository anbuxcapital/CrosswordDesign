/* Leaderboards — the integrity reviewer's screen (L1, L2).
   OWNER: integrity and economy builder.

   L1 Queue  : flagged solves, evidence, and the Clear / Exclude / Shadow decision.
   L2 Boards : week and puzzle boards per language, with eligibility markers.

   Board eligibility is the only thing a decision changes here. Reward decisions
   belong to the economy admin and are recorded separately (#/economy). */
(function (C) {
  'use strict';

  var el = C.ui.el;

  C.store.ui.leaderboards = {
    tab: 'queue',
    queueFilter: 'open',   // open | decided | all
    flagId: null,
    boardScope: 'week',
    boardLang: 'en',
    boardId: null
  };

  function st() { return C.store.ui.leaderboards; }

  var DECISIONS = [
    { key: 'cleared', label: 'Clear', verb: 'Clear the solve', eligible: true },
    { key: 'excluded', label: 'Exclude from board', verb: 'Exclude the solve from the board', eligible: false },
    { key: 'shadow', label: 'Shadow', verb: 'Shadow the solve', eligible: false }
  ];

  function decisionDef(key) {
    return DECISIONS.filter(function (d) { return d.key === key; })[0] || null;
  }

  function flags() { return C.store.flags; }

  function currentFlag() {
    var id = st().flagId;
    var hit = flags().filter(function (f) { return f.id === id; })[0];
    return hit || null;
  }

  /* Every board entry a decision on this flag moves: the player's row on any
     puzzle board for the flagged puzzle, and on every weekly board. */
  function affected(flag) {
    var out = [];
    C.store.boards.forEach(function (b) {
      if (b.puzzleId && b.puzzleId !== flag.puzzleId) return;
      b.entries.forEach(function (e) {
        if (e.playerId === flag.playerId) out.push({ board: b, entry: e });
      });
    });
    return out;
  }

  function noteFor(decision, flag) {
    var who = (C.store.session.operator && C.store.session.operator.handle) || 'operator';
    if (decision === 'cleared') return '';
    if (decision === 'excluded') return 'Excluded by ' + who + ' · flag ' + flag.id;
    return 'Shadow ranking by ' + who + ' · flag ' + flag.id;
  }

  // ------------------------------------------------------------------
  // L1 — queue
  // ------------------------------------------------------------------

  function queueRows() {
    var f = st().queueFilter;
    return flags().filter(function (fl) {
      if (f === 'open') return !fl.decision;
      if (f === 'decided') return !!fl.decision;
      return true;
    });
  }

  function decisionPill(flag) {
    if (!flag.decision) return C.ui.pill('open', 'Awaiting decision');
    return C.ui.pill(flag.decision);
  }

  function queueToolbar() {
    var bar = el('div', 'ie-toolbar');

    var open = flags().filter(function (f) { return !f.decision; }).length;
    var m = el('div', 'ie-metric');
    m.appendChild(el('span', 'eyebrow', 'Awaiting a decision'));
    m.appendChild(el('span', 'ie-metric-value', open + ' of ' + flags().length + ' flagged solves'));
    bar.appendChild(m);

    var group = el('div', 'ie-filter');
    group.appendChild(el('span', 'ie-filter-label', 'Show'));
    group.appendChild(C.ui.segmented(
      [{ key: 'open', label: 'Awaiting decision' }, { key: 'decided', label: 'Decided' }, { key: 'all', label: 'All' }],
      st().queueFilter,
      function (k) { st().queueFilter = k; C.render(); }
    ));
    bar.appendChild(group);

    bar.appendChild(el('div', 'spacer'));
    bar.appendChild(el('div', 'ie-hint', 'A decision changes board eligibility only. Reward decisions stay with the economy admin.'));
    return bar;
  }

  function queueTable() {
    return C.ui.table({
      cols: [
        {
          key: 'playerName', label: 'Player · game', render: function (r) {
            var n = el('div', 'ie-two');
            n.appendChild(el('span', 'ie-two-main', r.playerName));
            n.appendChild(el('span', 'ie-two-sub', r.puzzleTitle + ' · ' + r.puzzleId));
            return n;
          }
        },
        {
          key: 'reason', label: 'Evidence', render: function (r) {
            var n = el('div', 'ie-two');
            n.appendChild(el('span', 'ie-two-main', r.reason));
            n.appendChild(el('span', 'ie-two-sub', r.evidence.length + ' evidence items'));
            return n;
          }
        },
        { key: 'scope', label: 'Scope', render: function (r) { return el('span', 'cell-id', r.scope); } },
        { key: 'decision', label: 'Decision', align: 'right', render: decisionPill }
      ],
      rows: queueRows(),
      onRowClick: function (r) { st().flagId = r.id; C.render(); },
      empty: st().queueFilter === 'open'
        ? 'No flagged solves are waiting. Switch to Decided to review earlier decisions.'
        : 'No flagged solves match this filter.'
    });
  }

  function evidenceList(flag) {
    var dl = el('dl', 'kv-grid');
    flag.evidence.forEach(function (pair) {
      dl.appendChild(el('dt', null, pair[0]));
      dl.appendChild(el('dd', null, pair[1]));
    });
    return dl;
  }

  function boardImpact(flag) {
    var wrap = el('div');
    var rows = affected(flag);
    if (!rows.length) {
      wrap.appendChild(el('div', 'panel-note', 'This player does not appear on any current board.'));
      return wrap;
    }
    rows.forEach(function (a) {
      var line = el('div', 'ie-impact');
      line.appendChild(el('span', 'ie-impact-board', a.board.label));
      line.appendChild(el('span', 'cell-id', 'rank ' + a.entry.rank));
      line.appendChild(el('div', 'spacer'));
      line.appendChild(C.ui.status(a.entry.eligible ? 'eligible' : 'ineligible'));
      wrap.appendChild(line);
    });
    return wrap;
  }

  function flagDetail() {
    var flag = currentFlag();
    var wrap = el('div', 'ie-detail');
    if (!flag) {
      wrap.appendChild(C.ui.emptyState('Pick a flagged solve to read its evidence and record a decision.', 'No flag open'));
      return wrap;
    }

    var head = el('div', 'ie-detail-head');
    head.appendChild(el('div', 'ie-detail-title', flag.playerName));
    head.appendChild(el('span', 'cell-id', flag.id + ' · ' + flag.playerId));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(decisionPill(flag));
    wrap.appendChild(head);
    wrap.appendChild(el('div', 'ie-detail-sub', flag.puzzleTitle + ' · ' + flag.puzzleId + ' · ' + flag.scope));

    var evidence = el('div', 'panel');
    var eh = el('div', 'panel-head');
    eh.appendChild(el('span', 'panel-kind', 'Evidence'));
    eh.appendChild(el('span', 'panel-title', flag.reason));
    evidence.appendChild(eh);
    var eb = el('div', 'panel-body');
    eb.appendChild(evidenceList(flag));
    evidence.appendChild(eb);
    var ef = el('div', 'panel-foot');
    ef.appendChild(C.ui.button('Open player record', {
      small: true,
      onClick: function () { C.go('#/players/' + flag.playerId); }
    }));
    ef.appendChild(el('div', 'spacer'));
    ef.appendChild(el('span', 'panel-id', 'Evidence is read only'));
    evidence.appendChild(ef);
    wrap.appendChild(evidence);

    var impact = el('div', 'panel');
    var ih = el('div', 'panel-head');
    ih.appendChild(el('span', 'panel-kind', 'Board effect'));
    ih.appendChild(el('span', 'panel-title', 'Entries this decision moves'));
    impact.appendChild(ih);
    var ib = el('div', 'panel-body');
    ib.appendChild(boardImpact(flag));
    impact.appendChild(ib);
    wrap.appendChild(impact);

    var decide = el('div', 'ie-decide');
    decide.appendChild(el('div', 'eyebrow', flag.decision ? 'Change the decision' : 'Decision'));
    var row = el('div', 'btn-row roomy');
    DECISIONS.forEach(function (d) {
      row.appendChild(C.ui.button(d.label, {
        variant: d.key === 'cleared' ? 'primary' : d.key === 'excluded' ? 'danger' : 'quiet',
        disabled: flag.decision === d.key,
        onClick: function () { openDecision(flag, d.key); }
      }));
    });
    decide.appendChild(row);
    decide.appendChild(el('div', 'help', flag.decision
      ? 'Current decision: ' + (decisionDef(flag.decision) || {}).label + '. Recording a different one appends a new audit entry; the earlier one is kept.'
      : 'Every decision needs a reason and is written to the audit log with your operator name.'));
    wrap.appendChild(decide);

    var log = C.store.audit.filter(function (a) { return a.object === flag.id; });
    if (log.length) {
      var hist = el('div');
      hist.appendChild(el('div', 'eyebrow', 'Decisions this session'));
      var list = el('div', 'audit-list');
      list.style.marginTop = '8px';
      log.forEach(function (a) { list.appendChild(C.ui.auditLine(a)); });
      hist.appendChild(list);
      wrap.appendChild(hist);
    }
    return wrap;
  }

  function openDecision(flag, decision) {
    var def = decisionDef(decision);
    var rows = affected(flag);

    var nextNote = noteFor(decision, flag);
    var before = [['Decision', flag.decision ? (decisionDef(flag.decision) || {}).label : 'Awaiting decision']];
    var after = [['Decision', def.label]];
    rows.forEach(function (a) {
      before.push([a.board.label, (a.entry.eligible ? 'Eligible' : 'Not eligible') + (a.entry.note ? ' · ' + a.entry.note : '')]);
      after.push([a.board.label, (def.eligible ? 'Eligible' : 'Not eligible') + (nextNote ? ' · ' + nextNote : '')]);
    });

    var consequence = decision === 'cleared'
      ? 'The player keeps the rank shown above on every board listed. Reward decisions are recorded separately by the economy admin and are not changed here.'
      : decision === 'excluded'
        ? 'The solve stops counting on the boards listed and the ranks below it move up. Reward decisions are recorded separately by the economy admin and are not changed here.'
        : 'The player keeps seeing their own rank; other players do not. Reward decisions are recorded separately by the economy admin and are not changed here.';

    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: def.verb,
      before: before,
      after: after,
      consequence: consequence
    }));
    var reason = C.ui.reasonField({
      required: true,
      placeholder: decision === 'cleared'
        ? 'e.g. Device change explained by iCloud handover, pace within cohort'
        : 'e.g. Solve time 6σ below cohort with no intermediate keystrokes'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: def.verb,
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: def.label,
        destructive: decision === 'excluded',
        onClick: function () {
          var note = nextNote;
          C.commit({
            action: 'Decide flagged solve',
            object: flag.id,
            reason: reason.value(),
            result: def.label + ' · ' + flag.playerName + ' · ' +
              (rows.length
                ? rows.length + ' board ' + (rows.length === 1 ? 'entry' : 'entries') + ' set to ' + (def.eligible ? 'eligible' : 'not eligible')
                : 'no board entry affected'),
            apply: function () {
              var live = C.store.flags.filter(function (f) { return f.id === flag.id; })[0];
              if (live) live.decision = decision;
              affected(live || flag).forEach(function (a) {
                a.entry.eligible = def.eligible;
                a.entry.note = note;
              });
            }
          });
          C.ui.closeModal();
          C.toast(def.label + ' recorded for ' + flag.playerName + '.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // L2 — boards
  // ------------------------------------------------------------------

  function visibleBoards() {
    return C.store.boards.filter(function (b) {
      return b.scope === st().boardScope && b.lang === st().boardLang;
    });
  }

  function currentBoard() {
    var list = visibleBoards();
    var hit = list.filter(function (b) { return b.id === st().boardId; })[0];
    return hit || list[0] || null;
  }

  function boardsToolbar() {
    var bar = el('div', 'ie-toolbar');

    var scope = el('div', 'ie-filter');
    scope.appendChild(el('span', 'ie-filter-label', 'Scope'));
    scope.appendChild(C.ui.segmented(
      [{ key: 'week', label: 'Week' }, { key: 'puzzle', label: 'Game' }],
      st().boardScope,
      function (k) { st().boardScope = k; st().boardId = null; C.render(); }
    ));
    bar.appendChild(scope);

    var lang = el('div', 'ie-filter');
    lang.appendChild(el('span', 'ie-filter-label', 'Language'));
    lang.appendChild(C.ui.segmented(
      [{ key: 'en', label: 'English' }, { key: 'uk', label: 'Ukrainian' }],
      st().boardLang,
      function (k) { st().boardLang = k; st().boardId = null; C.render(); }
    ));
    bar.appendChild(lang);

    var list = visibleBoards();
    if (list.length > 1) {
      var pick = el('div', 'ie-filter');
      pick.appendChild(el('span', 'ie-filter-label', 'Board'));
      var cur = currentBoard();
      list.forEach(function (b) {
        var chip = el('button', 'chip chip-sm' + (cur && b.id === cur.id ? ' is-on' : ''), b.label);
        chip.type = 'button';
        chip.addEventListener('click', function () { st().boardId = b.id; C.render(); });
        pick.appendChild(chip);
      });
      bar.appendChild(pick);
    }

    bar.appendChild(el('div', 'spacer'));
    bar.appendChild(el('div', 'ie-hint', 'Ineligible rows keep their place in the list so the decision stays visible.'));
    return bar;
  }

  function boardsBody() {
    var wrap = el('div');
    var board = currentBoard();
    if (!board) {
      wrap.appendChild(C.ui.emptyState('No ' + st().boardScope + ' board exists for this language yet.', 'No board'));
      return wrap;
    }

    var head = el('div', 'ie-board-head');
    head.appendChild(el('div', 'ie-detail-title', board.label));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(el('span', 'cell-id', board.window || (board.scope === 'week' ? 'Weekly board' : 'Game board')));
    wrap.appendChild(head);

    var held = board.entries.filter(function (e) { return !e.eligible; }).length;
    var sum = el('div', 'ie-hint ie-board-sum');
    sum.textContent = board.entries.length + ' ranked players · ' + held + ' not eligible · ' +
      (board.lang === 'uk' ? 'Ukrainian' : 'English');
    wrap.appendChild(sum);

    wrap.appendChild(C.ui.table({
      cols: [
        { key: 'rank', label: '#', width: '48px', render: function (r) { return el('span', 'cell-id', String(r.rank)); } },
        { key: 'playerName', label: 'Player', render: function (r) { return el('span', 'cell-title', r.playerName); } },
        { key: 'playerId', label: 'Player ID', render: function (r) { return el('span', 'cell-id', r.playerId); } },
        { key: 'score', label: 'Result' },
        {
          key: 'eligible', label: 'Board eligibility', align: 'right', render: function (r) {
            var n = el('div', 'ie-two ie-two-right');
            n.appendChild(C.ui.status(r.eligible ? 'eligible' : 'ineligible'));
            if (r.note) n.appendChild(el('span', 'ie-two-sub', r.note));
            return n;
          }
        }
      ],
      rows: board.entries,
      onRowClick: function (r) { C.go('#/players/' + r.playerId); },
      empty: 'This board has no ranked players yet.'
    }));

    var foot = el('div', 'ie-board-foot');
    foot.textContent = 'Open a row to read the player record. Eligibility changes only through a decision in the Queue tab.';
    wrap.appendChild(foot);
    return wrap;
  }

  // ------------------------------------------------------------------
  // assembly
  // ------------------------------------------------------------------

  function build(mount) {
    mount.appendChild(C.ui.tabs(
      [{ key: 'queue', label: 'Queue' }, { key: 'boards', label: 'Boards' }],
      st().tab,
      function (k) { st().tab = k; C.render(); }
    ));

    if (st().tab === 'queue') {
      mount.appendChild(queueToolbar());
      var grid = el('div', 'ie-grid');
      var list = el('div', 'ie-list');
      list.appendChild(queueTable());
      grid.appendChild(list);
      grid.appendChild(flagDetail());
      mount.appendChild(grid);
    } else {
      mount.appendChild(boardsToolbar());
      var body = el('div', 'ie-single');
      body.appendChild(boardsBody());
      mount.appendChild(body);
    }
  }

  C.registerScreen('#/leaderboards', {
    title: 'Leaderboards',
    subline: function () {
      var open = C.store.flags.filter(function (f) { return !f.decision; }).length;
      return open + ' flagged solves awaiting a decision · ' + C.store.boards.length + ' boards';
    },
    actions: function () { return C.ui.densitySwitch(); },
    render: function (mount) { build(mount); }
  });

  // ------------------------------------------------------------------
  // screen-specific styles, shared with economy.js (injected once)
  // ------------------------------------------------------------------
  if (!document.getElementById('ie-style')) {
    var s = document.createElement('style');
    s.id = 'ie-style';
    s.textContent = [
      '.ie-toolbar{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:12px var(--pad-x);border-bottom:1px solid var(--rule);background:var(--cream)}',
      '.ie-metric{display:flex;flex-direction:column;gap:3px}',
      '.ie-metric-value{font:800 15px var(--sans)}',
      '.ie-filter{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
      '.ie-filter-label{font:700 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-55)}',
      '.ie-hint{font:400 11px/1.45 var(--sans);color:var(--ink-55);max-width:340px}',
      '.ie-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);min-width:0}',
      '.ie-grid.wide{grid-template-columns:minmax(0,1.75fr) minmax(0,1fr)}',
      '.ie-nowrap{white-space:nowrap}',
      '.ie-list{min-width:0;border-right:1px solid var(--rule)}',
      '.ie-single{min-width:0;padding-bottom:18px}',
      '.ie-detail{min-width:0;background:var(--paper);padding:16px var(--pad-x);display:flex;flex-direction:column;gap:14px}',
      '.ie-detail-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
      '.ie-detail-title{font:800 17px var(--sans)}',
      '.ie-detail-sub{font:400 12px var(--sans);color:var(--ink-55);margin-top:-8px}',
      '.ie-two{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.ie-two-right{align-items:flex-end}',
      '.ie-two-main{font:600 13px var(--sans)}',
      '.ie-two-sub{font:500 11px var(--mono);color:var(--ink-55)}',
      '.ie-impact{display:flex;align-items:center;gap:10px;padding:6px 0}',
      '.ie-impact + .ie-impact{border-top:1px solid var(--rule-soft)}',
      '.ie-impact-board{font:600 12px var(--sans)}',
      '.ie-decide{border-top:1px solid var(--rule);padding-top:12px}',
      '.ie-board-head{display:flex;align-items:baseline;gap:12px;padding:16px var(--pad-x) 2px}',
      '.ie-board-sum{padding:0 var(--pad-x) 12px;max-width:none}',
      '.ie-board-foot{padding:12px var(--pad-x);font:400 11px var(--sans);color:var(--ink-55)}',
      '.ie-amount{width:150px}',
      '.ie-sign{font:700 12px var(--mono);white-space:nowrap}',
      '.ie-sign.up{color:var(--green)}',
      '.ie-sign.down{color:var(--pink)}',
      '@media (max-width:1300px){.ie-grid{grid-template-columns:minmax(0,1fr)}',
      '.ie-list{border-right:0;border-bottom:1px solid var(--rule)}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})(window.Console);
