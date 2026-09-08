/* Placeholder screens for routes no area builder has claimed yet.
   Every route in the console now has a real screen under js/screens/, so this
   list is empty and the file registers nothing. It stays wired into index.html
   so a future unbuilt route can get a placeholder here again: add a
   [route, title, subline, owner] entry and it renders before the real screen
   file exists (the last registration for a route wins). */
(function (C) {
  'use strict';

  var STUBS = [];

  STUBS.forEach(function (s) {
    C.registerScreen(s[0], {
      title: s[1],
      subline: s[2],
      render: function (mount) {
        mount.appendChild(C.ui.emptyState('Screen pending: ' + s[3] + '.', 'Not built yet'));
      }
    });
  });
})(window.Console);
