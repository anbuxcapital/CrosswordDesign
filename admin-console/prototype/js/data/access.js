/* Access area — demo data extension (owner: access builder).
   Runs after js/data.js and before the store is seeded, so it may add fields to
   existing records and insert new ones. It never reassigns an array and never
   removes or reorders a record another builder owns. */
(function (C) {
  'use strict';

  // Operator account fields the Access screen shows but the shared seed does
  // not carry: when the account last signed in, and whether it is still active.
  var ACCOUNTS = {
    op_molsen: { lastSignIn: 'Sep 8 08:02', status: 'active', invitedBy: 'founding operator', invitedOn: 'Jan 12 2026' },
    op_areid: { lastSignIn: 'Sep 8 07:44', status: 'active', invitedBy: 'm.olsen', invitedOn: 'Feb 3 2026' },
    op_snovak: { lastSignIn: 'Sep 8 09:41', status: 'active', invitedBy: 'm.olsen', invitedOn: 'Mar 18 2026' },
    op_tbaros: { lastSignIn: 'Sep 5 11:26', status: 'active', invitedBy: 'm.olsen', invitedOn: 'Jun 1 2026' }
  };

  C.data.operators.forEach(function (op) {
    var extra = ACCOUNTS[op.id];
    if (!extra) return;
    Object.keys(extra).forEach(function (k) { op[k] = extra[k]; });
  });

  /* One extra audit entry whose object is deliberately outside the console, so
     the audit detail panel can show the "no screen owns this object" state.
     Inserted in place (Sep 3 sits between Sep 5 and Aug 30) so the seeded
     newest-first order is preserved and no existing entry moves relative to
     another. */
  var ENTRY = {
    time: 'Sep 3 14:22',
    operator: 't.baros',
    action: 'Rotate admin token',
    object: 'token_console_admin',
    reason: 'Quarterly rotation, ticket #4402',
    result: 'Token rotated; the previous token was revoked'
  };

  var at = C.data.audit.length;
  for (var i = 0; i < C.data.audit.length; i++) {
    if (C.data.audit[i].time.indexOf('Aug ') === 0) { at = i; break; }
  }
  C.data.audit.splice(at, 0, ENTRY);
})(window.Console);
