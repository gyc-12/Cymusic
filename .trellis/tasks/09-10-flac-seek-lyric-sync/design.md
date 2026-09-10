# Design: user-selectable precise seeking

Status: approved by the user with “开始实现” on 2026-09-10; implemented and verified as mapped in `acceptance.md`.

## Behavior and boundary

Expose an iOS **精确跳转 / Precise seeking** Switch in Settings → Audio Settings.
Default off, persist the Boolean, and apply it to the next App-created native
media item without interrupting the current song. On requests precise timing for
non-live songs and explains the possible full-file preparation wait. Its scope
is not guessed from quality, MIME or filenames.

The defect lives at AVURLAsset's timing/seek boundary. The setting chooses the
asset policy; retain native zero-tolerance seeking and existing lyric selection.
One integrated task covers UI, policy transport, native loading and validation.

## Data flow and contracts

```text
Settings Switch
  → PersistStatus: music.preciseSeeking (Boolean, default false)
  → setTrackSource snapshots after source resolution/identity validation
  → pure toMediaItem receives explicit playback options
  → extras.cymusicPlayback.preciseSeeking
  → MediaItem / AudioItem.prefersPreciseTiming
  → AudioPlayer loadCurrentItem or retry
  → PlayerEngine.load(... prefersPreciseTiming ...)
  → immutable AVPlayerEngine.SourceContext
  → direct/proxy AVURLAsset and both direct fallbacks
```

- Reuse PersistStatus `useValue`/`set` in UI and `get(...) === true` at projection.
  No new GlobalState, restore routine, native store or bridge method is needed.
- Extend pure `toMediaItem` with optional explicit playback options, default false.
  Emit false for placeholders/live tracks; leave `extras.cymusic` identity and
  persisted Track objects unchanged. Use separate `extras.cymusicPlayback`.
- Add a default-false AudioItem property. MediaItem decodes the playback extra;
  missing/null/wrong containers and non-Boolean values must not enable it. Validate
  actual Boolean type rather than assuming Swift NSNumber casts reject numbers.
- Both AudioPlayer load sites pass the retained item property. Retry and native
  Stop → Play retain that snapshot. They never consult App's mutable preference.
- Normalize effective precision to `requested && !isLive` in the engine and
  retain it in SourceContext. Reuse that context for pending direct fallback so
  URL, headers, live state and precision travel together.
- Direct assets preserve source HTTP/ICY headers; add only the precision key when
  true. Proxy assets get the key without origin authorization headers. False/live
  assets omit it. Keep current loadGeneration/cache-key guards and one-shot fallback.
- New loads replace policy; reset clears it. Metadata-only updates retain it.
  Do not use same-URL metadata replacement to simulate applying the switch now.

## Interface

Use the existing grouped settings layout and React Native Switch with a stable
row ID, real typed callback, localized accessibility label/hint and wrapping
description. The existing generic switch handler only logs; wire real persistence
without refactoring unrelated settings. Hide this iOS-only control on Android.

Chinese description:

> 改善部分 FLAC 快进后的音频与歌词不同步。开启后可能需要加载完整音频，播放前等待更久。切换歌曲后生效。

English description:

> Helps keep audio and lyrics aligned after seeking in some FLAC files. Playback may wait for the full audio file to load. Applies after changing tracks.

The explanation is visible before enabling. No extra confirmation dialog is
needed for this reversible preference. Play/Pause keeps the active item policy;
switching songs, explicit App reconstruction and SINGLE replay adopt a new snapshot.

## Expected files

| Files | Purpose |
| --- | --- |
| `src/store/PersistStatus.ts` | Add one typed Boolean key in the existing database. |
| `src/app/(modals)/settingModal.tsx` | Switch, description, persistent state and iOS visibility. |
| `src/locales/zh.json`, `src/locales/en.json` | Both supported language strings. |
| `src/helpers/trackPlayerIndex.ts`, `src/player/mediaItem.ts` | Snapshot at current item creation and pure transport projection. |
| `patches/@rntp+player+5.9.2.patch` | Persist five native file changes: MediaItem, AudioItem, PlayerEngine, AudioPlayer and AVPlayerEngine. Preserve old patch hunks. |
| `scripts/check-rntp-player.mjs`, focused native/PCM runner and fixtures | Actual owner behavior, policy lifetime and independent content localization. Only original reusable source tools enter Git. |
| `third-party-licenses/README.md`, focused maintenance record, brief README guidance | Describe the added local native change, setting and measured results without changing license text. |
| `.trellis/spec/frontend/native-upgrade-contracts.md` | Record per-item policy and decoded-content verification after implementation. |

Versions, lockfiles, the public RNTP JS API and iOS minimum need no change.
No PlayerStore, resolver/source protocol, lyric algorithm, cache or remote-command
behavior change is required. Verify disabled behavior through the SourceContext
refactor instead of assuming it is preserved.

## Compatibility, cost and rollback

The precision key predates iOS 16.4. Keep the standard item initializer and
buffering settings: earlier duration/wait variants did not reduce actual startup.
Some formats require full-file preparation. Measure MP3 and MP4/ALAC too; do not
claim identical startup cost for all non-FLAC media. Explicit `isLive` remains the
existing live contract; automatic recognition of unmarked live URLs is out of scope.

Late source results snapshot at final item construction, after validity checks.
Native retry/fallback reuse the item's value, preserving policy across the same
source lifetime. RNTP license text and existing notices remain exact; update the
description of local modifications only.

Switching off reverts the preference for later songs. Code rollback reverts the
cohesive change and rebuilds the native binary. An older build can ignore the new
Boolean key; no music migration or deletion is needed. Preserve the existing RNTP
migration and unrelated work. Validation and completion gates are in `implement.md`.
