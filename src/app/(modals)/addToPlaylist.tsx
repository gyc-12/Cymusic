import { PlaylistsListModal } from '@/components/PlaylistsListModal'
import { screenPadding } from '@/constants/tokens'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useFavorites } from '@/store/library'
import { useDefaultStyles } from '@/styles'
import { useHeaderHeight } from '@react-navigation/elements'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Track } from 'react-native-track-player'

const AddToPlaylistModal = () => {
	const defaultStyles = useDefaultStyles()
	const styles = useMemo(() => createStyles(defaultStyles), [defaultStyles])
	const router = useRouter()
	const params = useLocalSearchParams()

	const track: IMusic.IMusicItem = {
		title: params.title as string,
		album: params.album as string,
		artwork: params.artwork as string,
		artist: params.artist as string,
		id: params.id as string,
		url: (params.url as string) || 'Unknown',
		platform: (params.platform as string) || 'tx',
		duration: typeof params.duration === 'string' ? parseInt(params.duration, 10) : 0,
	}
	const headerHeight = useHeaderHeight()

	const { favorites, toggleTrackFavorite } = useFavorites()
	// track was not found
	if (!track) {
		return null
	}

	const handlePlaylistPress = async (playlist: IMusic.PlayList) => {
		// console.log('playlist', playlist)
		if (playlist.id === 'favorites') {
			if (favorites.find((item) => item.id === track.id)) {
				console.log('已收藏')
			} else {
				toggleTrackFavorite(track as Track)
			}
		} else {
			myTrackPlayer.addSongToStoredPlayList(playlist, track)
		}
		// should close the modal
		router.dismiss()
		Alert.alert('成功', '添加成功')

		// if the current queue is the playlist we're adding to, add the track at the end of the queue
		// if (activeQueueId?.startsWith(playlist.name)) {
		// 	await TrackPlayer.add(track)
		// }
	}

	return (
		<SafeAreaView style={[styles.modalContainer, { paddingTop: headerHeight }]}>
			<PlaylistsListModal onPlaylistPress={handlePlaylistPress} />
		</SafeAreaView>
	)
}

const createStyles = (defaultStyles: ReturnType<typeof useDefaultStyles>) =>
	StyleSheet.create({
	modalContainer: {
		...defaultStyles.container,
		paddingHorizontal: screenPadding.horizontal,
	},
	})

export default AddToPlaylistModal
