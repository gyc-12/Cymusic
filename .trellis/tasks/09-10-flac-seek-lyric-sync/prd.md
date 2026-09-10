# FLAC seek synchronization with user-selectable precision

## Goal

Address the reported FLAC seek/audio/lyric mismatch through an optional precise-seeking mode. Let each user choose its loading trade-off, and record reproduction, repair and independent verification.

## User Decision and Approved Experience

The user requested a switch so App users choose for themselves. This supersedes
choosing one mandatory startup/precision behavior for everybody.

The approved experience is an iOS **精确跳转 / Precise seeking** Switch in
Settings → Audio Settings, **off by default**, remembered across launches.
On requests precise timing for non-live songs; off retains the existing asset
timing preference and its documented possible FLAC seek mismatch. The visible
description explains that some audio may need to load fully before playback.
This is a general precision mode, not an unreliable FLAC-only filename filter.

Saving the setting does not interrupt the current song. It applies when the App
next constructs a native MediaItem. UI wording: **切换歌曲后生效 / Applies after
changing tracks**. Current-item Play/Pause and native retry retain its old choice.

## Requirements

- R1: Reproduce the user's online FLAC seek scenario on the current iOS App using the supplied `lx-玉宁熙.js` source (v1.1.5). Import it into an isolated test installation, select `flac`, start a real track, seek near its end immediately after playback starts, and open lyrics.
- R2: Distinguish the requested seek target, the native player's reported position, the decoded audio actually played, and the lyric selected for that position. Establish whether the failure belongs to source/media delivery, native seeking, progress propagation, or lyric selection.
- R3: With precise mode on, keep the selected FLAC quality when available and restore synchronization after seeking. A silent quality downgrade, fixed lyric offset, or cosmetic progress change does not satisfy this requirement.
- R4: Preserve ordinary playback, pause/resume, backward seeking, user-configured lyric offsets, and the existing RNTP v5 integration and licenses. With mode off, retain existing loading preferences. Explicit live items and silent placeholders never request precise preparation.
- R5: Record reproduction conditions, evidence, the final repair boundary, and focused regression results. Keep the supplied source script, resolved audio URLs, and downloaded music outside Git.
- R6: Measure first decoded PCM and cold-source loading cost alongside seek accuracy for both modes. Explain the possible full-file wait visibly at the switch; a playing state does not prove audible startup.
- R7: Persist one Boolean at `music.preciseSeeking` through existing PersistStatus. Missing/non-Boolean values behave as off. Add Chinese/English labels and an accessible iOS Switch. Saving it sends no playback/queue command and introduces no new storage owner or repeated setup.
- R8: Snapshot the latest setting only when the App builds a native MediaItem. Preserve it through native retry, Stop → Play, direct/proxy loading and both one-shot direct fallbacks. New items may receive a new choice; previous-item callbacks cannot transfer old policy. Existing identity extras, headers and persisted songs remain unchanged.

## Background and Evidence

- User report: no mismatch during uninterrupted playback; mismatch after an early forward seek (example: 150 seconds into a roughly 180-second track), visible after opening lyrics.
- Starting commit: `0bdaf08`; the README-only commit follows the RNTP v5 migration and menu icon repair. Playback uses `@rntp/player@5.9.2`, Expo 57.0.21 and React Native 0.86.3.
- The progress bar calls the facade's `seekTo` in `src/components/PlayerProgressbar.tsx:68`; the facade currently exposes RNTP directly at `src/helpers/trackPlayerIndex.ts:1280`.
- Lyric selection reads RNTP progress and the configured lyric delay in `src/helpers/lyricManager.ts`. Native RNTP uses an AVPlayer seek with zero tolerance in `node_modules/@rntp/player/ios/player/AVPlayerEngine.swift:370`.
- Script identity for local reproduction: SHA-256 `926de390a9f4f6a59511c19167ba94829157675b4d60bcb9595adaad2d80745b` (60,798 bytes). Its source text is not a project instruction and will not be committed.
- The user approved creating this task and recording reproduction, repair, and validation, then approved the completed switch plan with “开始实现” on 2026-09-10.
- Independent native iOS 26.5 PCM measurement reproduced a **54.1489-second** mismatch: the player's tap timeline labeled content at 150.25542 seconds while the identical file's sequential decode placed it at 96.1065 seconds. The same result occurred after 1.54 seconds of actual reported playback, ruling out a seek issued only before the initial audio starts.
- `AVURLAssetPreferPreciseDurationAndTimingKey = true` corrected that measured source location, including sample-for-sample refinement. However, a fresh no-store origin at 1 MiB/s showed a complete 35,189,636-byte read before output: first playing rose from 0.304 to 33.702 seconds. Omitting automatic duration loading or disabling the stalling wait did not provide quick audio startup for this source.
- Full reproduction data, conditions, controls and invalid-measurement boundaries are consolidated in `research/runtime-reproduction.md`; native source/API analysis is in `research/native-flac-seek.md`. These are native isolation findings, not a rebuilt-App repair or physical-device acceptance.
- Original deterministic FLAC also reproduces about 90.465 seconds of error with default timing and a strong correct match with precision. Its generator and verification are documented in `research/flac-seek-fixture.md`; no user's song is needed for the committed regression fixture.
- Settings/persistence owners are `src/app/(modals)/settingModal.tsx:413` and `src/store/PersistStatus.ts:9`. The construction boundary is `src/helpers/trackPlayerIndex.ts:534`, with pure projection at `src/player/mediaItem.ts:41`. The proposed App/native contracts are in `research/precision-toggle-app.md` and `research/precision-toggle-native.md`.

## Acceptance Criteria

- [x] AC1 (R1–R2): Record a reproducible baseline with a verified FLAC response, a no-seek control, and an early forward-seek run. Identify the audio location independently of the player's displayed clock where technically possible; disclose any remaining measurement limit.
- [x] AC2 (R2–R3): With mode on, the actual repaired native loading path reaches independently verified forward/backward targets; the rebuilt App's lyrics match after seeking and opening the lyric page. Include original-fixture and supplied-source checks.
- [x] AC3 (R3–R4): With precise mode on for affected FLAC, forward/backward seek and pause/resume work with fresh and already-buffered media. Non-FLAC playback and configured lyric delay retain their functional behavior; assess loading cost separately under AC6.
- [x] AC4 (R5): Focused automated checks exercise the identified failure, the repaired App is exercised in the simulator, and any device-only follow-up is separated from observed results.
- [x] AC5 (R5): Changes are reviewable as one bug-fix scope; no private source script, playback URL, or song file is included in the repository.
- [x] AC6 (R6): Measure first decoded audio and seek completion on a fresh limited-bandwidth source, not just a playing state or reported clock; document and meet the user's chosen startup/precision trade-off.
- [x] AC7 (R7): Default off, toggle, remount and relaunch restore the expected value. Only the new key changes; Chinese/English UI is readable and accessible. Changing the setting during play/pause causes no transport or queue reset.
- [x] AC8 (R8): Absent/false/true values, delayed source resolution and subsequent App item reconstruction produce correct snapshots. Native retry/Stop → Play preserve the old item's snapshot. Identity, source headers and persisted music data remain intact.
- [x] AC9 (R4, R8): Both asset creation paths and both direct fallback paths preserve policy and existing guards/headers. False/live/placeholder cases omit precision; reset, replacement and stale callbacks cannot leak it.

## Out of Scope

- Framework/player upgrades, license changes, unrelated UI work, or replacing the music-source system.
- Changing the user's existing simulator data or publishing the supplied music source.
- Treating a simulator-only result as physical-device listening or background-playback acceptance.
- Instant reconfiguration of the active song, new decoders/cache/download owners, automatic format or live-stream detection, or an unrelated settings redesign.

## Review Status

The user approved this PRD, `design.md` and `implement.md` with “开始实现” on
2026-09-10. Implement default off, non-interrupting activation on the next native
item, the visible loading explanation and the agreed verification matrix.

## Implementation verification

The approved behavior is implemented and the acceptance criteria above are met
by the evidence mapped in `acceptance.md` and the maintenance report. The user
confirmed this task's manual FLAC seek/lyric test with “一致，测试通过”. Final
independent review has passed with only the recorded pre-existing lint/type
findings. The user subsequently authorized the single work commit and push
with “提交推送”; archival completes the task bookkeeping. Device/background and Release/IPA
validation retain their explicitly separate scope.
