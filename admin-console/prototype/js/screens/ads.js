/* Ads — placements, caps, rewards and grant health (A1, A2).
   OWNER: ads and operations builder.

   A1 Enable or pause a placement — switch → effective time (now or scheduled
      UTC) → required reason → Confirm → row updates and an audit entry lands.
   A2 Change a cap or reward rule — Edit rule → editor → review (old, new,
      affected platforms) → required reason → Confirm. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  /* The Ads screen keeps no per-render UI state: every flow lives in a modal
     and every value it edits is a record in the store. The namespace exists so
     another screen can hand state to this one later. */
  C.store.ui.ads = C.store.ui.ads || {};

  var FILL_FLOOR = 75;     // %, measured over the last 7 days
  var GRANT_FLOOR = 1;     // %, reward-grant failures over the last 7 days
  var PLATFORMS = ['iOS', 'Android'];

  function placements() { return C.store.placements; }
  function rule(id) { return C.store.adRules.filter(function (r) { return r.id === id; })[0] || null; }
  function capLabel(p) { return p.capNumber == null ? 'No cap' : p.capNumber + ' / day'; }
  function graceLabel(h) { return h ? 'No ads for ' + h + ' h' : 'No grace'; }
  function stateOf(p) { return p.enabled ? 'enabled' : 'paused'; }
  function platformText(list) { return list.length ? list.join(' · ') : 'No platform'; }

  /* Revert helper for A1: the switch flips the moment it is clicked, and flips
     back if the dialog is dismissed in any way (Cancel, ✕, Escape, backdrop).
     Watching the modal layer covers all four without touching ui.js. */
  function onModalClosed(revert) {
    var layer = document.getElementById('modal-layer');
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function () {
      if (!layer.firstChild) { obs.disconnect(); revert(); }
    });
    obs.observe(layer, { childList: true });
  }

  // ------------------------------------------------------------------
  // A1 — enable or pause a placement
  // ------------------------------------------------------------------

  function switchNode(p) {
    var b = el('button', 'adsw' + (p.enabled ? ' is-on' : ''));
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(p.enabled));
    b.setAttribute('aria-label', (p.enabled ? 'Pause ' : 'Enable ') + p.name);
    b.appendChild(el('span', 'adsw-knob'));
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      openToggle(p, b);
    });
    return b;
  }

  function paintSwitch(node, on) {
    node.classList.toggle('is-on', !!on);
    node.setAttribute('aria-checked', String(!!on));
  }

  function openToggle(p, swNode) {
    var next = !p.enabled;
    var verb = next ? 'Enable' : 'Pause';

    if (swNode) {
      paintSwitch(swNode, next);
      onModalClosed(function () { paintSwitch(swNode, p.enabled); });
    }

    var effective = 'now';
    var at = '22:00';

    var body = el('div');

    var when = el('div', 'form-row');
    when.appendChild(el('div', 'label', 'Effective time'));
    var segWrap = el('div');
    when.appendChild(segWrap);
    body.appendChild(when);

    var timeRow = el('div', 'form-row');
    var timeLab = el('label', 'label', 'Scheduled time (UTC)');
    timeRow.appendChild(timeLab);
    var time = el('input', 'input');
    time.type = 'time';
    time.value = at;
    time.style.maxWidth = '160px';
    timeLab.setAttribute('for', 'ads_eff_time');
    time.id = 'ads_eff_time';
    time.addEventListener('input', function () { at = time.value || '00:00'; paint(); });
    timeRow.appendChild(time);
    body.appendChild(timeRow);

    var reviewWrap = el('div');
    body.appendChild(reviewWrap);

    var reason = C.ui.reasonField({
      required: true,
      label: 'Reason',
      placeholder: verb === 'Pause' ? 'e.g. Fill fell below the 75% floor on Android' : 'e.g. Creative refresh shipped, re-enabling for both platforms'
    });
    body.appendChild(reason);

    function effLabel() {
      return effective === 'now' ? 'Now · Sep 8' : at + ' UTC · Sep 8';
    }

    function paint() {
      segWrap.innerHTML = '';
      segWrap.appendChild(C.ui.segmented(
        [{ key: 'now', label: 'Now' }, { key: 'scheduled', label: 'Scheduled' }],
        effective,
        function (k) { effective = k; paint(); }
      ));
      timeRow.classList.toggle('hidden', effective !== 'scheduled');
      reviewWrap.innerHTML = '';
      reviewWrap.appendChild(C.ui.reviewPanel({
        title: 'Review the change',
        before: [
          ['State', C.ui.status(stateOf(p))],
          ['Cap / day', capLabel(p)],
          ['Platforms', platformText(p.platformList)],
          ['Fill · 7 days', p.fill + ' (' + FILL_FLOOR + '% floor)']
        ],
        after: [
          ['State', effective === 'now'
            ? C.ui.status(next ? 'enabled' : 'paused')
            : C.ui.status('scheduled', (next ? 'Enable' : 'Pause') + ' at ' + at + ' UTC')],
          ['Cap / day', capLabel(p)],
          ['Platforms', platformText(p.platformList)],
          ['Effective', effLabel()]
        ],
        consequence: (next ? 'Serving resumes on ' : 'Serving stops on ') + platformText(p.platformList) + '.'
      }));
    }
    paint();

    C.ui.modal({
      title: verb + ' placement — ' + p.name,
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: verb + ' placement',
        destructive: false,
        onClick: function () {
          var immediate = effective === 'now';
          C.commit({
            action: verb + ' placement',
            object: p.id,
            reason: reason.value(),
            result: immediate
              ? (next ? 'Enabled now' : 'Paused now') + ' on ' + platformText(p.platformList)
              : (next ? 'Enable' : 'Pause') + ' scheduled for ' + at + ' UTC on ' + platformText(p.platformList),
            apply: function () {
              if (immediate) { p.enabled = next; p.scheduledChange = null; }
              else p.scheduledChange = { to: next, at: at };
            }
          });
          C.ui.closeModal();
          C.toast(immediate
            ? p.name + ' ' + (next ? 'enabled' : 'paused') + '.'
            : p.name + ': ' + (next ? 'enable' : 'pause') + ' scheduled for ' + at + ' UTC.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // A2 — rule editor for one placement
  // ------------------------------------------------------------------

  function draftOf(p) {
    return {
      cap: p.capNumber == null ? '' : String(p.capNumber),
      reward: p.reward,
      grace: String(p.graceHours),
      platforms: p.platformList.slice()
    };
  }

  function numberRow(label, help, value, onChange, min) {
    var row = el('div', 'form-row');
    var id = 'f_' + Math.random().toString(36).slice(2, 8);
    var lab = el('label', 'label', label);
    lab.setAttribute('for', id);
    row.appendChild(lab);
    var input = el('input', 'input');
    input.id = id;
    input.type = 'number';
    input.min = String(min == null ? 0 : min);
    input.value = value;
    input.style.maxWidth = '160px';
    input.addEventListener('input', function () { onChange(input.value); C.ui.refreshModal(); });
    row.appendChild(input);
    if (help) row.appendChild(el('div', 'help', help));
    return row;
  }

  function textRow(label, help, value, onChange) {
    var row = el('div', 'form-row');
    var id = 'f_' + Math.random().toString(36).slice(2, 8);
    var lab = el('label', 'label', label);
    lab.setAttribute('for', id);
    row.appendChild(lab);
    var input = el('input', 'input');
    input.id = id;
    input.type = 'text';
    input.value = value;
    input.style.maxWidth = '260px';
    input.addEventListener('input', function () { onChange(input.value); C.ui.refreshModal(); });
    row.appendChild(input);
    if (help) row.appendChild(el('div', 'help', help));
    return row;
  }

  function platformRow(selected, onChange) {
    var row = el('div', 'form-row');
    row.appendChild(el('div', 'label', 'Platforms'));
    var chips = el('div', 'btn-row');
    PLATFORMS.forEach(function (name) {
      var on = selected.indexOf(name) >= 0;
      var b = el('button', 'chip' + (on ? ' is-on' : ''), name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', function () {
        var next = on ? selected.filter(function (x) { return x !== name; }) : selected.concat([name]);
        onChange(PLATFORMS.filter(function (x) { return next.indexOf(x) >= 0; }));
      });
      chips.appendChild(b);
    });
    row.appendChild(chips);
    row.appendChild(el('div', 'help', 'With no platform selected the placement cannot serve.'));
    return row;
  }

  function openPlacementEditor(p, draft) {
    draft = draft || draftOf(p);
    var body = el('div');

    body.appendChild(el('div', 'panel-note', 'Serving rule: ' + p.rule));

    body.appendChild(numberRow('Cap per day', 'Empty means no cap.', draft.cap,
      function (v) { draft.cap = v; }));
    body.appendChild(textRow('Reward', 'Use — for a placement that grants nothing.', draft.reward,
      function (v) { draft.reward = v; }));
    body.appendChild(numberRow('First-session grace (hours)', '0 removes the grace period.', draft.grace,
      function (v) { draft.grace = v; }));

    var pRow = platformRow(draft.platforms, function (next) {
      draft.platforms = next;
      openPlacementEditor(p, draft);
    });
    body.appendChild(pRow);

    C.ui.modal({
      title: 'Edit rule — ' + p.name,
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Review change',
        disabled: function () { return !changedPairs(p, draft).length; },
        onClick: function () { openPlacementReview(p, draft); }
      }
    });
  }

  function changedPairs(p, draft) {
    var pairs = [];
    var capNext = draft.cap === '' ? null : parseInt(draft.cap, 10);
    if (capNext !== p.capNumber) {
      pairs.push(['Cap / day', capLabel(p), capNext == null ? 'No cap' : capNext + ' / day', 'cap']);
    }
    if (draft.reward !== p.reward) pairs.push(['Reward', p.reward, draft.reward || '—', 'reward']);
    if (String(draft.grace) !== String(p.graceHours)) {
      pairs.push(['First-session grace', graceLabel(p.graceHours), graceLabel(parseInt(draft.grace, 10)), 'grace']);
    }
    if (draft.platforms.join(' · ') !== p.platformList.join(' · ')) {
      pairs.push(['Platforms', platformText(p.platformList), platformText(draft.platforms), 'platforms']);
    }
    return pairs;
  }

  function openPlacementReview(p, draft) {
    var pairs = changedPairs(p, draft);
    var affected = draft.platforms.concat(p.platformList.filter(function (x) { return draft.platforms.indexOf(x) < 0; }));

    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Review the rule change',
      before: pairs.map(function (r) { return [r[0], r[1]]; }),
      after: pairs.map(function (r) { return [r[0], r[2]]; }),
      consequence: 'Affected platforms: ' + platformText(affected) + '.'
    }));
    var reason = C.ui.reasonField({
      required: true,
      label: 'Reason',
      placeholder: 'e.g. Rewarded cap raised for the September retention test, ticket #5120'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Confirm rule change — ' + p.name,
      body: body,
      wide: true,
      secondary: { label: 'Back', onClick: function () { openPlacementEditor(p, draft); } },
      primary: {
        label: 'Confirm rule change',
        onClick: function () {
          var capNext = draft.cap === '' ? null : parseInt(draft.cap, 10);
          var graceNext = parseInt(draft.grace, 10) || 0;
          C.commit({
            action: 'Change placement rule',
            object: p.id,
            reason: reason.value(),
            result: pairs.map(function (r) { return r[0] + ' ' + r[1] + ' → ' + r[2]; }).join('; '),
            apply: function () {
              p.capNumber = capNext;
              p.cap = capNext;
              p.reward = draft.reward || '—';
              p.graceHours = graceNext;
              p.platformList = draft.platforms.slice();
              p.platforms = platformText(draft.platforms);
            }
          });
          C.ui.closeModal();
          C.toast('Rule updated for ' + p.name + '.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // A2 — the two editable rule cards (grace and rewarded cap)
  // ------------------------------------------------------------------

  function rewardedPlacements() {
    return placements().filter(function (p) { return p.reward && p.reward !== '—'; });
  }

  function openGraceEditor(draftValue) {
    var current = placements()[0] ? placements()[0].graceHours : 24;
    var draft = draftValue == null ? String(current) : draftValue;

    var body = el('div');
    body.appendChild(numberRow('First-session grace (hours)',
      'Applies to every placement. 0 removes the grace period.', draft,
      function (v) { draft = v; }));

    C.ui.modal({
      title: 'Edit rule — first-session grace',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Review change',
        disabled: function () { return draft === '' || isNaN(parseInt(draft, 10)) || parseInt(draft, 10) === current; },
        onClick: function () { openGraceReview(draft, current); }
      }
    });
  }

  function openGraceReview(draft, current) {
    var next = parseInt(draft, 10);
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Review the rule change',
      before: [['First-session grace', graceLabel(current)], ['Applies to', placements().length + ' placements']],
      after: [['First-session grace', graceLabel(next)], ['Applies to', placements().length + ' placements']],
      consequence: 'Affected platforms: ' + PLATFORMS.join(' · ') + '.'
    }));
    var reason = C.ui.reasonField({ required: true, label: 'Reason', placeholder: 'e.g. Onboarding test — extend the ad-free window to 48 h' });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Confirm rule change — first-session grace',
      body: body,
      secondary: { label: 'Back', onClick: function () { openGraceEditor(draft); } },
      primary: {
        label: 'Confirm rule change',
        onClick: function () {
          C.commit({
            action: 'Change ad rule', object: 'grace', reason: reason.value(),
            result: 'First-session grace ' + graceLabel(current) + ' → ' + graceLabel(next) + ' on all ' + placements().length + ' placements',
            apply: function () {
              rule('grace').value = graceLabel(next);
              placements().forEach(function (p) { p.graceHours = next; });
            }
          });
          C.ui.closeModal();
          C.toast('First-session grace updated.');
        }
      }
    });
  }

  function openCapEditor(draftValue) {
    var r = rule('cap');
    var current = parseInt(r.value, 10);
    var draft = draftValue == null ? String(current) : draftValue;

    var body = el('div');
    body.appendChild(numberRow('Rewarded views per player per day',
      'Applies to ' + rewardedPlacements().map(function (p) { return p.name; }).join(', ') + '.',
      draft, function (v) { draft = v; }));

    C.ui.modal({
      title: 'Edit rule — rewarded cap',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Review change',
        disabled: function () { return draft === '' || parseInt(draft, 10) === current || isNaN(parseInt(draft, 10)); },
        onClick: function () { openCapReview(draft, current); }
      }
    });
  }

  function openCapReview(draft, current) {
    var next = parseInt(draft, 10);
    var affected = rewardedPlacements();
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Review the rule change',
      before: [['Rewarded cap', current + ' views / day']].concat(affected.map(function (p) { return [p.name + ' cap', capLabel(p)]; })),
      after: [['Rewarded cap', next + ' views / day']].concat(affected.map(function (p) { return [p.name + ' cap', next + ' / day']; })),
      consequence: 'Affected platforms: ' + PLATFORMS.join(' · ') + '.'
    }));
    var reason = C.ui.reasonField({ required: true, label: 'Reason', placeholder: 'e.g. Hint economy is too tight, raising the daily rewarded cap' });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Confirm rule change — rewarded cap',
      body: body,
      secondary: { label: 'Back', onClick: function () { openCapEditor(draft); } },
      primary: {
        label: 'Confirm rule change',
        onClick: function () {
          C.commit({
            action: 'Change ad rule', object: 'cap', reason: reason.value(),
            result: 'Rewarded cap ' + current + ' → ' + next + ' views / day on ' + affected.map(function (p) { return p.id; }).join(', '),
            apply: function () {
              rule('cap').value = next + ' views / day';
              rewardedPlacements().forEach(function (p) { p.capNumber = next; p.cap = next; });
            }
          });
          C.ui.closeModal();
          C.toast('Rewarded cap updated.');
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // screen
  // ------------------------------------------------------------------

  function lowFillBanner() {
    var bad = placements().filter(function (p) { return p.enabled && p.fillPct < FILL_FLOOR; });
    if (!bad.length) return null;
    var p = bad[0];
    var b = el('div', 'banner attention');
    b.appendChild(el('span', 'banner-dot'));
    b.appendChild(el('div', 'banner-text', p.name + ' filled ' + p.fill + ' over 7 days, under the ' + FILL_FLOOR + '% floor.'));
    b.appendChild(el('div', 'banner-detail', 'Lower the cap, or pause the placement until fill recovers.'));
    b.appendChild(el('div', 'spacer'));
    b.appendChild(C.ui.button('Edit rule', { small: true, onClick: function () { openPlacementEditor(p); } }));
    return b;
  }

  function fillCell(p) {
    var wrap = el('div', 'cell-stack');
    var v = el('span', 'num');
    v.textContent = p.fill;
    if (p.fillPct < FILL_FLOOR) v.style.color = 'var(--gold)';
    wrap.appendChild(v);
    wrap.appendChild(el('span', 'cell-sub', p.fillPct < FILL_FLOOR ? 'under the ' + FILL_FLOOR + '% floor' : FILL_FLOOR + '% floor'));
    return wrap;
  }

  function nameCell(p) {
    var wrap = el('div', 'cell-stack');
    wrap.appendChild(el('span', 'cell-strong', p.name));
    wrap.appendChild(el('span', 'cell-sub mono', p.id));
    if (p.scheduledChange) {
      var s = el('span', 'cell-sub');
      s.style.color = 'var(--gold)';
      s.textContent = (p.scheduledChange.to ? 'Enable' : 'Pause') + ' scheduled ' + p.scheduledChange.at + ' UTC';
      wrap.appendChild(s);
    }
    return wrap;
  }

  function placementsTable() {
    return C.ui.table({
      cols: [
        { key: 'sw', label: '', width: '46px', render: switchNode },
        { key: 'name', label: 'Placement', render: nameCell },
        { key: 'rule', label: 'Serving rule' },
        { key: 'cap', label: 'Cap / day', align: 'right', width: '92px', render: function (p) {
          return el('span', 'num', p.capNumber == null ? 'No cap' : String(p.capNumber));
        } },
        { key: 'reward', label: 'Reward', align: 'right', width: '104px', render: function (p) {
          var s = el('span', 'num', p.reward);
          if (p.reward && p.reward !== '—') s.style.color = 'var(--green)';
          return s;
        } },
        { key: 'fill', label: 'Fill · 7d', align: 'right', width: '112px', render: fillCell },
        { key: 'platforms', label: 'Platforms', align: 'right', width: '120px', render: function (p) {
          return el('span', 'cell-sub', platformText(p.platformList));
        } },
        { key: 'state', label: 'State', align: 'right', width: '96px', render: function (p) { return C.ui.status(stateOf(p)); } },
        { key: 'edit', label: '', align: 'right', width: '104px', render: function (p) {
          return C.ui.button('Edit rule', { small: true, onClick: function (e) { e.stopPropagation(); openPlacementEditor(p); } });
        } }
      ],
      rows: placements(),
      empty: 'No placements are configured for this app.'
    });
  }

  function ruleCard(r) {
    var card = el('div', 'stat');
    card.appendChild(el('span', 'eyebrow', r.label));
    var value = el('span', 'stat-value', r.value);
    card.appendChild(value);

    if (r.id === 'grant_health') {
      var pct = parseFloat(r.value);
      if (pct >= GRANT_FLOOR) value.style.color = 'var(--pink)';
      card.appendChild(el('span', 'stat-note',
        'Reward grants · all placements · 7 days · ' + GRANT_FLOOR + '% alert floor'));
      card.appendChild(C.ui.button('Open grant signal in Operations', {
        small: true,
        onClick: function () {
          C.store.ui.operations = C.store.ui.operations || {};
          C.store.ui.operations.tab = 'signals';
          C.store.ui.operations.signal = 'sig_reward_grants';
          C.go('#/operations');
        }
      }));
    } else {
      card.appendChild(el('span', 'stat-note', r.note));
      card.appendChild(C.ui.button('Edit rule', {
        small: true,
        onClick: r.id === 'grace' ? function () { openGraceEditor(); } : function () { openCapEditor(); }
      }));
    }
    return card;
  }

  function boundaryBar() {
    var bar = el('div', 'banner calm');
    bar.appendChild(el('div', 'banner-text', 'Campaigns, targeting and revenue stay in AdMob.'));
    bar.appendChild(el('div', 'spacer'));
    bar.appendChild(C.ui.button('Open AdMob', {
      small: true,
      onClick: function () { C.toast('AdMob opens outside the console.'); }
    }));
    return bar;
  }

  function build(mount) {
    mount.appendChild(boundaryBar());
    var banner = lowFillBanner();
    if (banner) mount.appendChild(banner);

    var head = el('div', 'section-head');
    head.appendChild(el('div', 'section-title', 'Placements'));
    mount.appendChild(head);
    mount.appendChild(placementsTable());

    var rhead = el('div', 'section-head rule-top');
    rhead.appendChild(el('div', 'section-title', 'Reward rules'));
    rhead.appendChild(el('div', 'panel-note', 'App-wide · effective at the next app launch'));
    mount.appendChild(rhead);

    var pad = el('div', 'screen-pad');
    var cards = el('div', 'cards-3');
    C.store.adRules.forEach(function (r) { cards.appendChild(ruleCard(r)); });
    pad.appendChild(cards);
    mount.appendChild(pad);
  }

  C.registerScreen('#/ads', {
    title: 'Ads',
    subline: 'Placements, caps and rewards',
    render: function (mount) { build(mount); }
  });

  // ------------------------------------------------------------------
  // screen-specific CSS
  // ------------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent = [
    '.adsw{width:32px;height:18px;border-radius:999px;border:1px solid var(--ink);background:var(--ink-28);position:relative;cursor:pointer;padding:0;flex:none}',
    '.adsw.is-on{background:var(--green)}',
    '.adsw-knob{position:absolute;top:1px;left:1px;width:14px;height:14px;border-radius:50%;background:var(--paper);border:1px solid var(--ink);transition:left .12s ease}',
    '.adsw.is-on .adsw-knob{left:15px}',
    '.cell-stack{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.align-right .cell-stack{align-items:flex-end}',
    '.cell-strong{font:700 13px var(--sans)}',
    '.cell-sub{font:500 11px var(--mono);color:var(--ink-55)}',
    '.stat .btn{align-self:flex-start;margin-top:4px}'
  ].join('\n');
  document.head.appendChild(style);
})(window.Console);
