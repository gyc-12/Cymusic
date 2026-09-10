# Implementation acceptance checkpoint

Date: 2026-09-10. Baseline `0bdaf08`; branch `codex/flac-precise-seeking`.
The user approved implementation with “开始实现”. Product implementation and the
current-checkout Debug simulator rebuild are complete. Independent review of the PCM matcher's phase-resolution repair, affected
captures and completed documentation has passed. The user then approved the single work commit and push with “提交推送”;
the task stays `in_progress` until the work commit and archival finish.

## Requirements and evidence

| Criterion | Evidence |
| --- | --- |
| AC1: establish the actual failure | Baseline remote FLAC content is 54.14892 s behind its tap timeline after seeking, while uninterrupted control matches. Original generated FLAC independently reproduces the class of error. |
| AC2: actual patched native path and App lyric opening | Installed RNTP methods give zero-sample content offsets for original and supplied FLAC forward/backward cases. Rebuilt App retains FLAC; seek then actual AX cover click opens lyrics at index 27. |
| AC3: normal transport and lyric offset | Bounded App forward seek, pause hold and backward seek/resume retain queue identity. At 150.079 s, lyric delay +1 moves index 27 → 26; restoring moves it back without moving playback. MP4/ALAC off/on content checks pass. |
| AC4: regression checks and runtime boundaries | App 34; native precision 77 scenarios / 411 assertions; native remote commands 192 / 887. Actual Debug rebuild and isolated App observations are recorded. Device/listening/gesture limitations are explicit. |
| AC5: one reviewable scope, no private media | App policy/UI, five added Swift patch sections, focused diagnostics, docs/spec and this task's records. Media/source/URLs remain private outside Git; unrelated IDE/tooling work is excluded. |
| AC6: decoded startup and cost | Fresh Range origins capped at aggregate 1 MiB/s: supplied FLAC first PCM 0.487 s off vs 33.919 s on; on reads 100% of 35,189,636 bytes. Original FLAC confirms the same trade-off. |
| AC7: persisted accessible preference | Owner tests cover missing/wrong types and remount; App restart preserves true. Chinese/English description and AX label/hint inspected. Actual paused off/on clicks write only the one preference and retain progress/queue. Playing-time activation retains the old item while playback continues. |
| AC8: per-item snapshot and source lifetime | Tests execute delayed source resolution, replacement, App reconstruction/SINGLE, both native load sites, retry and Stop → Play. Observed later App item receives the new policy. |
| AC9: asset/fallback policy | Actual extracted methods cover direct/proxy construction, both fallbacks, strict Boolean decoding, explicit live/placeholder exclusion, headers/ICY, generation/cache guards and reset. |

The user subsequently confirmed this task's manual simulator test with
**“一致，测试通过”**: change songs, play FLAC, drag immediately to 2:30, open
lyrics and drag back and forth. Heard audio and lyrics matched. This is direct
user-confirmed gesture/listening evidence for the named scenario, not a reuse
of earlier M01–M12 results or a physical-device assertion.

The corrected eight-phase full-reference matcher validates the existing MP3
precise capture at zero native-rate samples under a one-sample bound. Its
0.95 correlation and 0.05 uniqueness thresholds remain unchanged. Twelve
synthetic controls pass; the MP3 off capture's all-zero segment remains an
invalid content match. Initial failed reports are retained separately.
Thirteen existing captures were re-matched offline after the correction: all
10 previously valid FLAC/ALAC results retain their exact offsets, MP3 on passes
the one-sample bound, and both weak off captures remain invalid. Results are in
`matcher-phase-matrix-results.json` in the private evidence directory.

See the public, sanitized report at
`docs/maintenance/2026-09-10-precise-seeking.md` in the repository
for measurements, implementation contracts, reproducible commands and rollback.
The independent review is in `research/independent-review.md` (local research).

## Private runtime evidence

All paths below are relative to `/tmp/cymusic-flac-seek-20260910/`:

- `matrix-ios-results.json`: actual-origin/local FLAC and cold MP3/ALAC captures.
- `matrix2-ios-results.json`: fresh corrected cold-source and original FLAC runs.
- `app-bounded-playback.json`: immediate seek, pause hold and backward/resume.
- `app-playing-before-toggle.json`, `app-playing-after-toggle.json`: actual
  switch activation during playback, retained queue/item policy and one-key write.
- `app-relaunch-persisted-true.json`: preference survives process restart.
- `app-ui-seek-paused.json`, `app-ui-lyrics-after-seek.png`: forward seek then
  actual cover click opening the lyric page at the corresponding line.
- `app-ui-lyric-boundary.json`: meaningful lyric-delay boundary assertion.
- `app-ui-paused-{before-toggle,after-off,after-on}.json`: actual paused switch
  clicks, unchanged position 150.079 s/queue, exactly two precision-key writes.
- `app-ui-settings-{zh,en}.png`: complete visible setting descriptions.
- `app-ui-language-restored.json`: test language preference restored.
- `ios-implementation-build.log`: successful current-checkout native Debug build.

Earlier source-cold trials with a missing `.flac` suffix failed before track
loading and are invalid. Weak supplied-source off and initial MP3 captures do
not establish content accuracy. Earlier App instrumentation that threw
`Cannot read property 'apply' of undefined` is also excluded; the later bounded
App runs use observation-only probes and existing transport owners.

## Follow-up boundaries

- Seek commands in App observations call the existing facade; automated slider
  dragging was unreliable. Scrolling Settings for visual inspection used its
  existing ScrollView method. The user's subsequent confirmation, above,
  separately supplies actual dragging and listening acceptance.
- Physical-device/background behavior, iOS 16.4 runtime and a new Release/IPA
  were not tested. Earlier M01–M12 results do not cover this feature.
- Full lint/type checking retains only the documented baseline findings.
- No version/lockfile, retained iOS project, lyric algorithm, source resolver,
  cache/download owner or third-party license text was changed.
- This implementation checkpoint preceded staging/commit/push. The user later
  authorized the single work commit and push; its hash is recorded in task.json
  when archiving. No release build was requested. The isolated test App is
  separate from Release Acceptance data.
- Native capture processes and media servers stopped; temporary App observation
  listener removed. Metro 8097 stopped after the user-confirmed manual test;
  no process listens on that port. Later Debug reloads need Metro restarted.
