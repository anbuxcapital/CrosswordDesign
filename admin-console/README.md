# Crosscut admin console

`CrosscutAdminConsole.html` is the current interactive desktop prototype. It covers the daily drop desk, puzzle library, player support, leaderboard review, economy ledger, advertising rules, and operations. All data and actions are simulated; the console is not connected to production services.

From the design repository root, run `python3 -m http.server 4173`, then open:

`http://127.0.0.1:4173/admin-console/CrosscutAdminConsole.html`

The prototype is a self-contained bundle, so it does not need a separate `support.js` file.

## Files

- `CrosscutAdminConsole.html` — current interactive prototype and source of truth for the selected UI direction.
- `CONSOLE-DESIGN-GUIDELINES.md` — product and interaction rules for extending the console.
- `ADMIN-CONSOLE-RESEARCH.md` — reference patterns, proposed workflows, backend boundaries, and coverage decisions.
- `USE-CASES.md` — operator roles, the 26 use cases, each happy path with its screens, and the plan for the clickable prototype.
- `design-qa.md` — latest browser review, interaction coverage, and known prototype limits.
- `references/publishing-calendar-metrics-concept.png` — earlier selected publishing-calendar concept retained for visual lineage, not as the current UI.

## Current design direction

- Make the daily publishing gap the first thing an operator sees and can resolve.
- Keep high-density operational information readable through strong hierarchy, quiet dividers, and restrained color.
- Require an explicit reason and review step for player or economy mutations.
- Keep content state, operational health, and commercial controls distinct while sharing the same navigation and audit model.
- Use Crosscut pink for selection and action emphasis, not as a general status color.
