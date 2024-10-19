import { useFavorites } from '@/store/library'
import { useCallback } from 'react'
import { useActiveTrack } from 'react-native-track-player'

export const useTrackPlayerFavorite = () => {
	const activeTrack = useActiveTrack()

	const { favorites, toggleTrackFavorite } = useFavorites()

	const isFavorite = favorites.find((track) => track.id === activeTrack?.id)?.id === activeTrack?.id

	// 我们正在更新轨道播放器内部状态和应用程序内部状态
	const toggleFavorite = useCallback(async () => {
		if (activeTrack) {
			// console.log('activeTrack', activeTrack)
			toggleTrackFavorite(activeTrack)
		}
	}, [isFavorite, toggleTrackFavorite, activeTrack])

	return { isFavorite, toggleFavorite }
}
