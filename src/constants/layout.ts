import type { NativeStackNavigationOptions } from 'expo-router'
import { ThemeColors } from './tokens'

export const getStackScreenWithSearchBar = (
	colors: ThemeColors,
): NativeStackNavigationOptions => ({
	headerLargeTitle: true,
	headerStyle: {
		backgroundColor: colors.background,
	},
	headerLargeStyle: {
		backgroundColor: colors.background,
	},
	headerLargeTitleStyle: {
		color: colors.text,
	},
	headerTintColor: colors.text,
	headerShadowVisible: false,
})
