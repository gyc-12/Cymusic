import { unknownTrackImageUri } from '@/constants/images'
import { ThemeColors } from '@/constants/tokens'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useUtilsStyles } from '@/styles'
import { isSameMediaItem } from '@/utils/mediaItem'
import { FlashList } from '@shopify/flash-list'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Track, useIsPlaying } from 'react-native-track-player'
import TracksListItem from './TracksListItem'

export type TracksListProps = {
	id: string
	tracks: Track[]
	hideQueueControls?: boolean
}

const ITEM_HEIGHT = 68

const ItemDivider = React.memo(() => {
	const colors = useThemeColors()
	const utilsStyles = useUtilsStyles()
	const styles = useMemo(() => createStyles(colors, utilsStyles), [colors, utilsStyles])

	return <View style={styles.itemDivider} />
})

const EmptyListComponent = React.memo(() => {
	const utilsStyles = useUtilsStyles()

	return (
		<View>
			<Text style={utilsStyles.emptyContentText}>No songs</Text>
			<FastImage
				source={{ uri: unknownTrackImageUri, priority: FastImage.priority.normal }}
				style={utilsStyles.emptyContentImage}
			/>
		</View>
	)
})

export const NowPlayList = React.memo(
	({ tracks }: TracksListProps) => {
		const colors = useThemeColors()
		const utilsStyles = useUtilsStyles()
		const styles = useMemo(() => createStyles(colors, utilsStyles), [colors, utilsStyles])
		const listRef = useRef<FlashList<Track>>(null)
		const currentMusic = myTrackPlayer.useCurrentMusic()
		const { playing } = useIsPlaying()
		const { top } = useSafeAreaInsets()

		const initialIndex = useMemo(
			() =>
				currentMusic
					? tracks.findIndex((track) =>
							isSameMediaItem(
								track as IMusic.IMusicItem,
								currentMusic as IMusic.IMusicItem | null | undefined,
							),
						)
					: -1,
			[currentMusic, tracks],
		)

		const handleTrackSelect = useCallback(async (selectedTrack: Track) => {
			await myTrackPlayer.play(selectedTrack as IMusic.IMusicItem)
		}, [])

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
					/>
				)
			},
			[handleTrackSelect, currentMusic, playing],
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
			[top, styles.dismissPlayerBar, styles.dismissPlayerSymbol, styles.header],
		)

		const listExtraData = useMemo(
			() => ({
				currentTrackId: currentMusic?.id ?? null,
				currentTrackPlatform: currentMusic?.platform ?? null,
				playing,
			}),
			[currentMusic?.id, currentMusic?.platform, playing],
		)

		return (
			<>
				{DismissPlayerSymbol}
				<FlashList
					data={tracks}
					extraData={listExtraData}
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

const createStyles = (
	colors: ThemeColors,
	utilsStyles: ReturnType<typeof useUtilsStyles>,
) =>
	StyleSheet.create({
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
		backgroundColor: colors.overlayStrong,
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
