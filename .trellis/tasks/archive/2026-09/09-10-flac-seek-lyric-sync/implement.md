# Implementation plan: optional precise seeking

Status: approved by the user with “开始实现” on 2026-09-10; implementation, runtime verification and independent review complete; single work commit and push approved with “提交推送”.

## Activation

1. Completed: the user approved the default-off Switch, explanation, next-item
   activation, non-live scope, verification and rollback with “开始实现”.
2. Record that approval and run `task.py start` with the curated implement/check
   manifests. No further approval is needed for the agreed implementation.
3. Preserve the current baseline and unrelated WIP. Use an isolated `codex/`
   branch if needed; exclude existing IDE deletions, personal tooling, source
   scripts and generated/media data from this change.

## Ordered implementation and ownership

1. **App implementer:** typed PersistStatus key, settings row, locale files,
   facade snapshot, pure projection and related JS assertions. Keep current
   playback stable, identity extras intact and songs free of transport policy.
2. **Native implementer, exclusive patch owner:** five installed Swift files and
   the RNTP patch. Decode/forward the Boolean, retain full SourceContext through
   direct/proxy/fallback/live refresh, and omit precision for false/live inputs.
   Preserve existing remote-command and TS-warning patch hunks. Keep item
   initializer, waiting and seek tolerance unchanged.
3. **Focused native/content verification:** compile actual changed decoder,
   forwarding and asset/fallback methods with bounded seams where needed. Reuse
   original FLAC generation and independent PCM matching against the actual
   patched asset construction. Do not mirror production logic or merely grep for
   the key. Generated FLAC/PCM, binaries and user media remain temporary/ignored.
4. **Main integration:** review the full patch, apply it strictly to verified
   pinned source, rebuild the native App from this checkout, and exercise the
   isolated simulator. Metro-only refresh cannot validate a native patch.
5. **Trellis checker:** independently review requirements, contracts, source
   lifetimes, patch reproducibility, actual audio evidence and new diagnostics.
   Fix supported findings and rerun affected checks.
6. **Main records:** update focused maintenance documentation, local-patch notice,
   brief README setting guidance and native contract. Keep one independently
   revertible scope; commit/push only within user authorization.

App/native work may proceed in parallel after agreeing the extras contract.
Each implementer owns its files and must accommodate others; only the native
owner regenerates the patch. Integration/content checks depend on both parts.
These are layers of one feature, not separate product deliverables.

## Verification matrix

| Boundary | Required evidence |
| --- | --- |
| PersistStatus/Settings | Missing/false/true/non-Boolean handling; save/remount/restart; accessible localized description; only one new key; zero transport/queue calls on toggle. |
| Projection/source lifetime | Snapshot after delayed resolution; later item gets changed choice; old item stable; placeholder/live false; identity/headers/persisted music intact. |
| Native item/load | Real Boolean JSON vs null/string/number; extras metadata round trip; initial load, retry and Stop → Play retain correct item value. |
| Assets/fallback | HTTP/file/proxy, both fallback entry points, true/false/live, headers/ICY, key absence when disabled, one-shot/reset/stale-generation behavior. Existing live-edge seam bypasses asset creation and is not sufficient. |
| PCM correctness | Actual patched boundary; original FLAC local and controlled HTTP; forward/backward targets; independent contiguous content matching. Keep baseline failure evidence separately; clock agreement alone is insufficient. |
| Loading/other formats | Fresh no-store limited-bandwidth source, both modes, first actual PCM and transferred bytes; representative MP3 and MP4/ALAC; explicit live behavior. |
| Rebuilt App | Setting off/on, persistent restart, no active-song interruption, later-song activation, supplied-source FLAC seek then lyrics, backward seek, pause/resume and lyric delay. Label manual/automated limitations. |
| Integration | Strict patch, pinned graph, matched native/JS, inherited type/lint comparison, preserved licenses and no private/generated data in the final scope. |

Commands after implementation, using the locked toolchain:

```sh
node scripts/check-rntp-player.mjs
node scripts/check-rntp-remote-native.mjs
node scripts/check-rntp-precise-seeking.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --ignore-pattern 'lx-*.js'
git diff --check
```

`check-rntp-precise-seeking.mjs` is the focused native runner added by this task.
Its platform dependencies are documented; it must fail on compiler errors,
missing extraction boundaries, signals and invalid PCM. Keep costly optional
content experiments distinct from quick policy checks when appropriate.

Use existing frozen Yarn, strict patch-package and locked Pods procedures without
upgrading dependencies or regenerating the retained iOS project. Compare full
type/lint diagnostics to the recorded baseline and fix newly introduced findings.

## Completion

Require actual changed-owner checks and a rebuilt-App exercise. User-confirmed
listening/drag gestures are valid named evidence; prior M01–M12 results do not
cover this feature. Keep physical-device/background limits explicit. Stop task-only
diagnostic services when finished and retain user media only outside Git.

## Implementation checkpoint

App/native implementation, strict clean-package patch reproduction, Debug native
rebuild, actual-boundary FLAC/ALAC content measurements, cold-start measurements
and rebuilt-App integration checks are complete. The native runner described
above is now implemented. The private `lx-*.js` root file is explicitly excluded
from lint traversal and all Git scope; baseline lint/type diagnostics are recorded
without treating unrelated cleanup as feature work.

The MP3 coarse-matching phase-resolution fix passed 12 synthetic controls and
13 offline capture rechecks. The user confirmed manual FLAC dragging/listening
as passed. Final independent review of the complete scope has passed. See `acceptance.md` and the linked maintenance report. No
additional product/native changes have been made after the successful build.
The user subsequently approved the single feature commit and push; no release
build is included.
