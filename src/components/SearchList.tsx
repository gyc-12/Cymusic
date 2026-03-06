import { unknownTrackImageUri } from '@/constants/images'
import { colors, screenPadding } from '@/constants/tokens'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { defaultStyles, utilsStyles } from '@/styles'
import i18n from '@/utils/i18n'

import { getSingerMidBySingerName } from '@/helpers/userApi/getMusicSource'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import React, { memo, useCallback, useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Track, useActiveTrack, useIsPlaying } from 'react-native-track-player'
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
	<View>
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
	const activeTrack = useActiveTrack()
	const { playing } = useIsPlaying()
	const activeTrackId = activeTrack?.id

	const handleTrackSelect = useCallback(async (selectedTrack: Track) => {
		if (selectedTrack.isArtist) {
			if (!selectedTrack.artist.includes('未知')) {
				getSingerMidBySingerName(selectedTrack.artist).then((singerMid) => {
					if (singerMid) {
						router.navigate(`/(modals)/${singerMid}`)
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
			return (
				<TracksListItem
					track={track}
					onTrackSelect={handleTrackSelect}
					isActiveTrack={track.id === activeTrackId}
					isPlaying={track.id === activeTrackId && !!playing}
				/>
			)
		},
		[handleTrackSelect, activeTrackId, playing],
	)

	const keyExtractor = useCallback((item: Track, index: number) => `${item.id}-${index}`, [])

	const handleEndReached = useCallback(() => {
		if (hasMore && !isLoading && tracks.length >= 20) {
			onLoadMore()
		}
	}, [hasMore, isLoading, tracks.length, onLoadMore])
	const insets = useSafeAreaInsets()

	const footerComponent = useMemo(
		() => <FooterComponent isLoading={isLoading} hasMore={hasMore} />,
		[isLoading, hasMore],
	)

	return (
		<View style={[defaultStyles.container]}>
			<FlashList
				data={tracks}
				contentContainerStyle={{
					paddingTop: 60,
					paddingBottom: 128 + insets.bottom,
					paddingHorizontal: screenPadding.horizontal,
				}}
				ItemSeparatorComponent={ItemDivider}
				ListEmptyComponent={!isLoading ? EmptyComponent : null}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.1}
				ListFooterComponent={footerComponent}
				estimatedItemSize={68}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
			/>
		</View>
	)
}

export default memo(SearchList)
