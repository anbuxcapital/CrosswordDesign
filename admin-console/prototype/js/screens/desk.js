/* Drop desk — the publisher's default screen.
   OWNER: publishing builder.
   P1 fill a missing slot · P2 schedule a day · P3 schedule ahead in bulk ·
   P4 reorder, replace or unschedule. Collections (P5) live in collections.js. */
(function (C) {
  'use strict';

  var el = C.ui.el;
  var LIST_FROM = 6;   // the list starts at Sep 7, the day before today
  var TODAY_INDEX = 7; // Sep 8 2026

  C.store.ui.desk = {
    view: 'calendar',
    day: 10,          // Sep 11, the blocked day
    marked: [],
    hour: 12,
    minute: 0,
    mode: 'utc'
  };

  function st() { return C.store.ui.desk; }
  function days() { return C.store.days; }
  function pad2(n) { return String(((n % 24) + 24) % 24).padStart(2, '0'); }
  function timeString() { return pad2(st().hour) + ':' + String(st().minute).padStart(2, '0'); }

  var CITIES = [['Kyiv', 3], ['London', 1], ['New York', -4], ['Los Angeles', -7]];

  function repaint(mount) {
    mount.innerHTML = '';
    build(mount);
  }

  // ------------------------------------------------------------------
  // small vocabulary helpers
  // ------------------------------------------------------------------

  function kindWord(kind) { return kind === 'cw' ? 'crossword' : 'Daily Five'; }
  function kindPlural(kind) { return kind === 'cw' ? 'crosswords' : 'Daily Five'; }
  function kindLabel(kind) { return kind === 'cw' ? 'Crossword' : 'Daily Five'; }
  function modeWord(mode) { return mode === 'local' ? 'player-local time' : 'UTC'; }
  function langWord(lang) { return lang === 'uk' ? 'Ukrainian' : 'English'; }

  function dayLang(day) {
    for (var i = 0; i < day.items.length; i++) {
      var p = C.find.puzzle(day.items[i]);
      if (p) return p.lang;
    }
    return 'en';
  }

  /* Why a day cannot be scheduled, or '' when it is ready. */
  function blockReason(day) {
    var dd = C.deriveDay(day);
    if (day.past) return 'Already published';
    if (day.scheduled) return 'Already queued at ' + day.publishTime + ' ' + modeWord(day.publishMode);
    if (dd.empty) return 'No games planned';
    if (dd.missing.length) return 'No ' + kindWord(dd.missing[0]) + ' assigned';
    if (dd.blocked) return 'One or more games are not approved yet';
    return '';
  }

  /* Representative local times for one instant / one local clock time. */
  function localList(hour, minute, mode) {
    var mm = String(minute).padStart(2, '0');
    var wrap = el('div', 'localtimes');
    CITIES.forEach(function (c) {
      var line = el('div', 'localtime');
      line.appendChild(el('span', 'city', c[0]));
      if (mode === 'local') {
        line.appendChild(el('span', 't', pad2(hour) + ':' + mm));
        line.appendChild(el('span', 'd', '= ' + pad2(hour - c[1]) + ':' + mm + ' UTC'));
      } else {
        var t = hour + c[1];
        line.appendChild(el('span', 't', pad2(t) + ':' + mm));
        line.appendChild(el('span', 'd', t < 0 ? '−1 day' : t >= 24 ? '+1 day' : ''));
      }
      wrap.appendChild(line);
    });
    return wrap;
  }

  function consequenceText(day, time, mode) {
    return mode === 'local'
      ? 'Every player gets the ' + day.longLabel + ' drop at ' + time + ' on their own clock. It rolls across time zones over 26 hours, starting in UTC+14. Nothing publishes before then and you can unschedule until the first zone goes live.'
      : 'The ' + day.longLabel + ' drop goes live at one instant worldwide, ' + time + ' UTC. Players see it at the local times listed above. Nothing publishes before then and you can unschedule until it goes live.';
  }

  /* A table of the puzzles in a drop, used inside review dialogs. */
  function itemTable(day) {
    var dd = C.deriveDay(day);
    var seen = { cw: 0, d5: 0 };
    var totals = {
      cw: dd.items.filter(function (i) { return i.kind === 'cw'; }).length,
      d5: dd.items.filter(function (i) { return i.kind === 'd5'; }).length
    };
    var rows = dd.items.map(function (it) {
      var n = ++seen[it.kind];
      return {
        id: it.id,
        slot: kindLabel(it.kind) + (totals[it.kind] > 1 ? ' ' + n + ' of ' + totals[it.kind] : ''),
        title: it.title,
        state: it.status
      };
    });
    return C.ui.table({
      cols: [
        { key: 'slot', label: 'Slot' },
        { key: 'id', label: 'Game', cls: 'cell-id' },
        { key: 'title', label: 'Title', cls: 'cell-title' },
        { key: 'state', label: 'State', align: 'right', render: function (r) { return C.ui.status(r.state); } }
      ],
      rows: rows,
      empty: 'This day has no games yet.'
    });
  }

  function sectionLabel(text) {
    var n = el('div', 'eyebrow', text);
    n.style.margin = '16px 0 6px';
    return n;
  }

  // ------------------------------------------------------------------
  // P1 — fill a slot / add a puzzle
  // ------------------------------------------------------------------

  function openPicker(day, kind) {
    var dd = C.deriveDay(day);
    var missing = dd.missing.indexOf(kind) >= 0;
    var lang = dayLang(day);

    var body = el('div');
    body.appendChild(el('div', 'help', 'Approved ' + kindPlural(kind) + ' in ' + langWord(lang) +
      '. Picking one assigns it to the ' + day.longLabel + ' drop straight away; the day is not scheduled until you confirm the schedule.'));
    body.appendChild(C.ui.puzzlePicker({
      kind: kind, lang: lang,
      onPick: function (p) { assignPuzzle(day, kind, p, missing); }
    }));

    C.ui.modal({
      title: (missing ? 'Choose a ' : 'Add another ') + kindWord(kind) + ' for ' + day.longLabel,
      wide: true,
      body: body,
      secondary: { label: 'Cancel' }
    });
  }

  function assignPuzzle(day, kind, puzzle, missing) {
    if (day.items.indexOf(puzzle.id) >= 0) {
      C.toast(puzzle.id + ' is already in this drop.');
      return;
    }
    day.items.push(puzzle.id);
    var after = C.deriveDay(day);
    day.items.pop();
    var readyText = after.blocked
      ? 'Day is still blocked: ' + (after.missing.length ? 'no ' + kindWord(after.missing[0]) + ' assigned' : 'one or more games are not approved yet')
      : 'Day is ready to schedule';

    C.ui.closeModal();
    C.commit({
      action: missing ? 'Assign ' + kindWord(kind) + ' to slot' : 'Add ' + kindWord(kind) + ' to drop',
      object: 'day ' + day.iso,
      reason: '',
      result: puzzle.id + ' ' + puzzle.title + ' → ' + kindLabel(kind) + ' slot. ' + readyText + '.',
      apply: function () { day.items.push(puzzle.id); }
    });
    C.toast(puzzle.id + ' assigned to ' + day.longLabel + '.');
  }

  // ------------------------------------------------------------------
  // P2 — schedule one day
  // ------------------------------------------------------------------

  function openScheduleReview(day) {
    var s = st();
    var dd = C.deriveDay(day);
    var time = timeString();
    var mode = s.mode;

    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Review the ' + day.longLabel + ' drop',
      before: [
        ['Status', 'Ready'],
        ['Publish time', 'Not scheduled'],
        ['Games', dd.items.length + ' paired']
      ],
      after: [
        ['Status', 'Queued'],
        ['Publish time', time + ' ' + modeWord(mode)],
        ['Games', dd.items.length + ' queued']
      ],
      consequence: consequenceText(day, time, mode)
    }));

    body.appendChild(sectionLabel('Items in this drop'));
    body.appendChild(itemTable(day));

    body.appendChild(sectionLabel(mode === 'local' ? 'Representative UTC instants' : 'Representative local times'));
    body.appendChild(localList(s.hour, s.minute, mode));

    var reason = C.ui.reasonField({
      required: false,
      label: 'Note (optional)',
      placeholder: 'e.g. Moved from Sep 12 to cover the holiday gap',
      help: 'Stored in the audit log with your operator name and the result.'
    });
    reason.style.marginTop = '16px';
    body.appendChild(reason);

    C.ui.modal({
      title: 'Confirm schedule',
      wide: true,
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Confirm schedule',
        onClick: function () {
          C.ui.closeModal();
          C.commit({
            action: 'Schedule drop',
            object: 'day ' + day.iso,
            reason: reason.value(),
            result: 'Queued for ' + day.longLabel + ' at ' + time + ' ' + modeWord(mode) + ' · ' + dd.items.length + ' games',
            apply: function () {
              day.scheduled = true;
              day.publishTime = time;
              day.publishMode = mode;
            }
          });
          C.toast(day.longLabel + ' queued at ' + time + ' ' + modeWord(mode) + '.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // P4 — unschedule, replace, reorder
  // ------------------------------------------------------------------

  function openUnschedule(day) {
    var dd = C.deriveDay(day);
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Unschedule the ' + day.longLabel + ' drop',
      before: [
        ['Status', 'Queued'],
        ['Publish time', day.publishTime + ' ' + modeWord(day.publishMode)],
        ['Games', dd.items.length + ' queued']
      ],
      after: [
        ['Status', 'Ready'],
        ['Publish time', 'Not scheduled'],
        ['Games', dd.items.length + ' paired']
      ],
      consequence: 'The drop stops being queued and returns to Ready. No game is removed from the day and nothing has reached players yet, so you can schedule it again at any time before ' + day.publishTime + '.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      placeholder: 'e.g. Crossword needs a correction before it can publish'
    });
    reason.style.marginTop = '16px';
    body.appendChild(reason);

    C.ui.modal({
      title: 'Unschedule drop',
      wide: true,
      body: body,
      secondary: { label: 'Keep it queued' },
      primary: {
        label: 'Unschedule drop',
        destructive: true,
        onClick: function () {
          C.ui.closeModal();
          C.commit({
            action: 'Unschedule drop',
            object: 'day ' + day.iso,
            reason: reason.value(),
            result: day.longLabel + ' returned to Ready · ' + dd.items.length + ' games kept',
            apply: function () { day.scheduled = false; }
          });
          C.toast(day.longLabel + ' is Ready again.');
        }
      }
    });
  }

  function openReplace(day, index) {
    var current = C.find.puzzle(day.items[index]);
    if (!current) return;
    var body = el('div');
    body.appendChild(el('div', 'help', 'Replacing ' + current.id + ' ' + current.title + ' in the ' + day.longLabel + ' drop.' +
      (day.scheduled ? ' The day is queued, so replacing returns it to Ready and you will need to confirm the schedule again.' : '')));
    body.appendChild(C.ui.puzzlePicker({
      kind: current.kind, lang: current.lang,
      onPick: function (p) {
        if (p.id === current.id) { C.toast(p.id + ' is already in this slot.'); return; }
        if (day.items.indexOf(p.id) >= 0) { C.toast(p.id + ' is already in this drop.'); return; }
        if (day.scheduled) confirmReplace(day, index, current, p);
        else commitReplace(day, index, current, p, '');
      }
    }));

    C.ui.modal({
      title: 'Replace ' + kindWord(current.kind) + ' · ' + day.longLabel,
      wide: true,
      body: body,
      secondary: { label: 'Cancel' }
    });
  }

  function confirmReplace(day, index, current, next) {
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Replace a queued ' + kindWord(current.kind),
      before: [
        [kindLabel(current.kind), current.id + ' ' + current.title],
        ['Status', 'Queued'],
        ['Publish time', day.publishTime + ' ' + modeWord(day.publishMode)]
      ],
      after: [
        [kindLabel(next.kind), next.id + ' ' + next.title],
        ['Status', 'Ready'],
        ['Publish time', 'Not scheduled']
      ],
      consequence: 'The day returns to Ready and stops being queued. Confirm the schedule again to publish it at ' + day.publishTime + ' ' + modeWord(day.publishMode) + '.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      placeholder: 'e.g. ' + current.id + ' has a clue error reported by a player'
    });
    reason.style.marginTop = '16px';
    body.appendChild(reason);

    C.ui.modal({
      title: 'Replace and unschedule',
      wide: true,
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Replace ' + kindWord(current.kind),
        onClick: function () { commitReplace(day, index, current, next, reason.value()); }
      }
    });
  }

  function commitReplace(day, index, current, next, reason) {
    var wasScheduled = day.scheduled;
    C.ui.closeModal();
    C.commit({
      action: 'Replace ' + kindWord(current.kind) + ' in drop',
      object: 'day ' + day.iso,
      reason: reason,
      result: current.id + ' replaced with ' + next.id + ' ' + next.title +
        (wasScheduled ? '. Day returned to Ready.' : '. Day stays Ready.'),
      apply: function () {
        day.items[index] = next.id;
        day.scheduled = false;
      }
    });
    C.toast(next.id + ' now fills the ' + kindWord(next.kind) + ' slot.');
  }

  /* Explicit ordering: a puzzle only moves past another puzzle of the same kind. */
  function siblingIndex(day, index, dir) {
    var p = C.find.puzzle(day.items[index]);
    if (!p) return -1;
    for (var j = index + dir; j >= 0 && j < day.items.length; j += dir) {
      var q = C.find.puzzle(day.items[j]);
      if (q && q.kind === p.kind) return j;
    }
    return -1;
  }

  function moveItem(day, index, dir) {
    var j = siblingIndex(day, index, dir);
    if (j < 0) return;
    var p = C.find.puzzle(day.items[index]);
    var kind = p.kind;

    var order = day.items.slice();
    var tmp = order[index]; order[index] = order[j]; order[j] = tmp;
    var position = 0, total = 0;
    order.forEach(function (id, k) {
      var q = C.find.puzzle(id);
      if (!q || q.kind !== kind) return;
      total++;
      if (k === j) position = total;
    });

    C.commit({
      action: 'Reorder drop',
      object: 'day ' + day.iso,
      reason: '',
      result: p.id + ' ' + p.title + ' moved to ' + kindWord(kind) + ' ' + position + ' of ' + total + ' in the ' + day.longLabel + ' drop',
      apply: function () { day.items = order; }
    });
    C.toast(p.id + ' moved to position ' + position + '.');
  }

  // ------------------------------------------------------------------
  // P3 — schedule ahead in bulk
  // ------------------------------------------------------------------

  function markedRows() {
    return st().marked.slice().sort(function (a, b) { return a - b; }).map(function (i) {
      var d = days()[i];
      var why = blockReason(d);
      return { day: d, date: d.longLabel, why: why, ok: !why, count: C.deriveDay(d).items.length };
    });
  }

  function openBulkReview() {
    var s = st();
    var rows = markedRows();
    var ready = rows.filter(function (r) { return r.ok; });
    var skipped = rows.filter(function (r) { return !r.ok; });
    var time = timeString();
    var mode = s.mode;

    var body = el('div');
    var head = el('div', 'notice');
    head.textContent = rows.length + ' dates selected · ' + ready.length + ' will be queued · ' +
      skipped.length + ' will be skipped. Effective time ' + time + ' ' + modeWord(mode) + ' on each date.';
    body.appendChild(head);

    body.appendChild(sectionLabel('Dates in this release'));
    body.appendChild(C.ui.table({
      cols: [
        { key: 'date', label: 'Date', cls: 'cell-title' },
        { key: 'count', label: 'Games' },
        { key: 'time', label: 'Publish time', render: function () { return time + ' ' + modeWord(mode); } },
        {
          key: 'why', label: 'Outcome', align: 'right',
          render: function (r) { return r.ok ? C.ui.status('queued', 'Will queue') : C.ui.status('blocked', 'Skip — ' + r.why); }
        }
      ],
      rows: rows,
      empty: 'No dates are selected.'
    }));

    body.appendChild(sectionLabel(mode === 'local' ? 'Representative UTC instants' : 'Representative local times'));
    body.appendChild(localList(s.hour, s.minute, mode));

    var conseq = el('div', 'review-consequence');
    conseq.style.marginTop = '12px';
    conseq.textContent = ready.length + ' drops publish on their own date at ' + time + ' ' + modeWord(mode) +
      '. Skipped dates are left untouched and stay in the desk. Each date is written to the audit log separately, and every queued day can still be unscheduled until it goes live.';
    body.appendChild(conseq);

    var reason = C.ui.reasonField({
      required: false,
      label: 'Note (optional)',
      placeholder: 'e.g. Week 38 release, agreed with editorial',
      help: 'Stored with every date in this release.'
    });
    reason.style.marginTop = '16px';
    body.appendChild(reason);

    C.ui.modal({
      title: 'Schedule ' + rows.length + ' drops',
      wide: true,
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: ready.length ? 'Schedule ' + ready.length + ' drops' : 'Nothing can be queued',
        disabled: function () { return !ready.length; },
        onClick: function () { runBulk(rows, time, mode, reason.value()); }
      }
    });
  }

  function runBulk(rows, time, mode, reason) {
    var results = [];
    rows.forEach(function (r) {
      if (r.ok) {
        C.commit({
          action: 'Schedule drop',
          object: 'day ' + r.day.iso,
          reason: reason,
          result: 'Queued for ' + r.day.longLabel + ' at ' + time + ' ' + modeWord(mode) + ' · ' + r.count + ' games',
          silent: true,
          apply: function () {
            r.day.scheduled = true;
            r.day.publishTime = time;
            r.day.publishMode = mode;
          }
        });
        results.push({ label: r.day.longLabel, outcome: 'ok', detail: 'Queued ' + time + ' ' + modeWord(mode) });
      } else {
        C.commit({
          action: 'Schedule drop',
          object: 'day ' + r.day.iso,
          reason: reason,
          result: 'Skipped — ' + r.why,
          silent: true
        });
        results.push({ label: r.day.longLabel, outcome: 'skipped', detail: r.why });
      }
    });

    var queued = results.filter(function (x) { return x.outcome === 'ok'; }).length;
    st().marked = [];
    C.render();

    var body = el('div');
    var summary = el('div', 'notice');
    summary.textContent = rows.length + ' dates selected · ' + queued + ' queued at ' + time + ' ' + modeWord(mode) +
      ' · ' + (rows.length - queued) + ' skipped. One audit entry was written per date.';
    body.appendChild(summary);
    body.appendChild(sectionLabel('Per-date result'));
    body.appendChild(C.ui.results(results));

    C.ui.modal({
      title: 'Schedule results',
      wide: true,
      body: body,
      primary: { label: 'Done', onClick: function () { C.ui.closeModal(); } }
    });
    C.toast(queued + ' drops queued.');
  }

  // ------------------------------------------------------------------
  // top strips
  // ------------------------------------------------------------------

  function gapBanner(mount) {
    var gap = days().filter(function (d) {
      return !d.past && !d.scheduled && d.items.length && C.deriveDay(d).missing.length;
    })[0];
    if (!gap) return null;
    var derived = C.deriveDay(gap);
    var out = derived.missing.indexOf('d5') >= 0 ? 'Daily Five' : 'crossword';
    var away = gap.index - TODAY_INDEX;
    var b = el('div', 'banner attention');
    b.appendChild(el('span', 'banner-dot'));
    b.appendChild(el('div', 'banner-text', gap.longLabel + ' has no ' + out + '. ' + away + ' days out.'));
    var spare = C.store.puzzles.filter(function (p) {
      return p.status === 'approved' && p.kind === (out === 'Daily Five' ? 'd5' : 'cw') && p.lang === 'en';
    }).length;
    b.appendChild(el('div', 'banner-detail', spare + ' approved ' + (out === 'crossword' ? 'crosswords' : 'Daily Five') + ' are unassigned.'));
    b.appendChild(el('div', 'spacer'));
    b.appendChild(C.ui.button('Fill slot', {
      small: true,
      onClick: function () { st().day = gap.index; repaint(mount); }
    }));
    return b;
  }

  function toolbar(mount) {
    var bar = el('div', 'desk-toolbar');

    var planned = days().filter(function (d) { return d.items.length; }).slice(-1)[0];
    var m = el('div', 'desk-metric');
    m.appendChild(el('span', 'eyebrow', 'Planned through'));
    m.appendChild(el('span', 'desk-metric-value', planned.label + ' · ' + (planned.index - TODAY_INDEX) + ' days out'));
    bar.appendChild(m);

    var h = el('div', 'horizon');
    var bars = el('div', 'horizon-bars');
    for (var k = 0; k < 30; k++) {
      var d = days()[k + LIST_FROM];
      var cls = 'none';
      if (d) {
        var dd = C.deriveDay(d);
        cls = d.scheduled ? 'full' : dd.empty ? 'none' : dd.missing.length ? 'gap' : dd.blocked ? 'part' : 'full';
      }
      bars.appendChild(el('span', 'horizon-bar ' + cls));
    }
    h.appendChild(bars);
    var scale = el('div', 'horizon-scale');
    scale.appendChild(el('span', null, 'Sep 7'));
    scale.appendChild(el('span', null, 'next 30 days'));
    scale.appendChild(el('span', null, 'Oct 6'));
    h.appendChild(scale);
    bar.appendChild(h);

    bar.appendChild(el('div', 'spacer'));

    bar.appendChild(C.ui.segmented(
      [{ key: 'calendar', label: 'Calendar' }, { key: 'list', label: 'List' }],
      st().view,
      function (v) { st().view = v; repaint(mount); }
    ));

    var legend = el('div', 'legend');
    [['Scheduled', 'full'], ['Awaiting review', 'part'], ['Gap', 'gap'], ['Unplanned', 'none']].forEach(function (l) {
      var i = el('span', 'legend-item');
      i.appendChild(el('span', 'legend-swatch ' + l[1]));
      i.appendChild(document.createTextNode(l[0]));
      legend.appendChild(i);
    });
    bar.appendChild(legend);
    return bar;
  }

  function bulkBar(mount) {
    var marked = st().marked;
    var bar = el('div', 'bulk-bar' + (marked.length ? ' is-active' : ''));
    bar.appendChild(el('span', 'bulk-label', marked.length ? marked.length + ' dates selected' : 'Schedule ahead'));
    bar.appendChild(el('span', 'bulk-hint', marked.length
      ? 'All ready. Publishing at ' + timeString() + (st().mode === 'local' ? ' player-local time' : ' UTC') + ' each day.'
      : 'Tick dates in the list to schedule several drops in one release.'));
    bar.appendChild(el('div', 'spacer'));
    bar.appendChild(C.ui.button('Select all ready ahead', {
      small: true,
      onClick: function () {
        st().marked = days().filter(function (d) {
          return d.index > TODAY_INDEX && !d.scheduled && !C.deriveDay(d).empty && !C.deriveDay(d).blocked;
        }).map(function (d) { return d.index; });
        st().view = 'list';
        repaint(mount);
      }
    }));
    bar.appendChild(C.ui.button(marked.length ? 'Schedule ' + marked.length + ' drops' : 'Nothing selected', {
      variant: 'pink', small: true, disabled: !marked.length,
      onClick: function () { openBulkReview(); }   // P3 bulk review + per-item results
    }));
    return bar;
  }

  // ------------------------------------------------------------------
  // calendar
  // ------------------------------------------------------------------

  function calendar(mount) {
    var wrap = el('div', 'cal');

    var head = el('div', 'cal-head');
    head.appendChild(el('span', 'cal-month', 'September 2026'));
    head.appendChild(el('span', 'cal-note', 'Each day is one drop. Add crosswords and Daily Five games to it independently.'));
    wrap.appendChild(head);

    var dows = el('div', 'cal-dows');
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (w) {
      dows.appendChild(el('div', 'cal-dow', w));
    });
    wrap.appendChild(dows);

    var cells = el('div', 'cal-cells');
    for (var k = 0; k < 35; k++) {
      var i = k - 1;
      var day = days()[i];
      if (!day) {
        var blank = el('div', 'cal-cell is-outside');
        blank.appendChild(el('span', 'cal-num is-outside', i < 0 ? '31' : String(i - 29)));
        cells.appendChild(blank);
        continue;
      }
      cells.appendChild(calCell(day, mount));
    }
    wrap.appendChild(cells);
    return wrap;
  }

  function calCell(day, mount) {
    var dd = C.deriveDay(day);
    var selected = st().day === day.index;
    var cell = el('button', 'cal-cell' + (selected ? ' is-selected' : ''));
    cell.type = 'button';
    cell.addEventListener('click', function () { st().day = day.index; repaint(mount); });

    var top = el('div', 'cal-cell-top');
    top.appendChild(el('span', 'cal-num' + (day.today ? ' is-today' : ''), String(day.dayOfMonth)));
    var tag = day.scheduled ? 'Queued' : dd.live ? 'Live' : day.past ? 'Done' : dd.empty ? '' : dd.blocked ? 'Blocked' : 'Ready';
    if (tag) top.appendChild(el('span', 'cal-tag ' + tag.toLowerCase(), tag));
    cell.appendChild(top);

    var chips = el('div', 'cal-chips');
    dd.items.forEach(function (it) {
      var chip = el('div', 'cal-chip');
      var dot = el('span', 'c-dot');
      dot.style.background = toneColor(it.status);
      chip.appendChild(dot);
      chip.appendChild(el('span', 'c-tag', it.kind === 'cw' ? 'CW' : 'D5'));
      chip.appendChild(el('span', 'c-title', it.title));
      chips.appendChild(chip);
    });
    if (!day.past && !dd.empty) {
      dd.missing.forEach(function (m) {
        var chip = el('div', 'cal-chip is-missing');
        var dot = el('span', 'c-dot');
        dot.style.background = 'var(--pink)';
        chip.appendChild(dot);
        chip.appendChild(el('span', 'c-tag', m === 'cw' ? 'CW' : 'D5'));
        chip.appendChild(el('span', 'c-title', m === 'cw' ? 'No crossword' : 'No Daily Five'));
        chips.appendChild(chip);
      });
    }
    cell.appendChild(chips);

    if (!day.past && !dd.live) {
      var adds = el('div', 'cal-adds');
      ['cw', 'd5'].forEach(function (kind) {
        var b = el('span', 'cal-add', kind === 'cw' ? '+ CW' : '+ D5');
        b.setAttribute('role', 'button');
        b.tabIndex = 0;
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          st().day = day.index;
          repaint(mount);
          openPicker(day, kind); // P1 puzzle picker
        });
        adds.appendChild(b);
      });
      cell.appendChild(adds);
    }
    return cell;
  }

  function toneColor(status) {
    var s = C.ui.STATUS[status];
    var tone = s ? s.tone : 'mute';
    return { ok: 'var(--green)', warn: 'var(--gold)', bad: 'var(--pink)', mute: 'var(--ink-45)' }[tone];
  }

  // ------------------------------------------------------------------
  // list
  // ------------------------------------------------------------------

  function dayList(mount) {
    var wrap = el('div', 'daylist' + (C.store.ui.density === 'compact' ? ' is-compact' : ''));

    var head = el('div', 'daylist-head');
    head.appendChild(el('span'));
    head.appendChild(el('span', null, 'Date'));
    head.appendChild(el('span', null, 'Paired content'));
    var r = el('span', null, 'Readiness');
    r.style.textAlign = 'right';
    head.appendChild(r);
    wrap.appendChild(head);

    days().slice(LIST_FROM).forEach(function (day) {
      var dd = C.deriveDay(day);
      var selected = st().day === day.index;
      var ticked = st().marked.indexOf(day.index) >= 0;
      var row = el('div', 'daylist-row' + (selected ? ' is-selected' : day.today ? ' is-today' : ''));
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.addEventListener('click', function () { st().day = day.index; repaint(mount); });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); st().day = day.index; repaint(mount); }
      });

      var box = el('button', 'checkbox' + (ticked ? ' is-on' : ''), ticked ? '✓' : '');
      box.type = 'button';
      box.setAttribute('aria-label', (ticked ? 'Deselect ' : 'Select ') + day.longLabel);
      box.addEventListener('click', function (e) {
        e.stopPropagation();
        var m = st().marked;
        st().marked = ticked ? m.filter(function (x) { return x !== day.index; }) : m.concat([day.index]);
        repaint(mount);
      });
      row.appendChild(box);

      var date = el('div');
      date.appendChild(el('div', 'daylist-dow', day.dow));
      date.appendChild(el('div', 'daylist-date', day.label));
      row.appendChild(date);

      var lines = el('div', 'daylist-lines');
      dd.items.forEach(function (it) {
        var line = el('div', 'daylist-line');
        var dot = el('span', 'l-dot');
        dot.style.background = toneColor(it.status);
        line.appendChild(dot);
        line.appendChild(el('span', 'l-tag', it.kind === 'cw' ? 'CW' : 'D5'));
        line.appendChild(el('span', 'l-title', it.title));
        line.appendChild(el('span', 'l-status', (C.ui.STATUS[it.status] || {}).label || it.status));
        lines.appendChild(line);
      });
      if (dd.empty) {
        var un = el('div', 'daylist-line');
        var d0 = el('span', 'l-dot');
        d0.style.background = 'rgba(22,19,11,.2)';
        un.appendChild(d0);
        un.appendChild(el('span', 'l-tag', ''));
        var t0 = el('span', 'l-title', 'Unplanned');
        t0.style.color = 'var(--ink-45)';
        un.appendChild(t0);
        lines.appendChild(un);
      } else {
        dd.missing.forEach(function (m) {
          var miss = el('div', 'daylist-line');
          var dm = el('span', 'l-dot');
          dm.style.background = 'var(--pink)';
          miss.appendChild(dm);
          miss.appendChild(el('span', 'l-tag', m === 'cw' ? 'CW' : 'D5'));
          var tm = el('span', 'l-title', m === 'cw' ? 'No crossword' : 'No Daily Five');
          tm.style.color = 'var(--pink)';
          miss.appendChild(tm);
          lines.appendChild(miss);
        });
      }
      row.appendChild(lines);

      var ready = el('div', 'daylist-ready' + (!day.scheduled && dd.blocked && !dd.empty ? ' blocked' : ''), dd.readiness);
      row.appendChild(ready);
      wrap.appendChild(row);
    });

    var keys = el('div', 'daylist-keys');
    ['↑↓ move', '↵ open', 'S schedule', 'P preview'].forEach(function (k) { keys.appendChild(el('span', null, k)); });
    wrap.appendChild(keys);
    return wrap;
  }

  // ------------------------------------------------------------------
  // inspector
  // ------------------------------------------------------------------

  function inspector(mount) {
    var day = days()[st().day];
    var dd = C.deriveDay(day);
    var wrap = el('div', 'inspector');

    var head = el('div', 'inspector-head');
    var titles = el('div');
    titles.style.minWidth = '0';
    titles.appendChild(el('div', 'inspector-title', day.longLabel + ' drop'));
    titles.appendChild(el('div', 'inspector-sub', subline(day, dd)));
    head.appendChild(titles);
    head.appendChild(el('div', 'spacer'));
    var readyKey = day.scheduled ? 'queued' : dd.empty ? 'unplanned' : dd.blocked ? 'blocked' : dd.live ? 'live' : 'ready';
    head.appendChild(C.ui.pill(readyKey));
    wrap.appendChild(head);

    var body = el('div', 'inspector-body');

    var cw = 0, d5 = 0;
    var cwTotal = dd.items.filter(function (i) { return i.kind === 'cw'; }).length;
    var d5Total = dd.items.filter(function (i) { return i.kind === 'd5'; }).length;
    dd.items.forEach(function (it, i) {
      var n = it.kind === 'cw' ? ++cw : ++d5;
      var total = it.kind === 'cw' ? cwTotal : d5Total;
      body.appendChild(slotPanel(it, n, total, day, i));
    });
    dd.missing.forEach(function (m) {
      body.appendChild(emptySlotPanel(m, day));
    });

    if (!day.past && !dd.live) {
      var adds = el('div', 'btn-row');
      ['cw', 'd5'].forEach(function (kind) {
        var b = el('button', 'slot-add', kind === 'cw' ? '+ Add crossword' : '+ Add Daily Five');
        b.type = 'button';
        b.addEventListener('click', function () { openPicker(day, kind); }); // P1 puzzle picker
        adds.appendChild(b);
      });
      body.appendChild(adds);
    }
    body.appendChild(el('div', 'panel-note', 'A day needs at least one crossword and one Daily Five. Extra games appear in the feed after the lead pair, in the order listed here.'));
    wrap.appendChild(body);

    wrap.appendChild(publishPanel(day, dd, mount));
    wrap.appendChild(auditPanel(day));
    return wrap;
  }

  function subline(day, dd) {
    if (dd.empty) return 'Nothing planned yet. Add a crossword and a Daily Five to open this drop.';
    if (dd.missing.length) return 'A required slot is unfilled. Publishing is blocked until the day has at least one crossword and one Daily Five.';
    if (dd.live) return 'Serving now. ' + dd.items.length + ' games live. 68% completion, target 65%.';
    if (day.scheduled) return dd.items.length + ' games queued at ' + day.publishTime + ' ' + (day.publishMode === 'local' ? 'player-local time' : 'UTC') + '.';
    return dd.items.length + ' games paired and validated.';
  }

  function slotPanel(item, n, total, day, index) {
    var p = C.find.puzzle(item.id);
    var editable = !day.past && !C.deriveDay(day).live;
    var panel = el('div', 'panel');
    var head = el('div', 'panel-head');
    head.appendChild(el('span', 'panel-kind', (item.kind === 'cw' ? 'Crossword' : 'Daily Five') + (total > 1 ? ' ' + n : '')));
    head.appendChild(el('span', 'panel-title', item.title));
    head.appendChild(el('span', 'panel-id', item.id));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.status(item.status));
    panel.appendChild(head);

    panel.appendChild(C.ui.checklist(C.store.checks[item.status] || C.store.checks.approved));

    var foot = el('div', 'panel-foot');
    foot.appendChild(C.ui.button('Open in editor', {
      small: true,
      onClick: function () { C.go('#/library/' + item.id); }
    }));
    if (editable) {
      foot.appendChild(C.ui.button('Replace', { small: true, onClick: function () { openReplace(day, index); } }));
      if (total > 1) {
        foot.appendChild(C.ui.button('Move up', {
          small: true,
          disabled: siblingIndex(day, index, -1) < 0,
          onClick: function () { moveItem(day, index, -1); }
        }));
        foot.appendChild(C.ui.button('Move down', {
          small: true,
          disabled: siblingIndex(day, index, 1) < 0,
          onClick: function () { moveItem(day, index, 1); }
        }));
      }
    }
    foot.appendChild(el('div', 'spacer'));
    if (total > 1) {
      foot.appendChild(el('span', 'panel-id', kindLabel(item.kind) + ' ' + n + ' of ' + total));
    }
    foot.appendChild(el('span', 'panel-id', 'Updated ' + (p ? p.updatedAt : '—') + ' · v' + (p ? p.version : 1)));
    panel.appendChild(foot);
    return panel;
  }

  function emptySlotPanel(kind, day) {
    var panel = el('div', 'panel');
    var head = el('div', 'panel-head');
    head.appendChild(el('span', 'panel-kind', kind === 'cw' ? 'Crossword' : 'Daily Five'));
    var t = el('span', 'panel-title', 'No ' + kindWord(kind) + ' selected');
    t.style.color = 'var(--pink)';
    head.appendChild(t);
    head.appendChild(el('div', 'spacer'));
    head.appendChild(C.ui.status('empty'));
    panel.appendChild(head);
    panel.appendChild(C.ui.checklist(C.store.checks.empty));
    var foot = el('div', 'panel-foot');
    foot.appendChild(C.ui.button('Choose a ' + kindWord(kind), {
      variant: 'pink', small: true,
      onClick: function () { openPicker(day, kind); }
    }));
    foot.appendChild(el('div', 'spacer'));
    foot.appendChild(el('span', 'panel-id', 'Slot empty'));
    panel.appendChild(foot);
    return panel;
  }

  // ------------------------------------------------------------------
  // publish time
  // ------------------------------------------------------------------

  function publishPanel(day, dd, mount) {
    var s = st();
    var isLocal = s.mode === 'local';
    var wrap = el('div', 'publish-panel');

    var left = el('div');
    var modeRow = el('div', 'btn-row');
    modeRow.appendChild(el('span', 'eyebrow', 'Publish time'));
    modeRow.appendChild(C.ui.segmented(
      [{ key: 'utc', label: 'UTC' }, { key: 'local', label: 'Player local' }],
      s.mode,
      function (k) { s.mode = k; repaint(mount); }
    ));
    left.appendChild(modeRow);

    var stepRow = el('div', 'time-stepper');
    stepRow.style.marginTop = '8px';
    var stepper = el('div', 'stepper');
    var minus = el('button', null, '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', 'Earlier by one hour');
    minus.addEventListener('click', function () { s.hour = (s.hour + 23) % 24; repaint(mount); });
    stepper.appendChild(minus);
    stepper.appendChild(el('span', 'val', pad2(s.hour)));
    var plus = el('button', null, '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', 'Later by one hour');
    plus.addEventListener('click', function () { s.hour = (s.hour + 1) % 24; repaint(mount); });
    stepper.appendChild(plus);
    stepRow.appendChild(stepper);
    var colon = el('span', null, ':');
    colon.style.font = '800 14px var(--mono)';
    stepRow.appendChild(colon);
    var mins = el('div', 'minutes');
    [0, 15, 30, 45].forEach(function (m) {
      var b = el('button', s.minute === m ? 'is-on' : null, String(m).padStart(2, '0'));
      b.type = 'button';
      b.addEventListener('click', function () { s.minute = m; repaint(mount); });
      mins.appendChild(b);
    });
    stepRow.appendChild(mins);
    left.appendChild(stepRow);

    var presets = el('div', 'time-presets');
    presets.style.marginTop = '8px';
    [['00:00', 'Midnight UTC'], ['06:00', 'Morning EU'], ['12:00', 'Noon UTC'], ['17:00', 'Evening EU']].forEach(function (t) {
      var on = timeString() === t[0];
      var b = el('button', 'chip chip-sm' + (on ? ' is-on' : ''), t[1] + ' ' + t[0]);
      b.type = 'button';
      b.addEventListener('click', function () {
        var parts = t[0].split(':');
        s.hour = Number(parts[0]);
        s.minute = Number(parts[1]);
        repaint(mount);
      });
      presets.appendChild(b);
    });
    left.appendChild(presets);
    wrap.appendChild(left);

    var right = el('div', 'localtimes');
    right.appendChild(el('div', 'mode-note', isLocal
      ? 'Every player gets the drop at ' + timeString() + ' on their own clock. It rolls across time zones over 26 hours, starting in UTC+14.'
      : 'One instant worldwide. Players see it at the local times below.'));
    CITIES.forEach(function (c) {
      var line = el('div', 'localtime');
      line.appendChild(el('span', 'city', c[0]));
      if (isLocal) {
        line.appendChild(el('span', 't', timeString()));
        line.appendChild(el('span', 'd', '= ' + pad2(s.hour - c[1]) + ':' + String(s.minute).padStart(2, '0') + ' UTC'));
      } else {
        var t = s.hour + c[1];
        line.appendChild(el('span', 't', pad2(t) + ':' + String(s.minute).padStart(2, '0')));
        line.appendChild(el('span', 'd', t < 0 ? '−1 day' : t >= 24 ? '+1 day' : ''));
      }
      right.appendChild(line);
    });
    wrap.appendChild(right);

    wrap.appendChild(el('div', 'spacer'));

    var blocked = dd.blocked || dd.empty || day.past;
    var confirm = C.ui.button(
      day.scheduled ? 'Unschedule' : blocked ? 'Cannot schedule yet' : 'Confirm schedule',
      {
        variant: day.scheduled ? 'danger' : 'primary',
        disabled: blocked && !day.scheduled,
        onClick: function () {
          if (day.scheduled) openUnschedule(day);   // P4 unschedule
          else openScheduleReview(day);             // P2 schedule review
        }
      }
    );
    wrap.appendChild(confirm);
    if (day.scheduled) {
      var queued = el('div', 'notice');
      queued.style.flexBasis = '100%';
      queued.textContent = 'Queued for ' + day.longLabel + ' at ' + day.publishTime + ' ' + modeWord(day.publishMode) +
        '. Unschedule to change the time, or replace a game to return the day to Ready.';
      wrap.appendChild(queued);
    }
    if (blocked && !day.scheduled) {
      var why = el('div', 'notice blocked');
      why.style.flexBasis = '100%';
      why.textContent = dd.empty
        ? 'Blocked: this day has no crossword and no Daily Five yet. Add at least one of each.'
        : dd.missing.length
          ? 'Blocked: the day is missing a ' + (dd.missing.indexOf('cw') >= 0 ? 'crossword' : 'Daily Five') + '.'
          : day.past ? 'This day has already published.' : 'Blocked: one or more games are not approved yet.';
      wrap.appendChild(why);
    }
    return wrap;
  }

  function auditPanel(day) {
    var wrap = el('div');
    wrap.className = 'screen-pad rule-top';
    wrap.appendChild(el('div', 'eyebrow', 'Audit'));
    var list = el('div', 'audit-list');
    list.style.marginTop = '8px';
    C.store.audit.filter(function (a) {
      return a.object === 'day ' + day.iso;
    }).forEach(function (a) { list.appendChild(C.ui.auditLine(a)); });
    day.audit.forEach(function (a) {
      var line = el('div', 'audit-line');
      line.appendChild(el('span', 'when', a.time));
      line.appendChild(el('span', 'who', a.operator));
      line.appendChild(el('span', 'what', a.text));
      list.appendChild(line);
    });
    wrap.appendChild(list);
    return wrap;
  }

  // ------------------------------------------------------------------
  // assembly
  // ------------------------------------------------------------------

  function build(mount) {
    var banner = gapBanner(mount);
    if (banner) mount.appendChild(banner);
    mount.appendChild(toolbar(mount));
    mount.appendChild(bulkBar(mount));

    var grid = el('div', 'desk-grid ' + st().view);
    if (st().view === 'calendar') grid.appendChild(calendar(mount));
    else grid.appendChild(dayList(mount));
    grid.appendChild(inspector(mount));
    mount.appendChild(grid);
  }

  C.registerScreen('#/desk', {
    title: 'Drop desk',
    subline: function () { return C.store.todayLabel + ' · demo data'; },
    actions: function () {
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.densitySwitch());
      row.appendChild(C.ui.button('Schedule drop', {
        variant: 'pink',
        onClick: function () {
          var day = days()[st().day];
          var why = blockReason(day);
          if (day.scheduled) { openUnschedule(day); return; }
          if (why) { C.toast(day.longLabel + ' cannot be scheduled: ' + why.toLowerCase() + '.'); return; }
          openScheduleReview(day);
        }
      }));
      return row;
    },
    render: function (mount) { build(mount); }
  });
})(window.Console);
