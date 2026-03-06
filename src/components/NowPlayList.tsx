import { unknownTrackImageUri } from '@/constants/images'
import { colors } from '@/constants/tokens'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { utilsStyles } from '@/styles'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { FlatList, FlatListProps, StyleSheet, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Track, useActiveTrack, useIsPlaying } from 'react-native-track-player'
import TracksListItem from './TracksListItem'

export type TracksListProps = Partial<FlatListProps<Track>> & {
	id: string
	tracks: Track[]
	hideQueueControls?: boolean
}

const ITEM_HEIGHT = 60

const MemoizedTracksListItem = React.memo(TracksListItem)

const ItemDivider = React.memo(() => <View style={styles.itemDivider} />)

const EmptyListComponent = React.memo(() => (
	<View>
		<Text style={utilsStyles.emptyContentText}>No songs</Text>
		<FastImage
			source={{ uri: unknownTrackImageUri, priority: FastImage.priority.normal }}
			style={utilsStyles.emptyContentImage}
		/>
	</View>
))

export const NowPlayList = React.memo(
	({ id, tracks, hideQueueControls = false, ...flatlistProps }: TracksListProps) => {
		const flatListRef = useRef<FlatList<Track>>(null)
		const activeTrack = useActiveTrack()
		const { playing } = useIsPlaying()
		const activeTrackId = activeTrack?.id
		const { top } = useSafeAreaInsets()

		const initialIndex = useMemo(
			() => (activeTrackId ? tracks.findIndex((track) => track.id === activeTrackId) : -1),
			[activeTrackId, tracks],
		)

		const getItemLayout = useCallback(
			(_: any, index: number) => ({
				length: ITEM_HEIGHT,
				offset: ITEM_HEIGHT * index,
				index,
			}),
			[],
		)

		const handleTrackSelect = useCallback(async (selectedTrack: Track) => {
			await myTrackPlayer.play(selectedTrack as IMusic.IMusicItem)
		}, [])

		const handleScrollToIndexFailed = useCallback((info: { index: number }) => {
			setTimeout(() => {
				flatListRef.current?.scrollToIndex({
					index: info.index,
					animated: false,
					viewPosition: 0,
				})
			}, 100)
		}, [])

		const renderItem = useCallback(
			({ item: track }: { item: Track }) => (
				<MemoizedTracksListItem
					track={track}
					onTrackSelect={handleTrackSelect}
					isActiveTrack={track.id === activeTrackId}
					isPlaying={track.id === activeTrackId && !!playing}
				/>
			),
			[handleTrackSelect, activeTrackId, playing],
		)

		const keyExtractor = useCallback((item: Track) => item.id, [])

		useEffect(() => {
			if (initialIndex !== -1) {
				flatListRef.current?.scrollToIndex({
					index: initialIndex,
					animated: false,
					viewPosition: 0.5,
				})
			}
		}, [initialIndex])

		const DismissPlayerSymbol = useMemo(
			() => (
				<View style={[styles.dismissPlayerSymbol, { top: top - 38 }]}>
					<View style={styles.dismissPlayerBar} />
					<Text style={styles.header}>播放列表</Text>
				</View>
			),
			[top],
		)

		return (
			<>
				{DismissPlayerSymbol}
				<FlatList
					data={tracks}
					contentContainerStyle={styles.contentContainer}
					ListFooterComponent={ItemDivider}
					ItemSeparatorComponent={ItemDivider}
					ref={flatListRef}
					getItemLayout={getItemLayout}
					ListEmptyComponent={EmptyListComponent}
					onScrollToIndexFailed={handleScrollToIndexFailed}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					initialNumToRender={10}
					maxToRenderPerBatch={5}
					windowSize={11}
					removeClippedSubviews={true}
					updateCellsBatchingPeriod={50}
					maintainVisibleContentPosition={{
						minIndexForVisible: 0,
						autoscrollToTopThreshold: 10,
					}}
					{...flatlistProps}
				/>
			</>
		)
	},
)

const styles = StyleSheet.create({
	contentContainer: {
		paddingTop: 60,
		paddingBottom: 128,
	},
	itemDivider: {
		...utilsStyles.itemSeparator,
		marginVertical: 9,
		marginLeft: 60,
	},
	dismissPlayerSymbol: {
		position: 'absolute',
		left: 0,
		right: 0,
		zIndex: 1000,
		paddingTop: 10,
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
	},
	dismissPlayerBar: {
		width: 50,
		height: 4,
		borderRadius: 2,
		backgroundColor: colors.text,
		opacity: 0.3,
		alignSelf: 'center',
		marginBottom: 10,
	},
	header: {
		fontSize: 28,
		fontWeight: 'bold',
		paddingBottom: 10,
		paddingLeft: 20,
		color: colors.text,
	},
})
