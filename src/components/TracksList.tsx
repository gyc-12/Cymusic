import TracksListItem from '@/components/TracksListItem'
import { unknownTrackImageUri } from '@/constants/images'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useQueue } from '@/store/queue'
import { utilsStyles } from '@/styles'
import { isSameMediaItem } from '@/utils/mediaItem'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import React, { useCallback, useMemo } from 'react'
import { StyleProp, Text, View, ViewStyle } from 'react-native'
import FastImage from 'react-native-fast-image'
import { Track, useIsPlaying } from 'react-native-track-player'
import { QueueControls } from './QueueControls'
export type TracksListProps = {
	id: string
	tracks: Track[]
	scrollEnabled?: boolean
	hideQueueControls?: boolean
	ListHeaderComponent?: React.ReactNode
	ListHeaderComponentStyle?: StyleProp<ViewStyle>
	isSinger?: boolean
	allowDelete?: boolean
	onDeleteTrack?: (trackId: string) => void
	isMultiSelectMode?: boolean
	selectedTracks?: Set<string>
	onToggleSelection?: (trackId: string) => void
	toggleMultiSelectMode?: () => void
	numsToPlay?: number
}
const ItemDivider = React.memo(() => (
	<View style={{ ...utilsStyles.itemSeparator, marginVertical: 9, marginLeft: 60 }} />
))

const EmptyListComponent = React.memo(() => (
	<View>
		<Text style={utilsStyles.emptyContentText}>No songs found</Text>
		<FastImage
			source={{ uri: unknownTrackImageUri, priority: FastImage.priority.normal }}
			style={utilsStyles.emptyContentImage}
		/>
	</View>
))

const EMPTY_SET = new Set<string>()

export const TracksList = React.memo(
	({
		id,
		tracks,
		scrollEnabled = true,
		hideQueueControls = false,
		ListHeaderComponent,
		ListHeaderComponentStyle,
		isSinger = false,
		allowDelete = false,
		isMultiSelectMode = false,
		onDeleteTrack,
		selectedTracks = EMPTY_SET,
		onToggleSelection,
		toggleMultiSelectMode,
		numsToPlay,
	}: TracksListProps) => {
		const { activeQueueId, setActiveQueueId } = useQueue()
		const currentMusic = myTrackPlayer.useCurrentMusic()
		const { playing } = useIsPlaying()

		const handleTrackSelect = useCallback(
			async (selectedTrack: Track) => {
				const isCurrentTrack = isSameMediaItem(
					selectedTrack as IMusic.IMusicItem,
					currentMusic as IMusic.IMusicItem | null | undefined,
				)
				const isChangingQueue = id !== activeQueueId
				if (isChangingQueue) {
					if (isCurrentTrack) {
						router.navigate('/player')
					} else {
						await myTrackPlayer.playWithReplacePlayList(
							selectedTrack as IMusic.IMusicItem,
							(numsToPlay ? tracks.slice(0, numsToPlay) : tracks) as IMusic.IMusicItem[],
						)
						setActiveQueueId(id)
					}
				} else {
					if (isCurrentTrack) {
						router.navigate('/player')
					} else {
						await myTrackPlayer.playWithReplacePlayList(
							selectedTrack as IMusic.IMusicItem,
							tracks as IMusic.IMusicItem[],
						)
					}
				}
			},
			[id, activeQueueId, tracks, setActiveQueueId, currentMusic, numsToPlay],
		)

		const renderItem = useCallback(
			({ item: track }: { item: Track }) => {
				const isActiveTrack = isSameMediaItem(
					track as IMusic.IMusicItem,
					currentMusic as IMusic.IMusicItem | null | undefined,
				)
				return (
					<TracksListItem
						track={track}
						onTrackSelect={handleTrackSelect}
						isActiveTrack={isActiveTrack}
						isPlaying={isActiveTrack && !!playing}
						isSinger={isSinger}
						allowDelete={allowDelete}
						onDeleteTrack={onDeleteTrack}
						isMultiSelectMode={isMultiSelectMode}
						onToggleSelection={onToggleSelection}
						selectedTracks={selectedTracks}
						toggleMultiSelectMode={toggleMultiSelectMode}
					/>
				)
			},
			[
				handleTrackSelect,
				currentMusic,
				playing,
				isSinger,
				allowDelete,
				onDeleteTrack,
				isMultiSelectMode,
				onToggleSelection,
				selectedTracks,
				toggleMultiSelectMode,
			],
		)

		const queueControlsHeader = useMemo(
			() =>
				!hideQueueControls ? (
					<QueueControls
						tracks={numsToPlay ? tracks.slice(0, numsToPlay) : tracks}
						style={{ paddingBottom: 20 }}
					/>
				) : undefined,
			[hideQueueControls, tracks, numsToPlay],
		)

		const combinedListHeader = useMemo(() => {
			if (!ListHeaderComponent && !queueControlsHeader) {
				return undefined
			}

			return (
				<View style={ListHeaderComponentStyle}>
					{ListHeaderComponent}
					{queueControlsHeader}
				</View>
			)
		}, [ListHeaderComponent, ListHeaderComponentStyle, queueControlsHeader])

		const listExtraData = useMemo(
			() => ({
				currentTrackId: currentMusic?.id ?? null,
				currentTrackPlatform: currentMusic?.platform ?? null,
				playing,
				isMultiSelectMode,
				selectedTrackIds: Array.from(selectedTracks),
			}),
			[currentMusic?.id, currentMusic?.platform, playing, isMultiSelectMode, selectedTracks],
		)

		const keyExtractor = useCallback((item: Track) => item.id, [])

		return (
			<FlashList
				data={tracks}
				extraData={listExtraData}
				scrollEnabled={scrollEnabled}
				contentContainerStyle={{ paddingTop: 10, paddingBottom: 128 }}
				ListHeaderComponent={combinedListHeader}
				ListFooterComponent={ItemDivider}
				ItemSeparatorComponent={ItemDivider}
				ListEmptyComponent={EmptyListComponent}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				estimatedItemSize={68}
			/>
		)
	},
)
