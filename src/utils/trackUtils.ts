import { State } from 'react-native-track-player'

export const musicIsPaused = (state: State | undefined) =>
    state !== State.Playing;

export const musicIsBuffering = (state: State | undefined) =>
    state === State.Loading || state === State.Buffering;

