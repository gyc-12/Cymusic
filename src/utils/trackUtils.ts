import { PlaybackState } from '@rntp/player'

export const musicIsPaused = (playing: boolean | undefined) => !playing

export const musicIsBuffering = (state: PlaybackState | undefined) =>
    state === PlaybackState.Buffering
