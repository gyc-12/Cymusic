import { PlaylistTracksList } from '@/components/PlaylistTracksList'
import { screenPadding } from '@/constants/tokens'
import { Playlist } from '@/helpers/types'
import { useFavorites } from '@/store/library'
import { useDefaultStyles } from '@/styles'
import i18n from '@/utils/i18n'
import React, { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { Track } from 'react-native-track-player'
const FavoriteMusicScreen = () => {
	const defaultStyles = useDefaultStyles()
	// const search = useNavigationSearch({
	// 	searchBarOptions: {
	// 		placeholder: 'Find in favorites',
	// 	},
	// })

	const { favorites } = useFavorites()
	const playListItem = {
		name: 'Favorites',
		id: 'favorites',
		tracks: [],
		title: i18n.t('appTab.favoritesSongs'),
		coverImg: 'https://y.qq.com/mediastyle/global/img/cover_like.png?max_age=2592000',
		description: i18n.t('appTab.favoritesSongs'),
	}
	const filteredFavoritesTracks = useMemo(() => {
		// if (!search) return favorites as Track[]

		return favorites as Track[]
	}, [favorites])

	return (
		<View style={defaultStyles.container}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ paddingHorizontal: screenPadding.horizontal }}
			>
				<PlaylistTracksList playlist={playListItem as Playlist} tracks={filteredFavoritesTracks} />
			</ScrollView>
		</View>
	)
}
export default FavoriteMusicScreen
