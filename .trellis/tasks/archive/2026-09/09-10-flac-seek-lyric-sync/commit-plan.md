# Precise-seeking commit scope

One approved work commit:

```text
fix: add optional precise seeking on iOS
```

The switch, per-item policy and five native patch sections belong in the same
commit, together with their focused checks and records. The baseline is
`0bdaf08`, on `codex/flac-precise-seeking`. The user approved this scope and its push with “提交推送” after final independent
review. Implementation remains one work commit; task archival follows as
bookkeeping. This approval does not request a merge or release build.

## Included files

App:

- `src/store/PersistStatus.ts`
- `src/app/(modals)/settingModal.tsx`
- `src/helpers/trackPlayerIndex.ts`
- `src/player/mediaItem.ts`
- `src/locales/zh.json`
- `src/locales/en.json`

Native integration:

- `patches/@rntp+player+5.9.2.patch`

Focused diagnostics:

- `scripts/check-rntp-player.mjs`
- `scripts/check-rntp-precise-seeking.mjs`
- `scripts/check-rntp-pcm-matcher.py`
- `scripts/fixtures/rntp-precise-policy-probe.swift`
- `scripts/fixtures/rntp-precise-pcm-probe.swift`
- `scripts/fixtures/generate-flac-seek-fixture.py`
- `scripts/fixtures/match-rntp-pcm.py`
- `scripts/fixtures/range-media-server.py`

Documentation and contract:

- `README.md`
- `docs/development.md`
- `docs/maintenance/2026-09-10-precise-seeking.md`
- `third-party-licenses/README.md`
- `.trellis/spec/frontend/native-upgrade-contracts.md`

This task's records, all under `.trellis/tasks/09-10-flac-seek-lyric-sync/`:

- `task.json`
- `prd.md`
- `design.md`
- `implement.md`
- `implement.jsonl`
- `check.jsonl`
- `acceptance.md`
- `commit-plan.md`

## Excluded existing work

- The seven pre-existing `.idea/` deletions.
- Untracked `.agent/`, `.agents/`, `.claude/`, `.codex/`, `.factory/`,
  `.github/` agent/tooling files, `.gitattributes` and `AGENTS.md`.
- Other untracked Trellis setup/spec/task/workspace files. Only the one
  explicitly listed existing native contract and this task's records are in scope.
- Root `lx-*.js` private source, local research, all signed playback URLs, lyrics,
  song files, generated fixtures/captures, binaries and build artifacts.

The third-party license text, prior RNTP patch sections, package/lockfiles,
retained iOS project and unrelated playback owners are preserved. Revert this
work commit, install pristine pinned dependencies with the retained patches,
then rebuild native code to restore the old asset timing policy. Reverting a
patch file alone does not reverse the already-patched `node_modules` files.
No music-data migration or deletion is required.

## Completed work commit

Approved scope committed as `8514a1aa2966309870638a86411496b70dd6468e`. The paths above
are the original work-commit paths; these eight task records were subsequently
moved under `.trellis/tasks/archive/2026-09/09-10-flac-seek-lyric-sync/`
by the separate task-archival bookkeeping commit.
