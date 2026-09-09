import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useEffect } from 'react'
import TrackPlayer, { Capability, RatingType, RepeatMode } from 'react-native-track-player'

const setupPlayer = async () => {
	await TrackPlayer.setupPlayer({})

	await TrackPlayer.updateOptions({
		ratingType: RatingType.Heart,
		capabilities: [
			Capability.Play,
			Capability.Pause,
			Capability.SkipToNext,
			Capability.SkipToPrevious,
			Capability.Stop,
			Capability.SeekTo,
		],
		progressUpdateEventInterval: 1,
	})

	await TrackPlayer.setVolume(1) // 默认音量1
	await TrackPlayer.setRepeatMode(RepeatMode.Queue)
}

let initialization: Promise<void> | undefined

const initializePlayer = () => {
	if (!initialization) {
		initialization = setupPlayer()
			.then(() => myTrackPlayer.setupTrackPlayer())
			.catch((error) => {
				initialization = undefined
				throw error
			})
	}
	return initialization
}

export const useSetupTrackPlayer = ({ onLoad }: { onLoad?: () => void }) => {
	useEffect(() => {
		let mounted = true

		initializePlayer()
			.then(() => {
				if (mounted) onLoad?.()
			})
			.catch((error) => {
				console.error(error)
			})

		return () => {
			mounted = false
		}
	}, [onLoad])
}
