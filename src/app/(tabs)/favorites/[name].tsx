import { PlaylistTracksList } from '@/components/PlaylistTracksList'
import { screenPadding } from '@/constants/tokens'
import myTrackPlayer, { playListsStore } from '@/helpers/trackPlayerIndex'
import { Playlist } from '@/helpers/types'

import { useDefaultStyles } from '@/styles'
import { Redirect, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { Track } from 'react-native-track-player'

const PlaylistScreen = () => {
	const defaultStyles = useDefaultStyles()
	const { name: playlistID } = useLocalSearchParams<{ name: string }>()
	const playlists = playListsStore.useValue() as Playlist[] | null

	const playlist = useMemo(() => {
		return playlists?.find((p) => p.id === playlistID)
	}, [playlistID, playlists])

	const songs = useMemo(() => {
		return playlist?.songs || []
	}, [playlist])

	const handleDeleteTrack = useCallback(
		(trackId: string) => {
			myTrackPlayer.deleteSongFromStoredPlayList(playlist as Playlist, trackId)
		},
		[playlist],
	)

	if (!playlist) {
		console.warn(`Playlist ${playlistID} was not found!`)
		return <Redirect href={'/(tabs)/favorites'} />
	}

	return (
		<View style={defaultStyles.container}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ paddingHorizontal: screenPadding.horizontal }}
			>
				<PlaylistTracksList
					playlist={playlist as Playlist}
					tracks={songs as Track[]}
					allowDelete={true}
					onDeleteTrack={handleDeleteTrack}
				/>
			</ScrollView>
		</View>
	)
}

export default PlaylistScreen
