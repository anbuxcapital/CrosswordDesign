# Crosscut admin console — research and design brief

Research date: September 8, 2026. Deliverable: proposed desktop console design, not a connected production administration service.

## Recommendation

Make daily publishing the main workspace. Crosscut needs an editorial console with player-support and game-operations tools: the critical daily question is whether the upcoming crossword and Daily Five drops are ready. Keep the combined player feed, compact Daily Five posts, and current brand. Admin motion should be restrained; do not reuse casino effects in operational controls.

## Relevant console patterns

| Reference | Observed pattern | Application to Crosscut |
|---|---|---|
| [PlayFab Players](https://learn.microsoft.com/en-us/xbox/playfab/player-progression/player-data/using-the-players-page) | Dedicated player lookup and individual player administration | Search by player ID/name, then open a player detail workspace with solve history, wallet ledger, and support actions |
| [Nakama Console](https://heroiclabs.com/docs/nakama/getting-started/console/) | Game administration includes player accounts, storage, and leaderboards | Group player support and leaderboard investigation around the affected player/puzzle; avoid raw database editing as the default UI |
| [Sanity Content Releases](https://www.sanity.io/docs/user-guides/content-releases) | Coordinate related content and preview releases before publication | Treat each daily drop as a coordinated crossword + Daily Five release, with preview, validation, and explicit schedule |
| [Sanity Scheduled Drafts](https://www.sanity.io/docs/studio/scheduled-drafts) | Single-document scheduling is distinct from coordinated releases | Allow individual puzzle scheduling, but make paired daily-drop readiness visible |
| [Strapi Review Workflows](https://strapi.io/features/review-workflow) | Review stages and ownership make content progress explicit | Draft → Needs review → Approved → Scheduled → Published; show validation failures separately from editorial status |

These are interaction references, not recommendations to adopt their services. Vendor feature availability and paid tiers do not establish Crosscut backend support.

## Proposed console coverage

| Area | Necessary work | Priority |
|---|---|---|
| Overview | Upcoming gaps, items awaiting review, recent publication failures, links to affected content | First version |
| Puzzle library | Search/filter crossword and Daily Five; import; duplicate as draft; edit metadata, clues, grids, answers, language and difficulty; validate and preview | First version |
| Publishing | Calendar by date/language; pair daily content; schedule; preview combined feed; surface missing slots and conflicts | First version |
| Collections & Browse | Collection membership/order, metadata, visibility and preview | First version |
| Players | ID/name lookup, profile, progress, streak, sessions and ledger history | First version design; new admin queries required |
| Leaderboards | Puzzle/week scope, suspicious solve evidence, review decisions and reason history | First version design; new admin review commands required |
| Economy | Inspect token/star ledger; proposed adjustment flow records reason, operator and resulting balance | Design now; enable only with an authoritative audited command |
| Operations | Content-pool depth, drop generation status, leaderboard freshness, failed jobs and retry result | First version design; status/recovery contract required |
| Access & history | Operator identity, roles, environment label and audit history for mutations | Required before production use |
| Engagement & revenue | Notification campaigns, offers, purchase support and deeper retention analytics | Later integration; not represented as currently working |

## Key workflows

1. Import/create puzzle → inspect validation → edit → preview player experience → approve → assign daily slot → schedule → confirm publication result.
2. Open a missing date → choose approved crossword and Daily Five → preview combined drop → schedule with explicit UTC time and local-time explanation.
3. Search player → inspect solve/session/ledger timeline → select a permitted support action → enter reason → review before/after → confirm → view audit entry.
4. Open flagged leaderboard result → inspect evidence → record decision → see updated board eligibility. Keep reward decisions separate from board eligibility.

Crossword validation should identify grid/answer mismatch, clue numbering, missing clues and invalid entries. Daily Five should identify answer length, dictionary membership, invalid characters and answer reuse according to an explicitly chosen editorial rule. These are proposed requirements, not claims that validators are already implemented.

Publishing failures must identify the specific item and offer a recoverable next step. Bulk actions need a selection count and per-item outcome. Use versioned corrections rather than silently rewriting content already played. Future wallet corrections should append compensating ledger entries rather than overwrite balances.

## Grounding in this repository

The architecture is a v1 design baseline. It describes JSON content as source of truth, human review, content validation, imports, daily-drop generation, collections, per-player authoritative wallet state and leaderboard eligibility. The documented admin routes are `/admin/content/import`, `/admin/content/status`, and `/admin/collections/import`; their presence in architecture is not proof of deployed implementation.

At inspection the repository contains `packages/core` primitives; the planned `workers/gateway/src` path was absent. Do not label any proposed console control as connected to production. `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION-PLAN.md` explicitly say Daily Five / Feed v2 amendments await ARC-01. Console designs should accommodate both game types without inventing finalized contracts. Push delivery and purchases are stub/mock scope in the baseline.

The existing shared admin-token design is not a complete browser admin identity/role system. Production console work requires operator authentication and server-enforced permissions, plus audit records. Never embed the content admin secret in frontend code.

A visual authoring console also needs a decision on how approved edits return to versioned JSON. Preserve that source-of-truth model until an explicit architecture change is accepted.

## Visual brief

Desktop, 1440 × 1024. Cream #EFE9DB / #F6F1E4, ink #16130B, pink #C93081, restrained gold #DFA94C. Bold Chivo-like headings, readable 14–16px controls, quiet dividers and sparse shadows. Preserve Crosscut identity while prioritizing long editing sessions. Current date: Tuesday, September 8, 2026; containing week: September 7–13.

Explore three independently reviewable structures: a daily publishing desk, a library with an editing inspector, and a weekly release planner. Use illustrative data labeled Demo. The chosen structure will ground an interactive prototype; research and images alone do not constitute implemented admin functionality.
