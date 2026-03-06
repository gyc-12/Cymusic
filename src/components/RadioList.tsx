import { RadioListItem } from '@/components/RadioListItem'
import { unknownTrackImageUri } from '@/constants/images'
import { Playlist } from '@/helpers/types'
import { useNavigationSearch } from '@/hooks/useNavigationSearch'
import { useUtilsStyles } from '@/styles'
import i18n from '@/utils/i18n'
import { useMemo } from 'react'
import { FlatList, FlatListProps, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
type PlaylistsListProps = {
	playlists: Playlist[]
	onPlaylistPress: (playlist: Playlist) => void
} & Partial<FlatListProps<Playlist>>

export const RadioList = ({
	playlists,
	onPlaylistPress: handlePlaylistPress,
	...flatListProps
}: PlaylistsListProps) => {
	const utilsStyles = useUtilsStyles()
	const search = useNavigationSearch({
		searchBarOptions: {
			placeholder: i18n.t('find.inPlaylist'),
			cancelButtonText: i18n.t('find.cancel'),
		},
	})

	const filteredPlaylist = useMemo(() => {
		if (!search) {
			return playlists
		}

		return playlists.filter((playlist) =>
			playlist.name.toLowerCase().includes(search.toLowerCase()),
		)
	}, [playlists, search])
	const itemDivider = useMemo(
		() => () => <View style={{ ...utilsStyles.itemSeparator, marginLeft: 80, marginVertical: 12 }} />,
		[utilsStyles],
	)
	const emptyListComponent = useMemo(
		() => (
			<View>
				<Text style={utilsStyles.emptyContentText}>No playlist found</Text>

				<FastImage
					source={{ uri: unknownTrackImageUri, priority: FastImage.priority.normal }}
					style={utilsStyles.emptyContentImage}
				/>
			</View>
		),
		[utilsStyles],
	)

	return (
		<FlatList
			contentContainerStyle={{ paddingTop: 10, paddingBottom: 128 }}
			ItemSeparatorComponent={itemDivider}
			ListFooterComponent={itemDivider}
			ListEmptyComponent={emptyListComponent}
			data={filteredPlaylist}
			renderItem={({ item: playlist }) => (
				<RadioListItem playlist={playlist} onPress={() => handlePlaylistPress(playlist)} />
			)}
			{...flatListProps}
		/>
	)
}
