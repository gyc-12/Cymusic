import { fontSize } from '@/constants/tokens'
import { generateTracksListId } from '@/helpers/miscellaneous'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useDefaultStyles } from '@/styles'
import { FontAwesome } from '@expo/vector-icons'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { Track } from 'react-native-track-player'
import { QueueControls } from './QueueControls'
import { TracksList } from './TracksList'

export const SingerTracksList = ({ playlist, tracks }: { playlist: any; tracks: Track[] }) => {
	const colors = useThemeColors()
	const defaultStyles = useDefaultStyles()
	const styles = useMemo(() => createStyles(defaultStyles), [defaultStyles])
	const [isFavorite, setIsFavorite] = useState(false)

	const singerPlayList = useMemo(
		() => ({
			success: true,
			id: playlist.id,
			platform: 'QQ',
			artist: playlist.title,
			name: playlist.title,
			artwork: playlist.singerImg,
			title: playlist.title,
			songs: tracks as IMusic.IMusicItem[],
		}),
		[playlist, tracks],
	)

	const toggleFavorite = useCallback(async () => {
		try {
			if (isFavorite) {
				await myTrackPlayer.deletePlayLists(playlist.id)
				setIsFavorite(false)
			} else {
				await myTrackPlayer.addPlayLists(singerPlayList)
				setIsFavorite(true)
			}
		} catch (error) {
			console.error('Error toggling favorite:', error)
			// Consider showing an error message to the user
		}
	}, [isFavorite, playlist.id, singerPlayList])

	useEffect(() => {
		const checkFavoriteStatus = async () => {
			const result = await myTrackPlayer.getPlayListById(playlist.id)
			setIsFavorite(result.length > 0)
		}

		checkFavoriteStatus()
	}, [playlist.id])

	return (
		<TracksList
			id={generateTracksListId(playlist.title)}
			scrollEnabled={false}
			hideQueueControls={true}
			ListHeaderComponentStyle={styles.playlistHeaderContainer}
			ListHeaderComponent={
				<View>
					<View style={styles.artworkImageContainer}>
						<FastImage
							source={{
								uri: playlist.singerImg,
								priority: FastImage.priority.high,
							}}
							style={styles.artworkImage}
						/>
					</View>
					<View style={styles.textContainer}>
						<Text numberOfLines={1} style={styles.playlistNameText}>
							{playlist.title}
						</Text>
						<FontAwesome
							name={isFavorite ? 'heart' : 'heart-o'}
							size={20}
							style={[styles.favoriteIcon, { color: isFavorite ? colors.primary : colors.icon }]}
							onPress={toggleFavorite}
						/>
					</View>
					<QueueControls style={{ paddingTop: 24 }} tracks={tracks} />
				</View>
			}
			tracks={tracks}
			isSinger={true}
		/>
	)
}

const createStyles = (defaultStyles: ReturnType<typeof useDefaultStyles>) =>
	StyleSheet.create({
	playlistHeaderContainer: {
		flex: 1,
		marginBottom: 32,
	},
	artworkImageContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		height: 300,
	},
	artworkImage: {
		width: '85%',
		height: '100%',
		resizeMode: 'cover',
		borderRadius: 12,
	},
	textContainer: {
		width: '85%', // 与图片宽度相同
		alignSelf: 'center', // 居中对齐
		marginTop: 22,
		position: 'relative', // 添加这行
	},
	playlistNameText: {
		...defaultStyles.text,
		fontSize: fontSize.lg,
		fontWeight: '800',
		textAlign: 'center', // 确保文本居中
	},
	favoriteIcon: {
		...defaultStyles.text,
		fontSize: fontSize.lg,
		fontWeight: '800',
		position: 'absolute', // 绝对定位
		right: 0, // 靠右对齐
		top: '40%', // 垂直居中
		transform: [{ translateY: -10 }], // 微调垂直位置（图标大小的一半）
	},
	})
