# Crosscut Daily Five — Design QA

- Source visual truth: `references/daily-five-todays-drop.png`
- Implementation: `Crosscut Prototype.dc.html?screen=feed`
- Saved side-by-side comparison: `design-qa-comparison.html`
- Implementation screenshot: in-app Browser capture of the live comparison above (captured and inspected 2026-09-04)
- Target viewport: 390 × 844 logical px mobile content
- Source pixels: 852 × 1856, normalized to 413 × 900 in the comparison board
- Implementation CSS size: 390 × 844 content; 396 × 850 including the existing 3px device-frame border
- Browser density: devicePixelRatio 2
- State: Feed, Daily Five in progress after two guesses; Today's Drop 0 of 2 complete

## Findings

No actionable P0, P1, or P2 differences remain.

- The implementation retains Crosscut's account balances and social feed card below Today's
  Drop. The weekly strip and live ticker were removed from Feed at the user's direction,
  reducing duplicated status information and bringing the daily games above the fold.
- Today's Drop keeps the source's split Crossword / Daily Five decision, strong shared
  container, independent state, five-tile word preview, and magenta action emphasis.
- The combined Today's Drop remains the feed entry point. Below it, the feed now repeats
  a clear one-crossword / two-compact-Daily-Five rhythm, preserving the requested mix
  without letting the word-game posts compete with full puzzle cards.
- Compact Daily Five cards remain visually subordinate at roughly 104px tall, alternate
  paper and ink treatments from the existing palette, and keep all five tiles readable.
- The implementation makes the entire half-card tappable, so its visually compact text CTA
  still has a target substantially larger than 44px.

## Required fidelity surfaces

- Fonts and typography: passed. Chivo is used at the established weights; hierarchy and
  wrapping remain legible at the mobile width.
- Spacing and layout rhythm: passed. The split module aligns to the existing 18px feed
  margins, 20px card radius, 2px border, and 5px hard shadow. Nothing clips at 390px.
- Colors and visual tokens: passed. Paper, ink, card, magenta, gold, and success values use
  the existing palette with no gradients or blurred elevation added.
- Image and asset fidelity: passed for this UI-only target. The selected visual contains no
  required raster artwork. Game boards are interactive UI, not decorative substitutes.
- Copy and content: passed. “Today's drop,” “Mini crossword,” “Daily Five,” and “One word.
  Six tries.” match the chosen direction and adapt correctly across Start, Continue, and
  Review states.

## Interaction verification

- Opened Daily Five from Feed.
- Entered CROSS using the on-screen keyboard and submitted it.
- Confirmed exact-letter colors, completion copy, reward balance changes, and return path.
- Opened Browse and the Daily Five archive.
- Opened the current compact Daily Five card from Feed and confirmed it resumes play.
- Opened a completed compact Daily Five card and confirmed it routes to the archive.
- Visually inspected the one-crossword / two-compact-card sequence at the mobile viewport;
  no clipping, collisions, or hierarchy regressions were found.
- Confirmed the Feed now moves directly from the header into Today's Drop, with no leftover
  weekly-strip or ticker space and no unused bindings.
- Confirmed the crossword keyboard's edge keys now fit inside the device frame.
- Checked the prototype console: no warnings or errors.

## Focused comparison

The side-by-side board focuses on the Today's Drop region because that is where fidelity
depends on hierarchy, typography, split-card proportions, and game identity. The full Feed
context remains visible on both sides, so a second crop was not needed.

## Comparison history

- Pass 1: no P0/P1/P2 findings. The more compact implementation is an intentional
  adaptation to the existing stories-and-feed structure, not unresolved visual drift.

## Follow-up polish

- P3: consider slightly reducing the crossword preview headline by 1px if localization
  causes an extra line in Ukrainian or Russian.

final result: passed
