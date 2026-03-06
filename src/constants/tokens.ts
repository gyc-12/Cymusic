export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type BlurTint = 'light' | 'dark'

export type ThemeColors = {
	primary: string
	background: string
	surface: string
	surfaceElevated: string
	surfaceMuted: string
	card: string
	text: string
	textMuted: string
	icon: string
	border: string
	separator: string
	placeholder: string
	maximumTrackTintColor: string
	minimumTrackTintColor: string
	loading: string
	overlay: string
	overlayStrong: string
	overlaySoft: string
	shadow: string
	dismissBar: string
	artworkPlaceholder: string
	toastBackground: string
	toastAccent: string
	success: string
	error: string
	blurTint: BlurTint
}

export const lightColors: ThemeColors = {
	primary: '#fc3c44',
	background: '#ffffff',
	surface: '#f5f5f7',
	surfaceElevated: '#ffffff',
	surfaceMuted: '#eef1f5',
	card: '#ffffff',
	text: '#111827',
	textMuted: '#6b7280',
	icon: '#111827',
	border: 'rgba(17,24,39,0.12)',
	separator: 'rgba(17,24,39,0.08)',
	placeholder: '#9ca3af',
	maximumTrackTintColor: 'rgba(17,24,39,0.12)',
	minimumTrackTintColor: 'rgba(17,24,39,0.55)',
	loading: 'rgba(17,24,39,0.45)',
	overlay: 'rgba(0,0,0,0.45)',
	overlayStrong: 'rgba(255,255,255,0.92)',
	overlaySoft: 'rgba(17,24,39,0.08)',
	shadow: '#000000',
	dismissBar: 'rgba(17,24,39,0.35)',
	artworkPlaceholder: '#d1d5db',
	toastBackground: 'rgb(251,231,227)',
	toastAccent: 'rgb(252,87,59)',
	success: '#34c759',
	error: '#ff3b30',
	blurTint: 'light',
}

export const darkColors: ThemeColors = {
	primary: '#fc3c44',
	background: '#000000',
	surface: '#121212',
	surfaceElevated: 'rgb(32,32,32)',
	surfaceMuted: '#1c1c1f',
	card: '#202020',
	text: '#ffffff',
	textMuted: '#9ca3af',
	icon: '#ffffff',
	border: 'rgba(255,255,255,0.12)',
	separator: 'rgba(255,255,255,0.12)',
	placeholder: '#999999',
	maximumTrackTintColor: 'rgba(255,255,255,0.4)',
	minimumTrackTintColor: 'rgba(255,255,255,0.6)',
	loading: 'rgba(255,255,255,0.6)',
	overlay: 'rgba(0,0,0,0.5)',
	overlayStrong: 'rgba(0,0,0,0.82)',
	overlaySoft: 'rgba(255,255,255,0.1)',
	shadow: '#000000',
	dismissBar: 'rgba(255,255,255,0.7)',
	artworkPlaceholder: '#808080',
	toastBackground: 'rgb(251,231,227)',
	toastAccent: 'rgb(252,87,59)',
	success: '#34c759',
	error: '#ff3b30',
	blurTint: 'dark',
}

export const getThemeColors = (theme: ResolvedTheme): ThemeColors =>
	theme === 'light' ? lightColors : darkColors

let runtimeColors: ThemeColors = darkColors

export const setRuntimeColors = (nextColors: ThemeColors) => {
	runtimeColors = nextColors
}

export const getRuntimeColors = () => runtimeColors

export const colors = new Proxy({} as ThemeColors, {
	get: (_target, prop: string) => runtimeColors[prop as keyof ThemeColors],
}) as ThemeColors

export const fontSize = {
	xs: 12,
	sm: 16,
	base: 20,
	lg: 24,
}

export const screenPadding = {
	horizontal: 24,
}
