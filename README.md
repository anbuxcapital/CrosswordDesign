# Crosscut designs

Product design repository for the Crosscut player app and administration console.
It is also included as the `design/` submodule in the
[main Crosscut workspace](https://github.com/anbuxcapital/Crossword).

## User app

- [Interactive prototype](user-app/Crosscut%20Prototype.dc.html)
- [Exploration gallery](user-app/Feed%20Explorations.dc.html)
- [Design handoff](user-app/design_handoff_crosscut_feed/README.md)
- [Design QA](user-app/design-qa.md)

The prototype and its supporting files live in `user-app/`. From this repository
root, run `python3 -m http.server 4173`, then open
`http://127.0.0.1:4173/user-app/Crosscut%20Prototype.dc.html?screen=feed`.

## Admin console

- [Clickable prototype, all admin happy paths](admin-console/prototype/index.html)
- [Selected artboard](admin-console/CrosscutAdminConsole.html)
- [Overview](admin-console/README.md)
- [Console design guidelines](admin-console/CONSOLE-DESIGN-GUIDELINES.md)
- [Research and proposed scope](admin-console/ADMIN-CONSOLE-RESEARCH.md)
- [Player use cases and the admin capabilities that cover them](admin-console/USE-CASES.md)
- [Design QA](admin-console/design-qa.md)
- [Earlier publishing-calendar concept](admin-console/references/publishing-calendar-metrics-concept.png)

Both admin prototypes use demo data and are not a connected administration service. Serve this repository root with `python3 -m http.server 4173` and open `http://127.0.0.1:4173/admin-console/prototype/index.html`.

## Organization

Keep shared repository documentation here at the root. Keep player-specific
handoff and QA in `user-app/`, and admin-specific research and concepts in
`admin-console/`. Preserve relative asset links when moving prototype files.

Commit design changes here first. When working through the main workspace,
also commit its updated `design/` submodule reference after pushing this repository.
