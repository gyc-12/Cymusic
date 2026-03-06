import { colors } from '@/constants/tokens'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { ComponentProps } from 'react'

type IconProps = Omit<ComponentProps<typeof MaterialCommunityIcons>, 'name'>

export const ShowPlayerListToggle = React.memo(({ ...iconProps }: IconProps) => {
	const showPlayList = useCallback(() => {
		router.navigate('/(modals)/playList')
	}, [])

	return (
		<MaterialCommunityIcons
			name={'playlist-music-outline'}
			onPress={showPlayList}
			color={colors.icon}
			{...iconProps}
		/>
	)
})
