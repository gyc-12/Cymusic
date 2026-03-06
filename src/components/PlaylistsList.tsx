import { PlaylistListItem } from '@/components/PlaylistListItem'
import { unknownTrackImageUri } from '@/constants/images'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { Playlist } from '@/helpers/types'
import { useNavigationSearch } from '@/hooks/useNavigationSearch'
import { useUtilsStyles } from '@/styles'
import i18n from '@/utils/i18n'
import { useMemo } from 'react'
import { Alert, FlatList, FlatListProps, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
type PlaylistsListProps = {
	playlists: Playlist[]
	onPlaylistPress: (playlist: Playlist) => void
} & Partial<FlatListProps<Playlist>>

export const PlaylistsList = ({
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

	const showDeleteAlert = (playlist: Playlist) => {
		Alert.alert('删除歌单', `确定要删除这个歌单吗 "${playlist.name}"?`, [
			{ text: '取消', style: 'cancel' },
			{
				text: '删除',
				style: 'destructive',
				onPress: async () => {
					try {
						const result = await myTrackPlayer.deletePlayLists(playlist.id)
						if (result === 'success') {
							// 删除成功
							// 可以在这里添加一些成功的反馈，比如显示一个成功的提示
							Alert.alert('成功', '歌单删除成功')
						} else {
							// 删除失败，显示错误信息
							Alert.alert('错误', result)
						}
					} catch (error) {
						// 处理可能发生的错误
						Alert.alert('错误', 'An error occurred while deleting the playlist')
					}
				},
			},
		])
	}
	return (
		<FlatList
			contentContainerStyle={{ paddingTop: 10, paddingBottom: 128 }}
			ItemSeparatorComponent={itemDivider}
			ListFooterComponent={itemDivider}
			ListEmptyComponent={emptyListComponent}
			data={filteredPlaylist}
			renderItem={({ item: playlist }) => (
				<PlaylistListItem
					playlist={playlist}
					onPress={() => handlePlaylistPress(playlist)}
					onLongPress={() => showDeleteAlert(playlist)}
				/>
			)}
			{...flatListProps}
		/>
	)
}
