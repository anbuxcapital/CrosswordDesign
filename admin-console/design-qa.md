# Admin console design QA

Reviewed September 8, 2026 at a 1440 × 800 desktop viewport in the in-app browser.

## Source comparison

The earlier `references/publishing-calendar-metrics-concept.png` established the cream/ink/pink visual system, bold Crosscut typography, daily paired-drop model, operational metrics, and visible missing-content state. The interactive prototype preserves those fundamentals while replacing the fixed weekly concept with a denser calendar/list desk and extending the shell to support operations beyond publishing.

The selected prototype improves the source direction in three important ways:

- It supports multiple puzzles of either type on one day without weakening the required crossword + Daily Five rule.
- It places coverage, readiness, and missing-slot signals directly in the scheduling workflow.
- It gives publishing time a concrete UTC/player-local model with representative local times.

## Browser review

Checked without visible clipping or broken layout:

- Drop desk calendar, missing-slot alert, day inspector, readiness checks, publish-time controls, and audit trail.
- Puzzle library filters, density switch, selectable rows, validation states, and import entry point.
- Player lookup, player switching, profile tabs, editable-field states, support actions, and account safeguards.
- Leaderboard review queue and decision entry points.
- Economy ledger with immutable-balance guidance.
- Ad placement toggles, cap/reward/fill data, and network boundary.
- Operations signals with affected object, last run, and recovery action.

## Prototype boundary

The navigation and primary demo states are interactive. Data is reset on reload. Confirmation, external-service, import, and backend-dependent controls are workflow demonstrations rather than connected operations. Production use still requires authenticated roles, server-enforced permissions, audited commands, and real status/query contracts.
