import { PlayPauseButton, SkipToNextButton } from '@/components/PlayerControls'
import myTrackPlayer, { trackSourceLoadingStore } from '@/helpers/trackPlayerIndex'
import { unknownTrackImageUri } from '@/constants/images'
import { ThemeColors } from '@/constants/tokens'
import { useAppTheme, useThemeColors } from '@/hooks/useAppTheme'
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack'
import { useDefaultStyles } from '@/styles'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, ViewProps } from 'react-native'
import { Image } from 'expo-image'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useActiveTrack, useProgress } from 'react-native-track-player'
import { MovingText } from './MovingText'

const ProgressIndicator = React.memo(() => {
	const colors = useThemeColors()
	const styles = useMemo(() => createStyles(colors), [colors])
	const { position, duration } = useProgress(1000)
	const progress = duration > 0 ? position / duration : 0
	return (
		<View style={styles.progressBarContainer}>
			<View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
		</View>
	)
})

export const FloatingPlayer = React.memo(({ style }: ViewProps) => {
	const { blurTint } = useAppTheme()
	const colors = useThemeColors()
	const defaultStyles = useDefaultStyles()
	const styles = useMemo(() => createStyles(colors, defaultStyles), [colors, defaultStyles])
	const router = useRouter()
	const currentMusic = myTrackPlayer.useCurrentMusic()
	const activeTrack = useActiveTrack()
	const lastActiveTrack = useLastActiveTrack()
	const isTrackSourceLoading = trackSourceLoadingStore.useValue() !== null
	const displayedTrack = currentMusic ?? activeTrack ?? lastActiveTrack

	const artworkOpacity = useSharedValue(1)
	const prevArtworkRef = useRef(displayedTrack?.artwork)

	useEffect(() => {
		if (displayedTrack?.artwork && displayedTrack.artwork !== prevArtworkRef.current) {
			artworkOpacity.value = 0
			artworkOpacity.value = withTiming(1, { duration: 400 })
			prevArtworkRef.current = displayedTrack.artwork
		}
	}, [displayedTrack?.artwork])

	const artworkAnimatedStyle = useAnimatedStyle(() => ({
		opacity: artworkOpacity.value,
	}))

	const handlePress = useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		router.navigate('/player')
	}, [router])

	if (!displayedTrack) return null

	return (
		<TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={[styles.container, style]}>
			<BlurView intensity={80} tint={blurTint} style={styles.blurContainer}>
				<Animated.View style={[styles.trackArtworkContainer, artworkAnimatedStyle]}>
					<Image
						contentFit="cover"
						cachePolicy="memory-disk"
						recyclingKey={displayedTrack.artwork ?? unknownTrackImageUri ?? 'missing-artwork'}
						source={{
							uri: displayedTrack.artwork ?? unknownTrackImageUri,
						}}
						style={StyleSheet.absoluteFill}
					/>
				</Animated.View>

				<View style={styles.trackTitleContainer}>
					<MovingText
						style={styles.trackTitle}
						text={displayedTrack.title ?? ''}
						animationThreshold={20}
					/>
				</View>

				<View style={styles.trackControlsContainer}>
					{isTrackSourceLoading ? (
						<View style={styles.loadingIndicatorContainer}>
							<ActivityIndicator size="small" color={colors.text} />
						</View>
					) : (
						<PlayPauseButton iconSize={24} />
					)}
					<SkipToNextButton iconSize={22} disabled={isTrackSourceLoading} />
				</View>

				{!isTrackSourceLoading && <ProgressIndicator />}
			</BlurView>
		</TouchableOpacity>
	)
})

const createStyles = (
	colors: ThemeColors,
	defaultStyles?: ReturnType<typeof useDefaultStyles>,
) =>
	StyleSheet.create({
	container: {
		borderRadius: 14,
		borderCurve: 'continuous',
		borderColor: colors.border,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
	},
	blurContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
		paddingVertical: 10,
	},
	trackArtworkContainer: {
		width: 40,
		height: 40,
		borderRadius: 8,
		overflow: 'hidden',
	},
	trackTitleContainer: {
		flex: 1,
		overflow: 'hidden',
		marginLeft: 12,
	},
	trackTitle: {
		...(defaultStyles?.text ?? {}),
		fontSize: 17,
		fontWeight: '500',
	},
	trackControlsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		columnGap: 18,
		marginRight: 8,
		paddingLeft: 12,
	},
	loadingIndicatorContainer: {
		minWidth: 24,
		minHeight: 24,
		alignItems: 'center',
		justifyContent: 'center',
	},
	progressBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 8,
		right: 8,
		height: 2,
		backgroundColor: colors.overlaySoft,
		borderRadius: 1,
	},
	progressBar: {
		height: '100%',
		backgroundColor: colors.minimumTrackTintColor,
		borderRadius: 1,
	},
	})
