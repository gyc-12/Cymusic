import { useEffect, useState } from 'react'
import type { Track } from '@/player/types'
import { currentMusicStore } from '@/player/PlayerStore'

export const useLastActiveTrack = () => {
	const activeTrack = currentMusicStore.useValue()
	const [lastActiveTrack, setLastActiveTrack] = useState<Track>()

	useEffect(() => {
		if (!activeTrack) return

		setLastActiveTrack(activeTrack)
	}, [activeTrack])

	return lastActiveTrack
}
