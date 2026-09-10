import myTrackPlayer from '@/helpers/trackPlayerIndex'
import TrackPlayer, { Event } from '@rntp/player'
import { logError } from '@/helpers/logger'

let subscriptions: { remove(): void }[] = []

export const playbackService = () => {
	if (subscriptions.length) return
	subscriptions = [
		TrackPlayer.addEventListener(Event.RemoteNext, () => {
			void myTrackPlayer.skipToNext().catch((error) => logError('远程下一首失败', error))
		}),
		TrackPlayer.addEventListener(Event.RemotePrevious, () => {
			void myTrackPlayer.skipToPrevious().catch((error) => logError('远程上一首失败', error))
		}),
		// The pinned iOS patch supplies observations for native hybrid transport.
		// Play/Pause/Stop already ran; Seek is also native and has no JS action.
		TrackPlayer.addEventListener(Event.RemotePlay, () => myTrackPlayer.observeNativeTransport('play')),
		TrackPlayer.addEventListener(Event.RemotePause, () => myTrackPlayer.observeNativeTransport('pause')),
		TrackPlayer.addEventListener(Event.RemoteStop, () => myTrackPlayer.observeNativeTransport('stop')),
	]
}

const hotModule = module as typeof module & { hot?: { dispose(callback: () => void): void } }
hotModule.hot?.dispose(() => {
	subscriptions.forEach((subscription) => subscription.remove())
	subscriptions = []
})
