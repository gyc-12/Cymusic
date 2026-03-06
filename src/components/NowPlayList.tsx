import { unknownTrackImageUri } from '@/constants/images'
import { colors } from '@/constants/tokens'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { utilsStyles } from '@/styles'
import { FlashList } from '@shopify/flash-list'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Track, useActiveTrack, useIsPlaying } from 'react-native-track-player'
import TracksListItem from './TracksListItem'

export type TracksListProps = {
	id: string
	tracks: Track[]
	hideQueueControls?: boolean
}

const ITEM_HEIGHT = 68

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
	({ id, tracks, hideQueueControls = false }: TracksListProps) => {
		const listRef = useRef<FlashList<Track>>(null)
		const activeTrack = useActiveTrack()
		const { playing } = useIsPlaying()
		const activeTrackId = activeTrack?.id
		const { top } = useSafeAreaInsets()

		const initialIndex = useMemo(
			() => (activeTrackId ? tracks.findIndex((track) => track.id === activeTrackId) : -1),
			[activeTrackId, tracks],
		)

		const handleTrackSelect = useCallback(async (selectedTrack: Track) => {
			await myTrackPlayer.play(selectedTrack as IMusic.IMusicItem)
		}, [])

		const renderItem = useCallback(
			({ item: track }: { item: Track }) => (
				<TracksListItem
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
			if (initialIndex > 0) {
				setTimeout(() => {
					listRef.current?.scrollToIndex({
						index: initialIndex,
						animated: false,
						viewPosition: 0.5,
					})
				}, 100)
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
				<FlashList
					data={tracks}
					contentContainerStyle={styles.contentContainer}
					ListFooterComponent={ItemDivider}
					ItemSeparatorComponent={ItemDivider}
					ref={listRef}
					ListEmptyComponent={EmptyListComponent}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					estimatedItemSize={ITEM_HEIGHT}
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
