# Native Upgrade and Retained Data Contracts

## 1. Scope / Trigger

Apply these contracts when changing Expo/RN, native dependencies, local-media access,
storage adapters, or the share extension. They describe the retained CyMusic owners;
an SDK template is a reference for integration changes, not a replacement project.

The current retained-native target is Expo **57.0.21**, React Native **0.86.3**,
React **19.2.3**, New Architecture and Hermes HBC **98**, with iOS **16.4+**.
Its implementation and verification scopes are summarized in
`../../../docs/maintenance/2026-09-10-results.md`.
Use the existing `package.json`, `yarn.lock` and `ios/Podfile.lock` as one graph;
do not independently advance React/RN or replace the retained iOS project with a
generated template. Original Debug/Release builds and M01–M12 manual acceptance
exist; internal cleanup, full Release storage comparison, CI and signed-device
limits remain explicitly recorded in that task.

The current file/dependency assessment is in
`../../../docs/audit/2026-09-09/report.md`. Retired intermediate evidence is indexed
by that report’s cleanup appendix; the reusable contracts below remain active.
A simulator result does not establish physical background playback, signing or
all functional acceptance.

## 2. Signatures

```ts
// src/helpers/localFile.ts
resolveLocalFile(
  value: unknown,
  options?: { requireOwnedMedia?: boolean },
): Promise<LocalFileResult>

type LocalFileResult =
  | { status: 'nonlocal' }
  | { status: 'unresolved'; reason:
      'invalid' | 'missing' | 'ambiguous' | 'not-file' |
      'outside-container' | 'unowned' | 'unsafe-path' | 'unreadable' }
  | { status: 'resolved'; filePath: string; fileUri: string; relocated: boolean }

// src/store/getOrCreateMMKV.ts: the only instance factory
getOrCreateMMKV(dbName: string, cachePath?: boolean)

// react-native-mmkv 4.3.2 / react-native-nitro-modules 0.35.9
createMMKV(configuration?: Configuration): MMKV
store.remove(key: string): boolean

// src/store/PersistStatus.ts; K is a key of its IPersistConfig
PersistStatus.set<K>(key: K, value: IPersistConfig[K] | undefined): void
PersistStatus.get<K>(key: K): IPersistConfig[K] | null
PersistStatus.useValue<K>(key: K, defaultValue?: IPersistConfig[K]): IPersistConfig[K] | null

// src/helpers/trackPlayerIndex.ts
deleteImportedLocalMusic(musicItemsIdToDelete: string): Promise<void>

// modules/cymusic-native/index.ts (CyMusicFileSystem, iOS only)
documentDirectoryPath: string // synchronous raw Foundation path
libraryDirectoryPath: string
cachesDirectoryPath: string
exists(path: string): Promise<boolean>
stat(path: string): Promise<'file' | 'directory' | 'symlink' | 'other'>

// src/helpers/fileDownload.ts
downloadFile(url: string, destinationUri: string,
  onProgress?: (progress: { bytesWritten: number; contentLength: number }) => void,
): Promise<void>

// modules/cymusic-native/userApi.ts: internal transport, not the public LX protocol
loadScript(info: UserApiScript): string // native-generated runtime identity
sendAction(action: string, info: string, generation: string): void
destroy(): string
// api-action envelope: { generation: string, action: string, data?: string, ... }
```

## 3. Contracts

### Local paths, identities and deletion

- Raw absolute paths preserve literal percent sequences: `/a/%23.mp3` names a
  percent-containing file. File URIs may be encoded or old concatenated strings.
  The resolver checks decoded-once and literal interpretations without parsing
  away filename `#` or `?`. Two existing interpretations are ambiguous, not a
  reason to choose one. Only the historically produced `file://file:///` prefix
  is normalized; malformed authority, separators and traversal are rejected.
- `filePath` is the native path for filesystem operations; `fileUri` encodes each
  path segment once for RNTP, native image loading and sharing. The `/private/var/`
  alias is normalized only for comparisons, not for native I/O spelling.
- Relocation is lazy. A missing old path can move only within the same recognized
  `Containers/Data/Application/<UUID>/Documents` or `Library` ancestry as the
  native current roots. Library relocation is limited to `Caches/ImagePicker/`.
  Do not globally replace UUIDs or search another application's container.
- Reading an existing supplied file and deleting an owned media file are separate
  contracts. Deletion requires a file under current `Documents/importedLocalMusic/`,
  `Documents/download/music/` or `Documents/musicCache/`, plus plain directory
  ancestry. A symlink, directory, ambiguous name or I/O failure cannot establish
  an owned deletion target.
- Media IDs are opaque, including URI-shaped IDs. Deletion first selects exactly
  one existing record by ID and resolves that record's URL. It rechecks identity
  after asynchronous work and filters the latest list so concurrent imports
  survive. Unknown/duplicate IDs are no-ops. Explicit removal may discard an
  unresolved record, but must not guess a file to delete.
- `MusicSourceResolver.resolveSource` owns current/preload resolution. An unresolved
  local address returns the existing fake-audio fallback; only current requests
  display its existing error. Playlist cover hydration projects resolved addresses
  into live state without rewriting persisted IDs, nested songs or URLs.

### Storage ownership and migration

- Keep `appPersistStatus` and `MediaExtra.<platform>` database identities, media
  keys, and iOS roots `Documents/mmkv` / `Documents/cache/mmkv` unchanged. The
  factory caches instances by database name; do not reuse one name for both roots.
- PersistStatus values remain JSON strings. `undefined` deletes a key; missing or
  malformed JSON reads as `null`. Consumers remove their value-change listeners
  on cleanup. Adapt a new MMKV library's API at these existing owners rather than
  adding a second store or converting all persisted values.
- With MMKV4, instantiate through `createMMKV`, keep `MMKV` type-only where used
  as a type, and delete through `remove`. Retain the explicit database paths even
  though the application has an App Group: accepting the library's default path
  can select a different storage location. Do not replace the factory cache,
  database IDs, JSON representation or subscription ownership as part of this API
  adaptation. `MMKV.remove` reports whether a key was removed; the existing
  PersistStatus setter still returns void and preserves its public contract.
- `music.play-list` is the current queue, `music.playList` its legacy fallback,
  and `music.playLists` user playlists. They are not aliases. Current queue wins;
  only a missing current queue allows the existing legacy migration and deletion
  of its legacy key. Preserve the existing startup defaults as a measured baseline.
- AsyncStorage chunking in `src/helpers/storage.ts` retains the 500000-character
  limit, `@___PART___` prefix, comma-separated part references, JSON representation,
  removal semantics and rethrown I/O failures. A logger compatibility change must
  not alter serialization or silently consume errors.
- Before the first write with a new storage core, keep a quiescent byte backup and
  a logical export. Compare first read, controlled first write and second launch.
  Git rollback does not restore a database written by a newer native core.
- A subject written by MMKV4 must not launch the old MMKV2 binary against those
  rewritten files. Recovery pairs the original binary with its original quiescent
  data on a separately identified disposable subject. Raw byte changes after a
  normal MMKV write are not logical data loss; compare the full logical values as
  well as media and App Group files.

### Filesystem module and downloads

- Expo FileSystem owns ordinary I/O. `CyMusicFileSystemPaths` supplies the original
  synchronous raw Foundation directory roots and `Darwin.lstat` queries. Only
  ENOENT/ENOTDIR mean absent; other native failures propagate. A dangling symlink
  still exists as a symlink and cannot prove an owned regular-file deletion.
  Do not substitute `File.exists` for the non-following type/ancestry contract.
- Preserve `getLocalFilePath`'s stored/returned string. `getCacheFileUri` derives a
  separate canonical I/O URI from the known raw filename, encoding path segments
  once. Feed document-picker URIs directly to `new File(uri).text()` without first
  decoding the entire string.
- `downloadFile` uses the official Expo `/legacy` foreground resumable API because
  it exposes actual HTTP status. Only 200 moves the unique temporary file into its
  final destination; all other statuses reject. This API still uses Expo Modules.
- Keep the original temporary URI immutable: `File.move` changes the source File's
  URI. Cleaning that moved instance would delete the final file. In `finally`,
  cancel the DownloadResumable to remove its progress subscription and clean the
  original temporary URI. Cleanup errors are logged without replacing the main
  result/error. Never sweep unrelated cache files to conceal a leaked task.
- Explicit overwrite can delete the old target before move completes. Do not claim
  atomic replacement or unconditional preservation after a move failure. Expo's
  public foreground download has no equivalents for the former RNFS15-second
  request/one-hour resource timeouts and disables URLCache; retain these documented
  differences when changing adapters.

### Expo57 native graph and Metro ownership

- The verified local tool set is Node24.19.0, Yarn1.22.22, CocoaPods1.16.2 and
  Xcode26.6. Keep frozen Yarn installation, `patch-package --error-on-fail` and
  deployment-locked Pods. `README.md` distinguishes fresh installation from
  recovery of an existing Pods configuration; a completed build is not an
  instruction to reinstall its dependencies.
- Preserve the custom Swift AppDelegate integration, native source/preload
  membership, extension and privacy manifests. Expo57 prebuild defaults to clean;
  it must not regenerate over these retained owners. Build caches and DerivedData
  belong to the actual checkout path; copied ModuleCache/PCM files do not establish
  clean reproducibility.
- `metro.config.js` owns the native Axios resolution exception. For module name
  `axios` on iOS/Android, delegate with `unstable_enablePackageExports: false` to
  retain the browser/XHR entry for both import and require callers. Delegate all
  other module/platform combinations unchanged. Do not disable exports for the
  entire dependency graph or create a second HTTP adapter in consumers.
- Keep `babel-preset-expo` responsible for the compatible Worklets transform;
  adding a duplicate legacy Reanimated plugin is not the Reanimated4 migration.

### New Architecture list and image consumers

- FlashList2.0.2 auxiliary slots such as `ListEmptyComponent` and
  `ListFooterComponent` require an accepted element/plain function. A raw
  `React.memo` component object can be dropped by its `getValidComponent` path.
  `NowPlayList` supplies `<EmptyListComponent />` / `<ItemDivider />`, and
  `SearchList` supplies `!isLoading ? <EmptyComponent /> : null`. Keep those
  loading/footer conditions and the existing callbacks, keys and queue owners.
  `ItemSeparatorComponent` has a separate rendering path; do not rewrite every
  slot merely because one auxiliary slot failed.
- For the mini-player, animate the surrounding view and keep the displayed URI
  and recycling key stable while the track is unchanged. Preserve content fit, cache policy and
  fallback artwork. An ordinary loaded cover is insufficient evidence for a
  change affecting delayed/failing sources: repeated native image recreation was
  observed in the directly animated image path.

### System volume, request grace and sleep deadlines

- `CyMusicVolumeModule` owns system output volume through AVAudioSession KVO and
  a retained MPVolumeView/UISlider on the main queue. It must not set the audio
  session category, mode or activation; the playback owner keeps those decisions.
  Keep the system volume HUD enabled. A resolved slider write is not proof that
  physical output volume changed, especially on a simulator.
- Register KVO with both `.initial` and `.new`, assigning its observation
  generation before `observe`. The Expo first-listener hook can reach the main
  queue after the initial `getVolume` call; `.new` alone loses a hardware change
  in that gap. Retire observation on the last listener and module destruction.
  Queued callbacks and delayed initial React reads cannot update a retired owner.
- The two existing HTTP owners share `createRequestTimeout`: ordinary runtime
  timers drive AbortController, while a separate finite UIKit task preserves
  background grace. Manual abort clears the timer and releases the task
  immediately; `finally` also covers request-data preparation and response errors.
  Preserve each owner's parsing, headers, encoding and error mapping.
- Normalize a cancelled fetch at its existing request owner using that request's
  `AbortController.signal.aborted`. Expo's native cancellation error text differs
  from the old literal `Aborted`. Produce the existing raw `Aborted` error only
  for an actually cancelled controller, then let the existing public wrappers
  map it (`httpFetch` maps it to its timeout message). A non-cancelled request
  retains its original error object even if its text resembles cancellation.
- The JS release closure and `CyMusicRequestTaskRegistry` each settle their own
  resource once. A late native task identifier is ended if its operation already
  finished. Expiration, denial, duplicate end and module invalidation cannot leak
  or double-end a UIKit task. UIKit denial must not prevent an ordinary request.
- `src/utils/delay.ts` retains its milliseconds-to-Promise<void> contract for
  the existing 500ms player recovery and 120ms lyric retry. It uses the same finite
  grace owner and releases it on completion, including a late native return.
- Sleep scheduling remains separate from HTTP timeouts: one wall-clock deadline
  and native generation feed `timingClose.ts`, which checks both before calling
  the existing player facade's `pause`. Cancel/replacement rejects queued stale
  events; expiry invalidates its generation before awaiting pause. Native and JS
  foreground checks handle an overdue current deadline once.
- Handle a synchronous native schedule failure before publishing JS deadline or
  generation. The existing custom-minute input can supply a non-finite number;
  log the failure and keep the previous timer, rather than throwing from its UI
  callback or publishing a timer that the native owner rejected.
- Sleep subscriptions live for the module, independently of the player screen.
  Hot disposal removes subscriptions and cancels the native timer; the countdown
  hook cleans its interval on replacement, expiry and unmount. No process exit,
  track-end scheduling or Expo BackgroundTask substitution belongs in this path.
  Finite UIKit grace and background audio do not provide perpetual iOS execution.

### Native and share boundaries

- The self-owned JSC engine is `modules/cymusic-native/ios/CyMusicUserApiRuntime.h/.m`
  (NSObject), wrapped by `CyMusicSourceModule.swift` under module name
  `UserApiModule`. The local Expo Pod alone compiles the core; do not restore the
  deleted app-target RCT module or compile the same core twice. Its public header,
  JavaScriptCore/Security frameworks and Expo module registration belong together.
- Keep the actual `ios/CyMusic/user-api-preload.js` as an app bundle resource.
  The source-tree preload copy is different and is not its substitute. Preserve
  script protocol, metadata, crypto and evaluation on the private serial JSC queue;
  the custom runtime remains separate from RN's Hermes engine.
- Every load/destroy creates a runtime generation. Native commands, cancellable
  one-shot timers and buffered events belong to that generation. The JS facade
  checks the envelope generation before parsing or merging metadata, including
  events already queued by Expo. Use instance-targeted `emit(event:payload:)`.
- A per-load disposer connects facade retirement with the LX adapter's init/music
  promises, HTTP controllers, timers, maps and listener. Settle pending work once;
  late callbacks/finally blocks cannot delete newer entries with a reused key.
  Music attempts use distinct internal IDs while preserving the caller's business
  request context and script action/musicInfo/quality.
- Native last-listener removal preserves the running JSC context and current
  buffered events. Destroy/load cancel old native timers; clearTimeout reaches the
  actual native timer owner. Merely discarding a JS callback does not free that
  timer. Module invalidation clears timers, context, buffer and event handler.
- Preserve bundle identity `com.music.player.gyc`, the extension identity, URL
  scheme, App Group `group.com.music.player.gyc` and key `cymusicShareKey`. Upgrade
  the extension writer, patched native reader and JS parser as a paired protocol.
  When changing web-URL serialization, accept pending payloads from the previous
  installed version in order; do not clear or eagerly rewrite them during decoding.
- The SDK52 web-URL reader accepts v3 JSON Data and legacy plist `[String]` values.
  `decodeWebUrl(data: Data) -> [WebUrl]?` must remain fallible: its caller returns
  the established `"empty"` result for malformed JSON, file-record Data or URL
  records missing required metadata. Never force-unwrap this decoded input or
  remove the shared key on decode failure. Preserve the existing media decoder's
  separately measured behavior; this guard is specific to the changed web-URL path.
- Keep full `#clip` text, including embedded URLs, and the existing file/text/PDF
  paths. Host and extension privacy manifests both declare the applicable
  UserDefaults reasons `CA92.1` and `1C8F.1`. Resource presence and simulator ad-hoc
  signatures do not prove provisioned physical-device App Group access.
- For RNTP seek assertions, observe bounded convergence of position, active track
  identity and playing state. The resolved `seekTo` promise alone is not proof
  that the native player has completed its seek.
- Preserve the existing separate CommonJS/LX runtime owners. The CommonJS
  four-argument `getMusicUrl` protocol has no generic cancellation/destroy API.
  Actual selection of CommonJS retires the prior LX runtime via the existing reload
  owner; test-only CommonJS validation does not. Do not claim generic cancellation
  of arbitrary CommonJS scripts. Source-switch UI success alone does not establish
  internal HTTP/timer/listener cleanup; use owner-specific evidence.

## 4. Validation & Error Matrix

| Input / condition | Required result |
| --- | --- |
| Non-string, empty or non-file remote URL | `nonlocal`; preserve normal remote/cache resolution |
| Invalid file URI, encoded separator, traversal or malformed escape | `unresolved: invalid`; no file I/O target guessed |
| Both decoded and literal filenames exist | `unresolved: ambiguous`; no arbitrary selection |
| Missing path with no recognized relocation ancestry | `unresolved: outside-container` |
| Recognized relocation candidate absent | `unresolved: missing` |
| Candidate exists but is not a regular file | `unresolved: not-file` |
| Deletion candidate outside owned media roots | `unresolved: unowned`; record removal never implies disk deletion |
| Relocated/deletion path has non-directory ancestry | `unresolved: unsafe-path` |
| Native existence/stat access throws | `unresolved: unreadable`; no inference that the file is absent |
| Unknown/duplicate deletion ID | No file deletion and no list mutation |
| Storage key is absent or malformed JSON | Existing `null` read behavior; no repair-by-wipe |
| `#weburl` key contains malformed/wrong-kind Data | Native `"empty"` result, no trap and no preference write/clear |
| New native binary loads JavaScript from another SDK stage | Invalid checkpoint; coordinate the correct Metro/bundle first |
| MMKV4 constructor omits the explicit old database path | Invalid storage adaptation even if a new empty store opens successfully |
| Old MMKV2 binary is paired with MMKV4-written files | Invalid recovery; restore the matching original binary and data together |
| FlashList auxiliary slot receives an unsupported memo object | Preserve the same component/condition but provide its React element |
| Axios native resolution chooses its Node entry | Fix the scoped Metro resolution owner, not each request caller |
| HTTP206/404/500 or transport failure during file download | Reject; no final commit; original temp and progress listener cleaned |
| Old native api-action arrives after load/destroy | Drop before JSON parsing and source metadata merge |
| Old request callback/finally completes after runtime replacement | No settlement/deletion of a new runtime's entry; retired transport aborted |
| Timer A200ms is replaced after30ms by runtime B's callback0 at1000ms | A is physically cancelled; B cannot fire at A's old deadline |
| System volume changes between the initial read and KVO registration | Initial KVO snapshot delivers the current value; no lost startup update |
| Request finishes before its native background-task identifier returns | End the late task exactly once; do not keep a lease for completed work |
| Sleep timer is cancelled/replaced before an old event reaches JS | No pause from that stale generation/deadline |
| New sleep schedule fails synchronously | Keep the previous deadline/generation; log without escaping the UI callback |

## 5. Good / Base / Bad Cases

- **Good:** update in place, re-resolve native roots, play an untouched stale URL
  through the real resolver/player, and confirm stored IDs plus media hashes match.
- **Base:** an existing raw Unicode filename resolves to one encoded URI; a normal
  HTTPS source continues through the existing remote-source owner.
- **Good:** a final native artifact and its actual generated/embedded JS use the
  same frozen graph; storage reads retain their old identities and an emptied
  queue renders the existing empty-state element.
- **Bad:** decode every string twice, replace all container UUIDs in JSON, use an
  ID as a pathname, clear MMKV after a read error, or treat a resolved seek promise
  and a successful compilation as functional acceptance.

## 6. Tests Required

Use focused task fixtures and native runs; this contract does not require adding a
test framework. Re-run assertions affected by the change and record exact inputs.

1. Local representation/relocation: raw and encoded Unicode, literal percent,
   raw `#`/`?`, duplicate scheme, ambiguity, malformed escapes, directories,
   traversal, symlinks and different-container ancestry. Assert exact result and
   zero unexpected deletion. Use `scripts/check-local-files.mjs` and
   `scripts/check-native-files.swift`; concurrent add/delete assertions retain records.
2. Real current/preload playback, canonical RNTP/share URI, exact selected-record
   deletion and cold cover projection/decode. Keep a failing pre-fix report and test
   the original stale records; do not reseed them with already-correct URLs.
3. Quiescent backup hashes before/after installation, all logical MMKV/AsyncStorage
   values, controlled first write and second launch. Account explicitly for normal
   active-track/progress writes; migration is never validated by uninstall/reset.
4. Both script formats, request success/error/timeout/cancel/correlation/reload,
   local/online audio, queue/timer and seek observations. Restore protected state
   and confirm cleanup. Unsupported legacy APIs are recorded unsupported, not passed.
5. Actual extension → App Group → native reader → parser → host UI for changed
   payloads, including pending old format; native export bytes must match. Keep
   simulator, DevLauncher and physical signed behavior as distinct evidence.
   For changed native decoders, run wrong-kind/malformed/missing-field inputs
   against the actual methods and assert safe rejection plus byte-identical
   preferences. Preserve pre-fix trap evidence separately from the fixed result.
6. Package alignment, strict patches, locked Pods, retained native resources and
   matching SDK binary/JS. Compare inherited type/lint diagnostics precisely;
   do not weaken checks to hide a new failure.
7. For an Expo57 native change, verify RN/React identity, Fabric/bridgeless and
   actual Hermes98 bytecode rather than inferring them from configuration alone.
   Verify original-root reproduction separately from the isolated candidate;
   simulator ad-hoc verification does not establish signed-device entitlement use.
8. For affected list/image consumers, assert real one-row-to-empty and reopened
   empty states, loading conditions, row identity and matched delayed/failing
   image request behavior. A source check or selected frame does not prove an
   entire gesture or loading interval.
9. File downloads: `scripts/check-file-downloads.mjs`, plus actual iOS200/non200/
   transport fixtures. Check final bytes after cleanup, progress-listener counts,
   special filenames, and brief native playback. A mock move failure cannot prove
   native atomicity or old-target preservation.
10. Source lifetimes: `scripts/check-source-host.mjs` and
    `scripts/check-source-runtime.mjs` execute host owners and the real Foundation/
    JSC core. Assert A/B timer isolation, cancellation, buffered generations,
    crypto vectors, one-time settlement and retired HTTP socket closure. After
    native integration, also verify unique Expo registration, mixed compilation,
    bundled preload bytes and activation/retirement on iOS.
11. Native services: `scripts/check-volume.mjs`,
    `scripts/check-volume-native.mjs`, `scripts/check-request-timers.mjs`,
    `scripts/check-sleep-timer.mjs` and `scripts/check-native-services.mjs`
    cover the actual host owners and Foundation cores. Preserve the failing
    `.new`-only KVO reproduction, late lease/expiry cleanup, real deadline
    cancellation and stale-generation checks. A signalled native test process
    must fail; `status: null` is not exit code zero. After integration, check
    Expo registration and actual iOS events/HTTP closure without equating them
    to private lease counts or physical-device background/volume acceptance.

Reuse completed evidence unless a change or unresolved concern requires a new
check. User-confirmed manual steps are valid evidence for their named visible
behavior; record that attribution and retain separately unmeasured internal,
raw-storage and device conditions. Do not repeat a manual test solely to obtain
an automated count.

## 7. Wrong vs Correct

```ts
// Wrong: a persisted ID may look like a URI, and a URI is not a native path.
await RNFS.unlink(decodeURIComponent(musicId.replace('file://', '')))

// Correct boundary: select the existing record, then resolve its owned URL.
const record = items.find((item) => item.id === musicId)
if (record) {
  const local = await resolveLocalFile(record.url, { requireOwnedMedia: true })
  if (local.status === 'resolved') {
    // The production deletion owner also rechecks uniqueness/concurrent state.
    await FileSystem.deleteAsync(local.fileUri)
  }
}
```

Do not duplicate this deletion flow in new consumers; call the existing owner.

```ts
// Wrong for the final MMKV4 graph: changes construction/path or uses the old API.
const replacement = new MMKV({ id: dbName })
replacement.delete(key)

// Correct: keep the existing factory and explicit path; adapt only the API.
const store = getOrCreateMMKV(dbName)
store.remove(key)
```

```tsx
// Wrong for FlashList2's auxiliary memo-component path.
<FlashList ListEmptyComponent={EmptyListComponent} />

// Correct: same component and visible behavior, accepted element representation.
<FlashList ListEmptyComponent={<EmptyListComponent />} />
```
