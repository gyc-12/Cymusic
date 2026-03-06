import { useThemeColors } from '@/hooks/useAppTheme'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useCallback } from 'react'
import { ComponentProps } from 'react'
import { match } from 'ts-pattern'
import myTrackPlayer, { MusicRepeatMode, repeatModeStore } from '@/helpers/trackPlayerIndex'

type IconProps = Omit<ComponentProps<typeof MaterialCommunityIcons>, 'name'>
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name']

export const PlayerRepeatToggle = React.memo(({ ...iconProps }: IconProps) => {
	const repeatMode = repeatModeStore.useValue()
	const colors = useThemeColors()

	const toggleRepeatMode = useCallback(() => {
		myTrackPlayer.toggleRepeatMode()
	}, [])

	const icon = match(repeatMode)
		.returnType<IconName>()
		.with(MusicRepeatMode.SHUFFLE, () => 'shuffle')
		.with(MusicRepeatMode.SINGLE, () => 'repeat-once')
		.with(MusicRepeatMode.QUEUE, () => 'repeat')
		.otherwise(() => 'repeat-off')

	return (
		<MaterialCommunityIcons
			name={icon}
			onPress={toggleRepeatMode}
			color={colors.icon}
			{...iconProps}
		/>
	)
})
