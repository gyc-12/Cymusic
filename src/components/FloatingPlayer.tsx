import { PlayPauseButton, SkipToNextButton } from '@/components/PlayerControls'
import { unknownTrackImageUri } from '@/constants/images'
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack'
import { defaultStyles } from '@/styles'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef } from 'react'
import { StyleSheet, TouchableOpacity, View, ViewProps } from 'react-native'
import FastImage from 'react-native-fast-image'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useActiveTrack, useProgress } from 'react-native-track-player'
import { MovingText } from './MovingText'

const AnimatedFastImage = Animated.createAnimatedComponent(FastImage)

const ProgressIndicator = React.memo(() => {
	const { position, duration } = useProgress(1000)
	const progress = duration > 0 ? position / duration : 0
	return (
		<View style={styles.progressBarContainer}>
			<View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
		</View>
	)
})

export const FloatingPlayer = React.memo(({ style }: ViewProps) => {
	const router = useRouter()
	const activeTrack = useActiveTrack()
	const lastActiveTrack = useLastActiveTrack()
	const displayedTrack = activeTrack ?? lastActiveTrack

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
			<BlurView intensity={80} tint="dark" style={styles.blurContainer}>
				<AnimatedFastImage
					source={{
						uri: displayedTrack.artwork ?? unknownTrackImageUri,
					}}
					style={[styles.trackArtworkImage, artworkAnimatedStyle]}
				/>

				<View style={styles.trackTitleContainer}>
					<MovingText
						style={styles.trackTitle}
						text={displayedTrack.title ?? ''}
						animationThreshold={20}
					/>
				</View>

				<View style={styles.trackControlsContainer}>
					<PlayPauseButton iconSize={24} />
					<SkipToNextButton iconSize={22} />
				</View>

				<ProgressIndicator />
			</BlurView>
		</TouchableOpacity>
	)
})

const styles = StyleSheet.create({
	container: {
		borderRadius: 12,
		overflow: 'hidden',
	},
	blurContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 8,
		paddingVertical: 10,
	},
	trackArtworkImage: {
		width: 40,
		height: 40,
		borderRadius: 8,
	},
	trackTitleContainer: {
		flex: 1,
		overflow: 'hidden',
		marginLeft: 10,
	},
	trackTitle: {
		...defaultStyles.text,
		fontSize: 18,
		fontWeight: '600',
		paddingLeft: 10,
	},
	trackControlsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		columnGap: 20,
		marginRight: 16,
		paddingLeft: 16,
	},
	progressBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 8,
		right: 8,
		height: 2,
		backgroundColor: 'rgba(255,255,255,0.1)',
		borderRadius: 1,
	},
	progressBar: {
		height: '100%',
		backgroundColor: 'rgba(255,255,255,0.6)',
		borderRadius: 1,
	},
})
