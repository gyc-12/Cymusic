import { useCallback, useEffect, useState } from 'react'
import TrackPlayer from '@rntp/player'

export const useTrackPlayerVolume = () => {
	const [volume, setVolume] = useState<number | undefined>(1)

	const getVolume = useCallback(() => {
		const currentVolume = TrackPlayer.getVolume()
		setVolume(currentVolume)
	}, [])

	const updateVolume = useCallback((newVolume: number) => {
		if (newVolume < 0 || newVolume > 1) return

		setVolume(newVolume)

		TrackPlayer.setVolume(newVolume)
	}, [])

	useEffect(() => {
		TrackPlayer.setVolume(1)
		getVolume()
	}, [getVolume])

	return { volume, updateVolume }
}
