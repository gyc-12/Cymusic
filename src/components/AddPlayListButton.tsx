import { router } from 'expo-router'
import React from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useThemeColors } from '@/hooks/useAppTheme'
import { View } from 'react-native'

const AddPlayListButton = () => {
	const colors = useThemeColors()

	const showPlayList = () => {
		router.navigate('/(modals)/importPlayList')
	}

	return (
		<View>
			<MaterialCommunityIcons
				name="plus"
				size={27}
				onPress={showPlayList}
				color={colors.icon}
				style={{ marginRight: 6 }}
			/>
		</View>
	)
}

export default AddPlayListButton
