import { colors, fontSize } from '@/constants/tokens'
import { formatSecondsToMinutes } from '@/helpers/miscellaneous'
import { defaultStyles, utilsStyles } from '@/styles'
import React, { useCallback, useEffect } from 'react'
import { StyleSheet, Text, View, ViewProps } from 'react-native'
import { Slider } from 'react-native-awesome-slider'
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import TrackPlayer, { useProgress } from 'react-native-track-player'

const AnimatedThumb = React.memo(({ isSliding }: { isSliding: SharedValue<boolean> }) => {
	const animatedStyle = useAnimatedStyle(() => {
		return {
			width: withSpring(isSliding.value ? 24 : 12),
			height: withSpring(isSliding.value ? 24 : 12),
			borderRadius: withSpring(isSliding.value ? 12 : 6),
			backgroundColor: '#fff',
			left: 2,
		}
	})

	return <Animated.View style={animatedStyle} />
})

export const PlayerProgressBar = React.memo(({
	style,
	onSeek,
}: ViewProps & { onSeek?: (position: number) => void }) => {
	const { position, duration } = useProgress(250)
	const isSliding = useSharedValue(false)
	const progress = useSharedValue(0)
	const min = useSharedValue(0)
	const max = useSharedValue(1)

	const trackElapsedTime = formatSecondsToMinutes(position)
	const trackRemainingTime = formatSecondsToMinutes(Math.max(0, duration - position))

	useEffect(() => {
		if (!isSliding.value) {
			progress.value = duration > 0 ? position / duration : 0
		}
	}, [position, duration])

	const handleSlidingStart = useCallback(() => {
		isSliding.value = true
	}, [])

	const handleSlidingComplete = useCallback(async (value: number) => {
		if (!isSliding.value) return
		isSliding.value = false
		const newPosition = value * duration
		progress.value = value
		await TrackPlayer.seekTo(newPosition)
		if (onSeek) {
			onSeek(newPosition)
		}
	}, [duration, onSeek])

	const handleValueChange = useCallback((value: number) => {
		progress.value = value
	}, [progress])

	const renderThumb = useCallback(() => <AnimatedThumb isSliding={isSliding} />, [isSliding])
	const renderBubble = useCallback(() => null, [])

	return (
		<View style={style}>
			<Slider
				progress={progress}
				minimumValue={min}
				maximumValue={max}
				containerStyle={utilsStyles.slider}
				renderThumb={renderThumb}
				renderBubble={renderBubble}
				theme={{
					minimumTrackTintColor: colors.minimumTrackTintColor,
					maximumTrackTintColor: colors.maximumTrackTintColor,
				}}
				onSlidingStart={handleSlidingStart}
				onValueChange={handleValueChange}
				onSlidingComplete={handleSlidingComplete}
			/>

			<View style={styles.timeRow}>
				<Text style={styles.timeText}>{trackElapsedTime}</Text>

				<Text style={styles.timeText}>
					{'-'} {trackRemainingTime}
				</Text>
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	timeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'baseline',
		marginTop: 20,
	},
	timeText: {
		...defaultStyles.text,
		color: colors.text,
		opacity: 0.75,
		fontSize: fontSize.xs,
		letterSpacing: 0.7,
		fontWeight: '500',
	},
})
