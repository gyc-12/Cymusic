import { useEffect } from 'react'
import TrackPlayer, { Event } from '@rntp/player'

export const useLogTrackPlayerState = () => {
	useEffect(() => {
		const subscriptions = [
			TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
				console.warn('An error occurred: ', event)
			}),
			TrackPlayer.addEventListener(Event.PlaybackStateChanged, (event) => {
				console.log('Playback state: ', event.state)
			}),
			TrackPlayer.addEventListener(Event.IsPlayingChanged, (event) => {
				console.log('Playing: ', event.playing)
			}),
		]
		return () => subscriptions.forEach((subscription) => subscription.remove())
	}, [])
}
