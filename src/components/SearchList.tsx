import { unknownTrackImageUri } from '@/constants/images'
import { colors, screenPadding } from '@/constants/tokens'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { defaultStyles, utilsStyles } from '@/styles'
import i18n from '@/utils/i18n'

import { getSingerMidBySingerName } from '@/helpers/userApi/getMusicSource'
import { router } from 'expo-router'
import React, { memo, useCallback } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Track } from 'react-native-track-player'
import TracksListItem from './TracksListItem'

export type SearchListProps = {
	id: string
	tracks: Track[]
	hideQueueControls?: boolean
	onLoadMore: () => void
	hasMore: boolean
	isLoading: boolean
}

const ItemDivider = memo(() => (
	<View style={{ ...utilsStyles.itemSeparator, marginVertical: 9, marginLeft: 60 }} />
))

const EmptyComponent = memo(() => (
	<View style={{}}>
		<FastImage
			source={{ uri: unknownTrackImageUri, priority: FastImage.priority.normal }}
			style={utilsStyles.emptyContentImage}
		/>
	</View>
))

const FooterComponent = memo(({ isLoading, hasMore }: { isLoading: boolean; hasMore: boolean }) => {
	if (isLoading) {
		return (
			<View style={{ paddingVertical: 20 }}>
				<ActivityIndicator size="large" />
			</View>
		)
	}
	if (!hasMore) {
		return (
			<View style={{ paddingVertical: 20 }}>
				<Text style={utilsStyles.emptyContentText}>{i18n.t('find.noMoreResults')}</Text>
			</View>
		)
	}
	return null
})

const styles = StyleSheet.create({
	artistItem: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	artistAvatar: {
		width: 50,
		height: 50,
		borderRadius: 5,
		marginRight: 13,
	},
	artistName: {
		fontSize: 16,
		color: colors.text,
	},
})

export const SearchList: React.FC<SearchListProps> = ({
	tracks,
	onLoadMore,
	hasMore,
	isLoading,
}) => {
	const handleTrackSelect = useCallback(async (selectedTrack: Track) => {
		if (selectedTrack.isArtist) {
			// TODO: Navigate to artist page
			console.log('Navigate to artist:', selectedTrack)
			if (!selectedTrack.artist.includes('未知')) {
				getSingerMidBySingerName(selectedTrack.artist).then((singerMid) => {
					if (singerMid) {
						router.navigate(`/(modals)/${singerMid}`)
					} else {
						console.log('没有匹配到歌手')
					}
				})
			}
			return
		}
		await myTrackPlayer.play(selectedTrack as IMusic.IMusicItem)
	}, [])

	const renderItem = useCallback(
		({ item: track }: { item: Track }) => {
			if (track.isArtist) {
				return (
					<TouchableOpacity style={styles.artistItem} onPress={() => handleTrackSelect(track)}>
						<FastImage
							source={{ uri: track.artwork || unknownTrackImageUri }}
							style={styles.artistAvatar}
						/>
						<Text style={styles.artistName}>{track.title}</Text>
					</TouchableOpacity>
				)
			}
			return <TracksListItem track={track} onTrackSelect={handleTrackSelect} />
		},
		[handleTrackSelect],
	)

	// 修改这里的 keyExtractor 函数
	const keyExtractor = useCallback((item: Track, index: number) => `${item.id}-${index}`, [])

	const handleEndReached = useCallback(() => {
		if (hasMore && !isLoading && tracks.length >= 20) {
			onLoadMore()
		}
	}, [hasMore, isLoading, tracks.length, onLoadMore])
	const insets = useSafeAreaInsets()

	return (
		<View style={[defaultStyles.container]}>
			<FlatList
				data={tracks}
				contentContainerStyle={{
					paddingTop: 60, // 增加 iOS 上的顶部 padding
					paddingBottom: 128 + insets.bottom,
					flexGrow: 1, // 这将允许内容在少于一屏时也能填满整个屏幕
					justifyContent: tracks.length === 0 ? 'center' : 'flex-start', // 当没有结果时，居中显示 EmptyComponent
					paddingHorizontal: screenPadding.horizontal,
				}}
				ItemSeparatorComponent={ItemDivider}
				ListEmptyComponent={!isLoading ? EmptyComponent : null}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.1}
				ListFooterComponent={<FooterComponent isLoading={isLoading} hasMore={hasMore} />}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				updateCellsBatchingPeriod={50}
				initialNumToRender={10}
				windowSize={21}
			/>
		</View>
	)
}

export default memo(SearchList)
