# Immersive Artwork Player — Design

## Boundary

Baseline: `main` at `7881f86b2d7c2e73778bda45a5db5f929a321666`.

The appearance is owned by `src/app/player.tsx`; color requests are owned by
`src/hooks/usePlayerBackground.tsx`, which has no other consumers. These are the
expected product changes. A small player-specific helper/component is allowed
only if it keeps these owners clearer. Existing transport, progress, volume,
favorite, menu, lyric and queue owners remain in use.

## Composition

Paint the full player with one cover-derived base color. Place the artwork flush
with the top and both screen edges, including behind the status bar. Preserve
aspect ratio through centered cover cropping. Blend its lower portion into the
**same final base color** with several alpha stops, retaining a clear upper image.
A subtle upper scrim can protect the status bar and dismiss handle.

Finish the fade at the artwork region's lower boundary, before title/artist.
Their backdrop must be the opaque base color: bright artwork behind a partly
transparent fade would invalidate the palette's text-contrast bound. Reserve
space for progress, transport, volume and footer within the safe area, then adapt
artwork height to remaining space using live viewport dimensions. Decorative
layers do not receive touches. Keep dismissal above the artwork, horizontal
artwork swipe and tap-to-lyrics available, and the existing calm background in
lyric mode.

Paused artwork stays full size. Existing image transitions may remain but must
not leave it invisible after a failed skip or a next track with the same cover URI.

## Palette and Image Lifecycle

Use iOS `background`, not contrasting `primary`, as the source hue; narrow other
platform results to their dominant swatch. Scale RGB channels together to cap
relative luminance at `0.1`, preserving hue and white-label contrast. Normalize
valid three/six-digit hex to six digits. The image fade endpoint and lower
surface share one value, avoiding mismatched bands or an unrelated accent at
the bottom.

Associate color state with the requested URI. Late responses and unmounted
effects cannot replace the active palette. Keep a bounded cache, catch extraction
errors and use `#191b20` while an uncached request is pending. The hook owns a
50-entry LRU cache; disable the library's unbounded cache.
Missing/failed artwork uses the existing placeholder. Do not retain a previous
song’s palette indefinitely when extraction fails.

Retain `expo-image`, cover fit, cache policy and a stable recycling key. Animate
the enclosing view instead of the native image. No new dependency, native patch,
persisted setting or playback-layer change is needed.

## Validation and Rollback

Inspect actual app screenshots for warm, cool/dark, bright and missing/failed art,
paused and lyric states, and two portrait phone sizes including a compact layout.
Check the existing interactions. Focus executable checks on asynchronous color
lifecycle and compare diagnostics against the current baseline; style assertions
cannot establish visual quality or native gesture behavior.

Implement on `codex/immersive-artwork-player`. Preserve unrelated working-tree
changes and untracked files. Temporary media/evidence stays outside the repository
unless explicitly selected for the report; no private source script or reference
album artwork is added. Rollback is this feature’s diff, with no data migration.
