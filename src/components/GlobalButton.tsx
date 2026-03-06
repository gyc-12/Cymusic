import { router } from 'expo-router'
import React from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useThemeColors } from '@/hooks/useAppTheme'
import { View } from 'react-native'

const GlobalButton = () => {
	const colors = useThemeColors()

	const showPlayList = () => {
		router.navigate('/(modals)/settingModal')
	}

	return (
		<View>
			<MaterialCommunityIcons
				name="menu"
				size={27}
				onPress={showPlayList}
				color={colors.icon}
				style={{ marginRight: 6 }}
			/>
		</View>
	)
}

export default GlobalButton
