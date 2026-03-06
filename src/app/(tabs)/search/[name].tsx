import { screenPadding } from '@/constants/tokens'
import { usePlaylists } from '@/store/library'
import { useDefaultStyles } from '@/styles'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { ScrollView, View } from 'react-native'

const PlaylistScreen = () => {
	const defaultStyles = useDefaultStyles()
	const { name: playlistName } = useLocalSearchParams<{ name: string }>()

	const { playlists } = usePlaylists()

	const playlist = playlists.find((playlist) => playlist.name === playlistName)

	if (!playlist) {
		console.warn(`song ${playlistName} was not found!`)

		return <Redirect href={'/(tabs)/search'} />
	}

	return (
		<View style={defaultStyles.container}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ paddingHorizontal: screenPadding.horizontal }}
			></ScrollView>
		</View>
	)
}

export default PlaylistScreen
