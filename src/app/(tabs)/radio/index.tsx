import { RadioList } from '@/components/RadioList'
import { screenPadding } from '@/constants/tokens'
import { playlistNameFilter } from '@/helpers/filter'
import { Playlist } from '@/helpers/types'
import { useNavigationSearch } from '@/hooks/useNavigationSearch'
import { usePlaylists } from '@/store/library'
import { useDefaultStyles } from '@/styles'
import i18n from '@/utils/i18n'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
const RadiolistsScreen = () => {
	const defaultStyles = useDefaultStyles()
	const router = useRouter()

	const search = useNavigationSearch({
		searchBarOptions: {
			placeholder: i18n.t('find.inRadio'),
			cancelButtonText: i18n.t('find.cancel'),
		},
	})

	const { playlists } = usePlaylists()
	const filteredPlayLists = useMemo(() => {
		if (!search) return playlists
		return playlists.filter(playlistNameFilter(search))
	}, [search, playlists])

	const handlePlaylistPress = (playlist: Playlist) => {
		router.push(`/(tabs)/radio/${playlist.title}`)
	}

	return (
		<View style={defaultStyles.container}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{
					paddingHorizontal: screenPadding.horizontal,
				}}
			>
				<RadioList
					scrollEnabled={false}
					playlists={filteredPlayLists}
					onPlaylistPress={handlePlaylistPress}
				/>
			</ScrollView>
		</View>
	)
}

export default RadiolistsScreen
