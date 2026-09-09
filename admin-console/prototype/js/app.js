/* Crosscut admin console prototype — store, router and shell.
   Load order: data.js → ui.js → app.js → screens/*.js → boot (index.html).
   No modules, no build step: everything hangs off the single global `Console`. */
window.Console = window.Console || {};

(function (C) {
  'use strict';

  // ---------------------------------------------------------------------
  // store
  // ---------------------------------------------------------------------

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* The store object exists at parse time so screen files can hang per-area UI
     state off `store.ui` while they load, but its *contents* are copied from
     `Console.data` only in `Console.seed()`, which `Console.boot()` calls. That
     lets every `js/data/<area>.js` extension file run first and push records
     into `Console.data.<collection>` before anything is cloned. */
  var COLLECTIONS = [
    'operators', 'environments', 'puzzles', 'collections', 'days',
    'players', 'supportActions', 'flags', 'boards', 'ledger', 'purchases',
    'placements', 'adRules', 'signals', 'importBatches', 'audit'
  ];

  C.store = {
    /* session.session is the demo Better Auth session: {provider, expires}. */
    session: { operator: null, environment: 'demo', session: null, lastSignIn: null },
    ui: {}
  };

  COLLECTIONS.forEach(function (key) { C.store[key] = Array.isArray(C.data[key]) ? [] : {}; });
  C.store.todayIso = C.data.todayIso;
  C.store.todayLabel = C.data.todayLabel;

  /* Console.seed() — copy Console.data into the store. Called by boot(); safe to
     call again to reset the session to the seed. */
  C.seed = function () {
    COLLECTIONS.forEach(function (key) { C.store[key] = clone(C.data[key]); });
    C.store.todayIso = C.data.todayIso;
    C.store.todayLabel = C.data.todayLabel;
  };

  // Small lookup helpers every builder can rely on.
  C.find = {
    puzzle: function (id) { return C.store.puzzles.filter(function (p) { return p.id === id; })[0] || null; },
    player: function (id) { return C.store.players.filter(function (p) { return p.id === id; })[0] || null; },
    collection: function (id) { return C.store.collections.filter(function (c) { return c.id === id; })[0] || null; },
    day: function (iso) { return C.store.days.filter(function (d) { return d.iso === iso; })[0] || null; },
    operator: function (id) { return C.store.operators.filter(function (o) { return o.id === id; })[0] || null; }
  };

  // ---------------------------------------------------------------------
  // audit + commit
  // ---------------------------------------------------------------------

  var clockMinutes = 12 * 60 + 8; // demo wall clock, advances a little per commit

  function stamp() {
    clockMinutes += 1;
    var h = Math.floor(clockMinutes / 60) % 24;
    var m = clockMinutes % 60;
    return 'Sep 8 ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /* Console.commit({action, object, reason, result, apply})
     - apply(store) runs the mutation (optional; omit for read-only records)
     - always appends one audit entry and returns it
     - re-renders the current screen unless {silent:true} */
  C.commit = function (spec) {
    if (spec.apply) spec.apply(C.store);
    var entry = {
      time: spec.time || stamp(),
      operator: (C.store.session.operator && C.store.session.operator.handle) || 'unknown',
      action: spec.action || 'Change',
      object: spec.object || '',
      reason: spec.reason || '',
      result: spec.result || 'Done'
    };
    C.store.audit.unshift(entry);
    if (!spec.silent) C.render();
    return entry;
  };

  // ---------------------------------------------------------------------
  // authentication — a design model of Better Auth
  // ---------------------------------------------------------------------

  /* Better Auth owns operator accounts, roles and sessions. Nothing here talks
     to a server, no credential is ever read or kept: the password field is a
     prototype affordance and any non-empty value is accepted. */

  C.auth = {
    email: function (op) {
      return op.email || (op.handle + '@' + C.data.auth.emailDomain);
    },
    byEmail: function (email) {
      var want = String(email || '').trim().toLowerCase();
      if (!want) return null;
      return C.store.operators.filter(function (o) {
        return C.auth.email(o).toLowerCase() === want;
      })[0] || null;
    },
    providerLabel: function (id) {
      return (C.data.auth.providerLabels && C.data.auth.providerLabels[id]) || id;
    },
    /* Starts a demo session and opens the console. `provider` is one of
       password | google | apple | passkey. */
    signIn: function (op, provider, environment) {
      var label = C.auth.providerLabel(provider);
      C.store.session.operator = op;
      C.store.session.environment = environment || C.store.session.environment;
      C.store.session.lastSignIn = 'Now · this session';
      C.store.session.session = { provider: provider, expires: C.data.auth.sessionExpiry };
      op.lastSignIn = 'Now · this session';
      C.commit({
        action: 'Sign in', object: op.handle, reason: '',
        result: 'Signed in with ' + label + ' to ' + C.store.session.environment +
          '; session expires ' + C.data.auth.sessionExpiry,
        silent: true
      });
      C.go(firstAllowedRoute());
    },
    signOut: function () {
      C.store.session.operator = null;
      C.store.session.session = null;
      C.store.session.lastSignIn = null;
      C.go('#/signin');
    }
  };

  // ---------------------------------------------------------------------
  // navigation and roles
  // ---------------------------------------------------------------------

  C.nav = [
    { area: 'desk', route: '#/desk', label: 'Daily challenge', roles: ['publisher'], badge: function () { return blockedDays(); } },
    { area: 'library', route: '#/library', label: 'Library', roles: ['content_editor'], badge: function () { return C.store.puzzles.length; } },
    { area: 'collections', route: '#/collections', label: 'Collections', roles: ['publisher', 'integrity'], badge: function () { return mergedBadge(); } },
    { area: 'players', route: '#/players', label: 'Players', roles: ['support'], badge: function () { return C.store.players.length; } },
    { area: 'economy', route: '#/economy', label: 'Economy', roles: ['economy'], badge: function () { return ''; } },
    { area: 'ads', route: '#/ads', label: 'Ads', roles: ['ads'], badge: function () { return ''; } },
    { area: 'operations', route: '#/operations', label: 'Operations', roles: ['operations'], badge: function () { return failedSignals(); } },
    { area: 'access', route: '#/access', label: 'Access', roles: ['console_admin'], badge: function () { return ''; } },
    { area: 'audit', route: '#/audit', label: 'Audit log', roles: ['console_admin'], badge: function () { return ''; } }
  ];

  function blockedDays() {
    var n = C.store.days.filter(function (d) {
      if (d.past || d.scheduled || !d.items.length) return false;
      return C.deriveDay(d).blocked;
    }).length;
    return n || '';
  }
  function openFlags() {
    var n = C.store.flags.filter(function (f) { return !f.decision; }).length;
    return n || '';
  }
  /* Collections is one area with two role-gated tabs, so its
     badge counts whichever side the operator can actually act on: flagged
     solves first, because they are the ones that wait on a decision. */
  function mergedBadge() {
    if (C.hasRole('integrity')) {
      var flags = openFlags();
      if (flags) return flags;
      if (!C.hasRole('publisher')) return '';
    }
    return C.hasRole('publisher') ? C.store.collections.length : '';
  }
  function failedSignals() {
    var n = C.store.signals.filter(function (s) { return s.level === 'failed'; }).length;
    return n || '';
  }

  C.hasRole = function (role) {
    var op = C.store.session.operator;
    return !!(op && op.roles.indexOf(role) >= 0);
  };

  C.canSee = function (area) {
    var entry = C.nav.filter(function (n) { return n.area === area; })[0];
    if (!entry) return true;
    return entry.roles.some(C.hasRole);
  };

  // Derived readiness for a day. Shared by the desk and by publishing screens.
  // A drop is exactly one crossword and one Daily Five — never more, never fewer.
  C.deriveDay = function (day) {
    var items = day.items.map(function (id) {
      var p = C.find.puzzle(id);
      return p ? { id: p.id, kind: p.kind, title: p.title, status: day.scheduled && p.status === 'approved' ? 'scheduled' : p.status } : null;
    }).filter(Boolean);
    var cw = items.filter(function (i) { return i.kind === 'cw'; });
    var d5 = items.filter(function (i) { return i.kind === 'd5'; });
    var slots = { cw: cw[0] || null, d5: d5[0] || null };
    var missing = [];
    if (!cw.length) missing.push('cw');
    if (!d5.length) missing.push('d5');
    // Should never happen: the day model holds one game per kind.
    var extra = [];
    if (cw.length > 1) extra.push('more than one crossword');
    if (d5.length > 1) extra.push('more than one Daily Five');
    var okStates = ['published', 'live', 'scheduled', 'approved'];
    function slotOk(it) { return !!it && okStates.indexOf(it.status) >= 0; }
    var okCount = (slotOk(slots.cw) ? 1 : 0) + (slotOk(slots.d5) ? 1 : 0);
    var live = items.some(function (i) { return i.status === 'live'; });
    var done = items.length > 0 && items.every(function (i) { return i.status === 'published'; });
    var empty = items.length === 0;
    var blocked = missing.length > 0 || extra.length > 0 || okCount < items.length;
    return {
      items: items, slots: slots, missing: missing, extra: extra,
      blocked: blocked, live: live, done: done, empty: empty,
      readiness: day.scheduled ? 'Queued' : live ? 'Live' : done ? 'Done' : empty ? 'Unplanned'
        : okCount + ' / 2'
    };
  };

  // ---------------------------------------------------------------------
  // screen registry + router
  // ---------------------------------------------------------------------

  C.screens = {};

  /* Route aliases: a route that used to be its own area and now lives inside a
     merged one. `Console.alias('#/old', '#/new', before)` keeps the old hash
     working — `before()` runs first, so the target screen can be opened on the
     right tab. The redirect happens before the router matches, so an alias
     never needs a screen of its own. */
  C.aliases = {};
  C.alias = function (from, to, before) {
    C.aliases[from] = { route: to, before: before || null };
  };

  /* Console.registerScreen('#/players/:id', {title, subline, render(mount, params), actions})
     - title/subline may be a string or a function(params)
     - actions(params) may return a DOM node placed in the header action slot */
  C.registerScreen = function (route, def) {
    C.screens[route] = Object.assign({ route: route }, def);
  };

  function parseHash() {
    var raw = (location.hash || '').replace(/^#/, '');
    if (!raw || raw === '/') raw = '/desk';
    var parts = raw.split('/').filter(Boolean);
    return parts;
  }

  function matchRoute(parts) {
    var routes = Object.keys(C.screens);
    for (var i = 0; i < routes.length; i++) {
      var pat = routes[i].replace(/^#\//, '').split('/').filter(Boolean);
      if (pat.length !== parts.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < pat.length; j++) {
        if (pat[j].charAt(0) === ':') params[pat[j].slice(1)] = decodeURIComponent(parts[j]);
        else if (pat[j] !== parts[j]) { ok = false; break; }
      }
      if (ok) return { def: C.screens[routes[i]], params: params, area: parts[0] };
    }
    return null;
  }

  C.go = function (route) {
    if (location.hash === route) C.render();
    else location.hash = route;
  };

  C.currentRoute = function () { return location.hash || '#/desk'; };

  // ---------------------------------------------------------------------
  // rendering
  // ---------------------------------------------------------------------

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  C.el = el;

  function firstAllowedRoute() {
    var entry = C.nav.filter(function (n) { return n.roles.some(C.hasRole); })[0];
    return entry ? entry.route : '#/signin';
  }

  function renderSidebar() {
    var op = C.store.session.operator;
    var env = C.store.environments.filter(function (e) { return e.id === C.store.session.environment; })[0];

    var side = el('div', 'sidebar');

    var brand = el('div', 'brand');
    var name = el('div', 'brand-name');
    name.appendChild(document.createTextNode('Crosscut'));
    var dot = el('span', 'dot', '.');
    name.appendChild(dot);
    brand.appendChild(name);
    var line = el('div', 'brand-line');
    line.appendChild(el('span', 'brand-word', 'Console'));
    line.appendChild(el('span', 'env-badge env-' + env.id, env.label));
    brand.appendChild(line);
    side.appendChild(brand);

    var nav = el('nav', 'nav');
    nav.setAttribute('aria-label', 'Console areas');
    var here = C.currentRoute();
    C.nav.forEach(function (item) {
      if (!item.roles.some(C.hasRole)) return;
      var b = el('button', 'nav-item' + (here.indexOf(item.route) === 0 ? ' is-active' : ''));
      b.type = 'button';
      b.appendChild(el('span', null, item.label));
      b.appendChild(el('span', 'nav-badge', String(item.badge ? item.badge() : '')));
      b.addEventListener('click', function () { C.go(item.route); });
      nav.appendChild(b);
    });
    side.appendChild(nav);
    side.appendChild(el('div', 'spacer'));

    var card = el('div', 'op-card');
    card.appendChild(el('div', 'eyebrow', 'Operator'));
    card.appendChild(el('div', 'op-name', op.handle));
    card.appendChild(el('div', 'op-roles', op.roles.map(function (r) { return C.data.roles[r].label; }).join(' · ')));
    var out = el('button', 'btn btn-sm btn-quiet', 'Sign out');
    out.type = 'button';
    out.addEventListener('click', function () { C.auth.signOut(); });
    card.appendChild(out);
    side.appendChild(card);
    return side;
  }

  /* The sign-in screen models Better Auth: email and password plus the social
     providers. Nothing leaves the browser — the password field accepts any
     non-empty value and is never read or stored. */
  function renderSignin(root) {
    var envPicked = C.store.session.environment;
    var cfg = C.data.auth;

    var page = el('div', 'signin-page');
    var card = el('div', 'signin-card');

    // --- head: wordmark, Console, environment chips -------------------
    var head = el('div', 'signin-head');
    var t = el('div', 'signin-title');
    t.appendChild(document.createTextNode('Crosscut'));
    var dot = el('span', 'dot', '.');
    dot.style.color = 'var(--pink)';
    t.appendChild(dot);
    head.appendChild(t);

    var brandRow = el('div', 'signin-brand-row');
    brandRow.appendChild(el('span', 'signin-word', 'Console'));
    var envRow = el('div', 'btn-row');
    C.store.environments.forEach(function (e) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.dataset.env = e.id;
      b.textContent = e.label;
      b.addEventListener('click', function () { envPicked = e.id; paintEnv(); });
      envRow.appendChild(b);
    });
    brandRow.appendChild(envRow);
    head.appendChild(brandRow);
    card.appendChild(head);

    function paintEnv() {
      Array.prototype.forEach.call(envRow.children, function (n) {
        n.classList.toggle('is-on', n.dataset.env === envPicked);
      });
    }

    // --- body ---------------------------------------------------------
    var body = el('div', 'signin-body');

    var msg = el('div', 'signin-msg');
    msg.setAttribute('role', 'status');
    msg.hidden = true;
    function setMsg(text) {
      msg.textContent = text || '';
      msg.hidden = !text;
    }

    var form = el('form', 'signin-form');
    form.noValidate = true;

    var emailRow = el('div', 'form-row');
    var emailLabel = el('label', 'label', 'Email');
    emailLabel.setAttribute('for', 'signin-email');
    emailRow.appendChild(emailLabel);
    var emailIn = el('input', 'input');
    emailIn.type = 'email';
    emailIn.id = 'signin-email';
    emailIn.name = 'email';
    emailIn.autocomplete = 'username';
    emailIn.placeholder = 'you@' + cfg.emailDomain;
    emailIn.addEventListener('input', function () { setMsg(''); });
    emailRow.appendChild(emailIn);
    form.appendChild(emailRow);

    var pwRow = el('div', 'form-row');
    var pwLabel = el('label', 'label', 'Password');
    pwLabel.setAttribute('for', 'signin-password');
    pwRow.appendChild(pwLabel);
    var pwIn = el('input', 'input');
    pwIn.type = 'password';
    pwIn.id = 'signin-password';
    pwIn.name = 'password';
    pwIn.autocomplete = 'off';
    pwIn.placeholder = 'Password';
    pwIn.addEventListener('input', function () { setMsg(''); });
    pwRow.appendChild(pwIn);
    form.appendChild(pwRow);

    form.appendChild(msg);

    var go = el('button', 'btn btn-pink signin-submit', 'Sign in');
    go.type = 'submit';
    form.appendChild(go);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      attempt();
    });
    body.appendChild(form);

    function attempt() {
      var email = emailIn.value.trim();
      if (!email) { setMsg('Enter your email address.'); emailIn.focus(); return; }
      var op = C.auth.byEmail(email);
      if (!op) {
        setMsg('No operator account for this email. Ask a console admin to invite you.');
        return;
      }
      if (op.status === 'suspended') { setMsg('This account is deactivated.'); return; }
      if (!pwIn.value) { setMsg('Enter your password.'); pwIn.focus(); return; }
      setMsg('');
      C.auth.signIn(op, 'password', envPicked);
    }

    // --- social providers --------------------------------------------
    var or = el('div', 'signin-or');
    or.appendChild(el('span', null, 'or'));
    body.appendChild(or);

    var social = el('div', 'signin-social');
    (cfg.socials || []).forEach(function (p) {
      var b = el('button', 'btn signin-provider', 'Continue with ' + p.label);
      b.type = 'button';
      b.addEventListener('click', function () { pickAccount(p); });
      social.appendChild(b);
    });
    body.appendChild(social);

    /* Social sign-in: the provider's account chooser, modelled. */
    function pickAccount(provider) {
      var list = el('div', 'acct-list');
      C.store.operators.forEach(function (o) {
        var off = o.status === 'suspended';
        var b = el('button', 'acct-choice' + (off ? ' is-off' : ''));
        b.type = 'button';
        b.appendChild(el('span', 'op-initials', initials(o)));
        var txt = el('span', 'op-choice-text');
        txt.appendChild(el('span', 'acct-email', C.auth.email(o)));
        var sub = el('span', 'op-choice-roles', o.name);
        if (off) sub.textContent = o.name + ' · deactivated';
        txt.appendChild(sub);
        b.appendChild(txt);
        b.addEventListener('click', function () {
          C.ui.closeModal();
          if (off) { setMsg('This account is deactivated.'); return; }
          emailIn.value = C.auth.email(o);
          C.auth.signIn(o, provider.id, envPicked);
        });
        list.appendChild(b);
      });
      var wrap = el('div');
      wrap.appendChild(list);
      C.ui.modal({
        title: 'Choose an account',
        body: wrap,
        secondary: { label: 'Cancel' }
      });
    }

    // --- demo operators ----------------------------------------------
    function initials(o) { return o.handle.replace('.', '').slice(0, 2).toUpperCase(); }

    var demo = el('div', 'signin-demo');
    demo.appendChild(el('div', 'label', 'Demo operators'));
    var list = el('div', 'signin-demo-list');
    C.store.operators.forEach(function (o) {
      var off = o.status === 'suspended';
      var b = el('button', 'op-choice' + (off ? ' is-off' : ''));
      b.type = 'button';
      b.dataset.op = o.id;
      b.appendChild(el('span', 'op-initials', initials(o)));
      var txt = el('span', 'op-choice-text');
      var nameLine = el('span', 'op-choice-name', o.handle + ' · ' + o.name);
      if (off) nameLine.appendChild(el('span', 'op-choice-off', 'Deactivated'));
      txt.appendChild(nameLine);
      txt.appendChild(el('span', 'op-choice-roles',
        o.roles.map(function (r) { return C.data.roles[r].label; }).join(' · ')));
      b.appendChild(txt);
      if (off) {
        b.disabled = true;
        b.title = 'Deactivated account';
      } else {
        b.addEventListener('click', function () {
          emailIn.value = C.auth.email(o);
          setMsg('');
          C.auth.signIn(o, 'password', envPicked);
        });
      }
      list.appendChild(b);
    });
    demo.appendChild(list);
    body.appendChild(demo);
    card.appendChild(body);

    var foot = el('div', 'signin-foot');
    foot.appendChild(el('div', 'help',
      'Operator accounts, roles and sessions come from Better Auth. The console stores no passwords.'));
    card.appendChild(foot);

    page.appendChild(card);
    root.appendChild(page);
    paintEnv();
    emailIn.focus();
  }

  function notPermitted(area) {
    var wrap = el('div');
    wrap.appendChild(C.ui.emptyState(
      'Your roles do not include this area (' + area + ').'
    ));
    return wrap;
  }

  C.render = function () {
    var root = document.getElementById('root');
    root.innerHTML = '';

    var parts = parseHash();

    if (parts[0] === 'signin' || !C.store.session.operator) {
      if (parts[0] !== 'signin') { location.hash = '#/signin'; return; }
      renderSignin(root);
      return;
    }

    var alias = C.aliases['#/' + parts.join('/')];
    if (alias) {
      if (alias.before) alias.before();
      location.hash = alias.route;
      return;
    }

    var hit = matchRoute(parts);
    if (!hit) { location.hash = '#/desk'; return; }

    var page = el('div', 'page');
    var app = el('div', 'app');
    app.appendChild(renderSidebar());

    var main = el('div', 'main');
    var def = hit.def;
    var params = hit.params;

    var bar = el('div', 'topbar');
    var titles = el('div');
    titles.style.minWidth = '0';
    titles.appendChild(el('div', 'topbar-title', typeof def.title === 'function' ? def.title(params) : def.title));
    titles.appendChild(el('div', 'topbar-sub', typeof def.subline === 'function' ? def.subline(params) : (def.subline || '')));
    bar.appendChild(titles);
    bar.appendChild(el('div', 'spacer'));
    var actions = el('div', 'topbar-actions');
    bar.appendChild(actions);
    main.appendChild(bar);

    var mount = el('div', 'screen');
    main.appendChild(mount);

    if (!C.canSee(hit.area)) {
      mount.appendChild(notPermitted(hit.area));
    } else {
      if (def.actions) {
        var a = def.actions(params);
        if (a) actions.appendChild(a);
      }
      try {
        def.render(mount, params);
      } catch (err) {
        mount.appendChild(C.ui.emptyState('This screen failed to render: ' + err.message));
        if (window.console && window.console.error) window.console.error(err);
      }
    }

    app.appendChild(main);
    page.appendChild(app);
    root.appendChild(page);
  };

  // ---------------------------------------------------------------------
  // toast + stubs
  // ---------------------------------------------------------------------

  C.toast = function (text) {
    var area = document.getElementById('toast-area');
    var t = el('div', 'toast', text);
    area.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 3200);
  };

  var BUILDER_NAMES = {
    P1: 'the publishing builder',
    E1: 'the editorial builder',
    S1: 'the support builder',
    L1: 'the integrity and economy builder',
    A1: 'the ads and operations builder',
    C1: 'the access builder'
  };

  /* Console.todo('P1') — placeholder for a flow another builder owns. */
  C.todo = function (key) {
    C.toast('Built by ' + (BUILDER_NAMES[key] || 'another builder') + '.');
  };

  // ---------------------------------------------------------------------
  // boot
  // ---------------------------------------------------------------------

  C.boot = function () {
    C.seed();
    window.addEventListener('hashchange', C.render);
    if (!location.hash) location.hash = '#/signin';
    else C.render();
  };
})(window.Console);
