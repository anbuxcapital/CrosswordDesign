# Admin console design QA

Reviewed September 9, 2026 in the in-app browser at the 1440-wide reference viewport, signed in as `m.olsen`, `a.reid`, `s.novak` and `t.baros`.

## What was reviewed

- `prototype/index.html`, the clickable multi-screen prototype covering every admin happy path in `USE-CASES.md`.
- `CrosscutAdminConsole.html`, the selected artboard, as the visual reference for the shell and the Daily challenge desk.

The earlier `references/publishing-calendar-metrics-concept.png` established the cream/ink/pink system, bold Crosscut typography, the paired Daily challenge model and visible missing-content state. The artboard kept those fundamentals and replaced the fixed weekly concept with a denser calendar and list desk. The clickable prototype keeps the artboard's visual system and extends it to every area.

## Happy paths verified end to end

Each row was driven through the real screen controls and dialogs, then checked against the store and the audit log.

| Area | Verified | Result |
|---|---|---|
| Access | C1 sign-in with email and password, Google and Apple account chooser, wrong email, empty password, deactivated account, session line in the sidebar, sign-out. C2 invite, edit roles, deactivate with reason. C3 audit filters, entry detail, Open affected object for every id shape | Pass. Role gating verified: `a.reid` sees only Daily challenge, Library and Collections (Collections tab only); a direct hash to Players shows the plain explanation |
| Editorial | Library has Crosswords and Daily Five tabs. E1 three-step import (7 accepted, 2 rejected, batch in Operations). E2 new game and duplicate as draft. E3 save increments version. E4 failing validation on CW-2264 and D5-0923, issue click focuses the cell or clue, fix, re-run to Passed. E5 feed card and play screen preview for both kinds. E6 approve and send back. E7 correction of a published crossword | Pass |
| Publishing | P1 choose a Daily Five for Sep 11 from the Approved pool. P2 schedule review with representative local times. P3 bulk schedule with per-date results incl. a skipped blocked date. P4 replace and unschedule with reasons; a day has exactly two slots and no ordering. P5 collection membership, metadata, visibility, shelf preview, save summary | Pass |
| Support | S1 list of every player with live filtering, deep links, not-found state. S2 field change with review and reason. S3 restore streak, grant tokens (ledger entry visible in Economy), reset session. S4 force sign-out, suspend and unsuspend, merge duplicate, delete on request with typed id. S5 add and close notes | Pass |
| Integrity | Inside Collections → Leaderboards tab: L1 clear, exclude and shadow decisions update board eligibility. L2 week and game boards per language, row opens the player | Pass |
| Economy | M1 filters and entry detail. M2 compensating entry appends, never overwrites; over-balance debit blocked. M3 purchase search and detail | Pass |
| Ads | A1 pause now or scheduled, cancel reverts the switch. A2 rule editor with old/new review; grace and cap cascades | Pass |
| Operations | O1 retry with per-item results; failure branch links to the desk day, success branch clears the signal. O2 pool depth per language and kind, Open library lands filtered. O3 batch detail, rejected item opens the editor or explains | Pass |

Cross-area checks: approve in Library then pick in the desk picker; grant tokens then read the ledger; import then read the batch in Operations; failed Daily challenge generation signal then land on Sep 11 in the desk. All pass. No user-visible "puzzle" wording remains; games are crosswords and Daily Five, and the daily pair is the Daily challenge.

## Safeguards confirmed

- Reason-required confirms stay disabled while the reason is empty.
- High-impact actions show a before/after review; bulk actions show selection count, effective time and per-item results.
- Balances are never edited; corrections append ledger entries.
- Every mutation lands in the audit log with operator, object, reason and result.
- Read-only and editable fields are visually distinct; tables render at one density.

## Prototype boundary

All data is in memory and resets on reload. Sign-in models a Better Auth flow but performs no authentication: the password field accepts any non-empty value and stores nothing. Social sign-in opens a demo account chooser. Ledger compensation completes in the demo but must stay disabled in production until an audited server command exists. Production use still needs Better Auth operator identity with server-enforced permissions, audited commands, and real status and query contracts.

## Known limits

- The browser pane used for review does not deliver synthetic keyboard events to the page, so form submission was verified through the form's own submit handler; a real Enter or click submits the same handler.
- Wheel prizes, notifications, the rewarded-ad surface, a player-facing board and an in-app support channel have no console coverage; see the gaps in `USE-CASES.md`.
