import { PlaylistListItem } from '@/components/PlaylistListItem'
import { unknownTrackImageUri } from '@/constants/images'
import { playListsStore } from '@/helpers/trackPlayerIndex'
import { Playlist } from '@/helpers/types'
import { useNavigationSearch } from '@/hooks/useNavigationSearch'
import { useUtilsStyles } from '@/styles'
import i18n from '@/utils/i18n'
import { useMemo } from 'react'
import { FlatList, FlatListProps, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
type PlaylistsListProps = {
	onPlaylistPress: (playlist: IMusic.PlayList) => void
} & Partial<FlatListProps<Playlist>>

export const PlaylistsListModal = ({
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
	const favoritePlayListItem = useMemo(
		() => ({
			name: 'Favorites',
			id: 'favorites',
			tracks: [],
			title: '喜欢的歌曲',
			coverImg: 'https://y.qq.com/mediastyle/global/img/cover_like.png?max_age=2592000',
			description: '喜欢的歌曲',
		}),
		[],
	)
	const storedPlayLists = playListsStore.useValue()
	const filteredPlayLists = useMemo(() => {
		const playLists = [favoritePlayListItem, ...(storedPlayLists ?? [])]

		if (!search) return playLists

		return playLists.filter((playlist: Playlist) =>
			playlist.name.toLowerCase().includes(search.toLowerCase()),
		)
	}, [search, favoritePlayListItem, storedPlayLists])
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
			data={filteredPlayLists}
			renderItem={({ item: playlist }) => (
				<PlaylistListItem
					playlist={playlist as Playlist}
					onPress={() => handlePlaylistPress(playlist as IMusic.PlayList)}
				/>
			)}
			{...flatListProps}
		/>
	)
}
