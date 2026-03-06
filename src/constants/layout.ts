import { NativeStackNavigationOptions } from '@react-navigation/native-stack'
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
