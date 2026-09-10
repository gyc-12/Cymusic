# Optional precise seeking on iOS

Date: 2026-09-10. Baseline: `0bdaf08`. Feature branch:
`codex/flac-precise-seeking`.

## Behavior

Settings → Audio Settings now includes **精确跳转 / Precise seeking** on iOS.
It is off by default and remembers the user's choice. Enabling it requests
precise asset timing for subsequently constructed, non-live native media items.
The description explains the possible wait for the complete audio file and
that the setting applies after changing tracks.

Changing the setting does not interrupt the current song. Play/Pause, native
retry and native Stop → Play retain that item's choice. A new App item,
including explicit reconstruction or SINGLE replay, takes a new snapshot.
Explicitly marked live items and the bundled silent placeholder do not request
precision. This is an asset policy, with no filename/codec guessing or change
to the selected quality.

## Cause and repair boundary

The reported first home-list song is a 320.4-second FLAC. In the baseline iOS
26.5 reproduction, a seek to 150 seconds produced PCM labeled at 150.25542
seconds whose content actually came from 96.10650 seconds: a **54.14892-second**
disagreement. An uninterrupted control matched correctly. App progress and
lyric selection followed the native clock, so shifting the lyric display would
not repair the audio seek.

The source's FLAC signature, sample format and seek-table entries were checked.
The same class of failure also occurs with an original generated FLAC and with
a fully local file. The repair requests
`AVURLAssetPreferPreciseDurationAndTimingKey` at the actual native asset owner.
It retains the existing seek tolerance, item initializer and stalling behavior.

The preference flows through these existing owners:

```text
Settings → PersistStatus['music.preciseSeeking']
  → setTrackSource, after current-source resolution/validation
  → toMediaItem(..., { preciseSeeking })
  → extras.cymusicPlayback.preciseSeeking
  → MediaItem / AudioItem.prefersPreciseTiming
  → AudioPlayer → AVPlayerEngine.SourceContext → AVURLAsset
```

The App accepts only literal `true`. Native decoding checks CFBoolean identity,
so numeric `1` cannot enable the mode. Existing identity extras, source headers
and persisted music records remain intact. Both direct/proxy construction and
both one-shot direct fallbacks retain the complete source context; origin
authorization headers are not passed to localhost proxy assets. Existing item
generation guards reject stale item callbacks. A delayed coordinator callback
with the same cache key may still consume the current valid fallback context;
it cannot restore the retired item's precision policy.

The RNTP patch adds five Swift sections. Its previous remote-command and
TypeScript sections and the pinned third-party license remain unchanged.
Expo 57.0.21, React Native 0.86.3, `@rntp/player` 5.9.2 and iOS 16.4+ remain
pinned. No lyric algorithm, decoder, download/cache owner or dependency upgrade
is included.

## Decoded-content verification

The PCM probe compiles the installed RNTP loading, item-installation and seek
methods, adding an observational pre-effects audio tap. The independent matcher
decodes the complete byte-identical reference from byte zero, searches by
content and refines at the capture sample rate. The player's requested time
does not choose the matched content location.

All cases below ran sequentially on the isolated iPhone 17 Pro simulator,
iOS 26.5 (23F77), with App audio stopped during native captures. Forward cases
seek to 150 seconds shortly after the first playing observation. Backward cases
start at 220 seconds, then seek to 60. Sample offsets compare decoded content
against the tap's own timeline; tap timing is distinct from speaker latency.

| Installed RNTP path / media | Mode | Content minus tap timeline at 44.1 kHz |
| --- | --- | ---: |
| Supplied source, actual remote FLAC, forward | On | 0 samples |
| Original local FLAC, forward | Off | -3,989,504 samples, about -90.465 s |
| Original local FLAC, forward | On | 0 samples |
| Original local FLAC, backward | On | 0 samples |
| Supplied FLAC, local, backward | On | 0 samples |
| Original FLAC, cold controlled HTTP, forward | Off | -3,989,504 samples |
| Original FLAC, cold controlled HTTP, forward | On | 0 samples |
| Supplied FLAC, cold controlled HTTP, forward | On | 0 samples |
| Original fixture encoded as MP4/ALAC, cold HTTP | Off / On | 0 / 0 samples |
| Original fixture encoded as VBR MP3, cold HTTP | On | 0 samples |

The supplied cold-source **off** capture has insufficient correlation for a
valid content match and is used only for startup measurements. The separate
strong actual-origin baseline establishes the original failure. A successful
capture alone is not a successful content match.

The initial MP3 precise capture exposed a fractional-sample phase error in the
8 kHz coarse matcher. The corrected matcher searches eight sub-sample phases
across the complete reference and considers distant peaks from every phase
together. It retains the 0.95 correlation / 0.05 uniqueness thresholds and
native-rate refinement. The same precise capture now matches with coarse
correlation 0.998214, distant peak 0.189520, native correlation 0.999999993 and
**zero offset under a one-sample bound**. Twelve original-data controls include
fractional-phase alignment and ambiguous content at different phases.
Offline re-matching of 13 existing captures preserves all 10 previously valid
FLAC/ALAC measurements and their exact sample offsets. It validates MP3 on and
leaves the two weak cold-source off captures invalid.

The MP3 off capture contains a long all-zero segment after the seek and remains
a weak match even after that correction. It is excluded from content-accuracy
conclusions. Its original failed report is retained; the new matcher does not
turn incomplete audio evidence into a passing result.

## Cold-start cost

Each HTTP trial uses a fresh localhost server/path, `Cache-Control: no-store`,
working HTTP 206 ranges and an **aggregate 1 MiB/s** bandwidth limit. Latency
starts immediately before native `load`, including synchronous preparation.
Bytes are the union of source intervals written to sockets before first PCM,
an upper bound on peer consumption, not an App cache measurement.

| Media / mode | First decoded PCM | Unique source bytes before PCM | Seek completion |
| --- | ---: | ---: | ---: |
| Supplied FLAC / Off | 0.487 s | 425,984 / 35,189,636 (1.21%) | 0.378 s |
| Supplied FLAC / On | **33.919 s** | **35,189,636 / 35,189,636 (100%)** | 0.139 s |
| Original FLAC / Off | 0.292 s | 278,528 / 36,353,841 (0.77%) | 0.395 s |
| Original FLAC / On | **35.020 s** | **36,353,841 / 36,353,841 (100%)** | 0.050 s |
| VBR MP3 / Off | 0.285 s | 278,528 / 5,585,041 (4.99%) | 0.189 s |
| VBR MP3 / On | 0.115 s | 80,017 / 5,585,041 (1.43%) | 2.637 s |
| MP4/ALAC / Off | 1.794 s | 1,867,776 / 36,832,439 (5.07%) | 1.091 s |
| MP4/ALAC / On | 1.790 s | 1,867,776 / 36,832,439 (5.07%) | 1.066 s |

These are individual controlled observations, not a universal latency estimate.
The actual remote FLAC precise run produced first PCM in 5.474 seconds under
uncontrolled internet throughput. The full-file wait on the controlled FLAC
is why precision is an opt-in with an explicit explanation.

Two earlier cold-source trials lacked the `.flac` suffix while retaining the
origin's `audio/x-ogg` response type. AVFoundation rejected those assets before
track loading. They remain invalid captures; the table uses fresh trials with
the correct suffix. Product MIME handling was not changed.

## Rebuilt App and checks

A current-checkout Debug simulator build succeeded, including the patched
Swift. The App was installed only on **CyMusic FLAC Seek 20260910**
(`3E3785AF-961E-4099-AC23-7BA5BBA2E35F`); the previously accepted simulator and
its data were not used as the test subject.

Observed in that App:

- The preference survived process restart. Playing-time AX switch activation
  changed only the preference; the existing token/queue and old item policy
  stayed intact while progress continued. A later App item received the new
  policy. Both directions were also clicked while paused: position stayed at
  150.079 seconds and only `music.preciseSeeking` was written.
- The reported first song retained FLAC. A bounded early seek reached 151.504
  seconds with lyric index 27; pause held, and backward seek/resume reached
  60.931 seconds. Queue identity and its precision snapshot stayed unchanged.
- In a separate bounded run, seek then pause reached 151.193 seconds. An actual
  accessibility click on the cover opened the lyric page with the corresponding
  line highlighted. The native PCM evidence above independently establishes
  content accuracy; the App observation establishes progress/lyric integration.
- At the lyric boundary 150.079 seconds, changing the existing lyric delay from
  0 to +1 selected index 26 instead of 27. Restoring it selected 27 again,
  without moving playback or replacing the queue.
- Chinese and English settings render the complete description and expose the
  localized switch label/hint and `settings.preciseSeeking` identifier. The
  existing ScrollView was scrolled programmatically for screenshot inspection;
  this is not a successful drag-gesture assertion. Language was restored.
- The user then manually changed songs, played FLAC, dragged immediately to
  2:30, opened lyrics and dragged back and forth. Their response for this exact
  simulator test was **“一致，测试通过”**: the heard content and lyrics matched.
  This supplies the manual gesture/listening evidence separately from automation.

| Check | Result |
| --- | --- |
| App owners: `check-rntp-player.mjs` | 34 passed |
| Native precision policy | 77 scenarios / 411 assertions passed |
| Existing native remote commands | 192 scenarios / 887 assertions passed |
| Offline PCM matcher controls | 12 passed, including fractional phases and ambiguity across phases |
| Strict clean-package patch application | Passed; tarball SHA-512 matches lockfile, installed bytes match all 7 patched files |
| License / prior patch sections | Byte-identical to baseline |
| Full TypeScript | Only inherited TS2578 at `src/components/utils/index.ts:137` |
| Full ESLint, excluding private `lx-*.js` | Inherited 51 errors / 56 warnings; no new diagnostics |
| `git diff --check` | Passed |

The native policy suite covers Boolean decoding, both forwarding sites, item
lifetimes, direct/proxy options, headers/ICY, fallback consumption and stale/reset
guards. Deliberately broken Boolean and precision-key variants are rejected.
The matcher also rejects offset, silence, ambiguous/weak, interrupted, invalid
and discontinuous controls. Generated media and captures are not committed.

Physical-device/background behavior, iOS 16.4 runtime and a new Release/IPA build
are **not** established by these checks. The user's manual confirmation applies
to this simulator scenario. Previous M01–M12 acceptance belongs to the earlier
App version.

## Reusing the diagnostics

Quick policy checks need macOS, Xcode and the locked installed dependencies:

```sh
node scripts/check-rntp-player.mjs
node scripts/check-rntp-remote-native.mjs
node scripts/check-rntp-precise-seeking.mjs
```

Content experiments additionally need Python 3.11+, NumPy, `flac`, `ffmpeg`
and `ffprobe`. The native PCM runner targets macOS 15+ or iOS Simulator 18+;
this diagnostic target does not change the App's iOS deployment target.
Run `python3 scripts/check-rntp-pcm-matcher.py` for the independent synthetic
matcher controls; they require NumPy and `ffmpeg`, with no audio playback.
Use an already booted, disposable simulator, with other audio stopped.
Generate an original fixture and a private configuration from the repository root:

```sh
precise_probe_dir="$(mktemp -d /tmp/cymusic-precise.XXXXXX)"
python3 scripts/fixtures/generate-flac-seek-fixture.py \
  --output-dir "$precise_probe_dir/fixture"
python3 - "$precise_probe_dir" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
for mode in (False, True):
    name = 'on' if mode else 'off'
    config = {
        'url': str(root / 'fixture/fixture.flac'),
        'outputDirectory': str(root / name),
        'preciseTiming': mode,
        'seekToSeconds': 150,
        'seekAfterPlayingSeconds': 0.35,
        'captureAfterSeekSeconds': 7,
        'maxWallSeconds': 100,
        'muted': True,
    }
    (root / f'{name}.json').write_text(json.dumps(config))
PY
node scripts/check-rntp-precise-seeking.mjs --pcm "$precise_probe_dir/on.json"
python3 scripts/fixtures/match-rntp-pcm.py "$precise_probe_dir/on" \
  "$precise_probe_dir/fixture/fixture.flac" --max-offset-samples 1
```

Append `--simulator YOUR_DISPOSABLE_SIMULATOR_UUID` to the native command for
iOS. Run the off configuration separately; omit the matcher's alignment bound
to **measure** a baseline offset without expecting it to pass precision.
For backward seeking, use `startAtSeconds: 220` and `seekToSeconds: 60`.
`report.json`, `buffers.json` and `decoded.f32` belong together; check process
exit codes, capture validity and matcher validity before drawing conclusions.

For a controlled network trial, run in another terminal:

```sh
python3 scripts/fixtures/range-media-server.py /ABSOLUTE/PATH/fixture.flac \
  --log /tmp/precise-transfer.jsonl --ready-file /tmp/precise-origin.json \
  --bytes-per-second 1048576 --content-type audio/flac
```

Use the emitted localhost URL, preserving `.flac`, in a new private capture
configuration. Restart the server and use a fresh path for each cold trial.
Stop the server afterwards. Measure from `load-requested` to the first nonempty
PCM buffer, and compare transfer log timestamps on the same host. Never infer
startup from `.playing` alone, or run simultaneous audio trials.

## Evidence and rollback

Raw evidence is private under `/tmp/cymusic-flac-seek-20260910`: the
`matrix-ios-*` and corrected `matrix2-ios-*` captures/results, bounded App JSON,
UI screenshots, strict patch logs and `ios-implementation-build.log`.
The original matrix summary retains initial matcher failures; subsequent
`*-phase-match.json` files record the corrected offline matcher results without
rerunning or overwriting the native captures. `matcher-phase-controls.json`
records the measurement-tool regression cases; `matcher-phase-matrix-results.json`
summarizes the 13 existing-capture rechecks.
Task `flac-seek-lyric-sync` records baseline reproduction, independent review
and acceptance mapping under `.trellis/tasks/` (moved into `archive/` on
completion).
The supplied source script, resolved signed URLs, song, full lyrics and generated
media/binaries are excluded from the repository.

Turning the setting off and changing tracks restores the original timing policy.
The feature is one reversible scope: App setting/projection, the five added
native patch sections, focused diagnostics and documentation. Reverting it must
retain the older remote-command patch sections and third-party license. Restore
pristine pinned package sources and apply the reverted patch (prefer a fresh
checkout and frozen install), then rebuild the native App.
Changing the patch file does not undo edits already applied in `node_modules`;
Metro refresh alone is insufficient.
No schema migration or song-data rewrite is needed. Commit and push were
authorized separately after validation; no release build is included.

The task's media servers, native capture processes and Metro on port 8097 have
stopped after manual acceptance. The temporary App observation listener was
removed. The test App retains Chinese, FLAC and precision enabled; this does not
change the default for users. A later Debug reload requires starting Metro again.
