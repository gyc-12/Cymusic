import { ThemeColors, fontSize, getRuntimeColors } from '@/constants/tokens'
import { useThemeColors } from '@/hooks/useAppTheme'
import { StyleSheet } from 'react-native'
import { useMemo } from 'react'

const buildDefaultStyles = (colors: ThemeColors) => ({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	text: {
		fontSize: fontSize.base,
		color: colors.text,
	},
})

const buildUtilsStyles = (colors: ThemeColors) => {
	const defaultStyles = buildDefaultStyles(colors)

	return {
		centeredRow: {
			flexDirection: 'row' as const,
			justifyContent: 'center' as const,
			alignItems: 'center' as const,
		},
		rightRow: {
			flexDirection: 'row' as const,
			justifyContent: 'flex-end' as const,
			alignItems: 'center' as const,
		},
		slider: {
			height: 7,
			borderRadius: 16,
		},
		itemSeparator: {
			borderColor: colors.textMuted,
			borderWidth: StyleSheet.hairlineWidth,
			opacity: 0.3,
		},
		emptyContentText: {
			...defaultStyles.text,
			color: colors.textMuted,
			textAlign: 'center' as const,
			marginTop: 20,
		},
		emptyContentImage: {
			width: 200,
			height: 200,
			alignSelf: 'center' as const,
			marginTop: 40,
			opacity: 0.3,
		},
	}
}

export const getDefaultStyles = buildDefaultStyles
export const getUtilsStyles = buildUtilsStyles

export const useDefaultStyles = () => {
	const colors = useThemeColors()
	return useMemo(() => buildDefaultStyles(colors), [colors])
}

export const useUtilsStyles = () => {
	const colors = useThemeColors()
	return useMemo(() => buildUtilsStyles(colors), [colors])
}

export const defaultStyles = new Proxy({} as ReturnType<typeof buildDefaultStyles>, {
	get: (_target, prop: string) =>
		buildDefaultStyles(getRuntimeColors())[prop as keyof ReturnType<typeof buildDefaultStyles>],
}) as ReturnType<typeof buildDefaultStyles>

export const utilsStyles = new Proxy({} as ReturnType<typeof buildUtilsStyles>, {
	get: (_target, prop: string) =>
		buildUtilsStyles(getRuntimeColors())[prop as keyof ReturnType<typeof buildUtilsStyles>],
}) as ReturnType<typeof buildUtilsStyles>
