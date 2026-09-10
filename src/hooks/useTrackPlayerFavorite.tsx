import { useFavorites } from '@/store/library'
import { useCallback } from 'react'
import { currentMusicStore } from '@/player/PlayerStore'

export const useTrackPlayerFavorite = () => {
	const activeTrack = currentMusicStore.useValue()

	const { favorites, toggleTrackFavorite } = useFavorites()

	const isFavorite = !!activeTrack && favorites.some((track) => track.id === activeTrack.id)

	const toggleFavorite = useCallback(() => {
		if (activeTrack) {
			toggleTrackFavorite(activeTrack)
		}
	}, [toggleTrackFavorite, activeTrack])

	return { isFavorite, toggleFavorite }
}
