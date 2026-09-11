# Immersive Artwork Player

## Goal

Make the music player feel like one continuous cover-led surface: artwork fills
the upper screen, and the lower controls sit on a naturally matching background.
Use the composition of the user’s Apple Music screenshot supplied on 2026-09-11.

## Confirmed Background

- At baseline `7881f86`, `src/app/player.tsx:491` renders an inset square cover;
  `src/app/player.tsx:223` shrinks it while paused.
- `src/app/player.tsx:405` mixes the image background and contrasting primary
  colors. The existing palette hook at `src/hooks/usePlayerBackground.tsx:25`
  does not handle rejected requests.
- Controls, lyrics, menus and vertical dismissal already exist. This is a visual
  iteration of the existing player, with the original app functions retained.
- The user approved task creation and planning on 2026-09-11, then explicitly
  approved implementation after reviewing the final planning summary.

## Requirements

| ID | Observable requirement |
| --- | --- |
| R1 | Artwork reaches the top and both screen edges, filling roughly the upper half. It keeps its proportions with cropping instead of stretching and remains full size while paused. |
| R2 | The lower surface follows the cover’s principal hue. The image blends gradually into it without a hard seam or an unrelated second color. |
| R3 | Song information and controls remain readable on bright and dark covers. The lower controls fit in the safe area on regular and compact portrait phones. |
| R4 | Track changes update the displayed palette correctly. Missing, slow or failed artwork/color requests leave a usable player without stale colors, an invisible cover or unhandled errors. |
| R5 | Existing play/pause, skip, seek, volume, favorite/menu, artist/album, playlist, repeat, lyric and sleep-timer actions remain available. Artwork tap/swipe and vertical dismissal continue to work. |

## Acceptance Criteria

- [x] A1 → R1/R2: actual app screenshots show the edge-to-edge composition and
  smooth artwork/background junction with warm and cool/dark covers.
- [x] A2 → R1/R3: paused playback retains full-width art; bright-cover and compact
  portrait captures show readable labels and accessible controls without overlap.
- [x] A3 → R4: missing/failed art has a stable fallback; delayed/out-of-order color
  responses cannot override the active song. Returning to the player works.
- [ ] A4 → R5: verify existing playback, seek/volume, lyric entry/exit, menus,
  queue/repeat and dismissal interactions. Record what was actually exercised.
- [x] A5 → R3/R4/R5: no newly introduced TypeScript or lint errors; independent
  review covers the final diff and asynchronous color lifecycle.

## Out of Scope

Playback-engine or FLAC changes, new dependencies, animated/video covers, a new
appearance setting, redesigning other screens and automatic publishing. The
reference supplies visual direction; its album artwork is not an app asset.

## Constraints and Review Status

Preserve local unrelated changes and private files. Validate the real player
using suitable test covers; do not infer successful native gestures from static
code checks. Cover cropping and fade extent will be tuned in the simulator.

Implementation and independent review are complete. See `acceptance.md` for
actual screenshots, executable results and retained source contracts. The user
authorized commit, merge into `main` and push on 2026-09-11. Current manual
drag/swipe/dismissal confirmation remains unreported; neither that delivery
authorization nor an older version's result is a gesture pass for this layout.
