import { TracksList } from '@/components/TracksList'
import { colors, screenPadding } from '@/constants/tokens'
import { trackTitleFilter } from '@/helpers/filter'
import { generateTracksListId } from '@/helpers/miscellaneous'
import { songsNumsToLoadStore } from '@/helpers/trackPlayerIndex'
import { useNavigationSearch } from '@/hooks/useNavigationSearch'
import { useLibraryStore, useTracks, useTracksLoading } from '@/store/library'
import { defaultStyles } from '@/styles'
import i18n from '@/utils/i18n'
import { useCallback, useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'

const SongsScreen = () => {
	const search = useNavigationSearch({
		searchBarOptions: {
			placeholder: i18n.t('find.inSongs'),
			cancelButtonText: i18n.t('find.cancel'),
		},
	})

	const tracks = useTracks()
	const songsNumsToLoad = songsNumsToLoadStore.useValue()
	const isLoading = useTracksLoading()
	const { fetchTracks } = useLibraryStore()
	const filteredTracks = useMemo(() => {
		if (!search) return tracks
		return tracks.filter(trackTitleFilter(search))
	}, [search, tracks])

	const handleLoadMore = useCallback(() => {
		fetchTracks()
	}, [fetchTracks])

	if (!tracks.length && isLoading) {
		return (
			<View style={[defaultStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<ActivityIndicator size="large" />
			</View>
		)
	}

	if (!tracks.length && !isLoading) {
		return (
			<View style={[defaultStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<Text style={{ color: colors.textMuted, fontSize: 16 }}>
					{i18n.t('find.noMoreResults')}
				</Text>
			</View>
		)
	}

	return (
		<View style={defaultStyles.container}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ paddingHorizontal: screenPadding.horizontal }}
				onScroll={({ nativeEvent }) => {
					const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
					const paddingToBottom = 60
					const isCloseToBottom =
						layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom

					if (isCloseToBottom) {
						handleLoadMore()
					}
				}}
				scrollEventThrottle={400}
			>
				<TracksList
					id={generateTracksListId('songs', search)}
					tracks={filteredTracks}
					scrollEnabled={false}
					numsToPlay={songsNumsToLoad}
				/>
				{isLoading && tracks.length > 0 && (
					<View style={{ paddingVertical: 20, alignItems: 'center' }}>
						<ActivityIndicator size="small" />
					</View>
				)}
			</ScrollView>
		</View>
	)
}

export default SongsScreen
