import { useThemeColors } from '@/hooks/useAppTheme'
import myTrackPlayer, { trackSkipLoadingStore } from '@/helpers/trackPlayerIndex'
import { FontAwesome6 } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native'
import TrackPlayer, { useIsPlaying } from 'react-native-track-player'

type PlayerControlsProps = {
	style?: ViewStyle
}

type PlayerButtonProps = {
	style?: ViewStyle
	iconSize?: number
	disabled?: boolean
}

export const PlayerControls = React.memo(({ style }: PlayerControlsProps) => {
	return (
		<View style={[styles.container, style]}>
			<View style={styles.row}>
				<SkipToPreviousButton />
				<PlayPauseButton />
				<SkipToNextButton />
			</View>
		</View>
	)
})

export const PlayPauseButton = React.memo(({ style, iconSize = 48 }: PlayerButtonProps) => {
	const { playing } = useIsPlaying()
	const colors = useThemeColors()

	return (
		<View style={[{ height: iconSize }, style]}>
			<TouchableOpacity
				activeOpacity={0.85}
				onPress={playing ? TrackPlayer.pause : TrackPlayer.play}
			>
				<FontAwesome6 name={playing ? 'pause' : 'play'} size={iconSize} color={colors.text} />
			</TouchableOpacity>
		</View>
	)
})

export const SkipToNextButton = React.memo(({ iconSize = 30, disabled = false }: PlayerButtonProps) => {
	const colors = useThemeColors()
	const trackSkipLoading = trackSkipLoadingStore.useValue()
	const isLoading = trackSkipLoading === 'next'
	const isDisabled = disabled || trackSkipLoading !== null

	return (
		<TouchableOpacity activeOpacity={0.7} disabled={isDisabled} onPress={myTrackPlayer.skipToNext}>
			<View style={styles.iconContainer}>
				{isLoading ? (
					<ActivityIndicator size="small" color={colors.text} />
				) : (
					<FontAwesome6 name="forward" size={iconSize} color={colors.text} />
				)}
			</View>
		</TouchableOpacity>
	)
})

export const SkipToPreviousButton = React.memo(({ iconSize = 30 }: PlayerButtonProps) => {
	const colors = useThemeColors()
	const trackSkipLoading = trackSkipLoadingStore.useValue()
	const isLoading = trackSkipLoading === 'previous'
	const isDisabled = trackSkipLoading !== null

	return (
		<TouchableOpacity
			activeOpacity={0.7}
			disabled={isDisabled}
			onPress={myTrackPlayer.skipToPrevious}
		>
			<View style={styles.iconContainer}>
				{isLoading ? (
					<ActivityIndicator size="small" color={colors.text} />
				) : (
					<FontAwesome6 name={'backward'} size={iconSize} color={colors.text} />
				)}
			</View>
		</TouchableOpacity>
	)
})

const styles = StyleSheet.create({
	container: {
		width: '100%',
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-evenly',
		alignItems: 'center',
	},
	iconContainer: {
		minWidth: 32,
		minHeight: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
