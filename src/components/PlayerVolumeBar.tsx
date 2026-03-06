import { colors } from '@/constants/tokens'
import { utilsStyles } from '@/styles'
import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useEffect } from 'react'
import { View, ViewProps } from 'react-native'
import { Slider } from 'react-native-awesome-slider'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { VolumeManager } from 'react-native-volume-manager'

export const PlayerVolumeBar = React.memo(({ style }: ViewProps) => {
	const progress = useSharedValue(0)
	const min = useSharedValue(0)
	const max = useSharedValue(1)
	const isSliding = useSharedValue(false)

	useEffect(() => {
		const getInitialVolume = async () => {
			await VolumeManager.showNativeVolumeUI({ enabled: true })
			const initialVolume = await VolumeManager.getVolume()
			progress.value = initialVolume.volume
		}
		getInitialVolume()

		const volumeListener = VolumeManager.addVolumeListener((result) => {
			progress.value = result.volume
		})

		return () => {
			volumeListener.remove()
		}
	}, [])

	const animatedSliderStyle = useAnimatedStyle(() => {
		return {
			transform: [{ scaleY: withSpring(isSliding.value ? 2 : 1) }],
		}
	})

	const handleSlidingStart = useCallback(() => {
		isSliding.value = true
	}, [])

	const handleSlidingComplete = useCallback(() => {
		isSliding.value = false
	}, [])

	const handleValueChange = useCallback(async (value: number) => {
		await VolumeManager.setVolume(value, {
			type: 'system',
			showUI: true,
			playSound: false,
		})
	}, [])

	const renderBubble = useCallback(() => null, [])

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
