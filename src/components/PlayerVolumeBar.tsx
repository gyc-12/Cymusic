import { logWarn } from '@/helpers/logger'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useUtilsStyles } from '@/styles'
import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useEffect } from 'react'
import { View, ViewProps } from 'react-native'
import { Slider } from 'react-native-awesome-slider'
import Animated, { Reanimated3DefaultSpringConfig, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import CyMusicVolume from '../../modules/cymusic-native/volume'

export const PlayerVolumeBar = React.memo(({ style }: ViewProps) => {
	const colors = useThemeColors()
	const utilsStyles = useUtilsStyles()
	const progress = useSharedValue(0)
	const min = useSharedValue(0)
	const max = useSharedValue(1)
	const isSliding = useSharedValue(false)

	useEffect(() => {
		let active = true
		let volumeObserved = false
		const volumeListener = CyMusicVolume.addListener('volumeChanged', (result) => {
			if (!active) return
			volumeObserved = true
			progress.value = result.volume
		})

		CyMusicVolume.getVolume()
			.then((volume) => {
				if (active && !volumeObserved) progress.value = volume
			})
			.catch((error) => logWarn('Failed to read system volume', error))

		return () => {
			active = false
			volumeListener.remove()
		}
	}, [])

	const animatedSliderStyle = useAnimatedStyle(() => {
		return {
			transform: [{ scaleY: withSpring(isSliding.value ? 2 : 1, Reanimated3DefaultSpringConfig) }],
		}
	})

	const handleSlidingStart = useCallback(() => {
		isSliding.value = true
	}, [])

	const handleSlidingComplete = useCallback(() => {
		isSliding.value = false
	}, [])

	const handleValueChange = useCallback(async (value: number) => {
		try {
			await CyMusicVolume.setVolume(value)
		} catch (error) {
			logWarn('Failed to set system volume', error)
		}
	}, [])

	const renderBubble = useCallback(() => null, [])
	const renderThumb = useCallback(() => null, [])

	return (
		<View style={style}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Ionicons name="volume-low" size={20} color={colors.icon} style={{ opacity: 0.8 }} />

				<Animated.View
					style={[{ flex: 1, flexDirection: 'row', paddingHorizontal: 10 }, animatedSliderStyle]}
				>
					<Slider
						progress={progress}
						minimumValue={min}
						containerStyle={utilsStyles.slider}
						onSlidingStart={handleSlidingStart}
						onSlidingComplete={handleSlidingComplete}
						onValueChange={handleValueChange}
						renderBubble={renderBubble}
						renderThumb={renderThumb}
						theme={{
							minimumTrackTintColor: colors.maximumTrackTintColor,
							maximumTrackTintColor: colors.maximumTrackTintColor,
						}}
						thumbWidth={0}
						maximumValue={max}
					/>
				</Animated.View>

				<Ionicons name="volume-high" size={20} color={colors.icon} style={{ opacity: 0.8 }} />
			</View>
		</View>
	)
})
