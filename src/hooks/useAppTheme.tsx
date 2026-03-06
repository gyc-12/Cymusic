import PersistStatus from '@/store/PersistStatus'
import { GlobalState } from '@/utils/stateMapper'
import {
	ThemeColors,
	ThemeMode,
	ResolvedTheme,
	getRuntimeColors,
	getThemeColors,
	setRuntimeColors,
} from '@/constants/tokens'
import React, { ReactNode, createContext, useContext, useEffect, useMemo } from 'react'
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native'

type AppThemeContextValue = {
	themeMode: ThemeMode
	resolvedTheme: ResolvedTheme
	colors: ThemeColors
	isDark: boolean
	blurTint: ThemeColors['blurTint']
	statusBarStyle: 'light' | 'dark'
	setThemeMode: (mode: ThemeMode) => void
}

const storedThemeMode = PersistStatus.get('app.themeMode') ?? 'system'

export const themeModeStore = new GlobalState<ThemeMode>(storedThemeMode)

const AppThemeContext = createContext<AppThemeContextValue | null>(null)

const createThemeValue = (
	themeMode: ThemeMode,
	resolvedTheme: ResolvedTheme,
	setThemeModeValue: (mode: ThemeMode) => void,
): AppThemeContextValue => {
	const colors = getThemeColors(resolvedTheme)

	return {
		themeMode,
		resolvedTheme,
		colors,
		isDark: resolvedTheme === 'dark',
		blurTint: colors.blurTint,
		statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
		setThemeMode: setThemeModeValue,
	}
}

const resolveTheme = (
	themeMode: ThemeMode,
	systemColorScheme: ColorSchemeName,
): ResolvedTheme => {
	if (themeMode === 'system') {
		return systemColorScheme === 'light' ? 'light' : 'dark'
	}

	return themeMode
}

export const setThemeMode = (mode: ThemeMode) => {
	PersistStatus.set('app.themeMode', mode)
	themeModeStore.setValue(mode)
}

export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
	const systemColorScheme = useColorScheme()
	const themeMode = themeModeStore.useValue() ?? storedThemeMode
	const resolvedTheme = resolveTheme(themeMode, systemColorScheme)
	const themeValue = useMemo(
		() => createThemeValue(themeMode, resolvedTheme, setThemeMode),
		[resolvedTheme, themeMode],
	)

	if (getRuntimeColors() !== themeValue.colors) {
		setRuntimeColors(themeValue.colors)
	}

	useEffect(() => {
		Appearance.setColorScheme(themeMode === 'system' ? null : resolvedTheme)
	}, [resolvedTheme, themeMode])

	return <AppThemeContext.Provider value={themeValue}>{children}</AppThemeContext.Provider>
}

export const ThemeOverrideProvider = ({
	children,
	resolvedTheme,
}: {
	children: ReactNode
	resolvedTheme: ResolvedTheme
}) => {
	const parentTheme = useAppTheme()

	const value = useMemo(
		() => createThemeValue(parentTheme.themeMode, resolvedTheme, parentTheme.setThemeMode),
		[parentTheme.setThemeMode, parentTheme.themeMode, resolvedTheme],
	)

	return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
}

export const useAppTheme = () => {
	const value = useContext(AppThemeContext)
	if (!value) {
		throw new Error('useAppTheme must be used within AppThemeProvider')
	}

	return value
}

export const useThemeColors = () => useAppTheme().colors

export const useThemeMode = () => {
	const { themeMode, resolvedTheme, setThemeMode } = useAppTheme()
	return { themeMode, resolvedTheme, setThemeMode }
}

