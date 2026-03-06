import Lyric from '@/components/lyric'
import { MovingText } from '@/components/MovingText'
import { PlayerControls } from '@/components/PlayerControls'
import { PlayerProgressBar } from '@/components/PlayerProgressbar'
import { PlayerRepeatToggle } from '@/components/PlayerRepeatToggle'
import { PlayerVolumeBar } from '@/components/PlayerVolumeBar'
import { ShowPlayerListToggle } from '@/components/ShowPlayerListToggle'
import { unknownTrackImageUri } from '@/constants/images'
import { colors, fontSize, screenPadding } from '@/constants/tokens'
import LyricManager from '@/helpers/lyricManager'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { getSingerMidBySingerName } from '@/helpers/userApi/getMusicSource'
import { usePlayerBackground } from '@/hooks/usePlayerBackground'
import { useTrackPlayerFavorite } from '@/hooks/useTrackPlayerFavorite'
import PersistStatus from '@/store/PersistStatus'
import { defaultStyles } from '@/styles'
import i18n from '@/utils/i18n'
import { setTimingClose } from '@/utils/timingClose'
import { Entypo, MaterialCommunityIcons } from '@expo/vector-icons'
import { MenuView } from '@react-native-menu/menu'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
	Alert,
	Dimensions,
	Share,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native'
import FastImage from 'react-native-fast-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useActiveTrack, usePlaybackState } from 'react-native-track-player'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25

const LYRIC_DELAY_STEP = 0.5
const LYRIC_DELAY_MIN = -15
const LYRIC_DELAY_MAX = 15

type ArtistDisplayProps = {
	artists: string
	onViewArtist: (artist: string) => void
}

const ArtistDisplay = React.memo(({ artists, onViewArtist }: ArtistDisplayProps) => {
	const normalizedArtists = artists.trim()
	const artistArray = React.useMemo(
		() => normalizedArtists.split('、').map((artist) => artist.trim()).filter(Boolean),
		[normalizedArtists],
	)

	const artistActions = React.useMemo(
		() =>
			artistArray.map((artist) => ({
				id: artist,
				title: artist,
			})),
		[artistArray],
	)

	const handleArtistAction = useCallback(
		({ nativeEvent }: { nativeEvent: { event: string } }) => {
			onViewArtist(nativeEvent.event)
		},
		[onViewArtist],
	)

	const displayArtist = artistArray[0] ?? normalizedArtists
	if (!displayArtist) {
		return null
	}

	if (artistArray.length <= 1) {
		return (
			<TouchableOpacity
				activeOpacity={0.6}
				onPress={() => onViewArtist(displayArtist)}
				accessibilityRole="button"
				accessibilityHint={`View artist ${displayArtist}`}
			>
				<Text numberOfLines={1} style={[styles.trackArtistText, { marginTop: 6 }]}>
					{displayArtist}
				</Text>
			</TouchableOpacity>
		)
	}

	return (
		<MenuView
			title={i18n.t('player.selectArtist')}
			onPressAction={handleArtistAction}
			actions={artistActions}
		>
			<TouchableOpacity
				activeOpacity={0.6}
				accessibilityRole="button"
				accessibilityHint={`View artist ${normalizedArtists}`}
			>
				<Text numberOfLines={1} style={[styles.trackArtistText, { marginTop: 6 }]}>
					{normalizedArtists}
				</Text>
			</TouchableOpacity>
		</MenuView>
	)
})

const PlayerScreen = () => {
	const { top, bottom } = useSafeAreaInsets()
	const { isFavorite, toggleFavorite } = useTrackPlayerFavorite()
	const [showLyrics, setShowLyrics] = useState(false)
	const [showLyricDelayControls, setShowLyricDelayControls] = useState(false)
	const lyricDelaySeconds = PersistStatus.useValue('lyric.delaySeconds', 0) ?? 0
	const lyricsOpacity = useSharedValue(0)
	const lyricsTranslateY = useSharedValue(50)
	const artworkScale = useSharedValue(1)

	const playbackState = usePlaybackState()
	const isPlaying = playbackState.state === 'playing'

	const lyricsAnimatedStyle = useAnimatedStyle(() => ({
		opacity: lyricsOpacity.value,
		transform: [{ translateY: lyricsTranslateY.value }],
	}))

	const currentActiveTrack = useActiveTrack()
	const prevTrackRef = useRef(currentActiveTrack)

	useEffect(() => {
		if (currentActiveTrack) {
			prevTrackRef.current = currentActiveTrack
		}
	}, [currentActiveTrack])

	const trackToDisplay = currentActiveTrack ?? prevTrackRef.current

	const { imageColors } = usePlayerBackground(trackToDisplay?.artwork ?? unknownTrackImageUri)

	const artworkTranslateX = useSharedValue(0)
	const artworkCrossfade = useSharedValue(1)
	const prevArtworkUri = useRef(unknownTrackImageUri)

	useEffect(() => {
		const newUri = trackToDisplay?.artwork ?? unknownTrackImageUri
		if (newUri !== prevArtworkUri.current) {
			artworkCrossfade.value = 0
			artworkCrossfade.value = withTiming(1, { duration: 420 })
			prevArtworkUri.current = newUri
		}
	}, [trackToDisplay?.artwork])

	const artworkAnimatedStyle = useAnimatedStyle(() => ({
		transform: [
			{ scale: artworkScale.value },
			{ translateX: artworkTranslateX.value },
		] as [{ scale: number }, { translateX: number }],
		opacity: artworkCrossfade.value,
	}))

	const handleSkipNext = useCallback(() => {
		myTrackPlayer.skipToNext()
	}, [])

	const handleSkipPrev = useCallback(() => {
		myTrackPlayer.skipToPrevious()
	}, [])

	const swipeGesture = React.useMemo(() => Gesture.Pan()
		.activeOffsetX([-20, 20])
		.onUpdate((e) => {
			artworkTranslateX.value = e.translationX * 0.5
		})
		.onEnd((e) => {
			if (e.translationX < -SWIPE_THRESHOLD) {
				artworkTranslateX.value = withTiming(-SCREEN_WIDTH * 0.3, { duration: 200 })
				artworkCrossfade.value = withTiming(0, { duration: 200 })
				runOnJS(handleSkipNext)()
			} else if (e.translationX > SWIPE_THRESHOLD) {
				artworkTranslateX.value = withTiming(SCREEN_WIDTH * 0.3, { duration: 200 })
				artworkCrossfade.value = withTiming(0, { duration: 200 })
				runOnJS(handleSkipPrev)()
			}
			artworkTranslateX.value = withSpring(0, { damping: 15, stiffness: 150 })
		}), [handleSkipNext, handleSkipPrev])

	const handleLyricsToggle = useCallback(() => {
		setShowLyrics((prev) => {
			const newShowLyrics = !prev
			if (newShowLyrics) {
				lyricsOpacity.value = withTiming(1, { duration: 300 })
				lyricsTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 })
			} else {
				setShowLyricDelayControls(false)
				lyricsOpacity.value = withTiming(0, { duration: 300 })
				lyricsTranslateY.value = withSpring(50, { damping: 15, stiffness: 100 })
			}
			return newShowLyrics
		})
	}, [lyricsOpacity, lyricsTranslateY])

	useEffect(() => {
		if (isPlaying) {
			artworkScale.value = withSpring(1, {
				damping: 9,
				stiffness: 180,
				mass: 1,
				velocity: 0,
			})
		} else {
			artworkScale.value = withTiming(0.7, {
				duration: 300,
				easing: Easing.linear,
			})
		}
	}, [isPlaying])

	const handleViewArtist = useCallback((artist: string) => {
		if (!artist.includes('未知')) {
			getSingerMidBySingerName(artist).then((singerMid) => {
				if (singerMid) {
					router.navigate(`/(modals)/${singerMid}`)
				}
			})
		}
	}, [])

	
	const handleFavorite = useCallback(() => {
		toggleFavorite()
	}, [toggleFavorite])

	const extractAlbumId = useCallback((artworkUrl: string): string => {
		const regex = /T002R500x500M000(.+)\.jpg/
		const match = artworkUrl.match(regex)
		return match ? match[1] : ''
	}, [])

	const handleShowAlbum = useCallback(() => {
		if (!trackToDisplay?.artwork) return
		const albumId = extractAlbumId(trackToDisplay.artwork)
		router.push(`/(modals)/${albumId}?album=true`)
	}, [trackToDisplay?.artwork, extractAlbumId])

	const handleShowLyrics = handleLyricsToggle

	const handleAddToPlaylist = useCallback(() => {
		const track = trackToDisplay
		if (!track) return
		router.push(
			`/(modals)/addToPlaylist?title=${track.title}&album=${track.album}&artwork=${track.artwork}&artist=${track.artist}&id=${track.id}&url=${track.url}&platform=${track.platform}&duration=${track.duration}`,
		)
	}, [trackToDisplay])

	const handleDownload = useCallback(async () => {
		if (trackToDisplay) {
			myTrackPlayer.cacheAndImportMusic(trackToDisplay as IMusic.IMusicItem)
		}
	}, [trackToDisplay])

	const handleShare = useCallback(async () => {
		try {
			await Share.share({
				title: trackToDisplay?.title,
				message: `歌曲: ${trackToDisplay?.title} by ${trackToDisplay?.artist}`,
				url: trackToDisplay?.url,
			})
		} catch (error) {
			console.error(error.message)
		}
	}, [trackToDisplay])
	const handleTimingClose = useCallback((minutes: number) => {
		setTimingClose(Date.now() + minutes * 60 * 1000)
	}, [])

	const menuActions = React.useMemo(() => {
		const actions = [
			{
				id: 'favorite',
				title: i18n.t('player.like'),
				titleColor: isFavorite ? colors.primary : undefined,
				image: isFavorite ? 'heart.fill' : 'heart',
			},
			{ id: 'album', title: i18n.t('player.showAlbum'), image: 'music.note.list' },
			{ id: 'lyrics', title: i18n.t('player.showLyrics'), image: 'text.quote' },
			{ id: 'playlist', title: i18n.t('player.addToPlaylist'), image: 'plus.circle' },
			{ id: 'share', title: i18n.t('player.share'), image: 'square.and.arrow.up' },
			{
				id: 'timing',
				title: i18n.t('player.closeAfter'),
				image: 'timer',
				subactions: [
					{ id: 'timing_10', title: '10 ' + i18n.t('player.minutes') },
					{ id: 'timing_15', title: '15 ' + i18n.t('player.minutes') },
					{ id: 'timing_20', title: '20 ' + i18n.t('player.minutes') },
					{ id: 'timing_30', title: '30 ' + i18n.t('player.minutes') },
					{ id: 'timing_cus', title: i18n.t('player.custom') },
				],
			},
		]
		if (trackToDisplay?.platform !== 'local') {
			actions.splice(4, 0, {
				id: 'download',
				title: i18n.t('player.download'),
				image: 'arrow.down.circle',
			})
		}
		return actions
	}, [isFavorite, trackToDisplay?.platform])
	useEffect(() => {
		if (showLyrics) {
			activateKeepAwakeAsync()
		} else {
			deactivateKeepAwake()
		}

		return () => {
			deactivateKeepAwake() // 清理函数，确保组件卸载时停用屏幕常亮
		}
	}, [showLyrics])
	const handleLyricsFontSizeDecrease = useCallback(() => {
		const currentFontSize = PersistStatus.get('lyric.detailFontSize') ?? 1
		PersistStatus.set('lyric.detailFontSize', currentFontSize - 1 < 0 ? 0 : currentFontSize - 1)
	}, [])

	const handleLyricsFontSizeIncrease = useCallback(() => {
		const currentFontSize = PersistStatus.get('lyric.detailFontSize') ?? 1
		PersistStatus.set('lyric.detailFontSize', currentFontSize + 1 > 3 ? 3 : currentFontSize + 1)
	}, [])
	function formatLyricDelay(delaySeconds: number): string {
		const normalized = Math.abs(delaySeconds) < 0.05 ? 0 : delaySeconds
		const rounded = Math.round(normalized * 10) / 10
		const prefix = rounded > 0 ? '+' : ''
		return `${prefix}${rounded.toFixed(1)}s`
	}
	function updateLyricDelay(nextDelaySeconds: number): void {
		const normalized = Math.round(nextDelaySeconds * 10) / 10
		const clamped = Math.max(LYRIC_DELAY_MIN, Math.min(LYRIC_DELAY_MAX, normalized))
		PersistStatus.set('lyric.delaySeconds', clamped)
		LyricManager.refreshLyric().catch((err) => {
			console.error('refresh lyric after delay changed failed', err)
		})
	}
	function handleLyricDelayDecrease(): void {
		const currentDelay = PersistStatus.get('lyric.delaySeconds') ?? 0
		updateLyricDelay(currentDelay - LYRIC_DELAY_STEP)
	}
	function handleLyricDelayIncrease(): void {
		const currentDelay = PersistStatus.get('lyric.delaySeconds') ?? 0
		updateLyricDelay(currentDelay + LYRIC_DELAY_STEP)
	}
	function handleLyricDelayReset(): void {
		updateLyricDelay(0)
	}
	function toggleLyricDelayControls(): void {
		setShowLyricDelayControls((prev) => !prev)
	}
	function setCustomTimingClose() {
		Alert.prompt(
			i18n.t('player.setTimingClose'),
			i18n.t('player.inputMinutes'),
			[
				{
					text: i18n.t('player.cancel'),
					style: 'cancel',
				},
				{
					text: i18n.t('player.confirm'),
					onPress: (minutes) => {
						if (minutes && !isNaN(Number(minutes))) {
							const milliseconds = Number(minutes) * 60 * 1000
							setTimingClose(Date.now() + milliseconds)
						} else {
							Alert.alert(i18n.t('player.error.title'), i18n.t('player.error.minutesErrorMessage'))
						}
					},
				},
			],
			'plain-text',
		)
	}

	return (
		<LinearGradient
			style={{ flex: 1 }}
			colors={imageColors ? [imageColors.background, imageColors.primary] : [colors.background]}
		>
			<View style={styles.overlayContainer}>
				<DismissPlayerSymbol />
				{showLyrics ? (
					<View style={{ flex: 1, marginTop: top + 40, marginBottom: bottom }}>
						<Animated.View style={[styles.lyricContainer, lyricsAnimatedStyle]}>
							{/* <Pressable style={styles.artworkTouchable} onPress={handleLyricsToggle}> */}
							<Lyric onTurnPageClick={handleLyricsToggle} />
							{/* </Pressable> */}
						</Animated.View>
						<View style={styles.container}>
							<View style={styles.leftItem}>
								<MaterialCommunityIcons
									name="tooltip-minus-outline"
									size={27}
									color="white"
									onPress={handleLyricsToggle}
									style={{ marginBottom: 4 }}
								/>
							</View>
							<View style={styles.centeredItem}>
								<MaterialCommunityIcons
									name="format-font-size-decrease"
									size={30}
									color="white"
									onPress={handleLyricsFontSizeDecrease}
									style={{ marginBottom: 4 }}
								/>
							</View>
							<View style={styles.centeredItem}>
								<MaterialCommunityIcons
									name="format-font-size-increase"
									size={30}
									color="white"
									onPress={handleLyricsFontSizeIncrease}
									style={{ marginBottom: 4 }}
								/>
							</View>
							<View style={styles.rightItem}>
								<TouchableOpacity
									style={styles.lyricDelayToggleButton}
									onPress={toggleLyricDelayControls}
								>
									<MaterialCommunityIcons
										name="timer-outline"
										size={26}
										color={showLyricDelayControls ? colors.primary : 'white'}
									/>
								</TouchableOpacity>
							</View>
						</View>
						{showLyricDelayControls ? (
							<View style={[styles.container, styles.lyricDelayContainer]}>
								<View style={styles.leftItem}>
									<TouchableOpacity
										style={styles.delayAdjustButton}
										onPress={handleLyricDelayDecrease}
									>
										<Text style={styles.delayAdjustText}>-0.5s</Text>
									</TouchableOpacity>
								</View>
								<View style={styles.centeredItem}>
									<TouchableOpacity style={styles.delayValueButton} onPress={handleLyricDelayReset}>
										<Text style={styles.delayLabel}>{i18n.t('player.lyricDelay')}</Text>
										<Text style={styles.delayValueText}>{formatLyricDelay(lyricDelaySeconds)}</Text>
									</TouchableOpacity>
								</View>
								<View style={styles.rightItem}>
									<TouchableOpacity
										style={styles.delayAdjustButton}
										onPress={handleLyricDelayIncrease}
									>
										<Text style={styles.delayAdjustText}>+0.5s</Text>
									</TouchableOpacity>
								</View>
							</View>
						) : null}
					</View>
				) : (
					<View style={{ flex: 1, marginTop: top + 70, marginBottom: bottom }}>
					<GestureDetector gesture={swipeGesture}>
						<Animated.View style={[styles.artworkImageContainer, artworkAnimatedStyle]}>
							<TouchableOpacity style={styles.artworkTouchable} onPress={handleLyricsToggle}>
								<FastImage
									source={{
										uri: trackToDisplay?.artwork ?? unknownTrackImageUri,
										priority: FastImage.priority.high,
									}}
									resizeMode="cover"
									style={styles.artworkImage}
								/>
							</TouchableOpacity>
						</Animated.View>
					</GestureDetector>
						<View style={{ flex: 1 }}>
							<View style={{ marginTop: 'auto' }}>
								<View style={{ height: 60 }}>
									<View
										style={{
											flexDirection: 'row',
											justifyContent: 'space-between',
											alignItems: 'center',
										}}
									>
										{/* Track title */}
										<View style={styles.trackTitleContainer}>
											<MovingText
												text={trackToDisplay?.title ?? ''}
												animationThreshold={30}
												style={styles.trackTitleText}
											/>
										</View>

										{/* Favorite button icon */}
										<MenuView
											title={i18n.t('player.songOptions')}
											onPressAction={({ nativeEvent }) => {
												switch (nativeEvent.event) {
													case 'favorite':
														handleFavorite()
														break
													case 'album':
														handleShowAlbum()
														break
													case 'lyrics':
														handleShowLyrics()
														break
													case 'playlist':
														handleAddToPlaylist()
														break
													case 'download':
														handleDownload()
														break
													case 'share':
														handleShare()
														break
													case 'timing_10':
														handleTimingClose(10)
														break
													case 'timing_15':
														handleTimingClose(15)
														break
													case 'timing_20':
														handleTimingClose(20)
														break
													case 'timing_30':
														handleTimingClose(30)
														break
													case 'timing_cus':
														setCustomTimingClose()
														break
												}
											}}
											actions={menuActions}
										>
											<TouchableOpacity style={styles.menuButton}>
												<Entypo name="dots-three-horizontal" size={18} color={colors.icon} />
											</TouchableOpacity>
										</MenuView>
									</View>

									{/* Track artist */}
								{trackToDisplay?.artist ? (
									<ArtistDisplay artists={trackToDisplay.artist} onViewArtist={handleViewArtist} />
								) : null}
								</View>

								<PlayerProgressBar style={{ marginTop: 32 }} />

								<PlayerControls style={{ marginTop: 40 }} />
							</View>

							<PlayerVolumeBar style={{ marginTop: 'auto', marginBottom: 30 }} />

							<View style={styles.container}>
								<View style={styles.leftItem}>
									<MaterialCommunityIcons
										name="tooltip-minus-outline"
										size={27}
										color="white"
										onPress={handleLyricsToggle}
										style={{ marginBottom: 2 }}
									/>
								</View>
								<View style={styles.centeredItem}>
									<PlayerRepeatToggle size={30} style={{ marginBottom: 6 }} />
								</View>
								<View style={styles.rightItem}>
									<ShowPlayerListToggle size={30} style={{ marginBottom: 6 }} />
								</View>
							</View>
						</View>
					</View>
				)}

			
			</View>
		</LinearGradient>
	)
}

const DismissPlayerSymbol = React.memo(() => {
	const { top } = useSafeAreaInsets()

	return (
		<View
			style={{
				position: 'absolute',
				top: top + 8,
				left: 0,
				right: 0,
				flexDirection: 'row',
				justifyContent: 'center',
			}}
		>
			<View
				style={{
					width: 50,
					height: 8,
					borderRadius: 8,
					backgroundColor: '#fff',
					opacity: 0.7,
				}}
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	menuButton: {
		width: 32, // 增加按钮宽度
		height: 32, // 增加按钮高度
		borderRadius: 16, // 保持圆形（宽度/高度的一半）
		backgroundColor: 'rgba(128, 128, 128, 0.3)', // 半透明的灰色
		justifyContent: 'center',
		alignItems: 'center',
	},
	overlayContainer: {
		...defaultStyles.container,
		paddingHorizontal: screenPadding.horizontal,
		backgroundColor: 'rgba(0,0,0,0.5)',
	},
	artworkImageContainer: {
		aspectRatio: 1, // 保持正方形比例
		width: '100%',
		maxHeight: '50%', // 限制最大高度
		alignSelf: 'center',
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: 'grey',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 8,
		},
		shadowOpacity: 0.44,
		shadowRadius: 11.0,
		elevation: 16,
	},
	artworkTouchable: {
		width: '100%',
		height: '100%',
	},
	artworkImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
		borderRadius: 12,
		backgroundColor: 'transparent',
	},
	trackTitleContainer: {
		flex: 1,
		overflow: 'hidden',
	},
	trackTitleText: {
		...defaultStyles.text,
		fontSize: 22,
		fontWeight: '700',
	},
	trackArtistText: {
		...defaultStyles.text,
		fontSize: fontSize.base,
		opacity: 0.8,
		maxWidth: '90%',
	},
	lyricText: {
		...defaultStyles.text,
		textAlign: 'center',
	},
	lyric: {},
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
	},
	leftItem: {
		flex: 1,
		alignItems: 'flex-start',
	},
	centeredItem: {
		flex: 1,
		alignItems: 'center',
	},
	rightItem: {
		flex: 1,
		alignItems: 'flex-end',
	},
	lyricDelayContainer: {
		marginTop: 10,
	},
	lyricDelayToggleButton: {
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
	},
	delayAdjustButton: {
		backgroundColor: 'rgba(255,255,255,0.12)',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
	},
	delayAdjustText: {
		...defaultStyles.text,
		fontSize: 14,
		fontWeight: '600',
	},
	delayValueButton: {
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255,255,255,0.12)',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		minWidth: 130,
	},
	delayLabel: {
		...defaultStyles.text,
		fontSize: 11,
		opacity: 0.8,
	},
	delayValueText: {
		...defaultStyles.text,
		fontSize: 15,
		fontWeight: '700',
	},
	lyricContainer: {
		flex: 1,
	},
})

export default PlayerScreen
