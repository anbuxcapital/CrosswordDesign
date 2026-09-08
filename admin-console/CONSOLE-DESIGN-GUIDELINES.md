# Crosscut console design guidelines

These rules define how to extend the selected admin-console direction without turning it into a generic analytics dashboard.

## Product structure

1. Lead with work, not reporting. The default screen should answer what needs attention today and provide the shortest safe path to resolve it.
2. Keep the daily drop as the publishing unit. A valid drop has at least one crossword and one Daily Five; additional puzzles are ordered explicitly.
3. Separate editorial, support, commercial, and operational concerns in navigation, while keeping operator identity and audit behavior global.
4. Search players instead of exposing an unrestricted player directory. Show only the records needed for the current support task.
5. Keep third-party campaign management and revenue reporting in the ad network. The Crosscut console owns app placement rules, caps, rewards, consent visibility, and grant health.

## Metrics

- Put a metric next to the decision it changes. Coverage belongs beside scheduling; content-pool depth belongs in Operations; fill rate belongs beside ad placements.
- Always include scope and time window: `Daily Five · English · 7 days`, not simply `6 days`.
- Show thresholds and direction when they matter. Pair `6 days remaining` with the `10-day floor` and the action that restores coverage.
- Prefer counts and rates that operators can reconcile. Avoid composite health scores unless the calculation and drill-down are available.
- Use trends only with a comparable prior period. Do not add decorative sparklines.
- Distinguish live player outcomes from workflow state. Completion rate is an outcome; Approved and Scheduled are content states.
- Every alert should identify the affected object, urgency, and one recoverable next step.

## Interaction and safeguards

- Make read-only and mutable fields visually distinct.
- Require a reason for player, ledger, leaderboard, ad-rule, and destructive account changes.
- Show a before/after review for high-impact actions and write operator, reason, timestamp, and result to the audit trail.
- Append compensating ledger entries; never overwrite balances.
- Disable scheduling until all required slots and validations are satisfied, and state exactly why it is blocked.
- Bulk actions must show selection count, effective time, and per-item results.
- UTC and player-local scheduling must explain the real-world consequence with representative local times.

## Visual system

- Use cream surfaces, near-black ink, Crosscut pink for primary actions/selections, green for healthy/complete, and gold for warning/review.
- Keep borders and dividers quiet. Use shadows sparingly; dense operational screens should feel stable rather than layered.
- Use bold Chivo headings and compact Chivo Mono labels for IDs, timestamps, and machine-readable values.
- Maintain a minimum 14px body/control size at the 1440 × 800 reference viewport.
- Use color and text together for status. Never rely on color alone.
- Preserve generous row height around destructive or irreversible controls.

## Content language

- Prefer concrete labels: `No Daily Five assigned`, `Retry generation`, `6 days of Daily Five remaining`.
- Avoid vague labels such as `Issue`, `Error`, or `Manage` when a specific action is known.
- Label demo data and simulation boundaries clearly.
- Use sentence case for screen titles, controls, and status messages.
