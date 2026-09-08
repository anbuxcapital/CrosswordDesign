# Crosscut admin console

`prototype/index.html` is the clickable multi-screen prototype covering every admin happy path in `USE-CASES.md`; `CrosscutAdminConsole.html` is the selected artboard that set the visual direction. Together they cover the Daily challenge desk, the crossword and Daily Five library and editors, collections, player support, leaderboard review, economy ledger, advertising rules, operations, and access. All data and actions are simulated; the console is not connected to production services.

From the design repository root, run `python3 -m http.server 4173`, then open:

- clickable prototype: `http://127.0.0.1:4173/admin-console/prototype/index.html`
- artboard: `http://127.0.0.1:4173/admin-console/CrosscutAdminConsole.html`

The artboard is a self-contained bundle; the clickable prototype is plain HTML, CSS and JS with no build step.

## Files

- `prototype/` — clickable prototype: shell with sign-in and role-gated navigation, hash router, shared patterns, demo data, one screen file per area; `prototype/CONTRACT.md` explains the layout.
- `CrosscutAdminConsole.html` — selected artboard and visual reference for the shell and the Daily challenge desk.
- `CONSOLE-DESIGN-GUIDELINES.md` — product and interaction rules for extending the console.
- `ADMIN-CONSOLE-RESEARCH.md` — reference patterns, proposed workflows, backend boundaries, and coverage decisions.
- `USE-CASES.md` — vocabulary, the 17 player use cases, the one diagram mapping them to 26 admin use cases, coverage gaps, and each admin happy path with its screens.
- `design-qa.md` — latest browser review, interaction coverage, and known prototype limits.
- `references/publishing-calendar-metrics-concept.png` — earlier selected publishing-calendar concept retained for visual lineage, not as the current UI.

## Current design direction

- Make the Daily challenge gap the first thing an operator sees and can resolve. A Daily challenge is exactly one crossword and one Daily Five per language per day.
- Keep high-density operational information readable through strong hierarchy, quiet dividers, and restrained color.
- Require an explicit reason and review step for player or economy mutations.
- Keep content state, operational health, and commercial controls distinct while sharing the same navigation and audit model.
- Use Crosscut pink for selection and action emphasis, not as a general status color.
