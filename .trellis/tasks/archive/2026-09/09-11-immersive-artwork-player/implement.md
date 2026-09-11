# Immersive Artwork Player — Execution Plan

## Planning Gate

- [x] Task creation and planning consent received on 2026-09-11.
- [x] Inspect player, palette hook, image library, theme, controls and routing.
- [x] Write requirements, design, research and context manifests.
- [x] Receive approval of the final planning summary.
- [x] Activate this task and create `codex/immersive-artwork-player` from main.

## Implementation

- [x] Record changed-owner ESLint and full TypeScript diagnostics before edits.
- [x] Dispatch `trellis-implement` for the player view and palette hook, with
  exclusive product-file ownership; prepare isolated simulator fixtures.
- [x] Implement robust cover-color selection and shared background/fade color.
- [x] Rework layout, keep artwork full size when paused, retain existing actions
  and adapt compact layouts.
- [x] Resolve the independent review's bright-cover finding: end the fade before
  metadata instead of extending the artwork canvas behind it.

## Quality Gate

- [x] Scoped ESLint: zero errors/warnings. TypeScript: only the inherited TS2578
  at `src/components/utils/index.ts:137`; no new diagnostics.
- [x] `node scripts/check-player-background.mjs`: 14 lifecycle/color/cache
  checks pass. No style-mirroring assertions were added.
- [x] Capture warm, cool/dark, bright, missing/failed, paused and lyric states,
  plus regular and compact portrait layouts and a pure-white extreme.
- [x] Observe UI play/pause, next, click-to-seek, lyric entry/exit and delay-panel
  entry/exit, menu icons, queue entry/exit, and player reopening.
- [x] Independently review preservation of favorite, album/artist, playlist,
  download/share, timer and repeat owners. These flows were not all exercised
  end to end; keep source review separate from runtime observations.
- [ ] Receive current-version manual progress/volume drag, artwork swipe and
  top pull-down results. Automation produced starting taps, not valid drags.
- [x] Dispatch `trellis-check`, resolve its verified finding, and record the
  reviewed product hashes and `acceptance.md` evidence.

## Delivery

- [x] Record reusable palette/lifetime/gradient contracts in the image spec.
- [x] Compose `player-preview.png` from actual simulator screenshots outside Git.
- [x] Present actual screenshots and source/validation status.
- [x] Receive explicit authorization to commit, merge into `main` and push on
  2026-09-11. This is delivery authorization, not a manual-gesture result.
- [x] Commit the implementation/spec as `5e8340e`; keep task bookkeeping separate
  so the feature can be reverted independently. Archive the implementation record
  with the outstanding manual evidence stated explicitly.

Delivery target: fast-forward `main` from the feature branch and push to `Cymusic`.
Retain unrelated working-tree changes and local tooling/source fixtures.

Revise the design if new dependencies, native work, playback changes or a broader
screen redesign become necessary.
