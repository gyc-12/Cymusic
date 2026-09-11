# Immersive Artwork Player — Acceptance

Date: 2026-09-11. Branch: `codex/immersive-artwork-player`.
Baseline: `7881f86b2d7c2e73778bda45a5db5f929a321666`.

Implementation and independent review are complete. Visual captures and the
observed click-based interactions passed. The user authorized commit, merge to
`main` and push on 2026-09-11. Current manual slider, artwork-swipe and pull-down
results remain unreported; delivery authorization is not a gesture-test pass.

## Implemented Result

- Full-width artwork extends behind the status bar, with a subtle upper scrim.
  It keeps its size while paused and uses centered cover cropping.
- A multistop fade reaches the same cover-derived opaque background before the
  title/artist. Controls reserve their safe-area space; artwork takes the rest.
- The palette hook uses the platform's background/dominant swatch, preserves hue
  while bounding brightness, isolates URI lifetimes, handles failures and owns a
  bounded cache. No dependency, native, playback, setting or license change.
- Existing menu IDs/icons and action owners are retained. The reviewer fixed
  bright artwork extending behind the metadata; the final canvas ends at zero.

## Executable and Independent Checks

| Check | Result |
| --- | --- |
| Scoped ESLint, including the new runner | Zero file errors/warnings; repository React-version configuration notice remains |
| Full TypeScript | Only inherited TS2578 at `src/components/utils/index.ts:137`; not a clean whole-repository type check |
| `node scripts/check-player-background.mjs` | 14 passed, 0 failed |
| Whitespace | `git diff --check` passed |
| Independent review | Verified finding fixed; no remaining verified product defect |
| Pure-white palette | `#ffffff` → `#595959`; title 7.005:1, 80%-white artist 5.157:1 |
| Final product revision | Staged implementation hashes match the independently reviewed revision below |

The runner executes the actual hook with controlled lifecycle and promise
behavior: iOS/Android/web swatches, short/invalid hex, brightness/hue, first-render
URI isolation, out-of-order requests, A → B → A, rejection/retry, unmount and LRU
eviction. It is not a native React/gesture or screenshot test. The independent
review also checked the contrast bound and preservation of existing handlers.
Its local research log is ignored by Git; these hashes identify the reviewed
implementation without requiring that local log:

| File | SHA-256 |
| --- | --- |
| `src/app/player.tsx` | `e129ef4ef492b92f57eae1f40e1d53483630a6b75fd8ce68933bd99c087e315c` |
| `src/hooks/usePlayerBackground.tsx` | `7b3f6f11ccb8a2217ead468f7526916f9b6c6cc5951467fb74114be870c71cd9` |
| `scripts/check-player-background.mjs` | `f616283c10b9a09ac315d5001079c3b1e354298a6f22233b722c255d866bafcb` |

Logs and raw captures are local temporary evidence in
`/tmp/cymusic-immersive-player-20260911/`. They are outside Git.

## Actual iOS App Evidence

Reused the matching Expo 57 Debug simulator binary from the prior precise-seek
task; Metro on port 8097 supplies this branch's JavaScript. The change has no
native dependency or configuration edits, so it does not require another native
build. This is simulator Debug evidence, not a new Release/IPA or physical run.

| Simulator | ID | Viewport |
| --- | --- | --- |
| CyMusic Immersive Player 20260911, iPhone 17 Pro / iOS 26.5 | `8F3BE6C0-6B4A-4CEF-B392-678F25AA0326` | 402 × 874 |
| CyMusic Immersive Compact 20260911, iPhone SE 3 / iOS 26.5 | `84CFB772-35CD-482A-88F5-B5C5694ECE6F` | 375 × 667 |

The disposable simulators contain local original synthetic audio and demo cover
fixtures. The reference example crops the user's supplied screenshot solely as
a temporary visual fixture; its displayed song/artist does not prove playback of
that recording. No reference artwork or private audio-source script is added to
the repository. Lyric testing uses 16 synthetic lines.

| Observed scenario | Evidence/result |
| --- | --- |
| Reference composition | `player-reference.png`: top/side edges filled; continuous warm lower surface |
| Warm paused | `player-warm-paused.png`: cover remains full size |
| Cool/dark covers | `player-cool.png`, `player-dark.png`: corresponding blue/dark lower surfaces |
| Bright/pure white | `player-bright.png`, `player-white.png`: title/artist readable on opaque base |
| Missing/failed art | `player-missing.png`, `player-failed.png`: stable existing placeholder |
| Compact layout | `player-compact.png`, `player-compact-white.png`: full control set fits without overlap |
| Menu | `player-menu.png`: menu opens and retained icons are visible |
| Lyrics | `player-lyrics.png`: synthetic lyrics render; delay panel opens/closes and return restores player |
| Play/pause and next | Visible controls/state change; next switches the track and palette |
| Seek by click | Click advanced 01:17 → 02:38 and moved the thumb |
| Queue | Eight fixture tracks displayed; exposed Cancel action closes the sheet |
| Player reopening | Mini-player opens the new player with retained track/progress |
| Volume input | Pointer interaction observed; subsequent native volume remains the original approximately 0.6. This does not prove system-output volume changed |

`player-preview.png` combines the unchanged reference, cool and compact captures
at preserved aspect ratios. It is presentation evidence, not a design mockup.

The source review separately confirms retained favorite, album/artist, playlist,
download/share, sleep-timer and repeat handlers. These workflows and previous-track
controls were not all exercised end to end during this appearance iteration;
source preservation is not recorded as a runtime pass.

## Manual Gesture Gate

CUA progress drags `[161,702] → [289,702]` and `[168,702] → [375,702]` only moved
to the starting position; a direct click at `[290,702]` sought successfully. A
top-handle drag `[225,175] → [225,610]` tapped the artwork and opened lyrics rather
than dismissing the screen. These are invalid drag observations, not passed
gesture tests or confirmed app defects.

The coordinator left the regular simulator on the reference player and asked
the user to test progress/volume dragging, left/right artwork swipes and top
pull-down dismissal. No answer has been received for this version yet. Older
manual results from Expo/RNTP or FLAC tasks are not reused for the changed layout.

## Delivery State

Feature commit `5e8340e3e634dcba0a05b224cf14c4f361a5187c` contains
`src/app/player.tsx`, `src/hooks/usePlayerBackground.tsx`,
`scripts/check-player-background.mjs` and the scoped image contract. Task records
are a separate bookkeeping commit; reverting the feature needs only the feature
commit. The authorized delivery target is `main` on remote `Cymusic`.

Existing IDE deletions and unrelated untracked tooling are preserved. Ignored
research, temporary screenshots/media and the private audio-source script stay
outside the commits. This archive records the completed implementation with the
manual evidence limitation above. Metro and simulators remain available for review.
