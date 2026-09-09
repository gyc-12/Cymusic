import { playbackService } from '@/constants/playbackService'
import { AppThemeProvider, useAppTheme } from '@/hooks/useAppTheme'
import LyricManager from '@/helpers/lyricManager'
import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState'
import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer'
import i18n, { setI18nConfig } from '@/utils/i18n'
import {
	DarkTheme,
	DefaultTheme,
	router,
	SplashScreen,
	Stack,
	ThemeProvider,
	useRootNavigationState,
} from 'expo-router'
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message'
import TrackPlayer from 'react-native-track-player'
SplashScreen.preventAutoHideAsync()

TrackPlayer.registerPlaybackService(() => playbackService)
setI18nConfig()
const App = () => {
	const handleTrackPlayerLoaded = useCallback(() => {
		void SplashScreen.hideAsync()
	}, [])

	useSetupTrackPlayer({
		onLoad: handleTrackPlayerLoaded, //播放器初始化后调用这个回调函数。这里先传过去。
	})

	useLogTrackPlayerState()
	useEffect(() => {
		void LyricManager.setup()
	}, [])
	return (
		<ShareIntentProvider
			options={{
				debug: true,
				resetOnBackground: false,
				onResetShareIntent: () =>
					// used when app going in background and when the reset button is pressed
					router.replace({
						pathname: '/',
					}),
			}}
		>
			<AppThemeProvider>
				<ThemedAppShell />
			</AppThemeProvider>
		</ShareIntentProvider>
	)
}

const ThemedAppShell = () => {
	const { colors, isDark, statusBarStyle } = useAppTheme()
	const { hasShareIntent } = useShareIntentContext()
	const navigationState = useRootNavigationState()

	useEffect(() => {
		if (navigationState?.key && hasShareIntent) {
			router.replace('/(modals)/cymusic')
		}
	}, [hasShareIntent, navigationState?.key])

	const toastConfig = useMemo(
		() => ({
			success: (props) => (
				<BaseToast
					{...props}
					style={{
						borderLeftColor: colors.toastAccent,
						backgroundColor: colors.toastBackground,
					}}
					contentContainerStyle={{ paddingHorizontal: 15 }}
					text1Style={{
						fontSize: 15,
						fontWeight: '400',
						color: colors.toastAccent,
					}}
					text2Style={{
						fontSize: 15,
						fontWeight: '400',
						color: colors.toastAccent,
					}}
				/>
			),
			error: (props) => (
				<ErrorToast
					{...props}
					style={{
						borderLeftColor: colors.toastAccent,
						backgroundColor: colors.toastBackground,
					}}
					contentContainerStyle={{ paddingHorizontal: 15 }}
					text1Style={{
						fontSize: 15,
						fontWeight: '400',
						color: colors.toastAccent,
					}}
					text2Style={{
						fontSize: 15,
						fontWeight: '400',
						color: colors.toastAccent,
					}}
				/>
			),
		}),
		[colors],
	)

	return (
		<SafeAreaProvider>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
					<RootNavigation />
				</ThemeProvider>
				<StatusBar style={statusBarStyle} />
				<Toast config={toastConfig} />
			</GestureHandlerRootView>
		</SafeAreaProvider>
	)
}

const RootNavigation = () => {
	const { colors } = useAppTheme()

	return (
		//每个 Stack.Screen 组件定义了一个可导航的屏幕
		<Stack>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen
				name="player"
				options={{
					presentation: 'card',
					gestureEnabled: true,
					gestureDirection: 'vertical',
					animationDuration: 400,
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(modals)/playList"
				options={{
					presentation: 'modal',
					gestureEnabled: true,
					gestureDirection: 'vertical',
					animationDuration: 400,
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(modals)/addToPlaylist"
				options={{
					presentation: 'modal',
					headerStyle: {
						backgroundColor: colors.background,
					},
					headerTitle: i18n.t('addToPlaylist.title'),
					headerTitleStyle: {
						color: colors.text,
					},
				}}
			/>
			<Stack.Screen
				name="(modals)/settingModal"
				options={{
					presentation: 'modal',
					headerShown: false,
					gestureEnabled: true,
					gestureDirection: 'vertical',
				}}
			/>
			<Stack.Screen
				name="(modals)/importPlayList"
				options={{
					presentation: 'modal',
					headerShown: false,
					gestureEnabled: true,
					gestureDirection: 'vertical',
				}}
			/>
			<Stack.Screen
				name="(modals)/[name]"
				options={{
					presentation: 'modal',
					headerShown: false,
					gestureEnabled: true,
					gestureDirection: 'vertical',
				}}
			/>
			<Stack.Screen
				name="(modals)/logScreen"
				options={{
					presentation: 'modal',
					headerShown: true,
					gestureEnabled: true,
					gestureDirection: 'vertical',
					headerTitle: '应用日志',
					headerStyle: {
						backgroundColor: colors.background,
					},
					headerTitleStyle: {
						color: colors.text,
					},
				}}
			/>
		</Stack>
	)
}

export default App
